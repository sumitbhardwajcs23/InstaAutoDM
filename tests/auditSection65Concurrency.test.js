/**
 * AIRVIX AUDIT SUITE: Section 65 — Concurrency, Pool Health & Deadlock Stress
 * Tests:
 * 1. 20 concurrent usage increments (testing atomic counter accuracy & race conditions)
 * 2. High-concurrency connection pool acquisition & release (pool starvation test)
 * 3. Concurrent transaction isolation (atomic rollback on error)
 * 4. Latency benchmarks (P50, P95, P99 query response times)
 */
const assert = require('assert');
const db = require('../backend/src/db');

async function run() {
  console.log('🧪 Starting Section 65 Audit: Concurrency, Pool Health & Deadlocks...\n');
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

  const testUserId = `usr_conc_${Date.now()}`;

  try {
    // Setup fixture
    await pool.query(`
      INSERT INTO users (id, email, name, plan, status, dm_usage_this_period, usage_period_start)
      VALUES ($1, $2, 'Concurrency Tester', 'pro', 'active', 0, to_char(NOW(), 'YYYY-MM-DD'))
    `, [testUserId, `concurrency_${Date.now()}@test.local`]);

    // 1. Atomic Usage Increment Under 20 Simultaneous Requests
    await test('20 concurrent usage increments execute atomically with zero lost updates', async () => {
      const concurrency = 20;
      const promises = [];

      for (let i = 0; i < concurrency; i++) {
        promises.push(
          pool.query('UPDATE users SET dm_usage_this_period = dm_usage_this_period + 1 WHERE id = $1', [testUserId])
        );
      }

      await Promise.all(promises);

      const checkRes = await pool.query('SELECT dm_usage_this_period FROM users WHERE id = $1', [testUserId]);
      const finalCount = checkRes.rows[0].dm_usage_this_period;

      assert.strictEqual(finalCount, concurrency, `Expected exactly ${concurrency} increments, got ${finalCount}`);
    });

    // 2. High-Concurrency Pool Acquisition & Stress
    await test('Acquires and releases 15 concurrent clients without pool exhaustion', async () => {
      const clientCount = 15;
      const clients = await Promise.all(
        Array.from({ length: clientCount }, () => pool.connect())
      );

      assert.strictEqual(clients.length, clientCount);

      // Run parallel lightweight query
      const queryResults = await Promise.all(
        clients.map(c => c.query('SELECT 1 as num'))
      );

      for (const q of queryResults) {
        assert.strictEqual(q.rows[0].num, 1);
      }

      // Release all clients
      for (const c of clients) {
        c.release();
      }
    });

    // 3. Transaction Rollback Atomicity
    await test('Failed transaction rolls back completely with zero partial state persistence', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE users SET name = $1 WHERE id = $2', ['Temp Name Rollback', testUserId]);
        
        // Force syntax error to trigger rollback
        try {
          await client.query('INVALID SQL STATEMENT HERE');
        } catch (e) {
          await client.query('ROLLBACK');
        }

        const userAfter = await pool.query('SELECT name FROM users WHERE id = $1', [testUserId]);
        assert.strictEqual(userAfter.rows[0].name, 'Concurrency Tester', 'Name must not have changed after rollback');
      } finally {
        client.release();
      }
    });

    // 4. Latency Benchmark Percentiles (P50, P95, P99)
    await test('Measures DB query latency percentiles over 50 rapid sequential queries', async () => {
      const sampleCount = 50;
      const latencies = [];

      for (let i = 0; i < sampleCount; i++) {
        const start = process.hrtime.bigint();
        await pool.query('SELECT id, plan FROM users WHERE id = $1', [testUserId]);
        const end = process.hrtime.bigint();
        latencies.push(Number(end - start) / 1e6); // convert to ms
      }

      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(sampleCount * 0.50)].toFixed(2);
      const p95 = latencies[Math.floor(sampleCount * 0.95)].toFixed(2);
      const p99 = latencies[Math.floor(sampleCount * 0.99)].toFixed(2);

      console.log(`     📊 Latency Percentiles (Neon PG): P50=${p50}ms | P95=${p95}ms | P99=${p99}ms`);
      assert.ok(parseFloat(p50) < 500, 'P50 must be reasonable for remote serverless PG');
    });

  } finally {
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]).catch(() => {});
  }

  console.log(`\n🏁 Section 65 Audit Completed: ${passed} passed, ${failed} failed.`);
  return { passed, failed, findings };
}

run().then(res => {
  if (res.failed > 0) process.exit(1);
  process.exit(0);
}).catch(err => {
  console.error('Fatal Section 65 error:', err);
  process.exit(1);
});
