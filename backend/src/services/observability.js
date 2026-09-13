/**
 * Observability & Telemetry Service
 * Tracks API latencies (p50/p95/p99), error rates, queue & DB health metrics,
 * and handles automated system alerts with persistent audit trails.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const logger = require('./logger');

// In-memory sliding window for request latencies (capped at 1000 samples)
const MAX_LATENCY_SAMPLES = 1000;
const latencySamples = [];

// API counter metrics
const apiMetrics = {
    totalRequests: 0,
    status2xx: 0,
    status4xx: 0,
    status5xx: 0,
    routes: {},
    startedAt: Date.now()
};

/**
 * Record an incoming API request outcome and duration
 */
function recordApiRequest(method, route, statusCode, durationMs) {
    apiMetrics.totalRequests++;

    if (statusCode >= 200 && statusCode < 300) apiMetrics.status2xx++;
    else if (statusCode >= 400 && statusCode < 500) apiMetrics.status4xx++;
    else if (statusCode >= 500) {
        apiMetrics.status5xx++;
        checkErrorRateAlert();
    }

    const routeKey = `${method} ${route}`;
    apiMetrics.routes[routeKey] = (apiMetrics.routes[routeKey] || 0) + 1;

    // Record latency in sliding window
    latencySamples.push(durationMs);
    if (latencySamples.length > MAX_LATENCY_SAMPLES) {
        latencySamples.shift();
    }
}

/**
 * Calculate percentiles (p50, p95, p99) from sample window
 */
function calculateLatencyPercentiles() {
    if (latencySamples.length === 0) {
        return { p50: 0, p95: 0, p99: 0, sampleCount: 0 };
    }

    const sorted = [...latencySamples].sort((a, b) => a - b);
    const getPercentile = (p) => {
        const index = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
        return Math.round(sorted[index] * 10) / 10;
    };

    return {
        p50: getPercentile(50),
        p95: getPercentile(95),
        p99: getPercentile(99),
        avg: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
        sampleCount: sorted.length
    };
}

/**
 * Record an unhandled or critical application error to database and logger
 */
