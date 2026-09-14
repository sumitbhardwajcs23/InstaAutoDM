// tests/verifyQuotaAndAdminCouponTracking.test.js
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

process.env.NODE_ENV = 'test';
process.env.META_MOCK_MODE = 'true';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const db = require('../backend/src/db');
const { dmLimitFor, dailyLimitFor, badgeFor, PLAN_LIMITS } = require('../backend/src/constants/planLimits');
const billingEngine = require('../backend/src/services/billingEngine');

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 Starting Quota Refresh, Coupon Tracking & Admin Visibility Tests');
  console.log('========================================\n');

  await db.ready();

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}\n${err.stack}`);
      failed++;
    }
  }

  // Generate synthetic test IDs
  const testUserId = `test-user-${uuidv4().slice(0, 8)}`;
  const testSubId = `test-sub-${uuidv4().slice(0, 8)}`;
  const testCouponId = `coup_${uuidv4().slice(0, 8)}`;
  const testCouponCode = `SAVE20_${uuidv4().slice(0, 4).toUpperCase()}`;

  const createdOrderIds = [];
  const createdInvoiceIds = [];

  try {
    // 0. Setup test user & coupon in PostgreSQL
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const nextMonthStr = new Date(Date.now() + 30 * 86400000).toISOString().replace('T', ' ').slice(0, 19);

    await db.prepare(`
      INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, custom_dm_limit, custom_daily_limit, created_at, updated_at)
      VALUES (?, ?, 'Synthetic Tester', 'free', 10, to_char(NOW(), 'YYYY-MM-DD'), 500, 20, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
    `).run(testUserId, `${testUserId}@airvix-test.local`);

    await db.prepare(`
      INSERT INTO subscriptions (id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
      VALUES (?, ?, 'free', 'active', 'monthly', ?, ?, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
    `).run(testSubId, testUserId, nowStr, nextMonthStr);

    await db.prepare(`
      INSERT INTO coupons (id, code, discount_percent, is_active, used_count, max_uses, created_at)
      VALUES (?, ?, 20, 1, 0, 100, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
    `).run(testCouponId, testCouponCode);

    // 1. Critical Plan Change Flow Test (free -> pro)
    const order1Id = `order_syn_${Date.now()}_1`;
    const pay1Id = `pay_syn_${Date.now()}_1`;
    createdOrderIds.push(order1Id);

    await test('Plan Change: free -> pro adopts pro quota, clears custom limits, records coupon & creates invoice', async () => {
      const result = await billingEngine.processVerifiedPayment({
        userId: testUserId,
        orderId: order1Id,
        paymentId: pay1Id,
        plan: 'pro',
        cycle: 'monthly',
        amount: 1199,
        currency: 'INR',
        eventType: 'payment.captured',
        notes: {
          is_plan_change: 'true',
          coupon_id: testCouponId,
          coupon_code: testCouponCode,
          discount_amount: 300
        }
      });

      assert.strictEqual(result.status, 'success');
      assert.strictEqual(result.plan, 'pro');

      // Check PostgreSQL authoritative subscriptions table
      const sub = await db.prepare('SELECT plan, status FROM subscriptions WHERE user_id = ?').get(testUserId);
      assert.strictEqual(sub.plan, 'pro', 'Subscription plan must be pro in database');
      assert.strictEqual(sub.status, 'active');

      // Check user record
      const user = await db.prepare('SELECT plan, custom_dm_limit, custom_daily_limit, dm_usage_this_period FROM users WHERE id = ?').get(testUserId);
      assert.strictEqual(user.plan, 'pro', 'User cache plan must be updated to pro');
      assert.strictEqual(user.custom_dm_limit, null, 'Custom dm limit must be reset on plan change');
      assert.strictEqual(user.dm_usage_this_period, 0, 'Usage must be reset to 0 on new plan transition');

      // Check effective quota calculation
      const monthlyLimit = dmLimitFor(sub.plan, user.custom_dm_limit);
      const dailyLimit = dailyLimitFor(sub.plan, user.custom_daily_limit, user.custom_dm_limit);
      const badge = badgeFor(sub.plan);

      assert.strictEqual(monthlyLimit, 25000, 'Effective monthly limit for PRO must be 25,000');
      assert.strictEqual(dailyLimit, Math.ceil(25000 / 30), 'Effective daily limit for PRO must be ceil(25000/30) = 834');
      assert.strictEqual(badge, 'PRO');

      // Check invoice table
      const inv = await db.prepare('SELECT * FROM invoices WHERE gateway_payment_id = ?').get(pay1Id);
      assert(inv, 'Invoice must be created');
      createdInvoiceIds.push(inv.id);
      assert.strictEqual(inv.coupon_code, testCouponCode);
      assert.strictEqual(inv.coupon_id, testCouponId);
      assert.strictEqual(Number(inv.discount_amount), 300);
      assert.strictEqual(inv.status, 'paid');

      // Check coupon_redemptions table
      const redemption = await db.prepare('SELECT * FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?').get(testCouponId, testUserId);
      assert(redemption, 'Coupon redemption record must exist');

      // Check coupons.used_count
      const coupon = await db.prepare('SELECT used_count FROM coupons WHERE id = ?').get(testCouponId);
      assert.strictEqual(Number(coupon.used_count), 1, 'Coupon used_count must be incremented to 1');
    });

    // 2. Duplicate Payment / Webhook Test (Idempotency)
    await test('Duplicate payment processing is idempotent: no second invoice, redemption, or counter increment', async () => {
      const dupResult = await billingEngine.processVerifiedPayment({
        userId: testUserId,
        orderId: order1Id, // Same order
        paymentId: pay1Id, // Same payment
        plan: 'pro',
        cycle: 'monthly',
        amount: 1199,
        currency: 'INR',
        eventType: 'payment.captured',
        notes: {
          is_plan_change: 'true',
          coupon_id: testCouponId,
          coupon_code: testCouponCode,
          discount_amount: 300
        }
      });

      assert.strictEqual(dupResult.status, 'already_processed', 'Duplicate payment must return already_processed');

      // Check invoice count
      const invRows = await db.prepare('SELECT COUNT(*) as count FROM invoices WHERE gateway_payment_id = ?').get(pay1Id);
      assert.strictEqual(parseInt(invRows.count, 10), 1, 'There must be exactly 1 invoice for the payment');

      // Check coupon redemptions count
      const redRows = await db.prepare('SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?').get(testCouponId, testUserId);
      assert.strictEqual(parseInt(redRows.count, 10), 1, 'There must be exactly 1 coupon redemption');

      // Check coupons.used_count did not increment again
      const coupon = await db.prepare('SELECT used_count FROM coupons WHERE id = ?').get(testCouponId);
      assert.strictEqual(Number(coupon.used_count), 1, 'Coupon used_count must still be 1');
    });

    // 3. Renewal Test (PRO renewing PRO)
    const orderRenewId = `order_syn_${Date.now()}_renew`;
    const payRenewId = `pay_syn_${Date.now()}_renew`;
    createdOrderIds.push(orderRenewId);

    await test('Renewal of PRO preserves plan pro and does not downgrade or reset plan incorrectly', async () => {
      // Simulate some usage during period
      await db.prepare('UPDATE users SET dm_usage_this_period = 150 WHERE id = ?').run(testUserId);

      const renewResult = await billingEngine.processVerifiedPayment({
        userId: testUserId,
        orderId: orderRenewId,
        paymentId: payRenewId,
        plan: 'pro',
        cycle: 'monthly',
        amount: 1499,
        currency: 'INR',
        eventType: 'payment.captured',
        notes: {}
      });

      assert.strictEqual(renewResult.status, 'success');
      assert.strictEqual(renewResult.plan, 'pro');

      // Subscription remains pro
      const sub = await db.prepare('SELECT plan, status FROM subscriptions WHERE user_id = ?').get(testUserId);
      assert.strictEqual(sub.plan, 'pro', 'Renewed subscription must remain pro');
      assert.strictEqual(sub.status, 'active');

      const inv = await db.prepare('SELECT * FROM invoices WHERE gateway_payment_id = ?').get(payRenewId);
      assert(inv, 'Renewal invoice must be created');
      createdInvoiceIds.push(inv.id);
      assert.strictEqual(inv.coupon_code, null, 'No coupon was used on renewal');
    });

    // 4. Sequential Plan Transitions (pro -> agency -> pro)
    await test('Plan transition pro -> agency -> pro adopts correct validated plans and quotas', async () => {
      const orderAgencyId = `order_syn_${Date.now()}_agency`;
      const payAgencyId = `pay_syn_${Date.now()}_agency`;
      createdOrderIds.push(orderAgencyId);

      const resAgency = await billingEngine.processVerifiedPayment({
        userId: testUserId,
        orderId: orderAgencyId,
        paymentId: payAgencyId,
        plan: 'agency',
        cycle: 'monthly',
        amount: 4999,
        currency: 'INR',
        eventType: 'payment.captured',
        notes: { is_plan_change: 'true' }
      });
      assert.strictEqual(resAgency.plan, 'agency');
      assert.strictEqual(dmLimitFor('agency'), 100000);
      assert.strictEqual(badgeFor('agency'), 'AGENCY');

      const subAgency = await db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(testUserId);
      assert.strictEqual(subAgency.plan, 'agency');

      // Now switch back from agency -> pro
      const orderProId = `order_syn_${Date.now()}_backpro`;
      const payProId = `pay_syn_${Date.now()}_backpro`;
      createdOrderIds.push(orderProId);

      const resPro = await billingEngine.processVerifiedPayment({
        userId: testUserId,
        orderId: orderProId,
        paymentId: payProId,
        plan: 'pro',
        cycle: 'monthly',
        amount: 1499,
        currency: 'INR',
        eventType: 'payment.captured',
        notes: { is_plan_change: 'true' }
      });
      assert.strictEqual(resPro.plan, 'pro');
      assert.strictEqual(dmLimitFor('pro'), 25000);

      const subPro = await db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(testUserId);
      assert.strictEqual(subPro.plan, 'pro');
    });

    // 5. Daily Limit Calculation & Custom Override Logic
    await test('Daily limit calculation adheres to Math.ceil(monthly / 30) and respects custom overrides', async () => {
      // Canonical formula checks
      assert.strictEqual(dailyLimitFor('free'), Math.ceil(1000 / 30)); // 34
      assert.strictEqual(dailyLimitFor('pro'), Math.ceil(25000 / 30)); // 834
      assert.strictEqual(dailyLimitFor('agency'), Math.ceil(100000 / 30)); // 3334
      assert.strictEqual(dailyLimitFor('enterprise'), Math.ceil(500000 / 30)); // 16667

      // Custom daily override
      assert.strictEqual(dailyLimitFor('pro', 250), 250, 'Explicit custom daily override must take precedence');
      assert.strictEqual(dailyLimitFor('pro', 0), 0, 'Zero daily limit must be respected');

      // Custom monthly limit derivation
      assert.strictEqual(dailyLimitFor('free', null, 6000), Math.ceil(6000 / 30), 'Custom monthly 6000 derives 200/day');

      // Badges
      assert.strictEqual(badgeFor('free'), 'FREE');
      assert.strictEqual(badgeFor('starter'), 'STARTER');
      assert.strictEqual(badgeFor('pro'), 'PRO');
      assert.strictEqual(badgeFor('agency'), 'AGENCY');
      assert.strictEqual(badgeFor('business'), 'BUSINESS');
      assert.strictEqual(badgeFor('enterprise'), 'ENTERPRISE');
    });

    // 6. Admin User Enrichment & Visibility Verification
    await test('Admin Users aggregation computes total_paid, latest_coupon, daily/monthly limits & badge', async () => {
      // Query user through admin query logic
      const u = await db.prepare(`
        SELECT u.id, u.email, u.name, u.plan, u.status, u.custom_dm_limit, u.custom_daily_limit
        FROM users u WHERE u.id = ?
      `).get(testUserId);

      const activeSub = await db.prepare(`
        SELECT plan, status FROM subscriptions WHERE user_id = ? AND status IN ('active', 'trialing') ORDER BY created_at DESC LIMIT 1
      `).get(testUserId);

      const invRows = await db.prepare(`
        SELECT amount, coupon_code, status FROM invoices WHERE user_id = ? AND status = 'paid' ORDER BY created_at DESC
      `).all(testUserId);

      const totalPaid = invRows.reduce((acc, i) => acc + Number(i.amount || 0), 0);
      const latestCoupon = invRows.find(i => i.coupon_code)?.coupon_code || null;

      const effectivePlan = (activeSub?.plan || u.plan || 'free').toLowerCase();
      const monthlyLimit = dmLimitFor(effectivePlan, u.custom_dm_limit);
      const dailyLimit = dailyLimitFor(effectivePlan, u.custom_daily_limit, u.custom_dm_limit);
      const badge = badgeFor(effectivePlan);

      assert.strictEqual(effectivePlan, 'pro');
      assert.strictEqual(badge, 'PRO');
      assert.strictEqual(monthlyLimit, 25000);
      assert.strictEqual(dailyLimit, 834);
      assert(totalPaid > 0, 'totalPaid must be greater than 0');
      assert.strictEqual(latestCoupon, testCouponCode, 'latestCoupon must match applied coupon');
    });

  } finally {
    // Clean up synthetic test records
    console.log('\n🧹 Cleaning up synthetic test records...');
    try {
      await db.prepare('DELETE FROM coupon_redemptions WHERE user_id = ?').run(testUserId);
      await db.prepare('DELETE FROM invoices WHERE user_id = ?').run(testUserId);
      await db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(testUserId);
      await db.prepare('DELETE FROM coupons WHERE id = ?').run(testCouponId);
      await db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
      console.log('   Test cleanup complete.');
    } catch (cleanErr) {
      console.error('   Cleanup warning:', cleanErr.message);
    }
  }

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) process.exit(1);
}

runTests().then(() => {
  setTimeout(() => process.exit(0), 1000);
}).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
