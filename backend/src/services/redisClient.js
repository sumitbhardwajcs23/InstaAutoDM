// backend/src/services/redisClient.js
/**
 * Resilient Redis Client Service for Airvix
 * 
 * Used strictly for:
 * 1. Ephemeral non-authoritative caching (e.g. dashboard statistics)
 * 2. Centralized distributed rate-limiting sliding windows (rate-limit-redis)
 * 
 * NEVER used as the source of truth for billing, subscriptions, roles, usage, or entitlements.
 */

const Redis = require('ioredis');

let client = null;
let isConnected = false;
let connectionAttempts = 0;

const metrics = {
  hits: 0,
  misses: 0,
  sets: 0,
  errors: 0
};

const REDIS_URL = process.env.REDIS_URL;
const isRenderHost = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
const isLocalhostRedis = REDIS_URL && (REDIS_URL.includes('127.0.0.1') || REDIS_URL.includes('localhost'));
let localhostIgnoredOnCloud = false;

if (REDIS_URL && isRenderHost && isLocalhostRedis) {
  localhostIgnoredOnCloud = true;
  console.warn('[Redis] ⚠️ CONFIGURATION NOTICE: REDIS_URL in Render is pointing to localhost/127.0.0.1.');
  console.warn('[Redis] ℹ️ Render web services cannot reach workstation localhost.');
  console.warn('[Redis] ℹ️ To connect Redis on Render: Create a Redis instance in Render Dashboard and set REDIS_URL to its Internal Redis URL, or remove REDIS_URL from Environment Variables.');
  console.log('[Redis] ℹ️ Running on resilient in-memory cache fallback.');
} else if (REDIS_URL) {
  try {
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      enableReadyCheck: true,
      retryStrategy(times) {
        connectionAttempts = times;
        if (times > 10) {
          if (times === 11) {
            console.warn('[Redis] ⚠️ Max connection attempts reached, cooling down (retrying periodically)...');
          }
          return 30000;
        }
        return Math.min(times * 200, 2000);
      }
    });

    client.on('connect', () => {
      isConnected = true;
      console.log('[Redis] ✅ Connected to Redis server successfully.');
    });

    client.on('ready', () => {
      isConnected = true;
    });

    client.on('error', (err) => {
      isConnected = false;
      metrics.errors++;
      // Non-fatal: Log warning but do not crash process
      if (metrics.errors <= 3 || metrics.errors % 50 === 0) {
        console.warn(`[Redis] ⚠️ Connection warning: ${err.message}`);
      }
    });

    client.on('close', () => {
      isConnected = false;
    });
  } catch (err) {
    console.warn(`[Redis] ⚠️ Initialization error: ${err.message}`);
    client = null;
  }
} else {
  // In-memory fallback map when no REDIS_URL is configured
  console.log('[Redis] ℹ️ No REDIS_URL configured; running in-memory cache fallback.');
}

// In-memory fallback cache with TTL eviction
const fallbackCache = new Map();

function cleanExpiredFallback() {
  const now = Date.now();
  for (const [k, v] of fallbackCache.entries()) {
    if (v.expiresAt && v.expiresAt < now) {
      fallbackCache.delete(k);
    }
  }
}
setInterval(cleanExpiredFallback, 30000).unref();

async function get(key) {
  if (client && isConnected) {
    try {
      const raw = await client.get(key);
      if (raw !== null) {
        metrics.hits++;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
      metrics.misses++;
      return null;
    } catch (err) {
      metrics.errors++;
      metrics.misses++;
    }
  }

  // Fallback
  const entry = fallbackCache.get(key);
  if (entry) {
    if (!entry.expiresAt || entry.expiresAt > Date.now()) {
      metrics.hits++;
      return entry.val;
    }
    fallbackCache.delete(key);
  }
  metrics.misses++;
  return null;
}

async function set(key, val, ttlSeconds = 60) {
  const serialized = typeof val === 'string' ? val : JSON.stringify(val);
  metrics.sets++;

  if (client && isConnected) {
    try {
      if (ttlSeconds > 0) {
        await client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await client.set(key, serialized);
      }
      return true;
    } catch (err) {
      metrics.errors++;
    }
  }

  // Fallback
  fallbackCache.set(key, {
    val,
    expiresAt: ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null
  });
  return true;
}

async function del(key) {
  if (client && isConnected) {
    try {
      await client.del(key);
    } catch (err) {
      metrics.errors++;
    }
  }
  fallbackCache.delete(key);
  return true;
}

async function delPattern(pattern) {
  if (client && isConnected) {
    try {
      const keys = await client.keys(pattern);
      if (keys && keys.length > 0) {
        await client.del(...keys);
      }
    } catch (err) {
      metrics.errors++;
    }
  }
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  for (const k of fallbackCache.keys()) {
    if (regex.test(k)) {
      fallbackCache.delete(k);
    }
  }
  return true;
}

function isAvailable() {
  return Boolean(client && isConnected);
}

function getRawClient() {
  return client;
}

function isLocalhostIgnored() {
  return localhostIgnoredOnCloud;
}

function getMetrics() {
  return {
    ...metrics,
    isConnected,
    isRedisConfigured: Boolean(REDIS_URL) && !localhostIgnoredOnCloud,
    localhostIgnoredOnCloud,
    fallbackEntries: fallbackCache.size
  };
}

async function close() {
  if (client) {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}

/**
 * sendCommand: delegates to the raw ioredis .call() method.
 * Used by ResilientStore for rate-limit-redis compatibility.
 * Exposed as a named function so tests can mock it directly.
 */
async function sendCommand(...args) {
  if (!client) throw new Error('Redis client not initialized');
  return client.call(...args);
}

module.exports = {
  get,
  set,
  del,
  delPattern,
  isAvailable,
  isLocalhostIgnored,
  getRawClient,
  sendCommand,
  getMetrics,
  close
};
