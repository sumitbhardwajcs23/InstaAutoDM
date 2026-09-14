// backend/src/services/quotaService.js
// Airvix Authoritative Combined Reply Quota Service — Migration 012 Architecture
//
// QUOTA OWNERSHIP MODEL:
//   Quota is attributed to the SUBSCRIPTION that incurred it, not the Instagram account alone.
//   Key: (instagram_account_id, subscription_id, period_start)
//
// KEY INVARIANTS:
//   1. total_replies_used = dms_sent + comments_replied (per account+subscription row)
//   2. Subscription usage = SUM of usage_counters rows for accounts connected to that subscription
//   3. Disconnecting/moving an account NEVER mutates historical usage rows
//   4. Reservation state machine: RESERVED → COMMITTED or ROLLED_BACK (never direct increment)
//   5. Exactly-once increment on Meta success; 0 quota consumed on Meta failure
//   6. Concurrency protection via row-level PostgreSQL locks (FOR UPDATE)
//   7. Redis is strictly ephemeral cache; PostgreSQL is the sole SSOT

const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const redisClient = require('./redisClient');
const { dmLimitFor, dailyLimitFor, badgeFor } = require('../constants/planLimits');

/**
 * Resolves subscription context for a user.
 * Returns { plan, subscriptionId, monthlyLimit, dailyLimit, badge, isEntitled }.
 */
async function resolveSubscriptionContext(client, userId) {
  const subRes = await client.query(`
    SELECT id, plan, status FROM subscriptions
    WHERE user_id = $1 AND status IN ('active', 'trialing')
      AND (current_period_end::timestamptz > NOW() OR current_period_end > to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
    ORDER BY created_at DESC LIMIT 1
  `, [userId]);

  const userRes = await client.query(`
    SELECT plan, custom_dm_limit, custom_daily_limit, subscription_status FROM users WHERE id = $1
  `, [userId]);

  const user = userRes.rows[0];
  const sub = subRes.rows[0];
  const subStatus = (sub?.status || user?.subscription_status || 'active').toLowerCase();
  const isEntitled = ['active', 'trialing', 'grace_period'].includes(subStatus) && subStatus !== 'reconciliation_required';
  const effectivePlan = isEntitled ? (sub?.plan || user?.plan || 'free') : 'free';
  const monthlyLimit = dmLimitFor(effectivePlan, user?.custom_dm_limit);
  const dailyLimit = dailyLimitFor(effectivePlan, user?.custom_daily_limit, user?.custom_dm_limit);
  const badge = badgeFor(effectivePlan);

  return {
    subscriptionId: sub?.id || null,
    plan: effectivePlan,
    effectivePlan,
    monthlyLimit,
    dailyLimit,
    badge,
    isEntitled
  };
}

/**
 * Returns or creates the usage_counters row for a given account+subscription+period.
 * Caller must hold a transaction. Row is locked FOR UPDATE.
 */
async function getOrCreateAccountCounter(client, igAccountId, userId, subscriptionId, periodStart) {
  // Try to get existing account-keyed row first
  if (igAccountId && subscriptionId) {
    const existing = await client.query(`
      SELECT id, dms_sent, comments_replied
      FROM usage_counters
      WHERE instagram_account_id = $1 AND subscription_id = $2 AND period_start = $3
      FOR UPDATE
    `, [igAccountId, subscriptionId, periodStart]);

    if (existing.rows[0]) return existing.rows[0];

    // Create new account+subscription row
    const newId = `cnt_${igAccountId.slice(0, 8)}_${Date.now()}`;
    await client.query(`
      INSERT INTO usage_counters
        (id, user_id, instagram_account_id, subscription_id, period_start, period_end, dms_sent, comments_replied, updated_at)
      VALUES ($1, $2, $3, $4, $5, $5::date + INTERVAL '30 days', 0, 0, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      ON CONFLICT DO NOTHING
    `, [newId, userId, igAccountId, subscriptionId, periodStart]);

    const created = await client.query(`
      SELECT id, dms_sent, comments_replied
      FROM usage_counters
      WHERE instagram_account_id = $1 AND subscription_id = $2 AND period_start = $3
      FOR UPDATE
    `, [igAccountId, subscriptionId, periodStart]);
    return created.rows[0];
  }

  // Legacy fallback: user-level counter (pre-Migration 012 rows)
  const legacy = await client.query(`
    SELECT id, dms_sent, comments_replied
    FROM usage_counters
    WHERE user_id = $1 AND instagram_account_id IS NULL
    ORDER BY period_start DESC LIMIT 1
    FOR UPDATE
  `, [userId]);

  if (legacy.rows[0]) return legacy.rows[0];

  const legacyId = `cnt_${userId.slice(0, 8)}_${Date.now()}`;
  const now = new Date().toISOString().slice(0, 10);
  await client.query(`
    INSERT INTO usage_counters (id, user_id, period_start, dms_sent, comments_replied, updated_at)
    VALUES ($1, $2, $3, 0, 0, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
    ON CONFLICT DO NOTHING
  `, [legacyId, userId, now]);

  const legacyCreated = await client.query(`
    SELECT id, dms_sent, comments_replied
    FROM usage_counters WHERE user_id = $1 AND instagram_account_id IS NULL
    ORDER BY period_start DESC LIMIT 1 FOR UPDATE
  `, [userId]);
  return legacyCreated.rows[0];
}

