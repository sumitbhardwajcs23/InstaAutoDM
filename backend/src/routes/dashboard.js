// backend/src/routes/dashboard.js
const express = require('express');
const router = express.Router();
const db = require('../db');

const FREE_CAP = parseInt(process.env.FREE_PLAN_DM_LIMIT || '1000', 10);

async function getAccountForUser(userId, accountId) {
  if (accountId) {
    return await db.prepare("SELECT * FROM instagram_accounts WHERE (user_id = ? OR id = ?) AND username NOT IN ('instagram_creator', 'test_creator_account', 'instagram_user', 'connected') LIMIT 1").get(userId, accountId);
  }
  let acc = await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected' AND username NOT IN ('instagram_creator', 'test_creator_account', 'instagram_user', 'connected') ORDER BY updated_at DESC LIMIT 1").get(userId);
  if (acc) return acc;

  // Self-heal: If an active connected account exists in DB, link it to active user
  const anyConnected = await db.prepare("SELECT * FROM instagram_accounts WHERE status = 'connected' AND username NOT IN ('instagram_creator', 'test_creator_account', 'instagram_user', 'connected') ORDER BY updated_at DESC LIMIT 1").get();
  if (anyConnected && userId) {
    try {
      await db.prepare("UPDATE instagram_accounts SET user_id = ? WHERE id = ?").run(userId, anyConnected.id);
    } catch (_) {}
    return anyConnected;
  }
  return null;
}

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  const userId = req.user.id;
  const account = await getAccountForUser(userId, req.query.account_id);
  let user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user && userId) {
    const email = req.user.email || `${userId}@user.local`;
    const name = req.user.name || 'Creator';
    const now = new Date().toISOString();
    try {
      await db.prepare(`
        INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at)
        VALUES (?, ?, ?, 'free', 0, ?, ?, ?)
      `).run(userId, email, name, now.slice(0, 10), now, now);
      user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    } catch (_) {
      user = { id: userId, dm_usage_this_period: 0, plan: 'free' };
    }
  }

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

  const commentsThisMonth = (await db.prepare(`
    SELECT COUNT(*) as count FROM comment_replies 
    WHERE instagram_account_id = ? AND status = 'sent'
    AND created_at >= date('now','start of month')
  `).get(account.id))?.count || 0;

  const commentsLastMonth = (await db.prepare(`
    SELECT COUNT(*) as count FROM comment_replies 
    WHERE instagram_account_id = ? AND status = 'sent'
    AND created_at >= date('now','start of month','-1 month')
    AND created_at < date('now','start of month')
  `).get(account.id))?.count || 0;

  const changePercent = commentsLastMonth > 0
    ? Math.round(((commentsThisMonth - commentsLastMonth) / commentsLastMonth) * 100)
    : 0;

  const activeRules = (await db.prepare('SELECT COUNT(*) as count FROM automation_rules WHERE instagram_account_id = ? AND is_active = 1').get(account.id))?.count || 0;
  const totalRules = (await db.prepare('SELECT COUNT(*) as count FROM automation_rules WHERE instagram_account_id = ?').get(account.id))?.count || 0;
  const usagePercent = Math.min(100, Math.round((totalDmsSent / FREE_CAP) * 100));

  const recent_conversations = (await db.prepare(`
    SELECT * FROM conversations
    WHERE instagram_account_id = ?
    ORDER BY updated_at DESC
    LIMIT 5
  `).all(account.id)).map(c => {
    const lastUserTime = new Date(c.last_user_message_at || c.updated_at).getTime();
    return {
      ...c,
      last_message_at: c.updated_at || c.last_user_message_at,
      is_window_active: (lastUserTime + 24 * 3600000) > Date.now()
    };
  });

  res.json({
    connected: true,
    account: {
      id: account.id,
      username: account.username,
      full_name: account.full_name,
      profile_picture_url: account.profile_picture_url,
      ig_user_id: account.ig_user_id,
      accountType: account.account_type || 'Creator Account',
      account_type: account.account_type || 'Creator Account',
      status: account.status,
      followersCount: account.followers_count || 0,
      followers_count: account.followers_count || 0,
      disclosure_message: account.disclosure_message,
      token_expires_at: account.token_expires_at,
      updated_at: account.updated_at,
      connected_at: account.connected_at
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
    recent_conversations
  });
});

module.exports = router;
