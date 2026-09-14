// backend/src/routes/usage.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const queue = require('../services/queue');
const { dmLimitFor, dailyLimitFor, badgeFor } = require('../constants/planLimits');

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
      
      let counter = null;
      try {
        counter = await db.prepare("SELECT dms_sent, period_start, period_end FROM usage_counters WHERE user_id = ? LIMIT 1").get(userId);
      } catch (_) {}

      const subStatus = user?.subscription_status || 'active';
      const isEntitled = ['active', 'trialing', 'grace_period'].includes(subStatus) && subStatus !== 'reconciliation_required';
      const effectivePlan = isEntitled ? (user?.plan || 'free') : 'free';

      const planLimit = dmLimitFor(effectivePlan, user?.custom_dm_limit);
      const dailyLimit = dailyLimitFor(effectivePlan, user?.custom_daily_limit, user?.custom_dm_limit);
      const subBadge = badgeFor(effectivePlan);
      const usageCount = counter?.dms_sent !== undefined ? Number(counter.dms_sent) : (user?.dm_usage_this_period || 0);
      const usagePercent = Math.min(100, Math.round((usageCount / (planLimit || 1)) * 100));

      const slidingWindows = account ? queue.getRateLimitStatus(account.id) : {
        private_replies_last_hour: 0,
        private_reply_limit_per_hour: 120,
        dms_last_minute: 0,
        dm_limit_per_minute: 30
      };

      const result = {
        plan: effectivePlan,
        subscription_badge: subBadge,
        dms_sent: usageCount,
        dm_usage_this_period: usageCount,
        dm_limit: planLimit,
        monthly_limit: planLimit,
        daily_limit: dailyLimit,
        percent_used: usagePercent,
        usage_percent: usagePercent,
        usage_period_start: user.usage_period_start,
        is_capped: usageCount >= planLimit,
        dm_remaining: Math.max(0, planLimit - usageCount),
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
