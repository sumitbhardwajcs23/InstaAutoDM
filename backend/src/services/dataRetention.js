/**
 * Data Retention, GDPR Portability & Erasure Service
 * Implements automated TTL data pruning, GDPR Art. 20 User Data Export,
 * and GDPR Art. 17 Right to Erasure ("Right to be Forgotten").
 */

const crypto = require('crypto');
const db = require('../db');
const logger = require('./logger');

const RETENTION_WINDOWS = {
  webhook_events_days: parseInt(process.env.RETENTION_DAYS_WEBHOOKS || '90', 10),
  messages_days: parseInt(process.env.RETENTION_DAYS_MESSAGES || '365', 10),
  activity_log_days: parseInt(process.env.RETENTION_DAYS_ACTIVITY_LOG || '730', 10),
  error_events_days: parseInt(process.env.RETENTION_DAYS_ERROR_EVENTS || '30', 10),
  resolved_dlq_days: parseInt(process.env.RETENTION_DAYS_RESOLVED_DLQ || '7', 10),
  audit_logs_days: parseInt(process.env.RETENTION_DAYS_AUDIT_LOGS || '1825', 10), // 5 years
  tenant_api_usage_days: parseInt(process.env.RETENTION_DAYS_API_USAGE || '90', 10)
};

class DataRetentionService {
  constructor(database = db) {
    this.db = database;
  }

