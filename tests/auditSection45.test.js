/**
 * AIRVIX AUDIT SUITE: Section 45 — Account Recovery & Data Lifecycle
 * Tests forgot password, reset token lifecycle, session invalidation,
 * data export (GDPR Art. 20), account deletion (GDPR Art. 17), and pending jobs.
 */
const assert = require('assert');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../backend/src/db');
const { createOtpToken, verifyOtpToken } = require('../backend/src/utils/otp');
const { createUserSession, revokeUserSession } = require('../backend/src/services/authService');
const { DataRetentionService } = require('../backend/src/services/dataRetention');

async function run() {
  console.log('🧪 Starting Section 45 Audit: Account Recovery & Data Lifecycle...\n');
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

  const testUserId = `usr_audit_sec45_${Date.now()}`;
  const testEmail = `audit_sec45_${Date.now()}@airvix-test.local`;
  const initialPassword = 'Password123!Secure';

  try {
    // Setup isolated user fixture
    const pwdHash = await bcrypt.hash(initialPassword, 10);
    await pool.query(`
      INSERT INTO users (id, email, name, password_hash, role, plan, status, email_verified, dm_usage_this_period, usage_period_start)
      VALUES ($1, $2, 'Sec45 Auditor', $3, 'user', 'free', 'active', 1, 0, to_char(NOW(), 'YYYY-MM-DD'))
    `, [testUserId, testEmail, pwdHash]);

    // 1. Password Reset OTP Generation & Hashing
    await test('Forgot password generates secure hashed OTP token with TTL', async () => {
      const { rawOtp, expiresAt } = await createOtpToken({
        email: testEmail,
        purpose: 'password_reset',
        ttlMinutes: 10
      });
      assert.strictEqual(typeof rawOtp, 'string');
      assert.strictEqual(rawOtp.length, 6);
      assert.ok(new Date(expiresAt) > new Date());

      // Verify OTP stored in DB is hashed, not plaintext
      const dbRow = await pool.query(
        'SELECT otp_hash FROM otp_tokens WHERE email = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1',
        [testEmail, 'password_reset']
      );
      assert.ok(dbRow.rows.length > 0);
      assert.notStrictEqual(dbRow.rows[0].otp_hash, rawOtp, 'OTP in database must be hashed, never plaintext');
    });

    // 2. OTP Token Verification with Wrong Code (Attempt Increment & Max Attempts)
    await test('Wrong OTP code increments attempt counter and rejects', async () => {
      const wrongResult = await verifyOtpToken({
        email: testEmail,
        purpose: 'password_reset',
        otp: '000000'
      });
      assert.strictEqual(wrongResult.valid, false);

      const dbRow = await pool.query(
        'SELECT attempts FROM otp_tokens WHERE email = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1',
        [testEmail, 'password_reset']
      );
      assert.ok(dbRow.rows[0].attempts >= 1, 'Attempts must be incremented');
    });

    // 3. Valid OTP Consumption & Replay Prevention
    await test('Valid OTP code succeeds and marks token consumed (Replay prevention)', async () => {
      const { rawOtp } = await createOtpToken({
        email: testEmail,
        purpose: 'password_reset_consume',
        ttlMinutes: 10
      });

      const verifyResult = await verifyOtpToken({
        email: testEmail,
        purpose: 'password_reset_consume',
        otp: rawOtp
      });
      assert.strictEqual(verifyResult.valid, true);

      // Replay attempt with same code must fail
      const replayResult = await verifyOtpToken({
        email: testEmail,
        purpose: 'password_reset_consume',
        otp: rawOtp
      });
      assert.strictEqual(replayResult.valid, false, 'Consumed OTP must not be reusable');
    });

    // 4. Session Invalidation & Token Revocation
    await test('Session creation and explicit revocation (Logout / Session Kill)', async () => {
      const mockReq = { ip: '127.0.0.1', headers: { 'user-agent': 'AuditAgent/1.0' } };
      const userObj = { id: testUserId, email: testEmail, role: 'user', plan: 'free' };
      const sessionBundle = await createUserSession(userObj, mockReq);
      assert.ok(sessionBundle.token, 'Must return JWT token');
      assert.ok(sessionBundle.sessionId, 'Must return session ID');

      // Verify active in user_sessions
      const sessionRow = await pool.query(
        'SELECT is_revoked FROM user_sessions WHERE id = $1',
        [sessionBundle.sessionId]
      );
      assert.strictEqual(sessionRow.rows[0].is_revoked, 0, 'Session must initially be active');

      // Revoke session
      await revokeUserSession(sessionBundle.token);

      const revokedRow = await pool.query(
        'SELECT is_revoked FROM user_sessions WHERE id = $1',
        [sessionBundle.sessionId]
      );
      assert.strictEqual(revokedRow.rows[0].is_revoked, 1, 'Session must be marked revoked');
    });

    // 5. GDPR Art. 20 User Data Export
    await test('GDPR Art. 20 Data Export extracts complete sanitized portable dataset', async () => {
      const retentionService = new DataRetentionService(db);
      const exportData = await retentionService.exportUserData(testUserId);
      assert.ok(exportData.metadata, 'Metadata must exist');
      assert.strictEqual(exportData.metadata.compliance, 'GDPR Article 20 Right to Data Portability');
      assert.strictEqual(exportData.user.id, testUserId);
      assert.strictEqual(exportData.user.email, testEmail);
      assert.strictEqual(exportData.user.password_hash, undefined, 'Password hash must be redacted from GDPR export');
      assert.ok(Array.isArray(exportData.instagram_accounts));
      assert.ok(Array.isArray(exportData.automation_rules));
      assert.ok(Array.isArray(exportData.invoices));
    });

    // 6. GDPR Art. 17 Right to Erasure / Account Deletion Lifecycle
    await test('GDPR Art. 17 Permanent Account Deletion cascades cleanly and logs confirmation', async () => {
      const retentionService = new DataRetentionService(db);

      const dummyAccId = `acc_del_${Date.now()}`;
      await pool.query(`
        INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, page_id, access_token_enc, status)
        VALUES ($1, $2, 'ig_del_123', 'del_user', 'page_del', 'enc_tok', 'connected')
      `, [dummyAccId, testUserId]);

      await pool.query(`
        INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, reply_message)
        VALUES ($1, $2, 'comment_to_dm', 'TEST', 'Reply')
      `, [`rule_del_${Date.now()}`, dummyAccId]);

      // Execute erasure
      const deletionResult = await retentionService.deleteUserData(testUserId, 'user_self_service');
      assert.strictEqual(deletionResult.success, true);
      assert.ok(deletionResult.confirmation_code.startsWith('DEL-'));

      // Verify user deleted
      const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [testUserId]);
      assert.strictEqual(userCheck.rows.length, 0, 'User row must be deleted');

      // Verify cascade to instagram_accounts
      const accCheck = await pool.query('SELECT id FROM instagram_accounts WHERE id = $1', [dummyAccId]);
      assert.strictEqual(accCheck.rows.length, 0, 'Instagram account row must cascade delete');

      // Verify deletion log recorded
      const logCheck = await pool.query(
        'SELECT status, confirmation_code FROM data_deletion_requests WHERE confirmation_code = $1',
        [deletionResult.confirmation_code]
      );
      assert.strictEqual(logCheck.rows.length, 1);
      assert.strictEqual(logCheck.rows[0].status, 'completed');
    });

  } finally {
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]).catch(() => {});
    await pool.query('DELETE FROM otp_tokens WHERE email = $1', [testEmail]).catch(() => {});
  }

  console.log(`\n🏁 Section 45 Audit Completed: ${passed} passed, ${failed} failed.`);
  return { passed, failed, findings };
}

run().then(res => {
  if (res.failed > 0) process.exit(1);
  process.exit(0);
}).catch(err => {
  console.error('Fatal Section 45 error:', err);
  process.exit(1);
});
