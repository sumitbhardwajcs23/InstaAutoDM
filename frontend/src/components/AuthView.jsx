// frontend/src/components/AuthView.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Eye, EyeOff, ChevronLeft, Zap, TrendingUp } from 'lucide-react';
import { setAuthSession } from '../api/client';
import '../styles/auth.css';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      fill="#4285F4"
    />
    <path
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      fill="#34A853"
    />
    <path
      d="M5.28 14.27a7.18 7.18 0 0 1 0-4.54V6.58H1.25a11.96 11.96 0 0 0 0 10.84l4.03-3.15z"
      fill="#FBBC05"
    />
    <path
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      fill="#EA4335"
    />
  </svg>
);

const CurvedArrow = () => (
  <svg width="28" height="20" viewBox="0 0 34 24" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path
      d="M4 18C12 22 24 20 30 7M30 7L24 6M30 7L31 13"
      stroke="#60A5FA"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function AuthView({ onAuthSuccess, initialMode = 'login', onBackToLanding }) {
  const [mode, setMode] = useState(initialMode); // 'login' or 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const videoRef = useRef(null);

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  // Ensure video autoplays smoothly
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay may require user interaction on some strict browser configs
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = mode === 'login' ? { email, password } : { name, email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        setAuthSession(data.token, data.user);
        onAuthSuccess(data.user);
      } else {
        throw new Error(data.message || data.error || 'Authentication failed. Please check your credentials.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    setNotice('Google Workspace OAuth is enabled for enterprise domains. You can log in directly with your email & password above.');
  };

  const handleForgotPassword = () => {
    setNotice('Password reset link has been dispatched to your email address if registered.');
  };

  return (
    <div className="replyos-auth-page">
      {/* ==========================================================================
          LEFT SIDE (60% WIDTH) — Brand & Cinematic Product Showcase
          ========================================================================== */}
      <section className="auth-showcase-side">
        {/* Showcase Topbar */}
        <div className="showcase-topbar">
          <div className="showcase-brand" onClick={onBackToLanding} title="ReplyOS Home">
            <div className="showcase-brand-icon">
              <img src="/logo-icon.png" alt="ReplyOS" />
            </div>
            <span className="showcase-brand-name">
              Reply<span className="accent">OS</span>
            </span>
          </div>

          <nav className="showcase-nav">
            <button type="button" onClick={onBackToLanding}>Features</button>
            <button type="button" onClick={onBackToLanding}>How it works</button>
            <button type="button" onClick={onBackToLanding}>Pricing</button>
            <button type="button" onClick={onBackToLanding}>Testimonials</button>
          </nav>

          <div className="showcase-annotation">
            <span>Turn Comments into Customers</span>
            <CurvedArrow />
          </div>
        </div>

        {/* Main Showcase Hero */}
        <div className="showcase-main">
          <div className="showcase-eyebrow">
            ⚡ INSTAGRAM AUTOMATION, SIMPLIFIED
          </div>

          <h1 className="showcase-title">
            Turn conversations into <span className="highlight-blue">customers.</span>
          </h1>

          <p className="showcase-subtitle">
            Automate replies, engage your audience, and turn every interaction into meaningful growth.
          </p>

          {/* 16:9 Video Demo Showcase Container */}
          <div className="showcase-video-wrapper">
            <video
              ref={videoRef}
              src="/login-demo.mp4"
              poster="/demo-poster.jpg"
              autoPlay
              muted
              loop
              playsInline
              className="showcase-video"
            />

            {/* Live Indicator Badge */}
            <div 
              className="showcase-demo-badge"
              style={{ position: 'absolute', top: '14px', left: '14px', right: 'auto', zIndex: 10 }}
            >
              <span className="pulse-dot" />
              <span>LIVE DEMO • 0:45</span>
            </div>

            {/* Floating Simulated IG DM Interaction Card (Positioned bottom-right to conceal Gemini watermark) */}
            <div 
              className="showcase-floating-card"
              style={{
                position: 'absolute',
                bottom: '14px',
                right: '14px',
                left: 'auto',
                zIndex: 10,
                background: 'rgba(10, 14, 22, 0.98)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                maxWidth: '290px',
                minWidth: '260px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.15) inset'
              }}
            >
              <div className="floating-comment-item">
                <div className="floating-avatar">IG</div>
                <div className="floating-text-wrap">
                  <div className="floating-user">@thefoodigram • New comment</div>
                  <div className="floating-comment">"Do you have this in black?"</div>
                </div>
              </div>

              <div className="floating-comment-item" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                <div className="floating-avatar floating-reply-avatar">RO</div>
                <div className="floating-text-wrap">
                  <div className="floating-user" style={{ color: '#60A5FA' }}>Replied by ReplyOS</div>
                  <div className="floating-comment">"Hey! Yes, it's available. Here's your link 🔗"</div>
                  <span className="floating-tag">⚡ Auto-replied in 1.2s</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Compact Trust/Value Points */}
          <div className="showcase-pillars">
            <div className="pillar-card">
              <div className="pillar-header">
                <span className="pillar-icon" style={{ color: '#60A5FA' }}><Zap size={16} /></span>
                <span className="pillar-title">AI-Powered Automation</span>
              </div>
              <p className="pillar-desc">Save hours and reply smarter with contextual intent recognition.</p>
            </div>

            <div className="pillar-card">
              <div className="pillar-header">
                <span className="pillar-icon" style={{ color: '#34D399' }}><TrendingUp size={16} /></span>
                <span className="pillar-title">Increase Engagement</span>
              </div>
              <p className="pillar-desc">Turn comments into paying customers before intent fades.</p>
            </div>

            <div className="pillar-card">
              <div className="pillar-header">
                <span className="pillar-icon" style={{ color: '#818CF8' }}><ShieldCheck size={16} /></span>
                <span className="pillar-title">Secure Integration</span>
              </div>
              <p className="pillar-desc">Official Meta Graph API. Your credentials remain safe with us.</p>
            </div>
          </div>
        </div>

        {/* Bottom Social Proof */}
        <div className="showcase-footer">
          <div className="showcase-footer-label">TRUSTED BY GROWING CREATORS AND BRANDS</div>
          <div className="showcase-logos-row">
            <span className="showcase-logo-text" style={{ fontWeight: 900, letterSpacing: '-0.02em' }}>zomato</span>
            <span className="showcase-logo-text" style={{ fontFamily: 'sans-serif', fontWeight: 800 }}>bo<span style={{ color: '#EF4444' }}>A</span>t</span>
            <span className="showcase-logo-text" style={{ fontStyle: 'italic', fontWeight: 600 }}>mamaearth</span>
            <span className="showcase-logo-text" style={{ letterSpacing: '0.15em', fontWeight: 800 }}>NOISE</span>
            <span className="showcase-logo-text" style={{ letterSpacing: '0.2em', fontWeight: 900 }}>SUGAR</span>
            <span className="showcase-logo-text" style={{ fontSize: '11px', letterSpacing: '0.12em', fontWeight: 700 }}>THE DERMA CO</span>
          </div>
        </div>
      </section>

      {/* ==========================================================================
          RIGHT SIDE (40% WIDTH) — Clean, Refined Authentication
          ========================================================================== */}
      <section className="auth-form-side">
        {/* Form Top Navigation Bar */}
        <div className="auth-form-topbar">
          {onBackToLanding ? (
            <button type="button" onClick={onBackToLanding} className="auth-back-btn">
              <ChevronLeft size={16} />
              <span>Back to home</span>
            </button>
          ) : <div />}

          <div className="auth-switch-prompt">
            {mode === 'login' ? (
              <>
                <span>New here?</span>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); setNotice(null); }}
                  className="auth-switch-btn"
                >
                  Create account →
                </button>
              </>
            ) : (
              <>
                <span>Have an account?</span>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setNotice(null); }}
                  className="auth-switch-btn"
                >
                  Log in →
                </button>
              </>
            )}
          </div>
        </div>

        {/* Centered Refined Authentication Card */}
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-card-brand">
              <div className="auth-card-logo-icon">
                <img src="/logo-icon.png" alt="ReplyOS Logo" />
              </div>
              <span className="auth-card-logo-text">
                Reply<span className="accent">OS</span>
              </span>
            </div>

            <h2 className="auth-card-title">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="auth-card-subtitle">
              {mode === 'login'
                ? 'Log in to continue to your workspace.'
                : 'Start turning comments into customers in under 2 minutes.'}
            </p>
          </div>

          {/* Feedback Notices */}
          {error && (
            <div className="auth-error-alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="auth-error-alert" style={{ background: 'rgba(59, 130, 246, 0.12)', borderColor: 'rgba(59, 130, 246, 0.3)', color: '#93C5FD' }}>
              <span>ℹ️</span>
              <span>{notice}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'signup' && (
              <div className="auth-field">
                <label className="auth-label">Full Name</label>
                <div className="auth-input-wrapper">
                  <User size={16} className="auth-input-icon" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="auth-input"
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label">Email address</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="auth-input"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="auth-forgot-link"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="auth-input"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-password-toggle"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
            >
              <span>{loading ? 'Processing...' : (mode === 'login' ? 'Continue →' : 'Create Account →')}</span>
            </button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <span>or continue with</span>
          </div>

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            className="auth-google-btn"
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>

          {/* Encryption Note */}
          <div className="auth-security-note">
            <ShieldCheck size={14} />
            <span>Your data is encrypted and never shared.</span>
          </div>
        </div>

        {/* Subtle Right Side Footer */}
        <div className="auth-form-footer">
          <span>© {new Date().getFullYear()} ReplyOS Inc.</span>
          <div style={{ display: 'flex', gap: '14px' }}>
            <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a>
            <a href="/terms" target="_blank" rel="noreferrer">Terms</a>
            <a href="mailto:support@replyos.io">Support</a>
          </div>
        </div>
      </section>
    </div>
  );
}
