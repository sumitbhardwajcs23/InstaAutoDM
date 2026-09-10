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
  hero_badge: 'AUTOMATE, ENGAGE, GROW',
  hero_headline: 'Turn Instagram Conversations',
  hero_headline_highlight: 'Real Growth',
  hero_highlight_color: '#3b82f6',
  hero_subtitle: 'Airvix helps creators and businesses automate Instagram comments and DMs, engage their audience, and convert conversations into customers — effortlessly.',
  primary_cta_text: 'Get started free',
  primary_cta_url: '#signup',
  secondary_cta_text: 'Watch demo',
  secondary_cta_url: '/Mere_ko_apne_business_air_airv.mp4',
  hero_media_type: 'video',
  hero_video_url: '/Mere_ko_apne_business_air_airv.mp4',
  hero_image_url: '',
  demo_keyword: 'WORKBOOK',

  // Feature Section (Why Airvix)
  features_badge: 'WHY AIRVIX',
  features_heading: "More than automation.\nIt's a growth system.",
  features_subtitle: 'Everything you need to attract, engage, and convert your audience on Instagram — in one simple platform.',
  features_note: 'Built for creators, brands and businesses',
  feature_1_title: 'Automate Replies',
  feature_1_desc: 'Instant, intelligent responses to comments and DMs.',
  feature_2_title: 'Increase Engagement',
  feature_2_desc: 'Turn casual followers into loyal customers.',
  feature_3_title: 'Save Hours',
  feature_3_desc: 'Let AI handle repetitive conversations.',
  feature_4_title: 'Stay in Control',
  feature_4_desc: 'Customize responses and manage everything easily.',

  // How It Works Section
  how_badge: 'HOW IT WORKS',
  how_heading: 'Simple setup. Powerful results.',
  how_subtitle: 'Get your automated Instagram sales engine running in 3 minutes.',
  step_1_title: 'Connect Instagram Account',
  step_1_desc: 'Connect your professional or creator Instagram account in seconds with 1-click official Meta OAuth 2.0.',
  step_2_title: 'Set Keywords & Custom DMs',
  step_2_desc: 'Define your trigger keywords (e.g. LINK, PRICE, WORKBOOK) and customize your DM with interactive links.',
  step_3_title: 'Watch Leads & Sales Convert',
  step_3_desc: 'When followers comment, Airvix delivers your link in under 1.4s while they are still engaged on your Reel.',

  // Pricing Section (INR ₹)
  pricing_badge: 'TRANSPARENT PRICING',
  pricing_heading: 'Scale your Instagram engagement in Rupees',
  pricing_subtitle: 'No hidden international conversion charges. Instant activation with UPI, Cards & Net Banking with GST.',
  price_starter: 0,
  price_creator: 1499,
  price_agency: 3999,
  limit_starter: '1,000',
  limit_creator: '25,000',
  limit_agency: '100,000',

  // Contact & Business Details
  support_email: 'support@airvix.com',
  support_phone: '+91 98765 43210',
  whatsapp_number: '+91 98765 43210',
  business_address: 'Airvix Technologies Pvt Ltd, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038, India',
  business_hours: '24/7 Global Automated Support',
  gst_number: '29ABCDE1234F1Z5',

  // Legal & Compliance Documents
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

  dpdp_compliance_text: `DIGITAL PERSONAL DATA PROTECTION (DPDP) COMPLIANCE
Effective Date: September 2026

Airvix strictly adheres to the Digital Personal Data Protection Act 2023 (India) and global data processing standards. We process data strictly with explicit user consent and provide instant data export and account erasure tools.`,

  // Media & Video
  demo_video_url: '/Mere_ko_apne_business_air_airv.mp4',
  demo_video_title: 'Watch 60-Second Airvix Product Demo',

  // Social Proof & Metrics
  social_creators: '12,000+',
  social_dms: '4.8M+',
  social_rating: '4.9/5',
  social_reply_speed: '0.8s',

  // Testimonials
  test_1_name: 'Aditi Sharma',
  test_1_role: 'Content Creator',
  test_1_quote: 'Airvix has completely changed how I manage my Instagram. I save hours every week!',
  test_2_name: 'Rohit Mehta',
  test_2_role: 'D2C Brand Owner',
  test_2_quote: 'Super easy to set up and it actually feels personal. My engagement has doubled.',
  test_3_name: 'Sneha Kapoor',
  test_3_role: 'Social Media Agency',
  test_3_quote: 'The best investment for our social media team. It just works — reliable and smoothly.',

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
  copyright_text: '© 2026 Airvix Technologies Pvt Ltd. All rights reserved. Made in India for creators worldwide.',

  // Design & SEO
  meta_title: 'Airvix - Instagram Comment-to-DM Conversion Engine',
  meta_description: 'Turn post comments, reels, and stories into automated customer conversations in under 1.4 seconds. Official Meta Graph API v22.0.',
  accent_color: '#3b82f6',

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

