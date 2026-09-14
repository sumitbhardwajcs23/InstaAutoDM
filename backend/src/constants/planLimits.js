// backend/src/constants/planLimits.js
// Dynamic plan limits — reads from admin-configured pricing plans in PostgreSQL site_settings,
// with immediate in-memory cache. Falls back to static defaults if DB is unavailable.

// ── Static Fallback Defaults ──────────────────────────────────────────────────
const PLAN_LIMITS = {
  free: 1000,
  starter: 1000,
  pro: 25000,
  agency: 100000,
  business: 100000,
  enterprise: 500000
};

const PLAN_IG_LIMITS = {
  free: 1,
  starter: 1,
  pro: 3,
  agency: 10,
  business: 10,
  enterprise: 25
};

const PLAN_RULES_LIMITS = {
  free: 5,
  starter: 5,
  pro: 25,
  agency: 100,
  business: 100,
  enterprise: 500
};

// ── Dynamic Cache — refreshed on plan mutations ───────────────────────────────
// Maps plan slug/name (lowercase) → { dmLimit, igLimit, rulesLimit }
let _dynamicPlanCache = null;
let _cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes auto-refresh

/**
 * Load admin-configured plans from PostgreSQL site_settings into memory cache.
 * Safe to call multiple times — resolves immediately if cache is fresh.
 */
async function loadDynamicPlanCache() {
  try {
    const db = require('../db');
    const cache = {};

    // 1. Sync any legacy site_settings custom_pricing_plans into pricing_plans (canonical SSOT)
    try {
      const row = await db.prepare("SELECT value FROM site_settings WHERE key = 'custom_pricing_plans'").get();
      if (row && row.value) {
        const customPlans = JSON.parse(row.value);
        if (Array.isArray(customPlans) && customPlans.length > 0) {
          for (const plan of customPlans) {
            const planId = plan.id || plan.slug || 'custom';
            const slug = (plan.slug || plan.name || plan.id || '').toLowerCase().trim();
            const dmLimit = (plan.dmLimit !== undefined && plan.dmLimit !== null && plan.dmLimit !== '' && !isNaN(Number(plan.dmLimit))) 
              ? Number(plan.dmLimit) 
              : (plan.dm_limit !== undefined ? Number(plan.dm_limit) : null);
            const igLimit = (plan.igLimit !== undefined && plan.igLimit !== null && plan.igLimit !== '' && !isNaN(Number(plan.igLimit))) 
              ? Number(plan.igLimit) 
              : (plan.ig_limit !== undefined ? Number(plan.ig_limit) : null);
            const rulesLimit = (plan.rulesLimit !== undefined && plan.rulesLimit !== null && plan.rulesLimit !== '' && !isNaN(Number(plan.rulesLimit))) 
              ? Number(plan.rulesLimit) 
              : (plan.rules_limit !== undefined ? Number(plan.rules_limit) : null);

            // Canonical SSOT resolution: if slug matches an existing plan, update that plan's id
            const existingSlugMatch = await db.prepare("SELECT id FROM pricing_plans WHERE LOWER(TRIM(slug)) = ? OR LOWER(TRIM(id)) = ? LIMIT 1").get(slug, planId);
            const targetId = existingSlugMatch ? existingSlugMatch.id : planId;

            await db.prepare(`
              INSERT INTO pricing_plans (id, slug, name, dm_limit, ig_limit, rules_limit, monthly_price, annual_price, is_active, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
              ON CONFLICT (id) DO UPDATE SET
                slug = EXCLUDED.slug,
                name = EXCLUDED.name,
                dm_limit = EXCLUDED.dm_limit,
                ig_limit = EXCLUDED.ig_limit,
                rules_limit = EXCLUDED.rules_limit,
                updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
            `).run(
              targetId,
              slug,
              plan.name || slug,
              dmLimit !== null ? dmLimit : 1000,
              igLimit !== null ? igLimit : 1,
              rulesLimit !== null ? rulesLimit : 5,
              Number(plan.monthlyPrice) || 0,
              Number(plan.annualPrice) || 0
            );
          }
        }
      }
    } catch (_) {}

    // 2. Primary Source of Truth: Query pricing_plans PostgreSQL table
    try {
      const rows = await db.prepare("SELECT * FROM pricing_plans WHERE is_active = 1 ORDER BY sort_order ASC").all();
      if (Array.isArray(rows) && rows.length > 0) {
        for (const plan of rows) {
          const keys = [
            (plan.slug || '').toLowerCase().trim(),
            (plan.name || '').toLowerCase().trim(),
            (plan.id || '').toLowerCase().trim()
          ].filter(Boolean);
          const dmLimit = (plan.dm_limit !== undefined && plan.dm_limit !== null && plan.dm_limit !== '' && !isNaN(Number(plan.dm_limit))) ? Number(plan.dm_limit) : null;
          const igLimit = (plan.ig_limit !== undefined && plan.ig_limit !== null && plan.ig_limit !== '' && !isNaN(Number(plan.ig_limit))) ? Number(plan.ig_limit) : null;
          const rulesLimit = (plan.rules_limit !== undefined && plan.rules_limit !== null && plan.rules_limit !== '' && !isNaN(Number(plan.rules_limit))) ? Number(plan.rules_limit) : null;

          for (const key of keys) {
            if (key) {
              cache[key] = { dmLimit, igLimit, rulesLimit, monthlyPrice: plan.monthly_price, annualPrice: plan.annual_price };
            }
          }
        }
      }
    } catch (_) {}

    if (Object.keys(cache).length > 0) {
      _dynamicPlanCache = cache;
      _cacheLoadedAt = Date.now();
    }
  } catch (e) {
    // DB not ready yet or first startup — use static defaults silently
  }
}

