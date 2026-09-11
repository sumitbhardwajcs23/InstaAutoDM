// backend/src/constants/planLimits.js

const PLAN_LIMITS = {
  free: 1000,
  pro: 25000,
  agency: 100000,
  enterprise: 500000
};

/**
 * Returns the maximum monthly DM limit for a given plan.
 * Falls back to FREE_PLAN_DM_LIMIT environment variable if set, or 1000.
 * 
 * @param {string} [plan] 
 * @returns {number}
 */
function dmLimitFor(plan) {
  const normalized = (plan || 'free').toLowerCase().trim();
  if (normalized in PLAN_LIMITS) {
    if (normalized === 'free' && process.env.FREE_PLAN_DM_LIMIT) {
      return parseInt(process.env.FREE_PLAN_DM_LIMIT, 10) || PLAN_LIMITS.free;
    }
    return PLAN_LIMITS[normalized];
  }
  return parseInt(process.env.FREE_PLAN_DM_LIMIT, 10) || PLAN_LIMITS.free;
}

module.exports = {
  PLAN_LIMITS,
  dmLimitFor
};
