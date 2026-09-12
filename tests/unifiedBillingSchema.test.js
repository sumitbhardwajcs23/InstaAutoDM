// tests/unifiedBillingSchema.test.js
// Verification of single source of truth billing schema in PostgreSQL

const assert = require('assert');
const db = require('../backend/src/db');
const { dmLimitFor, igLimitFor, rulesLimitFor, refreshPlanLimitsCache } = require('../backend/src/constants/planLimits');

async function runTests() {
  console.log('\n==================================================');
  console.log('🧪 Running Single Source of Truth Billing Schema Tests');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Verify pricing_plans table exists and contains seeded rows
    console.log('Test 1: Verifying pricing_plans PostgreSQL table structure & seeded rows...');
    const rows = await db.prepare("SELECT * FROM pricing_plans ORDER BY sort_order ASC").all();
    assert(Array.isArray(rows), 'pricing_plans table should return array of rows');
    assert(rows.length >= 3, `Expected at least 3 seeded plans, found ${rows.length}`);
    console.log(`  ✅ PASS: 1. Found ${rows.length} plans in pricing_plans table:`, rows.map(r => r.name).join(', '));
    passed++;

    // Test 2: Verify custom plan insertion into pricing_plans table
    console.log('\nTest 2: Inserting dynamic custom plan "VIP Creator" into pricing_plans table...');
    const testPlanId = `plan_test_${Date.now()}`;
    await db.prepare(`
      INSERT INTO pricing_plans (id, slug, name, description, monthly_price, annual_price, currency, dm_limit, ig_limit, rules_limit, badge_text, is_popular, is_active, sort_order, features)
      VALUES (?, 'vip-creator', 'VIP Creator', 'VIP Tier for top creators', 2999, 2399, 'INR', 150000, 5, 50, 'VIP EXCLUSIVE', 1, 1, 4, ?)
    `).run(testPlanId, JSON.stringify(['150,000 DMs/mo', '5 IG Accounts', '50 Active Rules']));

    await refreshPlanLimitsCache();

    // Verify limit getters
    const dmLimit = dmLimitFor('vip-creator');
    const igLimit = igLimitFor('vip-creator');
    const rulesLimit = rulesLimitFor('vip-creator');

    assert.strictEqual(dmLimit, 150000, 'dmLimitFor should return 150000 for vip-creator');
    assert.strictEqual(igLimit, 5, 'igLimitFor should return 5 for vip-creator');
    assert.strictEqual(rulesLimit, 50, 'rulesLimitFor should return 50 for vip-creator');
    console.log('  ✅ PASS: 2. Dynamic limits resolved accurately: 150,000 DMs, 5 IG Accounts, 50 Rules');
    passed++;

    // Test 3: Verify plan update in pricing_plans
    console.log('\nTest 3: Updating "VIP Creator" plan limits in pricing_plans table...');
    await db.prepare(`
      UPDATE pricing_plans SET dm_limit = 200000, ig_limit = 8, rules_limit = 80 WHERE id = ?
    `).run(testPlanId);

    await refreshPlanLimitsCache();

    const updatedDmLimit = dmLimitFor('vip-creator');
    const updatedIgLimit = igLimitFor('vip-creator');
    const updatedRulesLimit = rulesLimitFor('vip-creator');

    assert.strictEqual(updatedDmLimit, 200000, 'Updated dmLimit should be 200000');
    assert.strictEqual(updatedIgLimit, 8, 'Updated igLimit should be 8');
    assert.strictEqual(updatedRulesLimit, 80, 'Updated rulesLimit should be 80');
    console.log('  ✅ PASS: 3. Updated plan limits reflected instantly: 200,000 DMs, 8 IG Accounts, 80 Rules');
    passed++;

    // Test 4: Clean up test plan
    console.log('\nTest 4: Cleaning up test plan from pricing_plans table...');
    await db.prepare('DELETE FROM pricing_plans WHERE id = ?').run(testPlanId);
    await refreshPlanLimitsCache();
    console.log('  ✅ PASS: 4. Test plan cleaned up cleanly');
    passed++;

  } catch (err) {
    console.error('❌ TEST FAILED:', err.message, err.stack);
    failed++;
  }

  console.log('\n--------------------------------------------------');
  console.log(`Verification Summary: ${passed} Passed, ${failed} Failed`);
  console.log('--------------------------------------------------\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
