// backend/src/constants/planLimits.js

const PLAN_LIMITS = {
  free: 1000,
  pro: 25000,
  agency: 100000,
  enterprise: 500000
};

// Default Instagram account limits per plan tier
const PLAN_IG_LIMITS = {
  free: 1,
  pro: 3,
  agency: 10,
  enterprise: 25
};

// Default Active Rules limits per plan tier
const PLAN_RULES_LIMITS = {
  free: 5,
  pro: 25,
  agency: 100,
  enterprise: 500
};

/**
 * Returns the maximum monthly DM limit for a given plan or custom override.
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
  if (normalized in PLAN_LIMITS) {
    if (normalized === 'free' && process.env.FREE_PLAN_DM_LIMIT) {
      return parseInt(process.env.FREE_PLAN_DM_LIMIT, 10) || PLAN_LIMITS.free;
    }
    return PLAN_LIMITS[normalized];
  }
  return parseInt(process.env.FREE_PLAN_DM_LIMIT, 10) || PLAN_LIMITS.free;
}

/**
 * Returns the maximum allowed connected Instagram accounts for a user.
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
  return PLAN_IG_LIMITS[normalized] || PLAN_IG_LIMITS.free;
}

/**
 * Returns the maximum allowed active automation rules for a user.
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
  return PLAN_RULES_LIMITS[normalized] || PLAN_RULES_LIMITS.free;
}

module.exports = {
  PLAN_LIMITS,
  PLAN_IG_LIMITS,
  PLAN_RULES_LIMITS,
  dmLimitFor,
  igLimitFor,
  rulesLimitFor
};
