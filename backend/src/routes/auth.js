// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { 
  findOrCreateCanonicalUser, 
  linkAuthProviderToUser, 
  verifyGoogleIdToken, 
  createUserSession, 
  revokeUserSession 
} = require('../services/authService');
const { createOtpToken, verifyOtpToken } = require('../utils/otp');
const { 
  sendLoginOtpEmail, 
  sendPasswordResetOtpEmail, 
  sendEmailVerificationOtpEmail 
} = require('../services/emailService');

function isConfiguredAdminEmail(email) {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .toLowerCase()
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase().trim());
}

/**
 * 0A. SUPER ADMIN LOGIN
 * POST /api/auth/admin-login
 * Supports:
 *   1. Google SSO (id_token / access_token / credential)
 *   2. Email OTP (email, otp)
 *   3. Email & Password (email, password)
 */
router.post('/admin-login', authLimiter, async (req, res) => {
  try {
    const { email, password, otp } = req.body;
    let targetEmail = email ? email.toLowerCase().trim() : null;

    if (!targetEmail) {
      return res.status(400).json({ error: 'Administrator email address is required.' });
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    // 1. Check admin_users table
    let adminRecord = await db.prepare('SELECT * FROM admin_users WHERE LOWER(TRIM(email)) = ?').get(targetEmail);

    // If not found in admin_users, check if they are a configured Super Admin to auto-seed
    if (!adminRecord && isConfiguredAdminEmail(targetEmail)) {
      const { v4: uuidv4 } = require('uuid');
      const newAdminId = `adm-${uuidv4().slice(0, 8)}`;
      // Default hash for initial seed if not yet set
      const defaultHash = await bcrypt.hash('Airvix@Admin2026!', 10);
      await db.prepare(`
        INSERT INTO admin_users (id, email, name, password_hash, role, permissions, status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, 'superadmin', '["*"]', 'active', 'system', ?, ?)
      `).run(newAdminId, targetEmail, targetEmail.split('@')[0], defaultHash, nowStr, nowStr);
      adminRecord = await db.prepare('SELECT * FROM admin_users WHERE id = ?').get(newAdminId);
    }

    // Verify Admin Authorization
    if (!adminRecord) {
      return res.status(403).json({ 
        error: `Access Denied: ${targetEmail} is not authorized for Administrator access.` 
      });
    }

    // Check account status
    if (adminRecord.status === 'inactive' || adminRecord.status === 'suspended') {
      return res.status(403).json({ 
        error: 'Access Denied: This administrator account is currently deactivated or suspended. Please contact Super Admin.' 
      });
    }

    // 2. Authenticate: via OTP or Password (NO STATIC MASTER KEY BYPASS)
    if (otp) {
      await verifyOtpToken({
        email: targetEmail,
        purpose: 'admin_login_otp',
        otp: String(otp).trim(),
      });
    } else if (password) {
      let isDbPasswordMatch = false;
      if (adminRecord.password_hash) {
        isDbPasswordMatch = await bcrypt.compare(password, adminRecord.password_hash);
      }

      // Secondary check against users table if password was updated there
      if (!isDbPasswordMatch) {
        const existingUser = await db.prepare('SELECT * FROM users WHERE email = ?').get(targetEmail);
        if (existingUser && (existingUser.password_hash || existingUser.password)) {
          isDbPasswordMatch = await bcrypt.compare(password, existingUser.password_hash || existingUser.password);
          if (isDbPasswordMatch) {
            // Synchronize password hash into admin_users
            const newHash = existingUser.password_hash || await bcrypt.hash(password, 10);
            await db.prepare('UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, nowStr, adminRecord.id);
          }
        }
      }

      if (!isDbPasswordMatch) {
        return res.status(401).json({ error: 'Invalid admin credentials. Access denied.' });
      }
    } else {
      return res.status(400).json({ error: 'Password or 6-digit verification code is required to authenticate.' });
    }

    // 3. Find or sync the canonical user in users table
    let user = await db.prepare('SELECT * FROM users WHERE email = ?').get(targetEmail);

    if (!user) {
      const { v4: uuidv4 } = require('uuid');
      const userId = uuidv4();
      await db.prepare(`
        INSERT INTO users (id, email, name, role, plan, status, password_hash, email_verified, dm_usage_this_period, usage_period_start, created_at, updated_at)
        VALUES (?, ?, ?, 'admin', 'enterprise', 'active', ?, 1, 0, ?, ?, ?)
      `).run(
        userId,
        targetEmail,
        adminRecord.name || targetEmail.split('@')[0],
        adminRecord.password_hash,
        nowStr,
        nowStr,
        nowStr
      );
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    } else {
      await db.prepare(`
        UPDATE users 
        SET role = 'admin', plan = 'enterprise', email_verified = 1, updated_at = ?
        WHERE id = ?
      `).run(nowStr, user.id);
      user.role = 'admin';
      user.plan = 'enterprise';
      user.email_verified = 1;
    }

    const parsedPermissions = JSON.parse(adminRecord.permissions || '[]');
    user.admin_role = adminRecord.role;
    user.permissions = parsedPermissions;

    // Create session bundle
    const sessionBundle = await createUserSession(user, req);

    // Also record in admin_sessions table for governance and session tracking
    try {
      const crypto = require('crypto');
      const tokenHash = crypto.createHash('sha256').update(sessionBundle.token).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const ipAddress = (req.ip || (req.headers && req.headers['x-forwarded-for']) || '127.0.0.1').toString();
      const userAgent = (req.headers && req.headers['user-agent']) || 'Airvix Admin Console';
      await db.prepare(`
        INSERT INTO admin_sessions (id, user_id, token_hash, ip_address, user_agent, is_active, is_revoked, expires_at, created_at, last_active_at)
        VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?)
      `).run(sessionBundle.sessionId, user.id, tokenHash, ipAddress, userAgent, expiresAt, nowStr, nowStr);
    } catch (e) {
      console.warn('[Admin Auth] admin_sessions sync note:', e.message);
    }

    res.json({
      success: true,
      token: sessionBundle.token,
      user: {
        ...sessionBundle.user,
        role: 'admin',
        admin_role: adminRecord.role,
        permissions: parsedPermissions,
        plan: 'enterprise',
      },
      sessionId: sessionBundle.sessionId,
    });
  } catch (err) {
    console.error('[Admin Auth] Login error:', err.message);
    res.status(400).json({ error: err.message || 'Admin authentication failed. Access denied.' });
  }
});

/**
 * 0B. REQUEST ADMIN OTP (FOR LOGIN OR PASSWORD RESET)
 * POST /api/auth/admin-otp/request
 */
router.post('/admin-otp/request', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Fetch admin details directly from database
    const adminRecord = await db.prepare('SELECT id, status FROM admin_users WHERE LOWER(TRIM(email)) = ?').get(normalizedEmail);
    if (!adminRecord && !isConfiguredAdminEmail(normalizedEmail)) {
      return res.status(403).json({ 
        error: `Access Denied: ${normalizedEmail} is not authorized for Administrator access.` 
      });
    }

    if (adminRecord && (adminRecord.status === 'inactive' || adminRecord.status === 'suspended')) {
      return res.status(403).json({
        error: 'Access Denied: This administrator account is currently suspended.'
      });
    }

    // Generate 6-digit OTP
    const { rawOtp, expiresAt } = await createOtpToken({
      email: normalizedEmail,
      purpose: 'admin_login_otp',
      ttlMinutes: 10,
    });

    // Send email via Resend
    const sendResult = await sendLoginOtpEmail({
      email: normalizedEmail,
      otp: rawOtp,
      name: 'Airvix Administrator',
    });

    res.json({
      success: true,
      message: `A 6-digit admin verification code has been sent to ${normalizedEmail}`,
      expires_at: expiresAt,
      ...(sendResult.simulated && process.env.NODE_ENV !== 'production' ? { dev_otp: rawOtp } : {})
    });
  } catch (err) {
    console.error('[Admin Auth] Request OTP error:', err.message);
    res.status(400).json({ error: err.message || 'Failed to send admin verification code.' });
  }
});

