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

// ── Public routes (no auth required) ────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/webhooks', require('./routes/webhooks'));
app.use('/api/webhooks', require('./routes/webhooks'));

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString(), version: '3.0.0' }));

// ── Protected API routes (JWT required) ─────────────────────────────
// Apply auth middleware to all /api/* routes (auth routes already handled above)
app.use('/api', requireAuth);

app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/instagram', require('./routes/instagram'));
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

// Legal & Compliance Pages
app.get('/privacy', (_req, res) => res.sendFile(path.join(fallbackDir, 'privacy.html')));
app.get('/terms', (_req, res) => res.sendFile(path.join(fallbackDir, 'terms.html')));
app.get('/data-deletion', (_req, res) => res.sendFile(path.join(fallbackDir, 'data-deletion.html')));

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
