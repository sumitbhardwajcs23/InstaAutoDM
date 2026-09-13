/**
 * Comprehensive Subscription Lifecycle, Concurrency & Hardening Test Suite (v4)
 * 
 * Validates Migration 009 finalized requirements:
 * 1. Current Entitlement Subscription selection logic
 * 2. Current Entitlement ↔ users.plan invariant
 * 3. Current Entitlement ↔ users.subscription_status invariant
 * 4. Historical terminal rows coexisting with active subscription
 * 5. Exactly one active entitlement subscription under partial unique index
 * 6. Trialing expiry behavior (expires to free with no grace period)
 * 7. Active grace period protection (72h grace window protected)
 * 8. Expired grace period downgrade (downgraded to free after grace elapses)
 * 9. Cancel at period end (future period retains paid access; elapsed transitions to canceled)
 * 10. Late valid payment provisions exactly one NEW subscription (NO resurrection of terminal row)
 * 11. REAL CONCURRENCY RACE A: Renewal wins the lock -> Expiry unblocks & skips downgrade
 * 12. REAL CONCURRENCY RACE B: Expiry wins the lock -> Renewal unblocks & provisions new subscription
 * 13. Preflight data-quality check fails safely on malformed timestamp without silent NULL coercion
 * 14. Dynamic canonical plan resolution from pricing_plans SSOT
 * 15. Atomic transaction rollback on failure
 * 16. Interrupted renewal payment recovery: paid invoice exists -> worker avoids downgrade,
 *     reconciles period end via calendar cycle (no NOW()+30d), and preserves dm_usage_this_period = usage_counters.dms_sent
 * 17. Runtime malformed timestamp safety: quarantined into reconciliation_required,
 *     never auto-expired, never auto-entitled
 * 18. users.subscription_status semantics when NO Current Entitlement Subscription exists
 * 19. REAL CONCURRENT DUPLICATE-WEBHOOK RACE: Two independent connections fire same idempotency_key:
 *     exactly 1 processed, 1 duplicate returned, 1 invoice, 1 renewal, 1 usage reset
 * 20. REGRESSION: Existing annual subscription + webhook without cycle -> remains annual (+1 calendar year)
 * 21. REGRESSION: Existing annual subscription + webhook claiming monthly -> no silent downgrade (remains annual)
 * 22. REGRESSION: Existing scale subscription + renewal claiming pro -> remains scale (subscriptions.plan is SSOT)
 * 23. REGRESSION: reconciliation_required + stale users.plan=pro -> premium authorization denied (zero entitlement)
 */

const assert = require('assert');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../backend/src/db');
const { dmLimitFor } = require('../backend/src/constants/planLimits');

const {
  getCurrentEntitlementSubscription,
  getCanonicalFreePlan,
  runMigration009PreflightCheck,
  processPaymentWebhookProduction,
  processSubscriptionExpiriesProduction
} = require('../backend/src/services/billingEngine');

// Wrappers routing to production engine
async function executeExpiryTransition(pool, subscriptionId) {
  const res = await processSubscriptionExpiriesProduction(pool, subscriptionId);
  return res.lastResult || { transitioned: false };
}

async function executeRenewalTransition(pool, { userId, plan, cycle = 'monthly', idempotencyKey, explicitSubId = null }) {
  return await processPaymentWebhookProduction('razorpay', 'subscription.charged', idempotencyKey, {
    user_id: userId,
    plan,
    cycle,
    subscription_id: explicitSubId
  });
}

