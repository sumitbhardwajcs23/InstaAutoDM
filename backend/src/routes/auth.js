// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const cryptoService = require('../services/crypto');
const totp = require('../services/totp');

function isConfiguredAdminEmail(email) {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'sumitbhardwaj2227@gmail.com,admin@airvix.com')
    .toLowerCase()
    .split(',')
    .map(e => e.trim());
  return adminEmails.includes(email.toLowerCase().trim());
}

function makeToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      plan: user.plan, 
      role: user.role || (isConfiguredAdminEmail(user.email) ? 'admin' : 'user'),
      status: user.status || 'active'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function makeAdminToken(user, sessionId) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      plan: user.plan, 
      role: 'admin',
      admin_role: user.admin_role || 'superadmin',
      session_id: sessionId,
      status: user.status || 'active'
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}


// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const password_hash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const now = new Date().toISOString();
    const displayName = name || email.split('@')[0];
    const initialRole = isConfiguredAdminEmail(normalizedEmail) ? 'admin' : 'user';

    await db.prepare(`
      INSERT INTO users (id, email, name, plan, role, status, password_hash, dm_usage_this_period, usage_period_start, created_at, updated_at)
      VALUES (?, ?, ?, 'free', ?, 'active', ?, 0, ?, ?, ?)
    `).run(userId, normalizedEmail, displayName, initialRole, password_hash, now.slice(0, 10), now, now);

    const user = await db.prepare('SELECT id, email, name, plan, role, status FROM users WHERE id = ?').get(userId);
    const token = makeToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'This account has been suspended by an administrator. Please contact support.' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    // Auto-grant admin role if email is configured admin
    let role = user.role || 'user';
    if (isConfiguredAdminEmail(normalizedEmail) && role !== 'admin') {
      role = 'admin';
      await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
    }

    const userData = { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      plan: user.plan, 
      role, 
      status: user.status || 'active' 
    };
    const token = makeToken(userData);
    res.json({ token, user: userData });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// POST /api/auth/admin-login (Strict Super Admin Gateway)
router.post('/admin-login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Admin email and master password are required' });

    const normalizedEmail = email.toLowerCase().trim();
    let user = await db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

    // If database is brand new (no user exists yet with this email) AND the email is a configured admin email:
    // Automatically register the owner as Super Admin on first login!
    if (!user && isConfiguredAdminEmail(normalizedEmail)) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Admin password must be at least 6 characters long' });
      }
      const password_hash = await bcrypt.hash(password, 12);
      const userId = uuidv4();
      const now = new Date().toISOString();
      await db.prepare(`
        INSERT INTO users (id, email, name, plan, role, status, password_hash, dm_usage_this_period, usage_period_start, created_at, updated_at)
        VALUES (?, ?, 'Super Admin', 'agency', 'admin', 'active', ?, 0, ?, ?, ?)
      `).run(userId, normalizedEmail, password_hash, now.slice(0, 10), now, now);
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid admin credentials or unauthorized account' });
    }

    // Check progressive brute-force lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const waitSeconds = Math.ceil((new Date(user.locked_until) - new Date()) / 1000);
      return res.status(429).json({ 
        error: `Account is temporarily locked due to repeated failed login attempts. Please try again in ${waitSeconds} seconds.` 
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'This admin account has been suspended' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      // Increment failed attempts and lock out if threshold reached (5 attempts -> 15 min lock)
      const attempts = (user.failed_login_attempts || 0) + 1;
      let lockedUntil = null;
      if (attempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      await db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?')
        .run(attempts, lockedUntil, user.id);

      return res.status(401).json({ 
        error: attempts >= 5 
          ? 'Account locked for 15 minutes due to multiple failed login attempts.' 
          : 'Invalid admin credentials' 
      });
    }

    // Reset failed login attempts on successful password verification
    await db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

    // Auto-grant admin role if email is configured admin
    let role = user.role || 'user';
    if (isConfiguredAdminEmail(normalizedEmail) && role !== 'admin') {
      role = 'admin';
      await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
    }

    // Strict Admin Verification: Must be admin role or configured admin email
    if (role !== 'admin' && !isConfiguredAdminEmail(normalizedEmail)) {
      return res.status(403).json({ 
        error: 'Access Denied: This portal is strictly reserved for Super Administrators.' 
      });
    }

    const adminRole = user.admin_role || 'superadmin';

    // Check if MFA/2FA is enabled for this admin
    if (user.mfa_enabled) {
      const tempToken = jwt.sign(
        { id: user.id, mfa_pending: true, role: 'admin', admin_role: adminRole },
        JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({
        mfa_required: true,
        temp_token: tempToken,
        message: '2FA verification code required to complete login'
      });
    }

    // MFA is not enabled: create active admin session directly
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const userData = { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      plan: user.plan, 
      role: 'admin',
      admin_role: adminRole,
      status: user.status || 'active' 
    };

    const token = makeAdminToken(userData, sessionId);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await db.prepare(`
      INSERT INTO admin_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `).run(sessionId, user.id, tokenHash, ipAddress, userAgent, expiresAt);

    res.json({ token, user: userData, session_id: sessionId });
  } catch (err) {
    console.error('[Auth] Admin Login error:', err.message);
    res.status(500).json({ error: 'Admin authentication failed. Please try again.' });
  }
});

