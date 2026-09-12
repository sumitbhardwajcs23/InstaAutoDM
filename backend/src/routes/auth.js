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
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'sumitbhardwaj2227@gmail.com,admin@airvix.com')
    .toLowerCase()
    .split(',')
    .map(e => e.trim());
  return adminEmails.includes(email.toLowerCase().trim());
}

/**
 * 1. CONTINUE WITH GOOGLE OAUTH
 * POST /api/auth/google
 */
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { id_token, credential, code } = req.body;
    const tokenToVerify = id_token || credential || code;

    if (!tokenToVerify) {
      return res.status(400).json({ error: 'Google authentication credential or ID token is required' });
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
 * EMAIL + PASSWORD SIGNUP
 * POST /api/auth/register
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(normalizedEmail);

    if (existing && existing.password_hash) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }

    // UNIFIED ACCOUNT LINKING: Attach password auth to canonical user record
    const user = await findOrCreateCanonicalUser({
      email: normalizedEmail,
      name,
      password,
      emailVerified: 0,
      provider: 'password',
      providerAccountId: normalizedEmail,
    });

    const sessionBundle = await createUserSession(user, req);
    res.status(201).json(sessionBundle);
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
        linked_providers: (linkedProviders || []).map(p => p.provider)
      } 
    });
  } catch (err) {
    console.error('[Auth] /me error:', err.message);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

module.exports = router;
