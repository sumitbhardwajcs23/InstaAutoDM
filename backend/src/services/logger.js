/**
 * Structured Logging Service
 * Outputs structured JSON logs with automatic credential and sensitive data scrubbing.
 */

const SENSITIVE_KEYS = new Set([
    'password',
    'password_hash',
    'token',
    'access_token',
    'refresh_token',
    'secret',
    'app_secret',
    'client_secret',
    'authorization',
    'cookie',
    'mfa_secret',
    'mfa_secret_enc',
    'mfa_backup_codes_enc',
    'encryption_key',
    'master_key',
    'stripe_secret',
    'razorpay_secret'
]);

function sanitizeData(data, depth = 0) {
    if (depth > 5) return '[Truncated]';
    if (!data || typeof data !== 'object') return data;

    if (Array.isArray(data)) {
        return data.map(item => sanitizeData(item, depth + 1));
    }

    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password')) {
            cleaned[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            cleaned[key] = sanitizeData(value, depth + 1);
        } else {
            cleaned[key] = value;
        }
    }
    return cleaned;
}

function formatLog(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const correlationId = meta.correlationId || meta.reqId || null;
    const sanitizedMeta = sanitizeData(meta);

    const logObject = {
        timestamp,
        level: level.toUpperCase(),
        message,
        ...(correlationId ? { correlation_id: correlationId } : {}),
        ...sanitizedMeta
    };

    return JSON.stringify(logObject);
}

const logger = {
    info(message, meta = {}) {
        console.log(formatLog('info', message, meta));
    },
    warn(message, meta = {}) {
        console.warn(formatLog('warn', message, meta));
    },
    error(message, meta = {}) {
        console.error(formatLog('error', message, meta));
    },
    debug(message, meta = {}) {
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
            console.log(formatLog('debug', message, meta));
        }
    },
    sanitize: sanitizeData
};

module.exports = logger;