// POST /api/auth/admin-mfa-verify (Verify 2FA TOTP or backup code and issue session)
router.post('/admin-mfa-verify', authLimiter, async (req, res) => {
  try {
    const { temp_token, code } = req.body;
    if (!temp_token || !code) {
      return res.status(400).json({ error: 'temp_token and 2FA verification code are required' });
    }

    let decoded = null;
    try {
      decoded = jwt.verify(temp_token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Session verification expired or invalid. Please log in again.' });
    }

    if (!decoded || !decoded.mfa_pending || !decoded.id) {
      return res.status(401).json({ error: 'Invalid MFA verification request' });
    }

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user || !user.mfa_secret_enc) {
      return res.status(400).json({ error: 'MFA is not configured for this account' });
    }

    const secret = cryptoService.decrypt(user.mfa_secret_enc);
    let verified = totp.verifyTotp(secret, code.trim());

    // If TOTP verification fails, try backup recovery codes
    if (!verified && user.mfa_backup_codes_enc) {
      try {
        const hashedCodes = JSON.parse(cryptoService.decrypt(user.mfa_backup_codes_enc));
        const backupResult = totp.verifyAndConsumeBackupCode(code.trim(), hashedCodes);
        if (backupResult.valid) {
          verified = true;
          // Update remaining backup codes encrypted
          const updatedEnc = cryptoService.encrypt(JSON.stringify(backupResult.remainingHashedCodes));
          await db.prepare('UPDATE users SET mfa_backup_codes_enc = ? WHERE id = ?').run(updatedEnc, user.id);
        }
      } catch (backupErr) {
        console.warn('[Auth] Backup code parsing error:', backupErr.message);
      }
    }

    if (!verified) {
      return res.status(401).json({ error: 'Invalid 2FA verification code or backup code' });
    }

    const adminRole = user.admin_role || 'superadmin';
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const userData = { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      plan: user.plan, 
      role: 'admin',
      admin_role: adminRole,
      status: user.status || 'active' 
    };

    const token = makeAdminToken(userData, sessionId);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await db.prepare(`
      INSERT INTO admin_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `).run(sessionId, user.id, tokenHash, ipAddress, userAgent, expiresAt);

    res.json({ token, user: userData, session_id: sessionId });
  } catch (err) {
    console.error('[Auth] Admin MFA verification error:', err.message);
    res.status(500).json({ error: 'Failed to complete 2FA verification' });
  }
});


// POST /api/auth/forgot-password (Request single-use reset token)
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.prepare('SELECT id, email FROM users WHERE email = ?').get(normalizedEmail);

    let devToken = null;
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins
      const resetId = uuidv4();

      await db.prepare(`
        INSERT INTO password_resets (id, user_id, token_hash, expires_at, used, created_at)
        VALUES (?, ?, ?, ?, 0, datetime('now'))
      `).run(resetId, user.id, tokenHash, expiresAt);

      if (process.env.NODE_ENV !== 'production') {
        devToken = rawToken;
        console.log(`[Auth] 🔑 Password reset token generated for ${user.email}: ${rawToken}`);
      }
    }

    // Always return uniform message to prevent account enumeration
    res.json({
      success: true,
      message: 'If an account exists with this email, password reset instructions have been sent.',
      ...(devToken ? { dev_token: devToken } : {})
    });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err.message);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// POST /api/auth/reset-password (Verify single-use token and update password)
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const resetRecord = await db.prepare(`
      SELECT r.*, u.email 
      FROM password_resets r
      JOIN users u ON r.user_id = u.id
      WHERE r.token_hash = ? AND r.used = 0 AND r.expires_at > datetime('now')
    `).get(tokenHash);

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid, expired, or previously used password reset token.' });
    }

    const password_hash = await bcrypt.hash(newPassword, 12);
    const now = new Date().toISOString();
    await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(password_hash, now, resetRecord.user_id);
    await db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRecord.id);

    res.json({ success: true, message: 'Password has been reset successfully! You can now log in.' });
  } catch (err) {
    console.error('[Auth] Reset password error:', err.message);
    res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
});

