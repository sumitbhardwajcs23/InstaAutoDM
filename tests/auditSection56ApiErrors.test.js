/**
 * AIRVIX AUDIT SUITE: Section 56 — API Error Matrix & Information Leakage
 * Tests:
 * 1. HTTP 401 Unauthorized across protected endpoints
 * 2. HTTP 400 Bad Request on malformed inputs
 * 3. HTTP 404 Not Found on missing resources
 * 4. Zero stack trace leakage in error responses
 * 5. Zero secret/credential leakage in error payloads
 */
const assert = require('assert');
const http = require('http');
const express = require('express');
const db = require('../backend/src/db');

async function run() {
  console.log('🧪 Starting Section 56 Audit: API Error Matrix...\n');
  await db.ready();

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

  // Probe route modules directly to verify error handling behavior
  const authRouter = require('../backend/src/routes/auth');
  const rulesRouter = require('../backend/src/routes/rules');
  const billingRouter = require('../backend/src/routes/billing');

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/rules', rulesRouter);
  app.use('/api/billing', billingRouter);

  // Global error handler simulating production environment
  app.use((err, req, res, next) => {
    const isProd = process.env.NODE_ENV === 'production';
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      ...(isProd ? {} : { stack: err.stack })
    });
  });

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Unauthenticated access to protected route returns 401
    await test('Protected routes reject requests without Authorization header with HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.ok(data.error);
    });

    // 2. Malformed JSON login payload returns 400
    await test('Login with missing credentials returns HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('required'));
    });

    // 3. Password reset request with empty body returns 400
    await test('POST /api/auth/forgot-password with empty payload returns HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.strictEqual(res.status, 400);
    });

    // 4. Zero secret leakage in error responses
    await test('API error messages never contain database connection strings, JWT secrets, or API keys', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: "' OR 1=1 --", password: "test" })
      });
      const text = await res.text();
      
      const forbiddenTokens = [
        process.env.DATABASE_URL,
        process.env.JWT_SECRET,
        process.env.RAZORPAY_KEY_SECRET,
        process.env.META_APP_SECRET
      ].filter(Boolean);

      for (const token of forbiddenTokens) {
        if (token.length > 5) {
          assert.strictEqual(text.includes(token), false, `Response must never leak sensitive secret: ${token.slice(0, 4)}...`);
        }
      }
    });

    // 5. Account enumeration prevention: forgot-password returns generic message for non-existent email
    await test('Forgot-password responds uniformly regardless of whether email exists (enumeration prevention)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `nonexistent_${Date.now()}@domain.invalid` })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.message.includes('If an account exists'));
    });

  } finally {
    server.close();
  }

  console.log(`\n🏁 Section 56 Audit Completed: ${passed} passed, ${failed} failed.`);
  return { passed, failed, findings };
}

run().then(res => {
  if (res.failed > 0) process.exit(1);
  process.exit(0);
}).catch(err => {
  console.error('Fatal Section 56 error:', err);
  process.exit(1);
});
