// tests/combinedReplyQuota.test.js
// Complete 18-Scenario Verification Suite for Airvix Combined Reply Quota
// (Shared monthly pool: Instagram DM replies + Instagram Comment replies)

const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

process.env.NODE_ENV = 'test';
process.env.META_MOCK_MODE = 'true';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const db = require('../backend/src/db');
const quotaService = require('../backend/src/services/quotaService');
const queue = require('../backend/src/services/queue');
const { encrypt } = require('../backend/src/services/crypto');
const { dmLimitFor, dailyLimitFor } = require('../backend/src/constants/planLimits');

async function runTests() {
  console.log('\n==================================================');
  console.log('🧪 AIRVIX COMBINED REPLY QUOTA — COMPLETE 18-TEST SUITE');
  console.log('   (1 DM = 1 unit, 1 Comment = 1 unit, shared pool)');
  console.log('==================================================\n');

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

  const syntheticUsers = [];
  async function cleanup() {
    if (syntheticUsers.length === 0) return;
    try {
      const placeholders = syntheticUsers.map(() => '?').join(',');
      await db.prepare(`DELETE FROM quota_reservations WHERE user_id IN (${placeholders})`).run(...syntheticUsers).catch(() => {});
      await db.prepare(`DELETE FROM usage_counters WHERE user_id IN (${placeholders})`).run(...syntheticUsers).catch(() => {});
      await db.prepare(`DELETE FROM subscriptions WHERE user_id IN (${placeholders})`).run(...syntheticUsers).catch(() => {});
      await db.prepare(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE instagram_account_id IN (SELECT id FROM instagram_accounts WHERE user_id IN (${placeholders})))`).run(...syntheticUsers).catch(() => {});
      await db.prepare(`DELETE FROM comment_replies WHERE instagram_account_id IN (SELECT id FROM instagram_accounts WHERE user_id IN (${placeholders}))`).run(...syntheticUsers).catch(() => {});
      await db.prepare(`DELETE FROM automation_rules WHERE instagram_account_id IN (SELECT id FROM instagram_accounts WHERE user_id IN (${placeholders}))`).run(...syntheticUsers).catch(() => {});
      await db.prepare(`DELETE FROM instagram_accounts WHERE user_id IN (${placeholders})`).run(...syntheticUsers).catch(() => {});
      await db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...syntheticUsers).catch(() => {});
    } catch (e) {
      console.warn('Cleanup notice:', e.message);
    }
  }

  async function createSyntheticUser(customLimit = 10, plan = 'starter') {
    const userId = `syn_usr_${uuidv4().slice(0, 8)}`;
    syntheticUsers.push(userId);
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO users (id, email, name, plan, status, custom_dm_limit, dm_usage_this_period, usage_period_start, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, 0, ?, ?, ?)
    `).run(userId, `${userId}@airvix.test`, 'Synthetic Tester', plan, customLimit, now.slice(0, 10), now, now);

    await db.prepare(`
      INSERT INTO subscriptions (id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
      VALUES (?, ?, ?, 'active', 'monthly', NOW(), NOW() + INTERVAL '30 days', NOW(), NOW())
    `).run(`syn_sub_${uuidv4().slice(0, 8)}`, userId, plan);

    await db.prepare(`
      INSERT INTO usage_counters (id, user_id, period_start, period_end, dms_sent, comments_replied, updated_at)
      VALUES (?, ?, NOW(), NOW() + INTERVAL '30 days', 0, 0, NOW())
      ON CONFLICT (user_id) DO UPDATE SET dms_sent = 0, comments_replied = 0
    `).run(`cnt_${userId}`, userId);

    return userId;
  }

  try {
    // -------------------------------------------------------------
    // Test 1: 6 DM + 4 Comment | Quota = 10 => total = 10
    // -------------------------------------------------------------
    await test('Test 1: 6 DM + 4 Comment (quota = 10, expected total = 10)', async () => {
      const u = await createSyntheticUser(10);

      // Send 6 DMs
      for (let i = 0; i < 6; i++) {
        const res = await quotaService.reserveReplyQuota(u, 'dm');
        assert.strictEqual(res.allowed, true, `DM ${i + 1} must be allowed`);
        const commitRes = await quotaService.commitReplyQuota(res.reservationId);
        assert.strictEqual(commitRes.committed, true);
      }

      // Send 4 Comments
      for (let i = 0; i < 4; i++) {
        const res = await quotaService.reserveReplyQuota(u, 'comment');
        assert.strictEqual(res.allowed, true, `Comment ${i + 1} must be allowed`);
        const commitRes = await quotaService.commitReplyQuota(res.reservationId);
        assert.strictEqual(commitRes.committed, true);
      }

      const usage = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(usage.dms_sent, 6, 'dms_sent must be 6');
      assert.strictEqual(usage.comments_replied, 4, 'comments_replied must be 4');
      assert.strictEqual(usage.total_replies_used, 10, 'total_replies_used must be 10');
      assert.strictEqual(usage.remaining, 0, 'remaining must be 0');
      assert.strictEqual(usage.is_capped, true, 'is_capped must be true');
    });

    // -------------------------------------------------------------
    // Test 2: 10 DM -> next Comment blocked
    // -------------------------------------------------------------
    await test('Test 2: 10 DM -> next Comment blocked (quota = 10)', async () => {
      const u = await createSyntheticUser(10);

      for (let i = 0; i < 10; i++) {
        const res = await quotaService.reserveReplyQuota(u, 'dm');
        assert.strictEqual(res.allowed, true);
        await quotaService.commitReplyQuota(res.reservationId);
      }

      const blockedComment = await quotaService.reserveReplyQuota(u, 'comment');
      assert.strictEqual(blockedComment.allowed, false, '11th reply (Comment) must be blocked');
      assert.strictEqual(blockedComment.reason, 'QUOTA_EXCEEDED');

      const usage = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(usage.dms_sent, 10);
      assert.strictEqual(usage.comments_replied, 0);
      assert.strictEqual(usage.total_replies_used, 10);
      assert.strictEqual(usage.remaining, 0);
    });

    // -------------------------------------------------------------
    // Test 3: 10 Comment -> next DM blocked
    // -------------------------------------------------------------
    await test('Test 3: 10 Comment -> next DM blocked (quota = 10)', async () => {
      const u = await createSyntheticUser(10);

      for (let i = 0; i < 10; i++) {
        const res = await quotaService.reserveReplyQuota(u, 'comment');
        assert.strictEqual(res.allowed, true);
        await quotaService.commitReplyQuota(res.reservationId);
      }

      const blockedDm = await quotaService.reserveReplyQuota(u, 'dm');
      assert.strictEqual(blockedDm.allowed, false, '11th reply (DM) must be blocked');
      assert.strictEqual(blockedDm.reason, 'QUOTA_EXCEEDED');

      const usage = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(usage.comments_replied, 10);
      assert.strictEqual(usage.dms_sent, 0);
      assert.strictEqual(usage.total_replies_used, 10);
      assert.strictEqual(usage.remaining, 0);
    });

    // -------------------------------------------------------------
    // Test 4: 9 used + concurrent DM + Comment -> exactly ONE succeeds
    // -------------------------------------------------------------
    await test('Test 4: 9 used + concurrent DM + Comment -> exactly ONE succeeds, total = 10, never 11', async () => {
      const u = await createSyntheticUser(10);

      for (let i = 0; i < 5; i++) {
        const res = await quotaService.reserveReplyQuota(u, 'dm');
        await quotaService.commitReplyQuota(res.reservationId);
      }
      for (let i = 0; i < 4; i++) {
        const res = await quotaService.reserveReplyQuota(u, 'comment');
        await quotaService.commitReplyQuota(res.reservationId);
      }

      const usageBefore = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(usageBefore.total_replies_used, 9);
      assert.strictEqual(usageBefore.remaining, 1);

      // Launch simultaneous concurrent DM and Comment reservations
      const [resDm, resComment] = await Promise.all([
        quotaService.reserveReplyQuota(u, 'dm'),
        quotaService.reserveReplyQuota(u, 'comment')
      ]);

      const successes = [resDm, resComment].filter(r => r.allowed === true);
      const failures = [resDm, resComment].filter(r => r.allowed === false);

      assert.strictEqual(successes.length, 1, 'Exactly ONE reservation must succeed');
      assert.strictEqual(failures.length, 1, 'Exactly ONE reservation must be rejected');

      // Commit the winner
      await quotaService.commitReplyQuota(successes[0].reservationId);

      const usageAfter = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(usageAfter.total_replies_used, 10, 'Final committed usage must be exactly 10');
      assert.strictEqual(usageAfter.remaining, 0, 'Remaining must be 0');
      assert(usageAfter.total_replies_used <= 10, 'Usage must NEVER exceed 10 under concurrency');
    });

    // -------------------------------------------------------------
    // Test 5: DM Meta failure -> reservation released, committed usage unchanged
    // -------------------------------------------------------------
    await test('Test 5: DM Meta failure -> reservation released, committed usage unchanged', async () => {
      const u = await createSyntheticUser(10);

      const res = await quotaService.reserveReplyQuota(u, 'dm');
      assert.strictEqual(res.allowed, true);

      // Quota is reserved, committed is 0
      const midUsage = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(midUsage.committed_usage, 0);
      assert.strictEqual(midUsage.reserved_usage, 1);
      assert.strictEqual(midUsage.available_quota, 9);

      // Simulate Meta send failure -> rollback reservation
      const rbRes = await quotaService.rollbackReplyQuota(res.reservationId);
      assert.strictEqual(rbRes.rolledBack, true);

      const postUsage = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(postUsage.dms_sent, 0, 'dms_sent must remain 0');
      assert.strictEqual(postUsage.committed_usage, 0, 'committed_usage must remain 0');
      assert.strictEqual(postUsage.reserved_usage, 0, 'reserved_usage must return to 0');
      assert.strictEqual(postUsage.available_quota, 10, 'available_quota must return to 10');
    });

    // -------------------------------------------------------------
    // Test 6: Comment Meta failure -> reservation released, committed usage unchanged
    // -------------------------------------------------------------
    await test('Test 6: Comment Meta failure -> reservation released, committed usage unchanged', async () => {
      const u = await createSyntheticUser(10);

      const res = await quotaService.reserveReplyQuota(u, 'comment');
      assert.strictEqual(res.allowed, true);

      // Rollback reservation on failure
      const rbRes = await quotaService.rollbackReplyQuota(res.reservationId);
      assert.strictEqual(rbRes.rolledBack, true);

      const postUsage = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(postUsage.comments_replied, 0, 'comments_replied must remain 0');
      assert.strictEqual(postUsage.committed_usage, 0, 'committed_usage must remain 0');
      assert.strictEqual(postUsage.reserved_usage, 0, 'reserved_usage must be 0');
      assert.strictEqual(postUsage.available_quota, 10, 'available_quota must return to 10');
    });

    // -------------------------------------------------------------
    // Test 7: Duplicate webhook -> one reply, one quota unit
    // -------------------------------------------------------------
    await test('Test 7: Duplicate webhook -> one reply, one quota unit', async () => {
      const u = await createSyntheticUser(10);
      const accId = `acc_${uuidv4().slice(0, 8)}`;
      const encTok = encrypt('test_page_token');

      await db.prepare(`
        INSERT INTO instagram_accounts (id, user_id, ig_user_id, page_id, username, access_token_enc, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'connected', NOW(), NOW())
      `).run(accId, u, `ig_${accId}`, `page_${accId}`, `user_${accId}`, encTok);

      const ruleId = `rule_${uuidv4().slice(0, 8)}`;
      await db.prepare(`
        INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, reply_message, is_active, comment_reply_mode)
        VALUES (?, ?, 'comment_to_dm', 'hello', 'Hi there!', 1, 'comment_only')
      `).run(ruleId, accId);

      const commentId = `sim_comm_${uuidv4().slice(0, 8)}`;
      const commentEvent = {
        type: 'comments',
        accountId: `ig_${accId}`,
        data: {
          commentId,
          text: 'hello',
          commenterId: `commenter_${uuidv4().slice(0, 6)}`,
          commenterUsername: 'fan123',
          createdTime: Math.floor(Date.now() / 1000)
        }
      };

      // First webhook execution
      await queue.processComment(`ig_${accId}`, commentEvent.data);

      const usageAfterFirst = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(usageAfterFirst.comments_replied, 1, 'First comment reply must consume exactly 1 quota');

      // Duplicate webhook delivery with same commentId
      await queue.processComment(`ig_${accId}`, commentEvent.data);

      const usageAfterDuplicate = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(usageAfterDuplicate.comments_replied, 1, 'Duplicate webhook must NOT consume additional quota');
      assert.strictEqual(usageAfterDuplicate.total_replies_used, 1, 'Total usage remains 1');
    });

    // -------------------------------------------------------------
    // Test 8: Duplicate commit -> no additional quota
    // -------------------------------------------------------------
    await test('Test 8: Duplicate commit -> no additional quota (idempotent)', async () => {
      const u = await createSyntheticUser(10);

      const res = await quotaService.reserveReplyQuota(u, 'dm');
      assert.strictEqual(res.allowed, true);

      // First commit
      const commit1 = await quotaService.commitReplyQuota(res.reservationId);
      assert.strictEqual(commit1.committed, true);
      assert.strictEqual(commit1.totalRepliesUsed, 1);

      // Duplicate commit with same reservation ID
      const commit2 = await quotaService.commitReplyQuota(res.reservationId);
      assert.strictEqual(commit2.committed, true);
      assert.strictEqual(commit2.alreadyCommitted, true, 'Second commit must be flagged as alreadyCommitted');

      const usage = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(usage.dms_sent, 1, 'dms_sent must still be 1');
      assert.strictEqual(usage.total_replies_used, 1, 'total_replies_used must still be 1');
    });

    // -------------------------------------------------------------
    // Test 9: Duplicate rollback -> no counter corruption
    // -------------------------------------------------------------
    await test('Test 9: Duplicate rollback -> no counter corruption (idempotent)', async () => {
      const u = await createSyntheticUser(10);

      const res = await quotaService.reserveReplyQuota(u, 'dm');
      assert.strictEqual(res.allowed, true);

      // First rollback
      const rb1 = await quotaService.rollbackReplyQuota(res.reservationId);
      assert.strictEqual(rb1.rolledBack, true);

      // Duplicate rollback
      const rb2 = await quotaService.rollbackReplyQuota(res.reservationId);
      assert.strictEqual(rb2.rolledBack, true);
      assert.strictEqual(rb2.alreadyRolledBack, true, 'Second rollback must be flagged as alreadyRolledBack');

      const usage = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(usage.dms_sent, 0, 'dms_sent must be 0, never negative');
      assert.strictEqual(usage.comments_replied, 0, 'comments_replied must be 0, never negative');
      assert.strictEqual(usage.total_replies_used, 0);
    });

    // -------------------------------------------------------------
    // Test 10: Worker crash between reservation and commit -> verify safe recovery
    // -------------------------------------------------------------
    await test('Test 10: Worker crash between reservation and commit -> safe recovery & expiry', async () => {
      const u = await createSyntheticUser(10);

      // Worker reserves with 60-second TTL then "crashes" (never calls commit or rollback)
      const crashKey = `crash_job_${uuidv4().slice(0, 8)}`;
      const res = await quotaService.reserveReplyQuota(u, 'dm', crashKey, 60);
      assert.strictEqual(res.allowed, true);

      // Immediately after reservation, in-flight reservation is 1, available quota is 9
      const usageDuringCrash = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(usageDuringCrash.reserved_usage, 1, 'In-flight reservation must be 1');
      assert.strictEqual(usageDuringCrash.available_quota, 9, 'Available quota must be 9');

      // Simulate TTL expiration past expires_at (as if 60s had elapsed during crash)
      await db.prepare("UPDATE quota_reservations SET expires_at = NOW() - INTERVAL '5 seconds' WHERE id = ?").run(res.reservationId);

      // Run expiry reconciliation
      const reconcile = await quotaService.expireStaleReservations();
      assert(reconcile.expiredCount >= 1, 'Stale reservation must be expired');

      // Quota is fully restored
      const usageAfterReconcile = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(usageAfterReconcile.reserved_usage, 0, 'Reserved count restored to 0');
      assert.strictEqual(usageAfterReconcile.available_quota, 10, 'Full quota of 10 restored');

      // Retried job can now reserve safely
      const retryRes = await quotaService.reserveReplyQuota(u, 'dm', crashKey, 300);
      assert.strictEqual(retryRes.allowed, true, 'Retry reservation succeeds safely');
      await quotaService.commitReplyQuota(retryRes.reservationId);

      const finalUsage = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(finalUsage.dms_sent, 1);
      assert.strictEqual(finalUsage.total_replies_used, 1);
    });

    // -------------------------------------------------------------
    // Test 11: Comment-only rule with exhausted quota MUST be blocked
    // -------------------------------------------------------------
    await test('Test 11: Comment-only rule with exhausted quota MUST be blocked', async () => {
      const u = await createSyntheticUser(3);
      const accId = `acc_${uuidv4().slice(0, 8)}`;
      const encTok = encrypt('test_page_token');

      await db.prepare(`
        INSERT INTO instagram_accounts (id, user_id, ig_user_id, page_id, username, access_token_enc, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'connected', NOW(), NOW())
      `).run(accId, u, `ig_${accId}`, `page_${accId}`, `user_${accId}`, encTok);

      const ruleId = `rule_${uuidv4().slice(0, 8)}`;
      await db.prepare(`
        INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, reply_message, is_active, comment_reply_mode)
        VALUES (?, ?, 'comment_to_dm', 'commentonly', 'Public comment only!', 1, 'comment_only')
      `).run(ruleId, accId);

      // Exhaust all 3 units with DMs
      for (let i = 0; i < 3; i++) {
        const res = await quotaService.reserveReplyQuota(u, 'dm');
        await quotaService.commitReplyQuota(res.reservationId);
      }

      const usageBefore = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(usageBefore.is_capped, true, 'Quota must be capped (3/3)');

      // Process comment matching comment-only rule
      const commentId = `sim_comm_capped_${uuidv4().slice(0, 8)}`;
      await queue.processComment(`ig_${accId}`, {
        commentId,
        text: 'commentonly',
        commenterId: `user_${uuidv4().slice(0, 6)}`,
        commenterUsername: 'visitor',
        createdTime: Math.floor(Date.now() / 1000)
      });

      // Check comment_replies: must be recorded as 'usage_capped'
      const replyRow = await db.prepare('SELECT status, error_message FROM comment_replies WHERE comment_id = ?').get(commentId);
      assert.strictEqual(replyRow?.status, 'usage_capped', 'Status in comment_replies must be usage_capped');

      const usageAfter = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(usageAfter.comments_replied, 0, 'No comment quota consumed');
      assert.strictEqual(usageAfter.total_replies_used, 3, 'Total usage remains exactly 3');
    });

    // -------------------------------------------------------------
    // Test 12: DM with exhausted quota MUST be blocked
    // -------------------------------------------------------------
    await test('Test 12: DM with exhausted quota MUST be blocked', async () => {
      const u = await createSyntheticUser(2);
      const accId = `acc_${uuidv4().slice(0, 8)}`;
      const encTok = encrypt('test_page_token');

      await db.prepare(`
        INSERT INTO instagram_accounts (id, user_id, ig_user_id, page_id, username, access_token_enc, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'connected', NOW(), NOW())
      `).run(accId, u, `ig_${accId}`, `page_${accId}`, `user_${accId}`, encTok);

      const ruleId = `rule_${uuidv4().slice(0, 8)}`;
      await db.prepare(`
        INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, reply_message, is_active)
        VALUES (?, ?, 'dm_keyword_reply', 'start', 'Welcome!', 1)
      `).run(ruleId, accId);

      // Exhaust quota (2/2)
      for (let i = 0; i < 2; i++) {
        const res = await quotaService.reserveReplyQuota(u, 'dm');
        await quotaService.commitReplyQuota(res.reservationId);
      }

      // Inbound message
      const msgId = `sim_msg_capped_${uuidv4().slice(0, 8)}`;
      await queue.processMessage(`ig_${accId}`, {
        messageId: msgId,
        senderId: `sender_${uuidv4().slice(0, 6)}`,
        senderUsername: 'sender123',
        text: 'start',
        timestamp: Date.now()
      });

      // Check messages table: outbound must be recorded as 'usage_capped'
      const msgRow = await db.prepare("SELECT status FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE instagram_account_id = ?) AND direction = 'outbound' ORDER BY created_at DESC LIMIT 1").get(accId);
      assert.strictEqual(msgRow?.status, 'usage_capped', 'Outbound DM must be logged as usage_capped');

      const usageAfter = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(usageAfter.total_replies_used, 2, 'Total usage remains exactly 2');
    });

    // -------------------------------------------------------------
    // Test 13: Manual DM with exhausted quota MUST be blocked
    // -------------------------------------------------------------
    await test('Test 13: Manual DM with exhausted quota MUST be blocked', async () => {
      const u = await createSyntheticUser(2);

      // Exhaust quota
      for (let i = 0; i < 2; i++) {
        const res = await quotaService.reserveReplyQuota(u, 'dm');
        await quotaService.commitReplyQuota(res.reservationId);
      }

      // Manual DM reservation attempt
      const manualRes = await quotaService.reserveReplyQuota(u, 'dm');
      assert.strictEqual(manualRes.allowed, false, 'Manual DM reservation must be rejected');
      assert.strictEqual(manualRes.reason, 'QUOTA_EXCEEDED');
    });

    // -------------------------------------------------------------
    // Test 14: Mixed DM + Comment usage: total always equals dms_sent + comments_replied
    // -------------------------------------------------------------
    await test('Test 14: Mixed DM + Comment usage: total = dms_sent + comments_replied', async () => {
      const u = await createSyntheticUser(20);

      const sequence = ['dm', 'comment', 'comment', 'dm', 'dm', 'comment', 'dm'];
      let expectedDms = 0;
      let expectedComments = 0;

      for (const type of sequence) {
        const res = await quotaService.reserveReplyQuota(u, type);
        assert.strictEqual(res.allowed, true);
        await quotaService.commitReplyQuota(res.reservationId);

        if (type === 'dm') expectedDms++;
        else expectedComments++;

        const currentUsage = await quotaService.getAuthoritativeUsage(u);
        assert.strictEqual(currentUsage.dms_sent, expectedDms);
        assert.strictEqual(currentUsage.comments_replied, expectedComments);
        assert.strictEqual(currentUsage.total_replies_used, expectedDms + expectedComments, 'total_replies_used MUST always equal dms_sent + comments_replied');
      }
    });

    // -------------------------------------------------------------
    // Test 15: /api/usage consistency
    // -------------------------------------------------------------
    await test('Test 15: /api/usage returns consistent PostgreSQL authoritative fields', async () => {
      const u = await createSyntheticUser(15);

      for (let i = 0; i < 3; i++) {
        const r = await quotaService.reserveReplyQuota(u, 'dm');
        await quotaService.commitReplyQuota(r.reservationId);
      }
      for (let i = 0; i < 2; i++) {
        const r = await quotaService.reserveReplyQuota(u, 'comment');
        await quotaService.commitReplyQuota(r.reservationId);
      }

      const usage = await quotaService.getAuthoritativeUsage(u);

      assert.strictEqual(usage.dms_sent, 3);
      assert.strictEqual(usage.comments_replied, 2);
      assert.strictEqual(usage.total_replies_used, 5);
      assert.strictEqual(usage.monthly_limit, 15);
      assert.strictEqual(usage.remaining, 10);
      assert.strictEqual(usage.daily_limit, dailyLimitFor('starter', undefined, 15));
      assert.strictEqual(usage.plan, 'starter');
    });

    // -------------------------------------------------------------
    // Test 16: Dashboard consistency
    // -------------------------------------------------------------
    await test('Test 16: Dashboard query consistency (total_replies_used = dms_sent + comments_replied)', async () => {
      const u = await createSyntheticUser(10);

      for (let i = 0; i < 4; i++) {
        const r = await quotaService.reserveReplyQuota(u, 'dm');
        await quotaService.commitReplyQuota(r.reservationId);
      }
      for (let i = 0; i < 3; i++) {
        const r = await quotaService.reserveReplyQuota(u, 'comment');
        await quotaService.commitReplyQuota(r.reservationId);
      }

      const cnt = await db.prepare("SELECT dms_sent, comments_replied FROM usage_counters WHERE user_id = ?").get(u);
      const dashboardTotal = Number(cnt.dms_sent) + Number(cnt.comments_replied);

      const qs = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(dashboardTotal, 7);
      assert.strictEqual(qs.total_replies_used, dashboardTotal, 'Dashboard query must match quotaService total');
    });

    // -------------------------------------------------------------
    // Test 17: Billing consistency
    // -------------------------------------------------------------
    await test('Test 17: Billing /subscription query consistency', async () => {
      const u = await createSyntheticUser(10);

      for (let i = 0; i < 2; i++) {
        const r = await quotaService.reserveReplyQuota(u, 'dm');
        await quotaService.commitReplyQuota(r.reservationId);
      }
      for (let i = 0; i < 5; i++) {
        const r = await quotaService.reserveReplyQuota(u, 'comment');
        await quotaService.commitReplyQuota(r.reservationId);
      }

      const cnt = await db.prepare("SELECT dms_sent, comments_replied FROM usage_counters WHERE user_id = ?").get(u);
      const billingTotal = Number(cnt.dms_sent) + Number(cnt.comments_replied);

      const qs = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(billingTotal, 7);
      assert.strictEqual(qs.total_replies_used, billingTotal, 'Billing query must match quotaService total');
    });

    // -------------------------------------------------------------
    // Test 18: Admin consistency
    // -------------------------------------------------------------
    await test('Test 18: Admin batch user query consistency', async () => {
      const u = await createSyntheticUser(10);

      for (let i = 0; i < 6; i++) {
        const r = await quotaService.reserveReplyQuota(u, 'dm');
        await quotaService.commitReplyQuota(r.reservationId);
      }
      for (let i = 0; i < 2; i++) {
        const r = await quotaService.reserveReplyQuota(u, 'comment');
        await quotaService.commitReplyQuota(r.reservationId);
      }

      // Admin batched usage query
      const adminCnt = await db.prepare("SELECT user_id, dms_sent, comments_replied FROM usage_counters WHERE user_id = ?").all(u);
      const adminTotal = Number(adminCnt[0].dms_sent) + Number(adminCnt[0].comments_replied);

      const qs = await quotaService.getAuthoritativeUsage(u);
      assert.strictEqual(adminTotal, 8);
      assert.strictEqual(qs.total_replies_used, adminTotal, 'Admin batched query must match quotaService total');
    });

  } finally {
    await cleanup();
  }

  console.log('\n==================================================');
  console.log(`Results: ${passed} passed, ${failed} failed (out of 18)`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
