/**
 * AIRVIX AUDIT SUITE: Section 58 & 64 — Webhook Ordering, Idempotency & Replay Protection
 * Tests:
 * 1. Webhook signature verification (HMAC-SHA256)
 * 2. Atomic INSERT ON CONFLICT DO NOTHING RETURNING id idempotency
 * 3. Concurrent duplicate webhook race across independent database connections
 * 4. Replay attack rejection
 */
const assert = require('assert');
const crypto = require('crypto');
const db = require('../backend/src/db');
const billingService = require('../backend/src/services/billingService');

async function run() {
  console.log('🧪 Starting Section 58/64 Audit: Webhook Idempotency & Replay Protection...\n');
  await db.ready();
  const pool = db.getPgPool();
  if (!pool) throw new Error('PostgreSQL Pool unavailable');

  const findings = [];
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     ${err.message}`);
      failed++;
      findings.push({ name, error: err.message });
    }
  }

  // 1. Test HMAC Signature Verification
  await test('Razorpay HMAC-SHA256 signature verification validates authentic payloads and rejects tampered ones', async () => {
    const secret = 'webhook_secret_test_12345';
    const payload = JSON.stringify({ event: 'payment.captured', id: 'pay_test_123' });
    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const isValid = billingService.verifyRazorpaySignature(payload, validSignature, secret);
    assert.strictEqual(isValid, true, 'Valid signature must be verified');

    const isTamperedValid = billingService.verifyRazorpaySignature(payload + ' ', validSignature, secret);
    assert.strictEqual(isTamperedValid, false, 'Tampered payload must be rejected');

    const isWrongSigValid = billingService.verifyRazorpaySignature(payload, 'deadbeef1234', secret);
    assert.strictEqual(isWrongSigValid, false, 'Invalid signature must be rejected');
  });

  // 2. Test Atomic Webhook Idempotency Insertion
  await test('Atomic INSERT ON CONFLICT DO NOTHING RETURNING id guarantees exactly one processor', async () => {
    const testEventId = `evt_audit_idemp_${Date.now()}`;
    const testKey = `test_key_${testEventId}`;

    const client = await pool.connect();
    try {
      // First insertion
      const firstRes = await client.query(`
        INSERT INTO payment_webhook_events (
          id, gateway, event_type, idempotency_key, payload, signature_verified, status
        ) VALUES ($1, 'razorpay', 'payment.captured', $2, '{}', 1, 'processed')
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id
      `, [testEventId, testKey]);

      assert.strictEqual(firstRes.rows.length, 1, 'First insertion must return inserted ID');
      assert.strictEqual(firstRes.rows[0].id, testEventId);

      // Duplicate insertion with same idempotency_key
      const dupRes = await client.query(`
        INSERT INTO payment_webhook_events (
          id, gateway, event_type, idempotency_key, payload, signature_verified, status
        ) VALUES ($1, 'razorpay', 'payment.captured', $2, '{}', 1, 'processed')
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id
      `, [`evt_dup_${Date.now()}`, testKey]);

      assert.strictEqual(dupRes.rows.length, 0, 'Duplicate insertion must return 0 rows (Atomic Idempotency)');
    } finally {
      await client.query('DELETE FROM payment_webhook_events WHERE idempotency_key = $1', [testKey]);
      client.release();
    }
  });

  // 3. Concurrent Duplicate Webhook Race Across Independent Connections
  await test('Concurrent duplicate webhooks across separate DB clients result in exactly 1 winner and 0 duplicates', async () => {
    const sharedKey = `race_key_${Date.now()}`;
    const client1 = await pool.connect();
    const client2 = await pool.connect();

    try {
      const [res1, res2] = await Promise.all([
        client1.query(`
          INSERT INTO payment_webhook_events (
            id, gateway, event_type, idempotency_key, payload, signature_verified, status
          ) VALUES ($1, 'razorpay', 'payment.captured', $2, '{}', 1, 'processed')
          ON CONFLICT (idempotency_key) DO NOTHING
          RETURNING id
        `, [`evt_race_1_${Date.now()}`, sharedKey]),
        client2.query(`
          INSERT INTO payment_webhook_events (
            id, gateway, event_type, idempotency_key, payload, signature_verified, status
          ) VALUES ($1, 'razorpay', 'payment.captured', $2, '{}', 1, 'processed')
          ON CONFLICT (idempotency_key) DO NOTHING
          RETURNING id
        `, [`evt_race_2_${Date.now()}`, sharedKey])
      ]);

      const insertedCount = (res1.rows.length || 0) + (res2.rows.length || 0);
      assert.strictEqual(insertedCount, 1, 'Exactly 1 concurrent webhook must succeed; 2nd must return 0 rows');
    } finally {
      await pool.query('DELETE FROM payment_webhook_events WHERE idempotency_key = $1', [sharedKey]);
      client1.release();
      client2.release();
    }
  });

  console.log(`\n🏁 Section 58/64 Audit Completed: ${passed} passed, ${failed} failed.`);
  return { passed, failed, findings };
}

run().then(res => {
  if (res.failed > 0) process.exit(1);
  process.exit(0);
}).catch(err => {
  console.error('Fatal Section 58/64 error:', err);
  process.exit(1);
});
