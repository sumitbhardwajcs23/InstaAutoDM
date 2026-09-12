// tests/verifyBillingSystemEndToEnd.test.js
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

process.env.NODE_ENV = 'test';

const assert = require('assert');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../backend/src/db');
const { dmLimitFor, igLimitFor, rulesLimitFor, refreshPlanLimitsCache } = require('../backend/src/constants/planLimits');
const billingRouter = require('../backend/src/routes/billing');
const { requireAuth } = require('../backend/src/middleware/auth');

async function runEndToEndVerification() {
  console.log('\n==================================================');
  console.log('🧪 Running End-to-End Billing & Plan Sync Verification');
  console.log('==================================================\n');

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

  // 1. Simulate Admin creating a custom plan in DB
  const testPlanId = `plan-ultra-${Date.now()}`;
  const testPlanSlug = `ultra_creator_${Date.now().toString().slice(-4)}`;
  const testPlanName = `Ultra Creator ${Date.now().toString().slice(-4)}`;

  await test('1. Admin creates custom plan in site_settings table', async () => {
    const plans = [
      {
        id: 'plan-free',
        slug: 'free',
        name: 'Free Starter',
        monthlyPrice: 0,
        annualPrice: 0,
        dmLimit: 1000,
        igLimit: 1,
        rulesLimit: 5,
        badge: 'COMMUNITY',
        active: true
      },
      {
        id: testPlanId,
        slug: testPlanSlug,
        name: testPlanName,
        monthlyPrice: 2499,
        annualPrice: 1999,
        dmLimit: 75000,
        igLimit: 4,
        rulesLimit: 40,
        badge: '⚡ ULTRA',
        description: 'Ultra high-throughput DM automation for top creators.',
        features: ['75,000 DMs/mo', '4 IG accounts', '40 Active rules'],
        active: true
      }
    ];

    const serialized = JSON.stringify(plans);
    const existing = await db.prepare("SELECT key FROM site_settings WHERE key = 'custom_pricing_plans'").get();
    if (existing) {
      await db.prepare("UPDATE site_settings SET value = ?, updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') WHERE key = 'custom_pricing_plans'").run(serialized);
    } else {
      await db.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES ('custom_pricing_plans', ?, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))").run(serialized);
    }

    await refreshPlanLimitsCache();
  });

  // 2. Verify backend limit functions immediately pick up new plan
  await test('2. Backend limit getters reflect custom admin quotas dynamically', async () => {
    assert.strictEqual(dmLimitFor(testPlanSlug), 75000, 'DM limit should be 75,000');
    assert.strictEqual(igLimitFor(testPlanSlug), 4, 'IG account limit should be 4');
    assert.strictEqual(rulesLimitFor(testPlanSlug), 40, 'Rules limit should be 40');
  });

  // 3. Verify public GET /api/billing/plans returns custom plan without authentication
  await test('3. GET /api/billing/plans returns live custom plan without 401 error', async () => {
    const app = express();
    app.use(express.json());
    // Simulate server auth middleware with public paths exception
    app.use((req, res, next) => {
      const publicPaths = ['/billing/plans', '/billing/webhook'];
      if (publicPaths.some(p => req.path.startsWith(p))) {
        return next();
      }
      return requireAuth(req, res, next);
    });
    app.use('/billing', billingRouter);

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/billing/plans`);
      assert.strictEqual(res.status, 200, 'GET /billing/plans must return 200 OK');

      const data = await res.json();
      assert(data.plans && Array.isArray(data.plans), 'Response must contain plans array');

      const ultraPlan = data.plans.find(p => p.id === testPlanId || p.slug === testPlanSlug);
      assert(ultraPlan, 'Custom Ultra Creator plan must exist in API response');
      assert.strictEqual(ultraPlan.name, testPlanName);
      assert.strictEqual(ultraPlan.monthlyPrice, 2499);
      assert.strictEqual(ultraPlan.annualPrice, 1999);
      assert.strictEqual(ultraPlan.annualTotal, 23988, 'Annual total must be 1999 * 12 = 23988');
      assert.strictEqual(ultraPlan.dmLimit, 75000);
      assert.strictEqual(ultraPlan.igLimit, 4);
      assert.strictEqual(ultraPlan.rulesLimit, 40);
      assert.strictEqual(ultraPlan.badge, '⚡ ULTRA');
    } finally {
      server.close();
    }
  });

  // 4. Verify checkout order price resolution for monthly & yearly cycles
  await test('4. Order checkout price resolution calculates monthly and yearly totals correctly', async () => {
    const testUserId = uuidv4();
    await db.prepare(`
      INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start)
      VALUES (?, ?, 'Verifier User', 'free', 0, date('now'))
    `).run(testUserId, `verifier_${Date.now()}@example.com`);

    const app = express();
    app.use(express.json());
    // Attach mock user
    app.use((req, _res, next) => {
      req.user = { id: testUserId };
      next();
    });
    app.use('/billing', billingRouter);

    const server = app.listen(0);
    const port = server.address().port;

    try {
      // 4a. Monthly checkout
      const monthlyRes = await fetch(`http://127.0.0.1:${port}/billing/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: testPlanSlug, cycle: 'monthly' })
      });
      assert.strictEqual(monthlyRes.status, 200);
      const monthlyData = await monthlyRes.json();
      assert.strictEqual(monthlyData.amount_inr, 2499, 'Monthly price must be ₹2,499');
      assert.strictEqual(monthlyData.amount, 249900, 'Monthly amount in paise must be 249900');

      // 4b. Yearly checkout
      const yearlyRes = await fetch(`http://127.0.0.1:${port}/billing/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: testPlanSlug, cycle: 'yearly' })
      });
      assert.strictEqual(yearlyRes.status, 200);
      const yearlyData = await yearlyRes.json();
      assert.strictEqual(yearlyData.amount_inr, 23988, 'Yearly price must be ₹23,988 (1999 * 12)');
      assert.strictEqual(yearlyData.amount, 2398800, 'Yearly amount in paise must be 2398800');
    } finally {
      server.close();
    }
  });

  console.log(`\n--------------------------------------------------`);
  console.log(`Verification Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`--------------------------------------------------\n`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runEndToEndVerification().catch(err => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
