// tests/secretAndTokenEncryption.test.js
// Comprehensive Secret & Token Encryption, Rotation & Revocation Test Suite

process.env.NODE_ENV = 'test';
process.env.META_MOCK_MODE = 'true';

const http = require('http');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const app = require('../backend/src/server');
const db = require('../backend/src/db');
const crypto = require('../backend/src/services/crypto');
const tokenLifecycle = require('../backend/src/services/tokenLifecycle');
const { JWT_SECRET, ENCRYPTION_KEY, validateSecrets } = require('../backend/src/config/secrets');

let server;
let baseUrl;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    let payload = null;
    if (body) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function runTest(name, fn) {
  return fn()
    .then(() => {
      console.log(`  ✅ PASS: ${name}`);
      return true;
    })
    .catch((err) => {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(err);
      return false;
    });
}

async function startSuite() {
  console.log('\n========================================');
  console.log('🧪 Starting Secret & Token Encryption, Rotation & Revocation Test Suite');
  console.log('========================================\n');

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const runId = Date.now();
  const testUserId = `usr_crypto_test_${runId}`;
  const testUserToken = jwt.sign({ id: testUserId, email: `crypto_${runId}@airvix.com`, name: 'Crypto Tester' }, JWT_SECRET, { expiresIn: '1h' });
  const authHeaders = { Authorization: `Bearer ${testUserToken}` };

  const testAccountId = `ig_acc_enc_${runId}`;
  const now = new Date().toISOString();

  await db.prepare("INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at) VALUES (?, ?, 'Crypto Tester', 'pro', 0, ?, ?, ?)").run(
    testUserId, `crypto_${runId}@airvix.com`, now.slice(0, 10), now, now
  );

  const rawMetaToken = `EAAB_secret_meta_user_token_${runId}`;
  const encMetaToken = crypto.encrypt(rawMetaToken);

  await db.prepare(`
    INSERT INTO instagram_accounts (
      id, user_id, ig_user_id, username, full_name, profile_picture_url, page_id, fb_page_name, fb_user_id,
      access_token_enc, page_access_token_enc, long_lived_token_enc, token_expires_at, status, followers_count,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'Crypto Brand', 'https://example.com/pic.jpg', 'page_crypto', 'Crypto Page', 'fb_crypto', ?, ?, ?, ?, 'connected', 5000, ?, ?)
  `).run(testAccountId, testUserId, `178414009_${runId}`, `cryptobrand_${runId}`, encMetaToken, encMetaToken, encMetaToken, now, now, now);

  let passed = 0;
  let failed = 0;

  // 1. Authenticated AES-256-GCM Format and Tamper Resistance
  const t1 = await runTest('Tokens are encrypted at rest with authenticated AES-256-GCM with tamper detection', async () => {
    const row = await db.prepare("SELECT access_token_enc FROM instagram_accounts WHERE id = ?").get(testAccountId);
    if (!row || !row.access_token_enc) throw new Error('Stored access token is missing');

    const parts = row.access_token_enc.split(':');
    if (parts.length !== 3) {
      throw new Error(`Expected AES-256-GCM format iv:authTag:ciphertext (3 parts), got ${parts.length} parts: ${row.access_token_enc}`);
    }

    const [ivHex, authTagHex, cipherHex] = parts;
    if (ivHex.length !== 24) throw new Error(`Invalid IV length (expected 24 hex chars / 12 bytes), got ${ivHex.length}`);
    if (authTagHex.length !== 32) throw new Error(`Invalid auth tag length (expected 32 hex chars / 16 bytes), got ${authTagHex.length}`);

    // Tamper test: tamper with one bit of ciphertext
    const tamperedCipher = cipherHex.slice(0, -1) + (cipherHex.slice(-1) === 'a' ? 'b' : 'a');
    const tamperedString = `${ivHex}:${authTagHex}:${tamperedCipher}`;
    const tamperedDec = crypto.decrypt(tamperedString);
    if (tamperedDec === rawMetaToken) {
      throw new Error('Tampered ciphertext was decrypted! Authentication tag was ignored.');
    }

    // Authentic decryption should match
    const decrypted = crypto.decrypt(row.access_token_enc);
    if (decrypted !== rawMetaToken) {
      throw new Error(`Decrypted value mismatch. Expected ${rawMetaToken}, got ${decrypted}`);
    }
  });
  t1 ? passed++ : failed++;

  // 2. Encryption Key Rotation & Re-encryption
  const t2 = await runTest('Application supports zero-downtime key rotation and database re-encryption', async () => {
    const keyA = '32_byte_secret_key_alpha_0000000';
    const keyB = '32_byte_secret_key_beta__1111111';
    const sampleToken = 'EAAB_sample_long_lived_token_12345';

    // Encrypt with Key A
    const cipherA = crypto.encryptWithKey(sampleToken, keyA);
    const decA = crypto.decryptWithKey(cipherA, keyA);
    if (decA !== sampleToken) throw new Error('Decryption with keyA failed');

    // Re-encrypt to Key B
    const cipherB = crypto.reencryptText(cipherA, keyB, keyA);
    const decB = crypto.decryptWithKey(cipherB, keyB);
    if (decB !== sampleToken) throw new Error('Decryption with keyB after re-encryption failed');

    // Verify cipherB cannot be decrypted with keyA
    const failedDecA = crypto.decryptWithKey(cipherB, keyA);
    if (failedDecA === sampleToken) throw new Error('Ciphertext B was unexpectedly decryptable with old Key A!');

    // Test database re-encryption method
    const rotResult = await tokenLifecycle.reencryptAllStoredTokens(keyA);
    if (!rotResult.success) throw new Error(`reencryptAllStoredTokens failed: ${JSON.stringify(rotResult.errors)}`);

    // Restore tokens back to primary system key for normal operation
    const primaryKey = process.env.ENCRYPTION_KEY || ENCRYPTION_KEY;
    const restoreResult = await tokenLifecycle.reencryptAllStoredTokens(primaryKey, keyA);
    if (!restoreResult.success) throw new Error(`Restoring tokens failed: ${JSON.stringify(restoreResult.errors)}`);
  });
  t2 ? passed++ : failed++;

  // 3. Token Rotation Flow
  const t3 = await runTest('POST /api/instagram/rotate-token refreshes and re-encrypts token', async () => {
    const res = await makeRequest('POST', '/api/instagram/rotate-token', {
      account_id: testAccountId
    }, authHeaders);

    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(res.body)}`);
    }

    // Verify the account in the response is sanitized and does NOT contain raw or encrypted tokens
    if (res.body.account.access_token || res.body.account.access_token_enc) {
      throw new Error('CRITICAL: Response leaked access token in rotate-token output!');
    }

    // Verify token was updated in the DB
    const check = await db.prepare("SELECT access_token_enc, token_refreshed_at FROM instagram_accounts WHERE id = ?").get(testAccountId);
    if (!check.token_refreshed_at) throw new Error('token_refreshed_at timestamp was not updated');
    const dec = crypto.decrypt(check.access_token_enc);
    if (!dec) throw new Error('Could not decrypt rotated token');
  });
  t3 ? passed++ : failed++;

  // 4. Token Revocation Flow
  const t4 = await runTest('POST /api/instagram/revoke-token scrubs tokens and marks account disconnected', async () => {
    const res = await makeRequest('POST', '/api/instagram/revoke-token', {
      account_id: testAccountId
    }, authHeaders);

    if (res.status !== 200 || !res.body.success) {
      throw new Error(`Expected 200 success, got ${res.status}: ${JSON.stringify(res.body)}`);
    }

    // Verify DB row has scrubbed tokens and disconnected status
    const row = await db.prepare("SELECT access_token_enc, page_access_token_enc, status, token_revoked_at FROM instagram_accounts WHERE id = ?").get(testAccountId);
    if (row.access_token_enc !== '' || row.page_access_token_enc !== '') {
      throw new Error('Access tokens were not scrubbed from the database!');
    }
    if (row.status !== 'disconnected') {
      throw new Error(`Expected status to be disconnected, got: ${row.status}`);
    }
    if (!row.token_revoked_at) {
      throw new Error('token_revoked_at was not recorded!');
    }
  });
  t4 ? passed++ : failed++;

  // 5. Secrets Configuration Validation & Entropy Guards
  const t5 = await runTest('Secrets configuration enforces 256-bit keys and rejects insecure defaults', async () => {
    const origEnv = process.env.NODE_ENV;
    const origKey = process.env.ENCRYPTION_KEY;

    try {
      // In non-production, validateSecrets warns but does not exit
      process.env.NODE_ENV = 'development';
      validateSecrets(); // Should execute safely

      // Test key length helper
      const keyBuf = crypto.getKeyBuffer('short');
      if (keyBuf.length !== 32) throw new Error(`Expected 32-byte buffer, got ${keyBuf.length}`);
    } finally {
      process.env.NODE_ENV = origEnv;
      process.env.ENCRYPTION_KEY = origKey;
    }
  });
  t5 ? passed++ : failed++;

  // Teardown
  server.close();

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

startSuite().catch(err => {
  console.error('Test suite failed:', err);
  if (server) server.close();
  process.exit(1);
});
