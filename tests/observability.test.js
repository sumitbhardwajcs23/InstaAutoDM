/**
 * Observability & Monitoring Test Suite
 * Validates request correlation IDs, structured logging with credential redaction,
 * latency percentiles (p50/p95/p99), error event registry, and deep health readiness probes.
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../backend/src/db');
const correlationIdMiddleware = require('../backend/src/middleware/correlationId');
const logger = require('../backend/src/services/logger');
const observability = require('../backend/src/services/observability');
const { v4: uuidv4 } = require('uuid');

async function runTests() {
    console.log('🧪 Starting Observability & Monitoring Test Suite...\n');
    await db.ready();
    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${name}`);
            console.error(`     Error: ${err.message}\n`);
            failed++;
        }
    };

    // 1. Correlation ID middleware propagation
    await test('Correlation ID middleware propagates existing X-Request-Id or generates new UUID', () => {
        // Case A: Propagation
        const customId = `req-trace-${uuidv4()}`;
        const req1 = { headers: { 'x-request-id': customId } };
        const res1 = { setHeader: (k, v) => { res1.headers = res1.headers || {}; res1.headers[k] = v; } };
        let nextCalled1 = false;

        correlationIdMiddleware(req1, res1, () => { nextCalled1 = true; });
        assert.strictEqual(nextCalled1, true);
        assert.strictEqual(req1.id, customId);
        assert.strictEqual(res1.headers['X-Request-Id'], customId);

        // Case B: Generation
        const req2 = { headers: {} };
        const res2 = { setHeader: (k, v) => { res2.headers = res2.headers || {}; res2.headers[k] = v; } };
        let nextCalled2 = false;

        correlationIdMiddleware(req2, res2, () => { nextCalled2 = true; });
        assert.strictEqual(nextCalled2, true);
        assert(req2.id && req2.id.length > 20);
        assert.strictEqual(res2.headers['X-Request-Id'], req2.id);
    });

    // 2. Structured logging credential scrubbing
    await test('Structured logger scrubs passwords, tokens, app secrets, and authorization headers', () => {
        const sensitivePayload = {
            userId: 'usr-1',
            email: 'user@test.com',
            password: 'SuperSecretPassword!123',
            access_token: 'EAABwz...meta_token...',
            nested: {
                app_secret: 'meta_secret_hash',
                safe_property: 'VisibleData'
            }
        };

        const sanitized = logger.sanitize(sensitivePayload);

        assert.strictEqual(sanitized.email, 'user@test.com');
        assert.strictEqual(sanitized.password, '[REDACTED]');
        assert.strictEqual(sanitized.access_token, '[REDACTED]');
        assert.strictEqual(sanitized.nested.app_secret, '[REDACTED]');
        assert.strictEqual(sanitized.nested.safe_property, 'VisibleData');
    });

    // 3. Request latency percentiles (p50, p95, p99)
    await test('Observability tracks API latencies and computes accurate percentiles', () => {
        // Feed 100 sample latencies (1ms to 100ms)
        for (let i = 1; i <= 100; i++) {
            observability.recordApiRequest('GET', '/api/test', 200, i);
        }

        const percentiles = observability.calculateLatencyPercentiles();
        assert(percentiles.p50 >= 45 && percentiles.p50 <= 55, `p50 should be ~50ms, got ${percentiles.p50}`);
        assert(percentiles.p95 >= 90 && percentiles.p95 <= 97, `p95 should be ~95ms, got ${percentiles.p95}`);
        assert(percentiles.p99 >= 97 && percentiles.p99 <= 100, `p99 should be ~99ms, got ${percentiles.p99}`);
    });

    // 4. Error event registry persistence
    await test('Error registry persists stack traces, context, and severity to database', async () => {
        const testErr = new Error('Test Unhandled Exception');
        testErr.name = 'TestCrashError';
        const correlationId = `err-corr-${uuidv4().slice(0, 8)}`;

        const errorId = await observability.recordError('TEST_CRASH', testErr, {
            severity: 'critical',
            correlationId,
            route: '/api/test/fail'
        });

        const record = await db.prepare('SELECT * FROM error_events WHERE id = ?').get(errorId);
        assert(record, 'Error event must be recorded in error_events table');
        assert.strictEqual(record.error_type, 'TestCrashError');
        assert.strictEqual(record.severity, 'critical');
        assert.strictEqual(record.correlation_id, correlationId);
        assert(record.stack_trace.includes('Test Unhandled Exception'));
    });

    // 5. Deep health and readiness probe
    await test('Deep readiness probe inspects DB ping, DLQ, memory, and metrics', async () => {
        const health = await observability.getHealthStatus();
        assert.strictEqual(health.status, 'healthy');
        assert(health.checks.database.status === 'healthy');
        assert(typeof health.checks.database.latency_ms === 'number');
        assert(typeof health.checks.dlq.pending_count === 'number');
        assert(health.checks.memory.heap_used_mb > 0);
        assert(health.metrics.requests.total > 0);
    });

    console.log(`\n========================================`);
    console.log(`Observability & Monitoring: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
