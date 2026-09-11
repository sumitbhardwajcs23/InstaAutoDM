/**
 * Request & Correlation ID Middleware
 * Generates or propagates X-Request-Id across incoming requests,
 * attaches it to response headers and request context for end-to-end tracing.
 */

const { v4: uuidv4 } = require('uuid');

function correlationIdMiddleware(req, res, next) {
    const headerId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
    const requestId = (headerId && typeof headerId === 'string' && headerId.length <= 128)
        ? headerId.trim()
        : uuidv4();

    req.id = requestId;
    req.correlationId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
}

module.exports = correlationIdMiddleware;
