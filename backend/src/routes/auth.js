// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, plan: user.plan },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const password_hash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const now = new Date().toISOString();
    const displayName = name || email.split('@')[0];

    await db.prepare(`
      INSERT INTO users (id, email, name, plan, password_hash, dm_usage_this_period, usage_period_start, created_at, updated_at)
      VALUES (?, ?, ?, 'free', ?, 0, ?, ?, ?)
    `).run(userId, email.toLowerCase().trim(), displayName, password_hash, now.slice(0, 10), now, now);

    const user = await db.prepare('SELECT id, email, name, plan FROM users WHERE id = ?').get(userId);
    const token = makeToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = makeToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me  (requires auth)
router.get('/me', requireAuth, async (req, res) => {
  const user = await db.prepare('SELECT id, email, name, plan, dm_usage_this_period, usage_period_start, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
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
      data_controller: 'ReplyOS Inc.',
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
    res.setHeader('Content-Disposition', `attachment; filename="replyos-user-data-${new Date().toISOString().slice(0, 10)}.json"`);
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
