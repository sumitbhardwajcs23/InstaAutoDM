// backend/src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const { MemoryStore } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('../services/redisClient');

const isTest = process.env.NODE_ENV === 'test';

/**
 * Returns cluster size from configured deployment topology.
 * Defaults to 4 instances if not explicitly set.
 */
function getClusterSize() {
  const envVal = process.env.CLUSTER_SIZE || process.env.INSTANCE_COUNT || process.env.WEB_CONCURRENCY;
  const parsed = parseInt(envVal, 10);
  return (Number.isFinite(parsed) && parsed > 0) ? parsed : 4;
}

/**
 * Dynamic limit calculation:
 * - If Redis is active, all instances share the centralized global quota.
 * - If Redis is down/disconnected, instances fallback to in-memory tracking
 *   with limits partitioned by deployment topology (limit / clusterSize)
 *   preventing horizontal quota amplification.
 */
function calculateLimit(configuredMax) {
  if (redisClient.isAvailable()) {
    return configuredMax;
  }
  const clusterSize = getClusterSize();
  return Math.max(1, Math.floor(configuredMax / clusterSize));
}

/**
 * Resilient rate-limit store that seamlessly switches between centralized Redis
 * and local MemoryStore fallback.
 */
class ResilientStore {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rl:';
    this.memoryStore = new MemoryStore();
    this.redisStore = null;
    this.options = null;
  }

  getRedisStore() {
    if (!redisClient.isAvailable()) {
      return null;
    }
    if (!this.redisStore) {
      try {
        this.redisStore = new RedisStore({
          sendCommand: async (...args) => {
            if (!redisClient.isAvailable()) {
              throw new Error('Redis unavailable');
            }
            // Uses redisClient.sendCommand which delegates to raw ioredis .call()
            // and is mockable in tests without accessing internals.
            return await redisClient.sendCommand(...args);
          },
          prefix: this.prefix
        });
        if (this.options && typeof this.redisStore.init === 'function') {
          Promise.resolve(this.redisStore.init(this.options)).catch(() => {});
        }
      } catch {
        this.redisStore = null;
      }
    }
    return this.redisStore;
  }

  init(options) {
    this.options = options;
    this.memoryStore.init(options);
    const rs = this.getRedisStore();
    if (rs && typeof rs.init === 'function') {
      Promise.resolve(rs.init(options)).catch(() => {});
    }
  }

  async increment(key) {
    const rs = this.getRedisStore();
    if (rs) {
      try {
        return await rs.increment(key);
      } catch {
        // Transparent fallback to memory store
        return await this.memoryStore.increment(key);
      }
    }
    return await this.memoryStore.increment(key);
  }

  async decrement(key) {
    const rs = this.getRedisStore();
    if (rs) {
      try {
        return await rs.decrement(key);
      } catch {
        return await this.memoryStore.decrement(key);
      }
    }
    return await this.memoryStore.decrement(key);
  }

  async resetKey(key) {
    const rs = this.getRedisStore();
    if (rs) {
      try {
        await rs.resetKey(key);
      } catch {}
    }
    return await this.memoryStore.resetKey(key);
  }

  async get(key) {
    const rs = this.getRedisStore();
    if (rs) {
      try {
        return await rs.get(key);
      } catch {
        return await this.memoryStore.get(key);
      }
    }
    return await this.memoryStore.get(key);
  }
}

// Auth routes: brute force & credential stuffing protection (15 requests per 15 minutes per IP)
const authBaseLimit = process.env.RATE_LIMIT_AUTH_MAX ? parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) : 15;
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: () => (isTest ? 1000 : calculateLimit(authBaseLimit)),
  store: new ResilientStore({ prefix: 'rl:auth:' }),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
  }
});

// Webhook ingestion: volumetric flood protection (120 requests per minute per IP)
const webhookBaseLimit = process.env.RATE_LIMIT_WEBHOOK_MAX ? parseInt(process.env.RATE_LIMIT_WEBHOOK_MAX, 10) : 120;
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => (isTest ? 10000 : calculateLimit(webhookBaseLimit)),
  store: new ResilientStore({ prefix: 'rl:webhook:' }),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many webhook events received. Please throttle requests.'
  }
});

// General protected API endpoints (1,500 requests per 15 minutes per user/IP)
const apiBaseLimit = process.env.RATE_LIMIT_API_MAX ? parseInt(process.env.RATE_LIMIT_API_MAX, 10) : 1500;
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: () => (isTest ? 10000 : calculateLimit(apiBaseLimit)),
  keyGenerator: (req) => req.user?.id || req.ip,
  store: new ResilientStore({ prefix: 'rl:api:' }),
  validate: false,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'API rate limit exceeded. Please try again later.'
  }
});

module.exports = {
  authLimiter,
  webhookLimiter,
  apiLimiter,
  getClusterSize,
  calculateLimit,
  ResilientStore
};
