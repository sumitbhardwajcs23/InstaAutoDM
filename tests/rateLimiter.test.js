// tests/rateLimiter.test.js
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

process.env.NODE_ENV = 'test';
process.env.META_MOCK_MODE = 'true';

const assert = require('assert');
const express = require('express');
const rateLimit = require('express-rate-limit');
const authRouter = require('../backend/src/routes/auth');

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 Starting Rate Limiting & DoS Protection Tests');
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
      console.error(`     Error: ${err.message}\n${err.stack}`);
      failed++;
    }
  }

  // 1. Rate limiter triggers HTTP 429 when max threshold is reached
  await test('Rate limiter returns HTTP 429 when request threshold is exceeded', async () => {
    const app = express();
    const testLimiter = rateLimit({
      windowMs: 60000,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests' }
    });

    app.get('/test-limit', testLimiter, (_req, res) => res.json({ ok: true }));

    const server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/test-limit`;

    try {
      // 3 successful requests
      for (let i = 0; i < 3; i++) {
        const res = await fetch(url);
        assert.strictEqual(res.status, 200);
        assert(res.headers.has('ratelimit-limit'));
        assert(res.headers.has('ratelimit-remaining'));
      }

      // 4th request must be blocked
      const res4 = await fetch(url);
      assert.strictEqual(res4.status, 429, 'Exceeded request must receive HTTP 429');
      const body4 = await res4.json();
      assert.strictEqual(body4.error, 'Too many requests');
    } finally {
      server.close();
    }
  });

  // 2. Anti-enumeration: /api/auth/forgot-password returns uniform success message for unknown email
  await test('Forgot-password returns generic success response for non-existent email', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);

    const server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/api/auth/forgot-password`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `ghost_user_${Date.now()}@nonexistent.domain`
        })
      });

      assert.strictEqual(res.status, 200, 'Must return HTTP 200 rather than 404 to avoid email enumeration');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert(data.message.includes('If an account exists'), 'Must return uniform message');
    } finally {
      server.close();
    }
  });

  // 3. Payload size limiting rejects oversized requests (> 1MB) with HTTP 413
  await test('Payload size limiter rejects oversized bodies (> 1MB) with HTTP 413', async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.post('/test-payload', (req, res) => res.json({ size: req.body.length }));

    const server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/test-payload`;

    try {
      // Create 1.5 MB string
      const largeData = 'x'.repeat(1.5 * 1024 * 1024);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: largeData })
      });

      assert.strictEqual(res.status, 413, 'Oversized payload must receive HTTP 413');
    } finally {
      server.close();
    }
  });

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) process.exit(1);
}

runTests().then(() => {
  setTimeout(() => process.exit(0), 1000);
}).catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