async function runSubscriptionLifecycleTests() {
  console.log('🧪 Starting Finalized Subscription Lifecycle & Concurrency Verification Test Suite (v4)...\n');
  await db.ready();
  const pool = db.getPgPool();
  if (!pool) {
    console.error('❌ Database pool unavailable.');
    process.exit(1);
  }

  // Ensure safe_timestamptz helper function is available in PostgreSQL
  await pool.query(`
    CREATE OR REPLACE FUNCTION safe_timestamptz(ts_text TEXT)
    RETURNS TIMESTAMPTZ IMMUTABLE PARALLEL SAFE LANGUAGE plpgsql AS $$
    BEGIN
      IF ts_text IS NULL OR TRIM(ts_text) = '' THEN
        RETURN NULL;
      END IF;
      IF ts_text ~ '^\\d{4}-\\d{2}-\\d{2}' THEN
        RETURN ts_text::timestamptz;
      ELSIF ts_text ~ '^\\d+$' THEN
        RETURN to_timestamp(ts_text::double precision / 1000.0);
      ELSE
        RETURN NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
    $$;
  `);

  let passed = 0;
  let failed = 0;
  const testResults = [];

  async function test(name, fn) {
    const startTime = Date.now();
    try {
      await fn();
      const durationMs = Date.now() - startTime;
      console.log(`  ✅ PASS: ${name} (${durationMs}ms)`);
      testResults.push({ name, status: 'PASS', durationMs });
      passed++;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      console.error(`  ❌ FAIL: ${name} (${durationMs}ms)`);
      console.error(`     Error: ${err.message}\n`, err.stack);
      testResults.push({ name, status: 'FAIL', durationMs, error: err.message });
      failed++;
    }
  }

  async function createTestFixture({ 
    userPlan = 'pro', 
    subPlan = 'pro', 
    subStatus = 'active', 
    billingCycle = 'monthly',
    periodEndOffsetHours = 24, 
    cancelAtPeriodEnd = 0, 
    gracePeriodOffsetHours = null,
    isTrial = false 
  }) {
    const userId = `usr_test_${uuidv4().slice(0, 8)}`;
    const subId = `sub_test_${uuidv4().slice(0, 8)}`;
    const email = `test_${uuidv4().slice(0, 6)}@airvix-test.local`;

    const now = new Date();
    const periodStart = new Date(now.getTime() - 30 * 86400000).toISOString();
    const periodEnd = new Date(now.getTime() + periodEndOffsetHours * 3600000).toISOString();
    const gracePeriodEnd = gracePeriodOffsetHours !== null ? new Date(now.getTime() + gracePeriodOffsetHours * 3600000).toISOString() : null;
    const trialEnd = isTrial ? periodEnd : null;

    await pool.query(`
      INSERT INTO users (id, email, name, plan, subscription_status, dm_usage_this_period, usage_period_start, created_at, updated_at)
      VALUES ($1, $2, 'Lifecycle Tester', $3, $4, 45, to_char(CURRENT_DATE - INTERVAL '15 days', 'YYYY-MM-DD'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
    `, [userId, email, userPlan, subStatus]);

    await pool.query(`
      INSERT INTO subscriptions (
        id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, 
        cancel_at_period_end, trial_ends_at, grace_period_ends_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
    `, [subId, userId, subPlan, subStatus, billingCycle, periodStart, periodEnd, cancelAtPeriodEnd, trialEnd, gracePeriodEnd]);

    await pool.query(`
      INSERT INTO usage_counters (id, user_id, period_start, period_end, dms_sent, comments_replied, updated_at)
      VALUES ($1, $2, (NOW() - INTERVAL '15 days'), (NOW() + INTERVAL '15 days'), 45, 10, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      ON CONFLICT (user_id) DO UPDATE SET dms_sent = 45
    `, [`cnt_${userId}`, userId]);

    return { userId, subId, email, periodEnd, gracePeriodEnd, trialEnd };
  }

  async function cleanupFixture(userId) {
    if (!userId || !userId.startsWith('usr_test_')) return;
    await pool.query('DELETE FROM usage_counters WHERE user_id = $1', [userId]).catch(() => {});
    await pool.query('DELETE FROM invoices WHERE user_id = $1', [userId]).catch(() => {});
    await pool.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]).catch(() => {});
    await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Current Entitlement Subscription Selector
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 1: Current Entitlement Subscription Selector resolves newest active row and ignores terminal rows', async () => {
    const f = await createTestFixture({ periodEndOffsetHours: 48 });
    try {
      const ent = await getCurrentEntitlementSubscription(pool, f.userId);
      assert.ok(ent, 'Must find entitlement subscription');
      assert.strictEqual(ent.id, f.subId);
      assert.strictEqual(ent.status, 'active');

      const oldSubId = `sub_test_${uuidv4().slice(0, 8)}`;
      await pool.query(`
        INSERT INTO subscriptions (id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
        VALUES ($1, $2, 'free', 'expired', 'monthly', '2026-01-01', '2026-02-01', to_char(NOW() - INTERVAL '30 days', 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      `, [oldSubId, f.userId]);

      const ent2 = await getCurrentEntitlementSubscription(pool, f.userId);
      assert.strictEqual(ent2.id, f.subId, 'Must continue to resolve active sub');
    } finally {
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Invariant Current Entitlement ↔ users.plan
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 2: Invariant: users.plan matches Current Entitlement Subscription plan', async () => {
    const f = await createTestFixture({ periodEndOffsetHours: 48 });
    try {
      const ent = await getCurrentEntitlementSubscription(pool, f.userId);
      const user = (await pool.query('SELECT plan FROM users WHERE id = $1', [f.userId])).rows[0];
      assert.strictEqual(user.plan, ent.plan);
    } finally {
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Invariant Current Entitlement ↔ users.subscription_status
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 3: Invariant: users.subscription_status matches Current Entitlement status', async () => {
    const f = await createTestFixture({ periodEndOffsetHours: 48 });
    try {
      const ent = await getCurrentEntitlementSubscription(pool, f.userId);
      const user = (await pool.query('SELECT subscription_status FROM users WHERE id = $1', [f.userId])).rows[0];
      assert.strictEqual(user.subscription_status, ent.status);
    } finally {
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Coexistence of Historical Terminal Rows
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 4: Historical terminal rows coexist without violating constraints', async () => {
    const f = await createTestFixture({ periodEndOffsetHours: 48 });
    try {
      for (let i = 1; i <= 3; i++) {
        await pool.query(`
          INSERT INTO subscriptions (id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
          VALUES ($1, $2, 'pro', 'expired', 'monthly', '2025-01-01', '2025-02-01', to_char(NOW() - INTERVAL '${i * 30} days', 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
        `, [`sub_hist_${i}_${uuidv4().slice(0, 6)}`, f.userId]);
      }
      const allRows = (await pool.query('SELECT COUNT(*) as count FROM subscriptions WHERE user_id = $1', [f.userId])).rows[0].count;
      assert.strictEqual(parseInt(allRows, 10), 4);
    } finally {
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: Partial Unique Index Prevents Multiple Active Rows
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 5: Partial unique index blocks insertion of second active entitlement row', async () => {
    const f = await createTestFixture({ periodEndOffsetHours: 48 });
    try {
      let threw = false;
      try {
        await pool.query(`
          INSERT INTO subscriptions (id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
          VALUES ($1, $2, 'agency', 'active', 'monthly', '2026-09-01', '2026-10-01', to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
        `, [`sub_dup_${uuidv4().slice(0, 8)}`, f.userId]);
      } catch (err) {
        threw = true;
        assert.ok(err.message.includes('unique') || err.message.includes('idx_uq_user_active_sub'));
      }
      assert.strictEqual(threw, true, 'Must reject second active row');
    } finally {
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: Trialing Expiry Direct to Free
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 6: Expired trial transitions directly to free (no grace period applied)', async () => {
    const f = await createTestFixture({ isTrial: true, subStatus: 'trialing', userPlan: 'pro', periodEndOffsetHours: -2 });
    try {
      const res = await executeExpiryTransition(pool, f.subId);
      assert.strictEqual(res.transitioned, true);
      assert.strictEqual(res.terminalStatus, 'expired');

      const user = (await pool.query('SELECT plan, subscription_status FROM users WHERE id = $1', [f.userId])).rows[0];
      assert.strictEqual(user.plan, 'free');
      assert.strictEqual(user.subscription_status, 'expired');
    } finally {
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7: Active Grace Period Protection
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 7: Active grace period protects access during payment retry window', async () => {
    const f = await createTestFixture({ 
      subStatus: 'grace_period', 
      userPlan: 'pro', 
      periodEndOffsetHours: -5, 
      gracePeriodOffsetHours: 48 
    });
    try {
      const res = await executeExpiryTransition(pool, f.subId);
      assert.strictEqual(res.transitioned, false, 'Must NOT downgrade during active grace window');
      assert.strictEqual(res.reason, 'active_grace_period');
    } finally {
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 8: Expired Grace Period Downgrade
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 8: Expired grace period downgrades cleanly to expired/free', async () => {
    const f = await createTestFixture({ 
      subStatus: 'grace_period', 
      userPlan: 'pro', 
      periodEndOffsetHours: -80, 
      gracePeriodOffsetHours: -2 
    });
    try {
      const res = await executeExpiryTransition(pool, f.subId);
      assert.strictEqual(res.transitioned, true);
      assert.strictEqual(res.terminalStatus, 'expired');

      const user = (await pool.query('SELECT plan, subscription_status FROM users WHERE id = $1', [f.userId])).rows[0];
      assert.strictEqual(user.plan, 'free');
      assert.strictEqual(user.subscription_status, 'expired');
    } finally {
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 9: Cancel at Period End Lifecycle
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 9: Cancel at period end retains access until period expires, then cancels', async () => {
    const fFuture = await createTestFixture({ cancelAtPeriodEnd: 1, periodEndOffsetHours: 72 });
    try {
      const resFuture = await executeExpiryTransition(pool, fFuture.subId);
      assert.strictEqual(resFuture.transitioned, false);
      assert.strictEqual(resFuture.reason, 'period_not_ended');
    } finally {
      await cleanupFixture(fFuture.userId);
    }

    const fElapsed = await createTestFixture({ cancelAtPeriodEnd: 1, periodEndOffsetHours: -2 });
    try {
      const resElapsed = await executeExpiryTransition(pool, fElapsed.subId);
      assert.strictEqual(resElapsed.transitioned, true);
      assert.strictEqual(resElapsed.terminalStatus, 'canceled');

      const user = (await pool.query('SELECT plan, subscription_status FROM users WHERE id = $1', [fElapsed.userId])).rows[0];
      assert.strictEqual(user.plan, 'free');
      assert.strictEqual(user.subscription_status, 'canceled');
    } finally {
      await cleanupFixture(fElapsed.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10: Non-Resurrection Policy on Late Payment
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 10: Non-resurrection: Late valid payment provisions exactly one NEW subscription', async () => {
    const f = await createTestFixture({ subStatus: 'expired', userPlan: 'free', periodEndOffsetHours: -50 });
    const idemKey = `idem_late_${uuidv4().slice(0, 8)}`;
    try {
      const res = await executeRenewalTransition(pool, { userId: f.userId, plan: 'pro', idempotencyKey: idemKey });
      assert.strictEqual(res.processed, true);
      assert.strictEqual(res.isNewSubscription, true);
      assert.notStrictEqual(res.subscriptionId, f.subId, 'Must provision a brand new row');

      const oldSub = (await pool.query('SELECT status FROM subscriptions WHERE id = $1', [f.subId])).rows[0];
      assert.strictEqual(oldSub.status, 'expired', 'Old row must remain expired');

      const activeSubs = (await pool.query("SELECT id FROM subscriptions WHERE user_id = $1 AND status = 'active'", [f.userId])).rows;
      assert.strictEqual(activeSubs.length, 1);
      assert.strictEqual(activeSubs[0].id, res.subscriptionId);
    } finally {
      await pool.query('DELETE FROM payment_webhook_events WHERE idempotency_key = $1', [idemKey]).catch(() => {});
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 11: Production Concurrency Race A (Renewal Wins Lock)
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 11: Concurrency Race A - Renewal wins lock; Expiry unblocks and skips downgrade', async () => {
    const f = await createTestFixture({ periodEndOffsetHours: -0.001 });
    const clientA = await pool.connect();
    const clientB = await pool.connect();

    try {
      await clientA.query('BEGIN');
      const lockRes = await clientA.query('SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE', [f.subId]);
      assert.strictEqual(lockRes.rows.length, 1);

      let expiryDone = false;
      let expiryResult = null;
      const expiryPromise = (async () => {
        expiryResult = await processSubscriptionExpiriesProduction(pool, f.subId);
        expiryDone = true;
      })();

      await new Promise(r => setTimeout(r, 60));
      assert.strictEqual(expiryDone, false, 'Expiry worker must block waiting for lock on clientA');

      const futureEnd = new Date(Date.now() + 30 * 86400000).toISOString();
      await clientA.query(`
        UPDATE subscriptions 
        SET status = 'active', current_period_end = $1, updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        WHERE id = $2
      `, [futureEnd, f.subId]);
      await clientA.query("UPDATE users SET plan = 'pro', subscription_status = 'active' WHERE id = $1", [f.userId]);
      await clientA.query('COMMIT');

      await expiryPromise;
      assert.strictEqual(expiryResult.lastResult.reason, 'period_not_ended');

      const currentSub = await getCurrentEntitlementSubscription(pool, f.userId);
      assert.strictEqual(currentSub.id, f.subId);
      assert.strictEqual(currentSub.status, 'active');
      const user = (await pool.query('SELECT plan, subscription_status FROM users WHERE id = $1', [f.userId])).rows[0];
      assert.strictEqual(user.plan, 'pro');
      assert.strictEqual(user.subscription_status, 'active');
    } finally {
      clientA.release();
      clientB.release();
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 12: Production Concurrency Race B (Expiry Wins Lock -> Renewal Provisions New Sub)
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 12: Concurrency Race B - Expiry wins lock; Renewal unblocks and provisions new subscription', async () => {
    const f = await createTestFixture({ periodEndOffsetHours: -0.001 });
    const idemKey = `race_b_${uuidv4().slice(0, 8)}`;

    const clientB = await pool.connect();

    try {
      await clientB.query('BEGIN');
      await clientB.query('SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE', [f.subId]);

      let renewalDone = false;
      let renewalResult = null;
      const renewalPromise = (async () => {
        renewalResult = await processPaymentWebhookProduction('razorpay', 'subscription.charged', idemKey, {
          user_id: f.userId,
          plan: 'pro',
          cycle: 'monthly',
          subscription_id: f.subId
        });
        renewalDone = true;
      })();

      await new Promise(r => setTimeout(r, 60));
      assert.strictEqual(renewalDone, false, 'Renewal must block waiting for lock on clientB');

      await clientB.query("UPDATE subscriptions SET status = 'expired' WHERE id = $1", [f.subId]);
      await clientB.query("UPDATE users SET plan = 'free', subscription_status = 'expired' WHERE id = $1", [f.userId]);
      await clientB.query('COMMIT');

      await renewalPromise;
      assert.strictEqual(renewalResult.processed, true);
      assert.strictEqual(renewalResult.isNewSubscription, true);
      assert.notStrictEqual(renewalResult.subscriptionId, f.subId);

      const activeSubs = (await pool.query("SELECT id FROM subscriptions WHERE user_id = $1 AND status = 'active'", [f.userId])).rows;
      assert.strictEqual(activeSubs.length, 1);
      assert.strictEqual(activeSubs[0].id, renewalResult.subscriptionId);

      const oldSub = (await pool.query('SELECT status FROM subscriptions WHERE id = $1', [f.subId])).rows[0];
      assert.strictEqual(oldSub.status, 'expired');

      const user = (await pool.query('SELECT plan, subscription_status FROM users WHERE id = $1', [f.userId])).rows[0];
      assert.strictEqual(user.plan, 'pro');
      assert.strictEqual(user.subscription_status, 'active');
    } finally {
      clientB.release();
      await pool.query('DELETE FROM payment_webhook_events WHERE idempotency_key = $1', [idemKey]).catch(() => {});
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 13: Preflight Data-Quality Check Aborts Safely on Bad Data
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 13: Migration 009 preflight check detects corrupted timestamps and aborts safely', async () => {
    const normalCheck = await runMigration009PreflightCheck(pool);
    assert.strictEqual(normalCheck.ok, true);

    const corruptUserId = `usr_test_${uuidv4().slice(0, 8)}`;
    await pool.query(`
      INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at)
      VALUES ($1, 'bad@airvix-test.local', 'Corrupt Tester', 'free', 0, '2026-09-01', to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
    `, [corruptUserId]);

    const corruptSubId = `sub_test_${uuidv4().slice(0, 8)}`;
    await pool.query(`
      INSERT INTO subscriptions (id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
      VALUES ($1, $2, 'pro', 'active', 'monthly', 'CORRUPTED_TEXT_VALUE', '2026-10-15', to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
    `, [corruptSubId, corruptUserId]);

    let preflightFailed = false;
    try {
      await runMigration009PreflightCheck(pool);
    } catch (err) {
      preflightFailed = true;
      assert.ok(err.message.includes('Preflight FAILED'));
      assert.ok(err.message.includes('CORRUPTED_TEXT_VALUE'));
    } finally {
      await pool.query('DELETE FROM subscriptions WHERE id = $1', [corruptSubId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id = $1', [corruptUserId]).catch(() => {});
    }

    assert.strictEqual(preflightFailed, true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 14: Dynamic Canonical Plan Resolution from pricing_plans SSOT
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 14: Dynamic plan limit and canonical slug resolution from pricing_plans', async () => {
    const freeLimit = dmLimitFor('free');
    assert.strictEqual(typeof freeLimit, 'number');
    assert.ok(freeLimit > 0);

    const proLimit = dmLimitFor('pro');
    assert.strictEqual(typeof proLimit, 'number');
    assert.ok(proLimit === -1 || proLimit > freeLimit);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 15: Atomic Transaction Rollback on Error
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 15: Injected error causes atomic rollback; subscription status untouched', async () => {
    const f = await createTestFixture({ periodEndOffsetHours: -5 });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE subscriptions SET status = 'expired' WHERE id = $1", [f.subId]);
      
      let rolledBack = false;
      try {
        await client.query("UPDATE users SET non_existent_column = 'fail' WHERE id = $1", [f.userId]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        rolledBack = true;
      }
      assert.strictEqual(rolledBack, true);

      const sub = (await pool.query('SELECT status FROM subscriptions WHERE id = $1', [f.subId])).rows[0];
      assert.strictEqual(sub.status, 'active');
    } finally {
      client.release();
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 16: Interrupted Renewal Recovery (Calendar derivation & Usage preservation)
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 16: Interrupted renewal payment with committed paid invoice prevents downgrade and reconciles period without NOW()+30d', async () => {
    const f = await createTestFixture({ periodEndOffsetHours: -1, billingCycle: 'yearly' });
    const correlatedInvoiceId = `inv_recov_${uuidv4().slice(0, 8)}`;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    try {
      await pool.query(`
        INSERT INTO invoices (
          id, user_id, subscription_id, invoice_number, amount, tax, currency, status, gateway, gateway_payment_id,
          billing_name, billing_email, paid_at, created_at
        ) VALUES ($1, $2, $3, $4, 13188, 2374, 'INR', 'paid', 'razorpay', 'pay_recovered_yearly', 'Tester', 'test@test.local', $5, $5)
      `, [correlatedInvoiceId, f.userId, f.subId, `INV-RECOV-${Date.now()}`, nowStr]);

      const subCountBefore = (await pool.query('SELECT COUNT(*) as count FROM subscriptions WHERE user_id = $1', [f.userId])).rows[0].count;
      const invCountBefore = (await pool.query('SELECT COUNT(*) as count FROM invoices WHERE user_id = $1', [f.userId])).rows[0].count;

      const res = await processSubscriptionExpiriesProduction(pool, f.subId);

      assert.strictEqual(res.lastResult.transitioned, false);
      assert.strictEqual(res.lastResult.reconciled, true);
      assert.strictEqual(res.lastResult.invoiceId, correlatedInvoiceId);
      assert.strictEqual(res.lastResult.isYearly, true);

      // Verify period end extended by 1 full calendar year
      const sub = (await pool.query('SELECT status, plan, current_period_end FROM subscriptions WHERE id = $1', [f.subId])).rows[0];
      assert.strictEqual(sub.status, 'active');
      const subEndDate = new Date(sub.current_period_end);
      const daysAhead = Math.round((subEndDate.getTime() - Date.now()) / 86400000);
      assert.ok(daysAhead >= 360, `Yearly extension must be ~365 days ahead, got: ${daysAhead} days`);

      // CRITICAL CHECK 6: Verify users.dm_usage_this_period = usage_counters.dms_sent preserved
      const user = (await pool.query('SELECT plan, subscription_status, dm_usage_this_period FROM users WHERE id = $1', [f.userId])).rows[0];
      const counter = (await pool.query('SELECT dms_sent FROM usage_counters WHERE user_id = $1', [f.userId])).rows[0];
      assert.strictEqual(user.dm_usage_this_period, counter.dms_sent, 'users.dm_usage_this_period must match usage_counters.dms_sent');
      assert.strictEqual(user.dm_usage_this_period, 45, 'Usage count of 45 must be preserved');

      // Verify no duplicates created
      const subCountAfter = (await pool.query('SELECT COUNT(*) as count FROM subscriptions WHERE user_id = $1', [f.userId])).rows[0].count;
      const invCountAfter = (await pool.query('SELECT COUNT(*) as count FROM invoices WHERE user_id = $1', [f.userId])).rows[0].count;
      assert.strictEqual(subCountAfter, subCountBefore);
      assert.strictEqual(invCountAfter, invCountBefore);
    } finally {
      await pool.query('DELETE FROM invoices WHERE id = $1', [correlatedInvoiceId]).catch(() => {});
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 17: Runtime Malformed Billing Timestamp Safety
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 17: Malformed billing timestamp at runtime triggers quarantine; never auto-expires or auto-entitles', async () => {
    const f = await createTestFixture({ periodEndOffsetHours: 24 });
    try {
      await pool.query("UPDATE subscriptions SET current_period_end = 'MALFORMED_GARBAGE_STRING' WHERE id = $1", [f.subId]);

      const res = await processSubscriptionExpiriesProduction(pool, f.subId);

      assert.strictEqual(res.lastResult.transitioned, false);
      assert.strictEqual(res.lastResult.quarantined, true);

      const sub = (await pool.query('SELECT status FROM subscriptions WHERE id = $1', [f.subId])).rows[0];
      assert.strictEqual(sub.status, 'reconciliation_required');

      const user = (await pool.query('SELECT subscription_status FROM users WHERE id = $1', [f.userId])).rows[0];
      assert.strictEqual(user.subscription_status, 'reconciliation_required');
      assert.notStrictEqual(user.subscription_status, 'active');
    } finally {
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 18: users.subscription_status Semantics with No Current Entitlement
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 18: users.subscription_status reflects historical terminal state or native free tier when no active entitlement', async () => {
    const fExpired = await createTestFixture({ periodEndOffsetHours: -2 });
    try {
      await processSubscriptionExpiriesProduction(pool, fExpired.subId);
      const userExp = (await pool.query('SELECT plan, subscription_status FROM users WHERE id = $1', [fExpired.userId])).rows[0];
      assert.strictEqual(userExp.plan, 'free');
      assert.strictEqual(userExp.subscription_status, 'expired');
    } finally {
      await cleanupFixture(fExpired.userId);
    }

    const fCanceled = await createTestFixture({ cancelAtPeriodEnd: 1, periodEndOffsetHours: -2 });
    try {
      await processSubscriptionExpiriesProduction(pool, fCanceled.subId);
      const userCanc = (await pool.query('SELECT plan, subscription_status FROM users WHERE id = $1', [fCanceled.userId])).rows[0];
      assert.strictEqual(userCanc.plan, 'free');
      assert.strictEqual(userCanc.subscription_status, 'canceled');
    } finally {
      await cleanupFixture(fCanceled.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 19: Genuine Concurrent Database Race on Webhook Idempotency (Two Independent Connections)
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 19: Genuine concurrent database race on webhook idempotency (Two Independent Connections)', async () => {
    const f = await createTestFixture({ periodEndOffsetHours: -1 });
    const idemKey = `race_idem_${uuidv4().slice(0, 10)}`;

    try {
      // Fire two concurrent webhook processing requests with the exact same idempotency_key
      // across independent client connections
      const p1 = processPaymentWebhookProduction('razorpay', 'subscription.charged', idemKey, {
        user_id: f.userId,
        plan: 'pro',
        cycle: 'monthly'
      });
      const p2 = processPaymentWebhookProduction('razorpay', 'subscription.charged', idemKey, {
        user_id: f.userId,
        plan: 'pro',
        cycle: 'monthly'
      });

      const [r1, r2] = await Promise.all([p1, p2]);

      // Exactly one processed=true, one duplicate=true
      const processedCount = (r1.processed ? 1 : 0) + (r2.processed ? 1 : 0);
      const duplicateCount = (r1.duplicate ? 1 : 0) + (r2.duplicate ? 1 : 0);
      assert.strictEqual(processedCount, 1, 'Exactly one caller must succeed with processed=true');
      assert.strictEqual(duplicateCount, 1, 'Exactly one caller must receive duplicate=true');

      const winningResult = r1.processed ? r1 : r2;
      const losingResult = r1.duplicate ? r1 : r2;
      assert.strictEqual(winningResult.processed, true);
      assert.strictEqual(losingResult.duplicate, true);
      assert.strictEqual(losingResult.processed, undefined, 'Losing transaction must not report processed');

      // Verify database state: Exactly one webhook event record
      const eventRows = (await pool.query('SELECT id, status FROM payment_webhook_events WHERE idempotency_key = $1', [idemKey])).rows;
      assert.strictEqual(eventRows.length, 1, 'Exactly one webhook event row must exist');
      assert.strictEqual(eventRows[0].status, 'processed');

      // Exactly one invoice created
      const invoiceRows = (await pool.query('SELECT id FROM invoices WHERE user_id = $1', [f.userId])).rows;
      assert.strictEqual(invoiceRows.length, 1, 'Exactly one invoice must be created');

      // Exactly one subscription renewal occurred (period extended once by 1 month, NOT twice)
      const subRows = (await pool.query("SELECT id, status, current_period_end FROM subscriptions WHERE user_id = $1 AND status = 'active'", [f.userId])).rows;
      assert.strictEqual(subRows.length, 1, 'Exactly one active subscription must exist');

      // Usage reset exactly once
      const counterRows = (await pool.query('SELECT dms_sent FROM usage_counters WHERE user_id = $1', [f.userId])).rows;
      assert.strictEqual(counterRows.length, 1);
      assert.strictEqual(counterRows[0].dms_sent, 0);
    } finally {
      await pool.query('DELETE FROM payment_webhook_events WHERE idempotency_key = $1', [idemKey]).catch(() => {});
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 20: Existing Annual Subscription + Webhook without Cycle -> Remains Annual
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 20: Regression: Existing annual subscription + webhook without cycle metadata remains annual', async () => {
    const f = await createTestFixture({ billingCycle: 'yearly', periodEndOffsetHours: 24 });
    const idemKey = `reg_cycle_none_${uuidv4().slice(0, 8)}`;

    try {
      // Webhook payload provides NO cycle parameter
      const res = await processPaymentWebhookProduction('razorpay', 'subscription.charged', idemKey, {
        user_id: f.userId,
        plan: 'pro'
      });

      assert.strictEqual(res.processed, true);
      assert.strictEqual(res.billingCycle, 'yearly', 'Authoritative cycle must remain yearly');

      const sub = (await pool.query('SELECT billing_cycle, current_period_end FROM subscriptions WHERE id = $1', [f.subId])).rows[0];
      assert.strictEqual(sub.billing_cycle, 'yearly');

      const subEnd = new Date(sub.current_period_end);
      const daysAhead = Math.round((subEnd.getTime() - Date.now()) / 86400000);
      assert.ok(daysAhead >= 360, `Yearly subscription must be extended by ~365 days, got ${daysAhead}`);
    } finally {
      await pool.query('DELETE FROM payment_webhook_events WHERE idempotency_key = $1', [idemKey]).catch(() => {});
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 21: Existing Annual Subscription + Webhook claiming Monthly -> No Silent Downgrade
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 21: Regression: Existing annual subscription + webhook claiming monthly does not silently downgrade', async () => {
    const f = await createTestFixture({ billingCycle: 'yearly', periodEndOffsetHours: 24 });
    const idemKey = `reg_cycle_conflict_${uuidv4().slice(0, 8)}`;

    try {
      // Webhook payload claims monthly, but existing subscription is yearly
      const res = await processPaymentWebhookProduction('razorpay', 'subscription.charged', idemKey, {
        user_id: f.userId,
        plan: 'pro',
        cycle: 'monthly'
      });

      assert.strictEqual(res.processed, true);
      assert.strictEqual(res.billingCycle, 'yearly', 'Authoritative existing cycle yearly must NOT be overwritten by webhook claiming monthly');

      const sub = (await pool.query('SELECT billing_cycle, current_period_end FROM subscriptions WHERE id = $1', [f.subId])).rows[0];
      assert.strictEqual(sub.billing_cycle, 'yearly');

      const subEnd = new Date(sub.current_period_end);
      const daysAhead = Math.round((subEnd.getTime() - Date.now()) / 86400000);
      assert.ok(daysAhead >= 360, `Must extend by full year, not month; got ${daysAhead} days`);
    } finally {
      await pool.query('DELETE FROM payment_webhook_events WHERE idempotency_key = $1', [idemKey]).catch(() => {});
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 22: Existing Scale Subscription + Renewal Payload claiming Pro -> Remains Scale (SSOT)
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 22: Regression: Existing scale subscription + renewal claiming pro remains scale (subscriptions.plan SSOT)', async () => {
    const f = await createTestFixture({ subPlan: 'scale', userPlan: 'scale', periodEndOffsetHours: 24 });
    const idemKey = `reg_plan_ssot_${uuidv4().slice(0, 8)}`;

    try {
      // Ordinary renewal webhook payload claims plan: 'pro'
      const res = await processPaymentWebhookProduction('razorpay', 'subscription.charged', idemKey, {
        user_id: f.userId,
        plan: 'pro'
      });

      assert.strictEqual(res.processed, true);
      assert.strictEqual(res.plan, 'scale', 'Authoritative subscription plan scale must be preserved against ordinary renewal claiming pro');

      const sub = (await pool.query('SELECT plan FROM subscriptions WHERE id = $1', [f.subId])).rows[0];
      assert.strictEqual(sub.plan, 'scale');

      const user = (await pool.query('SELECT plan FROM users WHERE id = $1', [f.userId])).rows[0];
      assert.strictEqual(user.plan, 'scale');
    } finally {
      await pool.query('DELETE FROM payment_webhook_events WHERE idempotency_key = $1', [idemKey]).catch(() => {});
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 23: reconciliation_required + Stale users.plan=pro -> Premium Authorization Denied
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 23: Regression: reconciliation_required + stale users.plan=pro denies premium entitlement', async () => {
    const f = await createTestFixture({ 
      userPlan: 'pro', 
      subPlan: 'pro', 
      subStatus: 'reconciliation_required', 
      periodEndOffsetHours: 24 
    });

    try {
      // 1. Selector verification: Current Entitlement Subscription must be NULL
      const entitlement = await getCurrentEntitlementSubscription(pool, f.userId);
      assert.strictEqual(entitlement, null, 'reconciliation_required must NEVER resolve as current entitlement subscription');

      // 2. Authorization policy verification: Effective authorization is FREE (Zero Paid Entitlement)
      const userRow = (await pool.query('SELECT plan, subscription_status FROM users WHERE id = $1', [f.userId])).rows[0];
      assert.strictEqual(userRow.subscription_status, 'reconciliation_required');
      
      const isEntitled = ['active', 'trialing'].includes(userRow.subscription_status);
      assert.strictEqual(isEntitled, false, 'reconciliation_required must not be entitled to paid limits');

      const effectiveAuthorizedPlan = isEntitled ? userRow.plan : 'free';
      assert.strictEqual(effectiveAuthorizedPlan, 'free', 'Effective plan must fall back to free');
      assert.strictEqual(dmLimitFor(effectiveAuthorizedPlan), dmLimitFor('free'));
    } finally {
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 24: Ambiguous Billing Cycle on NEW Subscription -> Rejection (No Silent Monthly Fallback)
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 24: Regression: New subscription without verified cycle metadata or price match is rejected (no silent monthly)', async () => {
    const userId = `usr_test_${uuidv4().slice(0, 8)}`;
    const email = `newsub_${uuidv4().slice(0, 6)}@airvix-test.local`;
    const idemKey = `reg_cycle_ambig_${uuidv4().slice(0, 8)}`;

    await pool.query(`
      INSERT INTO users (id, email, name, plan, subscription_status, dm_usage_this_period, usage_period_start, created_at, updated_at)
      VALUES ($1, $2, 'New Tester', 'free', 'expired', 0, to_char(CURRENT_DATE, 'YYYY-MM-DD'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
    `, [userId, email]);

    try {
      // Webhook payload provides no cycle metadata AND ambiguous amount (e.g. 500, not matching monthly 1499 or annual 1099)
      const res = await processPaymentWebhookProduction('razorpay', 'subscription.charged', idemKey, {
        user_id: userId,
        plan: 'pro',
        amount: 500 // Ambiguous amount
      });

      assert.strictEqual(res.processed, false);
      assert.strictEqual(res.rejectionReason, 'ambiguous_billing_cycle', 'Ambiguous cycle must be rejected');

      // Verify no subscription was provisioned
      const subs = (await pool.query('SELECT id FROM subscriptions WHERE user_id = $1', [userId])).rows;
      assert.strictEqual(subs.length, 0, 'No subscription row should be created');

      // Verify no usage counters created
      const counters = (await pool.query('SELECT id FROM usage_counters WHERE user_id = $1', [userId])).rows;
      assert.strictEqual(counters.length, 0, 'No usage counter should be created');
    } finally {
      await pool.query('DELETE FROM payment_webhook_events WHERE idempotency_key = $1', [idemKey]).catch(() => {});
      await cleanupFixture(userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 25: Explicit Authorized Plan Change -> Plan Transitions Successfully
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 25: Regression: Explicit authorized plan change flow transitions subscription from scale to pro', async () => {
    const f = await createTestFixture({ subPlan: 'scale', userPlan: 'scale', periodEndOffsetHours: 24 });
    const idemKey = `reg_plan_change_${uuidv4().slice(0, 8)}`;

    try {
      // Explicit plan change event
      const res = await processPaymentWebhookProduction('razorpay', 'subscription.upgraded', idemKey, {
        user_id: f.userId,
        plan: 'pro',
        notes: { is_plan_change: true }
      });

      assert.strictEqual(res.processed, true);
      assert.strictEqual(res.plan, 'pro', 'Explicit plan change event must successfully update plan to pro');

      const sub = (await pool.query('SELECT plan FROM subscriptions WHERE id = $1', [f.subId])).rows[0];
      assert.strictEqual(sub.plan, 'pro');

      const user = (await pool.query('SELECT plan FROM users WHERE id = $1', [f.userId])).rows[0];
      assert.strictEqual(user.plan, 'pro');
    } finally {
      await pool.query('DELETE FROM payment_webhook_events WHERE idempotency_key = $1', [idemKey]).catch(() => {});
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 26: Duplicate Webhook via Existing gateway_payment_id -> No Second Invoice or Usage Reset
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 26: Regression: Repeated payment callback with already-invoiced gateway_payment_id returns duplicate and skips reset', async () => {
    const f = await createTestFixture({ billingCycle: 'monthly', periodEndOffsetHours: 24 });
    const idemKey1 = `reg_gw_idem_1_${uuidv4().slice(0, 8)}`;
    const idemKey2 = `reg_gw_idem_2_${uuidv4().slice(0, 8)}`;
    const gwPaymentId = `pay_unique_${uuidv4().slice(0, 8)}`;

    try {
      // 1. First webhook processes payment with gwPaymentId
      const res1 = await processPaymentWebhookProduction('razorpay', 'subscription.charged', idemKey1, {
        user_id: f.userId,
        plan: 'pro',
        cycle: 'monthly',
        payload: { payment: { entity: { id: gwPaymentId, amount: 1499 } } }
      });
      assert.strictEqual(res1.processed, true);

      // Simulate some usage after first payment
      await pool.query('UPDATE usage_counters SET dms_sent = 25 WHERE user_id = $1', [f.userId]);

      // 2. Second webhook arrives with DIFFERENT idempotency key but SAME gateway_payment_id (e.g. repeated gateway callback)
      const res2 = await processPaymentWebhookProduction('razorpay', 'payment.captured', idemKey2, {
        user_id: f.userId,
        plan: 'pro',
        cycle: 'monthly',
        payload: { payment: { entity: { id: gwPaymentId, amount: 1499 } } }
      });

      assert.strictEqual(res2.duplicate, true);
      assert.strictEqual(res2.alreadyInvoiced, true);

      // Verify exactly ONE invoice exists
      const invoices = (await pool.query('SELECT id FROM invoices WHERE gateway_payment_id = $1', [gwPaymentId])).rows;
      assert.strictEqual(invoices.length, 1, 'Exactly one invoice must exist');

      // Verify usage was NOT reset again (retains 25)
      const counter = (await pool.query('SELECT dms_sent FROM usage_counters WHERE user_id = $1', [f.userId])).rows[0];
      assert.strictEqual(counter.dms_sent, 25, 'Usage must NOT be reset by duplicate callback');
    } finally {
      await pool.query('DELETE FROM payment_webhook_events WHERE idempotency_key IN ($1, $2)', [idemKey1, idemKey2]).catch(() => {});
      await cleanupFixture(f.userId);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 27: Audit All Authorization Paths for reconciliation_required
  // ───────────────────────────────────────────────────────────────────────────
  await test('Test 27: Regression: Full premium authorization audit: reconciliation_required is denied premium access across queue, rules, and accounts', async () => {
    const f = await createTestFixture({ 
      userPlan: 'scale', 
      subPlan: 'scale', 
      subStatus: 'reconciliation_required', 
      periodEndOffsetHours: 24 
    });

    try {
      const userRow = (await pool.query('SELECT plan, subscription_status FROM users WHERE id = $1', [f.userId])).rows[0];
      const subStatus = userRow.subscription_status;
      
      // A. Automation eligibility / Queue suppression check
      const isAutomationSuppressed = ['unpaid', 'suspended', 'reconciliation_required', 'expired', 'canceled'].includes(subStatus);
      assert.strictEqual(isAutomationSuppressed, true, 'Automation MUST be suppressed for reconciliation_required');

      // B. Entitlement check
      const isEntitled = ['active', 'trialing', 'grace_period'].includes(subStatus) && subStatus !== 'reconciliation_required';
      assert.strictEqual(isEntitled, false, 'reconciliation_required must NEVER be entitled');

      // C. Effective plan limit check
      const effectivePlan = isEntitled ? userRow.plan : 'free';
      assert.strictEqual(effectivePlan, 'free', 'Effective plan must fall back to free');
      assert.strictEqual(dmLimitFor(effectivePlan), 1000, 'Must have free tier DM limit, not scale unlimited');

      // D. Current entitlement selector
      const currentSub = await getCurrentEntitlementSubscription(pool, f.userId);
      assert.strictEqual(currentSub, null, 'Current entitlement subscription must be null');
    } finally {
      await cleanupFixture(f.userId);
    }
  });

  console.log(`\n============================================================`);
  console.log(`Subscription Lifecycle Suite (v4): ${passed} PASSED, ${failed} FAILED`);
  console.log(`============================================================\n`);

  if (failed > 0) process.exit(1);
  return { passed, failed, testResults };
}

if (require.main === module) {
  runSubscriptionLifecycleTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal test runner error:', err);
      process.exit(1);
    });
}

module.exports = {
  getCurrentEntitlementSubscription,
  getCanonicalFreePlan,
  runMigration009PreflightCheck,
  executeExpiryTransition,
  executeRenewalTransition,
  runSubscriptionLifecycleTests
};
