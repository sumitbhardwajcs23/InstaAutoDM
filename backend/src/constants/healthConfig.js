// backend/src/constants/healthConfig.js

/**
 * AIRVIX INSTAGRAM ACCOUNT HEALTH & AUTOMATION RISK CONFIGURATION (Model v1.0)
 * 
 * DESIGN RATIONALE:
 * 1. Health is ACCOUNT-SCOPED (instagram_accounts.id). Quota is SUBSCRIPTION-SCOPED (subscriptions.id).
 * 2. Airvix calculates an internal operational risk score (0–100) based strictly on signals Airvix
 *    can legitimately observe through its application traffic and Meta Graph API responses.
 * 3. Airvix DOES NOT claim to know undocumented Meta/Instagram internal thresholds or guarantee
 *    account immunity from platform actions.
 * 4. Pacing delays (NORMAL, CAUTION, PROTECTION) are internal traffic-control buffers to mitigate
 *    burst concurrency and avoid upstream rate-limit errors — NOT claimed "Instagram-safe" speeds.
 */

const HEALTH_CONFIG = {
  MODEL_VERSION: '1.0',

  // ── Explicit Health Status & Automation Mode Thresholds ────────────────────
  THRESHOLDS: {
    HEALTHY: 90,       // 90–100: Normal operation
    CAUTION: 70,       // 70–89:  Caution mode (moderate traffic pacing)
    ELEVATED_RISK: 40, // 40–69:  Protection mode (conservative traffic pacing)
    CRITICAL: 0        // 0–39:   Paused mode (automation halted for this account)
  },

  // ── Explicit Deterministic Mapping ─────────────────────────────────────────
  // health_status  -> automation_mode  -> observed_risk_level
  // HEALTHY        -> NORMAL           -> low
  // CAUTION        -> CAUTION          -> moderate
  // ELEVATED_RISK  -> PROTECTION       -> elevated
  // CRITICAL       -> PAUSED           -> critical
  STATUS_TO_MODE_MAP: {
    HEALTHY: { mode: 'NORMAL', riskLevel: 'low' },
    CAUTION: { mode: 'CAUTION', riskLevel: 'moderate' },
    ELEVATED_RISK: { mode: 'PROTECTION', riskLevel: 'elevated' },
    CRITICAL: { mode: 'PAUSED', riskLevel: 'critical' },
  },

  // ── Internal Airvix Traffic Pacing Delays (Configurable Defaults) ───────────
  // NOTE: These are internal application-level backpressure buffers to prevent queue bursts.
  // They are NOT platform-guaranteed limits.
  PACING_DELAYS: {
    NORMAL_PADDING_MS: parseInt(process.env.HEALTH_PACING_NORMAL_PADDING_MS, 10) || 0,
    CAUTION_PADDING_MS: parseInt(process.env.HEALTH_PACING_CAUTION_PADDING_MS, 10) || 4000,
    PROTECTION_PADDING_MS: parseInt(process.env.HEALTH_PACING_PROTECTION_PADDING_MS, 10) || 12000,
    PAUSED_CHECK_INTERVAL_MS: parseInt(process.env.HEALTH_PAUSED_CHECK_INTERVAL_MS, 10) || 60000,
  },

  // ── Explainable Scoring Weights (Configuration-Driven) ─────────────────────
  WEIGHTS: {
    BASE_SCORE: 100,

    // Progressive 429 Rate Limit Penalties
    RATE_LIMIT_FIRST_429: parseInt(process.env.HEALTH_PENALTY_FIRST_429, 10) || 15,       // Drops to ~85 (CAUTION), not knee-jerk pause
    RATE_LIMIT_REPEAT_429: parseInt(process.env.HEALTH_PENALTY_REPEAT_429, 10) || 25,     // 2nd drops to ~60 (PROTECTION)
    RATE_LIMIT_PERSISTENT_429: parseInt(process.env.HEALTH_PENALTY_PERSISTENT, 10) || 30, // 3rd+ in window drops to <40 (PAUSED)

    // Authentication / Token Revocation
    AUTH_REVOCATION_PENALTY: parseInt(process.env.HEALTH_PENALTY_AUTH, 10) || 35,

    // Consecutive Delivery Failures
    CONSECUTIVE_FAILURES_3: parseInt(process.env.HEALTH_PENALTY_CONSEC_3, 10) || 10,
    CONSECUTIVE_FAILURES_5: parseInt(process.env.HEALTH_PENALTY_CONSEC_5, 10) || 20,
    CONSECUTIVE_FAILURES_10: parseInt(process.env.HEALTH_PENALTY_CONSEC_10, 10) || 35,

    // 15-Minute Rolling Error Rate Penalties
    ERROR_RATE_15M_TIER1: parseInt(process.env.HEALTH_PENALTY_ERR_15M_1, 10) || 12, // > 15% error rate
    ERROR_RATE_15M_TIER2: parseInt(process.env.HEALTH_PENALTY_ERR_15M_2, 10) || 22, // > 30% error rate
    ERROR_RATE_15M_TIER3: parseInt(process.env.HEALTH_PENALTY_ERR_15M_3, 10) || 35, // > 50% error rate

    // Short-term burst penalty (unusual spike > 3x normal 5-minute activity)
    BURST_SPIKE_PENALTY: parseInt(process.env.HEALTH_PENALTY_BURST, 10) || 10,
  },

  // ── Time Decay & Sustained Normalization Factors ───────────────────────────
  DECAY_AND_RECOVERY: {
    RATE_LIMIT_HALF_LIFE_HOURS: parseFloat(process.env.HEALTH_429_HALF_LIFE_HRS || '4.0'),
    GENERAL_ERROR_HALF_LIFE_HOURS: parseFloat(process.env.HEALTH_ERR_HALF_LIFE_HRS || '2.0'),
    
    // Sustained normalization: observation windows required before step recovery
    QUIET_PERIOD_MINUTES: parseInt(process.env.HEALTH_QUIET_PERIOD_MINS, 10) || 20,
    RECOVERY_STEP_POINTS: parseInt(process.env.HEALTH_RECOVERY_STEP_POINTS, 10) || 10,
    MAX_RECOVERY_POINTS_PER_EVAL: parseInt(process.env.HEALTH_MAX_RECOVERY_POINTS, 10) || 15,
  },

  // ── Rolling Windows for Signal Aggregation ─────────────────────────────────
  WINDOWS: {
    BURST_WINDOW_MINUTES: 5,
    IMMEDIATE_WINDOW_MINUTES: 15,
    INTERMEDIATE_WINDOW_HOURS: 1,
    BASELINE_WINDOW_HOURS: 24,
  },

  // ── Controlled Stepwise Recovery Sequence ──────────────────────────────────
  RECOVERY_LADDER: ['PAUSED', 'PROTECTION', 'CAUTION', 'NORMAL'],
};

/**
 * Resolves health_status, automation_mode, and observed_risk_level from a numeric score.
 */
function resolveHealthStateFromScore(score) {
  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  let status = 'CRITICAL';
  if (boundedScore >= HEALTH_CONFIG.THRESHOLDS.HEALTHY) {
    status = 'HEALTHY';
  } else if (boundedScore >= HEALTH_CONFIG.THRESHOLDS.CAUTION) {
    status = 'CAUTION';
  } else if (boundedScore >= HEALTH_CONFIG.THRESHOLDS.ELEVATED_RISK) {
    status = 'ELEVATED_RISK';
  }

  const { mode, riskLevel } = HEALTH_CONFIG.STATUS_TO_MODE_MAP[status];
  return {
    score: boundedScore,
    status,
    mode,
    riskLevel,
  };
}

module.exports = {
  HEALTH_CONFIG,
  resolveHealthStateFromScore,
};
