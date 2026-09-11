// tests/securityAudit.test.js
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

process.env.NODE_ENV = 'test';
process.env.META_MOCK_MODE = 'true';

const assert = require('assert');
const crypto = require('crypto');
const express = require('express');
const { encrypt, decrypt, verifyMetaSignature, generateMetaSignature } = require('../backend/src/services/crypto');
const { validateSecrets, REQUIRED_SECRETS } = require('../backend/src/config/secrets');
const webhooksRouter = require('../backend/src/routes/webhooks');

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 Starting Database Security & Webhook Audit Fix Tests');
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

  // 1. AES-256-GCM authenticated encryption output format
  await test('AES-256-GCM produces 3-part iv:authTag:ciphertext and decrypts accurately', () => {
    const original = 'EAABwdN_test_secret_access_token_instagram_98765';
    const encrypted = encrypt(original);

    const parts = encrypted.split(':');
    assert.strictEqual(parts.length, 3, 'GCM output must have exactly 3 parts (iv:authTag:ciphertext)');
    assert.strictEqual(parts[0].length, 24, 'IV should be 12 bytes = 24 hex characters');
    assert.strictEqual(parts[1].length, 32, 'AuthTag should be 16 bytes = 32 hex characters');

    const decrypted = decrypt(encrypted);
    assert.strictEqual(decrypted, original, 'Decrypted text must match original');
  });

  // 2. AES-256-GCM tamper detection
  await test('AES-256-GCM tamper detection catches bit flips in ciphertext or auth tag', () => {
    const original = 'super_secret_payload_for_integrity_verification';
    const encrypted = encrypt(original);
    const [iv, authTag, ciphertext] = encrypted.split(':');

    // Tamper with ciphertext by flipping a character
    const tamperedChar = ciphertext[0] === 'a' ? 'b' : 'a';
    const tamperedCiphertext = tamperedChar + ciphertext.slice(1);
    const tamperedPayload = `${iv}:${authTag}:${tamperedCiphertext}`;

    const decryptedTampered = decrypt(tamperedPayload);
    assert.notStrictEqual(decryptedTampered, original, 'Tampered ciphertext must not decrypt to original payload');
    assert.strictEqual(decryptedTampered, tamperedPayload, 'Failed GCM decryption must fall back cleanly without corrupted plaintext');
  });

  // 3. Backward compatibility with legacy AES-256-CBC 2-part ciphertext
  await test('Legacy AES-256-CBC 2-part ciphertext decrypts successfully for existing DB rows', () => {
    const originalToken = 'EAABwdN_legacy_token_from_older_schema';
    const keyStr = process.env.ENCRYPTION_KEY || 'dev_insecure_encryption_key_32b';
    const keyBuf = Buffer.alloc(32);
    Buffer.from(keyStr).copy(keyBuf, 0, 0, Math.min(32, Buffer.byteLength(keyStr)));

    // Create legacy 2-part CBC ciphertext
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, iv);
    let legacyEnc = cipher.update(originalToken, 'utf8', 'hex');
    legacyEnc += cipher.final('hex');
    const legacyCiphertext = `${iv.toString('hex')}:${legacyEnc}`;

    assert.strictEqual(legacyCiphertext.split(':').length, 2, 'Legacy format must have 2 parts');
    const decryptedLegacy = decrypt(legacyCiphertext);
    assert.strictEqual(decryptedLegacy, originalToken, 'Legacy CBC token must successfully decrypt');
  });

  // 4. Webhook signature enforcement
  await test('Webhook endpoint rejects requests with missing or invalid signature', async () => {
    const app = express();
    app.use(express.json({
      verify: (req, _res, buf) => { req.rawBody = buf; }
    }));
    app.use('/webhooks', webhooksRouter);

    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/webhooks/instagram`;

    const secret = process.env.META_APP_SECRET || 'test_app_secret_12345';
    const testPayload = { object: 'instagram', entry: [] };
    const rawPayload = JSON.stringify(testPayload);

    try {
      // 1. Missing signature
      const resMissing = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawPayload
      });
      assert.strictEqual(resMissing.status, 401, 'Request without signature must return 401');

      // 2. Invalid signature
      const resInvalid = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-hub-signature-256': 'sha256=invalid1234567890abcdef'
        },
        body: rawPayload
      });
      assert.strictEqual(resInvalid.status, 401, 'Request with invalid signature must return 401');

      // 3. Valid signature
      const validSignature = generateMetaSignature(rawPayload, secret);
      const resValid = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-hub-signature-256': validSignature
        },
        body: rawPayload
      });
      assert.strictEqual(resValid.status, 200, 'Request with valid signature must return 200');
    } finally {
      server.close();
    }
  });

  // 5. Secret validation lists required secrets
  await test('validateSecrets includes all 4 critical security secrets', () => {
    assert(REQUIRED_SECRETS.includes('JWT_SECRET'));
    assert(REQUIRED_SECRETS.includes('ENCRYPTION_KEY'));
    assert(REQUIRED_SECRETS.includes('META_APP_SECRET'));
    assert(REQUIRED_SECRETS.includes('META_VERIFY_TOKEN'));
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
