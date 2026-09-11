// tests/planLimits.test.js
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

process.env.NODE_ENV = 'test';
process.env.META_MOCK_MODE = 'true';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { dmLimitFor, PLAN_LIMITS } = require('../backend/src/constants/planLimits');
const { rolloverBillingCycles } = require('../backend/src/services/billingRollover');
const db = require('../backend/src/db');
const usageRouter = require('../backend/src/routes/usage');

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 Starting Subscription & Billing Audit Fix Tests');
  console.log('========================================\n');

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

  // 1. Test dmLimitFor
  await test('dmLimitFor returns correct tier limits', async () => {
    assert.strictEqual(dmLimitFor('pro'), 25000);
    assert.strictEqual(dmLimitFor('PRO'), 25000);
    assert.strictEqual(dmLimitFor('agency'), 100000);
    assert.strictEqual(dmLimitFor('AGENCY'), 100000);
    assert.strictEqual(dmLimitFor('enterprise'), 500000);
    assert.strictEqual(dmLimitFor('unknown_tier'), parseInt(process.env.FREE_PLAN_DM_LIMIT || '1000', 10));
    assert.strictEqual(dmLimitFor(null), parseInt(process.env.FREE_PLAN_DM_LIMIT || '1000', 10));
  });

  // 2. Test removal of POST /api/usage/reset route
  await test('usage router has removed public POST /reset route', async () => {
    const routes = usageRouter.stack
      .filter(layer => layer.route)
      .map(layer => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      }));
    const resetRoute = routes.find(r => r.path === '/reset' && r.methods.includes('post'));
    assert.strictEqual(resetRoute, undefined, 'Public POST /reset route should not exist');
  });

  // 3. Test 30-day billing rollover function
  await test('rolloverBillingCycles resets users with usage_period_start older than 30 days', async () => {
    const oldUserId = uuidv4();
    const recentUserId = uuidv4();

    // User with 35-day-old usage period
    await db.prepare(`
      INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at)
      VALUES (?, ?, 'Old User', 'pro', 150, date('now', '-35 days'), datetime('now'), datetime('now'))
    `).run(oldUserId, `old_user_${Date.now()}@test.com`);

    // User with fresh usage period (10 days old)
    await db.prepare(`
      INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at)
      VALUES (?, ?, 'Recent User', 'pro', 40, date('now', '-10 days'), datetime('now'), datetime('now'))
    `).run(recentUserId, `recent_user_${Date.now()}@test.com`);

    // Run rollover
    const result = await rolloverBillingCycles();
    assert(result.rolledOverCount >= 1, 'Should have rolled over at least 1 user');

    // Verify old user was reset
    const oldUserAfter = await db.prepare('SELECT dm_usage_this_period, usage_period_start FROM users WHERE id = ?').get(oldUserId);
    assert.strictEqual(oldUserAfter.dm_usage_this_period, 0, 'Old user usage should be reset to 0');
    assert.notStrictEqual(oldUserAfter.usage_period_start.slice(0, 7), '1970-01');

    // Verify recent user was untouched
    const recentUserAfter = await db.prepare('SELECT dm_usage_this_period FROM users WHERE id = ?').get(recentUserId);
    assert.strictEqual(recentUserAfter.dm_usage_this_period, 40, 'Recent user usage should remain 40');
  });

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
