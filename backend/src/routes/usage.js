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

module.exports = router;
