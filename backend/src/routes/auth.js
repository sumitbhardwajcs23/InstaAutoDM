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

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const password_hash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const now = new Date().toISOString();
    const displayName = name || email.split('@')[0];

    db.prepare(`
      INSERT INTO users (id, email, name, plan, password_hash, dm_usage_this_period, usage_period_start, created_at, updated_at)
      VALUES (?, ?, ?, 'free', ?, 0, ?, ?, ?)
    `).run(userId, email.toLowerCase().trim(), displayName, password_hash, now.slice(0, 10), now, now);

    const user = db.prepare('SELECT id, email, name, plan FROM users WHERE id = ?').get(userId);
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

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    // Allow login without password for seed/demo users (no hash set)
    if (user.password_hash) {
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = makeToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me  (requires auth)
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name, plan, dm_usage_this_period, usage_period_start, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});


// POST /api/auth/demo-login
router.post('/demo-login', async (req, res) => {
  try {
    const demoEmail = 'devid@instareply.io';
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(demoEmail);
    const now = new Date().toISOString();
    
    if (!user) {
      const userId = uuidv4();
      db.prepare(`
        INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at)
        VALUES (?, ?, 'Devid Sharma', 'free', 620, ?, ?, ?)
      `).run(userId, demoEmail, now.slice(0, 10), now, now);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    }

    // Ensure @luna.creates account exists for user
    let acc = db.prepare('SELECT * FROM instagram_accounts WHERE user_id = ?').get(user.id);
    if (!acc) {
      const existingByIg = db.prepare("SELECT * FROM instagram_accounts WHERE ig_user_id = '17841405309211849'").get();
      if (existingByIg) {
        db.prepare('UPDATE instagram_accounts SET user_id = ? WHERE id = ?').run(user.id, existingByIg.id);
        acc = db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(existingByIg.id);
      } else {
        const accId = uuidv4();
        db.prepare(`
          INSERT INTO instagram_accounts (
            id, user_id, ig_user_id, username, account_type, page_id,
            access_token_enc, token_expires_at, status, disclosure_message,
            followers_count, created_at, updated_at
          ) VALUES (?, ?, '17841405309211849', 'luna.creates', 'Business Account', '102938475629102', 'mock_token', ?, 'connected', '⚡ [Automated DM] ', 24800, ?, ?)
        `).run(accId, user.id, new Date(Date.now() + 60 * 86400 * 1000).toISOString(), now, now);
        acc = db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(accId);
      }
    }

    const token = makeToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
  } catch (err) {
    console.error('[Auth] Demo login error:', err);
    res.status(500).json({ error: 'Demo login failed' });
  }
});

// POST /api/auth/logout  (stateless — client just drops the token)
router.post('/logout', (_req, res) => {
  res.json({ success: true });
});

module.exports = router;
