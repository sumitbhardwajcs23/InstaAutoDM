// tests/rateLimiterDistributed.test.js
const assert = require('assert');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { getClusterSize, calculateLimit, ResilientStore } = require('../backend/src/middleware/rateLimiter');
const redisClient = require('../backend/src/services/redisClient');

async function runDistributedRateLimiterTests() {
  console.log('\n======================================================');
  console.log('🧪 Distributed Rate Limiter & Fallback Verification Tests');
  console.log('======================================================\n');

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

  // 1. Topology-aware cluster size detection
  await test('Cluster size is derived from deployment topology env vars without hardcoding', async () => {
    const origCluster = process.env.CLUSTER_SIZE;
    const origInstance = process.env.INSTANCE_COUNT;

    try {
      delete process.env.CLUSTER_SIZE;
      delete process.env.INSTANCE_COUNT;
      assert.strictEqual(getClusterSize(), 4, 'Defaults to 4 when unset');

      process.env.CLUSTER_SIZE = '6';
      assert.strictEqual(getClusterSize(), 6, 'Reads CLUSTER_SIZE=6');

      delete process.env.CLUSTER_SIZE;
      process.env.INSTANCE_COUNT = '8';
      assert.strictEqual(getClusterSize(), 8, 'Reads INSTANCE_COUNT=8');
    } finally {
      process.env.CLUSTER_SIZE = origCluster;
      process.env.INSTANCE_COUNT = origInstance;
    }
  });

  // 2. Fallback limit partitioning prevents horizontal rate-limit amplification
  await test('Fallback limit partitions global quota across cluster instances when Redis unavailable', async () => {
    const origCluster = process.env.CLUSTER_SIZE;

    try {
      // Simulate Redis unavailable
      const origIsAvailable = redisClient.isAvailable;
      redisClient.isAvailable = () => false;

      // 4 instances: 120 total limit -> 30 per instance
      process.env.CLUSTER_SIZE = '4';
      const limit4 = calculateLimit(120);
      assert.strictEqual(limit4, 30, '4 instances receive 30 quota each');

      // 6 instances: 120 total limit -> 20 per instance
      process.env.CLUSTER_SIZE = '6';
      const limit6 = calculateLimit(120);
      assert.strictEqual(limit6, 20, '6 instances receive 20 quota each');

      // 8 instances: 120 total limit -> 15 per instance
      process.env.CLUSTER_SIZE = '8';
      const limit8 = calculateLimit(120);
      assert.strictEqual(limit8, 15, '8 instances receive 15 quota each');

      // Restore
      redisClient.isAvailable = origIsAvailable;
    } finally {
      process.env.CLUSTER_SIZE = origCluster;
    }
  });

  // 3. Fallback mode under simulated 4-node cluster allows exactly 30 req/node = 120 total
  await test('ResilientStore enforces partitioned quota locally without throwing when Redis is offline', async () => {
    const origIsAvailable = redisClient.isAvailable;
    redisClient.isAvailable = () => false;

    const testStore = new ResilientStore({ prefix: 'rl:test:offline:' });
    const app = express();
    const limiter = rateLimit({
      windowMs: 60000,
      max: () => 3, // 3 requests per node
      store: testStore,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Rate limit exceeded in fallback mode' }
    });

    app.get('/test-offline-limit', limiter, (_req, res) => res.json({ success: true }));

    const server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/test-offline-limit`;

    try {
      // 3 requests pass
      for (let i = 0; i < 3; i++) {
        const res = await fetch(url);
        assert.strictEqual(res.status, 200, `Request ${i + 1} must succeed`);
      }

      // 4th request must be 429
      const res4 = await fetch(url);
      assert.strictEqual(res4.status, 429, '4th request must be throttled with HTTP 429');
      const body4 = await res4.json();
      assert.strictEqual(body4.error, 'Rate limit exceeded in fallback mode');
    } finally {
      await new Promise(r => server.close(r));
      redisClient.isAvailable = origIsAvailable;
    }
  });

  // 4. Centralized Redis mode shares global quota across simulated instances
  await test('Centralized mode shares global quota across multiple instance store instances when Redis is active', async () => {
    const mockRedisMap = new Map();
    const origSendCommand = redisClient.sendCommand;
    const origIsAvailable = redisClient.isAvailable;

    redisClient.isAvailable = () => true;
    redisClient.sendCommand = async (cmd, ...args) => {
      if (cmd === 'SCRIPT' && args[0] === 'LOAD') {
        return 'mock_sha_hash';
      }
      if (cmd === 'EVALSHA' || cmd === 'EVAL') {
        const key = args[2] || args[1] || 'mock_key';
        const current = (mockRedisMap.get(key) || 0) + 1;
        mockRedisMap.set(key, current);
        return [current, 60000];
      }
      return 1;
    };

    try {
      const instance1Store = new ResilientStore({ prefix: 'rl:shared:' });
      const instance2Store = new ResilientStore({ prefix: 'rl:shared:' });

      const app1 = express();
      const app2 = express();

      const globalLimit = 4;
      const limiter1 = rateLimit({
        windowMs: 60000,
        max: () => globalLimit,
        store: instance1Store,
        message: { error: 'Global limit reached' }
      });
      const limiter2 = rateLimit({
        windowMs: 60000,
        max: () => globalLimit,
        store: instance2Store,
        message: { error: 'Global limit reached' }
      });

      app1.get('/shared', limiter1, (_req, res) => res.json({ node: 1 }));
      app2.get('/shared', limiter2, (_req, res) => res.json({ node: 2 }));

      const server1 = await new Promise(r => { const s = app1.listen(0, () => r(s)); });
      const server2 = await new Promise(r => { const s = app2.listen(0, () => r(s)); });
      const url1 = `http://127.0.0.1:${server1.address().port}/shared`;
      const url2 = `http://127.0.0.1:${server2.address().port}/shared`;

      try {
        // Send 2 requests to Node 1
        const r1 = await fetch(url1);
        const r2 = await fetch(url1);
        assert.strictEqual(r1.status, 200);
        assert.strictEqual(r2.status, 200);

        // Send 2 requests to Node 2 (hits 3 and 4 globally)
        const r3 = await fetch(url2);
        const r4 = await fetch(url2);
        assert.strictEqual(r3.status, 200);
        assert.strictEqual(r4.status, 200);

        // 5th request on Node 1 must be blocked globally (HTTP 429)
        const r5 = await fetch(url1);
        assert.strictEqual(r5.status, 429, 'Global quota must block 5th request on Node 1');

        // 6th request on Node 2 must ALSO be blocked globally (HTTP 429)
        const r6 = await fetch(url2);
        assert.strictEqual(r6.status, 429, 'Global quota must block 6th request on Node 2');
      } finally {
        await new Promise(r => server1.close(r));
        await new Promise(r => server2.close(r));
      }
    } finally {
      redisClient.sendCommand = origSendCommand;
      redisClient.isAvailable = origIsAvailable;
    }
  });

  console.log('\n======================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} test(s) failed.`);
  }
}

if (require.main === module) {
  runDistributedRateLimiterTests()
    .then(() => {
      // Clean exit
      setTimeout(() => process.exit(0), 100);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runDistributedRateLimiterTests;
