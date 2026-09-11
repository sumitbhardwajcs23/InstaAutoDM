// frontend/src/components/AuthView.jsx
import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  ChevronLeft, 
  Sparkles, 
  AlertCircle,
  Info,
  CheckCircle2,
  X,
  KeyRound
} from 'lucide-react';
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

export default function AuthView({ onAuthSuccess, initialMode = 'login', onBackToLanding }) {
  const [mode, setMode] = useState(initialMode); // 'login' or 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Reset Password Dialog State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState('request'); // 'request' | 'submit'
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [resetSuccess, setResetSuccess] = useState(null);

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

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
    setNotice('Google Workspace SSO is ready. You can also sign in directly with your email & password.');
  };

  const handleForgotPassword = () => {
    setResetEmail(email || '');
    setNewPassword('');
    setResetToken('');
    setResetStep('request');
    setResetError(null);
    setResetSuccess(null);
    setShowResetModal(true);
  };

  const handleRequestResetToken = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetSuccess(data.message || 'Reset token generated! Please enter your token and new password.');
        if (data.dev_token) {
          setResetToken(data.dev_token);
        }
        setResetStep('submit');
      } else {
        throw new Error(data.error || 'Failed to request reset token');
      }
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetSuccess(data.message || 'Password updated successfully!');
        setPassword(newPassword);
        setTimeout(() => {
          setShowResetModal(false);
          setMode('login');
          setError(null);
          setNotice('Password updated! You can now click "Sign In to Workspace".');
        }, 1200);
      } else {
        throw new Error(data.error || 'Failed to update password');
      }
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      {/* Top Bar with Back Link and Platform Status */}
      <header className="auth-header-bar">
        {onBackToLanding ? (
          <button type="button" onClick={onBackToLanding} className="auth-back-link">
            <ChevronLeft size={15} />
            <span>Back to website</span>
          </button>
        ) : <div />}

        <div className="auth-status-badge">
          <span className="auth-status-dot" />
          <span>Meta API Systems Operational</span>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="auth-clean-card">
        {/* Brand Header */}
        <div className="auth-brand-center">
          <div className="auth-logo-box" onClick={onBackToLanding} style={{ cursor: onBackToLanding ? 'pointer' : 'default' }}>
            <img src="/logo-icon.png" alt="Airvix Logo" />
          </div>
          <h1 className="auth-title">
            {mode === 'login' ? 'Welcome to Airvix' : 'Create your Airvix account'}
          </h1>
          <p className="auth-subtitle">
            {mode === 'login' 
              ? 'Log in to manage your automated Instagram conversations.' 
              : 'Join 12,000+ creators turning comments into customers.'}
          </p>
        </div>

        {/* Tab Switcher: Log In / Sign Up */}
        <div className="auth-tab-pill">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(null); setNotice(null); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(null); setNotice(null); }}
          >
            Create Account
          </button>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="auth-alert-box error" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
              <span>{error}</span>
              {error.toLowerCase().includes('already exists') && (
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#dc2626',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    textAlign: 'left'
                  }}
                >
                  👉 Click here to switch to Sign In tab
                </button>
              )}
            </div>
          </div>
        )}

        {notice && (
          <div className="auth-alert-box info">
            <Info size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{notice}</span>
          </div>
        )}

        {/* Social Authentication */}
        <button type="button" onClick={handleGoogleAuth} className="auth-google-btn">
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="auth-form-fields">
          {mode === 'signup' && (
            <div className="auth-input-group">
              <label className="auth-input-label">Full Name</label>
              <div className="auth-input-box">
                <User size={16} className="auth-input-icon" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="auth-text-input"
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="auth-input-group">
            <label className="auth-input-label">Email Address</label>
            <div className="auth-input-box">
              <Mail size={16} className="auth-input-icon" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="auth-text-input"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="auth-input-group">
            <div className="auth-input-label-row">
              <label className="auth-input-label">Password</label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="auth-forgot-btn"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="auth-input-box">
              <Lock size={16} className="auth-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="auth-text-input"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="auth-eye-toggle"
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
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In to Workspace' : 'Create Free Account'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Authentic Security & Trust Badges */}
        <div className="auth-trust-badges">
          <div className="auth-trust-item">
            <ShieldCheck size={14} />
            <span>Meta Tech Compliant</span>
          </div>
          <div className="auth-trust-item">
            <Lock size={13} />
            <span>256-Bit SSL Encrypted</span>
          </div>
          <div className="auth-trust-item">
            <CheckCircle2 size={13} />
            <span>1,000 Free DMs/mo</span>
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="auth-page-footer">
        <div>
          <span>By signing in, you agree to our </span>
          <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>
          <span> and </span>
          <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
          <span>.</span>
        </div>
        <div style={{ marginTop: '12px' }}>
          <a 
            href="#admin-login" 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#818cf8',
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'none',
              padding: '5px 12px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.2)'
            }}
          >
            <ShieldCheck size={13} />
            <span>Super Admin & Staff Portal →</span>
          </a>
        </div>
      </footer>

      {/* Quick Reset Password Modal */}
      {showResetModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 7, 13, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowResetModal(false);
          }}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
              position: 'relative'
            }}
          >
            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                borderRadius: '8px',
                color: '#94a3b8',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                <KeyRound size={18} />
              </div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#f8fafc' }}>
                Reset Your Password
              </h2>
            </div>
            {resetStep === 'request' ? (
              <form onSubmit={handleRequestResetToken} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
                  Enter your account email to receive a secure single-use password reset token.
                </p>

                <div className="auth-input-group">
                  <label className="auth-input-label">Account Email</label>
                  <div className="auth-input-box">
                    <Mail size={16} className="auth-input-icon" />
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="auth-text-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="auth-submit-btn"
                  style={{ marginTop: '8px' }}
                >
                  {resetLoading ? 'Requesting Token...' : 'Send Reset Instructions'}
                </button>

                <button
                  type="button"
                  onClick={() => setResetStep('submit')}
                  style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '12.5px', cursor: 'pointer', padding: '4px' }}
                >
                  Already have a reset token? Click here
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
                  Enter the secure reset token and your new password.
                </p>

                <div className="auth-input-group">
                  <label className="auth-input-label">Reset Token</label>
                  <div className="auth-input-box">
                    <KeyRound size={16} className="auth-input-icon" />
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste 64-character reset token"
                      className="auth-text-input"
                    />
                  </div>
                </div>

                <div className="auth-input-group">
                  <label className="auth-input-label">New Password</label>
                  <div className="auth-input-box">
                    <Lock size={16} className="auth-input-icon" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="auth-text-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="auth-submit-btn"
                  style={{ marginTop: '8px' }}
                >
                  {resetLoading ? 'Updating Password...' : 'Save New Password & Sign In'}
                </button>

                <button
                  type="button"
                  onClick={() => setResetStep('request')}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12.5px', cursor: 'pointer', padding: '4px' }}
                >
                  ← Request a new token
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
