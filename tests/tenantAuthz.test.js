// tests/tenantAuthz.test.js
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

process.env.NODE_ENV = 'test';
process.env.META_MOCK_MODE = 'true';

const assert = require('assert');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../backend/src/db');
const { makeToken } = require('../backend/src/middleware/auth');
const authRouter = require('../backend/src/routes/auth');
const instagramRouter = require('../backend/src/routes/instagram');

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 Starting Tenant-Level Authorization Tests');
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

  // Set up test server
  const app = express();
  app.use(express.json());

  // Test auth mock middleware for instagram router
  let mockUser = null;
  app.use((req, _res, next) => {
    if (mockUser) req.user = mockUser;
    next();
  });

  app.use('/api/auth', authRouter);
  app.use('/api/instagram', instagramRouter);

  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Test Instagram account reconnect ownership protection (Finding 4.3)
    await test('Reconnecting existing Instagram account from different tenant returns HTTP 409', async () => {
      const tenantAId = uuidv4();
      const tenantBId = uuidv4();
      const sharedIgUserId = 'ig_conflict_' + Date.now();
      const sharedPageId = 'page_conflict_' + Date.now();

      // Seed Tenant A and their IG account in DB
      await db.prepare(`
        INSERT INTO users (id, email, name, plan, role, status, usage_period_start)
        VALUES (?, ?, 'Tenant A', 'pro', 'user', 'active', date('now'))
      `).run(tenantAId, `tenant_a_${Date.now()}@example.com`);

      await db.prepare(`
        INSERT INTO users (id, email, name, plan, role, status, usage_period_start)
        VALUES (?, ?, 'Tenant B', 'pro', 'user', 'active', date('now'))
      `).run(tenantBId, `tenant_b_${Date.now()}@example.com`);

      const igAccId = uuidv4();
      await db.prepare(`
        INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, page_id, access_token_enc, status)
        VALUES (?, ?, ?, 'brand_official', ?, 'enc_tok_mock', 'connected')
      `).run(igAccId, tenantAId, sharedIgUserId, sharedPageId);

      // Stub metaClient.exchangeUserToken to return this account's details
      const metaClient = require('../backend/src/services/metaClient');
      const origExchange = metaClient.exchangeUserToken;
      metaClient.exchangeUserToken = async () => ({
        access_token: 'mock_page_token',
        page_access_token: 'mock_page_token',
        long_lived_token: 'mock_long_token',
        page_id: sharedPageId,
        page_name: 'Brand Official Page',
        fb_user_id: sharedPageId,
        ig_user_id: sharedIgUserId,
        username: 'brand_official',
        followers_count: 1000,
        expires_in: 5184000
      });

      try {
        // Now Tenant B attempts to connect the same Instagram account via connect-token
        mockUser = { id: tenantBId, email: `tenant_b_${Date.now()}@example.com` };

        const res = await fetch(`${baseUrl}/api/instagram/connect-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: 'EAAB_test_mock_token',
            ig_user_id: sharedIgUserId,
            page_id: sharedPageId,
            username: 'brand_official'
          })
        });

        assert.strictEqual(res.status, 409, 'Must return HTTP 409 Conflict when account belongs to another tenant');
        const data = await res.json();
        assert(data.error.includes('already connected to another'), 'Must return ownership error');

        // Verify DB row was NOT reassigned to Tenant B
        const checkAcc = await db.prepare('SELECT user_id FROM instagram_accounts WHERE id = ?').get(igAccId);
        assert.strictEqual(checkAcc.user_id, tenantAId, 'Account user_id must remain Tenant A');
      } finally {
        metaClient.exchangeUserToken = origExchange;
      }
    });

    // 2. Test forgot-password token generation & uniform response (Finding 4.4)
    let generatedResetToken = null;
    const testResetUserEmail = `target_user_${Date.now()}@domain.local`;
    const testResetUserId = uuidv4();

    await test('Forgot-password returns uniform response and generates secure token in DB', async () => {
      const initialHash = await bcrypt.hash('OldPassword123!', 10);
      await db.prepare(`
        INSERT INTO users (id, email, name, plan, role, status, password_hash, usage_period_start)
        VALUES (?, ?, 'Target User', 'free', 'user', 'active', ?, date('now'))
      `).run(testResetUserId, testResetUserEmail, initialHash);

      // Request token
      const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testResetUserEmail })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert(data.message.includes('If an account exists'));
      assert(data.dev_token, 'Should return dev_token in non-production test mode');
      generatedResetToken = data.dev_token;

      // Verify token in DB
      const resetRecord = await db.prepare('SELECT * FROM password_resets WHERE user_id = ?').get(testResetUserId);
      assert(resetRecord, 'Password reset record must exist in DB');
      assert.strictEqual(resetRecord.used, 0);
    });

    // 3. Test reset-password with invalid token (Finding 4.4)
    await test('Reset-password rejects invalid or non-existent token with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'invalid_fake_reset_token_0000000000000000000000000000000000000000',
          newPassword: 'BrandNewPassword123'
        })
      });

      assert.strictEqual(res.status, 400, 'Invalid token must be rejected with HTTP 400');
    });

    // 4. Test reset-password with valid token (Finding 4.4)
    await test('Reset-password updates password and marks token as used', async () => {
      assert(generatedResetToken, 'Need valid generated token');

      const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: generatedResetToken,
          newPassword: 'BrandNewPassword123'
        })
      });

      assert.strictEqual(res.status, 200, 'Valid token must succeed');
      const data = await res.json();
      assert.strictEqual(data.success, true);

      // Verify user password hash was updated
      const updatedUser = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(testResetUserId);
      const isValid = await bcrypt.compare('BrandNewPassword123', updatedUser.password_hash);
      assert.strictEqual(isValid, true, 'User must be able to verify new password');

      // Verify token marked used
      const usedRecord = await db.prepare('SELECT used FROM password_resets WHERE user_id = ?').get(testResetUserId);
      assert.strictEqual(usedRecord.used, 1, 'Token must be marked used');
    });

    // 5. Test token replay rejection
    await test('Replaying an already-used reset token is rejected with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: generatedResetToken,
          newPassword: 'AnotherPassword999'
        })
      });

      assert.strictEqual(res.status, 400, 'Replayed token must be rejected with HTTP 400');
    });
  } finally {
    server.close();
  }

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
