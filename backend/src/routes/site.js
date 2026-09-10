// backend/src/routes/site.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { DEFAULT_TEMPLATES } = require('../constants/defaultTemplates');

const DEFAULT_SITE_SETTINGS = {
  // Announcement
  announcement_enabled: false,
  announcement_text: '',
  announcement_badge: '',
  announcement_link: '',

  // Hero Section
  hero_badge: '⚡ Powered by Official Meta Instagram Graph API',
  hero_headline: 'Turn conversations into customers.',
  hero_headline_highlight: 'send the link in 1.4s.',
  hero_subtitle: 'Stop losing sales because you couldn’t manually copy-paste links to 400 commenters. Airvix automatically delivers your download links into their DMs while they’re still watching your Reel.',
  primary_cta_text: 'Get Started Free',
  primary_cta_url: '#signup',
  secondary_cta_text: 'See Live Simulation',
  secondary_cta_url: '#live-studio',
  demo_keyword: 'WORKBOOK',

  // Contact & Business Details
  support_email: 'support@airvix.com',
  support_phone: '+1 (800) 555-0199',
  whatsapp_number: '+91 98765 43210',
  business_address: '123 Airvix Tower, Tech Park, Suite 400, San Francisco, CA',
  business_hours: '24/7 Global Automated Support',

  // Legal & Compliance Documents (Full Text Content)
  privacy_policy_text: `AIRVIX PRIVACY POLICY
Effective Date: September 2026

1. DATA COLLECTION & MINIMIZATION
We collect only the essential data required to provide automated Instagram comment-to-DM responses. This includes public post comments, connected Instagram Account IDs, and automated reply logs.

2. SECURITY & OAUTH ENCRYPTION
Airvix connects exclusively via official Meta OAuth 2.0. We never request or store your Instagram password. All access tokens are encrypted at rest using AES-256-GCM.

3. DATA RETENTION & DELETION
You may disconnect your Instagram account or request complete account deletion at any time from your Creator Settings. Deleted data is permanently purged from our database within 24 hours.`,

  terms_of_service_text: `AIRVIX TERMS OF SERVICE
Effective Date: September 2026

1. ACCEPTANCE OF TERMS
By accessing or using Airvix, you agree to comply with these Terms of Service and all applicable Meta Developer Terms.

2. COMPLIANCE & FAIR USE
Airvix provides automated comment-to-DM delivery tools. Users agree not to use Airvix for sending prohibited spam, illegal content, or violating Instagram Community Guidelines.

3. ACCOUNT RESPONSIBILITY
You are responsible for maintaining the security of your account login credentials. Airvix reserves the right to suspend accounts violating Meta API rate limits or engaging in abusive spam behavior.`,

  refund_policy_text: `AIRVIX REFUND & CANCELLATION POLICY
Effective Date: September 2026

1. 7-DAY MONEY-BACK GUARANTEE
If you upgrade to a paid Airvix plan and are not completely satisfied, you may request a 100% full refund within 7 days of purchase.

2. CANCEL ANYTIME
You can cancel your active subscription at any time with 1 click from your Billing panel. Your access will remain active until the end of your paid billing period.`,

  // Media & Video
  demo_video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  demo_video_title: 'Watch 60-Second Airvix Product Demo',

  // Social Proof & Metrics
  social_creators: '12,000+',
  social_dms: '4.8M+',
  social_rating: '4.9/5',
  social_reply_speed: '0.8s',

  // Feature Showcase Bundles
  feature_1_title: 'Specific Reel Automations',
  feature_1_desc: 'Target individual viral Reels with unique keywords without affecting your standard posts.',
  feature_2_title: '24h Story Auto-Replies',
  feature_2_desc: 'Catch followers while they watch your stories with instant automated DM responses.',
  feature_3_title: 'Anti-Spam Human Jitter',
  feature_3_desc: 'Randomized 1.4s to 4s response delays ensure 100% Meta API compliance & account safety.',
  feature_4_title: 'Follow-to-Unlock Protection',
  feature_4_desc: 'Require users to follow your account before revealing private links or promo codes.',

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
  footer_tagline: 'The premier Instagram comment-to-DM conversion engine for creators, brands, and agencies.',
  maker_quote: 'We built Airvix because we were genuinely tired of waking up to 200 unread comments, spending all morning copy-pasting links into DMs, and losing sales while our Reels were going viral. You don’t need an enterprise sales CRM with 40 sub-menus. You just need your links delivered immediately without getting banned.',
  maker_team: 'The Airvix Engineering Team',

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

