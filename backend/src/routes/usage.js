// backend/src/routes/usage.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const queue = require('../services/queue');
const { dmLimitFor, dailyLimitFor, badgeFor } = require('../constants/planLimits');
const quotaService = require('../services/quotaService');

const redisClient = require('../services/redisClient');
const inflightUsage = new Map();

router.get('/', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const cacheKey = `cache:usage:${userId}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }
  } catch (_) {}

  if (inflightUsage.has(userId)) {
    try {
      const coalesced = await inflightUsage.get(userId);
      if (coalesced) {
        res.setHeader('X-Cache', 'COALESCED');
        return res.json(coalesced);
      }
    } catch (_) {}
  }

  const fetchPromise = (async () => {
    try {
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

      const account = await db.prepare("SELECT id FROM instagram_accounts WHERE user_id = ? AND status = 'connected' LIMIT 1").get(userId);
      
      const totalSentReplies = account ? (await db.prepare("SELECT COUNT(*) as c FROM comment_replies WHERE status='sent' AND instagram_account_id=?").get(account.id))?.c || 0 : 0;
      const totalSentDMs = account ? (await db.prepare("SELECT COUNT(*) as c FROM messages WHERE direction='outbound' AND status='sent' AND conversation_id IN (SELECT id FROM conversations WHERE instagram_account_id=?)").get(account.id))?.c || 0 : 0;
      
      const usage = await quotaService.getAuthoritativeUsage(userId);

      const slidingWindows = account ? queue.getRateLimitStatus(account.id) : {
        private_replies_last_hour: 0,
        private_reply_limit_per_hour: 120,
        dms_last_minute: 0,
        dm_limit_per_minute: 30
      };

      const result = {
        plan: usage.effectivePlan,
        subscription_badge: usage.subscription_badge,
        dms_sent: usage.dms_sent,
        comments_replied: usage.comments_replied,
        total_replies_used: usage.total_replies_used,
        dm_usage_this_period: usage.total_replies_used,
        dm_limit: usage.monthly_limit,
        monthly_limit: usage.monthly_limit,
        daily_limit: usage.daily_limit,
        percent_used: usage.percent_used,
        usage_percent: usage.percent_used,
        usage_period_start: usage.usage_period_start,
        is_capped: usage.is_capped,
        remaining: usage.remaining,
        dm_remaining: usage.remaining,
        sliding_windows: slidingWindows,
        stats: { total_sent_replies: totalSentReplies, total_sent_dms: totalSentDMs, total_all_sent: totalSentReplies + totalSentDMs }
      };

      redisClient.set(cacheKey, result, 10).catch(() => {});
      return result;
    } finally {
      inflightUsage.delete(userId);
    }
  })();

  inflightUsage.set(userId, fetchPromise);
  try {
    const result = await fetchPromise;
    res.setHeader('X-Cache', 'MISS');
    return res.json(result);
  } catch (err) {
    console.error('[Usage] GET / error:', err.message);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

// POST /api/usage/upgrade — Disabled (Security Remediation BUG-001)
// Direct plan mutations without verified payment authorization (verifyPayment / razorpay / requireAdmin) are strictly prohibited.
// All customer plan activations must flow through canonical billing and verified payment state.
router.post('/upgrade', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  return res.status(403).json({
    error: 'Direct plan self-upgrade is disabled. Upgrades require verified payment gateway authorization (verifyPayment / razorpay).',
    code: 'UPGRADE_VIA_BILLING_REQUIRED'
  });
});

module.exports = router;
