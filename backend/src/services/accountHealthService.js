// backend/src/services/accountHealthService.js
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const redisClient = require('./redisClient');
const logger = require('./logger');
const {
  HEALTH_CONFIG,
  resolveHealthStateFromScore,
} = require('../constants/healthConfig');

class AccountHealthService {
  constructor() {
    // In-memory sliding window counters (used when Redis is offline)
    this.memorySuccessCounters = new Map();
    this.memoryFailureCounters = new Map();
    this.memoryModes = new Map();
    this.recalcDebounceTimers = new Map();
    this.DEBOUNCE_MS = 500;
  }

  /**
   * Fast pre-dispatch check for worker queue traffic control.
   * Cached with short TTL (10s) in Redis/Memory to avoid DB latency on high volume.
   */
  async getAutomationMode(accountId) {
    if (!accountId) return 'NORMAL';
    const cacheKey = `health:mode:${accountId}`;
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return cached;
    } catch (_) {}

    if (this.memoryModes.has(accountId)) {
      return this.memoryModes.get(accountId);
    }

    try {
      const pool = db.getPgPool();
      let mode = 'NORMAL';
      if (pool) {
        const res = await pool.query(
          'SELECT automation_mode FROM instagram_account_health_state WHERE instagram_account_id = $1',
          [accountId]
        );
        if (res.rows[0]?.automation_mode) {
          mode = res.rows[0].automation_mode;
        }
      } else {
        const row = await db.prepare(
          'SELECT automation_mode FROM instagram_account_health_state WHERE instagram_account_id = ?'
        ).get(accountId);
        if (row?.automation_mode) mode = row.automation_mode;
      }

      this.memoryModes.set(accountId, mode);
      redisClient.set(cacheKey, mode, 10).catch(() => {});
      return mode;
    } catch (err) {
      logger.warn(`[AccountHealth] Failed to get automation mode for ${accountId}, falling back to NORMAL:`, err.message);
      return 'NORMAL';
    }
  }

  /**
   * Records a normal successful send.
   * KEY ARCHITECTURAL CORRECTION (Rule 4):
   * Does NOT insert individual PostgreSQL rows for normal successes to prevent write amplification.
   * Increments fast sliding counters in Redis/Memory and updates rolling 24h totals.
   */
  async recordSuccess(accountId, userId = null, subscriptionId = null) {
    if (!accountId) return;
    const now = Date.now();
    const redisKey = `health:acc:${accountId}:success_24h`;

    try {
      await redisClient.incr(redisKey);
      await redisClient.expire(redisKey, 86400);
    } catch (_) {
      const current = this.memorySuccessCounters.get(accountId) || 0;
      this.memorySuccessCounters.set(accountId, current + 1);
    }

    // Reset consecutive failures on success
    try {
      const pool = db.getPgPool();
      if (pool) {
        await pool.query(`
          UPDATE instagram_account_health_state
          SET consecutive_failures = 0,
              rolling_24h_successes = rolling_24h_successes + 1,
              updated_at = NOW()
          WHERE instagram_account_id = $1
        `, [accountId]);
      } else {
        await db.prepare(`
          UPDATE instagram_account_health_state
          SET consecutive_failures = 0,
              rolling_24h_successes = rolling_24h_successes + 1,
              updated_at = datetime('now')
          WHERE instagram_account_id = ?
        `).run(accountId);
      }
    } catch (e) {
      // Non-blocking
    }

    // Schedule debounced recalculation if account is currently in CAUTION or PROTECTION to evaluate sustained recovery
    const currentMode = this.memoryModes.get(accountId) || 'NORMAL';
    if (currentMode !== 'NORMAL') {
      this.scheduleRecalculation(accountId);
    }
  }

  /**
   * Records a significant observable health incident.
   * Writes durable, append-only row to instagram_account_health_events (NO secrets/tokens).
   * Triggers immediate progressive health recalculation.
   */
  async recordIncident({
    accountId,
    userId = null,
    subscriptionId = null,
    eventType,
    severity = 'medium',
    source = 'worker_queue',
    statusCode = null,
    errorCode = null,
    metadata = {}
  }) {
    if (!accountId) return;

    // Sanitize metadata to guarantee ZERO secrets, tokens, or personal data (PII) are persisted
    const sanitizedMeta = { ...metadata };
    delete sanitizedMeta.token;
    delete sanitizedMeta.access_token;
    delete sanitizedMeta.accessToken;
    delete sanitizedMeta.page_access_token;
    delete sanitizedMeta.app_secret;
    delete sanitizedMeta.client_secret;
    delete sanitizedMeta.message_text;
    delete sanitizedMeta.message;
    delete sanitizedMeta.text;
    delete sanitizedMeta.comment_text;
    delete sanitizedMeta.recipient_id;
    delete sanitizedMeta.recipient_name;
    delete sanitizedMeta.email;
    delete sanitizedMeta.username;
    delete sanitizedMeta.ip;

    const eventId = `ahe_${uuidv4().replace(/-/g, '')}`;

    try {
      const pool = db.getPgPool();
      if (pool) {
        await pool.query(`
          INSERT INTO instagram_account_health_events (
            id, instagram_account_id, user_id, subscription_id, event_type,
            severity, source, status_code, error_code, metadata, occurred_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW(), NOW())
        `, [
          eventId, accountId, userId, subscriptionId, eventType,
          severity, source, statusCode, errorCode, JSON.stringify(sanitizedMeta)
        ]);

        // Increment consecutive failure count and total failure count
        await pool.query(`
          UPDATE instagram_account_health_state
          SET consecutive_failures = consecutive_failures + 1,
              rolling_24h_failures = rolling_24h_failures + 1,
              observed_rate_limit_count = observed_rate_limit_count + (CASE WHEN $2 = 'RATE_LIMIT_429' THEN 1 ELSE 0 END),
              last_incident_at = NOW(),
              last_incident_type = $2,
              updated_at = NOW()
          WHERE instagram_account_id = $1
        `, [accountId, eventType]);
      } else {
        await db.prepare(`
          INSERT INTO instagram_account_health_events (
            id, instagram_account_id, user_id, subscription_id, event_type,
            severity, source, status_code, error_code, metadata, occurred_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(
          eventId, accountId, userId, subscriptionId, eventType,
          severity, source, statusCode, errorCode, JSON.stringify(sanitizedMeta)
        );

        await db.prepare(`
          UPDATE instagram_account_health_state
          SET consecutive_failures = consecutive_failures + 1,
              rolling_24h_failures = rolling_24h_failures + 1,
              observed_rate_limit_count = observed_rate_limit_count + (CASE WHEN ? = 'RATE_LIMIT_429' THEN 1 ELSE 0 END),
              last_incident_at = datetime('now'),
              last_incident_type = ?,
              updated_at = datetime('now')
          WHERE instagram_account_id = ?
        `).run(eventType, eventType, accountId);
      }

      logger.warn(`[AccountHealth] ⚠️ Recorded incident ${eventType} on account ${accountId} (HTTP ${statusCode || 'N/A'})`);
    } catch (err) {
      logger.error(`[AccountHealth] Failed to persist health incident for ${accountId}:`, err.message);
    }

    // Trigger progressive recalculation
    await this.calculateHealthScore(accountId);
  }

  /**
   * Debounced recalculation scheduler for high-frequency send streams.
   */
  scheduleRecalculation(accountId) {
    if (this.recalcDebounceTimers.has(accountId)) {
      clearTimeout(this.recalcDebounceTimers.get(accountId));
    }
    const timer = setTimeout(() => {
      this.recalcDebounceTimers.delete(accountId);
      this.calculateHealthScore(accountId).catch(err => {
        logger.error(`[AccountHealth] Async recalculation error for ${accountId}:`, err.message);
      });
    }, this.DEBOUNCE_MS);
    this.recalcDebounceTimers.set(accountId, timer);
  }

  /**
   * Reproducible, Explainable Internal Airvix Risk Score Calculation (Model v1.0).
   * Follows Progressive Degradation & Sustained Normalization Recovery rules.
   */
  async calculateHealthScore(accountId) {
    if (!accountId) return null;
    const pool = db.getPgPool();
    const now = Date.now();

    try {
      // 1. Fetch current health state snapshot
      let currentState = null;
      if (pool) {
        const res = await pool.query(
          'SELECT * FROM instagram_account_health_state WHERE instagram_account_id = $1',
          [accountId]
        );
        currentState = res.rows[0];
      } else {
        currentState = await db.prepare(
          'SELECT * FROM instagram_account_health_state WHERE instagram_account_id = ?'
        ).get(accountId);
      }

      if (!currentState) {
        // Ensure baseline exists
        await this.initializeAccountState(accountId);
        currentState = {
          health_score: 100,
          health_status: 'HEALTHY',
          automation_mode: 'NORMAL',
          consecutive_failures: 0,
          rolling_24h_successes: 0,
          rolling_24h_failures: 0,
          observed_rate_limit_count: 0
        };
      }

      // 2. Query incidents in rolling windows
      // 15 minutes window for immediate failures
      // 24 hours window for daily rate limits and auth events
      let events24h = [];
      if (pool) {
        const eventsRes = await pool.query(`
          SELECT event_type, severity, status_code, error_code, occurred_at
          FROM instagram_account_health_events
          WHERE instagram_account_id = $1
            AND occurred_at >= NOW() - INTERVAL '24 hours'
          ORDER BY occurred_at DESC
        `, [accountId]);
        events24h = eventsRes.rows;
      } else {
        events24h = await db.prepare(`
          SELECT event_type, severity, status_code, error_code, occurred_at
          FROM instagram_account_health_events
          WHERE instagram_account_id = ?
            AND occurred_at >= datetime('now', '-24 hours')
          ORDER BY occurred_at DESC
        `).all(accountId) || [];
      }

      const fifteenMinsAgo = now - (15 * 60 * 1000);
      const oneHourAgo = now - (60 * 60 * 1000);

      const events15m = events24h.filter(e => new Date(e.occurred_at).getTime() >= fifteenMinsAgo);
      const events1h = events24h.filter(e => new Date(e.occurred_at).getTime() >= oneHourAgo);

      // Count incident types
      const rateLimits15m = events15m.filter(e => e.event_type === 'RATE_LIMIT_429');
      const rateLimits1h = events1h.filter(e => e.event_type === 'RATE_LIMIT_429');
      const rateLimits24h = events24h.filter(e => e.event_type === 'RATE_LIMIT_429');
      const authErrors24h = events24h.filter(e => e.event_type === 'AUTH_ERROR' || e.event_type === 'TOKEN_EXPIRED');
      const deliveryFailures15m = events15m.filter(e => e.event_type === 'DELIVERY_FAILURE' || e.event_type === 'API_ERROR');

      // Calculate rolling success/failure ratio
      const consecutiveFailures = Number(currentState.consecutive_failures || 0);
      const totalFailures24h = Number(currentState.rolling_24h_failures || 0);
      const totalSuccesses24h = Number(currentState.rolling_24h_successes || 0);
      const totalRequests15m = deliveryFailures15m.length + (totalSuccesses24h > 0 ? Math.min(totalSuccesses24h, 15) : 0);
      const errorRate15m = totalRequests15m > 0 ? (deliveryFailures15m.length / totalRequests15m) * 100 : 0;

      // ── 3. Apply Transparent Configurable Scoring Model ────────────────────
      let calculatedScore = HEALTH_CONFIG.WEIGHTS.BASE_SCORE;
      const scoreReasons = [];

      // A. Rate Limit 429 Penalties (Progressive Degradation, Rule 2)
      if (rateLimits15m.length === 1) {
        // First transient 429: Drops to ~85 (enters CAUTION), not knee-jerk pause
        calculatedScore -= HEALTH_CONFIG.WEIGHTS.RATE_LIMIT_FIRST_429;
        scoreReasons.push(`Observed 1 rate-limit response in last 15m (-${HEALTH_CONFIG.WEIGHTS.RATE_LIMIT_FIRST_429} pts)`);
      } else if (rateLimits15m.length === 2) {
        // Repeated 429s in 15m: Drops to ~60 (enters PROTECTION)
        const penalty = HEALTH_CONFIG.WEIGHTS.RATE_LIMIT_FIRST_429 + HEALTH_CONFIG.WEIGHTS.RATE_LIMIT_REPEAT_429;
        calculatedScore -= penalty;
        scoreReasons.push(`Repeated rate-limit responses (2 in 15m) (-${penalty} pts)`);
      } else if (rateLimits15m.length >= 3) {
        // Persistent 429s: Drops to <40 (enters PAUSED)
        const penalty = HEALTH_CONFIG.WEIGHTS.RATE_LIMIT_FIRST_429 + HEALTH_CONFIG.WEIGHTS.RATE_LIMIT_REPEAT_429 + HEALTH_CONFIG.WEIGHTS.RATE_LIMIT_PERSISTENT_429;
        calculatedScore -= penalty;
        scoreReasons.push(`Persistent rate-limit responses (${rateLimits15m.length} in 15m) (-${penalty} pts)`);
      } else if (rateLimits1h.length > 0) {
        // Time decay on older 429s (between 15m and 1h)
        const decayedPenalty = Math.round(HEALTH_CONFIG.WEIGHTS.RATE_LIMIT_FIRST_429 * 0.5);
        calculatedScore -= decayedPenalty;
        scoreReasons.push(`Rate-limit response observed earlier in the hour (decayed: -${decayedPenalty} pts)`);
      } else {
        scoreReasons.push('No recent rate-limit responses observed');
      }

      // B. Authentication / Token Revocation
      if (authErrors24h.length > 0) {
        const latestAuth = authErrors24h[0];
        const ageHours = (now - new Date(latestAuth.occurred_at).getTime()) / (3600 * 1000);
        if (ageHours < 6) {
          calculatedScore -= HEALTH_CONFIG.WEIGHTS.AUTH_REVOCATION_PENALTY;
          scoreReasons.push(`Active authentication/token error detected (-${HEALTH_CONFIG.WEIGHTS.AUTH_REVOCATION_PENALTY} pts)`);
        }
      }

      // C. Consecutive Delivery Failures
      if (consecutiveFailures >= 10) {
        calculatedScore -= HEALTH_CONFIG.WEIGHTS.CONSECUTIVE_FAILURES_10;
        scoreReasons.push(`High consecutive failure count (${consecutiveFailures}) (-${HEALTH_CONFIG.WEIGHTS.CONSECUTIVE_FAILURES_10} pts)`);
      } else if (consecutiveFailures >= 5) {
        calculatedScore -= HEALTH_CONFIG.WEIGHTS.CONSECUTIVE_FAILURES_5;
        scoreReasons.push(`Consecutive failure count (${consecutiveFailures}) (-${HEALTH_CONFIG.WEIGHTS.CONSECUTIVE_FAILURES_5} pts)`);
      } else if (consecutiveFailures >= 3) {
        calculatedScore -= HEALTH_CONFIG.WEIGHTS.CONSECUTIVE_FAILURES_3;
        scoreReasons.push(`Elevated consecutive failures (${consecutiveFailures}) (-${HEALTH_CONFIG.WEIGHTS.CONSECUTIVE_FAILURES_3} pts)`);
      }

      // D. 15-Minute Error Rate Spikes
      if (errorRate15m >= 50 && deliveryFailures15m.length >= 3) {
        calculatedScore -= HEALTH_CONFIG.WEIGHTS.ERROR_RATE_15M_TIER3;
        scoreReasons.push(`Critical delivery failure rate (${errorRate15m.toFixed(0)}% in 15m) (-${HEALTH_CONFIG.WEIGHTS.ERROR_RATE_15M_TIER3} pts)`);
      } else if (errorRate15m >= 30 && deliveryFailures15m.length >= 2) {
        calculatedScore -= HEALTH_CONFIG.WEIGHTS.ERROR_RATE_15M_TIER2;
        scoreReasons.push(`Elevated delivery failure rate (${errorRate15m.toFixed(0)}% in 15m) (-${HEALTH_CONFIG.WEIGHTS.ERROR_RATE_15M_TIER2} pts)`);
      } else if (errorRate15m >= 15 && deliveryFailures15m.length >= 2) {
        calculatedScore -= HEALTH_CONFIG.WEIGHTS.ERROR_RATE_15M_TIER1;
        scoreReasons.push(`Minor failure spike (${errorRate15m.toFixed(0)}% in 15m) (-${HEALTH_CONFIG.WEIGHTS.ERROR_RATE_15M_TIER1} pts)`);
      }

      // E. Sustained Normalization & Recovery (Rule 11)
      // If no failures or rate limits observed in quiet period (e.g. 20m) and clean successful operations exist
      const lastIncidentAgeMs = currentState.last_incident_at 
        ? now - new Date(currentState.last_incident_at).getTime()
        : Infinity;
      const quietPeriodMs = HEALTH_CONFIG.DECAY_AND_RECOVERY.QUIET_PERIOD_MINUTES * 60 * 1000;

      if (lastIncidentAgeMs >= quietPeriodMs && events15m.length === 0 && totalSuccesses24h > 0) {
        // Gradual recovery points based on verified quiet normalization
        const recoveryPoints = Math.min(
          HEALTH_CONFIG.DECAY_AND_RECOVERY.MAX_RECOVERY_POINTS_PER_EVAL,
          HEALTH_CONFIG.DECAY_AND_RECOVERY.RECOVERY_STEP_POINTS
        );
        calculatedScore = Math.min(100, calculatedScore + recoveryPoints);
        scoreReasons.push(`Sustained clean operation for ${Math.round(lastIncidentAgeMs / 60000)}m (+${recoveryPoints} recovery pts)`);
      }

      // Bound score between 0 and 100
      const boundedScore = Math.max(0, Math.min(100, Math.round(calculatedScore)));

      // Resolve health_status and automation_mode explicitly
      const resolved = resolveHealthStateFromScore(boundedScore);

      const previousMode = currentState.automation_mode || 'NORMAL';
      const previousScore = currentState.health_score || 100;
      const isModeChanged = previousMode !== resolved.mode;

      // 4. Update snapshot state in database
      const finalErrorRate = Math.min(100, Math.max(0, parseFloat(errorRate15m.toFixed(2))));
      if (pool) {
        await pool.query(`
          UPDATE instagram_account_health_state SET
            health_score = $1,
            health_status = $2,
            automation_mode = $3,
            observed_risk_level = $4,
            recent_error_rate = $5,
            score_reasons = $6::jsonb,
            last_calculated_at = NOW(),
            updated_at = NOW()
          WHERE instagram_account_id = $7
        `, [
          resolved.score,
          resolved.status,
          resolved.mode,
          resolved.riskLevel,
          finalErrorRate,
          JSON.stringify(scoreReasons),
          accountId
        ]);

        // Insert snapshot for lightweight trend rendering if mode/score changed or periodically (Rule 5)
        if (isModeChanged || Math.abs(previousScore - resolved.score) >= 10) {
          const snapshotId = `ahs_${uuidv4().replace(/-/g, '')}`;
          await pool.query(`
            INSERT INTO instagram_account_health_snapshots (
              id, instagram_account_id, health_score, health_status, automation_mode, error_rate, rate_limit_count, snapshot_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          `, [
            snapshotId, accountId, resolved.score, resolved.status, resolved.mode,
            finalErrorRate, rateLimits24h.length
          ]);
        }
      } else {
        await db.prepare(`
          UPDATE instagram_account_health_state SET
            health_score = ?,
            health_status = ?,
            automation_mode = ?,
            observed_risk_level = ?,
            recent_error_rate = ?,
            score_reasons = ?,
            last_calculated_at = datetime('now'),
            updated_at = datetime('now')
          WHERE instagram_account_id = ?
        `).run(
          resolved.score,
          resolved.status,
          resolved.mode,
          resolved.riskLevel,
          finalErrorRate,
          JSON.stringify(scoreReasons),
          accountId
        );
      }

      // Update cache
      this.memoryModes.set(accountId, resolved.mode);
      redisClient.set(`health:mode:${accountId}`, resolved.mode, 10).catch(() => {});

      // 5. Emit structured log if state or mode changed (Rule 24)
      if (isModeChanged || Math.abs(previousScore - resolved.score) >= 15) {
        logger.info('[AccountHealth] 📊 Health state transition:', {
          event: 'instagram_health_changed',
          instagram_account_id: accountId,
          previous_score: previousScore,
          new_score: resolved.score,
          previous_mode: previousMode,
          new_mode: resolved.mode,
          health_status: resolved.status,
          reasons: scoreReasons
        });

        // Record a STATE_TRANSITION event in audit ledger
        if (isModeChanged) {
          await this.recordStateTransitionEvent(accountId, previousMode, resolved.mode, resolved.score, scoreReasons[0] || 'Health score threshold crossed');
        }
      }

      return {
        score: resolved.score,
        status: resolved.status,
        mode: resolved.mode,
        riskLevel: resolved.riskLevel,
        reasons: scoreReasons,
        consecutiveFailures,
        errorRate: finalErrorRate,
        rateLimitCount24h: rateLimits24h.length
      };
    } catch (calcErr) {
      logger.error(`[AccountHealth] Exception calculating health score for ${accountId}:`, calcErr.message);
      return null;
    }
  }

  /**
   * Records a mode transition event into the audit ledger.
   */
  async recordStateTransitionEvent(accountId, previousMode, newMode, score, reason) {
    try {
      const pool = db.getPgPool();
      const eventId = `ahe_trans_${uuidv4().replace(/-/g, '')}`;
      const meta = JSON.stringify({ previous_mode: previousMode, new_mode: newMode, score, reason });
      const severity = newMode === 'PAUSED' ? 'critical' : (newMode === 'PROTECTION' ? 'high' : (newMode === 'CAUTION' ? 'medium' : 'info'));

      if (pool) {
        await pool.query(`
          INSERT INTO instagram_account_health_events (
            id, instagram_account_id, event_type, severity, source, metadata, occurred_at, created_at
          ) VALUES ($1, $2, 'STATE_TRANSITION', $3, 'health_engine', $4::jsonb, NOW(), NOW())
        `, [eventId, accountId, severity, meta]);
      } else {
        await db.prepare(`
          INSERT INTO instagram_account_health_events (
            id, instagram_account_id, event_type, severity, source, metadata, occurred_at, created_at
          ) VALUES (?, ?, 'STATE_TRANSITION', ?, 'health_engine', ?, datetime('now'), datetime('now'))
        `).run(eventId, accountId, severity, meta);
      }
    } catch (_) {}
  }

  /**
   * Initializes baseline health state for an account if not already present.
   */
  async initializeAccountState(accountId) {
    try {
      const pool = db.getPgPool();
      if (pool) {
        await pool.query(`
          INSERT INTO instagram_account_health_state (
            instagram_account_id, health_score, health_status, automation_mode, observed_risk_level,
            consecutive_failures, rolling_24h_successes, rolling_24h_failures, recent_error_rate,
            score_reasons, last_calculated_at, updated_at
          ) VALUES ($1, 100, 'HEALTHY', 'NORMAL', 'low', 0, 0, 0, 0.00, '["Initial baseline created"]'::jsonb, NOW(), NOW())
          ON CONFLICT (instagram_account_id) DO NOTHING
        `, [accountId]);
      } else {
        await db.prepare(`
          INSERT OR IGNORE INTO instagram_account_health_state (
            instagram_account_id, health_score, health_status, automation_mode, observed_risk_level,
            consecutive_failures, rolling_24h_successes, rolling_24h_failures, recent_error_rate,
            score_reasons, last_calculated_at, updated_at
          ) VALUES (?, 100, 'HEALTHY', 'NORMAL', 'low', 0, 0, 0, 0.00, '["Initial baseline created"]', datetime('now'), datetime('now'))
        `).run(accountId);
      }
    } catch (_) {}
  }

  /**
   * Guarded manual resume from PAUSED mode (Rule 7).
   * Checks whether active severe conditions still exist.
   * If clean, steps up through controlled recovery: PAUSED -> PROTECTION -> CAUTION -> NORMAL.
   */
  async requestResume(accountId, actorUserId, role = 'customer', reason = 'Manual resume requested') {
    if (!accountId) return { success: false, error: 'No account ID provided' };

    const pool = db.getPgPool();
    let currentState = null;
    if (pool) {
      const res = await pool.query('SELECT * FROM instagram_account_health_state WHERE instagram_account_id = $1', [accountId]);
      currentState = res.rows[0];
    } else {
      currentState = await db.prepare('SELECT * FROM instagram_account_health_state WHERE instagram_account_id = ?').get(accountId);
    }

    if (!currentState) return { success: false, error: 'Account health record not found' };

    // Safety Gate: Check for active 429 or auth errors in the last 15 minutes
    let recentActiveErrors = [];
    if (pool) {
      const errRes = await pool.query(`
        SELECT event_type, occurred_at FROM instagram_account_health_events
        WHERE instagram_account_id = $1
          AND event_type IN ('RATE_LIMIT_429', 'AUTH_ERROR')
          AND occurred_at >= NOW() - INTERVAL '15 minutes'
        LIMIT 1
      `, [accountId]);
      recentActiveErrors = errRes.rows;
    } else {
      recentActiveErrors = await db.prepare(`
        SELECT event_type, occurred_at FROM instagram_account_health_events
        WHERE instagram_account_id = ?
          AND event_type IN ('RATE_LIMIT_429', 'AUTH_ERROR')
          AND occurred_at >= datetime('now', '-15 minutes')
        LIMIT 1
      `).all(accountId) || [];
    }

    if (recentActiveErrors.length > 0) {
      const latestType = recentActiveErrors[0].event_type;
      return {
        success: false,
        error: `Cannot resume yet: an active ${latestType === 'RATE_LIMIT_429' ? 'rate-limit (429)' : 'authentication issue'} was observed in the last 15 minutes. Please wait for the cool-down window to conclude.`
      };
    }

    // Controlled Stepwise Recovery (Rule 7)
    // If currently PAUSED, step up to PROTECTION first to verify stability
    const currentMode = currentState.automation_mode;
    let targetMode = 'PROTECTION';
    let targetStatus = 'ELEVATED_RISK';
    let targetScore = 55;

    if (currentMode === 'PROTECTION') {
      targetMode = 'CAUTION';
      targetStatus = 'CAUTION';
      targetScore = 75;
    } else if (currentMode === 'CAUTION') {
      targetMode = 'NORMAL';
      targetStatus = 'HEALTHY';
      targetScore = 95;
    }

    const eventId = `ahe_recov_${uuidv4().replace(/-/g, '')}`;
    const meta = JSON.stringify({
      previous_mode: currentMode,
      target_mode: targetMode,
      actor_user_id: actorUserId,
      actor_role: role,
      reason
    });

    if (pool) {
      await pool.query(`
        UPDATE instagram_account_health_state SET
          automation_mode = $1,
          health_status = $2,
          health_score = $3,
          consecutive_failures = 0,
          updated_at = NOW()
        WHERE instagram_account_id = $4
      `, [targetMode, targetStatus, targetScore, accountId]);

      await pool.query(`
        INSERT INTO instagram_account_health_events (
          id, instagram_account_id, user_id, event_type, severity, source, metadata, occurred_at, created_at
        ) VALUES ($1, $2, $3, 'CONTROLLED_RECOVERY_STEP', 'info', 'manual_action', $4::jsonb, NOW(), NOW())
      `, [eventId, accountId, actorUserId, meta]);
    } else {
      await db.prepare(`
        UPDATE instagram_account_health_state SET
          automation_mode = ?,
          health_status = ?,
          health_score = ?,
          consecutive_failures = 0,
          updated_at = datetime('now')
        WHERE instagram_account_id = ?
      `).run(targetMode, targetStatus, targetScore, accountId);

      await db.prepare(`
        INSERT INTO instagram_account_health_events (
          id, instagram_account_id, user_id, event_type, severity, source, metadata, occurred_at, created_at
        ) VALUES (?, ?, ?, 'CONTROLLED_RECOVERY_STEP', 'info', 'manual_action', ?, datetime('now'), datetime('now'))
      `).run(eventId, accountId, actorUserId, meta);
    }

    this.memoryModes.set(accountId, targetMode);
    redisClient.set(`health:mode:${accountId}`, targetMode, 10).catch(() => {});

    logger.info(`[AccountHealth] 🔄 Controlled recovery executed for ${accountId}: ${currentMode} -> ${targetMode} by ${actorUserId}`);
    return {
      success: true,
      previousMode: currentMode,
      currentMode: targetMode,
      healthStatus: targetStatus,
      healthScore: targetScore,
      message: `Account stepped up from ${currentMode} to ${targetMode}. Monitoring automated response delivery.`
    };
  }

  /**
   * Admin Mode Override (Rule 8).
   * Strictly RBAC-protected. Logs override to audit_logs and health events ledger.
   */
  async adminOverrideMode({ accountId, newMode, reason, adminId, adminEmail }) {
    if (!['NORMAL', 'CAUTION', 'PROTECTION', 'PAUSED'].includes(newMode)) {
      return { success: false, error: 'Invalid automation mode' };
    }

    const pool = db.getPgPool();
    let currentState = null;
    if (pool) {
      const res = await pool.query('SELECT * FROM instagram_account_health_state WHERE instagram_account_id = $1', [accountId]);
      currentState = res.rows[0];
    } else {
      currentState = await db.prepare('SELECT * FROM instagram_account_health_state WHERE instagram_account_id = ?').get(accountId);
    }

    if (!currentState) return { success: false, error: 'Account health record not found' };

    const previousMode = currentState.automation_mode;
    const eventId = `ahe_adm_${uuidv4().replace(/-/g, '')}`;
    const meta = JSON.stringify({
      admin_id: adminId,
      admin_email: adminEmail,
      previous_mode: previousMode,
      new_mode: newMode,
      reason: reason || 'Administrative intervention'
    });

    // Map newMode to corresponding baseline score/status
    let newScore = currentState.health_score;
    let newStatus = currentState.health_status;
    if (newMode === 'NORMAL') {
      newScore = Math.max(90, currentState.health_score);
      newStatus = 'HEALTHY';
    } else if (newMode === 'CAUTION') {
      newScore = Math.min(85, Math.max(70, currentState.health_score));
      newStatus = 'CAUTION';
    } else if (newMode === 'PROTECTION') {
      newScore = Math.min(65, Math.max(40, currentState.health_score));
      newStatus = 'ELEVATED_RISK';
    } else if (newMode === 'PAUSED') {
      newScore = Math.min(35, currentState.health_score);
      newStatus = 'CRITICAL';
    }

    if (pool) {
      await pool.query(`
        UPDATE instagram_account_health_state SET
          automation_mode = $1,
          health_status = $2,
          health_score = $3,
          updated_at = NOW()
        WHERE instagram_account_id = $4
      `, [newMode, newStatus, newScore, accountId]);

      await pool.query(`
        INSERT INTO instagram_account_health_events (
          id, instagram_account_id, user_id, event_type, severity, source, metadata, occurred_at, created_at
        ) VALUES ($1, $2, $3, 'ADMIN_MODE_OVERRIDE', 'medium', 'admin_action', $4::jsonb, NOW(), NOW())
      `, [eventId, accountId, adminId, meta]);

      // Record to audit_logs table
      const auditLogId = `log-${uuidv4().slice(0, 8)}`;
      await pool.query(`
        INSERT INTO audit_logs (id, actor_id, actor_email, action, target_resource, ip_address, details, created_at)
        VALUES ($1, $2, $3, 'instagram_health_mode_override', $4, 'Protected (Admin API)', $5, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      `, [auditLogId, adminId, adminEmail, accountId, meta]);
    } else {
      await db.prepare(`
        UPDATE instagram_account_health_state SET
          automation_mode = ?,
          health_status = ?,
          health_score = ?,
          updated_at = datetime('now')
        WHERE instagram_account_id = ?
      `).run(newMode, newStatus, newScore, accountId);

      await db.prepare(`
        INSERT INTO instagram_account_health_events (
          id, instagram_account_id, user_id, event_type, severity, source, metadata, occurred_at, created_at
        ) VALUES (?, ?, ?, 'ADMIN_MODE_OVERRIDE', 'medium', 'admin_action', ?, datetime('now'), datetime('now'))
      `).run(eventId, accountId, adminId, meta);
    }

    this.memoryModes.set(accountId, newMode);
    redisClient.set(`health:mode:${accountId}`, newMode, 10).catch(() => {});

    logger.info(`[AccountHealth] 🛡️ Admin mode override for ${accountId}: ${previousMode} -> ${newMode} by ${adminEmail} (Reason: ${reason})`);
    return {
      success: true,
      previousMode,
      newMode,
      healthStatus: newStatus,
      healthScore: newScore
    };
  }

  /**
   * Retrieves single account health state + explainable reasons.
   */
  async getAccountHealth(accountId) {
    if (!accountId) return null;
    const pool = db.getPgPool();
    try {
      let state = null;
      if (pool) {
        const res = await pool.query(
          'SELECT * FROM instagram_account_health_state WHERE instagram_account_id = $1',
          [accountId]
        );
        state = res.rows[0];
      } else {
        state = await db.prepare(
          'SELECT * FROM instagram_account_health_state WHERE instagram_account_id = ?'
        ).get(accountId);
      }

      if (!state) {
        await this.initializeAccountState(accountId);
        return {
          health_score: 100,
          health_status: 'HEALTHY',
          automation_mode: 'NORMAL',
          observed_risk_level: 'low',
          consecutive_failures: 0,
          rolling_24h_successes: 0,
          rolling_24h_failures: 0,
          observed_rate_limit_count: 0,
          recent_error_rate: 0.0,
          score_reasons: ['Initial baseline health state created']
        };
      }

      let parsedReasons = [];
      try {
        parsedReasons = typeof state.score_reasons === 'string'
          ? JSON.parse(state.score_reasons)
          : (state.score_reasons || []);
      } catch (_) {
        parsedReasons = ['Operational health normal'];
      }

      return {
        ...state,
        score_reasons: parsedReasons
      };
    } catch (err) {
      logger.error(`[AccountHealth] Error retrieving health for ${accountId}:`, err.message);
      return null;
    }
  }

  /**
   * Retrieves lightweight trend timeline (Rule 5).
   */
  async getAccountHealthHistory(accountId, limit = 48) {
    if (!accountId) return [];
    const pool = db.getPgPool();
    try {
      if (pool) {
        const res = await pool.query(`
          SELECT health_score, health_status, automation_mode, error_rate, rate_limit_count, snapshot_at
          FROM instagram_account_health_snapshots
          WHERE instagram_account_id = $1
          ORDER BY snapshot_at DESC
          LIMIT $2
        `, [accountId, limit]);
        return res.rows.reverse(); // Chronological for charts
      } else {
        const rows = await db.prepare(`
          SELECT health_score, health_status, automation_mode, error_rate, rate_limit_count, snapshot_at
          FROM instagram_account_health_snapshots
          WHERE instagram_account_id = ?
          ORDER BY snapshot_at DESC
          LIMIT ?
        `).all(accountId, limit) || [];
        return rows.reverse();
      }
    } catch (err) {
      logger.error(`[AccountHealth] History query error for ${accountId}:`, err.message);
      return [];
    }
  }

  /**
   * Retrieves raw audit events for detailed inspection.
   */
  async getAccountHealthEvents(accountId, limit = 50) {
    if (!accountId) return [];
    const pool = db.getPgPool();
    try {
      if (pool) {
        const res = await pool.query(`
          SELECT id, event_type, severity, source, status_code, error_code, metadata, occurred_at
          FROM instagram_account_health_events
          WHERE instagram_account_id = $1
          ORDER BY occurred_at DESC
          LIMIT $2
        `, [accountId, limit]);
        return res.rows;
      } else {
        return await db.prepare(`
          SELECT id, event_type, severity, source, status_code, error_code, metadata, occurred_at
          FROM instagram_account_health_events
          WHERE instagram_account_id = ?
          ORDER BY occurred_at DESC
          LIMIT ?
        `).all(accountId, limit) || [];
      }
    } catch (err) {
      logger.error(`[AccountHealth] Events query error for ${accountId}:`, err.message);
      return [];
    }
  }

  /**
   * Admin Panel Health Overview (Rule 15).
   * 100% Real Database Queries with pagination and status filtering.
   */
  async listAllAccountsHealth({
    statusFilter = null,
    modeFilter = null,
    search = '',
    sortBy = 'health_score',
    sortOrder = 'ASC',
    limit = 50,
    offset = 0
  }) {
    const pool = db.getPgPool();
    try {
      const allowedSorts = ['health_score', 'recent_error_rate', 'observed_rate_limit_count', 'updated_at', 'username'];
      const safeSort = allowedSorts.includes(sortBy) ? sortBy : 'health_score';
      const safeOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      let baseQuery = `
        FROM instagram_accounts ig
        LEFT JOIN instagram_account_health_state hs ON ig.id = hs.instagram_account_id
        LEFT JOIN users u ON ig.user_id = u.id
        WHERE ig.status != 'disconnected'
      `;
      const params = [];
      let pIdx = 1;

      if (statusFilter && statusFilter !== 'all') {
        baseQuery += ` AND hs.health_status = $${pIdx++}`;
        params.push(statusFilter.toUpperCase());
      }
      if (modeFilter && modeFilter !== 'all') {
        baseQuery += ` AND hs.automation_mode = $${pIdx++}`;
        params.push(modeFilter.toUpperCase());
      }
      if (search && search.trim()) {
        baseQuery += ` AND (LOWER(ig.username) LIKE $${pIdx} OR LOWER(u.email) LIKE $${pIdx} OR LOWER(ig.id) LIKE $${pIdx})`;
        params.push(`%${search.toLowerCase().trim()}%`);
        pIdx++;
      }

      const countRes = await pool.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
      const total = parseInt(countRes.rows[0]?.total || 0, 10);

      const dataQuery = `
        SELECT 
          ig.id as account_id,
          ig.username,
          ig.full_name,
          ig.profile_picture_url,
          ig.status as ig_status,
          ig.user_id,
          u.email as user_email,
          u.plan as user_plan,
          COALESCE(hs.health_score, 100) as health_score,
          COALESCE(hs.health_status, 'HEALTHY') as health_status,
          COALESCE(hs.automation_mode, 'NORMAL') as automation_mode,
          COALESCE(hs.observed_risk_level, 'low') as observed_risk_level,
          COALESCE(hs.consecutive_failures, 0) as consecutive_failures,
          COALESCE(hs.rolling_24h_successes, 0) as rolling_24h_successes,
          COALESCE(hs.rolling_24h_failures, 0) as rolling_24h_failures,
          COALESCE(hs.observed_rate_limit_count, 0) as observed_rate_limit_count,
          COALESCE(hs.recent_error_rate, 0.00) as recent_error_rate,
          hs.score_reasons,
          hs.last_incident_at,
          hs.last_incident_type,
          hs.updated_at as last_health_update
        ${baseQuery}
        ORDER BY ${safeSort} ${safeOrder}
        LIMIT $${pIdx++} OFFSET $${pIdx++}
      `;
      params.push(limit, offset);

      const accountsRes = await pool.query(dataQuery, params);

      // Aggregate Summary KPIs across all connected accounts
      const kpiRes = await pool.query(`
        SELECT 
          COUNT(*) as total_accounts,
          COUNT(CASE WHEN COALESCE(hs.health_status, 'HEALTHY') = 'HEALTHY' THEN 1 END) as healthy_count,
          COUNT(CASE WHEN hs.health_status = 'CAUTION' THEN 1 END) as caution_count,
          COUNT(CASE WHEN hs.health_status = 'ELEVATED_RISK' THEN 1 END) as protection_count,
          COUNT(CASE WHEN hs.automation_mode = 'PAUSED' OR hs.health_status = 'CRITICAL' THEN 1 END) as paused_count
        FROM instagram_accounts ig
        LEFT JOIN instagram_account_health_state hs ON ig.id = hs.instagram_account_id
        WHERE ig.status != 'disconnected'
      `);

      return {
        total,
        accounts: accountsRes.rows,
        kpis: {
          totalAccounts: parseInt(kpiRes.rows[0]?.total_accounts || 0, 10),
          healthy: parseInt(kpiRes.rows[0]?.healthy_count || 0, 10),
          caution: parseInt(kpiRes.rows[0]?.caution_count || 0, 10),
          protection: parseInt(kpiRes.rows[0]?.protection_count || 0, 10),
          paused: parseInt(kpiRes.rows[0]?.paused_count || 0, 10)
        }
      };
    } catch (err) {
      logger.error('[AccountHealth] Admin list query error:', err.message);
      return { total: 0, accounts: [], kpis: { totalAccounts: 0, healthy: 0, caution: 0, protection: 0, paused: 0 } };
    }
  }
}

const accountHealthService = new AccountHealthService();

module.exports = {
  AccountHealthService,
  accountHealthService
};
