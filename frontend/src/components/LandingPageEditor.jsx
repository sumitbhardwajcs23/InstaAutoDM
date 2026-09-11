// frontend/src/components/LandingPageEditor.jsx
import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Zap,
  Save,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  Sparkles,
  Smartphone,
  Tablet,
  Monitor,
  MoreVertical,
  Globe,
  Palette,
  Search as SearchIcon,
  Sliders,
  Check,
  Shield,
  Clock,
  ArrowRight,
  Eye,
  RefreshCw
} from 'lucide-react';
import { apiFetch } from '../api/client';
import LandingView from './LandingView';

export default function LandingPageEditor({ user, onBackToApp, showToast }) {
  // Main Navigation Tab State: 'content' | 'design' | 'seo' | 'settings'
  const [activeTab, setActiveTab] = useState('content');

  // Subtab Section Accordion State inside 'content': 'hero' | 'features' | 'howitworks' | 'pricing' | 'testimonials' | 'faq' | 'footer'
  const [activeSection, setActiveSection] = useState('hero');

  // View Mode: 'edit' | 'preview'
  const [viewMode, setViewMode] = useState('edit');

  // Device Viewport Switcher: 'desktop' | 'tablet' | 'mobile'
  const [deviceViewport, setDeviceViewport] = useState('desktop');

  // Preview Comparison Toggle (Side-by-Side Dual View): boolean
  const [compareMode, setCompareMode] = useState(true);

  // Loading & Saving state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Settings State: Draft vs DB Saved
  const [siteSettings, setSiteSettings] = useState({
    // Hero
    hero_badge: 'AUTOMATE. ENGAGE. GROW.',
    hero_headline: 'Turn Instagram Conversations Into Real Growth',
    hero_headline_highlight: 'Real Growth',
    hero_highlight_color: '#3b82f6',
    hero_subtitle: 'Airvix helps creators and businesses automate Instagram comments and DMs, engage their audience, and convert conversations into customers — effortlessly.',
    primary_cta_text: 'Get started free →',
    primary_cta_url: 'https://app.airvix.com/signup',
    secondary_cta_text: 'Watch demo',
    secondary_cta_url: 'https://www.youtube.com/watch?v=demo',
    hero_media_type: 'video',
    demo_video_url: 'https://www.youtube.com/watch?v=demo',
    hero_image_url: '',
    hero_trust_text: 'Trusted by 10,000+ creators and businesses worldwide.',

    // Features
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

    // How It Works
    how_badge: 'HOW IT WORKS',
    how_heading: 'Simple setup. Powerful results.',
    how_subtitle: 'Get your automated Instagram sales engine running in 3 minutes.',
    step_1_title: 'Connect Instagram Account',
    step_1_desc: 'Connect your professional or creator Instagram account with 1-click official Meta OAuth 2.0.',
    step_2_title: 'Set Keywords & Custom DMs',
    step_2_desc: 'Define your trigger keywords and customize your DM with interactive links.',
    step_3_title: 'Watch Leads & Sales Convert',
    step_3_desc: 'When followers comment, Airvix delivers your link in under 1.4s while they are still engaged on your Reel.',

    // Pricing
    pricing_badge: 'TRANSPARENT PRICING',
    pricing_heading: 'Scale your Instagram engagement in Rupees',
    pricing_subtitle: 'No hidden international conversion charges. Instant activation with UPI, Cards & Net Banking.',
    pricing_discount_badge: 'Save 20%',
    pricing_guarantee: '7-day money-back guarantee • Cancel anytime with 1 click',
    // Plan 1: Starter
    plan_1_name: 'Starter',
    plan_1_desc: 'Perfect for individuals',
    price_starter: 0,
    limit_starter: '1,000',
    plan_1_features: '1 Instagram account\n{limit_starter} automated replies/month\nBasic templates\nEmail support',
    plan_1_btn: 'Get started',
    plan_1_url: '#signup',
    // Plan 2: Pro
    plan_2_name: 'Pro',
    plan_2_desc: 'For growing creators & brands',
    plan_2_badge: 'Most popular',
    price_creator: 1499,
    limit_creator: '25,000',
    plan_2_features: '3 Instagram accounts\n{limit_creator} automated replies/month\nAdvanced templates & spinning\nAnalytics & insights\nPriority support & GST invoice',
    plan_2_btn: 'Start 14-day free trial',
    plan_2_url: '#signup',
    // Plan 3: Agency
    plan_3_name: 'Agency',
    plan_3_desc: 'For teams & agencies',
    price_agency: 3999,
    limit_agency: '100,000',
    plan_3_features: '10 Instagram accounts\n{limit_agency} automated replies/month\nMulti-user team workspace\nCustom webhooks & API access\nDedicated account manager',
    plan_3_btn: 'Get started',
    plan_3_url: '#signup',

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
    faq_1_q: 'Will using Airvix put my Instagram account at risk?',
    faq_1_a: 'Never. Airvix is built exclusively on official Meta Graph API Webhooks. 100% compliant with Meta Terms.',
    faq_2_q: 'How fast are the automatic replies sent?',
    faq_2_a: 'Average response time is between 0.8s to 2.4s while the user is actively watching your reel.',
    faq_3_q: 'Can I send interactive visual cards and buttons in DMs?',
    faq_3_a: 'Yes! You can configure rich visual cards with cover images, headlines, and custom button links.',

    // Footer & Brand
    footer_tagline: 'The premier Instagram comment-to-DM conversion engine for creators, brands, and agencies.',
    support_email: 'support@airvix.com',
    support_phone: '+91 98765 43210',
    whatsapp_number: '+91 98765 43210',
    business_address: 'Airvix Technologies Pvt Ltd, Indiranagar, Bengaluru, Karnataka, India',
    privacy_policy_text: 'Privacy Policy content...',
    terms_of_service_text: 'Terms of Service content...',
    refund_policy_text: 'Refund Policy content...',

    // Design
    accent_color: '#3b82f6',
    font_family: 'Inter, sans-serif',
    hero_layout: 'standard',

    // SEO
    meta_title: 'Airvix - Instagram Comment-to-DM Conversion Engine',
    meta_description: 'Turn post comments, reels, and stories into automated customer conversations in under 1.4 seconds.',
    meta_keywords: 'Instagram DM automation, Comment to DM, Instagram Reels automation',
    og_image_url: 'https://app.airvix.com/og-image.jpg',
    canonical_url: 'https://airvix.com',
    favicon_url: '/favicon.ico',

    // Settings
    maintenance_mode: false,
    allow_registrations: true,
    custom_domain: 'app.airvix.com',
    analytics_tracking_id: 'G-AIRVIX2026',
    custom_head_scripts: ''
  });

  const [dbSavedSettings, setDbSavedSettings] = useState(null);

  // Fetch initial site settings
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await apiFetch('/admin/settings');
        if (res.ok) {
          const data = await res.json();
          if (data && data.settings) {
            setSiteSettings(prev => ({ ...prev, ...data.settings }));
            setDbSavedSettings(data.settings);
          }
        }
      } catch (err) {
        console.error('[LandingPageEditor] Error loading settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Save settings handler
  const handleSave = async (isPublish = false) => {
    try {
      setSaving(true);
      const res = await apiFetch('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(siteSettings)
      });
      if (res.ok) {
        setDbSavedSettings({ ...siteSettings });
        if (showToast) {
          showToast(isPublish ? '🚀 Landing Page published live successfully!' : '💾 Changes saved to draft successfully!');
        } else {
          alert(isPublish ? 'Landing Page published live!' : 'Changes saved!');
        }
      } else {
        alert('Failed to save settings');
      }
    } catch (err) {
      console.error('[LandingPageEditor] Save error:', err);
      alert('Error saving settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Helper: Character Counter
  const CharCount = ({ value, max }) => {
    const len = (value || '').length;
    const over = len > max;
    return (
      <span style={{ fontSize: '11px', fontWeight: 700, color: over ? '#ef4444' : '#64748b', marginLeft: 'auto' }}>
        {len}/{max}
      </span>
    );
  };

  // Helper: Field Row Component
  const FieldRow = ({ label, value, onChange, max, placeholder, textarea, rows = 3, type = 'text', hint }) => (
    <div className="lpe-field-group">
      <div className="lpe-field-header">
        <label className="lpe-field-label">{label}</label>
        {max && <CharCount value={value} max={max} />}
      </div>
      {textarea ? (
        <textarea
          rows={rows}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="lpe-textarea-input"
        />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="lpe-text-input"
        />
      )}
      {hint && <p className="lpe-field-hint">{hint}</p>}
    </div>
  );

  // Helper: Color Field Component
  const ColorField = ({ label, value, onChange }) => (
    <div className="lpe-field-group">
      <label className="lpe-field-label">{label}</label>
      <div className="lpe-color-picker-wrap">
        <input
          type="color"
          value={value || '#3b82f6'}
          onChange={e => onChange(e.target.value)}
          className="lpe-color-swatch"
        />
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="#3b82f6"
          className="lpe-color-text"
        />
      </div>
    </div>
  );

  // Section List
  const sections = [
    { id: 'hero', label: 'Hero Section', icon: '🏠' },
    { id: 'features', label: 'Feature Section', icon: '⚡' },
    { id: 'howitworks', label: 'How It Works', icon: '🔄' },
    { id: 'pricing', label: 'Pricing Section', icon: '💰' },
    { id: 'testimonials', label: 'Testimonials', icon: '💬' },
    { id: 'faq', label: 'FAQ Section', icon: '❓' },
    { id: 'footer', label: 'Footer', icon: '📌' }
  ];

  // Render Accordion Form Content based on active section
  const renderSectionForm = () => {
    switch (activeSection) {
      case 'hero':
        return (
          <div>
            <FieldRow
              label="Badge / Tagline"
              value={siteSettings.hero_badge}
              onChange={v => setSiteSettings(p => ({ ...p, hero_badge: v }))}
              max={60}
              placeholder="AUTOMATE. ENGAGE. GROW."
            />
            <FieldRow
              label="Main Heading"
              value={siteSettings.hero_headline}
              onChange={v => setSiteSettings(p => ({ ...p, hero_headline: v }))}
              max={120}
              placeholder="Turn Instagram Conversations Into Real Growth"
              textarea
              rows={2}
            />
            <ColorField
              label="Highlight Text Color"
              value={siteSettings.hero_highlight_color || '#3b82f6'}
              onChange={v => setSiteSettings(p => ({ ...p, hero_highlight_color: v }))}
            />
            <FieldRow
              label="Highlight Text"
              value={siteSettings.hero_headline_highlight}
              onChange={v => setSiteSettings(p => ({ ...p, hero_headline_highlight: v }))}
              max={60}
              placeholder="Real Growth"
            />
            <FieldRow
              label="Subheading"
              value={siteSettings.hero_subtitle}
              onChange={v => setSiteSettings(p => ({ ...p, hero_subtitle: v }))}
              max={200}
              placeholder="Airvix helps creators and businesses automate Instagram comments and DMs..."
              textarea
              rows={3}
            />

            <div className="lpe-grid-2">
              <FieldRow
                label="Primary Button"
                value={siteSettings.primary_cta_text}
                onChange={v => setSiteSettings(p => ({ ...p, primary_cta_text: v }))}
                placeholder="Get started free →"
              />
              <FieldRow
                label="Button Link"
                value={siteSettings.primary_cta_url}
                onChange={v => setSiteSettings(p => ({ ...p, primary_cta_url: v }))}
                placeholder="https://app.airvix.com/signup"
                type="url"
              />
            </div>

            <div className="lpe-grid-2">
              <FieldRow
                label="Secondary Button"
                value={siteSettings.secondary_cta_text}
                onChange={v => setSiteSettings(p => ({ ...p, secondary_cta_text: v }))}
                placeholder="Watch demo"
              />
              <FieldRow
                label="Button Link"
                value={siteSettings.secondary_cta_url}
                onChange={v => setSiteSettings(p => ({ ...p, secondary_cta_url: v }))}
                placeholder="https://www.youtube.com/watch?v=demo"
                type="url"
              />
            </div>

            <div className="lpe-field-group">
              <label className="lpe-field-label">Hero Image / Video</label>
              <div className="lpe-media-type-toggle">
                {[{ k: 'image', label: 'Image' }, { k: 'video', label: 'Video (YouTube, Vimeo, MP4)' }].map(opt => (
                  <button
                    key={opt.k}
                    type="button"
                    onClick={() => setSiteSettings(p => ({ ...p, hero_media_type: opt.k }))}
                    className={`lpe-media-btn ${(siteSettings.hero_media_type || 'video') === opt.k ? 'active' : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="lpe-media-input-box">
                <span style={{ fontSize: '16px' }}>🎥</span>
                <input
                  type="text"
                  value={siteSettings.demo_video_url || ''}
                  onChange={e => setSiteSettings(p => ({ ...p, demo_video_url: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=demo"
                  className="lpe-media-input"
                />
                {siteSettings.demo_video_url && (
                  <button
                    type="button"
                    onClick={() => setSiteSettings(p => ({ ...p, demo_video_url: '' }))}
                    className="lpe-clear-media-btn"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        );

      case 'features':
        return (
          <div>
            <FieldRow
              label="Section Badge"
              value={siteSettings.features_badge}
              onChange={v => setSiteSettings(p => ({ ...p, features_badge: v }))}
              placeholder="WHY AIRVIX"
              max={40}
            />
            <FieldRow
              label="Section Heading"
              value={siteSettings.features_heading}
              onChange={v => setSiteSettings(p => ({ ...p, features_heading: v }))}
              max={100}
              placeholder="More than automation. It's a growth system."
              textarea
              rows={2}
            />
            <FieldRow
              label="Section Subtitle"
              value={siteSettings.features_subtitle}
              onChange={v => setSiteSettings(p => ({ ...p, features_subtitle: v }))}
              max={200}
              placeholder="Everything you need to attract, engage, and convert your audience..."
              textarea
              rows={2}
            />
            <div className="lpe-divider" />
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="lpe-card-box">
                <div className="lpe-card-box-title">Feature Card {i}</div>
                <FieldRow
                  label="Title"
                  value={siteSettings[`feature_${i}_title`]}
                  onChange={v => setSiteSettings(p => ({ ...p, [`feature_${i}_title`]: v }))}
                  placeholder={`Feature ${i} Title`}
                />
                <FieldRow
                  label="Description"
                  value={siteSettings[`feature_${i}_desc`]}
                  onChange={v => setSiteSettings(p => ({ ...p, [`feature_${i}_desc`]: v }))}
                  placeholder="Feature description..."
                  textarea
                  rows={2}
                />
              </div>
            ))}
          </div>
        );

      case 'howitworks':
        return (
          <div>
            <FieldRow
              label="Section Badge"
              value={siteSettings.how_badge}
              onChange={v => setSiteSettings(p => ({ ...p, how_badge: v }))}
              placeholder="HOW IT WORKS"
            />
            <FieldRow
              label="Section Heading"
              value={siteSettings.how_heading}
              onChange={v => setSiteSettings(p => ({ ...p, how_heading: v }))}
              placeholder="Simple setup. Powerful results."
            />
            <FieldRow
              label="Section Subtitle"
              value={siteSettings.how_subtitle}
              onChange={v => setSiteSettings(p => ({ ...p, how_subtitle: v }))}
              textarea
              rows={2}
            />
            <div className="lpe-divider" />
            {[1, 2, 3].map(i => (
              <div key={i} className="lpe-card-box">
                <div className="lpe-card-box-title">Step {i}</div>
                <FieldRow
                  label="Step Title"
                  value={siteSettings[`step_${i}_title`]}
                  onChange={v => setSiteSettings(p => ({ ...p, [`step_${i}_title`]: v }))}
                  placeholder={`Step ${i} Title`}
                />
                <FieldRow
                  label="Step Description"
                  value={siteSettings[`step_${i}_desc`]}
                  onChange={v => setSiteSettings(p => ({ ...p, [`step_${i}_desc`]: v }))}
                  textarea
                  rows={2}
                />
              </div>
            ))}
          </div>
        );

      case 'pricing':
        return (
          <div>
            {/* Section Header */}
            <FieldRow
              label="Section Badge"
              value={siteSettings.pricing_badge}
              onChange={v => setSiteSettings(p => ({ ...p, pricing_badge: v }))}
              placeholder="TRANSPARENT PRICING"
            />
            <FieldRow
              label="Heading"
              value={siteSettings.pricing_heading}
              onChange={v => setSiteSettings(p => ({ ...p, pricing_heading: v }))}
              placeholder="Scale your Instagram engagement in Rupees"
            />
            <FieldRow
              label="Subtitle"
              value={siteSettings.pricing_subtitle}
              onChange={v => setSiteSettings(p => ({ ...p, pricing_subtitle: v }))}
              textarea
              rows={2}
            />
            <div className="lpe-grid-2">
              <FieldRow
                label="Discount Badge"
                value={siteSettings.pricing_discount_badge}
                onChange={v => setSiteSettings(p => ({ ...p, pricing_discount_badge: v }))}
                placeholder="Save 20%"
              />
              <FieldRow
                label="Guarantee Text"
                value={siteSettings.pricing_guarantee}
                onChange={v => setSiteSettings(p => ({ ...p, pricing_guarantee: v }))}
                placeholder="7-day money-back guarantee..."
              />
            </div>

            <div className="lpe-divider" />

            {/* Plan 1: Starter */}
            <div className="lpe-card-box">
              <div className="lpe-card-box-title">🆓 Plan 1 — Starter</div>
              <div className="lpe-grid-2">
                <FieldRow
                  label="Plan Name"
                  value={siteSettings.plan_1_name}
                  onChange={v => setSiteSettings(p => ({ ...p, plan_1_name: v }))}
                  placeholder="Starter"
                />
                <FieldRow
                  label="Tagline"
                  value={siteSettings.plan_1_desc}
                  onChange={v => setSiteSettings(p => ({ ...p, plan_1_desc: v }))}
                  placeholder="Perfect for individuals"
                />
              </div>
              <div className="lpe-grid-2">
                <FieldRow
                  label="Price (₹/month)"
                  value={String(siteSettings.price_starter ?? 0)}
                  onChange={v => setSiteSettings(p => ({ ...p, price_starter: Number(v) || 0 }))}
                  type="number"
                  placeholder="0"
                />
                <FieldRow
                  label="Monthly Reply Limit"
                  value={siteSettings.limit_starter}
                  onChange={v => setSiteSettings(p => ({ ...p, limit_starter: v }))}
                  placeholder="1,000"
                />
              </div>
              <FieldRow
                label="Feature Bullets (one per line; use {limit_starter} for the limit)"
                value={siteSettings.plan_1_features}
                onChange={v => setSiteSettings(p => ({ ...p, plan_1_features: v }))}
                textarea
                rows={4}
                placeholder={`1 Instagram account\n{limit_starter} automated replies/month\nBasic templates\nEmail support`}
              />
              <div className="lpe-grid-2">
                <FieldRow
                  label="Button Text"
                  value={siteSettings.plan_1_btn}
                  onChange={v => setSiteSettings(p => ({ ...p, plan_1_btn: v }))}
                  placeholder="Get started"
                />
                <FieldRow
                  label="Button URL"
                  value={siteSettings.plan_1_url}
                  onChange={v => setSiteSettings(p => ({ ...p, plan_1_url: v }))}
                  placeholder="#signup"
                />
              </div>
            </div>

            {/* Plan 2: Pro */}
            <div className="lpe-card-box">
              <div className="lpe-card-box-title">⭐ Plan 2 — Pro (Featured)</div>
              <div className="lpe-grid-2">
                <FieldRow
                  label="Plan Name"
                  value={siteSettings.plan_2_name}
                  onChange={v => setSiteSettings(p => ({ ...p, plan_2_name: v }))}
                  placeholder="Pro"
                />
                <FieldRow
                  label="Tagline"
                  value={siteSettings.plan_2_desc}
                  onChange={v => setSiteSettings(p => ({ ...p, plan_2_desc: v }))}
                  placeholder="For growing creators & brands"
                />
              </div>
              <div className="lpe-grid-2">
                <FieldRow
                  label="Price (₹/month)"
                  value={String(siteSettings.price_creator ?? 1499)}
                  onChange={v => setSiteSettings(p => ({ ...p, price_creator: Number(v) || 1499 }))}
                  type="number"
                  placeholder="1499"
                />
                <FieldRow
                  label="Monthly Reply Limit"
                  value={siteSettings.limit_creator}
                  onChange={v => setSiteSettings(p => ({ ...p, limit_creator: v }))}
                  placeholder="25,000"
                />
              </div>
              <FieldRow
                label="Popular Badge Text"
                value={siteSettings.plan_2_badge}
                onChange={v => setSiteSettings(p => ({ ...p, plan_2_badge: v }))}
                placeholder="Most popular"
              />
              <FieldRow
                label="Feature Bullets (one per line; use {limit_creator} for the limit)"
                value={siteSettings.plan_2_features}
                onChange={v => setSiteSettings(p => ({ ...p, plan_2_features: v }))}
                textarea
                rows={5}
                placeholder={`3 Instagram accounts\n{limit_creator} automated replies/month\nAdvanced templates & spinning\nAnalytics & insights\nPriority support & GST invoice`}
              />
              <div className="lpe-grid-2">
                <FieldRow
                  label="Button Text"
                  value={siteSettings.plan_2_btn}
                  onChange={v => setSiteSettings(p => ({ ...p, plan_2_btn: v }))}
                  placeholder="Start 14-day free trial"
                />
                <FieldRow
                  label="Button URL"
                  value={siteSettings.plan_2_url}
                  onChange={v => setSiteSettings(p => ({ ...p, plan_2_url: v }))}
                  placeholder="#signup"
                />
              </div>
            </div>

            {/* Plan 3: Agency */}
            <div className="lpe-card-box">
              <div className="lpe-card-box-title">🏢 Plan 3 — Agency</div>
              <div className="lpe-grid-2">
                <FieldRow
                  label="Plan Name"
                  value={siteSettings.plan_3_name}
                  onChange={v => setSiteSettings(p => ({ ...p, plan_3_name: v }))}
                  placeholder="Agency"
                />
                <FieldRow
                  label="Tagline"
                  value={siteSettings.plan_3_desc}
                  onChange={v => setSiteSettings(p => ({ ...p, plan_3_desc: v }))}
                  placeholder="For teams & agencies"
                />
              </div>
              <div className="lpe-grid-2">
                <FieldRow
                  label="Price (₹/month)"
                  value={String(siteSettings.price_agency ?? 3999)}
                  onChange={v => setSiteSettings(p => ({ ...p, price_agency: Number(v) || 3999 }))}
                  type="number"
                  placeholder="3999"
                />
                <FieldRow
                  label="Monthly Reply Limit"
                  value={siteSettings.limit_agency}
                  onChange={v => setSiteSettings(p => ({ ...p, limit_agency: v }))}
                  placeholder="100,000"
                />
              </div>
              <FieldRow
                label="Feature Bullets (one per line; use {limit_agency} for the limit)"
                value={siteSettings.plan_3_features}
                onChange={v => setSiteSettings(p => ({ ...p, plan_3_features: v }))}
                textarea
                rows={5}
                placeholder={`10 Instagram accounts\n{limit_agency} automated replies/month\nMulti-user team workspace\nCustom webhooks & API access\nDedicated account manager`}
              />
              <div className="lpe-grid-2">
                <FieldRow
                  label="Button Text"
                  value={siteSettings.plan_3_btn}
                  onChange={v => setSiteSettings(p => ({ ...p, plan_3_btn: v }))}
                  placeholder="Get started"
                />
                <FieldRow
                  label="Button URL"
                  value={siteSettings.plan_3_url}
                  onChange={v => setSiteSettings(p => ({ ...p, plan_3_url: v }))}
                  placeholder="#signup"
                />
              </div>
            </div>
          </div>
        );

      case 'testimonials':
        return (
          <div>
            {[1, 2, 3].map(i => (
              <div key={i} className="lpe-card-box">
                <div className="lpe-card-box-title">Testimonial {i}</div>
                <div className="lpe-grid-2">
                  <FieldRow
                    label="Name"
                    value={siteSettings[`test_${i}_name`]}
                    onChange={v => setSiteSettings(p => ({ ...p, [`test_${i}_name`]: v }))}
                  />
                  <FieldRow
                    label="Role"
                    value={siteSettings[`test_${i}_role`]}
                    onChange={v => setSiteSettings(p => ({ ...p, [`test_${i}_role`]: v }))}
                  />
                </div>
                <FieldRow
                  label="Quote"
                  value={siteSettings[`test_${i}_quote`]}
                  onChange={v => setSiteSettings(p => ({ ...p, [`test_${i}_quote`]: v }))}
                  textarea
                  rows={3}
                />
              </div>
            ))}
          </div>
        );

      case 'faq':
        return (
          <div>
            {[1, 2, 3].map(i => (
              <div key={i} className="lpe-card-box">
                <div className="lpe-card-box-title">FAQ {i}</div>
                <FieldRow
                  label="Question"
                  value={siteSettings[`faq_${i}_q`]}
                  onChange={v => setSiteSettings(p => ({ ...p, [`faq_${i}_q`]: v }))}
                />
                <FieldRow
                  label="Answer"
                  value={siteSettings[`faq_${i}_a`]}
                  onChange={v => setSiteSettings(p => ({ ...p, [`faq_${i}_a`]: v }))}
                  textarea
                  rows={3}
                />
              </div>
            ))}
          </div>
        );

      case 'footer':
        return (
          <div>
            <FieldRow
              label="Footer Tagline"
              value={siteSettings.footer_tagline}
              onChange={v => setSiteSettings(p => ({ ...p, footer_tagline: v }))}
              textarea
              rows={2}
            />
            <FieldRow
              label="Support Email"
              value={siteSettings.support_email}
              onChange={v => setSiteSettings(p => ({ ...p, support_email: v }))}
            />
            <FieldRow
              label="Support Phone"
              value={siteSettings.support_phone}
              onChange={v => setSiteSettings(p => ({ ...p, support_phone: v }))}
            />
            <FieldRow
              label="WhatsApp Number"
              value={siteSettings.whatsapp_number}
              onChange={v => setSiteSettings(p => ({ ...p, whatsapp_number: v }))}
            />
            <FieldRow
              label="Business Address"
              value={siteSettings.business_address}
              onChange={v => setSiteSettings(p => ({ ...p, business_address: v }))}
              textarea
              rows={2}
            />
          </div>
        );

      default:
        return null;
    }
  };

  // Render Design Tab
  const renderDesignTab = () => (
    <div style={{ padding: '18px' }}>
      <ColorField
        label="Accent Primary Color"
        value={siteSettings.accent_color || '#3b82f6'}
        onChange={v => setSiteSettings(p => ({ ...p, accent_color: v }))}
      />
      <div className="lpe-field-group">
        <label className="lpe-field-label">Typography / Font Family</label>
        <select
          value={siteSettings.font_family || 'Inter, sans-serif'}
          onChange={e => setSiteSettings(p => ({ ...p, font_family: e.target.value }))}
          className="lpe-select-input"
        >
          <option value="Inter, sans-serif">Inter (Modern & Clean)</option>
          <option value="'Roboto', sans-serif">Roboto (Tech Standard)</option>
          <option value="'Outfit', sans-serif">Outfit (Bold & Geometric)</option>
          <option value="system-ui, -apple-system, sans-serif">System Native Sans</option>
        </select>
      </div>
      <div className="lpe-field-group">
        <label className="lpe-field-label">Hero Section Layout</label>
        <select
          value={siteSettings.hero_layout || 'standard'}
          onChange={e => setSiteSettings(p => ({ ...p, hero_layout: e.target.value }))}
          className="lpe-select-input"
        >
          <option value="standard">Standard (Headline + Dual Cards Mockup)</option>
          <option value="split">Split Screen (Form Left + Video Right)</option>
          <option value="centered">Centered Hero (Minimalist CTA)</option>
        </select>
      </div>
    </div>
  );

  // Render SEO Tab
  const renderSeoTab = () => (
    <div style={{ padding: '18px' }}>
      <FieldRow
        label="Meta Title"
        value={siteSettings.meta_title}
        onChange={v => setSiteSettings(p => ({ ...p, meta_title: v }))}
        max={60}
        placeholder="Airvix - Instagram Comment-to-DM Conversion Engine"
      />
      <FieldRow
        label="Meta Description"
        value={siteSettings.meta_description}
        onChange={v => setSiteSettings(p => ({ ...p, meta_description: v }))}
        max={160}
        textarea
        rows={3}
        placeholder="Turn post comments, reels, and stories into automated customer conversations in under 1.4 seconds..."
      />
      <FieldRow
        label="Meta Keywords"
        value={siteSettings.meta_keywords}
        onChange={v => setSiteSettings(p => ({ ...p, meta_keywords: v }))}
        placeholder="Instagram DM automation, Comment to DM, Instagram Reels automation"
      />
      <FieldRow
        label="OG Social Image URL"
        value={siteSettings.og_image_url}
        onChange={v => setSiteSettings(p => ({ ...p, og_image_url: v }))}
        placeholder="https://app.airvix.com/og-image.jpg"
      />
      <FieldRow
        label="Favicon URL"
        value={siteSettings.favicon_url}
        onChange={v => setSiteSettings(p => ({ ...p, favicon_url: v }))}
        placeholder="/favicon.ico"
      />
    </div>
  );

  // Render Settings Tab
  const renderSettingsTab = () => (
    <div style={{ padding: '18px' }}>
      <div className="lpe-switch-row">
        <div>
          <div className="lpe-switch-title">Maintenance Mode</div>
          <div className="lpe-switch-sub">Temporarily redirect public visitors to maintenance screen</div>
        </div>
        <button
          type="button"
          onClick={() => setSiteSettings(p => ({ ...p, maintenance_mode: !p.maintenance_mode }))}
          className={`lpe-toggle-switch ${siteSettings.maintenance_mode ? 'on' : 'off'}`}
        >
          <span className="lpe-toggle-circle" />
        </button>
      </div>

      <div className="lpe-switch-row">
        <div>
          <div className="lpe-switch-title">Allow New Registrations</div>
          <div className="lpe-switch-sub">Enable self-service signups on the landing page</div>
        </div>
        <button
          type="button"
          onClick={() => setSiteSettings(p => ({ ...p, allow_registrations: !p.allow_registrations }))}
          className={`lpe-toggle-switch ${siteSettings.allow_registrations ? 'on' : 'off'}`}
        >
          <span className="lpe-toggle-circle" />
        </button>
      </div>

      <FieldRow
        label="Custom App Domain"
        value={siteSettings.custom_domain}
        onChange={v => setSiteSettings(p => ({ ...p, custom_domain: v }))}
        placeholder="app.airvix.com"
      />

      <FieldRow
        label="Analytics / Tracking ID"
        value={siteSettings.analytics_tracking_id}
        onChange={v => setSiteSettings(p => ({ ...p, analytics_tracking_id: v }))}
        placeholder="G-AIRVIX2026"
      />

      <FieldRow
        label="Custom Head Scripts"
        value={siteSettings.custom_head_scripts}
        onChange={v => setSiteSettings(p => ({ ...p, custom_head_scripts: v }))}
        textarea
        rows={4}
        placeholder="<!-- Insert custom meta tags or tracking scripts -->"
      />
    </div>
  );

  // Live Preview Component (Exact Replica of Public Landing Page)
  const LivePreviewRender = ({ settings, isDraft = true }) => {
    return (
      <div className="lpe-preview-mockup-wrapper" style={{ overflowY: 'auto', maxHeight: '780px', borderRadius: '10px' }}>
        <LandingView
          siteSettingsOverride={settings}
          isPreview={true}
          user={user}
          activeSectionHighlight={activeSection}
          onSectionClick={(secId) => setActiveSection(secId)}
        />
      </div>
    );
  };

  return (
    <div className="lpe-editor-container">
      {/* ─────────── 1. TOP HEADER BAR ─────────── */}
      <div className="lpe-top-header">
        <div className="lpe-header-title-wrap">
          <div className="lpe-title-row">
            <h1 className="lpe-header-title">Landing Page</h1>
            <span className="lpe-status-pill published">
              <span className="lpe-status-dot" />
              Published
            </span>
          </div>
          <p className="lpe-header-sub">Edit your site content and see changes live</p>
        </div>

        {/* Action Buttons */}
        <div className="lpe-header-actions">
          <button
            type="button"
            onClick={() => window.open('/', '_blank')}
            className="lpe-btn-outline"
          >
            <ExternalLink size={13} /> View Live Site ↗
          </button>

          <button type="button" className="lpe-btn-icon-more" title="More Options">
            <MoreVertical size={16} />
          </button>

          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="lpe-btn-secondary"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="lpe-btn-primary"
          >
            <Zap size={14} />
            {saving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      {/* ─────────── 2. SUB TABS & CONTROLS BAR ─────────── */}
      <div className="lpe-subtabs-bar">
        <div className="lpe-tabs-group">
          {[
            { id: 'content', label: 'Content', icon: Globe },
            { id: 'design', label: 'Design', icon: Palette },
            { id: 'seo', label: 'SEO', icon: SearchIcon },
            { id: 'settings', label: 'Settings', icon: Sliders }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`lpe-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="lpe-view-controls">
          {/* View Mode Toggle */}
          <div className="lpe-mode-toggle-group">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`lpe-mode-btn ${viewMode === 'edit' ? 'active' : ''}`}
            >
              Edit Mode
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`lpe-mode-btn ${viewMode === 'preview' ? 'active' : ''}`}
            >
              Preview
            </button>
          </div>

          {/* Device Switcher */}
          <div className="lpe-device-switcher">
            <button
              type="button"
              onClick={() => setDeviceViewport('desktop')}
              className={`lpe-device-btn ${deviceViewport === 'desktop' ? 'active' : ''}`}
              title="Desktop View"
            >
              <Monitor size={15} />
            </button>
            <button
              type="button"
              onClick={() => setDeviceViewport('tablet')}
              className={`lpe-device-btn ${deviceViewport === 'tablet' ? 'active' : ''}`}
              title="Tablet View"
            >
              <Tablet size={15} />
            </button>
            <button
              type="button"
              onClick={() => setDeviceViewport('mobile')}
              className={`lpe-device-btn ${deviceViewport === 'mobile' ? 'active' : ''}`}
              title="Mobile View"
            >
              <Smartphone size={15} />
            </button>
          </div>

          {/* Preview Comparison Toggle Switch */}
          <div className="lpe-compare-toggle-wrap">
            <span className="lpe-compare-label">Preview Comparison</span>
            <button
              type="button"
              onClick={() => setCompareMode(p => !p)}
              className={`lpe-switch-control ${compareMode ? 'active' : ''}`}
            >
              <span className="lpe-switch-handle" />
            </button>
          </div>
        </div>
      </div>

      {/* ─────────── 3. SPLIT MAIN WORKSPACE ─────────── */}
      <div className="lpe-workspace-body">
        {/* LEFT COLUMN: Section Accordion & Forms (Shown in Edit View Mode) */}
        {viewMode === 'edit' && (
          <div className="lpe-left-form-pane">
            {activeTab === 'content' && (
              <>
                {/* Section Accordions List */}
                <div className="lpe-accordion-list">
                  {sections.map(sec => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setActiveSection(sec.id)}
                      className={`lpe-accordion-item ${activeSection === sec.id ? 'active' : ''}`}
                    >
                      <div className="lpe-acc-title">
                        <span className="lpe-acc-icon">{sec.icon}</span>
                        <span>{sec.label}</span>
                      </div>
                      <ChevronRight size={15} className={`lpe-acc-chevron ${activeSection === sec.id ? 'open' : ''}`} />
                    </button>
                  ))}
                </div>

                {/* Section Input Form */}
                <div className="lpe-form-content-area">
                  <div className="lpe-form-section-header">
                    <h3>{sections.find(s => s.id === activeSection)?.label}</h3>
                  </div>
                  {renderSectionForm()}
                </div>
              </>
            )}

            {activeTab === 'design' && renderDesignTab()}
            {activeTab === 'seo' && renderSeoTab()}
            {activeTab === 'settings' && renderSettingsTab()}
          </div>
        )}

        {/* RIGHT COLUMN: Live Dual Preview Pane */}
        <div className={`lpe-right-preview-pane ${viewMode === 'preview' ? 'full-preview' : ''}`}>
          {/* Comparison Headers */}
          {compareMode && (
            <div className="lpe-preview-compare-headers">
              <div className="lpe-compare-tag live-draft">
                <span className="dot green" /> After Edit (Live Draft)
              </div>
              <div className="lpe-compare-tag db-saved">
                <span className="dot gray" /> Before Edit (DB Saved)
              </div>
            </div>
          )}

          {/* Viewport Frame */}
          <div className={`lpe-preview-viewport-frame viewport-${deviceViewport}`}>
            {compareMode ? (
              <div className="lpe-split-comparison-grid">
                {/* Left: After Edit (Live Draft) */}
                <div className="lpe-comparison-card live-draft">
                  <div className="lpe-card-badge green">● After Edit (Live Draft)</div>
                  <LivePreviewRender settings={siteSettings} isDraft={true} />
                </div>

                {/* Right: Before Edit (DB Saved) */}
                <div className="lpe-comparison-card db-saved">
                  <div className="lpe-card-badge gray">● Before Edit (DB Saved)</div>
                  <LivePreviewRender settings={dbSavedSettings || siteSettings} isDraft={false} />
                </div>
              </div>
            ) : (
              <div className="lpe-single-preview-card">
                <LivePreviewRender settings={siteSettings} isDraft={true} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
