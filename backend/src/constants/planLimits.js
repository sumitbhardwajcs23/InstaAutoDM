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
    // Lazy-require db to avoid circular dependencies at module load time
    const db = require('../db');
    const row = await db.prepare("SELECT value FROM site_settings WHERE key = 'custom_pricing_plans'").get();
    if (row && row.value) {
      const plans = JSON.parse(row.value);
      if (Array.isArray(plans) && plans.length > 0) {
        const cache = {};
        for (const plan of plans) {
          const keys = [
            (plan.slug || '').toLowerCase().trim(),
            (plan.name || '').toLowerCase().trim(),
            (plan.id || '').toLowerCase().trim()
          ].filter(Boolean);
          const dmLimit = (plan.dmLimit !== undefined && plan.dmLimit !== null && plan.dmLimit !== '' && !isNaN(Number(plan.dmLimit))) ? Number(plan.dmLimit) : null;
          const igLimit = (plan.igLimit !== undefined && plan.igLimit !== null && plan.igLimit !== '' && !isNaN(Number(plan.igLimit))) ? Number(plan.igLimit) : null;
          const rulesLimit = (plan.rulesLimit !== undefined && plan.rulesLimit !== null && plan.rulesLimit !== '' && !isNaN(Number(plan.rulesLimit))) ? Number(plan.rulesLimit) : null;

          for (const key of keys) {
            if (key) {
              cache[key] = { dmLimit, igLimit, rulesLimit };
            }
          }
        }
        _dynamicPlanCache = cache;
        _cacheLoadedAt = Date.now();
      }
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
  if (cached && cached.dmLimit !== null && cached.dmLimit !== undefined) return cached.dmLimit;

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

// Warm cache on module load (non-blocking, fire and forget)
loadDynamicPlanCache().catch(() => {});

module.exports = {
  PLAN_LIMITS,
  PLAN_IG_LIMITS,
  PLAN_RULES_LIMITS,
  dmLimitFor,
  igLimitFor,
  rulesLimitFor,
  refreshPlanLimitsCache,
  loadDynamicPlanCache,
  getCachedPlanSync
};
