// backend/src/constants/queueConfig.js

const QUEUE_CONFIG = {
  // Random response delay range in seconds
  MIN_DELAY_SECONDS: parseInt(process.env.QUEUE_MIN_DELAY_SECONDS, 10) || 5,
  MAX_DELAY_SECONDS: parseInt(process.env.QUEUE_MAX_DELAY_SECONDS, 10) || 30,

  // Global worker pool concurrency
  CONCURRENCY: parseInt(process.env.QUEUE_CONCURRENCY, 10) || 5,

  // Per-account throttling limits
  ACCOUNT_RATE_LIMIT_PER_MINUTE: parseInt(process.env.ACCOUNT_RATE_LIMIT_PER_MINUTE, 10) || 30,
  ACCOUNT_MAX_CONCURRENT: parseInt(process.env.ACCOUNT_MAX_CONCURRENT, 10) || 2,

  // Retries and backoff
  MAX_JOB_ATTEMPTS: parseInt(process.env.MAX_JOB_ATTEMPTS, 10) || 5,
  BACKOFF_BASE_MS: parseInt(process.env.BACKOFF_BASE_MS, 10) || 2000,
  BACKOFF_MAX_MS: parseInt(process.env.BACKOFF_MAX_MS, 10) || 300000, // 5 minutes
};

/**
 * Calculates a random processing delay in milliseconds within the configured range.
 * In test mode or when QUEUE_DELAY_DISABLED=true, returns 0 to allow instant test execution.
 */
function calculateRandomDelayMs(
  minSec = QUEUE_CONFIG.MIN_DELAY_SECONDS, 
  maxSec = QUEUE_CONFIG.MAX_DELAY_SECONDS
) {
  if (process.env.NODE_ENV === 'test' || process.env.QUEUE_DELAY_DISABLED === 'true') {
    return 0;
  }
  const minMs = Math.max(0, minSec * 1000);
  const maxMs = Math.max(minMs, maxSec * 1000);
  return Math.floor(minMs + Math.random() * (maxMs - minMs + 1));
}

/**
 * Calculates exponential backoff with jitter to avoid thundering herd.
 * If explicitDelayMs is provided (e.g. from Retry-After header), applies jitter to it.
 * Otherwise uses baseMs * 2^(attempts - 1) + jitter.
 */
function calculateBackoffWithJitter(
  attempts = 1, 
  explicitDelayMs = null,
  baseMs = QUEUE_CONFIG.BACKOFF_BASE_MS, 
  maxMs = QUEUE_CONFIG.BACKOFF_MAX_MS
) {
  if (typeof explicitDelayMs === 'number' && explicitDelayMs > 0) {
    // Add small jitter to explicit platform delay (0-2000ms)
    return Math.floor(explicitDelayMs + Math.random() * 2000);
  }
  const expDelay = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempts - 1)));
  const jitter = Math.floor(Math.random() * 1000);
  return expDelay + jitter;
}

/**
 * Extracts platform-indicated retry delay from Meta error responses or headers.
 */
function extractRetryAfterMs(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    const parsed = parseInt(input, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed * 1000;
    }
  }
  if (typeof input === 'number' && input > 0) {
    return input > 10000 ? input : input * 1000;
  }
  if (typeof input === 'object') {
    if (typeof input.retryAfter === 'number' && input.retryAfter > 0) {
      return input.retryAfter > 10000 ? input.retryAfter : input.retryAfter * 1000;
    }
    if (typeof input.retryAfter === 'string') {
      const parsed = parseInt(input.retryAfter, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed * 1000;
    }
    const metaErr = input.metaError || input.response?.data?.error;
    if (metaErr) {
      if (metaErr.error_subcode === 2207001 || metaErr.code === 32 || metaErr.code === 613) {
        return 60000;
      }
    }
  }
  return null;
}

module.exports = {
  QUEUE_CONFIG,
  calculateRandomDelayMs,
  calculateBackoffWithJitter,
  extractRetryAfterMs,
};
