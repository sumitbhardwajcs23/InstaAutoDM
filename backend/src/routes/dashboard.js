// backend/src/routes/dashboard.js
const express = require('express');
const router = express.Router();
const db = require('../db');

const FREE_CAP = parseInt(process.env.FREE_PLAN_DM_LIMIT || '1000', 10);

function getAccountForUser(userId) {
  return db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected' LIMIT 1").get(userId);
}

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
  const userId = req.user.id;
  const account = getAccountForUser(userId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  if (!account || !user) {
    return res.json({
      connected: false,
      account: null,
      totalDmsSent: 0,
      commentsReplied: 0,
      commentsRepliedChange: 0,
      activeRules: 0,
      totalRules: 0,
      dmUsage: 0,
      dmLimit: FREE_CAP,
      usagePercent: 0,
      accountHealthy: false
    });
  }

  const totalDmsSent = user.dm_usage_this_period || 0;

  const commentsThisMonth = db.prepare(`
    SELECT COUNT(*) as count FROM comment_replies 
    WHERE instagram_account_id = ? AND status = 'sent'
    AND created_at >= date('now','start of month')
  `).get(account.id)?.count || 0;

  const commentsLastMonth = db.prepare(`
    SELECT COUNT(*) as count FROM comment_replies 
    WHERE instagram_account_id = ? AND status = 'sent'
    AND created_at >= date('now','start of month','-1 month')
    AND created_at < date('now','start of month')
  `).get(account.id)?.count || 0;

  const changePercent = commentsLastMonth > 0
    ? Math.round(((commentsThisMonth - commentsLastMonth) / commentsLastMonth) * 100)
    : 0;

  const activeRules = db.prepare('SELECT COUNT(*) as count FROM automation_rules WHERE instagram_account_id = ? AND is_active = 1').get(account.id)?.count || 0;
  const totalRules = db.prepare('SELECT COUNT(*) as count FROM automation_rules WHERE instagram_account_id = ?').get(account.id)?.count || 0;
  const usagePercent = Math.min(100, Math.round((totalDmsSent / FREE_CAP) * 100));

  res.json({
    connected: true,
    account: {
      id: account.id,
      username: account.username,
      accountType: account.account_type,
      status: account.status,
      followersCount: account.followers_count,
      disclosure_message: account.disclosure_message,
      token_expires_at: account.token_expires_at
    },
    user: { id: user.id, name: user.name, email: user.email, plan: user.plan },
    totalDmsSent,
    dmLimit: FREE_CAP,
    dmRemaining: Math.max(0, FREE_CAP - totalDmsSent),
    usagePercent,
    commentsReplied: commentsThisMonth,
    commentsRepliedChange: changePercent,
    activeRules,
    totalRules,
    maxRules: 5,
    accountHealthy: account.status === 'connected',
    stats: {
      dms_sent_period: totalDmsSent,
      dms_limit: FREE_CAP,
      dm_percent: usagePercent,
      comments_replied: commentsThisMonth,
      active_rules: activeRules,
      total_rules: totalRules
    },
    recent_conversations: db.prepare(`
      SELECT * FROM conversations
      WHERE instagram_account_id = ?
      ORDER BY updated_at DESC
      LIMIT 5
    `).all(account.id).map(c => {
      const lastUserTime = new Date(c.last_user_message_at || c.updated_at).getTime();
      return {
        ...c,
        last_message_at: c.updated_at || c.last_user_message_at,
        is_window_active: (lastUserTime + 24 * 3600000) > Date.now()
      };
    })
  });
});

module.exports = router;
