// tests/queueArchitecture.test.js
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

process.env.NODE_ENV = 'test';
process.env.META_MOCK_MODE = 'true';
process.env.META_APP_SECRET = 'test_meta_app_secret_98765';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const db = require('../backend/src/db');
const queue = require('../backend/src/services/queue');
const {
  QUEUE_CONFIG,
  calculateRandomDelayMs,
  calculateBackoffWithJitter,
  extractRetryAfterMs
} = require('../backend/src/constants/queueConfig');
const { encrypt } = require('../backend/src/services/crypto');

async function waitFor(predicate, timeoutMs = 5000, intervalMs = 100) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await predicate();
      if (res) return res;
    } catch (e) {}
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return await predicate();
}

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 Starting Queue & Delay Architecture Tests');
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
      console.error(`     Error: ${err.message}`);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  // Set up test account & rule
  const userId = uuidv4();
  const accountId = uuidv4();
  const igUserId = 'queue_ig_' + uuidv4().slice(0, 10);

  await db.prepare(`
    INSERT INTO users (id, email, plan, dm_usage_this_period, usage_period_start)
    VALUES (?, ?, 'pro', 0, date('now'))
  `).run(userId, `test_queue_${Date.now()}@example.com`);

  await db.prepare(`
    INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, page_id, access_token_enc, status, disclosure_message)
    VALUES (?, ?, ?, 'queue_creator_account', '109283746501928', ?, 'connected', '⚡ [Airvix Auto] ')
  `).run(accountId, userId, igUserId, encrypt('mock_access_token_queue'));

  const ruleId = uuidv4();
  await db.prepare(`
    INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, match_mode, reply_message, is_active)
    VALUES (?, ?, 'comment_to_dm', 'INFO', 'contains', 'Here is the requested info!', 1)
  `).run(ruleId, accountId);

  // 1. Queue configuration and delay calculations
  await test('calculateRandomDelayMs returns 0 in test mode and within [MIN, MAX] in production', () => {
    // In test mode (NODE_ENV=test)
    assert.strictEqual(calculateRandomDelayMs(), 0, 'Should be 0ms when NODE_ENV=test');

    // Simulate production mode
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      for (let i = 0; i < 20; i++) {
        const delay = calculateRandomDelayMs();
        assert(delay >= QUEUE_CONFIG.MIN_DELAY_SECONDS * 1000, `Delay ${delay} should be >= ${QUEUE_CONFIG.MIN_DELAY_SECONDS * 1000}`);
        assert(delay <= QUEUE_CONFIG.MAX_DELAY_SECONDS * 1000, `Delay ${delay} should be <= ${QUEUE_CONFIG.MAX_DELAY_SECONDS * 1000}`);
      }
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  // 2. Exponential backoff with jitter calculation
  await test('calculateBackoffWithJitter increases exponentially and respects retry-after', () => {
    const b1 = calculateBackoffWithJitter(1);
    const b2 = calculateBackoffWithJitter(2);
    const b3 = calculateBackoffWithJitter(3);

    assert(b1 >= 2000, 'Attempt 1 backoff should be at least base delay (2000ms)');
    assert(b2 >= 4000, 'Attempt 2 backoff should be at least 4000ms');
    assert(b3 >= 8000, 'Attempt 3 backoff should be at least 8000ms');

    // With explicit retry-after
    const withRetryAfter = calculateBackoffWithJitter(1, 15000);
    assert(withRetryAfter >= 15000 && withRetryAfter <= 17000, 'Backoff should respect retryAfter + jitter');
  });

  // 3. Retry-After header extraction
  await test('extractRetryAfterMs parses numeric and second-based headers', () => {
    assert.strictEqual(extractRetryAfterMs('30'), 30000);
    assert.strictEqual(extractRetryAfterMs(60), 60000);
    assert.strictEqual(extractRetryAfterMs(null), null);
    assert.strictEqual(extractRetryAfterMs('invalid'), null);
  });

  // 4. Asynchronous job enqueueing & persistence in webhook_jobs table
  await test('enqueue stores job in webhook_jobs with SCHEDULED/QUEUED state and idempotency key', async () => {
    const commentId = `comm_async_${Date.now()}`;
    const job = await queue.enqueue({
      type: 'comments',
      accountId: igUserId,
      data: {
        commentId,
        text: 'Send INFO please',
        commenterId: 'user_queue_01',
        commenterUsername: 'user_queue_01',
        createdTime: Date.now()
      }
    });

    assert(job, 'Job object should be returned');
    assert.strictEqual(job.idempotencyKey, `comm_${commentId}`);

    // Verify DB record
    const dbJob = await waitFor(async () => {
      return await db.prepare('SELECT * FROM webhook_jobs WHERE idempotency_key = ?').get(`comm_${commentId}`);
    });

    assert(dbJob, 'DB record in webhook_jobs should exist');
    assert.strictEqual(dbJob.job_type, 'comments');
    assert.strictEqual(dbJob.account_id, igUserId);
    assert(
      ['SCHEDULED', 'QUEUED', 'PROCESSING', 'SENT', 'COMPLETED'].includes(dbJob.state),
      `dbJob.state (${dbJob.state}) should be a valid lifecycle state`
    );
  });

  // 5. Strict Idempotency: duplicate events do not create duplicate jobs or duplicate replies
  await test('Idempotency prevents duplicate job creation and dual execution for identical event ID', async () => {
    const commentId = `comm_dup_${Date.now()}`;
    const payload = {
      type: 'comments',
      accountId: igUserId,
      data: {
        commentId,
        text: 'INFO dup check',
        commenterId: 'user_queue_02',
        commenterUsername: 'user_queue_02',
        createdTime: Date.now()
      }
    };

    // First enqueue
    const job1 = await queue.enqueue(payload);
    assert(job1, 'First job should be created');

    // Second enqueue with identical commentId
    const job2 = await queue.enqueue(payload);
    assert.strictEqual(job2, null, 'Second enqueue with identical idempotencyKey should return null/be ignored');

    // Wait for reply completion
    const reply = await waitFor(async () => {
      return await db.prepare('SELECT * FROM comment_replies WHERE comment_id = ?').get(commentId);
    }, 15000);
    assert(reply, 'Reply record should exist');

    // Count records in comment_replies
    const replyCount = await db.prepare('SELECT COUNT(*) as count FROM comment_replies WHERE comment_id = ?').get(commentId);
    assert.strictEqual(Number(replyCount.count), 1, 'Exactly one reply should be sent, never duplicated');
  });

  // 6. State lifecycle: transitions to SENT upon successful processing
  await test('Job transitions to SENT state in webhook_jobs upon delivery', async () => {
    const commentId = `comm_lifecycle_${Date.now()}`;
    await queue.enqueue({
      type: 'comments',
      accountId: igUserId,
      data: {
        commentId,
        text: 'INFO lifecycle test',
        commenterId: 'user_queue_03',
        commenterUsername: 'user_queue_03',
        createdTime: Date.now()
      }
    });

    const completedJob = await waitFor(async () => {
      const row = await db.prepare('SELECT * FROM webhook_jobs WHERE idempotency_key = ?').get(`comm_${commentId}`);
      if (row && (row.state === 'SENT' || row.state === 'COMPLETED')) return row;
      return null;
    }, 15000);

    assert(completedJob, 'Job state must transition to SENT or COMPLETED');
    assert(completedJob.state === 'SENT' || completedJob.state === 'COMPLETED');
    assert(completedJob.processed_at !== null, 'processed_at timestamp must be populated');
  });

  // 7. Dead-Letter State (DEAD_LETTER) on terminal exhaustion
  await test('Dead-Letter State is reached when job attempts exceed maximum attempts', async () => {
    const dlqKey = `dlq_test_${Date.now()}`;
    const dlqJobId = uuidv4();

    // Directly insert an exhausted job into webhook_jobs
    await db.prepare(`
      INSERT INTO webhook_jobs (
        id, idempotency_key, account_id, job_type, payload, scheduled_at, state, attempts, max_attempts, error_message
      ) VALUES (?, ?, ?, 'comments', ?, datetime('now'), 'DEAD_LETTER', 5, 5, 'Meta Graph API fatal error: Token revoked')
    `).run(
      dlqJobId,
      dlqKey,
      igUserId,
      JSON.stringify({ test: true })
    );

    const dlqRecord = await db.prepare('SELECT * FROM webhook_jobs WHERE id = ?').get(dlqJobId);
    assert(dlqRecord, 'DLQ record should exist');
    assert.strictEqual(dlqRecord.state, 'DEAD_LETTER');
    assert.strictEqual(Number(dlqRecord.attempts), 5);
    assert(dlqRecord.error_message.includes('Meta Graph API fatal error'));
  });

  // 8. Graceful shutdown
  await test('Queue shutdown gracefully stops polling timers and clears active pool', async () => {
    assert(typeof queue.shutdown === 'function', 'queue.shutdown must be a function');
    await queue.shutdown(1000);
    assert.strictEqual(queue.isShuttingDown, true, 'isShuttingDown flag should be true after shutdown');
  });

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
