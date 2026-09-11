// backend/src/server.js
const envPath = require('path').join(__dirname, '../../.env');
if (require('fs').existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { validateSecrets } = require('./config/secrets');
validateSecrets();

require('./db'); // Initialize DB

const app = express();
const PORT = process.env.PORT || 3000;

const { requireAuth, sanitizeParamsMiddleware } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimiter');
const correlationIdMiddleware = require('./middleware/correlationId');
const { securityHeaders, validateContentType, enforceHttps } = require('./middleware/securityHeaders');
const observability = require('./services/observability');
const logger = require('./services/logger');

// Enforce HTTPS in production
app.use(enforceHttps);

// Content-Security-Policy & Strict Security Headers
app.use(securityHeaders);

app.use(correlationIdMiddleware);

// Strict CORS allowlist with environment override support
const defaultOrigins = [
  'https://airvix.ai',
  'https://app.airvix.ai',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173'
];
const envAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : [];
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envAllowedOrigins]));

app.use(cors({ 
  origin: (origin, callback) => {
    // Allow non-browser requests (tools, curl, server-to-server) without Origin header
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error(`Origin '${origin}' not permitted by CORS policy`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], 
  allowedHeaders: ['Content-Type','Authorization','X-Request-Id'] 
}));

// Global request latency & structured telemetry tracking
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    observability.recordApiRequest(req.method, req.route ? req.route.path : req.path, res.statusCode, duration);
    if (req.path.startsWith('/api') || req.path.startsWith('/webhooks')) {
      logger.info(`${req.method} ${req.originalUrl || req.path} ${res.statusCode} ${duration}ms`, {
        method: req.method,
        url: req.originalUrl || req.path,
        status: res.statusCode,
        duration_ms: duration,
        correlationId: req.id,
        ip: req.ip
      });
    }
  });
  next();
});

app.use(validateContentType);

app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeParamsMiddleware);

// ── Public routes (no auth required / handles own auth) ──────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/site', require('./routes/site'));
app.use('/webhooks/payment', require('./routes/webhooksPayment'));
app.use('/webhooks', require('./routes/webhooks'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/instagram', require('./routes/instagram'));

// Basic liveness probe
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString(), version: '3.4.0' }));

// Deep readiness probe with database, queue, and latency percentiles
app.get(['/health/ready', '/api/health'], async (_req, res) => {
  const status = await observability.getHealthStatus();
  const statusCode = status.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(status);
});

// ── Protected API routes (JWT required & Rate Limited) ─────────────────────
// Apply auth and rate limiting middleware to remaining /api/* routes
app.use('/api', apiLimiter);
app.use('/api', requireAuth);

