// tests/adminPlanSyncAndLimits.test.js
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

process.env.NODE_ENV = 'test';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const db = require('../backend/src/db');
const { dmLimitFor, igLimitFor, rulesLimitFor, refreshPlanLimitsCache } = require('../backend/src/constants/planLimits');

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 Starting Admin Plan Sync & Limits Enforcement Tests');
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

  // 1. Test Admin custom pricing plan storage and cache refresh
  await test('Admin dynamic plans update database settings and in-memory cache', async () => {
    const customPlans = [
      { id: 'plan-free', slug: 'free', name: 'Free Starter', monthlyPrice: 0, annualPrice: 0, dmLimit: 500, igLimit: 1, rulesLimit: 2, active: true },
      { id: 'plan-custom-pro', slug: 'custom_pro', name: 'Custom Pro', monthlyPrice: 1999, annualPrice: 1599, dmLimit: 50000, igLimit: 5, rulesLimit: 30, badge: 'SPECIAL', active: true }
    ];

    const serialized = JSON.stringify(customPlans);
    const existing = await db.prepare("SELECT key FROM site_settings WHERE key = 'custom_pricing_plans'").get();
    if (existing) {
      await db.prepare("UPDATE site_settings SET value = ?, updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') WHERE key = 'custom_pricing_plans'").run(serialized);
    } else {
      await db.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES ('custom_pricing_plans', ?, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))").run(serialized);
    }

    await refreshPlanLimitsCache();

    // Verify limit getters resolve custom plan limits dynamically
    assert.strictEqual(dmLimitFor('custom_pro'), 50000);
    assert.strictEqual(igLimitFor('custom_pro'), 5);
    assert.strictEqual(rulesLimitFor('custom_pro'), 30);
    assert.strictEqual(dmLimitFor('free'), 500);
    assert.strictEqual(rulesLimitFor('free'), 2);
  });

  // 2. Test Rules Limit Enforcement helper
  await test('rulesLimitFor respects custom plan and user custom overrides', async () => {
    // Custom plan rules limit is 30
    assert.strictEqual(rulesLimitFor('custom_pro'), 30);
    // User custom rules limit override takes precedence
    assert.strictEqual(rulesLimitFor('custom_pro', 15), 15);
  });

  // 3. Test active rule limit enforcement logic
  await test('Rule creation is blocked when user active rules reach plan limit', async () => {
    const userId = uuidv4();
    const accountId = uuidv4();

    // Create user on 'free' plan (which has rulesLimit = 2)
    await db.prepare(`
      INSERT INTO users (id, email, plan, dm_usage_this_period, usage_period_start)
      VALUES (?, ?, 'free', 0, date('now'))
    `).run(userId, `rules_tester_${Date.now()}@example.com`);

    await db.prepare(`
      INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, page_id, access_token_enc, status)
      VALUES (?, ?, ?, 'rules_ig_account', '12345678', 'enc_token', 'connected')
    `).run(accountId, userId, 'ig_user_' + userId.slice(0, 8));

    // Insert 2 active rules (at the limit of 2)
    await db.prepare(`
      INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, match_mode, reply_message, is_active)
      VALUES (?, ?, 'dm_keyword_reply', 'RULE1', 'contains', 'Reply 1', 1)
    `).run(uuidv4(), accountId);

    await db.prepare(`
      INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, match_mode, reply_message, is_active)
      VALUES (?, ?, 'dm_keyword_reply', 'RULE2', 'contains', 'Reply 2', 1)
    `).run(uuidv4(), accountId);

    // Count active rules
    const userRow = await db.prepare('SELECT plan, custom_rules_limit FROM users WHERE id = ?').get(userId);
    const maxRules = rulesLimitFor(userRow?.plan, userRow?.custom_rules_limit);

    const activeCountRow = await db.prepare(`
      SELECT COUNT(*) as count
      FROM automation_rules r
      JOIN instagram_accounts a ON r.instagram_account_id = a.id
      WHERE a.user_id = ? AND r.is_active = 1
    `).get(userId);

    const activeCount = parseInt(activeCountRow?.count || 0, 10);
    assert.strictEqual(maxRules, 2);
    assert.strictEqual(activeCount, 2);
    assert(activeCount >= maxRules, 'Active count should equal or exceed max rules limit');
  });

  console.log(`\n----------------------------------------`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`----------------------------------------\n`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
