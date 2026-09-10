// backend/src/routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All endpoints in this router require authentication and admin privileges
router.use(requireAuth);
router.use(requireAdmin);

// Default site settings template
const DEFAULT_SITE_SETTINGS = {
  announcement_enabled: true,
  announcement_text: '🚀 Special Launch: Get 30% OFF Pro Plans with code AIRVIX30',
  announcement_badge: 'LIMITED OFFER',
  announcement_link: '#pricing',
  hero_headline: 'Turn conversations into customers.',
  hero_subtitle: 'Automate replies, engage your audience, and convert Instagram comments into sales automatically.',
  primary_cta_text: 'Get Started Free',
  primary_cta_url: '#signup',
  demo_keyword: 'GROWTH',
  support_email: 'support@airvix.com',
  maintenance_mode: false,
  allow_registrations: true,
  free_dm_limit: 1000,
};

// ── GET /api/admin/overview ──────────────────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    // 1. Total users
    const usersCountRow = await db.prepare('SELECT COUNT(*) as count FROM users').get();
    const totalUsers = parseInt(usersCountRow?.count || 0, 10);

    // 2. Users by plan
    const plansRows = await db.prepare('SELECT plan, COUNT(*) as count FROM users GROUP BY plan').all();
    const planBreakdown = {
      free: 0,
      pro: 0,
      agency: 0,
      enterprise: 0,
    };
    (plansRows || []).forEach(row => {
      const p = (row.plan || 'free').toLowerCase();
      if (planBreakdown[p] !== undefined) {
        planBreakdown[p] = parseInt(row.count, 10);
      } else {
        planBreakdown[p] = parseInt(row.count, 10);
      }
    });

    // 3. Connected Instagram Accounts
    const igAccountsRow = await db.prepare('SELECT COUNT(*) as count FROM instagram_accounts').get();
    const totalIgAccounts = parseInt(igAccountsRow?.count || 0, 10);

    // 4. Automation Rules
    const totalRulesRow = await db.prepare('SELECT COUNT(*) as count FROM automation_rules').get();
    const activeRulesRow = await db.prepare('SELECT COUNT(*) as count FROM automation_rules WHERE is_active = 1').get();
    const totalRules = parseInt(totalRulesRow?.count || 0, 10);
    const activeRules = parseInt(activeRulesRow?.count || 0, 10);

    // 5. Total Activity (Comments replied & DMs sent across the whole platform)
    const activityRow = await db.prepare('SELECT SUM(dms_sent) as total_dms, SUM(comments_replied) as total_comments FROM activity_log').get();
    const totalDmsSent = parseInt(activityRow?.total_dms || 0, 10);
    const totalCommentsReplied = parseInt(activityRow?.total_comments || 0, 10);

    // 6. MRR Estimation (Pro: $29/mo, Agency: $79/mo, Enterprise: $199/mo)
    const estimatedMrr = (planBreakdown.pro * 29) + (planBreakdown.agency * 79) + ((planBreakdown.enterprise || 0) * 199);

    // 7. Recent 6 signups
    const recentUsers = await db.prepare(`
      SELECT id, email, name, plan, role, status, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 6
    `).all();

    res.json({
      totalUsers,
      planBreakdown,
      totalIgAccounts,
      totalRules,
      activeRules,
      totalDmsSent,
      totalCommentsReplied,
      estimatedMrr,
      recentUsers: recentUsers || [],
      systemHealth: {
        database: 'Connected (PostgreSQL)',
        metaApi: 'Online',
        webhooks: 'Operational',
        uptime: '99.98%',
      }
    });
  } catch (err) {
    console.error('[Admin] Overview error:', err);
    res.status(500).json({ error: 'Failed to fetch admin overview' });
  }
});