/**
 * 0C. RESET SUPER ADMIN / ADMIN PASSWORD VIA OTP
 * POST /api/auth/admin-password/reset
 */
router.post('/admin-password/reset', authLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, verification code, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify administrator exists in database
    const adminRecord = await db.prepare('SELECT id, email FROM admin_users WHERE LOWER(TRIM(email)) = ?').get(normalizedEmail);
    if (!adminRecord && !isConfiguredAdminEmail(normalizedEmail)) {
      return res.status(403).json({ error: 'Access Denied: Unauthorized administrator email.' });
    }

    // Verify OTP
    await verifyOtpToken({
      email: normalizedEmail,
      purpose: 'admin_login_otp',
      otp: String(otp).trim(),
    });

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const newHash = await bcrypt.hash(newPassword, 10);

    if (adminRecord) {
      await db.prepare('UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, nowStr, adminRecord.id);
    }
    await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE LOWER(TRIM(email)) = ?').run(newHash, nowStr, normalizedEmail);

    res.json({
      success: true,
      message: 'Password successfully reset! You can now log in with your new password.',
    });
  } catch (err) {
    console.error('[Admin Auth] Password reset error:', err.message);
    res.status(400).json({ error: err.message || 'Failed to reset password.' });
  }
});

/**
 * 1. CONTINUE WITH GOOGLE OAUTH
 * POST /api/auth/google
 */
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { id_token, credential, code, access_token } = req.body;
    const tokenToVerify = id_token || credential || code || access_token;

    if (!tokenToVerify) {
      return res.status(400).json({ error: 'Google authentication credential, ID token, or access token is required' });
    }

    // Verify Google ID token and extract Google profile
    const googleProfile = await verifyGoogleIdToken(tokenToVerify);
    const { email, sub, name, email_verified } = googleProfile;

    if (!email) {
      return res.status(400).json({ error: 'Could not extract a verified email from Google identity.' });
    }

    // UNIFIED ACCOUNT LINKING: Find or create single canonical user record
    const user = await findOrCreateCanonicalUser({
      email,
      name,
      emailVerified: email_verified ? 1 : 0,
      provider: 'google',
      providerAccountId: sub,
    });

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended by an administrator.' });
    }

    // Create session and token
    const sessionBundle = await createUserSession(user, req);
    res.json(sessionBundle);
  } catch (err) {
    console.error('[Auth] Google OAuth Error:', err.message);
    res.status(400).json({ error: err.message || 'Google authentication failed. Please try again.' });
  }
});