  /**
   * Run automated pruning of expired records based on configured retention policies
   */
  async pruneExpiredData() {
    const start = Date.now();
    const results = {};
    const pool = this.db.getPgPool();
    if (!pool) throw new Error('Database pool unavailable');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Webhook events (e.g. 90 days)
      const resWebhooks = await client.query(`
        DELETE FROM webhook_events 
        WHERE created_at < to_char(NOW() - INTERVAL '${RETENTION_WINDOWS.webhook_events_days} days', 'YYYY-MM-DD HH24:MI:SS')
      `);
      results.webhook_events = resWebhooks.rowCount || 0;

      // 2. Resolved DLQ items (e.g. 7 days after resolution)
      const resDlq = await client.query(`
        DELETE FROM dead_letter_queue 
        WHERE is_resolved = 1 
          AND resolved_at < to_char(NOW() - INTERVAL '${RETENTION_WINDOWS.resolved_dlq_days} days', 'YYYY-MM-DD HH24:MI:SS')
      `);
      results.resolved_dlq = resDlq.rowCount || 0;

      // 3. Error telemetry events (e.g. 30 days)
      const resErrors = await client.query(`
        DELETE FROM error_events 
        WHERE last_seen_at < to_char(NOW() - INTERVAL '${RETENTION_WINDOWS.error_events_days} days', 'YYYY-MM-DD HH24:MI:SS')
      `);
      results.error_events = resErrors.rowCount || 0;

      // 4. Activity logs (e.g. 2 years)
      const resActivity = await client.query(`
        DELETE FROM activity_log 
        WHERE created_at < to_char(NOW() - INTERVAL '${RETENTION_WINDOWS.activity_log_days} days', 'YYYY-MM-DD HH24:MI:SS')
      `);
      results.activity_log = resActivity.rowCount || 0;

      // 5. Tenant API usage metering records (e.g. 90 days)
      const resUsage = await client.query(`
        DELETE FROM tenant_api_usage 
        WHERE created_at < to_char(NOW() - INTERVAL '${RETENTION_WINDOWS.tenant_api_usage_days} days', 'YYYY-MM-DD HH24:MI:SS')
      `);
      results.tenant_api_usage = resUsage.rowCount || 0;

      await client.query('COMMIT');

      const durationMs = Date.now() - start;
      logger.info(`[DataRetention] Pruned expired records in ${durationMs}ms`, results);
      return { success: true, pruned: results, durationMs };
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('[DataRetention] Pruning job failed:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Export all user data as portable JSON (GDPR Article 20)
   */
  async exportUserData(userId) {
    const pool = this.db.getPgPool();
    if (!pool) throw new Error('Database pool unavailable');

    // 1. Fetch user profile (sanitize password_hash)
    const userRes = await pool.query(
      'SELECT id, email, name, avatar_url, plan, role, status, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );
    if (!userRes.rows || userRes.rows.length === 0) {
      throw new Error(`User ${userId} not found`);
    }
    const user = userRes.rows[0];

    // 2. Fetch connected accounts (redact sensitive token ciphertexts)
    const accountsRes = await pool.query(
      `SELECT id, ig_user_id, username, account_type, page_id, fb_page_name, status, 
              disclosure_message, followers_count, full_name, created_at 
       FROM instagram_accounts WHERE user_id = $1`,
      [userId]
    );

    // 3. Fetch automation rules
    const accountIds = (accountsRes.rows || []).map(a => a.id);
    let rules = [];
    if (accountIds.length > 0) {
      const rulesRes = await pool.query(
        `SELECT id, instagram_account_id, type, trigger_keyword, match_mode, reply_message, is_active, created_at 
         FROM automation_rules WHERE instagram_account_id = ANY($1)`,
        [accountIds]
      );
      rules = rulesRes.rows || [];
    }

    // 4. Fetch subscription & invoices
    const subRes = await pool.query(
      'SELECT id, plan, status, billing_cycle, current_period_start, current_period_end, created_at FROM subscriptions WHERE user_id = $1',
      [userId]
    );
    const invoicesRes = await pool.query(
      'SELECT id, invoice_number, amount, currency, status, billing_name, billing_email, paid_at, created_at FROM invoices WHERE user_id = $1',
      [userId]
    );

    // 5. Fetch audit logs where actor is this user
    const auditRes = await pool.query(
      'SELECT id, action, details, ip_address, created_at FROM audit_logs WHERE actor_id = $1 ORDER BY created_at DESC LIMIT 500',
      [userId]
    );

    return {
      metadata: {
        export_version: '1.0',
        generated_at: new Date().toISOString(),
        user_id: userId,
        compliance: 'GDPR Article 20 Right to Data Portability'
      },
      user,
      instagram_accounts: accountsRes.rows || [],
      automation_rules: rules,
      subscription: subRes.rows[0] || null,
      invoices: invoicesRes.rows || [],
      recent_audit_logs: auditRes.rows || []
    };
  }

  /**
   * Delete all user data permanently with cascade (GDPR Article 17)
   */
  async deleteUserData(userId, requestedBy = 'user') {
    const pool = this.db.getPgPool();
    if (!pool) throw new Error('Database pool unavailable');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userRes = await client.query('SELECT id, email FROM users WHERE id = $1', [userId]);
      if (!userRes.rows || userRes.rows.length === 0) {
        throw new Error(`User ${userId} not found`);
      }
      const user = userRes.rows[0];

      // Generate confirmation code
      const confirmationCode = `DEL-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

      // Delete user - cascades to instagram_accounts, rules, subscriptions, invoices, workspaces
      await client.query('DELETE FROM users WHERE id = $1', [userId]);

      // Record deletion request record
      await client.query(`
        INSERT INTO data_deletion_requests (id, confirmation_code, user_id, status, details, requested_at, completed_at)
        VALUES ($1, $2, $3, 'completed', $4, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      `, [
        `del-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        confirmationCode,
        userId,
        JSON.stringify({ email: user.email, requestedBy, deleted_at: new Date().toISOString() })
      ]);

      await client.query('COMMIT');
      logger.info(`[DataRetention] Permanently erased user ${userId} (Code: ${confirmationCode})`);

      return {
        success: true,
        confirmation_code: confirmationCode,
        erased_user_id: userId,
        status: 'completed',
        deleted_at: new Date().toISOString()
      };
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`[DataRetention] Failed to delete user ${userId}:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Schedule recurring pruning jobs (runs daily)
   */
  scheduleRetentionJobs(intervalMs = 24 * 60 * 60 * 1000) {
    const timer = setInterval(() => {
      this.pruneExpiredData().catch(err => {
        logger.error('[DataRetention] Periodic retention pruning failed:', err.message);
      });
    }, intervalMs);

    if (timer.unref) timer.unref();
    return timer;
  }
}

const dataRetention = new DataRetentionService();

module.exports = {
  DataRetentionService,
  dataRetention,
  RETENTION_WINDOWS
};
