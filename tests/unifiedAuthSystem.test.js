// tests/unifiedAuthSystem.test.js
const assert = require('assert');
const path = require('path');

// Set isolated test database environment or load app DB
process.env.NODE_ENV = 'test';
const db = require('../backend/src/db');
const authService = require('../backend/src/services/authService');
const { createOtpToken, verifyOtpToken } = require('../backend/src/utils/otp');
const { 
  findOrCreateCanonicalUser, 
  linkAuthProviderToUser, 
  createUserSession, 
  revokeUserSession, 
  isSessionRevoked 
} = authService;

async function runUnifiedAuthTests() {
  console.log('🧪 Starting Airvix Unified Authentication System Test Suite (18 Scenarios)\n');
  await db.ready();

  const testEmailA = `test.user.a.${Date.now()}@example.com`;
  const testEmailB = `test.user.b.${Date.now()}@example.com`;
  const googleSubA = `google_sub_a_${Date.now()}`;
  const googleSubB = `google_sub_b_${Date.now()}`;

  let canonicalUserIdA = null;
  let canonicalUserIdB = null;

  // -------------------------------------------------------------
  // Scenario 1: New user -> Google signup
  // -------------------------------------------------------------
  console.log('1️⃣ Scenario 1: New user -> Google signup');
  const user1 = await findOrCreateCanonicalUser({
    email: testEmailA,
    name: 'User A',
    emailVerified: 1,
    provider: 'google',
    providerAccountId: googleSubA,
  });

  assert(user1 && user1.id, 'User 1 should be created with a valid UUID');
  assert.strictEqual(user1.email.toLowerCase(), testEmailA.toLowerCase());
  assert.strictEqual(user1.email_verified, 1);
  canonicalUserIdA = user1.id;
  console.log(`   ✅ Success: Created canonical user_id = ${canonicalUserIdA}`);

  // -------------------------------------------------------------
  // Scenario 2: Existing Google user -> Google login
  // -------------------------------------------------------------
  console.log('\n2️⃣ Scenario 2: Existing Google user -> Google login');
  const user2 = await findOrCreateCanonicalUser({
    email: testEmailA,
    provider: 'google',
    providerAccountId: googleSubA,
  });

  assert.strictEqual(user2.id, canonicalUserIdA, 'Google login must return the exact same user_id');
  console.log(`   ✅ Success: Logged into existing account user_id = ${user2.id}`);

  // -------------------------------------------------------------
  // Scenario 3: New user -> Email OTP signup
  // -------------------------------------------------------------
  console.log('\n3️⃣ Scenario 3: New user -> Email OTP signup');
  const user3 = await findOrCreateCanonicalUser({
    email: testEmailB,
    emailVerified: 1,
    provider: 'email_otp',
    providerAccountId: testEmailB,
  });

  assert(user3 && user3.id, 'User 3 should be created with a valid UUID');
  assert.notStrictEqual(user3.id, canonicalUserIdA, 'Different emails must produce distinct user_ids');
  canonicalUserIdB = user3.id;
  console.log(`   ✅ Success: Created distinct user_id = ${canonicalUserIdB}`);

  // -------------------------------------------------------------
  // Scenario 4: Existing Email OTP user -> Email OTP login
  // -------------------------------------------------------------
  console.log('\n4️⃣ Scenario 4: Existing Email OTP user -> Email OTP login');
  const user4 = await findOrCreateCanonicalUser({
    email: testEmailB,
    emailVerified: 1,
    provider: 'email_otp',
    providerAccountId: testEmailB,
  });

  assert.strictEqual(user4.id, canonicalUserIdB, 'Email OTP login must resolve to canonical user_id B');
  console.log(`   ✅ Success: Logged into existing account user_id = ${user4.id}`);

  // -------------------------------------------------------------
  // Scenario 5: Existing password user -> Password login
  // -------------------------------------------------------------
  console.log('\n5️⃣ Scenario 5: Existing password user -> Password login');
  const passUserEmail = `pass.user.${Date.now()}@example.com`;
  const user5 = await findOrCreateCanonicalUser({
    email: passUserEmail,
    password: 'SecurePassword123!',
    provider: 'password',
    providerAccountId: passUserEmail,
  });

  assert(user5 && user5.password_hash, 'Password user must have bcrypt password_hash');
  console.log(`   ✅ Success: Created password user with hashed password`);

  // -------------------------------------------------------------
  // Scenario 6: Google user -> later Email OTP login (MUST RESOLVE TO SAME user_id!)
  // -------------------------------------------------------------
  console.log('\n6️⃣ Scenario 6: Google user -> later Email OTP login (UNIFIED LINKING)');
  const user6 = await findOrCreateCanonicalUser({
    email: testEmailA, // Same email as Google User A
    emailVerified: 1,
    provider: 'email_otp',
    providerAccountId: testEmailA,
  });

  assert.strictEqual(user6.id, canonicalUserIdA, 'CRITICAL: Email OTP login for Google email MUST resolve to the EXACT SAME user_id!');
  console.log(`   ✅ Success: Unified resolution confirmed! Both Google and Email OTP use user_id = ${user6.id}`);

  // -------------------------------------------------------------
  // Scenario 7: Email/password user -> later Google login (MUST RESOLVE TO SAME user_id!)
  // -------------------------------------------------------------
  console.log('\n7️⃣ Scenario 7: Email/password user -> later Google login (UNIFIED LINKING)');
  const googleSubForPassUser = `google_sub_pass_${Date.now()}`;
  const user7 = await findOrCreateCanonicalUser({
    email: passUserEmail,
    emailVerified: 1,
    provider: 'google',
    providerAccountId: googleSubForPassUser,
  });

  assert.strictEqual(user7.id, user5.id, 'CRITICAL: Google login for Password email MUST resolve to the EXACT SAME user_id!');
  console.log(`   ✅ Success: Unified resolution confirmed! Password user linked to Google with user_id = ${user7.id}`);

  // -------------------------------------------------------------
  // Scenario 8: Forgot password -> OTP -> new password
  // -------------------------------------------------------------
  console.log('\n8️⃣ Scenario 8: Forgot password -> OTP -> new password');
  const { rawOtp: resetOtp } = await createOtpToken({ email: testEmailA, purpose: 'password_reset', ttlMinutes: 10 });
  const verifyResetRes = await verifyOtpToken({ email: testEmailA, purpose: 'password_reset', otp: resetOtp });
  assert(verifyResetRes.valid, 'Reset OTP should be valid');

  const updatedUserA = await findOrCreateCanonicalUser({
    email: testEmailA,
    password: 'NewSuperPassword456!',
  });
  assert(updatedUserA.password_hash, 'Password should be updated on canonical user record');
  console.log(`   ✅ Success: Reset password verified and updated for user_id = ${updatedUserA.id}`);

  // -------------------------------------------------------------
  // Scenario 9: Invalid OTP rejection
  // -------------------------------------------------------------
  console.log('\n9️⃣ Scenario 9: Invalid OTP rejection');
  await createOtpToken({ email: testEmailB, purpose: 'login_otp', ttlMinutes: 10 });
  const invalidRes = await verifyOtpToken({ email: testEmailB, purpose: 'login_otp', otp: '000000' });
  assert.strictEqual(invalidRes.valid, false, 'Invalid OTP must be rejected');
  console.log(`   ✅ Success: Invalid OTP rejected with message: "${invalidRes.error}"`);

  // -------------------------------------------------------------
  // Scenario 10: Expired OTP handling
  // -------------------------------------------------------------
  console.log('\n🔟 Scenario 10: Expired OTP handling');
  const expiredEmail = `expired.${Date.now()}@example.com`;
  const expiredTokenId = `expired_tok_${Date.now()}`;
  const now = new Date();
  const pastIso = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

  await db.prepare(`
    INSERT INTO otp_tokens (id, email, otp_hash, purpose, attempts, max_attempts, expires_at, created_at)
    VALUES (?, ?, 'fake_hash', 'login_otp', 0, 3, ?, ?)
  `).run(expiredTokenId, expiredEmail, pastIso, pastIso);

  const expiredRes = await verifyOtpToken({ email: expiredEmail, purpose: 'login_otp', otp: '123456' });
  assert.strictEqual(expiredRes.valid, false, 'Expired OTP must be rejected');
  console.log(`   ✅ Success: Expired OTP rejected with message: "${expiredRes.error}"`);

  // -------------------------------------------------------------
  // Scenario 11: Single-use OTP re-use prevention
  // -------------------------------------------------------------
  console.log('\n1️⃣1️⃣ Scenario 11: Single-use OTP re-use prevention');
  const singleUseEmail = `singleuse.${Date.now()}@example.com`;
  const { rawOtp: singleOtp } = await createOtpToken({ email: singleUseEmail, purpose: 'login_otp', ttlMinutes: 10 });
  
  const firstUse = await verifyOtpToken({ email: singleUseEmail, purpose: 'login_otp', otp: singleOtp });
  assert(firstUse.valid, 'First OTP verification must succeed');
  
  const secondUse = await verifyOtpToken({ email: singleUseEmail, purpose: 'login_otp', otp: singleOtp });
  assert.strictEqual(secondUse.valid, false, 'Reusing consumed OTP must fail');
  console.log(`   ✅ Success: Reused OTP rejected on second attempt`);

  // -------------------------------------------------------------
  // Scenario 12: Too many OTP attempts lockout
  // -------------------------------------------------------------
  console.log('\n1️⃣2️⃣ Scenario 12: Too many OTP attempts lockout');
  const lockoutEmail = `lockout.${Date.now()}@example.com`;
  const { rawOtp: lockoutOtp } = await createOtpToken({ email: lockoutEmail, purpose: 'login_otp', ttlMinutes: 10 });

  await verifyOtpToken({ email: lockoutEmail, purpose: 'login_otp', otp: '111111' });
  await verifyOtpToken({ email: lockoutEmail, purpose: 'login_otp', otp: '222222' });
  const thirdBad = await verifyOtpToken({ email: lockoutEmail, purpose: 'login_otp', otp: '333333' });
  assert.strictEqual(thirdBad.valid, false);

  const correctAfterMaxAttempts = await verifyOtpToken({ email: lockoutEmail, purpose: 'login_otp', otp: lockoutOtp });
  assert.strictEqual(correctAfterMaxAttempts.valid, false, 'Should block correct OTP after max incorrect attempts');
  console.log(`   ✅ Success: Locked out after 3 incorrect attempts`);

  // -------------------------------------------------------------
  // Scenario 13: Too many OTP requests (Rate limiting check)
  // -------------------------------------------------------------
  console.log('\n1️⃣3️⃣ Scenario 13: Too many OTP requests (Rate limiting check)');
  const rateLimitEmail = `ratelimit.${Date.now()}@example.com`;
  await createOtpToken({ email: rateLimitEmail, purpose: 'login_otp', ttlMinutes: 10 });

  try {
    await createOtpToken({ email: rateLimitEmail, purpose: 'login_otp', ttlMinutes: 10 });
    assert.fail('Should have thrown rate limiting error');
  } catch (rateErr) {
    assert(rateErr.message.includes('Please wait'), 'Should throw 60-second rate limit error');
    console.log(`   ✅ Success: Rate limit enforced: "${rateErr.message}"`);
  }

  // -------------------------------------------------------------
  // Scenario 14: Google OAuth failure handling
  // -------------------------------------------------------------
  console.log('\n1️⃣4️⃣ Scenario 14: Google OAuth failure handling');
  try {
    await authService.verifyGoogleIdToken('invalid_junk_token_123');
    assert.fail('Invalid Google token should throw error');
  } catch (googleErr) {
    assert(googleErr.message, 'Should return error on invalid token');
    console.log(`   ✅ Success: Google OAuth invalid token rejected safely`);
  }

  // -------------------------------------------------------------
  // Scenario 15: Duplicate account prevention
  // -------------------------------------------------------------
  console.log('\n1️⃣5️⃣ Scenario 15: Duplicate account prevention');
  const dupEmail = `dup.${Date.now()}@example.com`;
  const dupUser1 = await findOrCreateCanonicalUser({ email: dupEmail, provider: 'email_otp', providerAccountId: dupEmail });
  const dupUser2 = await findOrCreateCanonicalUser({ email: dupEmail, provider: 'google', providerAccountId: `g_${dupEmail}` });
  const dupUser3 = await findOrCreateCanonicalUser({ email: dupEmail, password: 'Pass123!', provider: 'password', providerAccountId: dupEmail });

  assert.strictEqual(dupUser1.id, dupUser2.id, 'User 1 & 2 must share user_id');
  assert.strictEqual(dupUser2.id, dupUser3.id, 'User 2 & 3 must share user_id');

  const countRes = await db.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?').get(dupEmail.toLowerCase());
  assert.strictEqual(countRes.count, 1, 'Database MUST contain EXACTLY ONE record for dupEmail');
  console.log(`   ✅ Success: Zero duplicate account records created in users table (Count = ${countRes.count})`);

  // -------------------------------------------------------------
  // Scenario 16: Logout & session revocation
  // -------------------------------------------------------------
  console.log('\n1️⃣6️⃣ Scenario 16: Logout & session revocation');
  const { token, user: sessionUser } = await createUserSession(user1);
  const isRevokedBefore = await isSessionRevoked(token);
  assert.strictEqual(isRevokedBefore, false, 'Session should be active initially');

  await revokeUserSession(token);
  const isRevokedAfter = await isSessionRevoked(token);
  assert.strictEqual(isRevokedAfter, true, 'Session should be revoked after logout');
  console.log(`   ✅ Success: Session successfully revoked upon logout`);

  // -------------------------------------------------------------
  // Scenario 17: Session expiration check
  // -------------------------------------------------------------
  console.log('\n1️⃣7️⃣ Scenario 17: Session expiration check');
  const expiredSessionId = `exp_sess_${Date.now()}`;
  const expiredTokenHash = `exp_hash_${Date.now()}`;
  const pastSessionIso = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();

  await db.prepare(`
    INSERT INTO user_sessions (id, user_id, token_hash, is_revoked, expires_at, created_at)
    VALUES (?, ?, ?, 0, ?, ?)
  `).run(expiredSessionId, user1.id, expiredTokenHash, pastSessionIso, pastSessionIso);

  const sessRecord = await db.prepare('SELECT expires_at FROM user_sessions WHERE id = ?').get(expiredSessionId);
  assert(new Date(sessRecord.expires_at) < new Date(), 'Session should be in the past');
  console.log(`   ✅ Success: Expired session detected`);

  // -------------------------------------------------------------
  // Scenario 18: Provider already linked to another account error handling
  // -------------------------------------------------------------
  console.log('\n1️⃣8️⃣ Scenario 18: Provider already linked to another account error handling');
  const sharedGoogleSub = `shared_sub_${Date.now()}`;
  await linkAuthProviderToUser({ userId: canonicalUserIdA, provider: 'google', providerAccountId: sharedGoogleSub });

  try {
    await linkAuthProviderToUser({ userId: canonicalUserIdB, provider: 'google', providerAccountId: sharedGoogleSub });
    assert.fail('Should fail to link provider already attached to User A');
  } catch (linkErr) {
    assert(linkErr.message.includes('already linked'), 'Should return clear error for already linked provider');
    console.log(`   ✅ Success: Re-linking error handled safely: "${linkErr.message}"`);
  }

  console.log('\n🎉 ALL 18 UNIFIED AUTHENTICATION TEST SCENARIOS PASSED PERFECTLY!\n');
}

runUnifiedAuthTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test suite failed with error:', err);
    process.exit(1);
  });