/**
 * 2A. EMAIL + OTP: REQUEST OTP
 * POST /api/auth/email-otp/request
 */
router.post('/email-otp/request', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const existingUser = await db.prepare('SELECT name FROM users WHERE email = ?').get(normalizedEmail);
    const recipientName = existingUser ? existingUser.name : null;

    // Generate secure 6-digit OTP & store hash
    const { rawOtp, expiresAt } = await createOtpToken({
      email: normalizedEmail,
      purpose: 'login_otp',
      ttlMinutes: 10,
    });

    // Send OTP via Resend
    const sendResult = await sendLoginOtpEmail({
      email: normalizedEmail,
      otp: rawOtp,
      name: recipientName,
    });

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}`,
      expires_at: expiresAt,
      ...(sendResult.simulated && process.env.NODE_ENV !== 'production' ? { dev_otp: rawOtp } : {})
    });
  } catch (err) {
    console.error('[Auth] Request Email OTP error:', err.message);
    res.status(400).json({ error: err.message || 'Failed to send verification code. Please try again.' });
  }
});

/**
 * 2B. EMAIL + OTP: VERIFY OTP & LOGIN
 * POST /api/auth/email-otp/verify
 */
router.post('/email-otp/verify', authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email address and 6-digit code are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify OTP against hashed token
    const otpResult = await verifyOtpToken({
      email: normalizedEmail,
      purpose: 'login_otp',
      otp,
    });

    if (!otpResult.valid) {
      return res.status(400).json({ error: otpResult.error });
    }

    // UNIFIED ACCOUNT LINKING: Resolve canonical user record
    const user = await findOrCreateCanonicalUser({
      email: normalizedEmail,
      emailVerified: 1,
      provider: 'email_otp',
      providerAccountId: normalizedEmail,
    });

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended by an administrator.' });
    }

    const sessionBundle = await createUserSession(user, req);
    res.json({
      ...sessionBundle,
      message: 'Email OTP verification successful!'
    });
  } catch (err) {
    console.error('[Auth] Verify Email OTP error:', err.message);
    res.status(500).json({ error: err.message || 'Verification failed. Please try again.' });
  }
});

/**
 * 3. EMAIL + PASSWORD LOGIN
 * POST /api/auth/login
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended by an administrator.' });
    }

    // If user exists but has no password set (signed up via Google/OTP), inform user cleanly
    if (!user.password_hash) {
      return res.status(400).json({ 
        error: 'This account uses Google or Email OTP login. Please log in with Google or Email OTP, or use Forgot Password to set a password.' 
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check progressive brute-force lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const waitSeconds = Math.ceil((new Date(user.locked_until) - new Date()) / 1000);
      return res.status(429).json({ 
        error: `Account is temporarily locked. Please try again in ${waitSeconds} seconds.` 
      });
    }

    // 4. EMAIL + PASSWORD + 2FA / OTP STEP IF REQUIRED
    if (user.mfa_enabled) {
      const tempToken = jwt.sign(
        { id: user.id, mfa_pending: true, email: user.email },
        JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({
        mfa_required: true,
        temp_token: tempToken,
        message: '2FA verification code required to complete login'
      });
    }

    // Ensure provider link is recorded
    await linkAuthProviderToUser({
      userId: user.id,
      provider: 'password',
      providerAccountId: normalizedEmail,
    }).catch(() => {});

    const sessionBundle = await createUserSession(user, req);
    res.json(sessionBundle);
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/**
/**
 * EMAIL + PASSWORD SIGNUP: STEP 1 - REQUEST VERIFICATION OTP
 * POST /api/auth/register-request
 */
router.post('/register-request', authLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.prepare('SELECT id, password_hash, email_verified FROM users WHERE email = ?').get(normalizedEmail);

    if (existing && existing.password_hash && existing.email_verified) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }

    // Generate secure 6-digit OTP for signup verification
    const { rawOtp, expiresAt } = await createOtpToken({
      email: normalizedEmail,
      purpose: 'signup_otp',
      ttlMinutes: 10,
    });

    // Send verification OTP email via Resend
    const sendResult = await sendEmailVerificationOtpEmail({
      email: normalizedEmail,
      otp: rawOtp,
      name: name || normalizedEmail.split('@')[0],
    });

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}. Please enter the code to complete your registration.`,
      expires_at: expiresAt,
      ...(sendResult.simulated && process.env.NODE_ENV !== 'production' ? { dev_otp: rawOtp } : {})
    });
  } catch (err) {
    console.error('[Auth] Register request error:', err.message);
    res.status(400).json({ error: err.message || 'Failed to send verification code. Please try again.' });
  }
});

