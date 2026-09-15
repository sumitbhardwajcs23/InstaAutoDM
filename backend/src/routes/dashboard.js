// backend/src/routes/dashboard.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const redisClient = require('../services/redisClient');
const quotaService = require('../services/quotaService');
const { accountHealthService } = require('../services/accountHealthService');
const { HEALTH_CONFIG } = require('../constants/healthConfig');

async function getAccountForUser(userId, accountId) {
  if (!userId) return null;
  const pool = db.getPgPool ? db.getPgPool() : null;

  if (pool) {
    if (accountId && accountId !== 'default') {
      const conn = await pool.query(`
        SELECT ig.* FROM instagram_accounts ig
        JOIN instagram_account_connections c ON c.instagram_account_id = ig.id
        WHERE c.user_id = $1 AND ig.id = $2 AND c.status = 'active'
        LIMIT 1
      `, [userId, accountId]).catch(() => null);
      if (conn?.rows?.[0]) return conn.rows[0];

      const legacy = await pool.query(`
        SELECT * FROM instagram_accounts WHERE user_id = $1 AND id = $2 LIMIT 1
      `, [userId, accountId]).catch(() => null);
      if (legacy?.rows?.[0]) return legacy.rows[0];
    }

    // Default: find latest actively connected account
    const conn = await pool.query(`
      SELECT ig.* FROM instagram_accounts ig
      JOIN instagram_account_connections c ON c.instagram_account_id = ig.id
      WHERE c.user_id = $1 AND c.status = 'active'
      ORDER BY c.connected_at DESC LIMIT 1
    `, [userId]).catch(() => null);
    if (conn?.rows?.[0]) return conn.rows[0];

    const legacy = await pool.query(`
      SELECT * FROM instagram_accounts WHERE user_id = $1 AND status = 'connected'
      ORDER BY updated_at DESC LIMIT 1
    `, [userId]).catch(() => null);
    return legacy?.rows?.[0] || null;
  }

  // SQLite fallback
  if (accountId && accountId !== 'default') {
    return await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND id = ? LIMIT 1").get(userId, accountId);
  }
  return await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected' ORDER BY updated_at DESC LIMIT 1").get(userId);
}