// ── GET /api/admin/users ─────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { search = '', plan = '', status = '', role = '', limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        u.id, 
        u.email, 
        u.name, 
        u.plan, 
        u.role, 
        u.status, 
        u.dm_usage_this_period, 
        u.usage_period_start, 
        u.created_at,
        COUNT(DISTINCT ig.id) AS connected_accounts_count,
        COUNT(DISTINCT r.id) AS rules_count
      FROM users u
      LEFT JOIN instagram_accounts ig ON ig.user_id = u.id
      LEFT JOIN automation_rules r ON r.instagram_account_id = ig.id
      WHERE 1=1
    `;
    const params = [];

    if (search.trim()) {
      query += ` AND (LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR u.id LIKE ?)`;
      const term = `%${search.toLowerCase().trim()}%`;
      params.push(term, term, term);
    }

    if (plan.trim()) {
      query += ` AND u.plan = ?`;
      params.push(plan.toLowerCase().trim());
    }

    if (status.trim()) {
      query += ` AND u.status = ?`;
      params.push(status.toLowerCase().trim());
    }

    if (role.trim()) {
      query += ` AND u.role = ?`;
      params.push(role.toLowerCase().trim());
    }

    query += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const users = await db.prepare(query).all(...params);

    // Count query
    let countQuery = `SELECT COUNT(*) as total FROM users u WHERE 1=1`;
    const countParams = [];
    if (search.trim()) {
      countQuery += ` AND (LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR u.id LIKE ?)`;
      const term = `%${search.toLowerCase().trim()}%`;
      countParams.push(term, term, term);
    }
    if (plan.trim()) {
      countQuery += ` AND u.plan = ?`;
      countParams.push(plan.toLowerCase().trim());
    }
    if (status.trim()) {
      countQuery += ` AND u.status = ?`;
      countParams.push(status.toLowerCase().trim());
    }
    if (role.trim()) {
      countQuery += ` AND u.role = ?`;
      countParams.push(role.toLowerCase().trim());
    }

    const countRow = await db.prepare(countQuery).get(...countParams);
    const total = parseInt(countRow?.total || 0, 10);

    res.json({
      users: (users || []).map(u => ({
        ...u,
        connected_accounts_count: parseInt(u.connected_accounts_count || 0, 10),
        rules_count: parseInt(u.rules_count || 0, 10),
      })),
      total,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (err) {
    console.error('[Admin] Get users error:', err);
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

// ── PATCH /api/admin/users/:id ───────────────────────────────────────
router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, role, status, name, reset_dm_usage } = req.body;

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = [];
    const params = [];

    if (plan !== undefined) {
      const validPlans = ['free', 'pro', 'agency', 'enterprise'];
      if (!validPlans.includes(plan.toLowerCase())) {
        return res.status(400).json({ error: 'Invalid plan name. Must be free, pro, agency, or enterprise' });
      }
      updates.push('plan = ?');
      params.push(plan.toLowerCase());
    }

    if (role !== undefined) {
      const validRoles = ['user', 'admin'];
      if (!validRoles.includes(role.toLowerCase())) {
        return res.status(400).json({ error: 'Invalid role. Must be user or admin' });
      }
      updates.push('role = ?');
      params.push(role.toLowerCase());
    }

    if (status !== undefined) {
      const validStatuses = ['active', 'suspended'];
      if (!validStatuses.includes(status.toLowerCase())) {
        return res.status(400).json({ error: 'Invalid status. Must be active or suspended' });
      }
      updates.push('status = ?');
      params.push(status.toLowerCase());
    }

    if (name !== undefined && name.trim()) {
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (reset_dm_usage) {
      updates.push('dm_usage_this_period = 0');
    }

    if (updates.length > 0) {
      updates.push('updated_at = to_char(NOW(), \'YYYY-MM-DD HH24:MI:SS\')');
      params.push(id);
      await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updatedUser = await db.prepare('SELECT id, email, name, plan, role, status, dm_usage_this_period, created_at, updated_at FROM users WHERE id = ?').get(id);
    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (err) {
    console.error('[Admin] Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── GET /api/admin/settings ──────────────────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    const rows = await db.prepare('SELECT key, value FROM site_settings').all();
    const settingsMap = {};
    (rows || []).forEach(r => {
      try {
        settingsMap[r.key] = JSON.parse(r.value);
      } catch (e) {
        settingsMap[r.key] = r.value;
      }
    });

    // Merge with defaults
    const finalSettings = { ...DEFAULT_SITE_SETTINGS, ...settingsMap };
    res.json({ settings: finalSettings });
  } catch (err) {
    console.error('[Admin] Get settings error:', err);
    res.status(500).json({ error: 'Failed to fetch site settings' });
  }
});

// ── PUT /api/admin/settings ──────────────────────────────────────────
router.put('/settings', async (req, res) => {
  try {
    const settings = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings payload must be an object' });
    }

    for (const [key, val] of Object.entries(settings)) {
      const serialized = typeof val === 'string' ? JSON.stringify(val) : JSON.stringify(val);
      // Upsert into site_settings
      const existing = await db.prepare('SELECT key FROM site_settings WHERE key = ?').get(key);
      if (existing) {
        await db.prepare('UPDATE site_settings SET value = ?, updated_at = to_char(NOW(), \'YYYY-MM-DD HH24:MI:SS\') WHERE key = ?').run(serialized, key);
      } else {
        await db.prepare('INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, to_char(NOW(), \'YYYY-MM-DD HH24:MI:SS\'))').run(key, serialized);
      }
    }

    res.json({ message: 'Website customization settings saved successfully' });
  } catch (err) {
    console.error('[Admin] Save settings error:', err);
    res.status(500).json({ error: 'Failed to save site settings' });
  }
});

module.exports = router;
