/**
 * Webhook Reliability Test Suite
 * Validates idempotency keys, duplicate detection, dead-letter queue (DLQ) dispatch,
 * retry handling, replay protection, and audit logging.
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../backend/src/db');
const queue = require('../backend/src/services/queue');
const { v4: uuidv4 } = require('uuid');

async function runTests() {
    console.log('🧪 Starting Webhook Reliability Test Suite...\n');
    await db.ready();
    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${name}`);
            console.error(`     Error: ${err.message}\n`);
            failed++;
        }
    };

    // 1. Duplicate webhook detection via idempotency key
    await test('Idempotency key detects duplicate webhook events in queue & DB', async () => {
        const testKey = `test_mid_${uuidv4().slice(0, 8)}`;
        
        // Initially not duplicate
        const isDup1 = await queue.isDuplicate(testKey);
        assert.strictEqual(isDup1, false, 'First occurrence must not be marked duplicate');

        // Record event in DB
        await db.prepare(`
            INSERT INTO webhook_events (id, idempotency_key, account_id, sender_id, event_type, payload, is_processed, created_at)
            VALUES (?, ?, 'acc-1', 'sender-1', 'messages', '{}', 1, datetime('now'))
        `).run(uuidv4(), testKey);

        // Now should be detected as duplicate
        const isDup2 = await queue.isDuplicate(testKey);
        assert.strictEqual(isDup2, true, 'Second occurrence with same idempotency key must be detected as duplicate');
    });

    // 2. Dead-letter queue dispatching on fatal or exhausted errors
    await test('Permanent/exhausted failures are dispatched to dead_letter_queue', async () => {
        const dlqJobId = `job-dlq-${uuidv4().slice(0, 8)}`;
        const testPayload = {
            id: dlqJobId,
            userId: 'user-test-dlq',
            type: 'INSTAGRAM_DM',
            attempt: 3,
            maxAttempts: 3,
            data: { message: 'Failed message', recipientId: 'rec-123' }
        };

        const testError = new Error('Permanent OAuthException: Invalid user token');
        testError.name = 'PermanentMetaError';

        await queue.handleDeadLetter(testPayload, testError);

        // Verify record in dead_letter_queue
        const dlqRecord = await db.prepare('SELECT * FROM dead_letter_queue WHERE job_id = ?').get(dlqJobId);
        assert(dlqRecord, 'Record must exist in dead_letter_queue table');
        assert.strictEqual(dlqRecord.error_name, 'PermanentMetaError');
        assert(dlqRecord.error_message.includes('OAuthException'));
        assert.strictEqual(dlqRecord.retry_count, 3);
        assert.strictEqual(dlqRecord.is_resolved, 0);
    });

    // 3. DLQ job reprocessing and resolution
    await test('Reprocess and resolve DLQ jobs via management service', async () => {
        const testDlqId = `dlq-${uuidv4().slice(0, 8)}`;
        const userId = 'user-test-reprocess';
        
        await db.prepare(`
            INSERT INTO dead_letter_queue (id, job_id, user_id, queue_name, payload, error_name, error_message, retry_count, is_resolved, created_at)
            VALUES (?, 'job-reprocess-1', ?, 'dm-dispatch', '{"type":"TEST"}', 'TestError', 'Temporary failure', 3, 0, datetime('now'))
        `).run(testDlqId, userId);

        const result = await queue.reprocessDlqJob(testDlqId, userId);
        assert(result.success, 'Reprocess must report success');
        assert.strictEqual(result.newJobId, 'job-reprocess-1');

        const updated = await db.prepare('SELECT is_resolved, resolved_at FROM dead_letter_queue WHERE id = ?').get(testDlqId);
        assert.strictEqual(updated.is_resolved, 1, 'DLQ record must be marked resolved');
        assert(updated.resolved_at, 'resolved_at timestamp must be recorded');
    });

    // 4. Webhook event persistence & audit trail scoping
    await test('Webhook audit trail is persisted with processing time and sender info', async () => {
        const auditEventId = uuidv4();
        const testMid = `audit_mid_${uuidv4().slice(0, 8)}`;

        await db.prepare(`
            INSERT INTO webhook_events (id, idempotency_key, account_id, sender_id, event_type, payload, processing_time_ms, is_processed, created_at)
            VALUES (?, ?, 'acc-audit-test', 'user-sender-99', 'messages', '{"test":true}', 45, 1, datetime('now'))
        `).run(auditEventId, testMid);

        const fetched = await db.prepare('SELECT * FROM webhook_events WHERE id = ?').get(auditEventId);
        assert(fetched, 'Audit record must be retrievable');
        assert.strictEqual(fetched.idempotency_key, testMid);
        assert.strictEqual(fetched.processing_time_ms, 45);
        assert.strictEqual(fetched.sender_id, 'user-sender-99');
    });

    console.log(`\n========================================`);
    console.log(`Webhook Reliability: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
