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

// Detailed Knowledge, Feature & Legal Documentation Directory
const CONTENT_DOCS = {
  // Product Features
  'comment-engine': {
    title: 'Comment-to-DM Engine',
    badge: 'Core Technology • Queue-Backed Execution',
    sections: [
      {
        heading: 'Reliable Automated Lead Delivery',
        text: 'When an Instagram user comments on your post or reel with your trigger keyword (e.g. "LINK", "WORKBOOK", "PRICE"), our Meta Webhook engine ingests the event immediately. Our background queue processes and dispatches your automated DM with natural response pacing, ensuring steady throughput and Meta compliance.'
      },
      {
        heading: 'Dual-Action Algorithm Velocity Surge',
        text: 'Airvix not only delivers the private DM, but also immediately posts a randomized public comment reply (e.g. "Check your DMs! Just sent the link to you 🚀"). This rapid engagement surge signals to Instagram\'s recommendation algorithm that your post has massive viral traction, pushing your Reel onto the Explore page.'
      },
      {
        heading: 'Key Capabilities',
        list: [
          'Zero manual copy-pasting links for hours when your Reel goes viral',
          'Converts followers while they are still watching and emotionally engaged with your Reel',
          'Works across all Instagram post formats: Reels, Single Photos, Carousels, and Live Videos',
          'Granular keyword matching: Exact match, contains keyword, or reply to all comments'
        ]
      }
    ],
    ctaText: 'Start Automating Comments',
    ctaAction: 'signup'
  },
  'story-replies': {
    title: '24h Story Auto-Replies & Mentions',
    badge: 'Engagement Automation',
    sections: [
      {
        heading: 'Monetize Disappearing 24h Stories',
        text: 'Instagram Stories carry the highest buying intent of any social format. With Airvix Story Automation, whenever a viewer replies to your story or responds to a Question Sticker, Airvix automatically sends your pre-configured response and link without keeping your fans waiting.'
      },
      {
        heading: 'Instant Story Mention Rewards',
        text: 'Turn fan appreciation into customer loyalty. When someone tags @yourhandle in their story, Airvix automatically catches the webhook and sends an instant thank-you DM with an exclusive discount code or secret resource.'
      }
    ],
    ctaText: 'Activate Story Automation',
    ctaAction: 'signup'
  },
  'human-jitter': {
    title: 'Anti-Spam Human Jitter Protection',
    badge: 'Account Safety & Compliance',
    sections: [
      {
        heading: 'Why Many Accounts Get Banned by Bad Bots',
        text: 'Typical automation tools fire 300 identical messages in 10 seconds at exact 500ms intervals. Instagram\'s abuse filters immediately detect this robotic pattern, resulting in temporary action blocks or shadowbans.'
      },
      {
        heading: 'The Airvix Natural Pacing & Queue Architecture',
        text: 'Airvix introduces configurable random processing delays (5s–30s) and per-account rate limiting for outgoing direct messages and public replies. This controlled pacing eliminates traffic spikes and respects Meta Graph API platform limits.'
      },
      {
        heading: 'Guaranteed Protection Specs',
        list: [
          'Configurable random response delay (5s – 30s)',
          'Strict compliance with Meta Graph API rate limits (per-account concurrency limits)',
          'Automatic queue throttling during viral surges to protect account reputation'
        ]
      }
    ],
    ctaText: 'Protect Your Account',
    ctaAction: 'signup'
  },
  'follow-unlock': {
    title: 'Follow-to-Unlock Protection',
    badge: 'Audience Growth Tool',
    sections: [
      {
        heading: 'Turn Casual Commenters into Permanent Followers',
        text: 'Viral reels often attract thousands of comments from non-followers who grab your free resource and vanish. Follow-to-Unlock completely solves this leak in your funnel.'
      },
      {
        heading: 'Smart Verification Flow',
        text: 'When a user comments on your post, Airvix checks if they are currently following your account. If they are already a follower, they get the link instantly. If not, Airvix sends a friendly prompt: "Hey! Tap Follow on our profile to unlock your exclusive link 🚀". Once they follow, the secret link or promo code is automatically released!'
      }
    ],
    ctaText: 'Grow Your Followers Now',
    ctaAction: 'signup'
  },
  'dm-cards': {
    title: 'Interactive DM Cards & Buttons',
    badge: 'Conversion Booster',
    sections: [
      {
        heading: 'Rich Visual Link Previews',
        text: 'Plain text URLs get lost in Instagram DMs. Airvix formats high-converting visual cards directly inside Instagram Direct Messages, complete with custom image thumbnails, compelling headlines, subtext, and native tap buttons.'
      },
      {
        heading: 'One-Tap Action Buttons',
        list: [
          'External URL buttons (e.g. "Buy Course for ₹1,499", "View Product", "Book Call")',
          'Multiple option quick-reply buttons (e.g. "Pricing", "Features", "Talk to Human")',
          'Real-time link click-through rate (CTR) tracking in your Airvix dashboard'
        ]
      }
    ],
    ctaText: 'Build Interactive DM Cards',
    ctaAction: 'signup'
  },
  'spintax': {
    title: 'Smart Template Spintax & Variations',
    badge: 'AI Natural Variety',
    sections: [
      {
        heading: 'Never Send Repetitive Text Again',
        text: 'Using our visual template editor, you can define dynamic spintax syntax: {Hey|Hi|Hello} {friend|creator}! {Here is your requested link|Check out the resource below|Just sent over your file}: [LINK].'
      },
      {
        heading: 'Seamless Permutations',
        text: 'Airvix dynamically generates hundreds of unique message combinations for both public comments and direct messages, ensuring no two interactions look identical to Instagram spam scanners.'
      }
    ],
    ctaText: 'Explore Template Library',
    ctaAction: 'signup'
  },
  'multi-account': {
    title: 'Multi-Account Growth Hub',
    badge: 'Scale Architecture',
    sections: [
      {
        heading: 'Manage Up to 50 Profiles Under One Roof',
        text: 'Connect multiple Instagram creator and business accounts without logging out. Perfect for agencies, multi-brand founders, and e-commerce companies managing regional accounts.'
      },
      {
        heading: 'Strict Data Isolation',
        text: 'Each connected Instagram account operates in an isolated workspace with its own triggers, rules, templates, analytics, and webhook queues.'
      }
    ],
    ctaText: 'View Multi-Account Plans',
    ctaAction: 'pricing'
  },
  // Solutions
  'solution-creators': {
    title: 'Airvix for Content Creators & Influencers',
    badge: 'Creator Monetization',
    sections: [
      {
        heading: 'Monetize While You Sleep',
        text: 'You spent hours creating a viral Reel that blew up overnight with 2,000 comments saying "link please". By the time you wake up, viewer buying intent has cooled down. Airvix reliably queues and delivers your digital products, preset downloads, and affiliate links in the background while viewer interest is high.'
      },
      {
        heading: 'Creator Case Studies',
        text: 'Creators using Airvix report an average 3.8x increase in digital product sales and an instant 40% growth in follower acquisition from Reels.'
      }
    ],
    ctaText: 'Start Free Creator Trial',
    ctaAction: 'signup'
  },
  'solution-d2c': {
    title: 'Airvix for D2C Brands & E-commerce',
    badge: 'Commerce Growth',
    sections: [
      {
        heading: 'Turn "Price?" Comments into Checkout Carts',
        text: 'D2C fashion, beauty, electronics, and food brands receive hundreds of pricing inquiries on post comments daily. Airvix sends instant product links with dynamic coupon codes directly into buyer DMs, cutting friction and preventing drop-offs.'
      },
      {
        heading: 'Track Conversion Funnels',
        text: 'Integrate with your Shopify or WooCommerce store. View exactly how many orders were generated by Instagram DM automation in your Airvix dashboard.'
      }
    ],
    ctaText: 'Boost D2C Sales',
    ctaAction: 'signup'
  },
  'solution-agencies': {
    title: 'Airvix for Social Media Agencies',
    badge: 'Agency Platform',
    sections: [
      {
        heading: 'Deliver Unbeatable ROI to Your Clients',
        text: 'Offer high-ticket Instagram automation services to your agency clients. Manage multiple brands with multi-tenant workspaces, branded PDF export reports, and team collaboration access.'
      },
      {
        heading: 'Client Access Controls',
        text: 'Give your clients read-only or editor access to their specific workspace while keeping all other agency accounts strictly private.'
      }
    ],
    ctaText: 'Explore Agency Plans',
    ctaAction: 'pricing'
  },
  'solution-coaches': {
    title: 'Airvix for Coaches & Course Sellers',
    badge: 'High-Ticket Leads',
    sections: [
      {
        heading: 'Automate Lead Magnet Delivery & Call Bookings',
        text: 'Post Reels teaching high-value strategies and ask viewers to comment "SCALE" or "BOOK". Airvix delivers your free training video and directly books discovery calls onto your Google Calendar or Calendly.'
      }
    ],
    ctaText: 'Automate Course Sales',
    ctaAction: 'signup'
  },
  'solution-events': {
    title: 'Airvix for Event & Webinar Organizers',
    badge: 'Event Registration',
    sections: [
      {
        heading: 'Instant Ticket Links & Reminder Dispatch',
        text: 'Sell out webinars, live workshops, and offline conferences by converting Instagram buzz into direct ticket registrations. Deliver venue passes and calendar invites directly to attendee DMs.'
      }
    ],
    ctaText: 'Supercharge Event Sales',
    ctaAction: 'signup'
  },
  'solution-workspaces': {
    title: 'Agency Client Workspaces & Multi-Tenancy',
    badge: 'Enterprise Security',
    sections: [
      {
        heading: 'Strict Multi-Tenant Isolation',
        text: 'Every workspace is logically isolated in high-availability PostgreSQL. User A can never query, see, or modify Client B\'s data or Instagram webhooks.'
      }
    ],
    ctaText: 'View Workspace Architecture',
    ctaAction: 'pricing'
  },
  'solution-enterprise': {
    title: 'White-Label Enterprise & Custom SLA',
    badge: 'Enterprise Scale',
    sections: [
      {
        heading: 'Custom Volumes & Dedicated Infrastructure',
        text: 'For high-volume media houses and enterprise brands processing over 250,000 DMs monthly. Includes dedicated webhook IPs, custom Meta App review guidance, and a guaranteed 99.99% uptime SLA with 24/7 phone support.'
      }
    ],
    ctaText: 'Contact Enterprise Sales',
    ctaAction: 'pricing'
  },
  // Resources & Guides
  'how-it-works-guide': {
    title: 'How Airvix Works: 3-Minute Quickstart',
    badge: 'Quickstart Guide',
    sections: [
      {
        heading: '3 Simple Steps to Full Automation',
        list: [
          'Step 1: Connect your Instagram Professional (Creator/Business) account via official Meta OAuth in 2 clicks.',
          'Step 2: Create your automation rule — select keyword triggers (e.g. "LINK"), customize your DM message, and attach button links.',
          'Step 3: Publish your Reel with a CTA like "Comment LINK below", and watch Airvix automatically handle every single comment in real time.'
        ]
      }
    ],
    ctaText: 'Set Up Your First Automation',
    ctaAction: 'signup'
  },
  'meta-safety': {
    title: 'Meta API Safety & Account Protection Guide',
    badge: 'Official Compliance',
    sections: [
      {
        heading: 'Why Airvix is 100% Safe for Your Instagram Account',
        text: 'Airvix is engineered exclusively on official Meta Graph API v22.0 webhooks. Unlike risky scraping tools, we NEVER ask for your Instagram password, never emulate mobile devices, and never violate Instagram Terms of Service.'
      },
      {
        heading: 'Official Meta Security Checklist',
        list: [
          'Official Meta OAuth 2.0 login authentication',
          'Encrypted token storage with AES-256-GCM',
          'Automatic rate-limiting compliance (200 API calls per hour ceiling)',
          'Zero risk of shadowbans or temporary account locks'
        ]
      }
    ],
    ctaText: 'Connect Safely with Meta API',
    ctaAction: 'signup'
  },
  'reel-checklist': {
    title: 'The 7-Step Viral Reel Engagement Blueprint',
    badge: 'Creator Playbook',
    sections: [
      {
        heading: 'How Top Indian Creators Generate 10,000+ Comments',
        text: 'Follow this exact 7-step formula used by top creators to turn casual viewers into paying customers:'
      },
      {
        heading: 'Actionable Step-by-Step Blueprint',
        list: [
          '1. Hook in 1.5s: Use bold text overlays like "Stop doing X, do this instead"',
          '2. Deliver High Value: Share 3 actionable tips in the Reel video',
          '3. Clear Call-to-Action: "Comment GUIDE and I\'ll DM you the complete supplier list!"',
          '4. Single-Word Keyword: Pick simple words like "BOOK", "LIST", "PRICE" to avoid typos',
          '5. Controlled Dual Reply: Airvix queues and delivers the public reply and DM smoothly',
          '6. Algorithmic Momentum: Rapid comment replies tell Instagram to push your Reel to Explore',
          '7. Conversation Continuity: Ask a follow-up question in the DM to increase response rate'
        ]
      }
    ],
    ctaText: 'Get Started with Airvix',
    ctaAction: 'signup'
  },
  'gst-info': {
    title: 'GST Invoicing & Indian Rupee (₹) Billing',
    badge: 'Indian Business Compliance',
    sections: [
      {
        heading: 'Scale in Rupees — No Forex Markup Charges',
        text: 'Most international SaaS tools bill in USD ($29 - $99), causing Indian creators to pay 3.5% credit card forex markup charges, bank conversion fees, and foreign transaction penalties. Airvix charges transparently in Indian Rupees (₹).'
      },
      {
        heading: 'Full Input Tax Credit (ITC) with GST Invoices',
        text: 'All paid plans come with automated GST invoices containing your registered GSTIN, company legal name, and HSN/SAC code 998313 (IT Software & SaaS Services). Indian businesses can claim 100% of the 18% GST back as Input Tax Credit.'
      },
      {
        heading: 'Supported Indian Payment Methods',
        list: [
          'UPI Instant Checkout: Google Pay, PhonePe, Paytm, CRED, BHIM',
          'RuPay, Visa & Mastercard Debit/Credit Cards',
          'Net Banking across all 50+ Indian commercial banks',
          'Zero international transaction failure rate'
        ]
      }
    ],
    ctaText: 'View Rupee Pricing Plans',
    ctaAction: 'pricing'
  },
  // Legal & Compliance
  'privacy': {
    title: 'Airvix Privacy Policy & Data Protection',
    badge: 'Legal Document',
    sections: [
      {
        heading: '1. Data Collection & Minimization',
        text: 'Airvix accesses only the public comments, post IDs, and Instagram scoped user IDs necessary to dispatch direct messages. We never store passwords or private personal conversations.'
      },
      {
        heading: '2. Security & Encryption Standards',
        text: 'All OAuth access tokens are encrypted at rest using industry-standard AES-256-GCM encryption in our secure PostgreSQL database.'
      },
      {
        heading: '3. Data Ownership & Deletion Rights',
        text: 'You retain 100% ownership of your data. You may disconnect your Instagram account or request complete account purging at any time by emailing support@airvix.com.'
      }
    ],
    ctaText: 'Understood & Accept',
    ctaAction: 'close'
  },
  'terms': {
    title: 'Airvix Terms of Service',
    badge: 'Legal Document',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        text: 'By creating an account on Airvix, you agree to comply with these terms, our Acceptable Use Policy, and official Meta Developer Terms.'
      },
      {
        heading: '2. Prohibited Use',
        text: 'Users may not use Airvix to send unsolicited bulk spam, fraudulent schemes, or content violating Instagram Community Guidelines.'
      },
      {
        heading: '3. Service SLA & Uptime',
        text: 'Airvix targets a 99.9% uptime SLA backed by redundant cloud workers. Scheduled maintenance is announced in advance.'
      }
    ],
    ctaText: 'Accept Terms',
    ctaAction: 'close'
  },
  'refund': {
    title: '7-Day Money-Back Guarantee Policy',
    badge: '100% Risk-Free Guarantee',
    sections: [
      {
        heading: '100% Unconditional Refund Policy',
        text: 'We want you to be completely satisfied with Airvix. If you upgrade to any paid tier (Pro or Business) and decide within 7 days that it is not the right fit for your workflow, simply contact us at support@airvix.com or via WhatsApp.'
      },
      {
        heading: 'Speedy Processing',
        text: 'Your refund will be initiated within 24 hours back to your original payment method (UPI, Card, or Net Banking) with zero questions asked.'
      }
    ],
    ctaText: 'Try Risk-Free for 7 Days',
    ctaAction: 'pricing'
  },
  'dpdp': {
    title: 'DPDP Act 2023 & GDPR Compliance',
    badge: 'Data Privacy Standards',
    sections: [
      {
        heading: 'India Digital Personal Data Protection (DPDP) Act 2023',
        text: 'Airvix is fully aligned with India\'s DPDP Act 2023 guidelines. We act as a Data Processor on behalf of our creator and business users (Data Fiduciaries), processing personal identifiers strictly under explicit follower consent.'
      },
      {
        heading: 'GDPR Alignment for Global Creators',
        text: 'For European users, Airvix maintains strict GDPR alignment including Right to Access, Right to Rectification, and Right to Erasure within 30 days of request.'
      }
    ],
    ctaText: 'Learn More',
    ctaAction: 'close'
  }
};

