// backend/src/routes/usage.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const queue = require('../services/queue');

const FREE_CAP = parseInt(process.env.FREE_PLAN_DM_LIMIT || '1000', 10);

router.get('/', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const account = db.prepare("SELECT id FROM instagram_accounts WHERE user_id = ? AND status = 'connected' LIMIT 1").get(req.user.id)
               || db.prepare("SELECT id FROM instagram_accounts WHERE status = 'connected' LIMIT 1").get();
  
  const totalSentReplies = account ? db.prepare("SELECT COUNT(*) as c FROM comment_replies WHERE status='sent' AND instagram_account_id=?").get(account.id)?.c || 0 : 0;
  const totalSentDMs = account ? db.prepare("SELECT COUNT(*) as c FROM messages WHERE direction='outbound' AND status='sent' AND conversation_id IN (SELECT id FROM conversations WHERE instagram_account_id=?)").get(account.id)?.c || 0 : 0;
  const usagePercent = Math.min(100, Math.round((user.dm_usage_this_period / FREE_CAP) * 100));

  const slidingWindows = account ? queue.getRateLimitStatus(account.id) : {
    private_replies_last_hour: 0,
    private_reply_limit_per_hour: 120,
    dms_last_minute: 0,
    dm_limit_per_minute: 30
  };

  res.json({
    plan: user.plan,
    dms_sent: user.dm_usage_this_period,
    dm_usage_this_period: user.dm_usage_this_period,
    dm_limit: FREE_CAP,
    monthly_limit: FREE_CAP,
    percent_used: usagePercent,
    usage_percent: usagePercent,
    usage_period_start: user.usage_period_start,
    is_capped: user.dm_usage_this_period >= FREE_CAP,
    dm_remaining: Math.max(0, FREE_CAP - user.dm_usage_this_period),
    sliding_windows: slidingWindows,
    stats: { total_sent_replies: totalSentReplies, total_sent_dms: totalSentDMs, total_all_sent: totalSentReplies + totalSentDMs }
  });
});

router.post('/reset', (req, res) => {
  db.prepare("UPDATE users SET dm_usage_this_period=0, usage_period_start=date('now') WHERE id=?").run(req.user.id);
  res.json({ success: true, dms_sent_period: 0 });
});

module.exports = router;
