// frontend/src/components/LandingView.jsx
// Handcrafted, authentic SaaS Landing Page for Airvix — Color Harmony Light Theme
import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Sparkles, 
  CheckCircle2, 
  MessageSquare, 
  Film, 
  Clock, 
  ShieldCheck, 
  BarChart3, 
  ArrowRight, 
  Play, 
  ChevronDown, 
  Instagram, 
  Send,
  Layers,
  Heart,
  MessageCircle,
  HelpCircle,
  Check,
  Flame,
  TrendingUp,
  Sliders,
  RefreshCw,
  Copy,
  Smartphone,
  Shield,
  Eye,
  Bell
} from 'lucide-react';
import '../styles/landing.css';

export default function LandingView({ onNavigate, user }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // 'monthly' | 'annual'
  const [currency, setCurrency] = useState('USD'); // 'USD' | 'INR'
  const [siteSettings, setSiteSettings] = useState(null);

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

  // Interactive Live Demo State
  const [demoType, setDemoType] = useState('reel'); // 'reel' | 'story' | 'carousel'
  const [activeKeyword, setActiveKeyword] = useState('WORKBOOK');
  const [customInput, setCustomInput] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState(3); // 0: idle, 1: comment received, 2: jitter delay, 3: completed
  const [notificationVisible, setNotificationVisible] = useState(true);

  // Demo Scenarios
  const demoScenarios = {
    reel: {
      title: 'Specific Reel: 3 Habits that Saved Me 20h/Week',
      typeLabel: 'REEL AUTOMATION',
      views: '42.8K Views',
      mediaThumb: '🎬',
      caption: 'Stop trading time for money. Comment "WORKBOOK" and my system will drop the free Notion template into your DMs instantly 👇',
      keywords: ['WORKBOOK', 'PRICE', 'LINK'],
      commenter: 'sarah_creator',
      commentText: 'Commented: WORKBOOK please! 🙌',
      publicReplies: [
        '@sarah_creator Sent to your DMs! Check your inbox 🚀',
        '@sarah_creator Dropped the workbook link in your DMs! ✨',
        '@sarah_creator In your inbox now! Let me know if you like it 📩'
      ],
      dmContent: 'Hey Sarah! 🌟 Here is the 2026 Creator Productivity Workbook you asked for: https://airvix.com/dl/workbook-notion (Enjoy!)',
      delayMs: '1.4s'
    },
    story: {
      title: '24h Story: Flash Q&A & Discount Code',
      typeLabel: 'STORY REPLY',
      views: '3.4K Story Views',
      mediaThumb: '⏳',
      caption: 'Only 6 spots left for our April Creator Cohort! Reply "VIP" for the 30% discount link before this story disappears.',
      keywords: ['VIP', 'HI', 'INFO'],
      commenter: 'david_growth',
      commentText: 'Replied to your story: VIP discount please! 🔥',
      publicReplies: [
        'Direct story conversation started in DMs 💬'
      ],
      dmContent: 'Hey David! 🎉 Here is your exclusive 30% discount code for the April Cohort: VIP30 at checkout (Link: https://airvix.com/cohort-vip)',
      delayMs: '1.8s'
    },
    carousel: {
      title: 'Feed Carousel: 10 DM Scripts that Convert',
      typeLabel: 'CAROUSEL POST',
      views: '18.2K Impressions',
      mediaThumb: '📸',
      caption: 'Slide 10 has the exact follow-up framework. Comment "SCRIPTS" and I will send you the PDF cheat sheet directly.',
      keywords: ['SCRIPTS', 'FREE', 'CHEATSHEET'],
      commenter: 'alex_marketing',
      commentText: 'Commented: SCRIPTS 🚀',
      publicReplies: [
        '@alex_marketing Check your DMs! Sent the complete PDF cheatsheet 📄',
        '@alex_marketing Dropped in your inbox! Enjoy the scripts 💡'
      ],
      dmContent: 'Hey Alex! 🚀 Here is the 10 DM Conversion Scripts PDF Cheatsheet: https://airvix.com/dl/dm-scripts.pdf',
      delayMs: '2.1s'
    }
  };

  const currentScenario = demoScenarios[demoType];

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const triggerSimulation = (keyword) => {
    setActiveKeyword(keyword);
    setIsSimulating(true);
    setSimStep(1);
    setNotificationVisible(false);

    // Step 1: Received comment
    setTimeout(() => {
      setSimStep(2); // Human typing jitter delay
    }, 600);

    // Step 2: Completed public reply + outbound DM notification
    setTimeout(() => {
      setSimStep(3);
      setIsSimulating(false);
      setNotificationVisible(true);
    }, 1600);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    const kw = customInput.trim().toUpperCase();
    triggerSimulation(kw);
    setCustomInput('');
  };

  const faqs = [
    {
      q: "Can I set an automation for just ONE specific Reel without affecting others?",
      a: "Yes! That is one of Airvix's core superpowers. In the 'Content & Media' tab, you will see your uploaded Reels and Posts. Click '⚡ Automate this Reel' on any video, assign your keyword (like 'WORKBOOK' or 'PRICE'), and only comments on THAT specific Reel will trigger the link. Your other posts remain untouched."
    },
    {
      q: "How does Airvix prevent Instagram from flagging or shadowbanning my account?",
      a: "Three built-in safeguards protect your profile: 1) We use the official Meta Graph API v22.0 (no browser extensions or password sharing). 2) Human-Typing Jitter adds natural 2-5 second randomized delays so you never send robotic 0-second replies. 3) Comment Spinning lets you add multiple reply variations separated by '|', rotating each response so Meta never detects duplicate comments."
    },
    {
      q: "What happens when someone replies to my 24h Instagram Story?",
      a: "Airvix automatically inspects incoming Story replies. If the follower sends a keyword you defined (or common friendly greetings like 'HI' or 'HELLO'), Airvix instantly sends your automated DM while the follower is still engaged on Instagram."
    },
    {
      q: "Do I need to leave my laptop on or keep a browser tab open?",
      a: "No! Airvix runs 24/7 on high-availability serverless cloud workers. Once you set a rule, you can close your laptop, go to sleep, or film your next Reel. It continues running in real-time."
    },
    {
      q: "Is there a free plan to test this out?",
      a: "Yes. Our Free Starter plan gives you up to 50 automated DMs every month with full access to specific Reel and Story automations. No credit card is required to sign up."
    },
    {
      q: "Does this work on personal accounts or do I need a Creator / Business account?",
      a: "Meta requires Instagram accounts using the official Graph API to be set as a free Professional (Creator or Business) account connected to a Facebook Page. Switching takes under 60 seconds in the Instagram mobile app settings."
    }
  ];

  return (
    <div className="airvix-landing">
      {/* Subtle Architectural Dot Pattern */}
      <div className="lp-grid-pattern"></div>

      {/* Dynamic Announcement Banner (Managed by Admin) */}
      {siteSettings?.announcement_enabled && (
        <div style={{
          background: 'linear-gradient(90deg, #312e81 0%, #1e3a8a 50%, #4338ca 100%)',
          color: '#ffffff',
          padding: '8px 16px',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          position: 'relative',
          zIndex: 1000
        }}>
          {siteSettings.announcement_badge && (
            <span style={{
              background: '#2563eb',
              color: '#ffffff',
              fontSize: '10.5px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px',
              letterSpacing: '0.04em'
            }}>
              {siteSettings.announcement_badge}
            </span>
          )}
          <span>{siteSettings.announcement_text}</span>
          {siteSettings.announcement_link && (
            <a
              href={siteSettings.announcement_link}
              style={{
                color: '#93c5fd',
                textDecoration: 'underline',
                fontWeight: 700,
                marginLeft: '4px'
              }}
            >
              Explore Now →
            </a>
          )}
        </div>
      )}

      {/* Handcrafted Sticky Header */}
      <header className={`lp-navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="lp-container lp-nav-content">
          <a href="#" className="lp-logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <div className="lp-logo-wrap">
              <img 
                src="/airvix-mark.png" 
                alt="Airvix Logo Mark" 
                className="lp-logo-mark-img"
              />
              <span className="lp-logo-wordmark">airvix</span>
            </div>
            <span className="lp-logo-badge">v2.4</span>
          </a>

          <nav className="lp-nav-links">
            <a href="#how-it-works">How It Works</a>
            <a href="#live-studio">Live Interactive Demo</a>
            <a href="#features">Features</a>
            <a href="#comparison">Why Airvix</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="lp-nav-actions">
            {user ? (
              <button className="lp-btn lp-btn-solid" onClick={() => onNavigate('app')}>
                Open Dashboard <ArrowRight size={15} />
              </button>
            ) : (
              <>
                <button className="lp-btn lp-btn-ghost" onClick={() => onNavigate('auth-login')}>
                  Sign In
                </button>
                <button className="lp-btn lp-btn-solid" onClick={() => onNavigate('auth-signup')}>
                  Start Free <ArrowRight size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="lp-hero">
        <div className="lp-container">
          
          {/* Authentic Top Pill Announcement */}
          <div className="lp-announcement-pill">
            <span className="lp-announcement-tag">NEW</span>
            <span className="lp-announcement-text">Specific Reel Targeting & 24h Story Triggers are now live</span>
            <ArrowRight size={13} className="lp-announcement-arrow" />
          </div>

          <div className="lp-hero-headline-wrap">
            <h1 className="lp-hero-headline">
              {siteSettings?.hero_headline ? (
                <span>{siteSettings.hero_headline}</span>
              ) : (
                <>
                  When your Reel blows up,<br />
                  <span className="lp-headline-em">send the link in 1.4s.</span> Not 4 hours.
                </>
              )}
            </h1>
            <p className="lp-hero-subhead">
              {siteSettings?.hero_subtitle || `Stop losing sales because you couldn’t manually copy-paste links to 400 commenters. 
              Airvix automatically delivers your download links, course URLs, and discount codes into their DMs 
              while they’re still watching your Reel. 100% Meta compliant.`}
            </p>
          </div>

          <div className="lp-hero-actions">
            <button className="lp-btn lp-btn-hero-primary" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
              {siteSettings?.primary_cta_text || 'Get Started for Free'} <ArrowRight size={16} />
            </button>
            <a href="#live-studio" className="lp-btn lp-btn-hero-secondary">
              <Play size={14} fill="currentColor" /> See Live Simulation
            </a>
          </div>

          {/* Concrete Trust Metrics */}
          <div className="lp-hero-metrics">
            <div className="lp-metric-item">
              <div className="lp-metric-val">1.4s</div>
              <div className="lp-metric-label">Median DM delivery</div>
            </div>
            <div className="lp-metric-divider"></div>
            <div className="lp-metric-item">
              <div className="lp-metric-val">0</div>
              <div className="lp-metric-label">Account shadowbans</div>
            </div>
            <div className="lp-metric-divider"></div>
            <div className="lp-metric-item">
              <div className="lp-metric-val">4.2x</div>
              <div className="lp-metric-label">Link clicks vs "bio"</div>
            </div>
            <div className="lp-metric-divider"></div>
            <div className="lp-metric-item">
              <div className="lp-metric-val">100%</div>
              <div className="lp-metric-label">Official Meta Graph API</div>
            </div>
          </div>

          {/* Social Proof Strip with Real Creator Handles */}
          <div className="lp-proof-strip">
            <span className="lp-proof-label">Trusted by fast-growing creators & digital brands:</span>
            <div className="lp-proof-tags">
              <span className="lp-creator-tag">@thesolopreneur</span>
              <span className="lp-creator-tag">@fitnesswithmaya</span>
              <span className="lp-creator-tag">@growthclub.in</span>
              <span className="lp-creator-tag">@ecomdrops</span>
              <span className="lp-creator-tag">@minimalistcraft</span>
            </div>
          </div>

        </div>
      </section>

      {/* Interactive Creator Studio & Live Phone Simulator */}
      <section id="live-studio" className="lp-studio-section">
        <div className="lp-container">
          
          <div className="lp-section-intro">
            <div className="lp-kicker">Interactive Product Preview</div>
            <h2 className="lp-section-heading">Watch how a viewer gets your link in real time</h2>
            <p className="lp-section-sub">
              Pick a trigger scenario below. See the exact follower experience on Instagram on the left, 
              and how Airvix handles comment rotation, jitter, and safety on the right.
            </p>
          </div>

          {/* Scenario Selector Tabs */}
          <div className="lp-scenario-tabs">
            <button 
              className={`lp-scenario-tab ${demoType === 'reel' ? 'active' : ''}`}
              onClick={() => { setDemoType('reel'); triggerSimulation('WORKBOOK'); }}
            >
              <Film size={16} /> Specific Reel Automation
            </button>
            <button 
              className={`lp-scenario-tab ${demoType === 'story' ? 'active' : ''}`}
              onClick={() => { setDemoType('story'); triggerSimulation('VIP'); }}
            >
              <Clock size={16} /> 24h Story Auto-Reply
            </button>
            <button 
              className={`lp-scenario-tab ${demoType === 'carousel' ? 'active' : ''}`}
              onClick={() => { setDemoType('carousel'); triggerSimulation('SCRIPTS'); }}
            >
              <MessageSquare size={16} /> Carousel / Post Comment-to-DM
            </button>
          </div>

          {/* Interactive Workspace Split */}
          <div className="lp-studio-workspace">
            
            {/* Left Column: Handcrafted Instagram Phone Screen */}
            <div className="lp-device-frame">
              <div className="lp-device-notch"></div>
              
              {/* Instagram Top Bar */}
              <div className="lp-ig-header">
                <div className="lp-ig-creator">
                  <div className="lp-ig-avatar">A</div>
                  <div>
                    <div className="lp-ig-handle">
                      @yourcreatorbrand <span className="lp-ig-badge">✓</span>
                    </div>
                    <div className="lp-ig-subtext">{currentScenario.views}</div>
                  </div>
                </div>
                <Instagram size={18} className="lp-ig-icon" />
              </div>

              {/* Reel Media Video Card / Poster */}
              <div className="lp-reel-canvas">
                <div className="lp-reel-tag">
                  <span>{currentScenario.mediaThumb} {currentScenario.typeLabel}</span>
                </div>
                <div className="lp-reel-overlay-content">
                  <p className="lp-reel-caption-text">{currentScenario.caption}</p>
                </div>
              </div>

              {/* Live Comments Drawer */}
              <div className="lp-comments-drawer">
                <div className="lp-drawer-header">
                  <span>Comments & Activity</span>
                  <span className="lp-drawer-count">342 comments</span>
                </div>

                {/* Follower Inbound Comment */}
                <div className={`lp-comment-row ${simStep >= 1 ? 'revealed' : ''}`}>
                  <div className="lp-user-avatar">S</div>
                  <div className="lp-comment-bubble">
                    <div className="lp-comment-user">@{currentScenario.commenter}</div>
                    <div className="lp-comment-msg">
                      Commented: <b>"{activeKeyword}"</b> {activeKeyword === 'WORKBOOK' ? '🙌' : '🚀'}
                    </div>
                  </div>
                  <div className="lp-comment-time">Just now</div>
                </div>

                {/* Creator Public Automated Reply (Spinning) */}
                <div className={`lp-comment-row reply-row ${simStep >= 3 ? 'revealed' : ''}`}>
                  <div className="lp-user-avatar creator-avatar">A</div>
                  <div className="lp-comment-bubble reply-bubble">
                    <div className="lp-comment-user">
                      @yourcreatorbrand <span className="lp-author-tag">Author</span>
                    </div>
                    <div className="lp-comment-msg">
                      {currentScenario.publicReplies[0]}
                    </div>
                  </div>
                  <div className="lp-comment-badge">Auto-Replied</div>
                </div>
              </div>

              {/* Sliding iOS Push Notification Preview for Outbound DM */}
              <div className={`lp-ios-notification ${notificationVisible && simStep >= 3 ? 'show' : ''}`}>
                <div className="lp-ios-notif-header">
                  <div className="lp-ios-app-icon">
                    <Instagram size={12} color="#ffffff" />
                  </div>
                  <span className="lp-ios-app-name">INSTAGRAM • DIRECT</span>
                  <span className="lp-ios-time">now</span>
                </div>
                <div className="lp-ios-notif-body">
                  <div className="lp-ios-notif-title">@yourcreatorbrand sent you a link</div>
                  <div className="lp-ios-notif-text">{currentScenario.dmContent}</div>
                </div>
              </div>

              {/* Phone Footer Action Bar */}
              <div className="lp-phone-bar">
                <div className="lp-active-trigger-chip">
                  Trigger: <b>{activeKeyword}</b>
                </div>
                <div className="lp-delivery-badge">
                  <CheckCircle2 size={12} color="#059669" /> Delivered in {currentScenario.delayMs}
                </div>
              </div>

            </div>

            {/* Right Column: Handcrafted Airvix Control Deck */}
            <div className="lp-console-frame">
              <div className="lp-console-top">
                <div className="lp-console-title">
                  <Sliders size={16} color="#2563EB" />
                  <span>Airvix Engine Inspector</span>
                </div>
                <div className="lp-status-indicator">
                  <span className="lp-pulse-green"></span> Live Running
                </div>
              </div>

              <div className="lp-console-card">
                <div className="lp-console-field-label">Target Media Item</div>
                <div className="lp-console-target-box">
                  <div className="lp-target-badge">{currentScenario.mediaThumb}</div>
                  <div>
                    <div className="lp-target-title">{currentScenario.title}</div>
                    <div className="lp-target-meta">Specific ID: med_9824 • Type: {demoType.toUpperCase()}</div>
                  </div>
                </div>
              </div>

              {/* Keyword Quick-Select Chips */}
              <div className="lp-console-card">
                <div className="lp-console-field-label">Test Trigger Keywords (Click to test):</div>
                <div className="lp-keyword-chips">
                  {currentScenario.keywords.map((kw) => (
                    <button 
                      key={kw}
                      className={`lp-kw-btn ${activeKeyword === kw ? 'active' : ''}`}
                      onClick={() => triggerSimulation(kw)}
                    >
                      "{kw}" {activeKeyword === kw ? '⚡ Active' : ''}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleCustomSubmit} className="lp-custom-kw-form">
                  <input 
                    type="text" 
                    className="lp-custom-kw-input"
                    placeholder="Or type custom word (e.g. DISCOUNT, FREE)..."
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                  />
                  <button type="submit" className="lp-btn lp-btn-test">
                    Test Trigger <Send size={13} />
                  </button>
                </form>
              </div>

              {/* Safety & Safeguard Engine Telemetry */}
              <div className="lp-telemetry-box">
                <div className="lp-telemetry-item">
                  <div className="lp-telemetry-icon">
                    <Clock size={16} color="#0284C7" />
                  </div>
                  <div>
                    <div className="lp-telemetry-label">Human-Typing Jitter</div>
                    <div className="lp-telemetry-val">
                      {isSimulating ? 'Applying 1.8s natural human delay...' : '1.4s - 2.8s randomized delay active'}
                    </div>
                  </div>
                </div>

                <div className="lp-telemetry-item">
                  <div className="lp-telemetry-icon">
                    <RefreshCw size={16} color="#4F46E5" />
                  </div>
                  <div>
                    <div className="lp-telemetry-label">Anti-Spam Comment Rotation</div>
                    <div className="lp-telemetry-val">
                      3 variations spinning via <code>Check DM! | Sent it! | In your inbox!</code>
                    </div>
                  </div>
                </div>

                <div className="lp-telemetry-item">
                  <div className="lp-telemetry-icon">
                    <ShieldCheck size={16} color="#059669" />
                  </div>
                  <div>
                    <div className="lp-telemetry-label">Meta Policy Compliance</div>
                    <div className="lp-telemetry-val">
                      Standard 24-hour messaging window enforced • Zero password sharing
                    </div>
                  </div>
                </div>
              </div>

              <div className="lp-console-cta">
                <button className="lp-btn lp-btn-hero-primary lp-btn-block" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
                  Set this up for your account in 60 seconds <ArrowRight size={15} />
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* The Problem & Solution: "Before vs After" */}
      <section id="comparison" className="lp-compare-section">
        <div className="lp-container">
          
          <div className="lp-section-intro">
            <div className="lp-kicker">The Reality of Running an Instagram Brand</div>
            <h2 className="lp-section-heading">Why "Link in Bio" is killing your conversion rate</h2>
            <p className="lp-section-sub">
              Asking a viewer to leave the Reel, tap your profile, click your link-tree, and hunt for your product has an 88% drop-off rate. 
              Here is what happens when you automate the DM instead.
            </p>
          </div>

          <div className="lp-compare-grid">
            
            {/* The Old Manual Way */}
            <div className="lp-compare-card old-way">
              <div className="lp-compare-badge old-badge">❌ THE OLD MANUAL WAY</div>
              <h3 className="lp-compare-title">Endless manual copy-pasting</h3>
              <ul className="lp-compare-list">
                <li>
                  <span className="lp-cross">✕</span>
                  <div>
                    <b>You wake up to 350 comments</b> asking for the link, feeling guilty and overwhelmed.
                  </div>
                </li>
                <li>
                  <span className="lp-cross">✕</span>
                  <div>
                    <b>You spend 3 hours</b> copying links from your Notes app until your thumbs ache.
                  </div>
                </li>
                <li>
                  <span className="lp-cross">✕</span>
                  <div>
                    <b>Instagram hits you with an "Action Blocked"</b> warning for repetitive manual actions.
                  </div>
                </li>
                <li>
                  <span className="lp-cross">✕</span>
                  <div>
                    <b>70% of potential buyers</b> have already closed the app and forgotten why they cared.
                  </div>
                </li>
              </ul>
            </div>

            {/* The Airvix Way */}
            <div className="lp-compare-card new-way">
              <div className="lp-compare-badge new-badge">⚡ WITH AIRVIX</div>
              <h3 className="lp-compare-title">Zero friction. Instant delivery.</h3>
              <ul className="lp-compare-list">
                <li>
                  <span className="lp-check">✓</span>
                  <div>
                    <b>Set your keyword once</b> in 30 seconds before publishing your Reel.
                  </div>
                </li>
                <li>
                  <span className="lp-check">✓</span>
                  <div>
                    <b>Commenter gets the link in 1.4 seconds</b> while their buying curiosity is at 100%.
                  </div>
                </li>
                <li>
                  <span className="lp-check">✓</span>
                  <div>
                    <b>Comment spinning & jitter</b> keep your account safe, healthy, and ban-free.
                  </div>
                </li>
                <li>
                  <span className="lp-check">✓</span>
                  <div>
                    <b>You sleep soundly</b> while your automations convert viewers into leads, buyers, and bookings.
                  </div>
                </li>
              </ul>
            </div>

          </div>

        </div>
      </section>

      {/* Features Built for Real Creators */}
      <section id="features" className="lp-features-section">
        <div className="lp-container">
          
          <div className="lp-section-intro">
            <div className="lp-kicker">Built for Creators, Not Corporate Enterprise</div>
            <h2 className="lp-section-heading">Every tool you need to turn attention into revenue</h2>
            <p className="lp-section-sub">
              No bloated flowcharts, no confusing enterprise onboarding calls. Just clean, reliable automations that work out of the box.
            </p>
          </div>

          <div className="lp-real-features-grid">
            
            <div className="lp-feat-item">
              <div className="lp-feat-header">
                <div className="lp-feat-icon">
                  <Film size={22} />
                </div>
                <div className="lp-feat-tag">Most Requested</div>
              </div>
              <h4>Specific Reel Targeting</h4>
              <p>
                Browse your top 30 uploaded Reels directly in the Content Hub. Attach different keywords and links to different reels so followers never get the wrong offer.
              </p>
            </div>

            <div className="lp-feat-item">
              <div className="lp-feat-header">
                <div className="lp-feat-icon">
                  <Clock size={22} />
                </div>
                <div className="lp-feat-tag">High Converting</div>
              </div>
              <h4>24h Story Auto-Capture</h4>
              <p>
                Turn ephemeral story reactions into lasting sales relationships. Automatically reply when someone responds to your story or types keywords like "VIP" or "INFO".
              </p>
            </div>

            <div className="lp-feat-item">
              <div className="lp-feat-header">
                <div className="lp-feat-icon">
                  <RefreshCw size={22} />
                </div>
                <div className="lp-feat-tag">Ban Protection</div>
              </div>
              <h4>Multi-Comment Rotation</h4>
              <p>
                Meta detects spam when accounts post identical public replies. Separate your replies with <code>|</code> to cycle through unlimited friendly variations automatically.
              </p>
            </div>

            <div className="lp-feat-item">
              <div className="lp-feat-header">
                <div className="lp-feat-icon">
                  <ShieldCheck size={22} />
                </div>
                <div className="lp-feat-tag">Meta Compliant</div>
              </div>
              <h4>Human-Typing Jitter</h4>
              <p>
                Instant 0.01s bot replies trigger algorithm flags. Airvix introduces natural 2-5 second randomized delays so Meta servers recognize you as a normal human creator.
              </p>
            </div>

            <div className="lp-feat-item">
              <div className="lp-feat-header">
                <div className="lp-feat-icon">
                  <BarChart3 size={22} />
                </div>
                <div className="lp-feat-tag">Lead Tracking</div>
              </div>
              <h4>Unified Creator CRM</h4>
              <p>
                View all commenter handles, profile pictures, and sent messages in a fast unified inbox. Know exactly who converted and which keyword performed best.
              </p>
            </div>

            <div className="lp-feat-item">
              <div className="lp-feat-header">
                <div className="lp-feat-icon">
                  <Layers size={22} />
                </div>
                <div className="lp-feat-tag">Agency Ready</div>
              </div>
              <h4>Multi-Account Switching</h4>
              <p>
                Manage your personal brand alongside client accounts or multiple niche themes. Switch accounts in 1 click with isolated rules, stats, and queues.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* Simple 3-Step Workflow */}
      <section id="how-it-works" className="lp-workflow-section">
        <div className="lp-container">
          
          <div className="lp-section-intro">
            <div className="lp-kicker">Zero Technical Setup</div>
            <h2 className="lp-section-heading">How to set up your first automation in 60s</h2>
          </div>

          <div className="lp-steps-container">
            <div className="lp-step-box">
              <div className="lp-step-num">1</div>
              <h4>Connect Instagram</h4>
              <p>Log in with official Meta OAuth in 1 click. No passwords shared, ever.</p>
            </div>

            <div className="lp-step-arrow">→</div>

            <div className="lp-step-box">
              <div className="lp-step-num">2</div>
              <h4>Pick your Reel or Story</h4>
              <p>Choose the video from your top 30 media feed in the Content Hub.</p>
            </div>

            <div className="lp-step-arrow">→</div>

            <div className="lp-step-box">
              <div className="lp-step-num">3</div>
              <h4>Set Keyword & Link</h4>
              <p>Type your trigger (e.g. "LINK") and your DM message. You're done!</p>
            </div>
          </div>

        </div>
      </section>

      {/* Maker's Note / Authenticity Section */}
      <section className="lp-maker-section">
        <div className="lp-container">
          <div className="lp-maker-card">
            <div className="lp-maker-quote-icon">“</div>
            <p className="lp-maker-text">
              We built Airvix because we were genuinely tired of waking up to 200 unread comments, 
              spending all morning copy-pasting links into DMs, and losing sales while our Reels were going viral. 
              You don’t need an enterprise sales CRM with 40 sub-menus. You just need your links delivered 
              to your viewers immediately without getting banned. That’s what Airvix does.
            </p>
            <div className="lp-maker-footer">
              <div className="lp-maker-avatar">
                <img src="/airvix-mark.png" alt="Airvix" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
              </div>
              <div>
                <div className="lp-maker-name">The Airvix Engineering Team</div>
                <div className="lp-maker-title">Built by creators for creators • Meta Graph API Certified</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Honest, Transparent Pricing */}
      <section id="pricing" className="lp-pricing-section">
        <div className="lp-container">
          
          <div className="lp-section-intro">
            <div className="lp-kicker">Simple, Transparent Pricing</div>
            <h2 className="lp-section-heading">Start free, upgrade when you go viral</h2>
            <p className="lp-section-sub">
              No hidden fees, no per-follower charges. Cancel anytime with 1 click.
            </p>

            {/* Currency and Billing Controls */}
            <div className="lp-pricing-controls">
              <div className="lp-toggle-pill">
                <button 
                  className={billingPeriod === 'monthly' ? 'active' : ''} 
                  onClick={() => setBillingPeriod('monthly')}
                >
                  Monthly
                </button>
                <button 
                  className={billingPeriod === 'annual' ? 'active' : ''} 
                  onClick={() => setBillingPeriod('annual')}
                >
                  Annual <span className="lp-discount-badge">Save 20%</span>
                </button>
              </div>

              <div className="lp-currency-pill">
                <button 
                  className={currency === 'USD' ? 'active' : ''} 
                  onClick={() => setCurrency('USD')}
                >
                  $ USD
                </button>
                <button 
                  className={currency === 'INR' ? 'active' : ''} 
                  onClick={() => setCurrency('INR')}
                >
                  ₹ INR
                </button>
              </div>
            </div>
          </div>

          <div className="lp-pricing-deck">
            
            {/* Tier 1: Free Starter */}
            <div className="lp-price-card">
              <div className="lp-tier-name">Free Starter</div>
              <div className="lp-tier-desc">Test automations on your next Reel</div>
              
              <div className="lp-price-amount">
                <span className="lp-price-val">{currency === 'USD' ? '$0' : '₹0'}</span>
                <span className="lp-price-period">/ forever</span>
              </div>

              <ul className="lp-tier-features">
                <li><Check size={16} color="#059669" /> <b>50 automated DMs</b> / month</li>
                <li><Check size={16} color="#059669" /> 1 Instagram Account</li>
                <li><Check size={16} color="#059669" /> Specific Reel Automations</li>
                <li><Check size={16} color="#059669" /> Story Reply Detection</li>
                <li><Check size={16} color="#059669" /> Official Meta API Compliance</li>
              </ul>

              <button className="lp-btn lp-btn-outline lp-btn-block" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
                Start Free Forever
              </button>
            </div>

            {/* Tier 2: Creator Pro (Featured) */}
            <div className="lp-price-card featured">
              <div className="lp-featured-banner">MOST POPULAR</div>
              <div className="lp-tier-name">Creator Pro</div>
              <div className="lp-tier-desc">For active creators, coaches & brands</div>
              
              <div className="lp-price-amount">
                <span className="lp-price-val">
                  {currency === 'USD' 
                    ? (billingPeriod === 'monthly' ? '$19' : '$15')
                    : (billingPeriod === 'monthly' ? '₹1,499' : '₹1,199')}
                </span>
                <span className="lp-price-period">/ month</span>
              </div>

              <ul className="lp-tier-features">
                <li><Check size={16} color="#059669" /> <b>1,000 automated DMs</b> / month</li>
                <li><Check size={16} color="#059669" /> Unlimited Active Automation Rules</li>
                <li><Check size={16} color="#059669" /> Specific Reel & Post Targeting</li>
                <li><Check size={16} color="#059669" /> 24h Story Auto-Replies</li>
                <li><Check size={16} color="#059669" /> Multi-Comment Spinning (Anti-Spam)</li>
                <li><Check size={16} color="#059669" /> Human Typing Jitter Delay</li>
                <li><Check size={16} color="#059669" /> Unified Creator CRM & Analytics</li>
              </ul>

              <button className="lp-btn lp-btn-hero-primary lp-btn-block" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
                Get Creator Pro <ArrowRight size={15} />
              </button>
            </div>

            {/* Tier 3: Growth / Agency */}
            <div className="lp-price-card">
              <div className="lp-tier-name">Agency & Scale</div>
              <div className="lp-tier-desc">For multiple accounts & high volume</div>
              
              <div className="lp-price-amount">
                <span className="lp-price-val">
                  {currency === 'USD' 
                    ? (billingPeriod === 'monthly' ? '$49' : '$39')
                    : (billingPeriod === 'monthly' ? '₹3,999' : '₹3,199')}
                </span>
                <span className="lp-price-period">/ month</span>
              </div>

              <ul className="lp-tier-features">
                <li><Check size={16} color="#059669" /> <b>5,000 automated DMs</b> / month</li>
                <li><Check size={16} color="#059669" /> Up to 5 Instagram Accounts</li>
                <li><Check size={16} color="#059669" /> Priority Webhook Queue Processing</li>
                <li><Check size={16} color="#059669" /> Export Contacts & CSV Reports</li>
                <li><Check size={16} color="#059669" /> Dedicated Priority Support</li>
              </ul>

              <button className="lp-btn lp-btn-outline lp-btn-block" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
                Start Agency Trial
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* Creator FAQ Accordion */}
      <section id="faq" className="lp-faq-section">
        <div className="lp-container lp-faq-container">
          
          <div className="lp-section-intro">
            <div className="lp-kicker">Got Questions?</div>
            <h2 className="lp-section-heading">Frequently Asked Questions</h2>
            <p className="lp-section-sub">
              Everything you need to know about safety, setup, and features.
            </p>
          </div>

          <div className="lp-faq-accordion">
            {faqs.map((faq, idx) => (
              <div 
                key={idx} 
                className={`lp-faq-row ${expandedFaq === idx ? 'expanded' : ''}`}
                onClick={() => setExpandedFaq(expandedFaq === idx ? -1 : idx)}
              >
                <div className="lp-faq-question">
                  <span>{faq.q}</span>
                  <ChevronDown size={18} className="lp-faq-chevron" />
                </div>
                {expandedFaq === idx && (
                  <div className="lp-faq-answer">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="lp-bottom-cta">
        <div className="lp-container">
          <div className="lp-bottom-cta-inner">
            <h2>Ready to automate your next viral Reel?</h2>
            <p>
              Join 1,400+ creators who deliver their links on autopilot. Set up in under 60 seconds.
            </p>
            <div className="lp-bottom-actions">
              <button className="lp-btn lp-btn-hero-primary lp-btn-lg" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
                Start Free — No Credit Card <ArrowRight size={16} />
              </button>
            </div>
            <div className="lp-guarantee-note">
              🛡️ 100% Meta Graph API Compliant • 0 Passwords Shared • Cancel Anytime
            </div>
          </div>
        </div>
      </section>

      {/* Human-Crafted Footer */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-content">
          <div className="lp-footer-left">
            <div className="lp-footer-brand">
              <img 
                src="/airvix-mark.png" 
                alt="Airvix" 
                style={{ height: '28px', width: 'auto', objectFit: 'contain' }} 
              />
              <span className="lp-footer-brandname">airvix</span>
            </div>
            <p className="lp-footer-desc">
              The high-converting Instagram DM & Reel automation platform for modern creators and digital brands.
            </p>
            <div className="lp-footer-copyright">
              © {new Date().getFullYear()} Airvix Inc. Built for creators with craft & care.
            </div>
          </div>

          <div className="lp-footer-links-group">
            <div className="lp-footer-col">
              <h5>Product</h5>
              <a href="#how-it-works">How It Works</a>
              <a href="#features">Reel Automations</a>
              <a href="#live-studio">Interactive Demo</a>
              <a href="#pricing">Pricing</a>
            </div>

            <div className="lp-footer-col">
              <h5>Safety & Meta</h5>
              <a href="#faq">Meta API Compliance</a>
              <a href="#features">Comment Spinning</a>
              <a href="#features">Human Jitter</a>
              <a href="#faq">Terms of Service</a>
            </div>

            <div className="lp-footer-col">
              <h5>Account</h5>
              <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('auth-login'); }}>Sign In</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('auth-signup'); }}>Create Free Account</a>
              <a href="#admin-login" onClick={(e) => { e.preventDefault(); onNavigate('admin-login'); }} style={{ opacity: 0.6, fontSize: '12px' }}>🛡️ Staff Portal</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
