/**
 * Test Suite: Data Retention, GDPR Portability & Erasure
 * Validates automated TTL data pruning, GDPR Article 20 JSON data export,
 * and GDPR Article 17 cascading erasure with confirmation codes.
 */

const assert = require('assert');
const { dataRetention } = require('../backend/src/services/dataRetention');
const db = require('../backend/src/db');

async function runTests() {
  console.log('🧪 Starting Data Retention & GDPR Privacy Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}`);
        failed++;
      }
    })();
  }

  await db.ready();
  const pool = db.getPgPool();
  if (!pool) {
    console.error('Fatal: DB pool unavailable');
    process.exit(1);
  }

  const testUserId = `gdpr-usr-${Date.now()}`;
  const testAccId = `gdpr-acc-${Date.now()}`;
  const testRuleId = `gdpr-rule-${Date.now()}`;

  // Seed sample user and associated records
  await pool.query(`
    INSERT INTO users (id, email, name, plan, status, dm_usage_this_period, usage_period_start)
    VALUES ($1, $2, 'GDPR User', 'pro', 'active', 10, to_char(CURRENT_DATE, 'YYYY-MM-DD'))
  `, [testUserId, `gdpr-${Date.now()}@test.local`]);

  await pool.query(`
    INSERT INTO instagram_accounts (
      id, user_id, ig_user_id, username, page_id, access_token_enc, status
    ) VALUES ($1, $2, $3, 'gdpr_tester', 'page-123', 'ENC:AES:testtoken', 'connected')
  `, [testAccId, testUserId, `ig-${Date.now()}`]);

  await pool.query(`
    INSERT INTO automation_rules (
      id, instagram_account_id, type, trigger_keyword, reply_message, is_active
    ) VALUES ($1, $2, 'comment_to_dm', 'hello', 'Welcome!', 1)
  `, [testRuleId, testAccId]);

  await pool.query(`
    INSERT INTO subscriptions (
      id, user_id, plan, status, current_period_start, current_period_end
    ) VALUES ($1, $2, 'pro', 'active', to_char(NOW(), 'YYYY-MM-DD'), to_char(NOW() + INTERVAL '30 days', 'YYYY-MM-DD'))
  `, [`sub-${Date.now()}`, testUserId]);

  // Test 1: GDPR Article 20 Data Export Structure
  await test('Exports complete structured data with token redaction (GDPR Art. 20)', async () => {
    const exported = await dataRetention.exportUserData(testUserId);
    assert.strictEqual(exported.metadata.compliance, 'GDPR Article 20 Right to Data Portability');
    assert.strictEqual(exported.user.id, testUserId);
    assert.strictEqual(exported.user.plan, 'pro');
    assert.strictEqual(exported.user.password_hash, undefined, 'Password hash must never be exported');

    assert.strictEqual(exported.instagram_accounts.length, 1);
    const acc = exported.instagram_accounts[0];
    assert.strictEqual(acc.username, 'gdpr_tester');
    assert.strictEqual(acc.access_token_enc, undefined, 'Token ciphertexts must be redacted in export');

    assert.strictEqual(exported.automation_rules.length, 1);
    assert.strictEqual(exported.automation_rules[0].trigger_keyword, 'hello');

    assert.ok(exported.subscription, 'Subscription details must be exported');
    assert.strictEqual(exported.subscription.plan, 'pro');
  });

  // Test 2: TTL Data Pruning Job
  await test('Runs TTL pruning job cleanly across tables with metrics', async () => {
    const result = await dataRetention.pruneExpiredData();
    assert.strictEqual(result.success, true);
    assert.ok('webhook_events' in result.pruned);
    assert.ok('resolved_dlq' in result.pruned);
    assert.ok('error_events' in result.pruned);
    assert.ok('activity_log' in result.pruned);
    assert.ok('tenant_api_usage' in result.pruned);
    assert.ok(typeof result.durationMs === 'number');
  });

  // Test 3: GDPR Article 17 Erasure & Cascade
  await test('Permanently deletes user data and creates deletion receipt (GDPR Art. 17)', async () => {
    const result = await dataRetention.deleteUserData(testUserId, 'user-self-service');
    assert.strictEqual(result.success, true);
    assert.ok(result.confirmation_code.startsWith('DEL-'));
    assert.strictEqual(result.erased_user_id, testUserId);

    // Verify cascading deletion: user, account, rule, subscription should be gone
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [testUserId]);
    assert.strictEqual(userCheck.rows.length, 0, 'User row must be deleted');

    const accCheck = await pool.query('SELECT id FROM instagram_accounts WHERE id = $1', [testAccId]);
    assert.strictEqual(accCheck.rows.length, 0, 'Instagram account row must cascade delete');

    const ruleCheck = await pool.query('SELECT id FROM automation_rules WHERE id = $1', [testRuleId]);
    assert.strictEqual(ruleCheck.rows.length, 0, 'Automation rule must cascade delete');

    // Verify deletion request record was created
    const delReqCheck = await pool.query(
      'SELECT id, confirmation_code, status FROM data_deletion_requests WHERE confirmation_code = $1',
      [result.confirmation_code]
    );
    assert.strictEqual(delReqCheck.rows.length, 1);
    assert.strictEqual(delReqCheck.rows[0].status, 'completed');
  });

  console.log(`\n🏁 Test Run Completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
