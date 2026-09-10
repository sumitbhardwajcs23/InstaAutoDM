// backend/src/routes/site.js
const express = require('express');
const router = express.Router();
const db = require('../db');

const DEFAULT_SITE_SETTINGS = {
  announcement_enabled: true,
  announcement_text: '🚀 Special Launch: Get 30% OFF Pro Plans with code AIRVIX30',
  announcement_badge: 'LIMITED OFFER',
  announcement_link: '#pricing',
  hero_headline: 'Turn conversations into customers.',
  hero_subtitle: 'Automate replies, engage your audience, and convert Instagram comments into sales automatically.',
  primary_cta_text: 'Get Started Free',
  primary_cta_url: '#signup',
  demo_keyword: 'GROWTH',
  support_email: 'support@airvix.com',
  maintenance_mode: false,
  allow_registrations: true,
  free_dm_limit: 1000,
};

// GET /api/site/settings (Public - no auth required)
router.get('/settings', async (_req, res) => {
  try {
    const rows = await db.prepare('SELECT key, value FROM site_settings').all();
    const settingsMap = {};
    (rows || []).forEach(r => {
      try {
        settingsMap[r.key] = JSON.parse(r.value);
      } catch (e) {
        settingsMap[r.key] = r.value;
      }
    });

    const finalSettings = { ...DEFAULT_SITE_SETTINGS, ...settingsMap };
    res.json({ settings: finalSettings });
  } catch (err) {
    console.warn('[Site] Get public settings fallback to defaults:', err.message);
    res.json({ settings: DEFAULT_SITE_SETTINGS });
  }
});

module.exports = router;
