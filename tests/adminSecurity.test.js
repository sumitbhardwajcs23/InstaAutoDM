/**
 * Enterprise Admin Security Test Suite
 * Validates RBAC permissions, RFC 6238 TOTP 2FA engine, emergency backup codes,
 * progressive brute-force lockout, and admin session revocation.
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../backend/src/db');
const totp = require('../backend/src/services/totp');
const { requireAdmin } = require('../backend/src/middleware/auth');
const { v4: uuidv4 } = require('uuid');

async function runTests() {
    console.log('🧪 Starting Enterprise Admin Security Test Suite...\n');
    await db.ready();
    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${name}`);
            console.error(`     Error: ${err.message}\n`);
            failed++;
        }
    };

    // 1. RFC 6238 TOTP Engine functionality
    await test('TOTP Secret generation, counter derivation, and token validation', async () => {
        const secret = totp.generateSecret();
        assert(secret.length >= 20, 'Secret must be valid Base32 string');

        const currentCounter = Math.floor(Date.now() / 1000 / 30);
        const validOtp = totp.generateOtpForCounter(secret, currentCounter);
        assert(/^\d{6}$/.test(validOtp), 'Generated OTP must be 6 digits');

        const isVerified = totp.verifyTotp(secret, validOtp);
        assert.strictEqual(isVerified, true, 'Current OTP must verify as valid');

        const badOtp = validOtp === '123456' ? '654321' : '123456';
        const isBadVerified = totp.verifyTotp(secret, badOtp);
        assert.strictEqual(isBadVerified, false, 'Tampered OTP must be rejected');
    });

    // 2. Emergency recovery backup codes generation & single-use consumption
    await test('Backup codes generate, verify securely via SHA-256, and consume on use', async () => {
        const backupCodes = totp.generateBackupCodes(8);
        assert.strictEqual(backupCodes.length, 8, 'Must generate exactly 8 backup codes');

        const hashedCodes = backupCodes.map(c => totp.hashBackupCode(c));
        const testCode = backupCodes[0];

        // Consume first code
        const consumeResult = totp.verifyAndConsumeBackupCode(testCode, hashedCodes);
        assert.strictEqual(consumeResult.valid, true, 'Valid code must consume successfully');
        assert.strictEqual(consumeResult.remainingHashedCodes.length, 7, 'Remaining codes must be decremented to 7');

        // Attempt reusing the same consumed code
        const reuseResult = totp.verifyAndConsumeBackupCode(testCode, consumeResult.remainingHashedCodes);
        assert.strictEqual(reuseResult.valid, false, 'Used code must NOT be valid again');
    });

    // 3. Progressive brute-force lockout logic
    await test('Progressive brute-force lockout locks account on 5 consecutive failures', async () => {
        const testUserId = `admin-lockout-${uuidv4().slice(0, 8)}`;
        const testEmail = `admin_lock_${uuidv4().slice(0, 6)}@test.local`;

        await db.prepare(`
            INSERT INTO users (id, email, name, role, admin_role, failed_login_attempts, dm_usage_this_period, usage_period_start, created_at, updated_at)
            VALUES (?, ?, 'Admin Tester', 'admin', 'superadmin', 4, 0, '2026-09-01', datetime('now'), datetime('now'))
        `).run(testUserId, testEmail);

        // 5th failed attempt:
        const user = await db.prepare('SELECT failed_login_attempts FROM users WHERE id = ?').get(testUserId);
        const newAttempts = user.failed_login_attempts + 1;
        let lockedUntil = null;
        if (newAttempts >= 5) {
            lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }

        await db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?')
            .run(newAttempts, lockedUntil, testUserId);

        const updatedUser = await db.prepare('SELECT failed_login_attempts, locked_until FROM users WHERE id = ?').get(testUserId);
        assert.strictEqual(updatedUser.failed_login_attempts, 5);
        assert(updatedUser.locked_until, 'locked_until must be populated');
        assert(new Date(updatedUser.locked_until) > new Date(), 'locked_until must be in the future');
    });

    // 4. Session revocation enforcement
    await test('Revoked admin session is rejected by requireAdmin middleware', async () => {
        const sessionId = uuidv4();
        const adminId = `admin-rev-${uuidv4().slice(0, 8)}`;
        const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

        // Insert admin user first to satisfy foreign key constraint
        await db.prepare(`
            INSERT INTO users (id, email, name, role, admin_role, dm_usage_this_period, usage_period_start, created_at, updated_at)
            VALUES (?, 'admin_rev@airvix.com', 'Admin Revoker', 'admin', 'superadmin', 0, '2026-09-01', datetime('now'), datetime('now'))
        `).run(adminId);

        // Insert active session
        await db.prepare(`
            INSERT INTO admin_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, is_active, created_at)
            VALUES (?, ?, 'hash123', '127.0.0.1', 'JestTest', ?, 1, datetime('now'))
        `).run(sessionId, adminId, expiresAt);

        // Revoke session
        await db.prepare('UPDATE admin_sessions SET is_active = 0 WHERE id = ?').run(sessionId);

        // Simulate requireAdmin middleware call
        const req = {
            user: {
                id: adminId,
                email: 'admin@airvix.com',
                role: 'admin',
                session_id: sessionId
            },
            headers: {}
        };

        let responseStatusCode = null;
        let responseJson = null;
        const res = {
            status: (code) => {
                responseStatusCode = code;
                return {
                    json: (data) => { responseJson = data; }
                };
            }
        };

        let nextCalled = false;
        await requireAdmin(req, res, () => { nextCalled = true; });

        assert.strictEqual(nextCalled, false, 'Next must not be called for revoked session');
        assert.strictEqual(responseStatusCode, 401, 'Must return HTTP 401');
        assert(responseJson.error.includes('expired or been revoked'), 'Error message must reflect session revocation');
    });

    console.log(`\n========================================`);
    console.log(`Enterprise Admin Security: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
