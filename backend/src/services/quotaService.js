// backend/src/services/quotaService.js
// Airvix Single Authoritative Shared Reply Quota Service
// Manages ONE combined monthly quota for DM and Comment replies.
//
// Key Invariants:
// 1. total_replies_used = dms_sent + comments_replied (authoritative committed total)
// 2. Explicit reservation state model: RESERVED -> COMMITTED or ROLLED_BACK
// 3. Exactly-once quota increment on Meta success; 0 quota consumed on Meta failure
// 4. Concurrency protection via row-level PostgreSQL locks (FOR UPDATE)
// 5. Expiration & crash-recovery: in-flight reservations expire cleanly (default TTL 300s)
// 6. Redis is strictly an ephemeral cache; PostgreSQL is the sole SSOT.

const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const redisClient = require('./redisClient');
const { dmLimitFor, dailyLimitFor, badgeFor } = require('../constants/planLimits');

class QuotaService {
  /**
   * Retrieves authoritative usage metrics for a given user directly from PostgreSQL.
   * Exposes committed usage, in-flight reservations, and available quota.
   */
  async getAuthoritativeUsage(userId) {
    if (!userId) throw new Error('UserId is required');

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
      user = await db.prepare(`
        SELECT id, plan, custom_dm_limit, custom_daily_limit, dm_usage_this_period, usage_period_start, subscription_status
        FROM users WHERE id = ?
      `).get(userId);
    } catch (_) {}

    let counter = null;
    try {
      counter = await db.prepare(`
        SELECT dms_sent, comments_replied, period_start, period_end
        FROM usage_counters WHERE user_id = ? LIMIT 1
      `).get(userId);
    } catch (_) {}

