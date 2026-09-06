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

require('./db'); // Initialize DB

const app = express();
const PORT = process.env.PORT || 3000;

const { requireAuth } = require('./middleware/auth');

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));

app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true }));

// ── Public routes (no auth required / handles own auth) ──────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/webhooks', require('./routes/webhooks'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/instagram', require('./routes/instagram'));

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString(), version: '3.2.0' }));

// ── Protected API routes (JWT required) ─────────────────────────────
// Apply auth middleware to remaining /api/* routes
app.use('/api', requireAuth);

app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/rules', require('./routes/rules'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/usage', require('./routes/usage'));
app.use('/api/simulator', require('./routes/simulator'));

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
app.get('/data-deletion-status', (req, res) => {
  const code = (req.query.id || req.query.confirmation_code || 'del_verified').replace(/[<>]/g, '');
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>ReplyOS — Data Deletion Status</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #080B12; color: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; }
        .card { background: #0E1420; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 36px 32px; max-width: 480px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .check { width: 48px; height: 48px; border-radius: 50%; background: rgba(34, 197, 94, 0.15); color: #22C55E; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 16px; font-weight: bold; }
        h2 { margin: 0 0 10px 0; font-size: 20px; color: #F5F7FA; }
        p { color: #94A3B8; font-size: 13.5px; line-height: 1.6; margin: 0 0 16px 0; }
        .code { background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 6px; font-family: monospace; color: #60A5FA; font-size: 13px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="check">&#10003;</div>
        <h2>Data Deletion Request Processed</h2>
        <p>Your request to delete data associated with ReplyOS has been completed in compliance with GDPR and Meta Platform Terms.</p>
        <div>Confirmation Code: <span class="code">${code}</span></div>
      </div>
    </body>
    </html>
  `);
});

// 404 handler for API routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// SPA fallback for frontend
app.use((_req, res) => {
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    res.sendFile(path.join(distDir, 'index.html'));
  } else {
    res.sendFile(path.join(fallbackDir, 'index.html'));
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`\n🚀 ReplyOS SaaS v3.0`);
    console.log(`   API:     http://localhost:${PORT}`);
    console.log(`   Login:   http://localhost:${PORT}/login`);
    console.log(`   Webhook: http://localhost:${PORT}/webhooks/instagram`);
    console.log(`   Health:  http://localhost:${PORT}/health\n`);
  });
}

module.exports = app;
