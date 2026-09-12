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
  AlertCircle,
  Info,
  CheckCircle2,
  X,
  KeyRound,
  Send,
  Sparkles,
  RefreshCw
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
  // Modes: 'login' | 'signup' | 'otp_request' | 'otp_verify' | 'forgot_password' | 'reset_password'
  const [authMethod, setAuthMethod] = useState('otp'); // 'otp' or 'password'
  const [mode, setMode] = useState(initialMode);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [otpStep, setOtpStep] = useState('request'); // 'request' or 'verify'
  const [resendTimer, setResendTimer] = useState(0);

  // Forgot Password Modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState('request'); // 'request' | 'verify'
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [resetSuccess, setResetSuccess] = useState(null);

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Handle Google OAuth Authentication
  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    setNotice('Connecting to Google OAuth 2.0...');

    try {
      // Simulate/trigger Google OAuth credential or token exchange
      const mockGoogleIdToken = `mock_google_token_${email || 'creator@example.com'}`;
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: mockGoogleIdToken }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        setAuthSession(data.token, data.user);
        onAuthSuccess(data.user);
      } else {
        throw new Error(data.error || 'Google authentication failed.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Request Email OTP
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    if (!email) {
      setError('Please enter your email address to receive an OTP code.');
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch('/api/auth/email-otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setNotice(data.message || `A 6-digit code has been sent to ${email}`);
        if (data.dev_otp) {
          setOtp(data.dev_otp);
        }
        setOtpStep('verify');
        setResendTimer(60);
      } else {
        throw new Error(data.error || 'Failed to send OTP code.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify Email OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/email-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        setAuthSession(data.token, data.user);
        onAuthSuccess(data.user);
      } else {
        throw new Error(data.error || 'Invalid or expired OTP code.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Traditional Email + Password Login / Signup
  const handlePasswordSubmit = async (e) => {
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
        throw new Error(data.message || data.error || 'Authentication failed.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password Modal Request
  const handleForgotPasswordClick = () => {
    setResetEmail(email || '');
    setResetOtp('');
    setNewPassword('');
    setResetStep('request');
    setResetError(null);
    setResetSuccess(null);
    setShowResetModal(true);
  };

  const handleRequestResetOtp = async (e) => {
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
        setResetSuccess(data.message);
        if (data.dev_otp) {
          setResetOtp(data.dev_otp);
        }
        setResetStep('verify');
      } else {
        throw new Error(data.error || 'Failed to send password reset code');
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

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, otp: resetOtp, newPassword }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        setResetSuccess('Password reset successfully! Logging you in...');
        setAuthSession(data.token, data.user);
        setTimeout(() => {
          setShowResetModal(false);
          onAuthSuccess(data.user);
        }, 1200);
      } else {
        throw new Error(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
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

      <main className="auth-clean-card">
        <div className="auth-brand-center">
          <div className="auth-logo-box" onClick={onBackToLanding} style={{ cursor: onBackToLanding ? 'pointer' : 'default' }}>
            <img src="/logo-icon.png" alt="Airvix Logo" />
          </div>
          <h1 className="auth-title">
            {mode === 'login' ? 'Welcome to Airvix' : 'Create your Airvix account'}
          </h1>
          <p className="auth-subtitle">
            Single Unified Account per Creator. Connect seamlessly with Google, Email OTP, or Password.
          </p>
        </div>

        {/* Auth Method Selector */}
        <div className="auth-tab-pill">
          <button
            type="button"
            className={`auth-tab-btn ${authMethod === 'otp' ? 'active' : ''}`}
            onClick={() => { setAuthMethod('otp'); setError(null); setNotice(null); }}
          >
            Email OTP (Passwordless)
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${authMethod === 'password' ? 'active' : ''}`}
            onClick={() => { setAuthMethod('password'); setError(null); setNotice(null); }}
          >
            Email + Password
          </button>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="auth-alert-box error" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
              <span>{error}</span>
            </div>
          </div>
        )}

        {notice && (
          <div className="auth-alert-box info">
            <Info size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{notice}</span>
          </div>
        )}

        {/* Continue with Google */}
        <button type="button" onClick={handleGoogleAuth} disabled={loading} className="auth-google-btn">
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        {/* EMAIL OTP FLOW */}
        {authMethod === 'otp' && (
          <div>
            {otpStep === 'request' ? (
              <form onSubmit={handleRequestOtp} className="auth-form-fields">
                <div className="auth-input-group">
                  <label className="auth-input-label">Your Email Address</label>
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

                <button type="submit" disabled={loading} className="auth-submit-btn">
                  {loading ? (
                    <span>Sending Code...</span>
                  ) : (
                    <>
                      <span>Send 6-Digit Login Code</span>
                      <Send size={15} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="auth-form-fields">
                <div className="auth-input-group">
                  <div className="auth-input-label-row">
                    <label className="auth-input-label">Enter 6-Digit OTP Code</label>
                    <button
                      type="button"
                      onClick={() => setOtpStep('request')}
                      style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Change Email
                    </button>
                  </div>
                  <div className="auth-input-box">
                    <KeyRound size={16} className="auth-input-icon" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="auth-text-input"
                      style={{ letterSpacing: '4px', fontWeight: 'bold' }}
                      autoFocus
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="auth-submit-btn">
                  {loading ? (
                    <span>Verifying Code...</span>
                  ) : (
                    <>
                      <span>Verify & Sign In</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <button
                    type="button"
                    disabled={resendTimer > 0 || loading}
                    onClick={handleRequestOtp}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: resendTimer > 0 ? '#64748b' : '#818cf8',
                      fontSize: '13px',
                      cursor: resendTimer > 0 ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <RefreshCw size={13} className={loading ? 'spin' : ''} />
                    <span>{resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend OTP Code'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* EMAIL + PASSWORD FLOW */}
        {authMethod === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="auth-form-fields">
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
                />
              </div>
            </div>

            <div className="auth-input-group">
              <div className="auth-input-label-row">
                <label className="auth-input-label">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={handleForgotPasswordClick}
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
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="auth-text-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-eye-toggle"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="auth-submit-btn">
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Workspace' : 'Create Free Account'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setError(null);
                }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}
              >
                {mode === 'login' ? "Don't have an account? Create one" : 'Already have an account? Sign In'}
              </button>
            </div>
          </form>
        )}

        <div className="auth-trust-badges">
          <div className="auth-trust-item">
            <ShieldCheck size={14} />
            <span>Meta Tech Compliant</span>
          </div>
          <div className="auth-trust-item">
            <Lock size={13} />
            <span>Single Canonical Account</span>
          </div>
          <div className="auth-trust-item">
            <CheckCircle2 size={13} />
            <span>Resend Secure OTP</span>
          </div>
        </div>
      </main>

      <footer className="auth-page-footer">
        <div>
          <span>By signing in, you agree to our </span>
          <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>
          <span> and </span>
          <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
          <span>.</span>
        </div>
      </footer>

      {/* Forgot Password Reset Modal */}
      {showResetModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 7, 13, 0.85)',
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
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                <KeyRound size={18} />
              </div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#f8fafc' }}>
                Reset Your Password
              </h2>
            </div>

            {resetError && (
              <div className="auth-alert-box error" style={{ marginBottom: '16px' }}>
                <span>{resetError}</span>
              </div>
            )}
            {resetSuccess && (
              <div className="auth-alert-box info" style={{ marginBottom: '16px' }}>
                <span>{resetSuccess}</span>
              </div>
            )}

            {resetStep === 'request' ? (
              <form onSubmit={handleRequestResetOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
                  Enter your registered email address to receive a secure 6-digit password reset OTP code.
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

                <button type="submit" disabled={resetLoading} className="auth-submit-btn">
                  {resetLoading ? 'Sending Reset Code...' : 'Send Password Reset Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
                  Enter the 6-digit OTP code sent to your email and your new password.
                </p>

                <div className="auth-input-group">
                  <label className="auth-input-label">6-Digit OTP Code</label>
                  <div className="auth-input-box">
                    <KeyRound size={16} className="auth-input-icon" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="auth-text-input"
                      style={{ letterSpacing: '4px', fontWeight: 'bold' }}
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

                <button type="submit" disabled={resetLoading} className="auth-submit-btn">
                  {resetLoading ? 'Resetting Password...' : 'Save New Password & Sign In'}
                </button>

                <button
                  type="button"
                  onClick={() => setResetStep('request')}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12.5px', cursor: 'pointer' }}
                >
                  ← Request a new code
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
