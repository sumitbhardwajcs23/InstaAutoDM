/**
 * Cost Protection & Tenant API Metering Engine
 * Tracks Meta Graph API and AI consumption per-tenant, enforces quota limits,
 * and triggers alerts when tenants approach plan thresholds.
 */

const crypto = require('crypto');
const db = require('../db');
const logger = require('./logger');

const API_QUOTAS_BY_PLAN = {
  free: 1000,
  starter: 10000,
  pro: 50000,
  agency: 250000,
  enterprise: 1000000
};

class CostProtectionService {
  constructor(database = db) {
    this.db = database;
  }

  /**
   * Record an API invocation for tenant accounting
   */
  async recordApiCall({
    userId,
    accountId = null,
    apiType = 'meta_graph',
    endpoint = '',
    costUnits = 1,
    statusCode = 200,
    details = null
  }) {
    if (!userId) return;
    const pool = this.db.getPgPool();
    if (!pool) return;

    try {
      const id = `use-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      await pool.query(`
        INSERT INTO tenant_api_usage (
          id, user_id, account_id, api_type, endpoint, cost_units, status_code, details, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      `, [
        id,
        userId,
        accountId,
        apiType,
        endpoint,
        costUnits,
        statusCode,
        typeof details === 'object' ? JSON.stringify(details) : details
      ]);
    } catch (err) {
      logger.warn('[CostProtection] Failed to record API usage:', err.message);
    }
  }

  /**
   * Check whether tenant has available quota under their plan
   */
  async checkTenantQuota(userId, apiType = 'meta_graph') {
    if (!userId) return { allowed: true, usagePercent: 0 };
    const pool = this.db.getPgPool();
    if (!pool) return { allowed: true, usagePercent: 0 };

    try {
      // Get user plan
      const userRes = await pool.query('SELECT plan FROM users WHERE id = $1', [userId]);
      const plan = (userRes.rows?.[0]?.plan || 'free').toLowerCase();
      const quotaLimit = API_QUOTAS_BY_PLAN[plan] || API_QUOTAS_BY_PLAN.free;

      // Sum units in current month
      const usageRes = await pool.query(`
        SELECT COALESCE(SUM(cost_units), 0) as total_units
        FROM tenant_api_usage
        WHERE user_id = $1 
          AND created_at >= to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM-DD HH24:MI:SS')
      `, [userId]);

      const currentUnits = parseInt(usageRes.rows?.[0]?.total_units || '0', 10);
      const usagePercent = (currentUnits / quotaLimit) * 100;
      const allowed = currentUnits < quotaLimit;

      // Threshold alert at 80%
      if (usagePercent >= 80 && usagePercent < 100) {
        logger.warn(`[CostProtection] Tenant ${userId} reached ${usagePercent.toFixed(1)}% of ${plan} API quota (${currentUnits}/${quotaLimit})`);
      }

      return {
        allowed,
        currentUnits,
        maxUnits: quotaLimit,
        usagePercent: Math.min(100, usagePercent),
        plan
      };
    } catch (err) {
      logger.warn('[CostProtection] Error checking quota:', err.message);
      return { allowed: true, usagePercent: 0 };
    }
  }

  /**
   * Get 30-day API usage summary for a tenant
   */
  async getTenantUsageSummary(userId) {
    const pool = this.db.getPgPool();
    if (!pool || !userId) return { totalUnits: 0, byEndpoint: [] };

    try {
      const summaryRes = await pool.query(`
        SELECT api_type, endpoint, COUNT(*) as call_count, COALESCE(SUM(cost_units), 0) as total_units
        FROM tenant_api_usage
        WHERE user_id = $1
          AND created_at >= to_char(NOW() - INTERVAL '30 days', 'YYYY-MM-DD HH24:MI:SS')
        GROUP BY api_type, endpoint
        ORDER BY total_units DESC
      `, [userId]);

      return {
        userId,
        items: summaryRes.rows || []
      };
    } catch (err) {
      logger.warn('[CostProtection] Error fetching tenant summary:', err.message);
      return { userId, items: [] };
    }
  }
}

const costProtection = new CostProtectionService();

module.exports = {
  CostProtectionService,
  costProtection,
  API_QUOTAS_BY_PLAN
};