    let activeReserved = 0;
    try {
      const resCount = await db.prepare(`
        SELECT COUNT(*) as count 
        FROM quota_reservations 
        WHERE user_id = ? AND status = 'RESERVED' AND expires_at > NOW()
      `).get(userId);
      activeReserved = Number(resCount?.count || 0);
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
      userId,
      plan: effectivePlan,
      effectivePlan,
      subscription_badge: badge,
      badge,
      monthly_limit: monthlyLimit,
      plan_limit: monthlyLimit,
      daily_limit: dailyLimit,
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
      // Backward compatibility aliases:
      dm_usage_this_period: committedUsage,
      dm_limit: monthlyLimit,
      dm_remaining: availableQuota,
      usage_period_start: user?.usage_period_start || null,
      period_start: counter?.period_start || user?.usage_period_start || null,
      period_end: counter?.period_end || null
    };
  }

  /**
   * Atomically checks quota and creates a unique reservation with status 'RESERVED'.
   * Uses PostgreSQL row-level lock (FOR UPDATE) to guarantee serialization under concurrency.
   * If limit reached: returns { allowed: false, reason: 'QUOTA_EXCEEDED' }.
   * If idempotencyKey exists and is already COMMITTED or RESERVED, handles idempotently.
   */
  async reserveReplyQuota(userId, replyType = 'dm', idempotencyKey = null, ttlSeconds = 300) {
    if (!userId) throw new Error('UserId is required');
    if (!['dm', 'comment'].includes(replyType)) throw new Error('replyType must be "dm" or "comment"');

    const idemp = idempotencyKey || `res_${userId}_${replyType}_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    // Quick idempotency lookup before transaction
    if (idempotencyKey) {
      try {
        const existing = await db.prepare(`
          SELECT id, status, reply_type, expires_at FROM quota_reservations WHERE idempotency_key = ?
        `).get(idempotencyKey);
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
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Ensure usage_counters row exists
        await client.query(`
          INSERT INTO usage_counters (id, user_id, period_start, period_end, dms_sent, comments_replied, updated_at)
          VALUES ($1, $2, NOW(), NOW() + INTERVAL '30 days', 0, 0, NOW())
          ON CONFLICT (user_id) DO NOTHING
        `, [`cnt_${userId}`, userId]);

        // 2. Lock usage_counters row for this user
        const cntRes = await client.query(`
          SELECT dms_sent, comments_replied FROM usage_counters WHERE user_id = $1 FOR UPDATE
        `, [userId]);

        const dms = Number(cntRes.rows[0]?.dms_sent || 0);
        const comments = Number(cntRes.rows[0]?.comments_replied || 0);
        const committedTotal = dms + comments;

        // 3. Count active non-expired reservations
        const resCountRes = await client.query(`
          SELECT COUNT(*) as reserved_count
          FROM quota_reservations
          WHERE user_id = $1 AND status = 'RESERVED' AND expires_at > NOW()
        `, [userId]);
        const reservedCount = Number(resCountRes.rows[0]?.reserved_count || 0);
        const totalInFlight = committedTotal + reservedCount;

        // 4. Resolve plan and monthly limit
        const subRes = await client.query(`
          SELECT plan, status FROM subscriptions
          WHERE user_id = $1 AND status = 'active'
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

        // 5. Evaluate combined quota gate
        if (monthlyLimit !== -1 && totalInFlight >= monthlyLimit) {
          await client.query('ROLLBACK');
          return {
            allowed: false,
            reason: 'QUOTA_EXCEEDED',
            committedUsage: committedTotal,
            reservedUsage: reservedCount,
            totalInFlight,
            monthlyLimit,
            effectivePlan
          };
        }

        // 6. Insert new reservation with unique ID and status 'RESERVED'
        const reservationId = `qres_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
        const insertRes = await client.query(`
          INSERT INTO quota_reservations (id, user_id, reply_type, idempotency_key, status, expires_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, 'RESERVED', NOW() + ($5 || ' seconds')::interval, NOW(), NOW())
          ON CONFLICT (idempotency_key) DO UPDATE SET
            status = CASE WHEN quota_reservations.status = 'ROLLED_BACK' THEN 'RESERVED' ELSE quota_reservations.status END,
            expires_at = NOW() + ($5 || ' seconds')::interval,
            updated_at = NOW()
          RETURNING id, status
        `, [reservationId, userId, replyType, idemp, ttlSeconds]);

        const actualReservationId = insertRes.rows[0]?.id || reservationId;

        await client.query('COMMIT');

        return {
          allowed: true,
          reservationId: actualReservationId,
          idempotencyKey: idemp,
          replyType,
          userId,
          committedUsage: committedTotal,
          reservedUsage: reservedCount + 1,
          totalInFlight: totalInFlight + 1,
          monthlyLimit,
          effectivePlan
        };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    } else {
      // Fallback for non-pool environment
      const usage = await this.getAuthoritativeUsage(userId);
      if (usage.monthly_limit !== -1 && (usage.committed_usage + usage.reserved_usage) >= usage.monthly_limit) {
        return {
          allowed: false,
          reason: 'QUOTA_EXCEEDED',
          committedUsage: usage.committed_usage,
          reservedUsage: usage.reserved_usage,
          totalInFlight: usage.committed_usage + usage.reserved_usage,
          monthlyLimit: usage.monthly_limit,
          effectivePlan: usage.effectivePlan
        };
      }
      const reservationId = `qres_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
      await db.prepare(`
        INSERT INTO quota_reservations (id, user_id, reply_type, idempotency_key, status, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'RESERVED', NOW() + INTERVAL '300 seconds', NOW(), NOW())
      `).run(reservationId, userId, replyType, idemp);
      return {
        allowed: true,
        reservationId,
        idempotencyKey: idemp,
        replyType,
        userId,
        committedUsage: usage.committed_usage,
        reservedUsage: usage.reserved_usage + 1,
        totalInFlight: usage.committed_usage + usage.reserved_usage + 1,
        monthlyLimit: usage.monthly_limit,
        effectivePlan: usage.effectivePlan
      };
    }
  }

  /**
   * Commits a reserved quota unit upon verified Meta API send success.
   * Atomically transitions status: RESERVED -> COMMITTED and increments usage_counters.
   * IDEMPOTENT: If already COMMITTED, returns success without double-incrementing.
   */
  async commitReplyQuota(reservationIdOrKey) {
    if (!reservationIdOrKey) return { committed: false, error: 'NO_RESERVATION_ID' };

    const pool = db.getPgPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const resRow = await client.query(`
          SELECT id, user_id, reply_type, status FROM quota_reservations
          WHERE id = $1 OR idempotency_key = $1
          FOR UPDATE
        `, [reservationIdOrKey]);

        if (!resRow.rows[0]) {
          await client.query('ROLLBACK');
          return { committed: false, error: 'RESERVATION_NOT_FOUND' };
        }

        const reservation = resRow.rows[0];

        // Idempotency check: Already committed
        if (reservation.status === 'COMMITTED') {
          await client.query('COMMIT');
          return { committed: true, alreadyCommitted: true, reservationId: reservation.id };
        }

        if (reservation.status === 'ROLLED_BACK') {
          await client.query('ROLLBACK');
          return { committed: false, error: 'CANNOT_COMMIT_ROLLED_BACK_RESERVATION' };
        }

        // Status is 'RESERVED': transition to 'COMMITTED'
        const incDm = reservation.reply_type === 'dm' ? 1 : 0;
        const incComment = reservation.reply_type === 'comment' ? 1 : 0;

        const updateRes = await client.query(`
          UPDATE usage_counters
          SET dms_sent = dms_sent + $1,
              comments_replied = comments_replied + $2,
              updated_at = NOW()
          WHERE user_id = $3
          RETURNING dms_sent, comments_replied, (dms_sent + comments_replied) as total_used
        `, [incDm, incComment, reservation.user_id]);

        const newTotal = Number(updateRes.rows[0]?.total_used || 0);

        await client.query(`
          UPDATE quota_reservations
          SET status = 'COMMITTED',
              committed_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `, [reservation.id]);

        // Keep users cache synchronized
        await client.query(`
          UPDATE users SET
            dm_usage_this_period = $1,
            updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          WHERE id = $2
        `, [newTotal, reservation.user_id]);

        await client.query('COMMIT');

        redisClient.del(`cache:usage:${reservation.user_id}`).catch(() => {});
        return { committed: true, reservationId: reservation.id, totalRepliesUsed: newTotal };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[QuotaService] Failed to commit reservation:', err.message);
        throw err;
      } finally {
        client.release();
      }
    } else {
      const reservation = await db.prepare(`
        SELECT id, user_id, reply_type, status FROM quota_reservations
        WHERE id = ? OR idempotency_key = ?
      `).get(reservationIdOrKey, reservationIdOrKey);

      if (!reservation) return { committed: false, error: 'RESERVATION_NOT_FOUND' };
      if (reservation.status === 'COMMITTED') return { committed: true, alreadyCommitted: true };
      if (reservation.status === 'ROLLED_BACK') return { committed: false, error: 'CANNOT_COMMIT_ROLLED_BACK' };

      const incDm = reservation.reply_type === 'dm' ? 1 : 0;
      const incComment = reservation.reply_type === 'comment' ? 1 : 0;

      await db.prepare(`
        UPDATE usage_counters
        SET dms_sent = dms_sent + ?,
            comments_replied = comments_replied + ?,
            updated_at = NOW()
        WHERE user_id = ?
      `).run(incDm, incComment, reservation.user_id);

      await db.prepare(`
        UPDATE quota_reservations
        SET status = 'COMMITTED', committed_at = NOW(), updated_at = NOW()
        WHERE id = ?
      `).run(reservation.id);

      const cnt = await db.prepare('SELECT dms_sent, comments_replied FROM usage_counters WHERE user_id = ?').get(reservation.user_id);
      const newTotal = Number(cnt?.dms_sent || 0) + Number(cnt?.comments_replied || 0);
      await db.prepare('UPDATE users SET dm_usage_this_period = ? WHERE id = ?').run(newTotal, reservation.user_id);
      redisClient.del(`cache:usage:${reservation.user_id}`).catch(() => {});
      return { committed: true, reservationId: reservation.id, totalRepliesUsed: newTotal };
    }
  }

  /**
   * Rolls back a reserved quota unit when Meta API send fails.
   * Atomically transitions status: RESERVED -> ROLLED_BACK.
   * IDEMPOTENT: If already ROLLED_BACK, returns without error.
   * Counters in usage_counters are NOT touched, preventing any negative or corrupt counter states.
   */
  async rollbackReplyQuota(reservationIdOrKey) {
    if (!reservationIdOrKey) return { rolledBack: false, error: 'NO_RESERVATION_ID' };

    const pool = db.getPgPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const resRow = await client.query(`
          SELECT id, user_id, reply_type, status FROM quota_reservations
          WHERE id = $1 OR idempotency_key = $1
          FOR UPDATE
        `, [reservationIdOrKey]);

        if (!resRow.rows[0]) {
          await client.query('ROLLBACK');
          return { rolledBack: false, error: 'RESERVATION_NOT_FOUND' };
        }

        const reservation = resRow.rows[0];

        // Idempotency check: Already rolled back
        if (reservation.status === 'ROLLED_BACK') {
          await client.query('COMMIT');
          return { rolledBack: true, alreadyRolledBack: true, reservationId: reservation.id };
        }

        if (reservation.status === 'COMMITTED') {
          await client.query('ROLLBACK');
          return { rolledBack: false, error: 'CANNOT_ROLLBACK_COMMITTED_RESERVATION' };
        }

        // Status is 'RESERVED': transition to 'ROLLED_BACK'
        await client.query(`
          UPDATE quota_reservations
          SET status = 'ROLLED_BACK',
              rolled_back_at = NOW(),
              updated_at = NOW()
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
    } else {
      const reservation = await db.prepare(`
        SELECT id, user_id, reply_type, status FROM quota_reservations
        WHERE id = ? OR idempotency_key = ?
      `).get(reservationIdOrKey, reservationIdOrKey);

      if (!reservation) return { rolledBack: false, error: 'RESERVATION_NOT_FOUND' };
      if (reservation.status === 'ROLLED_BACK') return { rolledBack: true, alreadyRolledBack: true };
      if (reservation.status === 'COMMITTED') return { rolledBack: false, error: 'CANNOT_ROLLBACK_COMMITTED' };

      await db.prepare(`
        UPDATE quota_reservations
        SET status = 'ROLLED_BACK', rolled_back_at = NOW(), updated_at = NOW()
        WHERE id = ?
      `).run(reservation.id);

      redisClient.del(`cache:usage:${reservation.user_id}`).catch(() => {});
      return { rolledBack: true, reservationId: reservation.id };
    }
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
          SET status = 'ROLLED_BACK',
              rolled_back_at = NOW(),
              updated_at = NOW()
          WHERE status = 'RESERVED' AND expires_at <= NOW()
          RETURNING id, user_id
        `);
        const count = res.rowCount || 0;
        if (count > 0) {
          const userIds = [...new Set(res.rows.map(r => r.user_id))];
          userIds.forEach(uid => redisClient.del(`cache:usage:${uid}`).catch(() => {}));
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
