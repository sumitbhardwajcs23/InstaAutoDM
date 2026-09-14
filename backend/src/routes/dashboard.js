// backend/src/routes/dashboard.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { dmLimitFor, dailyLimitFor, badgeFor } = require('../constants/planLimits');
const redisClient = require('../services/redisClient');

async function getAccountForUser(userId, accountId) {
  if (!userId) return null;
  if (accountId) {
    return await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND id = ? LIMIT 1").get(userId, accountId);
  }
  return await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected' ORDER BY updated_at DESC LIMIT 1").get(userId);
}

// In-flight request coalescing: prevents N concurrent cold-cache requests for the
// same user from each opening 5 separate DB queries. All concurrent callers
// await the same promise; only ONE DB fetch round-trip is issued.
const inflightDashboard = new Map();

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  const userId = req.user.id;
  const requestedAccountId = req.query.account_id || 'default';
  const cacheKey = `cache:dash:${userId}:${requestedAccountId}`;

  // 1. Non-authoritative Redis/memory read-through cache check
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }
  } catch (_) {}

  // 2. In-flight coalescing
  const coalescingKey = `${userId}:${requestedAccountId}`;
  let fetchPromise = inflightDashboard.get(coalescingKey);
  if (!fetchPromise) {
    fetchPromise = (async () => {
      try {
        const [account, initialUser] = await Promise.all([
          getAccountForUser(userId, req.query.account_id),
          db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
        ]);

        let user = initialUser;
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

        const activeSub = await db.prepare(`
          SELECT plan, status FROM subscriptions 
          WHERE user_id = ? AND status IN ('active', 'trialing') 
          ORDER BY created_at DESC LIMIT 1
        `).get(userId).catch(() => null);

        const subStatus = activeSub?.status || user?.subscription_status || 'active';
        const isEntitled = ['active', 'trialing', 'grace_period'].includes(subStatus) && subStatus !== 'reconciliation_required';
        const effectivePlan = isEntitled ? ((activeSub?.plan || user?.plan || 'free').toLowerCase()) : 'free';
        const userPlanLimit = dmLimitFor(effectivePlan, user?.custom_dm_limit);
        const dailyPlanLimit = dailyLimitFor(effectivePlan, user?.custom_daily_limit, user?.custom_dm_limit);
        const subscriptionBadge = badgeFor(effectivePlan);

        if (!account || !user) {
          const fallbackResponse = {
            connected: false,
            account: null,
            totalDmsSent: 0,
            commentsReplied: 0,
            commentsRepliedChange: 0,
            activeRules: 0,
            totalRules: 0,
            dmUsage: 0,
            dmLimit: userPlanLimit,
            dailyLimit: dailyPlanLimit,
            monthlyLimit: userPlanLimit,
            subscriptionBadge,
            usagePercent: 0,
            accountHealthy: false
          };
          redisClient.set(cacheKey, fallbackResponse, 30).catch(() => {});
          return fallbackResponse;
        }

        // 3. Execute all independent aggregation queries in parallel
        const [
          counterRow,
          rulesAgg,
          commentsThisMonthRow,
          commentsLastMonthRow,
          rawConversations
        ] = await Promise.all([
          db.prepare("SELECT dms_sent FROM usage_counters WHERE user_id = ? LIMIT 1").get(userId).catch(() => null),
          db.prepare("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = 1) as active FROM automation_rules WHERE instagram_account_id = ?").get(account.id).catch(() => ({ total: 0, active: 0 })),
          db.prepare(`
            SELECT COUNT(*) as count FROM comment_replies 
            WHERE instagram_account_id = ? AND status = 'sent'
            AND created_at >= date('now','start of month')
          `).get(account.id).catch(() => ({ count: 0 })),
          db.prepare(`
            SELECT COUNT(*) as count FROM comment_replies 
            WHERE instagram_account_id = ? AND status = 'sent'
            AND created_at >= date('now','start of month','-1 month')
            AND created_at < date('now','start of month')
          `).get(account.id).catch(() => ({ count: 0 })),
          db.prepare(`
            SELECT * FROM conversations
            WHERE instagram_account_id = ?
            ORDER BY updated_at DESC
            LIMIT 5
          `).all(account.id).catch(() => [])
        ]);

        const totalDmsSent = counterRow?.dms_sent !== undefined ? Number(counterRow.dms_sent) : (user.dm_usage_this_period || 0);
        const commentsThisMonth = commentsThisMonthRow?.count || 0;
        const commentsLastMonth = commentsLastMonthRow?.count || 0;
        const changePercent = commentsLastMonth > 0
          ? Math.round(((commentsThisMonth - commentsLastMonth) / commentsLastMonth) * 100)
          : 0;

        const activeRules = Number(rulesAgg?.active || 0);
        const totalRules = Number(rulesAgg?.total || 0);
        const usagePercent = Math.min(100, Math.round((totalDmsSent / (userPlanLimit || 1)) * 100));

        const recent_conversations = (rawConversations || []).map(c => {
          const lastUserTime = new Date(c.last_user_message_at || c.updated_at).getTime();
          return {
            ...c,
            last_message_at: c.updated_at || c.last_user_message_at,
            is_window_active: (lastUserTime + 24 * 3600000) > Date.now()
          };
        });

        const responsePayload = {
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
          user: { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            plan: effectivePlan,
            subscription_badge: subscriptionBadge,
            monthly_limit: userPlanLimit,
            daily_limit: dailyPlanLimit
          },
          totalDmsSent,
          dmLimit: userPlanLimit,
          monthlyLimit: userPlanLimit,
          dailyLimit: dailyPlanLimit,
          subscriptionBadge,
          dmRemaining: Math.max(0, userPlanLimit - totalDmsSent),
          usagePercent,
          commentsReplied: commentsThisMonth,
          commentsRepliedChange: changePercent,
          activeRules,
          totalRules,
          maxRules: 5,
          accountHealthy: account.status === 'connected',
          stats: {
            dms_sent_period: totalDmsSent,
            dms_limit: userPlanLimit,
            dms_daily_limit: dailyPlanLimit,
            subscription_badge: subscriptionBadge,
            dm_percent: usagePercent,
            comments_replied: commentsThisMonth,
            active_rules: activeRules,
            total_rules: totalRules
          },
          recent_conversations
        };

        // Cache non-authoritative stats in Redis for 60s
        redisClient.set(cacheKey, responsePayload, 60).catch(() => {});
        return responsePayload;
      } finally {
        inflightDashboard.delete(coalescingKey);
      }
    })();
    inflightDashboard.set(coalescingKey, fetchPromise);
  }

  try {
    const payload = await fetchPromise;
    res.setHeader('X-Cache', 'MISS');
    return res.json(payload);
  } catch (err) {
    console.error('[Dashboard] Error fetching stats:', err.message);
    return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

module.exports = router;