// In-flight request coalescing: prevents N concurrent cold-cache requests for the
// same user from each opening multiple separate DB queries.
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
        const [account, authoritative] = await Promise.all([
          getAccountForUser(userId, req.query.account_id),
          quotaService.getAuthoritativeUsage(userId)
        ]);

        let user = null;
        try {
          const pool = db.getPgPool ? db.getPgPool() : null;
          if (pool) {
            const uRes = await pool.query('SELECT id, email, name, plan, subscription_status, custom_dm_limit, custom_daily_limit FROM users WHERE id = $1', [userId]);
            user = uRes.rows[0];
          } else {
            user = await db.prepare('SELECT id, email, name, plan, subscription_status, custom_dm_limit, custom_daily_limit FROM users WHERE id = ?').get(userId);
          }
        } catch (_) {}

        if (!user && userId) {
          const email = req.user.email || `${userId}@user.local`;
          const name = req.user.name || 'Creator';
          const now = new Date().toISOString();
          try {
            await db.prepare(`
              INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at)
              VALUES (?, ?, ?, 'free', 0, ?, ?, ?)
            `).run(userId, email, name, now.slice(0, 10), now, now);
            user = { id: userId, email, name, plan: 'free' };
          } catch (_) {
            user = { id: userId, dm_usage_this_period: 0, plan: 'free' };
          }
        }

        const effectivePlan = authoritative.effectivePlan;
        const monthlyLimit = authoritative.monthly_limit;
        const dailyLimit = authoritative.daily_limit;
        const totalRepliesUsed = authoritative.total_replies_used;
        const dmsSent = authoritative.dms_sent;
        const commentsRepliedCount = authoritative.comments_replied;
        const dailyRepliesUsed = authoritative.daily_replies_used;
        const dailyRemaining = authoritative.daily_remaining;
        const availableQuota = authoritative.available_quota;
        const usagePercent = authoritative.percent_used;
        const subscriptionBadge = authoritative.subscription_badge;
        const accountsBreakdown = authoritative.accounts_breakdown || [];

        // If no active account connected
        if (!account) {
          const fallbackResponse = {
            connected: false,
            account: null,
            user: {
              id: user?.id || userId,
              name: user?.name || 'Creator',
              email: user?.email || '',
              plan: effectivePlan,
              subscription_badge: subscriptionBadge,
              monthly_limit: monthlyLimit,
              daily_limit: dailyLimit
            },
            totalDmsSent: totalRepliesUsed,
            totalRepliesUsed,
            dmsSent,
            commentsReplied: 0,
            commentsRepliedCount,
            commentsRepliedChange: 0,
            activeRules: 0,
            totalRules: 0,
            dmUsage: totalRepliesUsed,
            dmLimit: monthlyLimit,
            monthlyLimit,
            dailyLimit,
            dailyRepliesUsed,
            usedToday: dailyRepliesUsed,
            remainingToday: dailyRemaining,
            dailyRemaining,
            dmRemaining: availableQuota,
            remaining: availableQuota,
            subscriptionBadge,
            usagePercent,
            accountHealthy: false,
            accountsBreakdown,
            stats: {
              dms_sent_period: totalRepliesUsed,
              dms_sent: dmsSent,
              comments_replied_period: commentsRepliedCount,
              total_replies_used: totalRepliesUsed,
              dms_limit: monthlyLimit,
              monthly_limit: monthlyLimit,
              dms_daily_limit: dailyLimit,
              daily_limit: dailyLimit,
              daily_replies_used: dailyRepliesUsed,
              used_today: dailyRepliesUsed,
              remaining_today: dailyRemaining,
              remaining: availableQuota,
              subscription_badge: subscriptionBadge,
              dm_percent: usagePercent,
              percent_used: usagePercent,
              comments_replied: 0,
              active_rules: 0,
              total_rules: 0,
              accounts_breakdown: enrichedAccountsBreakdown
            },
            recent_conversations: []
          };
          redisClient.set(cacheKey, fallbackResponse, 30).catch(() => {});
          return fallbackResponse;
        }

        // Parallel account-level queries (comments sent this month, rules count, conversations)
        const pool = db.getPgPool ? db.getPgPool() : null;
        let commentsThisMonth = 0;
        let commentsLastMonth = 0;
        let rulesAgg = { total: 0, active: 0 };
        let rawConversations = [];

        if (pool) {
          const [cRes, rRes, convRes] = await Promise.all([
            pool.query(`
              SELECT
                COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) AS this_month,
                COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND created_at < date_trunc('month', NOW())) AS last_month
              FROM comment_replies
              WHERE instagram_account_id = $1 AND status = 'sent'
            `, [account.id]).catch(() => ({ rows: [] })),
            pool.query(`
              SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE is_active = 1) AS active
              FROM automation_rules
              WHERE instagram_account_id = $1
            `, [account.id]).catch(() => ({ rows: [] })),
            pool.query(`
              SELECT * FROM conversations
              WHERE instagram_account_id = $1
              ORDER BY updated_at DESC
              LIMIT 5
            `, [account.id]).catch(() => ({ rows: [] }))
          ]);

          commentsThisMonth = Number(cRes.rows[0]?.this_month || 0);
          commentsLastMonth = Number(cRes.rows[0]?.last_month || 0);
          rulesAgg = {
            total: Number(rRes.rows[0]?.total || 0),
            active: Number(rRes.rows[0]?.active || 0)
          };
          rawConversations = convRes.rows || [];
        } else {
          // SQLite fallback
          const [cThis, cLast, rAgg, convs] = await Promise.all([
            db.prepare(`SELECT COUNT(*) as count FROM comment_replies WHERE instagram_account_id = ? AND status = 'sent' AND created_at >= date('now','start of month')`).get(account.id).catch(() => ({ count: 0 })),
            db.prepare(`SELECT COUNT(*) as count FROM comment_replies WHERE instagram_account_id = ? AND status = 'sent' AND created_at >= date('now','start of month','-1 month') AND created_at < date('now','start of month')`).get(account.id).catch(() => ({ count: 0 })),
            db.prepare("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = 1) as active FROM automation_rules WHERE instagram_account_id = ?").get(account.id).catch(() => ({ total: 0, active: 0 })),
            db.prepare(`SELECT * FROM conversations WHERE instagram_account_id = ? ORDER BY updated_at DESC LIMIT 5`).all(account.id).catch(() => [])
          ]);
          commentsThisMonth = Number(cThis?.count || 0);
          commentsLastMonth = Number(cLast?.count || 0);
          rulesAgg = { total: Number(rAgg?.total || 0), active: Number(rAgg?.active || 0) };
          rawConversations = convs || [];
        }

        const changePercent = commentsLastMonth > 0
          ? Math.round(((commentsThisMonth - commentsLastMonth) / commentsLastMonth) * 100)
          : 0;

        const activeRules = Number(rulesAgg?.active || 0);
        const totalRules = Number(rulesAgg?.total || 0);

        const recent_conversations = (rawConversations || []).map(c => {
          const lastUserTime = new Date(c.last_user_message_at || c.updated_at).getTime();
          return {
            ...c,
            last_message_at: c.updated_at || c.last_user_message_at,
            is_window_active: (lastUserTime + 24 * 3600000) > Date.now()
          };
        });

        const enrichedAccountsBreakdown = await Promise.all(
          accountsBreakdown.map(async (acc) => {
            const h = await accountHealthService.getAccountHealth(acc.account_id);
            return {
              ...acc,
              health_status: h?.health_status || 'HEALTHY',
              health_score: h?.health_score ?? 100,
              automation_mode: h?.automation_mode || 'NORMAL',
              observed_risk_level: h?.observed_risk_level || 'low'
            };
          })
        );

        const accountHealth = account ? await accountHealthService.getAccountHealth(account.id) : null;

        const responsePayload = {
          connected: true,
          accountHealth: accountHealth ? {
            health_score: accountHealth.health_score,
            health_status: accountHealth.health_status,
            automation_mode: accountHealth.automation_mode,
            observed_risk_level: accountHealth.observed_risk_level,
            consecutive_failures: accountHealth.consecutive_failures,
            rolling_24h_successes: accountHealth.rolling_24h_successes,
            rolling_24h_failures: accountHealth.rolling_24h_failures,
            observed_rate_limit_count: accountHealth.observed_rate_limit_count,
            recent_error_rate: accountHealth.recent_error_rate,
            score_reasons: accountHealth.score_reasons,
            last_incident_at: accountHealth.last_incident_at,
            last_incident_type: accountHealth.last_incident_type,
            pacing_delay_ms: accountHealth.automation_mode === 'PROTECTION'
              ? HEALTH_CONFIG.PACING_DELAYS.PROTECTION_PADDING_MS
              : (accountHealth.automation_mode === 'CAUTION' ? HEALTH_CONFIG.PACING_DELAYS.CAUTION_PADDING_MS : 0)
          } : null,
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
            id: user?.id || userId, 
            name: user?.name || 'Creator', 
            email: user?.email || '', 
            plan: effectivePlan,
            subscription_badge: subscriptionBadge,
            monthly_limit: monthlyLimit,
            daily_limit: dailyLimit
          },
          // Authoritative unified reply quota metrics
          totalDmsSent: totalRepliesUsed,
          totalRepliesUsed,
          dmsSent,
          commentsRepliedCount,
          dmLimit: monthlyLimit,
          monthlyLimit,
          dailyLimit,
          dailyRepliesUsed,
          usedToday: dailyRepliesUsed,
          remainingToday: dailyRemaining,
          dailyRemaining,
          subscriptionBadge,
          dmRemaining: availableQuota,
          remaining: availableQuota,
          usagePercent,
          accountsBreakdown: enrichedAccountsBreakdown,
          // Operational metrics
          commentsReplied: commentsThisMonth,
          commentsRepliedChange: changePercent,
          activeRules,
          totalRules,
          maxRules: 5,
          accountHealthy: account.status === 'connected',
          stats: {
            dms_sent_period: totalRepliesUsed,
            dms_sent: dmsSent,
            comments_replied_period: commentsRepliedCount,
            total_replies_used: totalRepliesUsed,
            dms_limit: monthlyLimit,
            monthly_limit: monthlyLimit,
            dms_daily_limit: dailyLimit,
            daily_limit: dailyLimit,
            daily_replies_used: dailyRepliesUsed,
            used_today: dailyRepliesUsed,
            remaining_today: dailyRemaining,
            remaining: availableQuota,
            subscription_badge: subscriptionBadge,
            dm_percent: usagePercent,
            percent_used: usagePercent,
            comments_replied: commentsThisMonth,
            active_rules: activeRules,
            total_rules: totalRules,
            accounts_breakdown: accountsBreakdown
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
