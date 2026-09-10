// backend/src/routes/site.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { DEFAULT_TEMPLATES } = require('../constants/defaultTemplates');

const DEFAULT_SITE_SETTINGS = {
  // Announcement
  announcement_enabled: true,
  announcement_text: '🚀 Special Launch: Get 30% OFF Pro Plans with code AIRVIX30',
  announcement_badge: 'LIMITED OFFER',
  announcement_link: '#pricing',

  // Hero Section
  hero_badge: '⚡ Powered by Official Meta Instagram Graph API',
  hero_headline: 'Turn conversations into customers.',
  hero_subtitle: 'Automate replies, engage your audience, and convert Instagram comments into sales automatically.',
  primary_cta_text: 'Get Started Free',
  primary_cta_url: '#signup',
  secondary_cta_text: 'See Live Interactive Demo',
  secondary_cta_url: '#demo',
  demo_keyword: 'GROWTH',

  // Social Proof & Metrics
  social_creators: '12,000+',
  social_dms: '4.8M+',
  social_rating: '4.9/5',
  social_reply_speed: '0.8s',

  // Pricing Tiers (Monthly USD)
  pro_price_monthly: 29,
  agency_price_monthly: 79,
  enterprise_price_monthly: 199,

  // FAQs
  faqs: [
    {
      q: 'Will using Airvix put my Instagram account at risk?',
      a: 'Never. Airvix is built exclusively on official Meta Graph API Webhooks. We do not scrape, emulate devices, or use unauthorized private APIs. 100% compliant with Meta Terms of Service.'
    },
    {
      q: 'How fast are the automatic replies sent?',
      a: 'Average response time is between 0.8s to 2.4s. Airvix responds while the user is actively watching your reel, delivering the highest conversion rates.'
    },
    {
      q: 'Can I send interactive visual cards and buttons in DMs?',
      a: 'Yes! You can configure rich visual cards with cover images, headlines, subtext, and custom button links (e.g. to your shop, checkout, or calendar).'
    },
    {
      q: 'Can I require users to follow me before getting the DM?',
      a: 'Yes! With our Follow-to-Unlock feature, users who are not following you will receive an automated prompt asking them to follow first to unlock the download or promo code.'
    }
  ],

  // Platform & Brand
  platform_name: 'Airvix',
  support_email: 'support@airvix.com',
  footer_tagline: 'The premier Instagram comment-to-DM conversion engine for creators, brands, and agencies.',

  // Safeguards
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

// GET /api/site/templates (Public / Authenticated - get active templates library)
router.get('/templates', async (_req, res) => {
  try {
    const row = await db.prepare("SELECT value FROM site_settings WHERE key = 'custom_templates'").get();
    if (row && row.value) {
      try {
        const customTemplates = JSON.parse(row.value);
        if (Array.isArray(customTemplates) && customTemplates.length > 0) {
          return res.json({ templates: customTemplates });
        }
      } catch (parseErr) {
        console.warn('[Site] Failed to parse custom_templates from DB:', parseErr.message);
      }
    }
    res.json({ templates: DEFAULT_TEMPLATES });
  } catch (err) {
    console.warn('[Site] Get templates fallback:', err.message);
    res.json({ templates: DEFAULT_TEMPLATES });
  }
});

module.exports = router;
module.exports.DEFAULT_SITE_SETTINGS = DEFAULT_SITE_SETTINGS;