export default function LandingView({ 
  onNavigate = () => {}, 
  user, 
  siteSettingsOverride = null, 
  isPreview = false, 
  onSectionClick = null, 
  activeSectionOnly = null,
  activeSectionHighlight = null 
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // 'monthly' | 'yearly'
  const [internalSettings, setInternalSettings] = useState(null);
  const [dynamicPlans, setDynamicPlans] = useState([]);
  const [activeDocKey, setActiveDocKey] = useState(null); // string key into CONTENT_DOCS | null
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  const siteSettings = siteSettingsOverride || internalSettings;

  useEffect(() => {
    fetch('/api/billing/plans')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.plans) && data.plans.length > 0) {
          setDynamicPlans(data.plans.filter(p => p.active !== false));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!siteSettingsOverride) {
      fetch('/api/site/settings')
        .then(res => res.json())
        .then(data => {
          if (data && data.settings) {
            setInternalSettings(data.settings);
          }
        })
        .catch(() => {});
    }
  }, [siteSettingsOverride]);

  useEffect(() => {
    if (isPreview && activeSectionHighlight) {
      const sectionIdMap = {
        hero: 'hero',
        features: 'features',
        howitworks: 'how-it-works',
        pricing: 'pricing',
        testimonials: 'stories',
        faq: 'faq',
        footer: 'legal'
      };
      const targetId = sectionIdMap[activeSectionHighlight] || activeSectionHighlight;
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeSectionHighlight, isPreview]);

  const showSection = (name) => {
    if (!activeSectionOnly) return true;
    if (activeSectionOnly === name) return true;
    if (activeSectionOnly === 'howitworks' && (name === 'how-it-works' || name === 'howitworks')) return true;
    if (activeSectionOnly === 'how-it-works' && (name === 'how-it-works' || name === 'howitworks')) return true;
    if (activeSectionOnly === 'stories' && (name === 'testimonials' || name === 'stories')) return true;
    if (activeSectionOnly === 'testimonials' && (name === 'testimonials' || name === 'stories')) return true;
    if (activeSectionOnly === 'footer' && (name === 'legal' || name === 'footer')) return true;
    if (activeSectionOnly === 'legal' && (name === 'legal' || name === 'footer')) return true;
    return false;
  };

  useEffect(() => {
    if (!siteSettingsOverride) {
      fetch('/api/site/settings')
        .then(res => res.json())
        .then(data => {
          if (data && data.settings) {
            setInternalSettings(data.settings);
          }
        })
        .catch(() => {});
    }
  }, [siteSettingsOverride]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const testimonials = [
    {
      quote: siteSettings?.test_1_quote || "Airvix has completely changed how I manage my Instagram. I save hours every week!",
      name: siteSettings?.test_1_name || "Aditi Sharma",
      role: siteSettings?.test_1_role || "Content Creator",
      avatar: "/avatar-aditi.jpg"
    },
    {
      quote: siteSettings?.test_2_quote || "Super easy to set up and it actually feels personal. My engagement has doubled.",
      name: siteSettings?.test_2_name || "Rohit Mehta",
      role: siteSettings?.test_2_role || "D2C Brand Owner",
      avatar: "/avatar-rohit.jpg"
    },
    {
      quote: siteSettings?.test_3_quote || "The best investment for our social media team. It just works — reliable and smoothly.",
      name: siteSettings?.test_3_name || "Sneha Kapoor",
      role: siteSettings?.test_3_role || "Social Media Agency",
      avatar: "/avatar-sneha.jpg"
    }
  ];

  const nextTestimonial = () => {
    setTestimonialIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setTestimonialIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleSectionClick = (sectionName) => {
    if (isPreview && onSectionClick) {
      onSectionClick(sectionName);
    }
  };

  return (
    <div className={`airvix-page-wrapper ${activeSectionOnly ? 'is-section-preview' : ''} ${isPreview ? 'is-cms-preview' : ''}`}>
      {/* 1. TOP ANNOUNCEMENT BAR */}
      {((siteSettings?.announcement_enabled && !activeSectionOnly) || activeSectionOnly === 'announcement') && (
        <div
          className="airvix-announcement-bar"
          onClick={() => handleSectionClick('announcement')}
          style={{ cursor: isPreview ? 'pointer' : 'default' }}
        >
          {siteSettings?.announcement_badge && (
            <span className="airvix-announcement-badge">{siteSettings.announcement_badge}</span>
          )}
          <span>{siteSettings?.announcement_text || '✨ Launch Offer: Get 20% off on all annual plans!'}</span>
          {siteSettings?.announcement_link && (
            <a href={siteSettings.announcement_link} style={{ color: '#93c5fd', textDecoration: 'underline', marginLeft: '8px', fontWeight: 700 }}>
              Learn more →
            </a>
          )}
        </div>
      )}

      {/* 2. HEADER NAVBAR */}
      {(!activeSectionOnly || activeSectionOnly === 'navbar') && (
        <header
          className={`airvix-navbar ${isScrolled ? 'scrolled' : ''}`}
          onClick={() => handleSectionClick('navbar')}
          style={{ cursor: isPreview ? 'pointer' : 'default' }}
        >
          <div className="airvix-nav-container">
            <a href="#" className="airvix-logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <img src="/airvix-mark.png" alt="Airvix" className="airvix-logo-img" />
              <span className="airvix-logo-text">{siteSettings?.platform_name || siteSettings?.site_name || 'Airvix'}</span>
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
                  <a href="#how" onClick={(e) => { e.preventDefault(); setActiveDocKey('how-it-works-guide'); }}>How It Works</a>
                  <a href="#checklist" onClick={(e) => { e.preventDefault(); setActiveDocKey('reel-checklist'); }}>Viral Reel Blueprint</a>
                  <a href="#safety" onClick={(e) => { e.preventDefault(); setActiveDocKey('meta-safety'); }}>Meta API Safety Guide</a>
                  <a href="#gst" onClick={(e) => { e.preventDefault(); setActiveDocKey('gst-info'); }}>Rupee &amp; GST Invoicing</a>
                  <a href="#privacy" onClick={(e) => { e.preventDefault(); setActiveDocKey('privacy'); }}>Security &amp; Privacy</a>
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
                    {siteSettings?.nav_login_text || 'Sign in'}
                  </button>
                  <button className="airvix-btn-primary" onClick={() => onNavigate('auth-signup')}>
                    {siteSettings?.nav_signup_text || 'Get started'} <ArrowRight size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      {/* 3. HERO SECTION (Dark Obsidian Atmosphere with Ambient Background Video) */}
      {showSection('hero') && (
        <section 
          id="hero"
          className="airvix-hero-section"
          onClick={() => handleSectionClick('hero')}
          style={{ cursor: isPreview ? 'pointer' : 'default' }}
        >
          {/* Ambient Looping Video Background or Custom Image */}
          <div className="airvix-hero-video-bg">
            {siteSettings?.hero_media_type === 'image' && siteSettings?.hero_image_url ? (
              <img 
                src={siteSettings.hero_image_url} 
                alt="Hero Media" 
                className="airvix-bg-video" 
                style={{ objectFit: 'cover' }} 
              />
            ) : (
              <video
                key={siteSettings?.hero_video_url || 'default-video'}
                autoPlay
                loop
                muted
                playsInline
                className="airvix-bg-video"
              >
                <source src={siteSettings?.hero_video_url || '/Mere_ko_apne_business_air_airv.mp4'} type="video/mp4" />
              </video>
            )}
            <div className="airvix-hero-video-overlay"></div>
          </div>

          <div className="airvix-hero-radial-glow"></div>
          <div className="airvix-container airvix-hero-grid">
            
            {/* Left Column: Hero Content */}
            <div className="airvix-hero-left">
              <div className="airvix-badge-pill">
                {siteSettings?.hero_badge || 'AUTOMATE, ENGAGE, GROW'}
              </div>

              <h1 className="airvix-hero-heading">
                {siteSettings?.hero_headline || 'Turn Instagram Conversations'} <br />
                Into <span 
                  className="airvix-gradient-highlight"
                  style={siteSettings?.hero_highlight_color ? {
                    color: siteSettings.hero_highlight_color,
                    WebkitTextFillColor: 'initial',
                    background: 'none'
                  } : undefined}
                >
                  {siteSettings?.hero_headline_highlight || 'Real Growth'}
                </span>
              </h1>

              <p className="airvix-hero-sub">
                {siteSettings?.hero_subtitle || 
                  'Airvix helps creators and businesses automate Instagram comments and DMs, engage their audience, and convert conversations into customers — effortlessly.'}
              </p>

              <div className="airvix-hero-buttons">
                <button 
                  className="airvix-btn-primary airvix-btn-lg" 
                  onClick={() => {
                    if (isPreview) return;
                    if (siteSettings?.primary_cta_url?.startsWith('#')) {
                      onNavigate(user ? 'app' : 'auth-signup');
                    } else if (siteSettings?.primary_cta_url) {
                      window.location.href = siteSettings.primary_cta_url;
                    } else {
                      onNavigate(user ? 'app' : 'auth-signup');
                    }
                  }}
                >
                  {siteSettings?.primary_cta_text || 'Get started free'} <ArrowRight size={16} />
                </button>
                <button 
                  className="airvix-btn-dark airvix-btn-lg" 
                  onClick={() => {
                    if (isPreview) return;
                    setIsVideoModalOpen(true);
                  }}
                >
                  <Play size={16} className="airvix-play-icon" />
                  <span>{siteSettings?.secondary_cta_text || 'Watch demo'}</span>
                </button>
              </div>

              <div className="airvix-hero-trust-row">
                <div className="airvix-trust-item">
                  <CreditCard size={15} color="#94a3b8" />
                  <span>{siteSettings?.hero_trust_1 || 'No credit card required'}</span>
                </div>
                <div className="airvix-trust-item">
                  <Users size={15} color="#94a3b8" />
                  <span>{siteSettings?.hero_trust_2 || 'Trusted by 10,000+ creators'}</span>
                </div>
                <div className="airvix-trust-item">
                  <Shield size={15} color="#94a3b8" />
                  <span>{siteSettings?.hero_trust_3 || 'Secure & private'}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Floating Highlights Over Live Background Video */}
            <div className="airvix-hero-right">
              <div className="airvix-handwritten-note airvix-hero-note">
                <span>{siteSettings?.hero_note || 'From Comments to Customers'}</span>
                <svg className="airvix-curved-arrow" width="46" height="40" viewBox="0 0 46 40" fill="none">
                  <path d="M6 6 C18 20, 28 32, 40 34 M40 34 L32 30 M40 34 L36 24" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="airvix-hero-floating-stage">
                {/* Floating Notification 1: Top Right New Comment */}
                <div className="airvix-floating-toast airvix-toast-hero-1">
                  <div className="airvix-toast-icon airvix-toast-ig">📸</div>
                  <div className="airvix-toast-content">
                    <div className="airvix-toast-header">
                      <span className="airvix-toast-title">{siteSettings?.hero_toast_1_title || 'New comment'}</span>
                      <span className="airvix-toast-time">now</span>
                    </div>
                    <div className="airvix-toast-body">{siteSettings?.hero_toast_1_body || '"Do you have the price?"'}</div>
                  </div>
                </div>

                {/* Floating Notification 2: Bottom Right AI Reply Sent */}
                <div className="airvix-floating-toast airvix-toast-hero-2">
                  <div className="airvix-toast-icon airvix-toast-ai">🤖</div>
                  <div className="airvix-toast-content">
                    <div className="airvix-toast-header">
                      <span className="airvix-toast-title">{siteSettings?.hero_toast_2_title || 'AI Reply Sent'}</span>
                      <span className="airvix-toast-time">now</span>
                    </div>
                    <div className="airvix-toast-body">{siteSettings?.hero_toast_2_body || '"Hey! Here\'s the link for you 👋"'}</div>
                  </div>
                </div>

                {/* Live Status Badge */}
                <div className="airvix-hero-live-badge">
                  <span className="airvix-live-dot"></span>
                  <span>{siteSettings?.hero_live_badge || 'Automated DM Engine Active'}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Full-Page Cover Scroll Hint */}
          <a href="#features" className="airvix-hero-scroll-hint" aria-label="Scroll to features">
            <span>Scroll to explore</span>
            <ChevronDown size={15} className="airvix-scroll-bounce" />
          </a>
        </section>
      )}

      {/* 4. WHY AIRVIX / VALUE PROPOSITION (Clean White Aesthetic) */}
      <section 
        id="features" 
        className="airvix-features-section"
        onClick={() => handleSectionClick('features')}
        style={{ cursor: isPreview ? 'pointer' : 'default' }}
      >
        <div className="airvix-container">
          
          <div className="airvix-features-header-row">
            <div>
              <div className="airvix-section-badge">{siteSettings?.features_badge || 'WHY AIRVIX'}</div>
              <h2 className="airvix-section-heading">
                {siteSettings?.features_heading ? (
                  siteSettings.features_heading.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < siteSettings.features_heading.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))
                ) : (
                  <>
                    More than automation.<br />
                    It's a growth system.
                  </>
                )}
              </h2>
              <p className="airvix-section-sub">
                {siteSettings?.features_subtitle || 
                  'Everything you need to attract, engage, and convert your audience on Instagram — in one simple platform.'}
              </p>
            </div>

            <div className="airvix-handwritten-note airvix-features-note">
              <span>{siteSettings?.features_note || 'Built for creators, brands and businesses'}</span>
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
      <section 
        id="how-it-works" 
        className="airvix-how-section"
        onClick={() => handleSectionClick('how-it-works')}
        style={{ cursor: isPreview ? 'pointer' : 'default' }}
      >
        <div className="airvix-container airvix-how-grid">
          
          {/* Left Column: 3 Steps */}
          <div className="airvix-how-left">
            <div className="airvix-badge-pill">{siteSettings?.how_badge || 'HOW IT WORKS'}</div>
            <h2 className="airvix-how-heading">
              {siteSettings?.how_heading ? (
                siteSettings.how_heading.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < siteSettings.how_heading.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))
              ) : (
                <>
                  Set it up once.<br />
                  Let Airvix do the rest.
                </>
              )}
            </h2>
            <p className="airvix-how-sub">
              {siteSettings?.how_subtitle || 
                'From new comments to automated replies — watch how Airvix helps you engage and grow, in real time.'}
            </p>

            <div className="airvix-steps-list">
              <div className="airvix-step-item">
                <div className="airvix-step-num">1</div>
                <div>
                  <h4 className="airvix-step-title">{siteSettings?.step_1_title || 'Connect your Instagram'}</h4>
                  <p className="airvix-step-desc">{siteSettings?.step_1_desc || 'Securely connect your Instagram account with a few clicks.'}</p>
                </div>
              </div>

              <div className="airvix-step-item">
                <div className="airvix-step-num">2</div>
                <div>
                  <h4 className="airvix-step-title">{siteSettings?.step_2_title || 'Set up your automation'}</h4>
                  <p className="airvix-step-desc">{siteSettings?.step_2_desc || 'Choose triggers, customize replies, and use ready-to-edit templates.'}</p>
                </div>
              </div>

              <div className="airvix-step-item">
                <div className="airvix-step-num">3</div>
                <div>
                  <h4 className="airvix-step-title">{siteSettings?.step_3_title || 'Sit back and grow'}</h4>
                  <p className="airvix-step-desc">{siteSettings?.step_3_desc || 'Let Airvix handle the conversations while you focus on what matters.'}</p>
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
      <section 
        id="stories" 
        className="airvix-stories-section"
        onClick={() => handleSectionClick('testimonials')}
        style={{ cursor: isPreview ? 'pointer' : 'default' }}
      >
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
      <section 
        id="pricing" 
        className="airvix-pricing-section"
        onClick={() => handleSectionClick('pricing')}
        style={{ cursor: isPreview ? 'pointer' : 'default' }}
      >
        <div className="airvix-container">
          
          <div className="airvix-pricing-intro">
            <div className="airvix-section-badge">{siteSettings?.pricing_badge || 'SIMPLE PRICING'}</div>
            <h2 className="airvix-section-heading">{siteSettings?.pricing_heading || 'Plans for every stage of growth.'}</h2>
            <p className="airvix-section-sub">
              {siteSettings?.pricing_subtitle || 'Scale your Instagram engagement in Rupees • Instant activation with UPI, Cards & Net Banking with GST.'}
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

          {/* Pricing Cards Rendered Dynamically from Database Schema */}
          <div className="airvix-pricing-deck">
            {dynamicPlans.length > 0 ? (
              dynamicPlans.map((plan) => {
                const monthlyPrice = Number(plan.monthlyPrice) || 0;
                const annualRate = Number(plan.annualPrice) || monthlyPrice;
                const currentPrice = billingPeriod === 'yearly' ? annualRate : monthlyPrice;
                const isPopular = plan.popular || Boolean(plan.badge && plan.badge.toLowerCase().includes('popular'));

                return (
                  <div key={plan.id || plan.slug} className={`airvix-price-card ${isPopular ? 'airvix-card-popular' : ''}`}>
                    {plan.badge && (
                      <div className="airvix-popular-pill">{plan.badge}</div>
                    )}
                    
                    <div className="airvix-tier-name">{plan.name}</div>
                    <div className="airvix-tier-desc">{plan.description || 'Instagram DM Automation Plan'}</div>
                    
                    <div className="airvix-tier-price">
                      <span className="airvix-currency-symbol">₹</span>
                      <span className="airvix-price-num">{currentPrice.toLocaleString()}</span>
                      <span className="airvix-price-freq">/month</span>
                    </div>

                    {billingPeriod === 'yearly' && monthlyPrice > 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '-4px', marginBottom: '8px' }}>
                        ₹{(annualRate * 12).toLocaleString()} billed annually
                      </div>
                    )}

                    <ul className="airvix-tier-features">
                      {(Array.isArray(plan.features) ? plan.features : [])
                        .map((feat, i) => (
                          <li key={i}><Check size={16} color="#059669" /> {feat}</li>
                        ))}
                    </ul>

                    <button
                      className={isPopular ? "airvix-btn-primary airvix-btn-block" : "airvix-btn-outline airvix-btn-block"}
                      onClick={() => onNavigate(user ? 'app' : 'auth-signup')}
                    >
                      {monthlyPrice === 0 ? 'Get Started Free' : 'Choose Plan'}
                    </button>
                  </div>
                );
              })
            ) : (
              <>
                {/* Fallback Card 1: Starter */}
                <div className="airvix-price-card">
                  <div className="airvix-tier-name">{siteSettings?.plan_1_name || 'Starter'}</div>
                  <div className="airvix-tier-desc">{siteSettings?.plan_1_desc || 'Perfect for individuals'}</div>
                  
                  <div className="airvix-tier-price">
                    <span className="airvix-currency-symbol">₹</span>
                    <span className="airvix-price-num">{siteSettings?.price_starter !== undefined ? siteSettings.price_starter : 0}</span>
                    <span className="airvix-price-freq">/month</span>
                  </div>

                  <ul className="airvix-tier-features">
                    {(siteSettings?.plan_1_features || '1 Instagram account\n{limit_starter} automated replies/month\nBasic templates\nEmail support')
                      .split('\n').filter(f => f.trim()).map((feat, i) => (
                        <li key={i}><Check size={16} color="#059669" /> {feat.replace('{limit_starter}', siteSettings?.limit_starter || '1,000')}</li>
                      ))}
                  </ul>

                  <button className="airvix-btn-outline airvix-btn-block" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
                    {siteSettings?.plan_1_btn || 'Get started'}
                  </button>
                </div>

                {/* Fallback Card 2: Pro (Most Popular) */}
                <div className="airvix-price-card airvix-card-popular">
                  <div className="airvix-popular-pill">{siteSettings?.plan_2_badge || 'Most popular'}</div>
                  
                  <div className="airvix-tier-name">{siteSettings?.plan_2_name || 'Pro'}</div>
                  <div className="airvix-tier-desc">{siteSettings?.plan_2_desc || 'For growing creators & brands'}</div>
                  
                  <div className="airvix-tier-price">
                    <span className="airvix-currency-symbol">₹</span>
                    <span className="airvix-price-num">
                      {billingPeriod === 'monthly' 
                        ? (siteSettings?.price_creator ? Number(siteSettings.price_creator).toLocaleString() : '1,499')
                        : Math.round((Number(siteSettings?.price_creator) || 1499) * 0.8).toLocaleString()}
                    </span>
                    <span className="airvix-price-freq">/month</span>
                  </div>

                  <ul className="airvix-tier-features">
                    {(siteSettings?.plan_2_features || '3 Instagram accounts\n{limit_creator} automated replies/month\nAdvanced templates & spinning\nAnalytics & insights\nPriority support & GST invoice')
                      .split('\n').filter(f => f.trim()).map((feat, i) => (
                        <li key={i}><Check size={16} color="#059669" /> {feat.replace('{limit_creator}', siteSettings?.limit_creator || '25,000')}</li>
                      ))}
                  </ul>

                  <button className="airvix-btn-primary airvix-btn-block" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
                    {siteSettings?.plan_2_btn || 'Start 14-day free trial'}
                  </button>
                </div>

                {/* Fallback Card 3: Agency */}
                <div className="airvix-price-card">
                  <div className="airvix-tier-name">{siteSettings?.plan_3_name || 'Agency'}</div>
                  <div className="airvix-tier-desc">{siteSettings?.plan_3_desc || 'For teams & agencies'}</div>
                  
                  <div className="airvix-tier-price">
                    <span className="airvix-currency-symbol">₹</span>
                    <span className="airvix-price-num">
                      {billingPeriod === 'monthly' 
                        ? (siteSettings?.price_agency ? Number(siteSettings.price_agency).toLocaleString() : '3,999')
                        : Math.round((Number(siteSettings?.price_agency) || 3999) * 0.8).toLocaleString()}
                    </span>
                    <span className="airvix-price-freq">/month</span>
                  </div>

                  <ul className="airvix-tier-features">
                    {(siteSettings?.plan_3_features || '10 Instagram accounts\n{limit_agency} automated replies/month\nMulti-user team workspace\nCustom webhooks & API access\nDedicated account manager')
                      .split('\n').filter(f => f.trim()).map((feat, i) => (
                        <li key={i}><Check size={16} color="#059669" /> {feat.replace('{limit_agency}', siteSettings?.limit_agency || '100,000')}</li>
                      ))}
                  </ul>

                  <button className="airvix-btn-outline airvix-btn-block" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
                    {siteSettings?.plan_3_btn || 'Get started'}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="airvix-pricing-guarantee">
            <Shield size={18} color="#2563eb" />
            <span>{siteSettings?.pricing_guarantee || '7-day money-back guarantee • No questions asked • Cancel anytime with 1 click'}</span>
          </div>

        </div>
      </section>

      {/* 9. FAQ SECTION (Accordion Style with Plus/Minus) */}
      <section 
        id="faq" 
        className="airvix-faq-section"
        onClick={() => handleSectionClick('faq')}
        style={{ cursor: isPreview ? 'pointer' : 'default' }}
      >
        <div className="airvix-container airvix-faq-wrap">
          
          <div className="airvix-faq-header">
            <div className="airvix-section-badge">FAQ</div>
            <h2 className="airvix-section-heading">Frequently asked questions.</h2>
            <p className="airvix-section-sub">Everything you need to know about getting started with Airvix.</p>
          </div>

          <div className="airvix-faq-list">
            {(siteSettings?.faqs || [
              { q: 'Will using Airvix put my Instagram account at risk?', a: 'Never. Airvix is built exclusively on official Meta Graph API Webhooks. 100% compliant with Meta Terms.' },
              { q: 'How fast are the automatic replies sent?', a: 'Average response time is between 0.8s to 2.4s. Airvix responds while the user is actively watching your reel.' },
              { q: 'Can I send interactive visual cards and buttons in DMs?', a: 'Yes! You can configure rich visual cards with cover images, headlines, subtext, and custom button links.' },
              { q: 'Can I require users to follow me before getting the DM?', a: 'Yes! With our Follow-to-Unlock feature, non-followers receive a prompt asking them to follow first.' }
            ]).map((faq, idx) => (
              <details key={idx} className="airvix-faq-item" open={idx === 0}>
                <summary className="airvix-faq-question">
                  <span>{faq.q}</span>
                  <ChevronDown size={18} className="airvix-faq-arrow" />
                </summary>
                <div className="airvix-faq-answer">
                  <p>{faq.a}</p>
                </div>
              </details>
            ))}
          </div>

        </div>
      </section>

      {/* 10. FINAL CTA BANNER (Vibrant Blue Card) */}
      <section className="airvix-cta-section">
        <div className="airvix-container">
          <div className="airvix-cta-banner">
            <div className="airvix-cta-glow"></div>
            
            <h2 className="airvix-cta-heading">Ready to turn engagement into growth?</h2>
            <p className="airvix-cta-sub">
              Join thousands of creators and businesses using Airvix to automate their Instagram.
            </p>

            <div className="airvix-cta-action-row">
              <button className="airvix-btn-white" onClick={() => onNavigate(user ? 'app' : 'auth-signup')}>
                Get started free →
              </button>
            </div>

            <div className="airvix-cta-badges">
              <span>✓ Free 14-day trial</span>
              <span>✓ No credit card required</span>
              <span>✓ Instant setup in 3 mins</span>
            </div>
          </div>
        </div>
      </section>

      {/* 11. REFINED SAAS FOOTER (5-Column Layout) */}
      <footer 
        id="legal" 
        className="airvix-footer"
        onClick={() => handleSectionClick('footer')}
        style={{ cursor: isPreview ? 'pointer' : 'default' }}
      >
        <div className="airvix-container">
          
          <div className="airvix-footer-grid-5col">
            
            {/* Column 1: Brand & Tagline */}
            <div className="airvix-footer-col airvix-footer-brand-col">
              <div className="airvix-footer-brand-row">
                <img src="/airvix-mark.png" alt="Airvix Logo" className="airvix-footer-brand-logo" />
                <span className="airvix-footer-brand-name">Airvix</span>
              </div>

              <p className="airvix-footer-brand-desc">
                {siteSettings?.footer_tagline || 'The reliable Instagram comment-to-DM conversion engine. Turn post comments, reels, and stories into automated customer conversations with natural pacing and API compliance.'}
              </p>

              <div className="airvix-footer-compliance-pills">
                <span className="airvix-footer-compliance-pill">🇮🇳 Made in India for creators worldwide</span>
                <span className="airvix-footer-compliance-pill">🔒 100% Official Meta Graph API v22.0</span>
              </div>

              <div className="airvix-footer-system-status">
                <span className="airvix-system-status-dot"></span>
                <span>All Systems Operational • 99.98% Uptime</span>
              </div>
            </div>

            {/* Column 2: Product */}
            <div className="airvix-footer-col">
              <h4 className="airvix-footer-heading">Product</h4>
              <ul className="airvix-footer-nav-list">
                <li><a href="#feature" onClick={(e) => { e.preventDefault(); setActiveDocKey('comment-engine'); }}>Comment-to-DM Engine</a></li>
                <li><a href="#feature" onClick={(e) => { e.preventDefault(); setActiveDocKey('story-replies'); }}>24h Story Auto-Replies</a></li>
                <li><a href="#feature" onClick={(e) => { e.preventDefault(); setActiveDocKey('human-jitter'); }}>Anti-Spam Human Jitter</a></li>
                <li><a href="#feature" onClick={(e) => { e.preventDefault(); setActiveDocKey('follow-unlock'); }}>Follow-to-Unlock Protection</a></li>
                <li><a href="#feature" onClick={(e) => { e.preventDefault(); setActiveDocKey('dm-cards'); }}>Interactive DM Cards &amp; Links</a></li>
                <li><a href="#feature" onClick={(e) => { e.preventDefault(); setActiveDocKey('spintax'); }}>Smart Template Spintax</a></li>
                <li><a href="#feature" onClick={(e) => { e.preventDefault(); setActiveDocKey('multi-account'); }}>Multi-Account Growth Hub</a></li>
              </ul>
            </div>

            {/* Column 3: Solutions */}
            <div className="airvix-footer-col">
              <h4 className="airvix-footer-heading">Solutions</h4>
              <ul className="airvix-footer-nav-list">
                <li><a href="#solution" onClick={(e) => { e.preventDefault(); setActiveDocKey('solution-creators'); }}>For Content Creators</a></li>
                <li><a href="#solution" onClick={(e) => { e.preventDefault(); setActiveDocKey('solution-d2c'); }}>For D2C &amp; E-commerce Brands</a></li>
                <li><a href="#solution" onClick={(e) => { e.preventDefault(); setActiveDocKey('solution-agencies'); }}>For Social Media Agencies</a></li>
                <li><a href="#solution" onClick={(e) => { e.preventDefault(); setActiveDocKey('solution-coaches'); }}>For Coaches &amp; Course Sellers</a></li>
                <li><a href="#solution" onClick={(e) => { e.preventDefault(); setActiveDocKey('solution-events'); }}>For Event &amp; Webinar Hosts</a></li>
                <li><a href="#solution" onClick={(e) => { e.preventDefault(); setActiveDocKey('solution-workspaces'); }}>Agency Client Workspaces</a></li>
                <li><a href="#solution" onClick={(e) => { e.preventDefault(); setActiveDocKey('solution-enterprise'); }}>White-Label Enterprise</a></li>
              </ul>
            </div>

            {/* Column 4: Resources */}
            <div className="airvix-footer-col">
              <h4 className="airvix-footer-heading">Resources</h4>
              <ul className="airvix-footer-nav-list">
                <li><a href="#how" onClick={(e) => { e.preventDefault(); setActiveDocKey('how-it-works-guide'); }}>How It Works</a></li>
                <li><a href="#pricing" onClick={(e) => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }}>Rupee Pricing Plans</a></li>
                <li><a href="#demo" onClick={(e) => { e.preventDefault(); setIsVideoModalOpen(true); }}>Watch 60s Product Demo</a></li>
                <li><a href="#stories" onClick={(e) => { e.preventDefault(); document.getElementById('stories')?.scrollIntoView({ behavior: 'smooth' }); }}>Customer Success Stories</a></li>
                <li><a href="#safety" onClick={(e) => { e.preventDefault(); setActiveDocKey('meta-safety'); }}>Meta API Safety Guide</a></li>
                <li><a href="#checklist" onClick={(e) => { e.preventDefault(); setActiveDocKey('reel-checklist'); }}>Reel Engagement Checklist</a></li>
                <li><a href="#gst" onClick={(e) => { e.preventDefault(); setActiveDocKey('gst-info'); }}>GST Invoicing &amp; Tax Info</a></li>
              </ul>
            </div>

            {/* Column 5: Company & Support */}
            <div className="airvix-footer-col">
              <h4 className="airvix-footer-heading">Company &amp; Legal</h4>
              <ul className="airvix-footer-nav-list">
                <li><a href="#privacy" onClick={(e) => { e.preventDefault(); setActiveDocKey('privacy'); }}>Privacy Policy</a></li>
                <li><a href="#terms" onClick={(e) => { e.preventDefault(); setActiveDocKey('terms'); }}>Terms of Service</a></li>
                <li><a href="#refund" onClick={(e) => { e.preventDefault(); setActiveDocKey('refund'); }}>7-Day Money-Back Guarantee</a></li>
                <li><a href="#dpdp" onClick={(e) => { e.preventDefault(); setActiveDocKey('dpdp'); }}>DPDP Act &amp; GDPR Compliance</a></li>
                <li><a href={`mailto:${siteSettings?.support_email || 'support@airvix.com'}`}>Email: {siteSettings?.support_email || 'support@airvix.com'}</a></li>
                <li><a href={`tel:${siteSettings?.support_phone || '+919876543210'}`}>Phone: {siteSettings?.support_phone || '+91 98765 43210'}</a></li>
                {siteSettings?.whatsapp_number && (
                  <li><a href={`https://wa.me/${siteSettings.whatsapp_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">WhatsApp Creator Desk</a></li>
                )}
                {siteSettings?.business_address && (
                  <li style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4, marginTop: '4px' }}>
                    HQ: {siteSettings.business_address}
                  </li>
                )}
                {siteSettings?.gst_number && (
                  <li style={{ fontSize: '11px', color: '#60a5fa' }}>GSTIN: {siteSettings.gst_number}</li>
                )}
              </ul>
            </div>

          </div>

          {/* Footer Bottom Divider Bar */}
          <div className="airvix-footer-bottom-bar">
            <div className="airvix-footer-copyright">
              {siteSettings?.copyright_text || `© ${new Date().getFullYear()} Airvix Technologies Inc. All rights reserved. Empowering creators across India and globally.`}
            </div>

            <div className="airvix-footer-payments">
              <span className="airvix-pay-pill">UPI</span>
              <span className="airvix-pay-pill">RuPay</span>
              <span className="airvix-pay-pill">Cards</span>
              <span className="airvix-pay-pill">Net Banking</span>
              <span className="airvix-pay-pill">GST Input Tax Credit</span>
            </div>

            <div className="airvix-footer-social-links">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={17} /></a>
              <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="Twitter"><Twitter size={17} /></a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn"><Linkedin size={17} /></a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube"><Youtube size={17} /></a>
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
              <h3>Airvix Comment-to-DM Engine Walkthrough</h3>
              <button type="button" onClick={() => setIsVideoModalOpen(false)} aria-label="Close modal">
                <X size={20} />
              </button>
            </div>
            <div className="airvix-video-player-wrap">
              <video
                controls
                autoPlay
                className="airvix-video-tag"
                src={siteSettings?.hero_video_url || "/Mere_ko_apne_business_air_airv.mp4"}
                poster="/demo-poster.jpg"
              >
                Your browser does not support HTML5 video.
              </video>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: KNOWLEDGE, FEATURE & LEGAL RESOURCE READER
      ========================================================================= */}
      {activeDocKey && CONTENT_DOCS[activeDocKey] && (
        <div className="airvix-modal-backdrop" onClick={() => setActiveDocKey(null)}>
          <div className="airvix-legal-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="airvix-modal-header">
              <div className="airvix-legal-title-wrap">
                <FileText size={22} color="#3b82f6" />
                <div>
                  <div className="airvix-doc-modal-badge">{CONTENT_DOCS[activeDocKey].badge}</div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#ffffff' }}>{CONTENT_DOCS[activeDocKey].title}</h3>
                </div>
              </div>
              <button type="button" onClick={() => setActiveDocKey(null)} aria-label="Close modal" className="airvix-modal-close">
                <X size={20} />
              </button>
            </div>

            <div className="airvix-legal-content-body">
              {CONTENT_DOCS[activeDocKey].sections.map((sec, sIdx) => (
                <div key={sIdx} className="airvix-doc-section-block">
                  <h4 className="airvix-doc-section-title">{sec.heading}</h4>
                  {sec.text && <p className="airvix-doc-section-text">{sec.text}</p>}
                  {sec.list && (
                    <ul className="airvix-doc-list">
                      {sec.list.map((item, lIdx) => (
                        <li key={lIdx}>
                          <Check size={15} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="airvix-legal-footer">
              <button 
                type="button" 
                className="airvix-btn-primary" 
                onClick={() => {
                  const action = CONTENT_DOCS[activeDocKey].ctaAction;
                  setActiveDocKey(null);
                  if (action === 'signup') {
                    onNavigate(user ? 'app' : 'auth-signup');
                  } else if (action === 'pricing') {
                    const el = document.getElementById('pricing');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                {CONTENT_DOCS[activeDocKey].ctaText || 'Close & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
