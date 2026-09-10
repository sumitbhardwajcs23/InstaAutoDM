// frontend/src/components/LandingView.jsx
// Handcrafted, pixel-perfect SaaS Landing Page for Airvix matching reference design (Indian Rupees Pricing)
import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Play, 
  ChevronDown, 
  Check, 
  CreditCard,
  Users,
  Shield,
  MessageSquare,
  Sparkles,
  Zap,
  Sliders,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  HelpCircle,
  Instagram,
  Linkedin,
  Twitter,
  Youtube
} from 'lucide-react';
import '../styles/landing.css';

export default function LandingView({ onNavigate, user }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // 'monthly' | 'yearly'
  const [siteSettings, setSiteSettings] = useState(null);
  const [activeLegalDoc, setActiveLegalDoc] = useState(null); // 'privacy' | 'terms' | 'refund' | null
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  useEffect(() => {
    fetch('/api/site/settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.settings) {
          setSiteSettings(data.settings);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const testimonials = [
    {
      quote: "Airvix has completely changed how I manage my Instagram. I save hours every week!",
      name: "Aditi Sharma",
      role: "Content Creator",
      avatar: "/avatar-aditi.jpg"
    },
    {
      quote: "Super easy to set up and it actually feels personal. My engagement has doubled.",
      name: "Rohit Mehta",
      role: "D2C Brand Owner",
      avatar: "/avatar-rohit.jpg"
    },
    {
      quote: "The best investment for our social media team. It just works — reliable and smoothly.",
      name: "Sneha Kapoor",
      role: "Social Media Agency",
      avatar: "/avatar-sneha.jpg"
    }
  ];

  const nextTestimonial = () => {
    setTestimonialIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setTestimonialIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <div className="airvix-page-wrapper">
      {/* 1. TOP ANNOUNCEMENT BAR (If enabled) */}
      {siteSettings?.announcement_enabled && (
        <div className="airvix-announcement-bar">
          {siteSettings.announcement_badge && (
            <span className="airvix-announcement-badge">{siteSettings.announcement_badge}</span>
          )}
          <span>{siteSettings.announcement_text}</span>
          {siteSettings.announcement_link && (
            <a href={siteSettings.announcement_link} className="airvix-announcement-link">
              Explore Now →
            </a>
          )}
        </div>
      )}

      {/* 2. HEADER NAVBAR */}
      <header className={`airvix-navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="airvix-nav-container">
          <a href="#" className="airvix-logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <img src="/airvix-mark.png" alt="Airvix" className="airvix-logo-img" />
            <span className="airvix-logo-text">Airvix</span>
          </a>

          <nav className="airvix-nav-links">
            <a href="#features">Product</a>
            <a href="#how-it-works">Solutions</a>
            <a href="#pricing">Plans &amp; Billing</a>
            <div className="airvix-nav-dropdown">
              <span className="airvix-dropdown-label">
                Resources <ChevronDown size={14} />
              </span>
              <div className="airvix-dropdown-menu">
                <a href="#how-it-works">How It Works</a>
                <a href="#stories">Success Stories</a>
                <a href="#pricing">Rupee Pricing</a>
                <a href="#legal" onClick={(e) => { e.preventDefault(); setActiveLegalDoc('privacy'); }}>Security &amp; Privacy</a>
              </div>
            </div>
          </nav>

          <div className="airvix-nav-actions">
            {user ? (
              <button className="airvix-btn-primary" onClick={() => onNavigate('app')}>
                Open Dashboard <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <button className="airvix-btn-ghost" onClick={() => onNavigate('auth-login')}>
                  Sign in
                </button>
                <button className="airvix-btn-primary" onClick={() => onNavigate('auth-signup')}>
                  Get started <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 3. HERO SECTION (Dark Obsidian Atmosphere) */}
      <section className="airvix-hero-section">
        <div className="airvix-hero-radial-glow"></div>
        <div className="airvix-container airvix-hero-grid">
          
          {/* Left Column: Hero Content */}
          <div className="airvix-hero-left">
            <div className="airvix-badge-pill">
              {siteSettings?.hero_badge || 'AUTOMATE, ENGAGE, GROW'}
            </div>

            <h1 className="airvix-hero-heading">
              {siteSettings?.hero_headline || 'Turn Instagram Conversations'} <br />
              Into <span className="airvix-gradient-highlight">{siteSettings?.hero_headline_highlight || 'Real Growth'}</span>
            </h1>

            <p className="airvix-hero-sub">
              {siteSettings?.hero_subtitle || 
                'Airvix helps creators and businesses automate Instagram comments and DMs, engage their audience, and convert conversations into customers — effortlessly.'}
            </p>

            <div className="airvix-hero-buttons">
              <button className="airvix-btn-primary airvix-btn-lg" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
                {siteSettings?.primary_cta_text || 'Get started free'} <ArrowRight size={16} />
              </button>
              <button className="airvix-btn-dark airvix-btn-lg" onClick={() => setIsVideoModalOpen(true)}>
                <Play size={16} className="airvix-play-icon" />
                <span>{siteSettings?.secondary_cta_text || 'Watch demo'}</span>
              </button>
            </div>

            <div className="airvix-hero-trust-row">
              <div className="airvix-trust-item">
                <CreditCard size={15} color="#94a3b8" />
                <span>No credit card required</span>
              </div>
              <div className="airvix-trust-item">
                <Users size={15} color="#94a3b8" />
                <span>Trusted by 10,000+ creators</span>
              </div>
              <div className="airvix-trust-item">
                <Shield size={15} color="#94a3b8" />
                <span>Secure &amp; private</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Angle Tablet Device Mockup */}
          <div className="airvix-hero-right">
            <div className="airvix-handwritten-note airvix-hero-note">
              <span>From Comments to Customers</span>
              <svg className="airvix-curved-arrow" width="46" height="40" viewBox="0 0 46 40" fill="none">
                <path d="M6 6 C18 20, 28 32, 40 34 M40 34 L32 30 M40 34 L36 24" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div className="airvix-tablet-device">
              <div className="airvix-tablet-screen">
                
                {/* Dashboard Top Header */}
                <div className="airvix-tablet-top">
                  <div className="airvix-tablet-brand">
                    <img src="/airvix-mark.png" alt="Airvix" style={{ height: '18px' }} />
                    <span>Airvix</span>
                  </div>
                  <div className="airvix-tablet-greeting">
                    <span>Good morning 👋</span>
                  </div>
                </div>

                {/* Dashboard KPI Cards */}
                <div className="airvix-tablet-kpis">
                  <div className="airvix-tablet-kpi">
                    <div className="airvix-kpi-label">Comments</div>
                    <div className="airvix-kpi-val">1,248</div>
                    <div className="airvix-kpi-trend">+24%</div>
                  </div>
                  <div className="airvix-tablet-kpi">
                    <div className="airvix-kpi-label">Auto Replies</div>
                    <div className="airvix-kpi-val">882</div>
                    <div className="airvix-kpi-trend">+18%</div>
                  </div>
                  <div className="airvix-tablet-kpi">
                    <div className="airvix-kpi-label">Engagement</div>
                    <div className="airvix-kpi-val">24.8K</div>
                    <div className="airvix-kpi-trend">+64%</div>
                  </div>
                </div>

                {/* Engagement Growth Smooth Area Chart */}
                <div className="airvix-tablet-chart-wrap">
                  <div className="airvix-chart-title-row">
                    <span>Engagement Growth</span>
                    <span className="airvix-chart-range">Last 7 days ▼</span>
                  </div>
                  <svg className="airvix-tablet-chart-svg" viewBox="0 0 400 120" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="purpleGlowGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0,90 Q 60,40 120,70 T 240,40 T 360,20 L 400,15 L 400,120 L 0,120 Z"
                      fill="url(#purpleGlowGradient)"
                    />
                    <path
                      d="M 0,90 Q 60,40 120,70 T 240,40 T 360,20 L 400,15"
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="3"
                    />
                    <circle cx="360" cy="20" r="5" fill="#c084fc" stroke="#ffffff" strokeWidth="2" />
                  </svg>
                </div>

              </div>

              {/* Floating Notification 1: Top Right New Comment */}
              <div className="airvix-floating-toast airvix-toast-top">
                <div className="airvix-toast-icon airvix-toast-ig">📸</div>
                <div className="airvix-toast-content">
                  <div className="airvix-toast-header">
                    <span className="airvix-toast-title">New comment</span>
                    <span className="airvix-toast-time">now</span>
                  </div>
                  <div className="airvix-toast-body">"Do you have the price?"</div>
                </div>
              </div>

              {/* Floating Notification 2: Bottom Right AI Reply Sent */}
              <div className="airvix-floating-toast airvix-toast-bottom">
                <div className="airvix-toast-icon airvix-toast-ai">🤖</div>
                <div className="airvix-toast-content">
                  <div className="airvix-toast-header">
                    <span className="airvix-toast-title">AI Reply Sent</span>
                    <span className="airvix-toast-time">now</span>
                  </div>
                  <div className="airvix-toast-body">"Hey! Here's the link for you 👋"</div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* 4. TRUSTED BY LOGO CLOUD (Crisp White Background) */}
      <section className="airvix-brands-section">
        <div className="airvix-container">
          <p className="airvix-brands-label">TRUSTED BY CREATORS, BRANDS AND AGENCIES</p>
          <div className="airvix-brands-grid">
            <span className="airvix-brand-name">zomato</span>
            <span className="airvix-brand-name">boat</span>
            <span className="airvix-brand-name">mamaearth</span>
            <span className="airvix-brand-name">noise</span>
            <span className="airvix-brand-name">SUGAR</span>
            <span className="airvix-brand-name">THE DERMA CO</span>
          </div>
        </div>
      </section>

      {/* 5. WHY AIRVIX / VALUE PROPOSITION (Clean White Aesthetic) */}
      <section id="features" className="airvix-features-section">
        <div className="airvix-container">
          
          <div className="airvix-features-header-row">
            <div>
              <div className="airvix-section-badge">WHY AIRVIX</div>
              <h2 className="airvix-section-heading">
                More than automation.<br />
                It's a growth system.
              </h2>
              <p className="airvix-section-sub">
                Everything you need to attract, engage, and convert your audience on Instagram — in one simple platform.
              </p>
            </div>

            <div className="airvix-handwritten-note airvix-features-note">
              <span>Built for creators, brands and businesses</span>
              <svg className="airvix-curved-arrow" width="46" height="40" viewBox="0 0 46 40" fill="none">
                <path d="M6 8 C20 18, 30 28, 36 34 M36 34 L28 32 M36 34 L32 24" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className="airvix-feature-cards-grid">
            
            {/* Card 1: Automate Replies */}
            <div className="airvix-feature-card">
              <div className="airvix-feature-icon-box airvix-icon-blue">
                <MessageSquare size={22} color="#2563eb" />
              </div>
              <h3 className="airvix-feature-title">
                {siteSettings?.feature_1_title || 'Automate Replies'}
              </h3>
              <p className="airvix-feature-desc">
                {siteSettings?.feature_1_desc || 'Instant, intelligent responses to comments and DMs.'}
              </p>
            </div>

            {/* Card 2: Increase Engagement */}
            <div className="airvix-feature-card">
              <div className="airvix-feature-icon-box airvix-icon-purple">
                <Users size={22} color="#9333ea" />
              </div>
              <h3 className="airvix-feature-title">
                {siteSettings?.feature_2_title || 'Increase Engagement'}
              </h3>
              <p className="airvix-feature-desc">
                {siteSettings?.feature_2_desc || 'Turn casual followers into loyal customers.'}
              </p>
            </div>

            {/* Card 3: Save Hours */}
            <div className="airvix-feature-card">
              <div className="airvix-feature-icon-box airvix-icon-green">
                <Zap size={22} color="#059669" />
              </div>
              <h3 className="airvix-feature-title">
                {siteSettings?.feature_3_title || 'Save Hours'}
              </h3>
              <p className="airvix-feature-desc">
                {siteSettings?.feature_3_desc || 'Let AI handle repetitive conversations.'}
              </p>
            </div>

            {/* Card 4: Stay in Control */}
            <div className="airvix-feature-card">
              <div className="airvix-feature-icon-box airvix-icon-orange">
                <Sliders size={22} color="#ea580c" />
              </div>
              <h3 className="airvix-feature-title">
                {siteSettings?.feature_4_title || 'Stay in Control'}
              </h3>
              <p className="airvix-feature-desc">
                {siteSettings?.feature_4_desc || 'Customize responses and manage everything easily.'}
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 6. HOW IT WORKS (Dark Themed Section with Laptop Workspace Photo) */}
      <section id="how-it-works" className="airvix-how-section">
        <div className="airvix-container airvix-how-grid">
          
          {/* Left Column: 3 Steps */}
          <div className="airvix-how-left">
            <div className="airvix-badge-pill">HOW IT WORKS</div>
            <h2 className="airvix-how-heading">
              Set it up once.<br />
              Let Airvix do the rest.
            </h2>
            <p className="airvix-how-sub">
              From new comments to automated replies — watch how Airvix helps you engage and grow, in real time.
            </p>

            <div className="airvix-steps-list">
              <div className="airvix-step-item">
                <div className="airvix-step-num">1</div>
                <div>
                  <h4 className="airvix-step-title">Connect your Instagram</h4>
                  <p className="airvix-step-desc">Securely connect your Instagram account with a few clicks.</p>
                </div>
              </div>

              <div className="airvix-step-item">
                <div className="airvix-step-num">2</div>
                <div>
                  <h4 className="airvix-step-title">Set up your automation</h4>
                  <p className="airvix-step-desc">Choose triggers, customize replies, and use ready-to-edit templates.</p>
                </div>
              </div>

              <div className="airvix-step-item">
                <div className="airvix-step-num">3</div>
                <div>
                  <h4 className="airvix-step-title">Sit back and grow</h4>
                  <p className="airvix-step-desc">Let Airvix handle the conversations while you focus on what matters.</p>
                </div>
              </div>
            </div>

            <button className="airvix-btn-primary" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
              See how it works →
            </button>
          </div>

          {/* Right Column: Real Laptop Workspace Render */}
          <div className="airvix-how-right">
            <div className="airvix-workspace-card">
              <img
                src="/workspace-laptop.jpg"
                alt="Airvix Laptop Workspace"
                className="airvix-workspace-img"
              />
              <div className="airvix-workspace-quote">
                <span>Creators Build Brighter Tomorrows</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 7. SUCCESS STORIES / TESTIMONIALS (Clean White Background) */}
      <section id="stories" className="airvix-stories-section">
        <div className="airvix-container">
          
          <div className="airvix-stories-header">
            <div>
              <div className="airvix-section-badge">SUCCESS STORIES</div>
              <h2 className="airvix-section-heading">Loved by creators, trusted by businesses.</h2>
              <p className="airvix-section-sub">See how Airvix is helping people save time and grow faster.</p>
            </div>

            <div className="airvix-carousel-arrows">
              <button type="button" onClick={prevTestimonial} aria-label="Previous Testimonial">
                <ChevronLeft size={18} />
              </button>
              <button type="button" onClick={nextTestimonial} aria-label="Next Testimonial">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="airvix-testimonials-grid">
            {testimonials.map((t, idx) => (
              <div key={idx} className={`airvix-testimonial-card ${testimonialIndex === idx ? 'highlighted' : ''}`}>
                <div className="airvix-quote-icon">“</div>
                <p className="airvix-quote-text">{t.quote}</p>
                <div className="airvix-author-row">
                  <img src={t.avatar} alt={t.name} className="airvix-author-avatar" />
                  <div>
                    <div className="airvix-author-name">{t.name}</div>
                    <div className="airvix-author-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 8. PLANS & BILLING PRICING SECTION (STRICTLY IN INDIAN RUPEES) */}
      <section id="pricing" className="airvix-pricing-section">
        <div className="airvix-container">
          
          <div className="airvix-pricing-intro">
            <div className="airvix-section-badge">SIMPLE PRICING</div>
            <h2 className="airvix-section-heading">Plans for every stage of growth.</h2>
            <p className="airvix-section-sub">
              Scale your Instagram engagement in Rupees • Instant activation with UPI, Cards &amp; Net Banking with GST.
            </p>

            {/* Monthly / Yearly Billing Switch */}
            <div className="airvix-billing-toggle-wrap">
              <div className="airvix-billing-toggle">
                <button
                  type="button"
                  className={billingPeriod === 'monthly' ? 'active' : ''}
                  onClick={() => setBillingPeriod('monthly')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={billingPeriod === 'yearly' ? 'active' : ''}
                  onClick={() => setBillingPeriod('yearly')}
                >
                  Yearly
                </button>
              </div>
              <span className="airvix-save-pill">Save 20%</span>
            </div>
          </div>

          {/* 3 Pricing Cards Strictly in Indian Rupees (₹) */}
          <div className="airvix-pricing-deck">
            
            {/* Card 1: Starter */}
            <div className="airvix-price-card">
              <div className="airvix-tier-name">Starter</div>
              <div className="airvix-tier-desc">Perfect for individuals</div>
              
              <div className="airvix-tier-price">
                <span className="airvix-currency-symbol">₹</span>
                <span className="airvix-price-num">0</span>
                <span className="airvix-price-freq">/month</span>
              </div>

              <ul className="airvix-tier-features">
                <li><Check size={16} color="#059669" /> 1 Instagram account</li>
                <li><Check size={16} color="#059669" /> 1,000 automated replies/month</li>
                <li><Check size={16} color="#059669" /> Basic templates</li>
                <li><Check size={16} color="#059669" /> Email support</li>
              </ul>

              <button className="airvix-btn-outline airvix-btn-block" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
                Get started
              </button>
            </div>

            {/* Card 2: Pro (Most Popular) */}
            <div className="airvix-price-card airvix-card-popular">
              <div className="airvix-popular-pill">Most popular</div>
              
              <div className="airvix-tier-name">Pro</div>
              <div className="airvix-tier-desc">For growing creators &amp; brands</div>
              
              <div className="airvix-tier-price">
                <span className="airvix-currency-symbol">₹</span>
                <span className="airvix-price-num">
                  {billingPeriod === 'monthly' ? '1,499' : '1,199'}
                </span>
                <span className="airvix-price-freq">/month</span>
              </div>

              <ul className="airvix-tier-features">
                <li><Check size={16} color="#059669" /> 5 Instagram accounts</li>
                <li><Check size={16} color="#059669" /> 5,000 automated replies/month</li>
                <li><Check size={16} color="#059669" /> Advanced templates &amp; spinning</li>
                <li><Check size={16} color="#059669" /> Analytics &amp; insights</li>
                <li><Check size={16} color="#059669" /> Priority support &amp; GST invoice</li>
              </ul>

              <button className="airvix-btn-primary airvix-btn-block" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
                Start 14-day free trial
              </button>
            </div>

            {/* Card 3: Business */}
            <div className="airvix-price-card">
              <div className="airvix-tier-name">Business</div>
              <div className="airvix-tier-desc">For teams &amp; agencies</div>
              
              <div className="airvix-tier-price">
                <span className="airvix-currency-symbol">₹</span>
                <span className="airvix-price-num">
                  {billingPeriod === 'monthly' ? '3,999' : '3,199'}
                </span>
                <span className="airvix-price-freq">/month</span>
              </div>

              <ul className="airvix-tier-features">
                <li><Check size={16} color="#059669" /> Unlimited accounts</li>
                <li><Check size={16} color="#059669" /> 50,000 replies/month</li>
                <li><Check size={16} color="#059669" /> Custom templates &amp; webhooks</li>
                <li><Check size={16} color="#059669" /> Team collaboration</li>
                <li><Check size={16} color="#059669" /> Dedicated support &amp; GST vendor contract</li>
              </ul>

              <button className="airvix-btn-outline airvix-btn-block" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
                Contact sales
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* 9. READY TO GROW CTA BANNER (Curved Obsidian Section) */}
      <section className="airvix-cta-section">
        <div className="airvix-container airvix-cta-box">
          <div className="airvix-cta-content">
            <h2 className="airvix-cta-heading">Ready to grow with Airvix?</h2>
            <p className="airvix-cta-sub">
              Join thousands of creators and businesses already using Airvix to turn conversations into customers.
            </p>

            <div className="airvix-cta-buttons">
              <button className="airvix-btn-primary airvix-btn-lg" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
                Get started free <ArrowRight size={16} />
              </button>
              <button className="airvix-btn-dark airvix-btn-lg" onClick={() => setIsVideoModalOpen(true)}>
                <Play size={16} className="airvix-play-icon" />
                <span>Watch demo</span>
              </button>
            </div>
          </div>

          <div className="airvix-handwritten-note airvix-cta-note">
            <span>Smarter Conversations • A Brighter Tomorrow</span>
          </div>
        </div>
      </section>

      {/* 10. FOOTER (Dark Theme) */}
      <footer className="airvix-footer">
        <div className="airvix-container airvix-footer-content">
          <div className="airvix-footer-left">
            <a href="#" className="airvix-logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <img src="/airvix-mark.png" alt="Airvix" className="airvix-logo-img" />
              <span className="airvix-logo-text" style={{ color: '#ffffff' }}>Airvix</span>
            </a>
          </div>

          <div className="airvix-footer-links">
            <a href="#features">Product</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#how-it-works">Resources</a>
            <a href="#legal" onClick={(e) => { e.preventDefault(); setActiveLegalDoc('privacy'); }}>About</a>
          </div>

          <div className="airvix-footer-right">
            <div className="airvix-social-icons">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={16} /></a>
              <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="Twitter"><Twitter size={16} /></a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn"><Linkedin size={16} /></a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube"><Youtube size={16} /></a>
            </div>
            
            <div className="airvix-footer-meta">
              <span>© 2026 Airvix. All rights reserved.</span>
              <a href="#privacy" onClick={(e) => { e.preventDefault(); setActiveLegalDoc('privacy'); }}>Privacy</a>
              <a href="#terms" onClick={(e) => { e.preventDefault(); setActiveLegalDoc('terms'); }}>Terms</a>
              <a href="#contact" onClick={(e) => { e.preventDefault(); setActiveLegalDoc('refund'); }}>Contact</a>
            </div>
          </div>
        </div>
      </footer>

      {/* =========================================================================
          MODAL: WATCH DEMO VIDEO
      ========================================================================= */}
      {isVideoModalOpen && (
        <div className="airvix-modal-backdrop" onClick={() => setIsVideoModalOpen(false)}>
          <div className="airvix-video-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="airvix-modal-header">
              <h3>Airvix 1.4s Comment-to-DM Engine Walkthrough</h3>
              <button type="button" onClick={() => setIsVideoModalOpen(false)} aria-label="Close modal">
                <X size={20} />
              </button>
            </div>
            <div className="airvix-video-player-wrap">
              <video
                controls
                autoPlay
                className="airvix-video-tag"
                src="/Create_a_premium_cinematic_Saa.mp4"
                poster="/demo-poster.jpg"
              >
                Your browser does not support HTML5 video.
              </video>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: LEGAL & COMPLIANCE DOCUMENTS
      ========================================================================= */}
      {activeLegalDoc && (
        <div className="airvix-modal-backdrop" onClick={() => setActiveLegalDoc(null)}>
          <div className="airvix-legal-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="airvix-modal-header">
              <div className="airvix-legal-title-wrap">
                <FileText size={20} color="#3b82f6" />
                <h3>
                  {activeLegalDoc === 'privacy' && 'Airvix Privacy Policy & Data Security'}
                  {activeLegalDoc === 'terms' && 'Airvix Terms of Service'}
                  {activeLegalDoc === 'refund' && 'Airvix Refund & Cancellation Policy'}
                </h3>
              </div>
              <button type="button" onClick={() => setActiveLegalDoc(null)} aria-label="Close modal">
                <X size={20} />
              </button>
            </div>

            <div className="airvix-legal-content-body">
              {activeLegalDoc === 'privacy' && (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {siteSettings?.privacy_policy_text || (
                    `Airvix Privacy Policy & Meta Graph Compliance\n\n1. DATA COLLECTION & ISOLATION\nWe use the official Meta Graph API v22.0. Airvix never asks for your Instagram password.\n\n2. TOKEN ENCRYPTION\nAll OAuth access tokens are AES-256 encrypted at rest in high-security PostgreSQL.\n\n3. DPDP & GDPR COMPLIANCE\nYou retain 100% ownership of your data and can request deletion anytime at support@airvix.com.`
                  )}
                </div>
              )}

              {activeLegalDoc === 'terms' && (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {siteSettings?.terms_of_service_text || (
                    `Airvix Terms of Service\n\n1. ACCEPTANCE\nBy accessing Airvix, you agree to comply with Meta Platform Policies.\n\n2. FAIR USAGE\nYou agree not to distribute spam or violate Instagram Community Guidelines.\n\n3. SERVICE AVAILABILITY\nWe offer 99.9% uptime SLA powered by serverless cloud workers.`
                  )}
                </div>
              )}

              {activeLegalDoc === 'refund' && (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {siteSettings?.refund_policy_text || (
                    `Airvix Refund Policy\n\nWe provide a full 7-day unconditional money-back guarantee on all paid plans. If you are unsatisfied, email support@airvix.com for an immediate refund without questions asked.`
                  )}
                </div>
              )}
            </div>

            <div className="airvix-legal-footer">
              <button type="button" className="airvix-btn-primary" onClick={() => setActiveLegalDoc(null)}>
                Understood &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
