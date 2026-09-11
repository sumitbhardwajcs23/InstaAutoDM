// backend/src/routes/usage.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const queue = require('../services/queue');
const { dmLimitFor } = require('../constants/planLimits');

router.get('/', async (req, res) => {
  let user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user && req.user.id) {
    const email = req.user.email || `${req.user.id}@user.local`;
    const name = req.user.name || 'Creator';
    const now = new Date().toISOString();
    try {
      await db.prepare(`
        INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at)
        VALUES (?, ?, ?, 'free', 0, ?, ?, ?)
      `).run(req.user.id, email, name, now.slice(0, 10), now, now);
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    } catch (_) {
      user = { id: req.user.id, dm_usage_this_period: 0, plan: 'free' };
    }
  }

  const account = await db.prepare("SELECT id FROM instagram_accounts WHERE user_id = ? AND status = 'connected' LIMIT 1").get(req.user.id);
  
  const totalSentReplies = account ? (await db.prepare("SELECT COUNT(*) as c FROM comment_replies WHERE status='sent' AND instagram_account_id=?").get(account.id))?.c || 0 : 0;
  const totalSentDMs = account ? (await db.prepare("SELECT COUNT(*) as c FROM messages WHERE direction='outbound' AND status='sent' AND conversation_id IN (SELECT id FROM conversations WHERE instagram_account_id=?)").get(account.id))?.c || 0 : 0;
  
  const planLimit = dmLimitFor(user?.plan);
  const usageCount = user?.dm_usage_this_period || 0;
  const usagePercent = Math.min(100, Math.round((usageCount / (planLimit || 1)) * 100));

  const slidingWindows = account ? queue.getRateLimitStatus(account.id) : {
    private_replies_last_hour: 0,
    private_reply_limit_per_hour: 120,
    dms_last_minute: 0,
    dm_limit_per_minute: 30
  };

  res.json({
    plan: user.plan || 'free',
    dms_sent: usageCount,
    dm_usage_this_period: usageCount,
    dm_limit: planLimit,
    monthly_limit: planLimit,
    percent_used: usagePercent,
    usage_percent: usagePercent,
    usage_period_start: user.usage_period_start,
    is_capped: usageCount >= planLimit,
    dm_remaining: Math.max(0, planLimit - usageCount),
    sliding_windows: slidingWindows,
    stats: { total_sent_replies: totalSentReplies, total_sent_dms: totalSentDMs, total_all_sent: totalSentReplies + totalSentDMs }
  });
});

// POST /api/usage/upgrade — Upgrade user plan
router.post('/upgrade', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { plan = 'pro', cycle = 'monthly' } = req.body || {};
    const validPlans = ['pro', 'agency', 'enterprise'];
    const chosenPlan = validPlans.includes((plan || '').toLowerCase()) ? plan.toLowerCase() : 'pro';

    await db.prepare("UPDATE users SET plan = ?, updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') WHERE id = ?").run(chosenPlan, userId);

    // Update or create active subscription record
    const { v4: uuidv4 } = require('uuid');
    const now = new Date();
    const periodStart = now.toISOString();
    const periodEnd = new Date(now.getTime() + (cycle === 'yearly' ? 365 : 30) * 24 * 3600 * 1000).toISOString();
    const sub = await db.prepare("SELECT id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(userId);

    if (sub) {
      await db.prepare(`
        UPDATE subscriptions SET
          plan = ?,
          status = 'active',
          billing_cycle = ?,
          current_period_start = ?,
          current_period_end = ?,
          updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        WHERE id = ?
      `).run(chosenPlan, cycle, periodStart, periodEnd, sub.id);
    } else {
      const subId = `sub_${uuidv4().slice(0, 12)}`;
      await db.prepare(`
        INSERT INTO subscriptions (
          id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at
        ) VALUES (?, ?, ?, 'active', ?, ?, ?, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      `).run(subId, userId, chosenPlan, cycle, periodStart, periodEnd);
    }

    res.json({
      success: true,
      message: `Account successfully upgraded to ${chosenPlan.toUpperCase()}`,
      plan: chosenPlan,
      dm_limit: dmLimitFor(chosenPlan)
    });
  } catch (err) {
    console.error('[Usage] Upgrade error:', err.message);
    res.status(500).json({ error: 'Failed to upgrade plan' });
  }
});

module.exports = router;
