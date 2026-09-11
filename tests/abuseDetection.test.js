/**
 * Test Suite: Abuse Prevention, Emergency Kill Switches & Cost Protection
 * Validates global, per-account, and per-rule kill switches, velocity tracking,
 * abuse flags lifecycle, and per-tenant API cost metering.
 */

const assert = require('assert');
const { abuseDetection, AbuseDetectionService } = require('../backend/src/services/abuseDetection');
const { costProtection } = require('../backend/src/services/costProtection');
const db = require('../backend/src/db');

async function runTests() {
  console.log('🧪 Starting Abuse Prevention & Kill Switch Test Suite...\n');
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

  const testAccId = `test-acc-${Date.now()}`;
  const autoPauseAccId = `acc-auto-${Date.now()}`;
  const testRuleId = `test-rule-${Date.now()}`;
  const testUserId = `test-usr-${Date.now()}`;

  // Ensure test user exists for foreign keys
  await pool.query(`
    INSERT INTO users (id, email, name, plan, status, dm_usage_this_period, usage_period_start)
    VALUES ($1, $2, 'Abuse Test User', 'free', 'active', 0, to_char(CURRENT_DATE, 'YYYY-MM-DD'))
    ON CONFLICT (id) DO NOTHING
  `, [testUserId, `abuse-${Date.now()}@test.local`]);

  // Ensure test accounts exist for foreign keys in abuse_flags and tenant_api_usage
  await pool.query(`
    INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, page_id, access_token_enc, status)
    VALUES 
      ($1, $2, $3, 'abuse_tester', 'page-1', 'ENC:test', 'connected'),
      ($4, $2, $5, 'autopause_tester', 'page-2', 'ENC:test', 'connected')
    ON CONFLICT (id) DO NOTHING
  `, [testAccId, testUserId, `ig-${Date.now()}-1`, autoPauseAccId, `ig-${Date.now()}-2`]);

  // Test 1: Global Kill Switch Toggle & Status
  await test('Activates and deactivates global kill switch', async () => {
    // 1. Activate
    await abuseDetection.setGlobalKillSwitch(true, 'Test emergency pause', 'admin@airvix.com');
    const isKilled = await abuseDetection.isGlobalKillSwitchActive();
    assert.strictEqual(isKilled, true, 'Global kill switch should be active');

    // 2. Query status
    const status = await abuseDetection.getKillSwitchStatus();
    assert.ok(status.some(s => s.scope === 'global' && s.target_id === 'all' && s.is_active === 1));

    // 3. Deactivate
    await abuseDetection.setGlobalKillSwitch(false, 'Resume normal operations', 'admin@airvix.com');
    const isResumed = await abuseDetection.isGlobalKillSwitchActive();
    assert.strictEqual(isResumed, false, 'Global kill switch should be inactive');
  });

  // Test 2: Per-Account Kill Switch
  await test('Sets and queries account-level kill switch', async () => {
    await abuseDetection.setAccountKillSwitch(testAccId, true, 'Tenant rate limit breach', 'sec-ops');
    const isPaused = await abuseDetection.isAccountPaused(testAccId);
    assert.strictEqual(isPaused, true, 'Account should be paused');

    await abuseDetection.setAccountKillSwitch(testAccId, false, 'Issue resolved', 'sec-ops');
    const isResumed = await abuseDetection.isAccountPaused(testAccId);
    assert.strictEqual(isResumed, false, 'Account should be unpaused');
  });

  // Test 3: Per-Rule Kill Switch
  await test('Sets and queries rule-level kill switch', async () => {
    await abuseDetection.setRuleKillSwitch(testRuleId, true, 'Loop detected on rule', 'loop-detector');
    const isPaused = await abuseDetection.isRulePaused(testRuleId);
    assert.strictEqual(isPaused, true, 'Rule should be paused');

    await abuseDetection.setRuleKillSwitch(testRuleId, false, 'Rule fixed', 'admin');
    const isResumed = await abuseDetection.isRulePaused(testRuleId);
    assert.strictEqual(isResumed, false, 'Rule should be resumed');
  });

  // Test 4: Abuse Flag Creation & Auto-Pause Action
  await test('Flags account for anomalous activity and triggers auto-pause', async () => {
    await abuseDetection.flagAccount(
      autoPauseAccId,
      testUserId,
      'velocity_exceeded',
      'critical',
      'Sent 150 DMs in 10 minutes',
      true // autoPause
    );

    // Verify account was paused automatically
    const isPaused = await abuseDetection.isAccountPaused(autoPauseAccId);
    assert.strictEqual(isPaused, true, 'Account should be auto-paused on critical abuse flag');

    // Verify flag in DB
    const flags = await abuseDetection.getAbuseFlags(0);
    const targetFlag = flags.find(f => f.instagram_account_id === autoPauseAccId);
    assert.ok(targetFlag, 'Flag record must exist in DB');
    assert.strictEqual(targetFlag.flag_type, 'velocity_exceeded');
    assert.strictEqual(targetFlag.auto_paused, 1);

    // Resolve flag and verify auto-unpause
    const resolveResult = await abuseDetection.resolveAbuseFlag(targetFlag.id, 'admin@airvix.com');
    assert.strictEqual(resolveResult.success, true);
    assert.strictEqual(resolveResult.resolved, 1);

    const isStillPaused = await abuseDetection.isAccountPaused(autoPauseAccId);
    assert.strictEqual(isStillPaused, false, 'Resolving auto-paused flag should unpause account');
  });

  // Test 5: Cost Protection Metering & Quota Calculation
  await test('Meters API invocations and enforces tenant plan quotas', async () => {
    // Record 5 Graph API calls for test user
    for (let i = 0; i < 5; i++) {
      await costProtection.recordApiCall({
        userId: testUserId,
        accountId: testAccId,
        apiType: 'meta_graph',
        endpoint: 'messages/send_dm',
        costUnits: 1,
        statusCode: 200
      });
    }

    // Check quota
    const quota = await costProtection.checkTenantQuota(testUserId, 'meta_graph');
    assert.strictEqual(quota.allowed, true);
    assert.ok(quota.currentUnits >= 5, `Expected at least 5 units, got ${quota.currentUnits}`);
    assert.strictEqual(quota.maxUnits, 1000); // free plan limit
    assert.strictEqual(quota.plan, 'free');

    // Fetch 30-day summary
    const summary = await costProtection.getTenantUsageSummary(testUserId);
    assert.strictEqual(summary.userId, testUserId);
    assert.ok(summary.items.length > 0);
    const item = summary.items.find(it => it.endpoint === 'messages/send_dm');
    assert.ok(item, 'Expected messages/send_dm in usage summary');
    assert.ok(parseInt(item.call_count, 10) >= 5);
  });

  // Clean up test user
  await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);

  console.log(`\n🏁 Test Run Completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
