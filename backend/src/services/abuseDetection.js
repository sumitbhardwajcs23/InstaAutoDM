/**
 * Abuse Detection & Kill Switch Engine
 * Prevents spam, detects anomalous dispatch velocity or error spikes,
 * and enforces global, per-tenant, and per-rule emergency kill switches.
 */

const crypto = require('crypto');
const db = require('../db');
const logger = require('./logger');

const THRESHOLDS = {
  max_dms_per_hour: parseInt(process.env.ABUSE_MAX_DMS_PER_HOUR || '120', 10),
  max_errors_per_window: parseInt(process.env.ABUSE_MAX_ERRORS_PER_WINDOW || '25', 10),
  webhook_flood_per_min: parseInt(process.env.ABUSE_WEBHOOK_FLOOD_PER_MIN || '300', 10)
};

class AbuseDetectionService {
  constructor(database = db) {
    this.db = database;
    // In-memory sliding velocity buckets: accountId -> [timestamps]
    this.dispatchBuckets = new Map();
    this.errorBuckets = new Map();
  }

  /**
   * Check if global kill switch is currently active
   */
  async isGlobalKillSwitchActive() {
    const pool = this.db.getPgPool();
    if (!pool) return false;

    try {
      const res = await pool.query(
        "SELECT is_active FROM global_kill_switch WHERE scope = 'global' AND target_id = 'all' AND is_active = 1"
      );
      return (res.rows && res.rows.length > 0);
    } catch (err) {
      logger.warn('[AbuseDetection] Error checking global kill switch:', err.message);
      return false;
    }
  }

  /**
   * Check if a specific Instagram account is paused via kill switch
   */
  async isAccountPaused(accountId) {
    const pool = this.db.getPgPool();
    if (!pool || !accountId) return false;

    try {
      const res = await pool.query(
        "SELECT is_active FROM global_kill_switch WHERE scope = 'account' AND target_id = $1 AND is_active = 1",
        [accountId]
      );
      return (res.rows && res.rows.length > 0);
    } catch (err) {
      logger.warn(`[AbuseDetection] Error checking account kill switch for ${accountId}:`, err.message);
      return false;
    }
  }

  /**
   * Check if a specific rule is paused via kill switch
   */
  async isRulePaused(ruleId) {
    const pool = this.db.getPgPool();
    if (!pool || !ruleId) return false;

    try {
      const res = await pool.query(
        "SELECT is_active FROM global_kill_switch WHERE scope = 'rule' AND target_id = $1 AND is_active = 1",
        [ruleId]
      );
      return (res.rows && res.rows.length > 0);
    } catch (err) {
      logger.warn(`[AbuseDetection] Error checking rule kill switch for ${ruleId}:`, err.message);
      return false;
    }
  }

  /**
   * Toggle global kill switch (All automation)
   */
  async setGlobalKillSwitch(isActive, reason = 'Emergency pause by admin', activatedBy = 'system') {
    const pool = this.db.getPgPool();
    if (!pool) throw new Error('Database pool unavailable');

    const id = 'kill-global-all';
    await pool.query(`
      INSERT INTO global_kill_switch (id, scope, target_id, is_active, reason, activated_by, activated_at, deactivated_at)
      VALUES ($1, 'global', 'all', $2, $3, $4, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), $5)
      ON CONFLICT (id) DO UPDATE SET
        is_active = $2,
        reason = $3,
        activated_by = $4,
        activated_at = CASE WHEN $2 = 1 THEN to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') ELSE global_kill_switch.activated_at END,
        deactivated_at = $5
    `, [
      id,
      isActive ? 1 : 0,
      reason,
      activatedBy,
      isActive ? null : new Date().toISOString()
    ]);

    logger.warn(`[AbuseDetection] Global kill switch ${isActive ? 'ACTIVATED' : 'DEACTIVATED'} by ${activatedBy}: ${reason}`);
    return { scope: 'global', target_id: 'all', is_active: isActive ? 1 : 0 };
  }

  /**
   * Toggle per-account kill switch
   */
  async setAccountKillSwitch(accountId, isActive, reason = 'Account-level pause', activatedBy = 'system') {
    const pool = this.db.getPgPool();
    if (!pool) throw new Error('Database pool unavailable');

    const id = `kill-acc-${accountId}`;
    await pool.query(`
      INSERT INTO global_kill_switch (id, scope, target_id, is_active, reason, activated_by, activated_at, deactivated_at)
      VALUES ($1, 'account', $2, $3, $4, $5, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), $6)
      ON CONFLICT (id) DO UPDATE SET
        is_active = $3,
        reason = $4,
        activated_by = $5,
        activated_at = CASE WHEN $3 = 1 THEN to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') ELSE global_kill_switch.activated_at END,
        deactivated_at = $6
    `, [
      id,
      accountId,
      isActive ? 1 : 0,
      reason,
      activatedBy,
      isActive ? null : new Date().toISOString()
    ]);

    logger.warn(`[AbuseDetection] Account ${accountId} kill switch ${isActive ? 'ACTIVATED' : 'DEACTIVATED'}`);
    return { scope: 'account', target_id: accountId, is_active: isActive ? 1 : 0 };
  }