/**
 * EMAIL + PASSWORD SIGNUP: STEP 2 - VERIFY OTP & CREATE ACCOUNT
 * POST /api/auth/register
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name, otp } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // If OTP is supplied, verify it first before creating account
    if (otp) {
      const otpResult = await verifyOtpToken({
        email: normalizedEmail,
        purpose: 'signup_otp',
        otp,
      });

      if (!otpResult.valid) {
        return res.status(400).json({ error: otpResult.error });
      }
    }

    const existing = await db.prepare('SELECT id, password_hash, email_verified FROM users WHERE email = ?').get(normalizedEmail);
    if (existing && existing.password_hash && existing.email_verified) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }

    // UNIFIED ACCOUNT LINKING: Create canonical user with verified status
    const user = await findOrCreateCanonicalUser({
      email: normalizedEmail,
      name,
      password,
      emailVerified: 1,
      provider: 'password',
      providerAccountId: normalizedEmail,
    });

    const sessionBundle = await createUserSession(user, req);
    res.status(201).json({
      ...sessionBundle,
      message: 'Account created and verified successfully!'
    });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: err.message || 'Registration failed. Please try again.' });
  }
});

/**
 * 5. FORGOT PASSWORD: REQUEST RESET OTP
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email address is required' });

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(normalizedEmail);

    let devOtp = null;
    if (user) {
      const { rawOtp, expiresAt } = await createOtpToken({
        email: normalizedEmail,
        purpose: 'password_reset',
        ttlMinutes: 10,
      });

      const sendResult = await sendPasswordResetOtpEmail({
        email: normalizedEmail,
        otp: rawOtp,
        name: user.name,
      });

      if (sendResult.simulated && process.env.NODE_ENV !== 'production') {
        devOtp = rawOtp;
      }
    }

    // Uniform response to prevent account enumeration vulnerability
    res.json({
      success: true,
      message: 'If an account exists with this email, a 6-digit password reset code has been sent.',
      ...(devOtp ? { dev_otp: devOtp } : {})
    });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err.message);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

/**
 * FORGOT PASSWORD: VERIFY OTP AND SET NEW PASSWORD
 * POST /api/auth/reset-password
 */
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, verification code, and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify reset OTP
    const otpResult = await verifyOtpToken({
      email: normalizedEmail,
      purpose: 'password_reset',
      otp,
    });

    if (!otpResult.valid) {
      return res.status(400).json({ error: otpResult.error });
    }

    const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // Hash new password and update canonical user record
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await db.prepare(`
      UPDATE users 
      SET password_hash = ?, email_verified = 1, updated_at = ? 
      WHERE id = ?
    `).run(passwordHash, nowStr, user.id);

    // Invalidate old active sessions for security
    await db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?').run(user.id);

    // Ensure password provider link exists
    await linkAuthProviderToUser({
      userId: user.id,
      provider: 'password',
      providerAccountId: normalizedEmail,
    }).catch(() => {});

    // Create fresh authenticated session
    const updatedUser = await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    const sessionBundle = await createUserSession(updatedUser, req);

    res.json({
      success: true,
      message: 'Password reset successfully! You are now logged in.',
      ...sessionBundle,
    });
  } catch (err) {
    console.error('[Auth] Reset password error:', err.message);
    res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
});

