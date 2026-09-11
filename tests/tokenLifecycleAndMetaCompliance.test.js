// tests/tokenLifecycleAndMetaCompliance.test.js
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
const {
  encrypt,
  decrypt,
  parseSignedRequest,
  createSignedRequest
} = require('../backend/src/services/crypto');
const tokenLifecycle = require('../backend/src/services/tokenLifecycle');

async function waitFor(predicate, timeoutMs = 12000, intervalMs = 100) {
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
  console.log('🧪 Starting Token Lifecycle & Meta Compliance Tests');
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

  // Allow Neon PostgreSQL background migrations to settle and ensure columns exist
  await new Promise(r => setTimeout(r, 2000));
  if (db.getPgPool && db.getPgPool()) {
    const pool = db.getPgPool();
    await pool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS token_refreshed_at TEXT;').catch(() => {});
    await pool.query("ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS token_type TEXT DEFAULT 'ig_long_lived';").catch(() => {});
    await pool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS last_auth_error TEXT;').catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS data_deletion_requests (
        id VARCHAR(64) PRIMARY KEY,
        confirmation_code VARCHAR(128) UNIQUE NOT NULL,
        user_id VARCHAR(64),
        account_id VARCHAR(128),
        status VARCHAR(32) DEFAULT 'pending',
        details TEXT,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );
    `).catch(() => {});
  }

  const appSecret = process.env.META_APP_SECRET;

  // 1. Meta signed_request parsing and verification
  await test('parseSignedRequest verifies valid HMAC signature and rejects tampered payload', () => {
    const originalPayload = { user_id: 'meta_user_998877', algorithm: 'HMAC-SHA256' };
    const signedRequest = createSignedRequest(originalPayload, appSecret);

    const parsed = parseSignedRequest(signedRequest, appSecret);
    assert(parsed, 'Parsed object must exist');
    assert.strictEqual(parsed.user_id, 'meta_user_998877');

    // Tamper payload
    const tampered = signedRequest.slice(0, -4) + 'AAAA';
    const tamperedResult = parseSignedRequest(tampered, appSecret);
    assert.strictEqual(tamperedResult, null, 'Tampered signed_request must return null');

    // Invalid secret
    const invalidSecretResult = parseSignedRequest(signedRequest, 'wrong_secret_key');
    assert.strictEqual(invalidSecretResult, null, 'Verification with wrong secret must fail');
  });

  // 2. Token Lifecycle: Successful proactive token refresh for expiring tokens
  await test('refreshTokenForAccount successfully refreshes token and extends token_expires_at by 60 days', async () => {
    const userId = uuidv4();
    const accountId = uuidv4();
    const igUserId = 'ig_lifecycle_' + uuidv4().slice(0, 8);

    await db.prepare(`
      INSERT INTO users (id, email, plan, dm_usage_this_period, usage_period_start)
      VALUES (?, ?, 'pro', 0, date('now'))
    `).run(userId, `user_lifecycle_${Date.now()}@example.com`);

    // Create an account with a token expiring in 5 days (< 15 days threshold)
    const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
    await db.prepare(`
      INSERT INTO instagram_accounts (
        id, user_id, ig_user_id, username, page_id, access_token_enc, token_expires_at, status
      ) VALUES (?, ?, ?, 'creator_expiring', '1092837465', ?, ?, 'connected')
    `).run(accountId, userId, igUserId, encrypt('valid_mock_token_abc123'), fiveDaysFromNow);

    const account = await db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(accountId);
    const result = await tokenLifecycle.refreshTokenForAccount(account);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.refreshed, true);

    const updatedAccount = await db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(accountId);
    assert(updatedAccount.token_expires_at, 'New expiration must be set');
    assert(new Date(updatedAccount.token_expires_at).getTime() > Date.now() + 50 * 24 * 3600 * 1000, 'Expiration must extend ~60 days');
    assert(updatedAccount.token_refreshed_at !== null, 'token_refreshed_at must be populated');
    assert.strictEqual(updatedAccount.status, 'connected');
  });

  // 3. Token Lifecycle: Detection of revoked or expired tokens sets reauth_required
  await test('refreshTokenForAccount marks account as reauth_required when token is revoked/expired', async () => {
    const userId = uuidv4();
    const accountId = uuidv4();
    const igUserId = 'ig_revoked_' + uuidv4().slice(0, 8);

    await db.prepare(`
      INSERT INTO users (id, email, plan, dm_usage_this_period, usage_period_start)
      VALUES (?, ?, 'pro', 0, date('now'))
    `).run(userId, `user_revoked_${Date.now()}@example.com`);

    // Encrypt token with 'revoked' in string to trigger error simulation
    await db.prepare(`
      INSERT INTO instagram_accounts (
        id, user_id, ig_user_id, username, page_id, access_token_enc, status
      ) VALUES (?, ?, ?, 'creator_revoked', '1092837465', ?, 'connected')
    `).run(accountId, userId, igUserId, encrypt('revoked_meta_token_xyz'));

    const account = await db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(accountId);
    const result = await tokenLifecycle.refreshTokenForAccount(account);

    assert.strictEqual(result.success, false);

    const updatedAccount = await db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(accountId);
    assert.strictEqual(updatedAccount.status, 'reauth_required', 'Account status must transition to reauth_required');
    assert(updatedAccount.last_auth_error, 'last_auth_error must contain error reason');
  });

  // 4. Meta Data Deletion Callback execution & persistent audit logging
  await test('Data deletion callback purges connected account data and issues valid confirmation code', async () => {
    const userId = uuidv4();
    const accountId = uuidv4();
    const metaUserId = 'meta_del_' + uuidv4().slice(0, 10);

    await db.prepare(`
      INSERT INTO users (id, email, plan, dm_usage_this_period, usage_period_start)
      VALUES (?, ?, 'agency', 0, date('now'))
    `).run(userId, `user_del_${Date.now()}@example.com`);

    await db.prepare(`
      INSERT INTO instagram_accounts (
        id, user_id, ig_user_id, username, page_id, access_token_enc, status
      ) VALUES (?, ?, ?, 'delete_me_account', '1092837465', ?, 'connected')
    `).run(accountId, userId, metaUserId, encrypt('token_to_purge'));

    // Create an automation rule associated with this account
    const ruleId = uuidv4();
    await db.prepare(`
      INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, match_mode, reply_message)
      VALUES (?, ?, 'comment_to_dm', 'DELETE_RULE', 'exact', 'test reply')
    `).run(ruleId, accountId);

    // Generate signed_request for this metaUserId
    const signedRequest = createSignedRequest({ user_id: metaUserId }, appSecret);

    // Run test server with express
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api/instagram', require('../backend/src/routes/instagram'));

    const server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;

    try {
      const resp = await fetch(`http://127.0.0.1:${port}/api/instagram/data-deletion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_request: signedRequest })
      });
      const body = await resp.json();

      assert.strictEqual(resp.status, 200);
      assert(body.url, 'Response must include status URL');
      assert(body.confirmation_code, 'Response must include confirmation_code');
      assert(body.confirmation_code.startsWith('DEL-CONFIRM-'));

      // Verify account was purged
      const deletedAccount = await db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(accountId);
      assert.strictEqual(deletedAccount, undefined, 'Account must be deleted');

      // Verify rule cascaded
      const deletedRule = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(ruleId);
      assert.strictEqual(deletedRule, undefined, 'Associated rules must be cascade-deleted');

      // Verify database audit record exists in data_deletion_requests
      const deletionRecord = await db.prepare('SELECT * FROM data_deletion_requests WHERE confirmation_code = ?').get(body.confirmation_code);
      assert(deletionRecord, 'Audit record in data_deletion_requests must exist');
      assert.strictEqual(deletionRecord.status, 'completed');
      assert.strictEqual(deletionRecord.account_id, metaUserId);
    } finally {
      server.close();
    }
  });

  // 5. Data Deletion Status Endpoint returns persistent database record
  await test('GET /data-deletion-status returns verified audit record', async () => {
    const confirmationCode = `DEL-CONFIRM-TEST-${Date.now()}`;
    const reqId = uuidv4();

    await db.prepare(`
      INSERT INTO data_deletion_requests (
        id, confirmation_code, user_id, account_id, status, details, requested_at, completed_at
      ) VALUES (?, ?, 'user_99', 'meta_99', 'completed', 'Audit verified', datetime('now'), datetime('now'))
    `).run(reqId, confirmationCode);

    const express = require('express');
    const app = express();
    app.use('/api/instagram', require('../backend/src/routes/instagram'));

    const server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;

    try {
      const resp = await fetch(`http://127.0.0.1:${port}/api/instagram/data-deletion-status?id=${confirmationCode}`);
      const body = await resp.json();

      assert.strictEqual(resp.status, 200);
      assert.strictEqual(body.confirmation_code, confirmationCode);
      assert.strictEqual(body.status, 'completed');
    } finally {
      server.close();
    }
  });

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    if (db.getPgPool && db.getPgPool()) {
      try { await db.getPgPool().end(); } catch (e) {}
    }
    setTimeout(() => process.exit(0), 100);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