class QuotaService {
  /**
  /**
   * Retrieves authoritative usage metrics from PostgreSQL.
   * Supports both account-level queries (accountId provided) and
   * subscription-level aggregation (sum of all accounts under the subscription).
   * Supports invocation with either string userId or object { userId, accountId }.
   *
   * @param {string|object} opts - userId string OR { userId, accountId }
   */
  async getAuthoritativeUsage(opts = {}) {
    let userId;
    let accountId = null;
    if (typeof opts === 'string') {
      userId = opts;
    } else if (opts && typeof opts === 'object') {
      userId = opts.userId;
      accountId = opts.accountId || null;
    }
    if (!userId) throw new Error('userId is required');

    const pool = db.getPgPool();
    if (!pool) {
      // Graceful fallback for non-pool environments
      return this._legacyGetAuthoritativeUsage(userId);
    }

    const client = await pool.connect();
    try {
      // 1. Resolve subscription context
      const ctx = await resolveSubscriptionContext(client, userId);
      const todayStr = new Date().toISOString().slice(0, 10);

      // 2. Compute subscription-level committed monthly usage
      //    = SUM over all usage_counters rows for this subscription (or user if no sub)
      let committedRes;
      if (ctx.subscriptionId) {
        committedRes = await client.query(`
          SELECT
            COALESCE(SUM(dms_sent), 0)          AS total_dms,
            COALESCE(SUM(comments_replied), 0)  AS total_comments,
            COALESCE(SUM(dms_sent + comments_replied), 0) AS total_replies
          FROM usage_counters
          WHERE subscription_id = $1
        `, [ctx.subscriptionId]);
      } else {
        // No subscription: fall back to user-level rows
        committedRes = await client.query(`
          SELECT
            COALESCE(SUM(dms_sent), 0)          AS total_dms,
            COALESCE(SUM(comments_replied), 0)  AS total_comments,
            COALESCE(SUM(dms_sent + comments_replied), 0) AS total_replies
          FROM usage_counters
          WHERE user_id = $1
        `, [userId]);
      }

      const row = committedRes.rows[0];
      const dmsSent = Number(row?.total_dms || 0);
      const commentsReplied = Number(row?.total_comments || 0);
      const committedUsage = Number(row?.total_replies || 0);

      // 3. Count active non-expired RESERVED reservations for this subscription
      let reservedRes;
      if (ctx.subscriptionId) {
        reservedRes = await client.query(`
          SELECT COUNT(*) AS count
          FROM quota_reservations
          WHERE subscription_id = $1 AND status = 'RESERVED' AND expires_at > NOW()
        `, [ctx.subscriptionId]);
      } else {
        reservedRes = await client.query(`
          SELECT COUNT(*) AS count
          FROM quota_reservations
          WHERE user_id = $1 AND status = 'RESERVED' AND expires_at > NOW()
        `, [userId]);
      }
      const activeReserved = Number(reservedRes.rows[0]?.count || 0);

      // 4. Compute authoritative daily usage from activity_log for today
      //    Attributed strictly to subscription_id (or user_id if free tier)
      let dailyRes;
      if (ctx.subscriptionId) {
        dailyRes = await client.query(`
          SELECT
            COALESCE(SUM(dms_sent), 0) AS daily_dms,
            COALESCE(SUM(comments_replied), 0) AS daily_comments,
            COALESCE(SUM(dms_sent + comments_replied), 0) AS daily_replies_used
          FROM activity_log
          WHERE subscription_id = $1 AND event_date = $2
        `, [ctx.subscriptionId, todayStr]);
      } else {
        dailyRes = await client.query(`
          SELECT
            COALESCE(SUM(dms_sent), 0) AS daily_dms,
            COALESCE(SUM(comments_replied), 0) AS daily_comments,
            COALESCE(SUM(dms_sent + comments_replied), 0) AS daily_replies_used
          FROM activity_log
          WHERE user_id = $1 AND subscription_id IS NULL AND event_date = $2
        `, [userId, todayStr]);
      }
      const dailyDmsSent = Number(dailyRes.rows[0]?.daily_dms || 0);
      const dailyCommentsReplied = Number(dailyRes.rows[0]?.daily_comments || 0);
      const dailyRepliesUsed = Number(dailyRes.rows[0]?.daily_replies_used || 0);
      const dailyRemaining = ctx.dailyLimit === -1
        ? 999999
        : Math.max(0, ctx.dailyLimit - dailyRepliesUsed);

      // 5. Per-account breakdown (active connected accounts with Instagram profile metadata)
      const breakdownRes = await client.query(`
        SELECT
          c.instagram_account_id AS id,
          ig.username,
          ig.full_name,
          ig.profile_picture_url,
          COALESCE(uc.dms_sent, 0) AS dms_sent,
          COALESCE(uc.comments_replied, 0) AS comments_replied,
          COALESCE(uc.dms_sent + uc.comments_replied, 0) AS total
        FROM instagram_account_connections c
        JOIN instagram_accounts ig ON ig.id = c.instagram_account_id
        LEFT JOIN usage_counters uc ON uc.instagram_account_id = c.instagram_account_id
          AND ($1::text IS NULL OR uc.subscription_id = $1)
        WHERE c.user_id = $2 AND c.status = 'active'
        ORDER BY total DESC, ig.username ASC
      `, [ctx.subscriptionId, userId]);

      const accountsBreakdown = (breakdownRes.rows || []).map(r => ({
        id: r.id,
        username: r.username,
        full_name: r.full_name,
        profile_picture_url: r.profile_picture_url,
        dms_sent: Number(r.dms_sent || 0),
        comments_replied: Number(r.comments_replied || 0),
        total: Number(r.total || 0)
      }));

      // 6. Derive overall quota metrics
      const totalInFlight = committedUsage + activeReserved;
      const availableQuota = ctx.monthlyLimit === -1
        ? 999999
        : Math.max(0, ctx.monthlyLimit - totalInFlight);
      const isCapped = ctx.monthlyLimit !== -1 && totalInFlight >= ctx.monthlyLimit;
      const percentUsed = ctx.monthlyLimit === -1
        ? 0
        : Math.min(100, Math.round((committedUsage / (ctx.monthlyLimit || 1)) * 100));

      return {
        userId,
        subscriptionId: ctx.subscriptionId,
        plan: ctx.plan,
        effectivePlan: ctx.effectivePlan,
        subscription_badge: ctx.badge,
        badge: ctx.badge,
        monthly_limit: ctx.monthlyLimit,
        plan_limit: ctx.monthlyLimit,
        daily_limit: ctx.dailyLimit,
        daily_replies_used: dailyRepliesUsed,
        daily_dms_sent: dailyDmsSent,
        daily_comments_replied: dailyCommentsReplied,
        daily_remaining: dailyRemaining,
        dms_sent: dmsSent,
        comments_replied: commentsReplied,
        total_replies_used: committedUsage,
        committed_usage: committedUsage,
        reserved_usage: activeReserved,
        available_quota: availableQuota,
        remaining: availableQuota,
        is_capped: isCapped,
        percent_used: percentUsed,
        usage_percent: percentUsed,
        accounts_breakdown: accountsBreakdown,
        // Backward compatibility aliases
        dm_usage_this_period: committedUsage,
        dm_limit: ctx.monthlyLimit,
        dm_remaining: availableQuota,
      };
    } finally {
      client.release();
    }
  }
  }

  /**
   * Legacy fallback: getAuthoritativeUsage for non-pool (SQLite/fallback) environments.
   * @private
   */
  async _legacyGetAuthoritativeUsage(userId) {
    let activeSub = null;
    try {
      activeSub = await db.prepare(`
        SELECT plan, status, current_period_end
        FROM subscriptions
        WHERE user_id = ? AND status = 'active'
          AND (current_period_end::timestamptz > NOW() OR current_period_end > to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
        ORDER BY created_at DESC LIMIT 1
      `).get(userId);
    } catch (_) {}

    let user = null;
    try {
      user = await db.prepare(
        `SELECT id, plan, custom_dm_limit, custom_daily_limit, dm_usage_this_period, usage_period_start, subscription_status FROM users WHERE id = ?`
      ).get(userId);
    } catch (_) {}

    let counter = null;
    try {
      counter = await db.prepare(
        `SELECT dms_sent, comments_replied, period_start FROM usage_counters WHERE user_id = ? ORDER BY period_start DESC LIMIT 1`
      ).get(userId);
    } catch (_) {}

    let activeReserved = 0;
    try {
      const res = await db.prepare(
        `SELECT COUNT(*) as count FROM quota_reservations WHERE user_id = ? AND status = 'RESERVED' AND expires_at > NOW()`
      ).get(userId);
      activeReserved = Number(res?.count || 0);
    } catch (_) {}

    const subStatus = (activeSub?.status || user?.subscription_status || 'active').toLowerCase();
    const isEntitled = ['active', 'trialing', 'grace_period'].includes(subStatus) && subStatus !== 'reconciliation_required';
    const effectivePlan = isEntitled ? (activeSub?.plan || user?.plan || 'free') : 'free';
    const monthlyLimit = dmLimitFor(effectivePlan, user?.custom_dm_limit);
    const dailyLimit = dailyLimitFor(effectivePlan, user?.custom_daily_limit, user?.custom_dm_limit);
    const badge = badgeFor(effectivePlan);

    const dmsSent = Number(counter?.dms_sent || 0);
    const commentsReplied = Number(counter?.comments_replied || 0);
    const committedUsage = dmsSent + commentsReplied;
    const totalInFlight = committedUsage + activeReserved;
    const availableQuota = monthlyLimit === -1 ? 999999 : Math.max(0, monthlyLimit - totalInFlight);
    const isCapped = monthlyLimit !== -1 && totalInFlight >= monthlyLimit;
    const percentUsed = monthlyLimit === -1 ? 0 : Math.min(100, Math.round((committedUsage / (monthlyLimit || 1)) * 100));

    return {
      userId, plan: effectivePlan, effectivePlan,
      subscription_badge: badge, badge,
      monthly_limit: monthlyLimit, plan_limit: monthlyLimit, daily_limit: dailyLimit,
      dms_sent: dmsSent, comments_replied: commentsReplied,
      total_replies_used: committedUsage, committed_usage: committedUsage,
      reserved_usage: activeReserved, available_quota: availableQuota, remaining: availableQuota,
      is_capped: isCapped, percent_used: percentUsed, usage_percent: percentUsed,
      dm_usage_this_period: committedUsage, dm_limit: monthlyLimit, dm_remaining: availableQuota,
    };
  }

  /**
   * Atomically checks quota and creates a RESERVED reservation.
   * Uses PostgreSQL row-level lock (FOR UPDATE) on the usage_counters row to
   * guarantee serialization under concurrency. Quota gate checks BOTH committed
   * usage AND active in-flight reservations for the entire subscription.
   *
   * @param {object} opts
   * @param {string} opts.userId            - Airvix user ID
   * @param {string} [opts.accountId]       - Instagram account ID (required for account-keyed logic)
  /**
   * Atomically checks quota and creates a RESERVED reservation.
   * Supports both object ({ userId, accountId, replyType, idempotencyKey, ttlSeconds })
   * and positional arguments (userId, replyType, idempotencyKey, ttlSeconds).
   */
  async reserveReplyQuota(optsOrUserId, replyTypeArg = 'dm', idempotencyKeyArg = null, ttlSecondsArg = 300) {
    let userId;
    let accountId = null;
    let replyType = 'dm';
    let idempotencyKey = null;
    let ttlSeconds = 300;

    if (typeof optsOrUserId === 'string') {
      userId = optsOrUserId;
      replyType = replyTypeArg || 'dm';
      idempotencyKey = idempotencyKeyArg || null;
      ttlSeconds = ttlSecondsArg || 300;
    } else if (optsOrUserId && typeof optsOrUserId === 'object') {
      userId = optsOrUserId.userId;
      accountId = optsOrUserId.accountId || null;
      replyType = optsOrUserId.replyType || 'dm';
      idempotencyKey = optsOrUserId.idempotencyKey || null;
      ttlSeconds = optsOrUserId.ttlSeconds || 300;
    }

    if (!userId) throw new Error('userId is required');
    if (!['dm', 'comment'].includes(replyType)) throw new Error('replyType must be "dm" or "comment"');

    const idemp = idempotencyKey || `res_${userId}_${replyType}_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    // Quick idempotency lookup before acquiring transaction
    if (idempotencyKey) {
      try {
        const existing = await db.prepare(
          `SELECT id, status, reply_type, expires_at FROM quota_reservations WHERE idempotency_key = ?`
        ).get(idempotencyKey);
        if (existing) {
          if (existing.status === 'COMMITTED') {
            return { allowed: true, alreadyCommitted: true, reservationId: existing.id, replyType: existing.reply_type };
          }
          if (existing.status === 'RESERVED') {
            const isExpired = new Date(existing.expires_at).getTime() <= Date.now();
            if (!isExpired) {
              return { allowed: true, alreadyReserved: true, reservationId: existing.id, replyType: existing.reply_type };
            }
          }
        }
      } catch (_) {}
    }

    const pool = db.getPgPool();
    if (!pool) {
      return this._legacyReserveReplyQuota(userId, replyType, idemp, ttlSeconds);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Resolve subscription context (inside transaction for consistency)
      const ctx = await resolveSubscriptionContext(client, userId);
      const periodStart = new Date().toISOString().slice(0, 10);

      // Auto-resolve accountId from active connections if not explicitly provided
      if (!accountId) {
        const accRes = await client.query(`
          SELECT instagram_account_id
          FROM instagram_account_connections
          WHERE user_id = $1 AND status = 'active'
          ORDER BY connected_at DESC LIMIT 1
        `, [userId]);
        if (accRes.rows[0]) {
          accountId = accRes.rows[0].instagram_account_id;
        }
      }

      // 2. Get/create the usage_counters row and lock it FOR UPDATE
      const counter = await getOrCreateAccountCounter(client, accountId || null, userId, ctx.subscriptionId, periodStart);

      const dms = Number(counter?.dms_sent || 0);
      const comments = Number(counter?.comments_replied || 0);
      const committedForAccount = dms + comments;

      // 3. Compute subscription-level committed total (sum across all accounts)
      let subscriptionCommitted = committedForAccount;
      if (ctx.subscriptionId && accountId) {
        const subTotalRes = await client.query(`
          SELECT COALESCE(SUM(dms_sent + comments_replied), 0) AS total
          FROM usage_counters
          WHERE subscription_id = $1
        `, [ctx.subscriptionId]);
        subscriptionCommitted = Number(subTotalRes.rows[0]?.total || 0);
      }

      // 4. Count active non-expired reservations for the subscription
      let reservedCountRes;
      if (ctx.subscriptionId) {
        reservedCountRes = await client.query(`
          SELECT COUNT(*) AS reserved_count
          FROM quota_reservations
          WHERE subscription_id = $1 AND status = 'RESERVED' AND expires_at > NOW()
        `, [ctx.subscriptionId]);
      } else {
        reservedCountRes = await client.query(`
          SELECT COUNT(*) AS reserved_count
          FROM quota_reservations
          WHERE user_id = $1 AND status = 'RESERVED' AND expires_at > NOW()
        `, [userId]);
      }
      const reservedCount = Number(reservedCountRes.rows[0]?.reserved_count || 0);
      const totalInFlight = subscriptionCommitted + reservedCount;

      // 5. Enforce subscription-level monthly quota gate
      if (ctx.monthlyLimit !== -1 && totalInFlight >= ctx.monthlyLimit) {
        await client.query('ROLLBACK');
        return {
          allowed: false,
          reason: 'QUOTA_EXCEEDED',
          committedUsage: subscriptionCommitted,
          reservedUsage: reservedCount,
          totalInFlight,
          monthlyLimit: ctx.monthlyLimit,
          effectivePlan: ctx.effectivePlan
        };
      }

      // 5b. Enforce daily limit gate (if daily limit is configured)
      if (ctx.dailyLimit && ctx.dailyLimit !== -1) {
        let dailyCommitted = 0;
        if (ctx.subscriptionId) {
          const dRes = await client.query(`
            SELECT COALESCE(SUM(dms_sent + comments_replied), 0) AS total
            FROM activity_log
            WHERE subscription_id = $1 AND event_date = $2
          `, [ctx.subscriptionId, periodStart]);
          dailyCommitted = Number(dRes.rows[0]?.total || 0);
        } else {
          const dRes = await client.query(`
            SELECT COALESCE(SUM(dms_sent + comments_replied), 0) AS total
            FROM activity_log
            WHERE user_id = $1 AND subscription_id IS NULL AND event_date = $2
          `, [userId, periodStart]);
          dailyCommitted = Number(dRes.rows[0]?.total || 0);
        }

        if ((dailyCommitted + reservedCount) >= ctx.dailyLimit) {
          await client.query('ROLLBACK');
          return {
            allowed: false,
            reason: 'DAILY_LIMIT_EXCEEDED',
            committedUsage: subscriptionCommitted,
            dailyUsage: dailyCommitted,
            dailyLimit: ctx.dailyLimit,
            reservedUsage: reservedCount,
            totalInFlight,
            monthlyLimit: ctx.monthlyLimit,
            effectivePlan: ctx.effectivePlan
          };
        }
      }

      // 6. Insert reservation
      const reservationId = `qres_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
      const insertRes = await client.query(`
        INSERT INTO quota_reservations
          (id, user_id, instagram_account_id, subscription_id, reply_type, idempotency_key, status, expires_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'RESERVED', NOW() + ($7 || ' seconds')::interval, NOW(), NOW())
        ON CONFLICT (idempotency_key) DO UPDATE SET
          status = CASE WHEN quota_reservations.status = 'ROLLED_BACK' THEN 'RESERVED' ELSE quota_reservations.status END,
          expires_at = NOW() + ($7 || ' seconds')::interval,
          updated_at = NOW()
        RETURNING id, status
      `, [reservationId, userId, accountId || null, ctx.subscriptionId, replyType, idemp, String(ttlSeconds)]);

      const actualReservationId = insertRes.rows[0]?.id || reservationId;
      await client.query('COMMIT');

      return {
        allowed: true,
        reservationId: actualReservationId,
        idempotencyKey: idemp,
        replyType,
        userId,
        accountId: accountId || null,
        subscriptionId: ctx.subscriptionId,
        committedUsage: subscriptionCommitted,
        reservedUsage: reservedCount + 1,
        totalInFlight: totalInFlight + 1,
        monthlyLimit: ctx.monthlyLimit,
        effectivePlan: ctx.effectivePlan
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /** @private legacy fallback for reserveReplyQuota */
  async _legacyReserveReplyQuota(userId, replyType, idemp, ttlSeconds) {
    const usage = await this._legacyGetAuthoritativeUsage(userId);
    if (usage.monthly_limit !== -1 && (usage.committed_usage + usage.reserved_usage) >= usage.monthly_limit) {
      return {
        allowed: false, reason: 'QUOTA_EXCEEDED',
        committedUsage: usage.committed_usage, reservedUsage: usage.reserved_usage,
        totalInFlight: usage.committed_usage + usage.reserved_usage,
        monthlyLimit: usage.monthly_limit, effectivePlan: usage.effectivePlan
      };
    }
    const reservationId = `qres_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    await db.prepare(`
      INSERT INTO quota_reservations (id, user_id, reply_type, idempotency_key, status, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'RESERVED', NOW() + INTERVAL '300 seconds', NOW(), NOW())
    `).run(reservationId, userId, replyType, idemp);
    return {
      allowed: true, reservationId, idempotencyKey: idemp, replyType, userId,
      committedUsage: usage.committed_usage, reservedUsage: usage.reserved_usage + 1,
      totalInFlight: usage.committed_usage + usage.reserved_usage + 1,
      monthlyLimit: usage.monthly_limit, effectivePlan: usage.effectivePlan
    };
  }

  /**
   * Commits a reserved quota unit upon verified Meta API send success.
   * Atomically transitions status: RESERVED → COMMITTED and increments the
   * usage_counters row for the specific instagram_account_id + subscription.
   * IDEMPOTENT: If already COMMITTED, returns success without double-incrementing.
   *
   * @param {string} reservationIdOrKey - reservation id or idempotency_key
   */
  async commitReplyQuota(reservationIdOrKey) {
    if (!reservationIdOrKey) return { committed: false, error: 'NO_RESERVATION_ID' };

    const pool = db.getPgPool();
    if (!pool) {
      return this._legacyCommitReplyQuota(reservationIdOrKey);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the reservation row
      const resRow = await client.query(`
        SELECT id, user_id, instagram_account_id, subscription_id, reply_type, status
        FROM quota_reservations
        WHERE id = $1 OR idempotency_key = $1
        FOR UPDATE
      `, [reservationIdOrKey]);

      if (!resRow.rows[0]) {
        await client.query('ROLLBACK');
        return { committed: false, error: 'RESERVATION_NOT_FOUND' };
      }

      const reservation = resRow.rows[0];

      if (reservation.status === 'COMMITTED') {
        await client.query('COMMIT');
        return { committed: true, alreadyCommitted: true, reservationId: reservation.id };
      }

      if (reservation.status === 'ROLLED_BACK') {
        await client.query('ROLLBACK');
        return { committed: false, error: 'CANNOT_COMMIT_ROLLED_BACK_RESERVATION' };
      }

      // Resolve which usage_counters row to increment
      const incDm = reservation.reply_type === 'dm' ? 1 : 0;
      const incComment = reservation.reply_type === 'comment' ? 1 : 0;
      const periodStart = new Date().toISOString().slice(0, 10);

      let updateRes;
      if (reservation.instagram_account_id && reservation.subscription_id) {
        // Account-keyed increment (Migration 012+ rows)
        // First ensure the row exists
        await client.query(`
          INSERT INTO usage_counters
            (id, user_id, instagram_account_id, subscription_id, period_start, dms_sent, comments_replied, updated_at)
          VALUES ($1, $2, $3, $4, $5, 0, 0, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
          ON CONFLICT DO NOTHING
        `, [`cnt_${reservation.instagram_account_id.slice(0, 8)}_c`, reservation.user_id, reservation.instagram_account_id, reservation.subscription_id, periodStart]);

        updateRes = await client.query(`
          UPDATE usage_counters
          SET dms_sent = dms_sent + $1,
              comments_replied = comments_replied + $2,
              updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          WHERE instagram_account_id = $3 AND subscription_id = $4 AND period_start = $5
          RETURNING dms_sent, comments_replied, (dms_sent + comments_replied) AS total_used
        `, [incDm, incComment, reservation.instagram_account_id, reservation.subscription_id, periodStart]);
      } else {
        // Legacy user-level fallback
        updateRes = await client.query(`
          UPDATE usage_counters
          SET dms_sent = dms_sent + $1,
              comments_replied = comments_replied + $2,
              updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          WHERE user_id = $3 AND instagram_account_id IS NULL
          RETURNING dms_sent, comments_replied, (dms_sent + comments_replied) AS total_used
        `, [incDm, incComment, reservation.user_id]);
      }

      const newAccountTotal = Number(updateRes.rows[0]?.total_used || 0);

      // Compute subscription-level total for users.dm_usage_this_period cache
      let subscriptionTotal = newAccountTotal;
      if (reservation.subscription_id) {
        const subTotalRes = await client.query(`
          SELECT COALESCE(SUM(dms_sent + comments_replied), 0) AS total
          FROM usage_counters WHERE subscription_id = $1
        `, [reservation.subscription_id]);
        subscriptionTotal = Number(subTotalRes.rows[0]?.total || 0);
      }

      // Transition reservation to COMMITTED
      await client.query(`
        UPDATE quota_reservations
        SET status = 'COMMITTED', committed_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [reservation.id]);

      // Keep users.dm_usage_this_period synchronized (informational cache only)
      await client.query(`
        UPDATE users SET dm_usage_this_period = $1, updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        WHERE id = $2
      `, [subscriptionTotal, reservation.user_id]);

      // Atomically record/upsert daily activity_log with subscription & user attribution
      const activityLogId = `act_${(reservation.instagram_account_id || reservation.user_id).slice(0, 8)}_${Date.now()}`;
      if (reservation.subscription_id) {
        await client.query(`
          INSERT INTO activity_log
            (id, instagram_account_id, subscription_id, user_id, event_date, dms_sent, comments_replied, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
          ON CONFLICT (instagram_account_id, subscription_id, event_date) WHERE subscription_id IS NOT NULL
          DO UPDATE SET
            dms_sent = activity_log.dms_sent + EXCLUDED.dms_sent,
            comments_replied = activity_log.comments_replied + EXCLUDED.comments_replied
        `, [activityLogId, reservation.instagram_account_id, reservation.subscription_id, reservation.user_id, periodStart, incDm, incComment]);
      } else {
        await client.query(`
          INSERT INTO activity_log
            (id, instagram_account_id, subscription_id, user_id, event_date, dms_sent, comments_replied, created_at)
          VALUES ($1, $2, NULL, $3, $4, $5, $6, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
          ON CONFLICT (instagram_account_id, user_id, event_date) WHERE subscription_id IS NULL
          DO UPDATE SET
            dms_sent = activity_log.dms_sent + EXCLUDED.dms_sent,
            comments_replied = activity_log.comments_replied + EXCLUDED.comments_replied
        `, [activityLogId, reservation.instagram_account_id, reservation.user_id, periodStart, incDm, incComment]);
      }

      await client.query('COMMIT');

      // Bust Redis cache for this user (both specific and wildcard pattern)
      redisClient.del(`cache:usage:${reservation.user_id}`).catch(() => {});
      redisClient.del(`cache:dash:${reservation.user_id}:default`).catch(() => {});
      if (redisClient.delPattern) {
        redisClient.delPattern(`cache:dash:${reservation.user_id}:*`).catch(() => {});
      }

      return { committed: true, reservationId: reservation.id, totalRepliesUsed: subscriptionTotal };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[QuotaService] Failed to commit reservation:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  /** @private legacy fallback for commitReplyQuota */
  async _legacyCommitReplyQuota(reservationIdOrKey) {
    const reservation = await db.prepare(
      `SELECT id, user_id, reply_type, status FROM quota_reservations WHERE id = ? OR idempotency_key = ?`
    ).get(reservationIdOrKey, reservationIdOrKey);

    if (!reservation) return { committed: false, error: 'RESERVATION_NOT_FOUND' };
    if (reservation.status === 'COMMITTED') return { committed: true, alreadyCommitted: true };
    if (reservation.status === 'ROLLED_BACK') return { committed: false, error: 'CANNOT_COMMIT_ROLLED_BACK' };

    const incDm = reservation.reply_type === 'dm' ? 1 : 0;
    const incComment = reservation.reply_type === 'comment' ? 1 : 0;

    await db.prepare(
      `UPDATE usage_counters SET dms_sent = dms_sent + ?, comments_replied = comments_replied + ?, updated_at = NOW() WHERE user_id = ?`
    ).run(incDm, incComment, reservation.user_id);

    await db.prepare(
      `UPDATE quota_reservations SET status = 'COMMITTED', committed_at = NOW(), updated_at = NOW() WHERE id = ?`
    ).run(reservation.id);

    const cnt = await db.prepare('SELECT dms_sent, comments_replied FROM usage_counters WHERE user_id = ?').get(reservation.user_id);
    const newTotal = Number(cnt?.dms_sent || 0) + Number(cnt?.comments_replied || 0);
    await db.prepare('UPDATE users SET dm_usage_this_period = ? WHERE id = ?').run(newTotal, reservation.user_id);
    redisClient.del(`cache:usage:${reservation.user_id}`).catch(() => {});
    return { committed: true, reservationId: reservation.id, totalRepliesUsed: newTotal };
  }

  /**
   * Rolls back a reserved quota unit when Meta API send fails.
   * Atomically transitions status: RESERVED → ROLLED_BACK.
   * IDEMPOTENT: If already ROLLED_BACK, returns without error.
   * usage_counters are NOT touched, preventing any counter corruption.
   *
   * @param {string} reservationIdOrKey
   */
  async rollbackReplyQuota(reservationIdOrKey) {
    if (!reservationIdOrKey) return { rolledBack: false, error: 'NO_RESERVATION_ID' };

    const pool = db.getPgPool();
    if (!pool) {
      return this._legacyRollbackReplyQuota(reservationIdOrKey);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const resRow = await client.query(`
        SELECT id, user_id, status FROM quota_reservations
        WHERE id = $1 OR idempotency_key = $1
        FOR UPDATE
      `, [reservationIdOrKey]);

      if (!resRow.rows[0]) {
        await client.query('ROLLBACK');
        return { rolledBack: false, error: 'RESERVATION_NOT_FOUND' };
      }

      const reservation = resRow.rows[0];

      if (reservation.status === 'ROLLED_BACK') {
        await client.query('COMMIT');
        return { rolledBack: true, alreadyRolledBack: true, reservationId: reservation.id };
      }

      if (reservation.status === 'COMMITTED') {
        await client.query('ROLLBACK');
        return { rolledBack: false, error: 'CANNOT_ROLLBACK_COMMITTED_RESERVATION' };
      }

      await client.query(`
        UPDATE quota_reservations
        SET status = 'ROLLED_BACK', rolled_back_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [reservation.id]);

      await client.query('COMMIT');
      redisClient.del(`cache:usage:${reservation.user_id}`).catch(() => {});
      return { rolledBack: true, reservationId: reservation.id };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[QuotaService] Failed to rollback reservation:', err.message);
      return { rolledBack: false, error: err.message };
    } finally {
      client.release();
    }
  }

  /** @private */
  async _legacyRollbackReplyQuota(reservationIdOrKey) {
    const reservation = await db.prepare(
      `SELECT id, user_id, status FROM quota_reservations WHERE id = ? OR idempotency_key = ?`
    ).get(reservationIdOrKey, reservationIdOrKey);

    if (!reservation) return { rolledBack: false, error: 'RESERVATION_NOT_FOUND' };
    if (reservation.status === 'ROLLED_BACK') return { rolledBack: true, alreadyRolledBack: true };
    if (reservation.status === 'COMMITTED') return { rolledBack: false, error: 'CANNOT_ROLLBACK_COMMITTED' };

    await db.prepare(
      `UPDATE quota_reservations SET status = 'ROLLED_BACK', rolled_back_at = NOW(), updated_at = NOW() WHERE id = ?`
    ).run(reservation.id);

    redisClient.del(`cache:usage:${reservation.user_id}`).catch(() => {});
    return { rolledBack: true, reservationId: reservation.id };
  }

  /**
   * Reconciles expired in-flight reservations (e.g. following a worker crash).
   * Transitions RESERVED records past expires_at to ROLLED_BACK.
   */
  async expireStaleReservations() {
    const pool = db.getPgPool();
    if (pool) {
      try {
        const res = await pool.query(`
          UPDATE quota_reservations
          SET status = 'ROLLED_BACK', rolled_back_at = NOW(), updated_at = NOW()
          WHERE status = 'RESERVED' AND expires_at <= NOW()
          RETURNING id, user_id
        `);
        const count = res.rowCount || 0;
        if (count > 0) {
          const userIds = [...new Set(res.rows.map(r => r.user_id))];
          userIds.forEach(uid => {
            redisClient.del(`cache:usage:${uid}`).catch(() => {});
            redisClient.del(`cache:dash:${uid}:default`).catch(() => {});
          });
          console.log(`[QuotaService] 🔄 Reconciled ${count} stale quota reservation(s).`);
        }
        return { expiredCount: count };
      } catch (err) {
        console.error('[QuotaService] Error expiring stale reservations:', err.message);
        return { expiredCount: 0, error: err.message };
      }
    }
    return { expiredCount: 0 };
  }
}

module.exports = new QuotaService();