// GET /api/auth/me  (requires auth)
router.get('/me', requireAuth, async (req, res) => {
  const user = await db.prepare('SELECT id, email, name, plan, role, status, dm_usage_this_period, usage_period_start, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  if (isConfiguredAdminEmail(user.email) && user.role !== 'admin') {
    user.role = 'admin';
    await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
  }

  res.json({ user });
});

// GET /api/auth/export-data (GDPR Right to Data Portability)
router.get('/export-data', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await db.prepare('SELECT id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Fetch user's connected Instagram accounts (sanitized, NEVER tokens)
    const rawAccounts = await db.prepare('SELECT id, ig_user_id, username, account_type, page_id, fb_page_name, fb_user_id, status, disclosure_message, followers_count, full_name, profile_picture_url, created_at, updated_at FROM instagram_accounts WHERE user_id = ?').all(userId);
    const accountIds = (rawAccounts || []).map(a => a.id);

    // Fetch automation rules and conversation activity for user's accounts
    let rules = [];
    let activity = [];
    let conversations = [];
    if (accountIds.length > 0) {
      const placeholders = accountIds.map(() => '?').join(',');
      rules = await db.prepare(`SELECT id, instagram_account_id, type, trigger_keyword, match_mode, reply_message, is_active, fire_count, created_at, updated_at FROM automation_rules WHERE instagram_account_id IN (${placeholders})`).all(...accountIds);
      activity = await db.prepare(`SELECT id, instagram_account_id, event_date, dms_sent, comments_replied, created_at FROM activity_log WHERE instagram_account_id IN (${placeholders})`).all(...accountIds);
      const rawConvs = await db.prepare(`SELECT id, instagram_account_id, ig_scoped_user_id, username, name, last_message, status, last_user_message_at, created_at, updated_at FROM conversations WHERE instagram_account_id IN (${placeholders}) ORDER BY updated_at DESC LIMIT 100`).all(...accountIds);

      for (const conv of (rawConvs || [])) {
        const msgs = await db.prepare('SELECT id, direction, content, status, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conv.id);
        conversations.push({ ...conv, messages: msgs || [] });
      }
    }

    const exportBundle = {
      export_version: '1.0',
      exported_at: new Date().toISOString(),
      compliance: 'GDPR Article 20 / CCPA Data Portability Compliance',
      data_controller: 'Airvix Inc.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        dm_usage_this_period: user.dm_usage_this_period,
        usage_period_start: user.usage_period_start,
        created_at: user.created_at,
      },
      instagram_accounts: rawAccounts || [],
      automation_rules: rules || [],
      activity_logs: activity || [],
      conversations,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="airvix-user-data-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(exportBundle);
  } catch (err) {
    console.error('[Auth] Data export error:', err.message);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

// DELETE /api/auth/me (GDPR Right to Erasure / Account Deletion)
router.delete('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Optional confirmation password check if password was provided in body
    if (req.body && req.body.password && user.password_hash) {
      const valid = await bcrypt.compare(req.body.password, user.password_hash);
      if (!valid) return res.status(400).json({ error: 'Incorrect password confirmation.' });
    }

    // Direct deletion in SQLite and PostgreSQL with Cascade
    await db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    if (db.getPgPool && db.getPgPool()) {
      try {
        await db.getPgPool().query('DELETE FROM users WHERE id = $1', [userId]);
      } catch (pgErr) {
        console.warn('[Auth] PG cascade delete warning:', pgErr.message);
      }
    }

    console.log(`[Auth] 🗑️ User ${userId} and all associated multi-tenant data permanently deleted.`);
    res.json({
      success: true,
      message: 'Your account and all associated Instagram accounts, rules, conversations, and data have been permanently erased.'
    });
  } catch (err) {
    console.error('[Auth] Delete account error:', err.message);
    res.status(500).json({ error: 'Failed to delete account. Please try again.' });
  }
});

// POST /api/auth/logout  (stateless — client just drops the token)
router.post('/logout', (_req, res) => {
  res.json({ success: true });
});

module.exports = router;