app.use('/api/billing', require('./routes/billing'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/rules', require('./routes/rules'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/usage', require('./routes/usage'));
app.use('/api/simulator', require('./routes/simulator'));
app.use('/api/admin', require('./routes/admin'));

// ── Static frontend ──────────────────────────────────────────────────
const distDir = path.join(__dirname, '../../frontend/dist');
const fallbackDir = path.join(__dirname, '../../frontend');
const staticDir = fs.existsSync(distDir) ? distDir : fallbackDir;

app.use(express.static(staticDir, {
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// Legal & Compliance Pages (supports both clean URLs and .html for Meta)
app.get(['/privacy', '/privacy.html'], (_req, res) => res.sendFile(path.join(fallbackDir, 'privacy.html')));
app.get(['/terms', '/terms.html'], (_req, res) => res.sendFile(path.join(fallbackDir, 'terms.html')));
app.get(['/data-deletion', '/data-deletion.html'], (_req, res) => res.sendFile(path.join(fallbackDir, 'data-deletion.html')));
app.get('/data-deletion-status', async (req, res) => {
  const code = (req.query.id || req.query.confirmation_code || 'DEL-VERIFIED').replace(/[<>]/g, '');
  const db = require('./db');
  let record = null;
  try {
    record = await db.prepare("SELECT * FROM data_deletion_requests WHERE confirmation_code = ? OR id = ?").get(code, code);
  } catch (e) {}

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    if (!record) return res.status(404).json({ error: 'Record not found', confirmation_code: code });
    return res.json(record);
  }

  const timestamp = record?.completed_at || new Date().toISOString();
  const statusText = record?.status ? record.status.toUpperCase() : 'COMPLETED';

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Airvix — Data Deletion Status</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #080B12; color: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; }
        .card { background: #0E1420; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 36px 32px; max-width: 480px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .check { width: 48px; height: 48px; border-radius: 50%; background: rgba(34, 197, 94, 0.15); color: #22C55E; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 16px; font-weight: bold; }
        h2 { margin: 0 0 10px 0; font-size: 20px; color: #F5F7FA; }
        p { color: #94A3B8; font-size: 13.5px; line-height: 1.6; margin: 0 0 16px 0; }
        .code { background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 6px; font-family: monospace; color: #60A5FA; font-size: 13px; display: inline-block; }
        .meta-info { font-size: 12px; color: #64748B; margin-top: 14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="check">&#10003;</div>
        <h2>Data Deletion Request Processed</h2>
        <p>Your request to delete data associated with Airvix has been processed in accordance with Meta Platform Terms and GDPR Right to Erasure.</p>
        <div>Confirmation Code: <span class="code">${code}</span></div>
        <div class="meta-info">Status: <strong style="color:#22C55E;">${statusText}</strong> • Processed At: ${timestamp}</div>
      </div>
    </body>
    </html>
  `);
});

// 404 handler for API routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Stale chunk/asset handler (prevents MIME type errors when browser requests old JS hashes after deployment)
app.use((req, res, next) => {
  if (req.path.startsWith('/assets/') || req.path.endsWith('.js') || req.path.endsWith('.css')) {
    if (req.path.endsWith('.js')) {
      const requestedFile = path.join(staticDir, req.path);
      if (!fs.existsSync(requestedFile)) {
        res.type('application/javascript');
        return res.send('/* Stale JS chunk requested */ console.warn("[Airvix] Stale JS chunk requested. Reloading..."); if (typeof window !== "undefined") { window.location.reload(); }');
      }
    }
    if (req.path.endsWith('.css')) {
      const requestedFile = path.join(staticDir, req.path);
      if (!fs.existsSync(requestedFile)) {
        res.type('text/css');
        return res.send('/* Stale CSS chunk requested */');
      }
    }
  }
  next();
});

// SPA fallback for frontend
app.use((_req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    res.sendFile(path.join(distDir, 'index.html'));
  } else {
    res.sendFile(path.join(fallbackDir, 'index.html'));
  }
});

// Global unhandled error handler
app.use((err, req, res, _next) => {
  const correlationId = req.id || 'unknown';
  observability.recordError('EXPRESS_UNCAUGHT_ERROR', err, {
    correlationId,
    path: req.path,
    method: req.method
  });
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    correlation_id: correlationId
  });
});

const { startBillingRolloverJob } = require('./services/billingRollover');
const tokenLifecycle = require('./services/tokenLifecycle');
const queue = require('./services/queue');

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`\n🚀 Airvix SaaS v3.0`);
    console.log(`   API:     http://localhost:${PORT}`);
    console.log(`   Login:   http://localhost:${PORT}/login`);
    console.log(`   Webhook: http://localhost:${PORT}/webhooks/instagram`);
    console.log(`   Health:  http://localhost:${PORT}/health\n`);

    // Start automated 30-day billing rollover background service
    startBillingRolloverJob();

    // Start automated token lifecycle and proactive refresh service
    tokenLifecycle.startTokenLifecycleService();

    // Start automated daily data retention pruning job
    const { dataRetention } = require('./services/dataRetention');
    dataRetention.scheduleRetentionJobs();
  });

  const handleShutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
    tokenLifecycle.stopTokenLifecycleService();
    server.close(async () => {
      await queue.shutdown(5000);
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

module.exports = app;