  /**
   * Toggle per-rule kill switch
   */
  async setRuleKillSwitch(ruleId, isActive, reason = 'Rule-level pause', activatedBy = 'system') {
    const pool = this.db.getPgPool();
    if (!pool) throw new Error('Database pool unavailable');

    const id = `kill-rule-${ruleId}`;
    await pool.query(`
      INSERT INTO global_kill_switch (id, scope, target_id, is_active, reason, activated_by, activated_at, deactivated_at)
      VALUES ($1, 'rule', $2, $3, $4, $5, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), $6)
      ON CONFLICT (id) DO UPDATE SET
        is_active = $3,
        reason = $4,
        activated_by = $5,
        activated_at = CASE WHEN $3 = 1 THEN to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') ELSE global_kill_switch.activated_at END,
        deactivated_at = $6
    `, [
      id,
      ruleId,
      isActive ? 1 : 0,
      reason,
      activatedBy,
      isActive ? null : new Date().toISOString()
    ]);

    return { scope: 'rule', target_id: ruleId, is_active: isActive ? 1 : 0 };
  }

  /**
   * Get all active kill switches
   */
  async getKillSwitchStatus() {
    const pool = this.db.getPgPool();
    if (!pool) return [];

    const res = await pool.query(
      'SELECT id, scope, target_id, is_active, reason, activated_by, activated_at FROM global_kill_switch WHERE is_active = 1 ORDER BY activated_at DESC'
    );
    return res.rows || [];
  }

  /**
   * Record dispatch event and check for anomalous velocity or error rate
   */
  async recordDispatch(accountId, userId, success = true) {
    if (!accountId) return;

    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Track dispatch timestamps
    if (!this.dispatchBuckets.has(accountId)) {
      this.dispatchBuckets.set(accountId, []);
    }
    const dispatches = this.dispatchBuckets.get(accountId);
    dispatches.push(now);

    // Prune entries older than 1 hour
    while (dispatches.length > 0 && dispatches[0] < oneHourAgo) {
      dispatches.shift();
    }

    // Velocity violation check
    if (dispatches.length > THRESHOLDS.max_dms_per_hour) {
      await this.flagAccount(
        accountId,
        userId,
        'velocity_exceeded',
        'critical',
        `Dispatched ${dispatches.length} messages in under 1 hour (limit: ${THRESHOLDS.max_dms_per_hour})`,
        true // Auto-pause
      );
      return;
    }

    // Error rate tracking
    if (!success) {
      if (!this.errorBuckets.has(accountId)) {
        this.errorBuckets.set(accountId, []);
      }
      const errors = this.errorBuckets.get(accountId);
      errors.push(now);

      while (errors.length > 0 && errors[0] < oneHourAgo) {
        errors.shift();
      }

      if (errors.length > THRESHOLDS.max_errors_per_window) {
        await this.flagAccount(
          accountId,
          userId,
          'high_error_rate',
          'critical',
          `Encountered ${errors.length} dispatch errors in under 1 hour (threshold: ${THRESHOLDS.max_errors_per_window})`,
          true // Auto-pause
        );
      }
    }
  }

  /**
   * Write abuse flag record to database and optionally auto-pause account
   */
  async flagAccount(accountId, userId, flagType, severity = 'warning', details = '', autoPause = false) {
    const pool = this.db.getPgPool();
    if (!pool) return;

    try {
      const flagId = `abf-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      await pool.query(`
        INSERT INTO abuse_flags (id, user_id, instagram_account_id, flag_type, severity, details, auto_paused, resolved)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
      `, [flagId, userId || null, accountId, flagType, severity, details, autoPause ? 1 : 0]);

      if (autoPause) {
        await this.setAccountKillSwitch(accountId, true, `Auto-paused: ${flagType} (${details})`, 'abuse-detector');
      }

      logger.warn(`[AbuseDetection] Account ${accountId} FLAGGED for ${flagType} (${severity})`);
    } catch (err) {
      logger.error('[AbuseDetection] Error recording abuse flag:', err.message);
    }
  }

  /**
   * Get abuse flags
   */
  async getAbuseFlags(resolved = 0) {
    const pool = this.db.getPgPool();
    if (!pool) return [];

    const res = await pool.query(
      'SELECT * FROM abuse_flags WHERE resolved = $1 ORDER BY created_at DESC LIMIT 100',
      [resolved]
    );
    return res.rows || [];
  }

  /**
   * Resolve abuse flag
   */
  async resolveAbuseFlag(flagId, resolvedBy = 'admin') {
    const pool = this.db.getPgPool();
    if (!pool) throw new Error('Database pool unavailable');

    const flagRes = await pool.query('SELECT * FROM abuse_flags WHERE id = $1', [flagId]);
    if (!flagRes.rows || flagRes.rows.length === 0) {
      throw new Error(`Abuse flag ${flagId} not found`);
    }
    const flag = flagRes.rows[0];

    await pool.query(`
      UPDATE abuse_flags 
      SET resolved = 1, resolved_by = $1, resolved_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      WHERE id = $2
    `, [resolvedBy, flagId]);

    // If it was auto-paused, lift the account kill switch
    if (flag.auto_paused && flag.instagram_account_id) {
      await this.setAccountKillSwitch(flag.instagram_account_id, false, `Resolved by ${resolvedBy}`, resolvedBy);
    }

    return { success: true, flagId, resolved: 1 };
  }
}

const abuseDetection = new AbuseDetectionService();

module.exports = {
  AbuseDetectionService,
  abuseDetection,
  THRESHOLDS
};
