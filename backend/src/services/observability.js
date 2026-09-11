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

/**
 * Full system health check inspecting Database, Queue, DLQ, and Memory
 */
async function getHealthStatus() {
    const startTime = Date.now();
    let dbStatus = 'healthy';
    let dbLatencyMs = 0;

    try {
        const t0 = Date.now();
        await db.prepare('SELECT 1 as ping').get();
        dbLatencyMs = Date.now() - t0;
    } catch (err) {
        dbStatus = 'unhealthy';
        recordError('DB_HEALTH_CHECK', err, { severity: 'critical' });
    }

    // Queue & DLQ status
    let dlqCount = 0;
    try {
        const dlqRow = await db.prepare('SELECT COUNT(*) as count FROM dead_letter_queue WHERE is_resolved = 0').get();
        dlqCount = parseInt(dlqRow?.count || 0, 10);
    } catch (e) {}

    const mem = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());
    const latencies = calculateLatencyPercentiles();

    const healthy = dbStatus === 'healthy';

    return {
        status: healthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime_seconds: uptimeSeconds,
        checks: {
            database: {
                status: dbStatus,
                latency_ms: dbLatencyMs
            },
            dlq: {
                pending_count: dlqCount,
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
    apiMetrics
};