/**
 * Force-refresh the dynamic plan limits cache immediately.
 * Call this whenever an admin modifies/creates/deletes/resets a pricing plan.
 */
async function refreshPlanLimitsCache() {
  _dynamicPlanCache = null; // Invalidate
  await loadDynamicPlanCache();
  console.log('[PlanLimits] ♻️ Dynamic plan limits cache refreshed from database.');
}

/**
 * Internal helper: get cached plan entry (refreshing if stale/absent).
 */
async function getCachedPlan(normalized) {
  if (!_dynamicPlanCache || Date.now() - _cacheLoadedAt > CACHE_TTL_MS) {
    await loadDynamicPlanCache();
  }
  if (_dynamicPlanCache) {
    return _dynamicPlanCache[normalized] || null;
  }
  return null;
}

/**
 * Synchronous helper for use inside queue/worker (cache MUST be pre-warmed).
 */
function getCachedPlanSync(normalized) {
  if (_dynamicPlanCache) {
    return _dynamicPlanCache[normalized] || null;
  }
  return null;
}

// ── Public Limit Functions ─────────────────────────────────────────────────────

/**
 * Returns the maximum monthly DM limit for a given plan.
 * Priority: 1) User custom override → 2) Admin-configured plan → 3) Static default.
 *
 * @param {string} [plan]
 * @param {number|null} [customLimit]
 * @returns {number}
 */
function dmLimitFor(plan, customLimit = null) {
  if (customLimit !== null && customLimit !== undefined && customLimit !== '') {
    const parsed = parseInt(customLimit, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  const normalized = (plan || 'free').toLowerCase().trim();

  // Try dynamic cache (synchronous — cache should be pre-warmed by server startup)
  const cached = getCachedPlanSync(normalized);
  if (cached && cached.dmLimit !== null && cached.dmLimit !== undefined && cached.dmLimit > 0) return cached.dmLimit;

  // Static fallback
  if (normalized in PLAN_LIMITS) {
    if (normalized === 'free' && process.env.FREE_PLAN_DM_LIMIT) {
      return parseInt(process.env.FREE_PLAN_DM_LIMIT, 10) || PLAN_LIMITS.free;
    }
    return PLAN_LIMITS[normalized];
  }
  return parseInt(process.env.FREE_PLAN_DM_LIMIT, 10) || PLAN_LIMITS.free;
}

/**
 * Returns the maximum allowed connected Instagram accounts for a plan.
 * Priority: 1) User custom override → 2) Admin-configured plan → 3) Static default.
 *
 * @param {string} [plan]
 * @param {number|null} [customLimit]
 * @returns {number}
 */
function igLimitFor(plan, customLimit = null) {
  if (customLimit !== null && customLimit !== undefined && customLimit !== '') {
    const parsed = parseInt(customLimit, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  const normalized = (plan || 'free').toLowerCase().trim();

  const cached = getCachedPlanSync(normalized);
  if (cached && cached.igLimit !== null && cached.igLimit !== undefined) return cached.igLimit;

  return PLAN_IG_LIMITS[normalized] || PLAN_IG_LIMITS.free;
}

/**
 * Returns the maximum allowed active automation rules for a plan.
 * Priority: 1) User custom override → 2) Admin-configured plan → 3) Static default.
 *
 * @param {string} [plan]
 * @param {number|null} [customLimit]
 * @returns {number}
 */
function rulesLimitFor(plan, customLimit = null) {
  if (customLimit !== null && customLimit !== undefined && customLimit !== '') {
    const parsed = parseInt(customLimit, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  const normalized = (plan || 'free').toLowerCase().trim();

  const cached = getCachedPlanSync(normalized);
  if (cached && cached.rulesLimit !== null && cached.rulesLimit !== undefined) return cached.rulesLimit;

  return PLAN_RULES_LIMITS[normalized] || PLAN_RULES_LIMITS.free;
}

/**
 * Returns the effective daily DM limit for a plan.
 * Default: Math.ceil(monthlyLimit / 30).
 * Overridden by customDailyLimit if specified.
 *
 * @param {string} [plan]
 * @param {number|null} [customDailyLimit]
 * @param {number|null} [customMonthlyLimit]
 * @returns {number}
 */
function dailyLimitFor(plan, customDailyLimit = null, customMonthlyLimit = null) {
  if (customDailyLimit !== null && customDailyLimit !== undefined && customDailyLimit !== '') {
    const parsed = parseInt(customDailyLimit, 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  const monthly = dmLimitFor(plan, customMonthlyLimit);
  return Math.ceil((monthly || 1000) / 30);
}

/**
 * Returns canonical subscription badge string for a plan.
 * Derived from authoritative effective subscription plan.
 *
 * @param {string} [plan]
 * @returns {string}
 */
function badgeFor(plan) {
  const norm = (plan || 'free').toLowerCase().trim();
  const cached = getCachedPlanSync(norm);
  if (cached && cached.badge) return cached.badge;
  const badges = {
    free: 'FREE',
    starter: 'STARTER',
    pro: 'PRO',
    agency: 'AGENCY',
    business: 'BUSINESS',
    scale: 'ENTERPRISE',
    enterprise: 'ENTERPRISE'
  };
  return badges[norm] || norm.toUpperCase();
}

// Warm cache on module load (non-blocking, fire and forget)
loadDynamicPlanCache().catch(() => {});

module.exports = {
  PLAN_LIMITS,
  PLAN_IG_LIMITS,
  PLAN_RULES_LIMITS,
  dmLimitFor,
  dailyLimitFor,
  badgeFor,
  igLimitFor,
  rulesLimitFor,
  refreshPlanLimitsCache,
  loadDynamicPlanCache,
  getCachedPlanSync
};
