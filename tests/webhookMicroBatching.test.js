// tests/webhookMicroBatching.test.js
const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../backend/src/db');
const queue = require('../backend/src/services/queue');
const { v4: uuidv4 } = require('uuid');

async function runWebhookMicroBatchTests() {
  console.log('\n======================================================');
  console.log('🧪 Webhook Micro-Batch Ingestion & Zero-Loss Tests');
  console.log('======================================================\n');

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

  const testAccountId = `acc_microbatch_${Date.now()}`;

  // 1. Rapid burst of 50 webhook events are micro-batched into DB without loss
  await test('Rapid burst of 50 webhook events micro-batches into DB with zero event loss', async () => {
    const jobs = [];
    for (let i = 0; i < 50; i++) {
      const event = {
        type: 'messages',
        accountId: testAccountId,
        data: {
          messageId: `mb_msg_${Date.now()}_${i}_${uuidv4().slice(0, 6)}`,
          senderId: `user_${i}`,
          text: `Hello burst ${i}`
        }
      };
      const job = queue.enqueue(event);
      if (job) jobs.push(job);
    }

    assert.strictEqual(jobs.length, 50, 'All 50 distinct events must be enqueued');

    // Force flush micro-batch to DB
    await queue.flushPersistBatch();

    // Verify all 50 jobs are persisted in webhook_jobs
    const ids = jobs.map(j => `'${j.id}'`).join(',');
    const rows = await db.query(`SELECT id, idempotency_key, state FROM webhook_jobs WHERE id IN (${ids})`);
    assert.strictEqual(rows.length, 50, `Expected 50 persisted rows, found ${rows.length}`);
  });

  // 2. Micro-batch respects ON CONFLICT (idempotency_key) DO NOTHING
  await test('Micro-batch respects idempotency_key deduplication across duplicate bursts', async () => {
    const duplicateKey = `idemp_dup_test_${Date.now()}`;
    const duplicateEvent = {
      type: 'comments',
      accountId: testAccountId,
      data: {
        commentId: duplicateKey,
        text: 'Duplicate test comment'
      }
    };

    // First enqueue
    const job1 = queue.enqueue(duplicateEvent);
    assert(job1, 'First enqueue must succeed');
    await queue.flushPersistBatch();

    // Directly attempt to persist another job with identical idempotencyKey
    const duplicateJob = {
      id: uuidv4(),
      idempotencyKey: `comm_${duplicateKey}`,
      event: duplicateEvent,
      maxAttempts: 3,
      scheduledAt: Date.now()
    };

    queue.persistJob(duplicateJob);
    await queue.flushPersistBatch();

    // Verify only 1 record exists in DB for this idempotency key
    const rows = await db.query(
      `SELECT count(*) as count FROM webhook_jobs WHERE idempotency_key = ?`,
      `comm_${duplicateKey}`
    );
    const count = parseInt(rows[0]?.count || '0', 10);
    assert.strictEqual(count, 1, `Expected exactly 1 record for duplicate idempotency key, got ${count}`);
  });

  // 3. Graceful shutdown drains pending micro-batch
  await test('Graceful shutdown flushes buffered micro-batches before completing', async () => {
    await queue.flushPersistBatch();
    const job = {
      id: uuidv4(),
      idempotencyKey: `drain_test_${Date.now()}`,
      event: { accountId: testAccountId, type: 'messages', data: { messageId: `msg_drain_${Date.now()}` } },
      maxAttempts: 3,
      scheduledAt: Date.now()
    };

    queue.persistJob(job);
    assert.strictEqual(queue.pendingPersistBatch.length, 1, 'Job must be in pending buffer before flush');

    // Call shutdown
    await queue.shutdown(1000);
    assert.strictEqual(queue.pendingPersistBatch.length, 0, 'Pending buffer must be drained by shutdown');

    const check = await db.prepare('SELECT id FROM webhook_jobs WHERE id = ?').get(job.id);
    assert(check, 'Job must be persisted in database upon shutdown drain');
  });

  // Cleanup test data
  try {
    await db.run(`DELETE FROM webhook_jobs WHERE account_id = ?`, testAccountId);
  } catch {}

  console.log('\n======================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} test(s) failed.`);
  }
}

if (require.main === module) {
  runWebhookMicroBatchTests()
    .then(() => {
      setTimeout(() => process.exit(0), 100);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runWebhookMicroBatchTests;
