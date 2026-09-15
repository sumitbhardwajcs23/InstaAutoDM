// tests/accountHealthAndRiskMonitoring.test.js
// Production-Grade Verification Suite for Airvix Instagram Account Health & Automation Risk Monitoring System
// Tests deterministic mappings, write-amplification prevention, progressive degradation,
// multi-account isolation, quota independence, worker pacing, guarded resume, and admin overrides.

const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

process.env.NODE_ENV = 'test';
process.env.META_MOCK_MODE = 'true';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const db = require('../backend/src/db');
const { accountHealthService } = require('../backend/src/services/accountHealthService');
const { HEALTH_CONFIG, resolveHealthStateFromScore } = require('../backend/src/constants/healthConfig');
const quotaService = require('../backend/src/services/quotaService');
const queue = require('../backend/src/services/queue');
const { dataRetention } = require('../backend/src/services/dataRetention');

async function runTests() {
  console.log('\n================================================================================');
  console.log('🧪 AIRVIX INSTAGRAM ACCOUNT HEALTH & AUTOMATION RISK MONITORING — VERIFICATION');
  console.log('   (Account-Scoped Health, Subscription-Scoped Quota, Zero Write Amplification)');
  console.log('================================================================================\n');

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

  const syntheticAccounts = [];
  const syntheticUsers = [];

  async function createSyntheticUser(userId, email, plan = 'pro', customLimit = 500) {
    syntheticUsers.push(userId);
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO users (id, email, name, plan, status, custom_dm_limit, dm_usage_this_period, usage_period_start, created_at, updated_at)
      VALUES (?, ?, 'Health Tester', ?, 'active', ?, 0, ?, ?, ?)
    `).run(userId, email, plan, customLimit, now.slice(0, 10), now, now);

    const subId = `syn_sub_${uuidv4().slice(0, 8)}`;
    await db.prepare(`
      INSERT INTO subscriptions (id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
      VALUES (?, ?, ?, 'active', 'monthly', NOW(), NOW() + INTERVAL '30 days', NOW(), NOW())
    `).run(subId, userId, plan);

    await db.prepare(`
      INSERT INTO usage_counters (id, user_id, period_start, period_end, dms_sent, comments_replied, updated_at)
      VALUES (?, ?, NOW(), NOW() + INTERVAL '30 days', 0, 0, NOW())
    `).run(`cnt_${userId}`, userId);

    return { userId, subId };
  }

  async function createSyntheticAccount(accId, userId, username, igUserId) {
    syntheticAccounts.push(accId);
    const now = new Date().toISOString();
    const uniqueIgUserId = `${igUserId || 'ig_uid'}_${uuidv4().slice(0, 8)}`;
    await db.prepare(`
      INSERT INTO instagram_accounts (id, user_id, username, ig_user_id, page_id, access_token_enc, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'page_test_123', 'dummy_enc_token', 'connected', ?, ?)
    `).run(accId, userId, username, uniqueIgUserId, now, now);

    await accountHealthService.initializeAccountState(accId);
    return accId;
  }

  async function cleanup() {
    if (syntheticAccounts.length > 0) {
      for (const accId of syntheticAccounts) {
        await db.prepare('DELETE FROM instagram_account_health_snapshots WHERE instagram_account_id = ?').run(accId).catch(() => {});
        await db.prepare('DELETE FROM instagram_account_health_events WHERE instagram_account_id = ?').run(accId).catch(() => {});
        await db.prepare('DELETE FROM instagram_account_health_state WHERE instagram_account_id = ?').run(accId).catch(() => {});
        await db.prepare('DELETE FROM instagram_account_connections WHERE instagram_account_id = ?').run(accId).catch(() => {});
        await db.prepare('DELETE FROM instagram_accounts WHERE id = ?').run(accId).catch(() => {});
      }
    }
    if (syntheticUsers.length > 0) {
      for (const uid of syntheticUsers) {
        await db.prepare('DELETE FROM instagram_account_connections WHERE user_id = ?').run(uid).catch(() => {});
        await db.prepare('DELETE FROM quota_reservations WHERE user_id = ?').run(uid).catch(() => {});
        await db.prepare('DELETE FROM usage_counters WHERE user_id = ?').run(uid).catch(() => {});
        await db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(uid).catch(() => {});
        await db.prepare('DELETE FROM audit_logs WHERE actor_id = ?').run(uid).catch(() => {});
        await db.prepare('DELETE FROM users WHERE id = ?').run(uid).catch(() => {});
      }
    }
  }

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Deterministic State & Automation Mode Mapping
    // ─────────────────────────────────────────────────────────────────────────
    await test('1. State & Mode Mapping: verify 1:1 deterministic mapping and boundaries', async () => {
      const s100 = resolveHealthStateFromScore(100);
      assert.strictEqual(s100.status, 'HEALTHY');
      assert.strictEqual(s100.mode, 'NORMAL');
      assert.strictEqual(s100.riskLevel, 'low');

      const s85 = resolveHealthStateFromScore(85);
      assert.strictEqual(s85.status, 'CAUTION');
      assert.strictEqual(s85.mode, 'CAUTION');
      assert.strictEqual(s85.riskLevel, 'moderate');

      const s55 = resolveHealthStateFromScore(55);
      assert.strictEqual(s55.status, 'ELEVATED_RISK');
      assert.strictEqual(s55.mode, 'PROTECTION');
      assert.strictEqual(s55.riskLevel, 'elevated');

      const s20 = resolveHealthStateFromScore(20);
      assert.strictEqual(s20.status, 'CRITICAL');
      assert.strictEqual(s20.mode, 'PAUSED');
      assert.strictEqual(s20.riskLevel, 'critical');

      // Clamping limits
      const sOver = resolveHealthStateFromScore(150);
      assert.strictEqual(sOver.score, 100);
      const sUnder = resolveHealthStateFromScore(-20);
      assert.strictEqual(sUnder.score, 0);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Baseline Initialization for New Connected Account
    // ─────────────────────────────────────────────────────────────────────────
    const testUserId1 = `u_health_${uuidv4().slice(0, 8)}`;
    const testAccountId1 = `ig_acc_${uuidv4().slice(0, 8)}`;

    await test('2. Baseline Initialization: new account starts with score 100, HEALTHY, NORMAL', async () => {
      await createSyntheticUser(testUserId1, `${testUserId1}@airvix.test`);
      await createSyntheticAccount(testAccountId1, testUserId1, 'health_creator_1', '1784140001');

      const health = await accountHealthService.getAccountHealth(testAccountId1);

      assert.ok(health, 'Health state should exist');
      assert.strictEqual(health.health_score, 100);
      assert.strictEqual(health.health_status, 'HEALTHY');
      assert.strictEqual(health.automation_mode, 'NORMAL');
      assert.strictEqual(health.observed_risk_level, 'low');
      assert.strictEqual(health.consecutive_failures, 0);
      assert.strictEqual(health.observed_rate_limit_count, 0);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Zero Write Amplification & Aggregated Flushing
    // ─────────────────────────────────────────────────────────────────────────
    await test('3. Zero Write Amplification: sends buffer in memory with zero per-send DB write and zero event rows', async () => {
      const initialEvents = await accountHealthService.getAccountHealthEvents(testAccountId1, 100);
      const initialEventCount = initialEvents.length;

      // 1. Simulate 10 successful sends - verify they are buffered in memory without immediate per-send DB flush
      for (let i = 0; i < 10; i++) {
        await accountHealthService.recordSuccess(testAccountId1, testUserId1, 'sub_test_1');
      }
      assert.strictEqual(accountHealthService.pendingSuccessCounts.get(testAccountId1), 10, 'Sends 1-10 must buffer in memory without per-send DB write');

      // 2. Simulate remaining 40 successful sends (total 50)
      for (let i = 0; i < 40; i++) {
        await accountHealthService.recordSuccess(testAccountId1, testUserId1, 'sub_test_1');
      }

      // Reading health state flushes the aggregated batch to DB
      const postHealth = await accountHealthService.getAccountHealth(testAccountId1);
      assert.strictEqual(postHealth.rolling_24h_successes, 50, 'Rolling 24h successes should be 50');
      assert.strictEqual(postHealth.consecutive_failures, 0, 'Consecutive failures should be 0');
      assert.strictEqual(accountHealthService.pendingSuccessCounts.get(testAccountId1), 0, 'Pending counts must be flushed');

      const postEvents = await accountHealthService.getAccountHealthEvents(testAccountId1, 100);
      assert.strictEqual(postEvents.length, initialEventCount, 'Zero durable rows should be inserted for normal successful sends');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Progressive Degradation on 429 Rate Limits (No Instant Pause)
    // ─────────────────────────────────────────────────────────────────────────
    await test('4. Progressive Degradation: 1st 429 drops to CAUTION, 2nd to PROTECTION, persistent to PAUSED', async () => {
      // 1st 429 rate limit
      await accountHealthService.recordIncident({
        accountId: testAccountId1,
        userId: testUserId1,
        eventType: 'RATE_LIMIT_429',
        severity: 'high',
        statusCode: 429,
        errorCode: '2207001',
        metadata: { endpoint: '/v21.0/me/messages', action: 'sendDirectMessage' }
      });

      // Allow recalculation
      await new Promise(r => setTimeout(r, 600));

      let state1 = await accountHealthService.getAccountHealth(testAccountId1);
      assert.ok(state1.health_score <= 85 && state1.health_score >= 70, `1st 429 should drop to CAUTION range (got ${state1.health_score})`);
      assert.strictEqual(state1.health_status, 'CAUTION');
      assert.strictEqual(state1.automation_mode, 'CAUTION');
      assert.strictEqual(state1.observed_rate_limit_count, 1);

      // 2nd 429 rate limit
      await accountHealthService.recordIncident({
        accountId: testAccountId1,
        userId: testUserId1,
        eventType: 'RATE_LIMIT_429',
        severity: 'high',
        statusCode: 429,
        errorCode: '2207001',
        metadata: { endpoint: '/v21.0/me/messages', action: 'sendDirectMessage' }
      });
      await new Promise(r => setTimeout(r, 600));

      let state2 = await accountHealthService.getAccountHealth(testAccountId1);
      assert.ok(state2.health_score < 70 && state2.health_score >= 40, `2nd 429 should drop to PROTECTION range (got ${state2.health_score})`);
      assert.strictEqual(state2.health_status, 'ELEVATED_RISK');
      assert.strictEqual(state2.automation_mode, 'PROTECTION');
      assert.strictEqual(state2.observed_rate_limit_count, 2);

      // 3rd persistent 429 rate limit
      await accountHealthService.recordIncident({
        accountId: testAccountId1,
        userId: testUserId1,
        eventType: 'RATE_LIMIT_429',
        severity: 'critical',
        statusCode: 429,
        errorCode: '2207001',
        metadata: { endpoint: '/v21.0/me/messages', action: 'sendDirectMessage' }
      });
      await new Promise(r => setTimeout(r, 600));

      let state3 = await accountHealthService.getAccountHealth(testAccountId1);
      assert.ok(state3.health_score < 40, `3rd 429 should drop to CRITICAL/PAUSED (got ${state3.health_score})`);
      assert.strictEqual(state3.health_status, 'CRITICAL');
      assert.strictEqual(state3.automation_mode, 'PAUSED');
      assert.strictEqual(state3.observed_rate_limit_count, 3);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: Durable Audit Ledger & PII / Token Sanitization
    // ─────────────────────────────────────────────────────────────────────────
    await test('5. Audit Ledger & PII Scrubbing: events table records incidents with zero secrets/PII', async () => {
      await accountHealthService.recordIncident({
        accountId: testAccountId1,
        userId: testUserId1,
        eventType: 'API_ERROR',
        severity: 'medium',
        statusCode: 500,
        errorCode: 'API_INTERNAL',
        metadata: {
          token: 'SECRET_BEARER_TOKEN_ABC123',
          access_token: 'EAABwz...',
          page_access_token: 'SECRET_PAGE_TOK',
          message_text: 'Personal private message to John Doe',
          recipient_id: 'user_ig_private_123',
          email: 'victim@personal.com',
          action: 'sendPrivateReply'
        }
      });

      const events = await accountHealthService.getAccountHealthEvents(testAccountId1, 10);
      assert.ok(events.length > 0, 'Should have recorded events');
      const latest = events[0];

      let meta = latest.metadata;
      if (typeof meta === 'string') meta = JSON.parse(meta);

      assert.strictEqual(meta.token, undefined, 'token must be stripped');
      assert.strictEqual(meta.access_token, undefined, 'access_token must be stripped');
      assert.strictEqual(meta.page_access_token, undefined, 'page_access_token must be stripped');
      assert.strictEqual(meta.message_text, undefined, 'message_text (PII) must be stripped');
      assert.strictEqual(meta.recipient_id, undefined, 'recipient_id (PII) must be stripped');
      assert.strictEqual(meta.email, undefined, 'email (PII) must be stripped');
      assert.strictEqual(meta.action, 'sendPrivateReply', 'action should be retained');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: Multi-Account Isolation
    // ─────────────────────────────────────────────────────────────────────────
    const testAccountId2 = `ig_acc_${uuidv4().slice(0, 8)}`;

    await test('6. Multi-Account Isolation: Account B degradation/pause leaves Account A completely unaffected', async () => {
      await createSyntheticAccount(testAccountId2, testUserId1, 'health_creator_2', '1784140002');

      const healthA = await accountHealthService.getAccountHealth(testAccountId1);
      const healthB = await accountHealthService.getAccountHealth(testAccountId2);

      // Account 1 was degraded to PAUSED in test 4
      assert.strictEqual(healthA.automation_mode, 'PAUSED', 'Account A should remain PAUSED');

      // Account 2 should be fresh and HEALTHY
      assert.strictEqual(healthB.health_score, 100, 'Account B score should be 100');
      assert.strictEqual(healthB.health_status, 'HEALTHY', 'Account B status should be HEALTHY');
      assert.strictEqual(healthB.automation_mode, 'NORMAL', 'Account B mode should be NORMAL');

      const modeA = await accountHealthService.getAutomationMode(testAccountId1);
      const modeB = await accountHealthService.getAutomationMode(testAccountId2);
      assert.strictEqual(modeA, 'PAUSED');
      assert.strictEqual(modeB, 'NORMAL');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: Guarded Manual Resume Gates & Controlled Stepwise Recovery
    // ─────────────────────────────────────────────────────────────────────────
    await test('7. Guarded Manual Resume: blocked during active cool-down; steps up from PAUSED to PROTECTION when clean', async () => {
      // Immediate resume should be blocked because a 429 incident was recorded within 15 minutes
      const blockedRes = await accountHealthService.requestResume(testAccountId1, testUserId1, 'customer', 'Creator clicked resume');
      assert.strictEqual(blockedRes.success, false, 'Should be blocked during active cool-down window');
      assert.ok(blockedRes.error.includes('15 minutes'), 'Error should explain the 15-minute cool-down gate');

      // Clear recent 429 events to simulate passage of cool-down window
      await db.prepare(`
        DELETE FROM instagram_account_health_events
        WHERE instagram_account_id = ? AND event_type = 'RATE_LIMIT_429'
      `).run(testAccountId1);

      // Attempt resume again after cool-down cleared
      const allowedRes = await accountHealthService.requestResume(testAccountId1, testUserId1, 'customer', 'Creator clicked resume after quiet period');
      assert.strictEqual(allowedRes.success, true, 'Resume should succeed after quiet period');
      assert.strictEqual(allowedRes.previousMode, 'PAUSED');
      assert.strictEqual(allowedRes.currentMode, 'PROTECTION', 'Step 1 of controlled recovery must be PROTECTION, not instant NORMAL');

      // Step up again: PROTECTION -> CAUTION
      const step2Res = await accountHealthService.requestResume(testAccountId1, testUserId1, 'customer', 'Step up to caution');
      assert.strictEqual(step2Res.currentMode, 'CAUTION');

      // Step up again: CAUTION -> NORMAL
      const step3Res = await accountHealthService.requestResume(testAccountId1, testUserId1, 'customer', 'Step up to normal');
      assert.strictEqual(step3Res.currentMode, 'NORMAL');
      assert.strictEqual(step3Res.healthStatus, 'HEALTHY');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8: Administrative Mode Override & Audit Logging
    // ─────────────────────────────────────────────────────────────────────────
    const testAdminId = `adm_${uuidv4().slice(0, 8)}`;
    const testAdminEmail = 'security-admin@airvix.test';

    await test('8. Admin Mode Override: strictly RBAC-governed, updates state and records to audit_logs', async () => {
      await createSyntheticUser(testAdminId, testAdminEmail, 'enterprise');
      const overrideRes = await accountHealthService.adminOverrideMode({
        accountId: testAccountId1,
        newMode: 'PROTECTION',
        reason: 'Investigating anomalous comment burst spike',
        adminId: testAdminId,
        adminEmail: testAdminEmail
      });

      assert.strictEqual(overrideRes.success, true);
      assert.strictEqual(overrideRes.newMode, 'PROTECTION');

      const updated = await accountHealthService.getAccountHealth(testAccountId1);
      assert.strictEqual(updated.automation_mode, 'PROTECTION');

      // Verify audit_log entry was created
      const pool = db.getPgPool ? db.getPgPool() : null;
      let logRow = null;
      if (pool) {
        const res = await pool.query('SELECT * FROM audit_logs WHERE actor_id = $1 LIMIT 1', [testAdminId]);
        logRow = res.rows[0];
      } else {
        logRow = await db.prepare('SELECT * FROM audit_logs WHERE actor_id = ? LIMIT 1').get(testAdminId);
      }

      assert.ok(logRow, 'Audit log row should be persisted');
      assert.strictEqual(logRow.actor_email, testAdminEmail);
      assert.strictEqual(logRow.target_resource, testAccountId1);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 9: Queue Traffic Pacing, Paused Job Holding & Idempotency
    // ─────────────────────────────────────────────────────────────────────────
    await test('9. Queue Behavior: PAUSED mode safely holds and reschedules job with zero quota churn and no duplicate dispatch', async () => {
      // Force Account 1 into PAUSED mode
      await accountHealthService.adminOverrideMode({
        accountId: testAccountId1,
        newMode: 'PAUSED',
        reason: 'Test paused queue hold',
        adminId: testAdminId,
        adminEmail: testAdminEmail
      });

      // Check throttle evaluation
      const throttleCheck = queue.checkAccountThrottle(testAccountId1);
      assert.strictEqual(throttleCheck.throttled, true, 'PAUSED account must be throttled');
      assert.strictEqual(throttleCheck.reason, 'account_health_paused');
      assert.strictEqual(throttleCheck.waitMs, HEALTH_CONFIG.PACING_DELAYS.PAUSED_CHECK_INTERVAL_MS || 30000);

      // Baseline quota usage before job enqueue
      const quotaBefore = await quotaService.getAuthoritativeUsage(testUserId1);

      // Create a candidate job for this account
      const mockEvent = {
        type: 'comment',
        accountId: testAccountId1,
        commentId: `c_hold_${uuidv4().slice(0, 8)}`,
        createdTime: Date.now()
      };

      const job = queue.enqueue(mockEvent);
      assert.ok(job, 'Job should be enqueued');
      const originalScheduledAt = job.scheduledAt;

      // When processNext encounters this candidate over multiple worker cycles:
      // It must reschedule candidate forward WITHOUT invoking executeJob, WITHOUT creating/rolling back quota reservations
      const initialQueueLen = queue.queue.length;
      for (let cycle = 0; cycle < 3; cycle++) {
        await queue.processNext();
      }

      // Verify job was NOT dropped from queue
      assert.strictEqual(queue.queue.length, initialQueueLen, 'Job must NOT be spliced or dropped when throttled');
      const queuedJob = queue.queue.find(j => j.id === job.id);
      assert.ok(queuedJob, 'Job must still exist in memory queue');
      assert.ok(queuedJob.scheduledAt > originalScheduledAt, 'scheduledAt must be pushed forward by wait interval');

      // Verify ZERO quota reservation or rollback churn occurred during hold
      const quotaAfter = await quotaService.getAuthoritativeUsage(testUserId1);
      assert.strictEqual(quotaAfter.committed_usage, quotaBefore.committed_usage, 'Held job must not commit quota');
      assert.strictEqual(quotaAfter.pending_reservations, quotaBefore.pending_reservations, 'Held job must not leave pending reservations');

      // Verify Idempotency: Attempting to enqueue duplicate event must be discarded
      const dupJob = queue.enqueue(mockEvent);
      assert.strictEqual(dupJob, null, 'Duplicate event must be ignored by idempotency key');

      // Clean up queue
      queue.queue = queue.queue.filter(j => j.id !== job.id);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 10: Quota Independence & Rollback on Delivery Failure
    // ─────────────────────────────────────────────────────────────────────────
    await test('10. Quota Independence: health checks never consume quota; failed sends roll back quota reservations', async () => {
      // Create user and check initial usage
      const initialUsage = await quotaService.getAuthoritativeUsage(testUserId1);
      const startCommitted = initialUsage.committed_usage || 0;

      // Reserve 1 DM quota
      const reservationKey = `test_res_${uuidv4().slice(0, 8)}`;
      const reservation = await quotaService.reserveReplyQuota(testUserId1, 'dm', reservationKey);
      assert.strictEqual(reservation.allowed, true, 'Reservation should succeed');

      // Simulate API send failure (429 rate limit)
      await quotaService.rollbackReplyQuota(reservation.reservationId);

      // Record health incident
      await accountHealthService.recordIncident({
        accountId: testAccountId1,
        userId: testUserId1,
        eventType: 'RATE_LIMIT_429',
        statusCode: 429
      });

      // Verify quota was cleanly restored
      const postUsage = await quotaService.getAuthoritativeUsage(testUserId1);
      assert.strictEqual(postUsage.committed_usage, startCommitted, 'Committed quota must NOT increase on failed send');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 11: GDPR Article 17-Compatible Data Erasure Behavior
    // ─────────────────────────────────────────────────────────────────────────
    await test('11. GDPR Article 17-compatible data erasure behavior: user erasure anonymizes health events metadata without cascade failure', async () => {
      // Create a temporary user with health events
      const gdprUserId = `u_gdpr_${uuidv4().slice(0, 8)}`;
      const gdprAccId = `ig_gdpr_${uuidv4().slice(0, 8)}`;

      await createSyntheticUser(gdprUserId, `${gdprUserId}@gdpr.test`, 'free');
      await createSyntheticAccount(gdprAccId, gdprUserId, 'gdpr_acc', '1784140099');

      await accountHealthService.recordIncident({
        accountId: gdprAccId,
        userId: gdprUserId,
        eventType: 'API_ERROR',
        metadata: { action: 'sendPublicReply', code: 500 }
      });

      // Verify event was recorded before erasure
      const eventsBefore = await accountHealthService.getAccountHealthEvents(gdprAccId, 1);
      assert.ok(eventsBefore.length > 0, 'Event should exist before deletion');
      const targetEventId = eventsBefore[0].id;

      // Execute GDPR permanent deletion
      const pool = db.getPgPool ? db.getPgPool() : null;
      if (pool) {
        const eraseRes = await dataRetention.deleteUserData(gdprUserId, 'gdpr_request');
        assert.strictEqual(eraseRes.success, true);

        // Verify that health event remained with user_id NULL and instagram_account_id NULL (ON DELETE SET NULL) and empty metadata
        const eventRes = await pool.query(`
          SELECT user_id, instagram_account_id, metadata FROM instagram_account_health_events
          WHERE id = $1
        `, [targetEventId]);

        assert.strictEqual(eventRes.rows.length, 1, 'Event row should persist in audit ledger');
        assert.strictEqual(eventRes.rows[0].user_id, null, 'Foreign key user_id should be SET NULL on erasure');
        assert.strictEqual(eventRes.rows[0].instagram_account_id, null, 'Foreign key instagram_account_id should be SET NULL on erasure');
        
        let meta = eventRes.rows[0].metadata;
        if (typeof meta === 'string') meta = JSON.parse(meta);
        assert.deepStrictEqual(meta, {}, 'Metadata should be scrubbed of all details on erasure');
      }
    });

  } finally {
    await cleanup();
  }

  console.log('\n================================================================================');
  console.log(`📊 RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