async function recordError(context, err, meta = {}) {
    const errorId = uuidv4();
    const message = err?.message || String(err);
    const stack = err?.stack || null;
    const severity = meta.severity || 'error';
    const correlationId = meta.correlationId || meta.reqId || null;

    logger.error(`[${context}] ${message}`, { ...meta, errorId, stack });

    try {
        await db.prepare(`
            INSERT INTO error_events (id, error_type, message, stack_trace, severity, context_data, correlation_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
            errorId,
            err?.name || context,
            message,
            stack ? stack.slice(0, 4000) : null,
            severity,
            JSON.stringify(meta),
            correlationId
        );
    } catch (dbErr) {
        console.warn('[Observability] Could not persist error to DB:', dbErr.message);
    }

    return errorId;
}

/**
 * Trigger and persist a high-priority system alert
 */
async function triggerAlert(alertType, severity, message, metadata = {}) {
    const alertId = uuidv4();
    logger.warn(`🚨 [SYSTEM ALERT] ${alertType}: ${message}`, { severity, metadata });

    try {
        await db.prepare(`
            INSERT INTO system_alerts (id, alert_type, severity, message, metadata, is_resolved, created_at)
            VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
        `).run(
            alertId,
            alertType,
            severity,
            message,
            JSON.stringify(metadata)
        );
    } catch (err) {
        console.warn('[Observability] Could not persist alert to DB:', err.message);
    }

    return alertId;
}

/**
 * Trigger alert if 5xx rate exceeds 10% on > 20 requests
 */
function checkErrorRateAlert() {
    if (apiMetrics.totalRequests > 20) {
        const errorRate = (apiMetrics.status5xx / apiMetrics.totalRequests) * 100;
        if (errorRate >= 10) {
            triggerAlert(
                'HIGH_ERROR_RATE',
                'critical',
                `API 5xx error rate at ${errorRate.toFixed(1)}% (${apiMetrics.status5xx}/${apiMetrics.totalRequests} requests)`,
                { totalRequests: apiMetrics.totalRequests, errors: apiMetrics.status5xx }
            );
        }
    }
}

// Cache for diagnostic DLQ counter to prevent query stampedes under high-volume load probes
let cachedDlq = { count: 0, fetchedAt: 0 };
const DLQ_CACHE_TTL_MS = 5000;
let dlqInFlight = null;

// Short-lived DB ping cache (2s TTL) to prevent pool saturation under burst
// health-check traffic (e.g. 1000 VUs hitting /health/ready simultaneously).
// The result is still live from a load-balancer perspective; 2s staleness is
// acceptable for a readiness probe — a real DB outage will be detected within 2s.
let cachedDbPing = { status: null, latencyMs: 0, fetchedAt: 0 };
const DB_PING_CACHE_TTL_MS = 2000;

// In-flight coalescing: ensures only ONE DB ping is in flight at a time
let dbPingInFlight = null;

/**
 * Liveness probe: shallow check verifying event loop responsiveness
 */
function getLivenessStatus() {
    return {
        status: 'ok',
        uptime_seconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    };
}

/**
 * Full system health & readiness check:
 * Dependency-aware: live DB ping is ALWAYS executed live and never cached.
 * Stale cached auxiliary data will NEVER mask an unavailable critical dependency.
 */
async function getHealthStatus() {
    let dbStatus = 'healthy';
    let dbLatencyMs = 0;

    // 1. CRITICAL DEPENDENCY: DB PING
    // Cached for DB_PING_CACHE_TTL_MS (2s) to prevent pool exhaustion under burst
    // health-check traffic. A real outage is still detected within 2s.
    // If a ping is already in-flight, await the same promise (coalescing).
    const now = Date.now();
    if (now - cachedDbPing.fetchedAt > DB_PING_CACHE_TTL_MS) {
        if (!dbPingInFlight) {
            dbPingInFlight = (async () => {
                let status = 'healthy';
                let latency = 0;
                try {
                    const t0 = Date.now();
                    // Hard 1.5s timeout: if the pool is exhausted, return 'degraded'
                    // immediately rather than blocking for up to 8s (connectionTimeoutMillis).
                    // 'degraded' → HTTP 503 (not ERR), which is a valid health response.
                    await Promise.race([
                        db.prepare('SELECT 1 as ping').get(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('DB ping timeout (1500ms)')), 1500)
                        )
                    ]);
                    latency = Date.now() - t0;
                } catch (err) {
                    if (err.message && err.message.includes('DB ping timeout')) {
                        status = 'degraded'; // pool busy; not an outage, give 503 not hang
                    } else {
                        status = 'unhealthy'; // genuine DB error
                        recordError('DB_HEALTH_CHECK', err, { severity: 'critical' });
                    }
                    latency = Date.now() - now;
                }
                cachedDbPing = { status, latencyMs: latency, fetchedAt: Date.now() };
                dbPingInFlight = null;
                return cachedDbPing;
            })();
        }
        await dbPingInFlight;
    }
    dbStatus = cachedDbPing.status || 'healthy';
    dbLatencyMs = cachedDbPing.latencyMs || 0;

    // 2. DIAGNOSTIC / AUXILIARY: DLQ Counter (Cached with 5s TTL + in-flight coalescing to protect DB under burst traffic)
    const dlqNow = Date.now();
    let dlqCount = cachedDlq.count;
    if (dbStatus === 'healthy' && (dlqNow - cachedDlq.fetchedAt > DLQ_CACHE_TTL_MS)) {
        if (!dlqInFlight) {
            dlqInFlight = (async () => {
                try {
                    const dlqRow = await db.prepare('SELECT COUNT(*) as count FROM dead_letter_queue WHERE is_resolved = 0').get();
                    const count = parseInt(dlqRow?.count || 0, 10);
                    cachedDlq = { count, fetchedAt: Date.now() };
                } catch (_) {
                    // Retain previous count on transient diagnostic query failure
                } finally {
                    dlqInFlight = null;
                }
                return cachedDlq.count;
            })();
        }
        try {
            dlqCount = await dlqInFlight;
        } catch (_) {
            dlqCount = cachedDlq.count;
        }
    }

    // 3. AUXILIARY DEPENDENCY: Redis connectivity
    let redisStatus = 'disabled';
    try {
        const redisClient = require('./redisClient');
        if (redisClient.isAvailable()) {
            redisStatus = 'connected';
        } else if (redisClient.isLocalhostIgnored && redisClient.isLocalhostIgnored()) {
            redisStatus = 'fallback_localhost_ignored';
        } else if (process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL) {
            redisStatus = 'disconnected';
        }
    } catch {
        redisStatus = 'unavailable';
    }

    // 4. DATABASE POOL METRICS
    let poolMetrics = null;
    try {
        poolMetrics = db.getPoolMetrics ? db.getPoolMetrics() : null;
    } catch {}

    const mem = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());
    const latencies = calculateLatencyPercentiles();

    // READINESS RULE: healthy → 200; degraded (pool busy, transient) → 503 but
    // distinguishable from unhealthy (genuine DB outage) → 503 with full error detail
    const isHealthy = dbStatus === 'healthy';
    const isDegraded = dbStatus === 'degraded';

    return {
        status: isHealthy ? 'healthy' : (isDegraded ? 'degraded' : 'unhealthy'),
        readiness: isHealthy, // false for both degraded and unhealthy → HTTP 503
        timestamp: new Date().toISOString(),
        uptime_seconds: uptimeSeconds,
        checks: {
            database: {
                status: dbStatus,
                latency_ms: dbLatencyMs,
                pool: poolMetrics,
                query_count: (db.getQueryCount ? db.getQueryCount() : 0)
            },
            redis: {
                status: redisStatus,
                metrics: (() => {
                    try { return require('./redisClient').getMetrics(); } catch { return null; }
                })()
            },
            dlq: {
                pending_count: dlqCount,
                cached: (dlqNow - cachedDlq.fetchedAt <= DLQ_CACHE_TTL_MS),
                status: dlqCount > 50 ? 'warning' : 'healthy'
            },
            memory: {
                rss_mb: Math.round(mem.rss / (1024 * 1024)),
                heap_used_mb: Math.round(mem.heapUsed / (1024 * 1024)),
                heap_total_mb: Math.round(mem.heapTotal / (1024 * 1024))
            }
        },
        metrics: {
            requests: {
                total: apiMetrics.totalRequests,
                status_2xx: apiMetrics.status2xx,
                status_4xx: apiMetrics.status4xx,
                status_5xx: apiMetrics.status5xx
            },
            latency_percentiles_ms: latencies
        }
    };
}

module.exports = {
    recordApiRequest,
    calculateLatencyPercentiles,
    recordError,
    triggerAlert,
    getHealthStatus,
    getLivenessStatus,
    apiMetrics
};