/**
 * 18. ACCOUNT LINKING: LINK ADDITIONAL PROVIDER TO LOGGED-IN ACCOUNT
 * POST /api/auth/link-provider
 */
router.post('/link-provider', requireAuth, async (req, res) => {
  try {
    const { provider, provider_account_id, id_token, password } = req.body;
    const userId = req.user.id;

    if (!provider) {
      return res.status(400).json({ error: 'Provider name is required' });
    }

    let targetAccountId = provider_account_id;

    if (provider === 'google') {
      if (!id_token && !provider_account_id) {
        return res.status(400).json({ error: 'Google ID token or Google Account ID is required' });
      }
      if (id_token) {
        const googleProfile = await verifyGoogleIdToken(id_token);
        targetAccountId = googleProfile.sub;
      }
    } else if (provider === 'password') {
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
      targetAccountId = req.user.email;
    }

    const result = await linkAuthProviderToUser({
      userId,
      provider,
      providerAccountId: targetAccountId,
    });

    res.json(result);
  } catch (err) {
    console.error('[Auth] Link provider error:', err.message);
    res.status(400).json({ error: err.message || 'Failed to link authentication provider.' });
  }
});

/**
 * 13. LOGOUT
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    const header = req.headers['authorization'] || req.headers['Authorization'];
    if (header && header.startsWith('Bearer ')) {
      const token = header.slice(7);
      await revokeUserSession(token);
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    res.json({ success: true });
  }
});

/**
 * GET /api/auth/me (Current Authenticated User & Linked Providers)
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.prepare(`
      SELECT id, email, name, avatar_url, plan, role, status, email_verified, dm_usage_this_period, usage_period_start, created_at 
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!user) return res.status(404).json({ error: 'User not found' });

    let adminRole = null;
    let permissions = [];
    let isRoot = false;
    try {
      const adminRow = await db.prepare('SELECT * FROM admin_users WHERE LOWER(TRIM(email)) = ?').get(user.email.toLowerCase().trim());
      if (adminRow && adminRow.status === 'active') {
        adminRole = adminRow.role;
        isRoot = Boolean(adminRow.is_root || adminRow.is_immutable || (adminRow.role === 'superadmin' && !adminRow.created_by));
        permissions = JSON.parse(adminRow.permissions || '[]');
        user.role = 'admin';
      } else if (isConfiguredAdminEmail(user.email)) {
        adminRole = 'superadmin';
        isRoot = true;
        permissions = ['*'];
        user.role = 'admin';
      }
    } catch (e) {}

    if (isConfiguredAdminEmail(user.email) && user.role !== 'admin') {
      user.role = 'admin';
      await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
    }

    // Fetch linked providers for this canonical user
    const linkedProviders = await db.prepare(`
      SELECT provider, provider_account_id, created_at 
      FROM auth_accounts WHERE user_id = ?
    `).all(user.id);

    res.json({ 
      user: {
        ...user,
        admin_role: adminRole,
        is_root: isRoot,
        permissions: permissions,
        linked_providers: (linkedProviders || []).map(p => p.provider)
      } 
    });
  } catch (err) {
    console.error('[Auth] /me error:', err.message);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

module.exports = router;
