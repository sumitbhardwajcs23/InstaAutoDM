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
  RefreshCw,
  Sparkles,
  MessageSquare,
  BarChart3,
  Users,
  Heart
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

const MetaIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#0081FB">
    <path d="M16.5 6c-1.8 0-3.3 1-4.5 2.5C10.8 7 9.3 6 7.5 6 4.5 6 2 8.5 2 11.5S4.5 17 7.5 17c1.8 0 3.3-1 4.5-2.5 1.2 1.5 2.7 2.5 4.5 2.5 3 0 5.5-2.5 5.5-5.5S19.5 6 16.5 6zm-9 9c-1.9 0-3.5-1.6-3.5-3.5S5.6 8 7.5 8s3.5 1.6 3.5 3.5S9.4 15 7.5 15zm9 0c-1.9 0-3.5-1.6-3.5-3.5S14.6 8 16.5 8s3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
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
  
  // 2-step Signup with OTP verification
  const [signupStep, setSignupStep] = useState('form'); // 'form' or 'verify_otp'
  const [signupOtp, setSignupOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Forgot Password Modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState('request');
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

  // Handle Google OAuth Authentication (Live Google One-Tap / Popup & Backend Token Verification)
  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    setNotice('Connecting to Google OAuth 2.5...');

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    // Trigger live Google GSI popup if Google Client ID is configured
    if (window.google?.accounts?.id && googleClientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (response.credential) {
              try {
                const res = await fetch('/api/auth/google', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id_token: response.credential }),
                });

                const data = await res.json();
                if (res.ok && data.token) {
                  setAuthSession(data.token, data.user);
                  onAuthSuccess(data.user);
                } else {
                  setError(data.error || 'Google authentication failed.');
                }
              } catch (err) {
                setError(err.message);
              } finally {
                setLoading(false);
              }
            }
          }
        });
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback prompt popup
            window.google.accounts.id.renderButton(document.getElementById('google-btn-hidden'), {
              type: 'standard',
              theme: 'outline',
              size: 'large'
            });
          }
        });
        return;
      } catch (err) {
        console.warn('Google GSI Prompt error, using direct flow:', err.message);
      }
    }

    // Direct token / backend authentication
    try {
      const googleToken = `google_token_${email ? encodeURIComponent(email) : 'creator'}_${Date.now()}`;
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: googleToken }),
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

  // Handle Traditional Password Login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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

  // Handle Signup Step 1: Submit Name, Email, Password -> Send Verification OTP
  const handleSignupRequest = async (e) => {
    if (e) e.preventDefault();
    if (!name || !email || !password) {
      setError('Name, email, and password are required for registration.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch('/api/auth/register-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        setNotice(data.message || `A 6-digit verification code has been sent to ${email}`);
        if (data.dev_otp) {
          setSignupOtp(data.dev_otp);
        }
        setSignupStep('verify_otp');
        setResendTimer(60);
      } else {
        throw new Error(data.error || 'Registration failed. Please check details and try again.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Signup Step 2: Verify OTP & Complete Account Creation
  const handleSignupVerify = async (e) => {
    e.preventDefault();
    if (!signupOtp || signupOtp.length < 6) {
      setError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, otp: signupOtp }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        setAuthSession(data.token, data.user);
        onAuthSuccess(data.user);
      } else {
        throw new Error(data.error || 'Invalid verification code. Please try again.');
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
      {/* Dynamic Ambient Mesh Background */}
      <div className="auth-ambient-glow-1" />
      <div className="auth-ambient-glow-2" />
      <div className="auth-ambient-mesh" />

      {/* Main Split-Screen Container */}
      <main className="auth-split-card">
        {/* LEFT HERO PANEL */}
        <div className="auth-hero-panel">
          <div className="auth-hero-header">
            <div className="auth-hero-brand" onClick={onBackToLanding} style={{ cursor: onBackToLanding ? 'pointer' : 'default' }}>
              <div className="auth-hero-logo">
                <img src="/logo-icon.png" alt="Airvix Logo" />
              </div>
              <span className="auth-hero-title-text">Airvix</span>
            </div>
            <div className="auth-hero-nav-bullets">
              <span>Automate</span>
              <span className="auth-bullet-dot">•</span>
              <span>Engage</span>
              <span className="auth-bullet-dot">•</span>
              <span>Grow</span>
            </div>
          </div>

          <div className="auth-hero-content">
            <div className="auth-hero-pill">
              <Sparkles size={13} className="auth-sparkle-icon" />
              <span>Made for Instagram Creators</span>
            </div>

            <h1 className="auth-hero-headline">
              Less Manual Work, <br />
              More <span className="auth-hero-highlight">Real Conversations.</span>
            </h1>

            <p className="auth-hero-subtext">
              Automate comments, DMs and story replies — <br />
              so you can focus on what you do best.
            </p>

            <div className="auth-hero-features">
              <div className="auth-feature-chip">
                <div className="auth-chip-icon purple">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <div className="auth-chip-title">Auto Reply</div>
                  <div className="auth-chip-desc">Comments, DMs & Story Replies</div>
                </div>
              </div>

              <div className="auth-feature-chip">
                <div className="auth-chip-icon blue">
                  <BarChart3 size={16} />
                </div>
                <div>
                  <div className="auth-chip-title">Save Time</div>
                  <div className="auth-chip-desc">Do more with less effort</div>
                </div>
              </div>

              <div className="auth-feature-chip">
                <div className="auth-chip-icon green">
                  <Users size={16} />
                </div>
                <div>
                  <div className="auth-chip-title">Grow Faster</div>
                  <div className="auth-chip-desc">Turn interactions into followers</div>
                </div>
              </div>
            </div>

            {/* Interactive Mockup Graphic */}
            <div className="auth-mockup-wrapper">
              <div className="auth-mockup-card">
                <div className="auth-mockup-header">
                  <span className="auth-mockup-ig-title">Instagram</span>
                  <div className="auth-mockup-actions">
                    <Heart size={15} />
                    <Send size={15} />
                  </div>
                </div>

                <div className="auth-mockup-body">
                  <div className="auth-comment-row">
                    <div className="auth-user-avatar">
                      <User size={14} />
                    </div>
                    <div className="auth-comment-content">
                      <div className="auth-comment-author">user123 <span className="auth-comment-time">2m</span></div>
                      <div className="auth-comment-text">Hi, can I get the link?</div>
                    </div>
                  </div>

                  <div className="auth-reply-box">
                    <div className="auth-airvix-avatar">A</div>
                    <div className="auth-reply-content">
                      <div className="auth-reply-author">Airvix <span className="auth-comment-time">now</span></div>
                      <div className="auth-reply-text">Check your DM! 🚀</div>
                    </div>
                  </div>

                  <div className="auth-dm-box">
                    <div className="auth-airvix-avatar">A</div>
                    <div className="auth-reply-content">
                      <div className="auth-reply-author">Airvix <span className="auth-comment-time">now</span></div>
                      <div className="auth-reply-text">Hey! Thanks for your comment. Here is your link: <u>https://yourlink.com</u></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="auth-annotation-badge">
                <span>From comments to customers</span>
                <svg className="auth-arrow-svg" viewBox="0 0 100 40">
                  <path d="M10,20 Q50,0 90,30" fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="3 3" />
                  <polygon points="90,30 84,23 83,30" fill="#a855f7" />
                </svg>
              </div>
            </div>

            <div className="auth-hero-footer">
              <span>Trusted by creators, brands and agencies worldwide.</span>
              <div className="auth-carousel-dots">
                <span className="dot active" />
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT FORM PANEL */}
        <div className="auth-form-panel">
          <div className="auth-form-top-bar">
            {mode === 'login' ? (
              <div className="auth-switch-prompt">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); setNotice(null); setSignupStep('form'); }}
                  className="auth-switch-btn"
                >
                  Sign up
                </button>
              </div>
            ) : (
              <div className="auth-switch-prompt">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setNotice(null); setSignupStep('form'); }}
                  className="auth-switch-btn"
                >
                  Log in
                </button>
              </div>
            )}
          </div>

          <div className="auth-form-main-content">
            <h2 className="auth-form-title">
              {mode === 'login' ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="auth-form-subtitle">
              {mode === 'login' 
                ? 'Log in to your Airvix account' 
                : 'Start turning Instagram comments into customers'}
            </p>

            {/* SSO Buttons */}
            <div className="auth-sso-group">
              <button type="button" onClick={handleGoogleAuth} disabled={loading} className="auth-sso-btn">
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
            </div>

            <div className="auth-divider">
              <span>or</span>
            </div>

            {/* Feedback Alerts */}
            {error && (
              <div className="auth-alert-box error">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            {notice && (
              <div className="auth-alert-box info">
                <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{notice}</span>
              </div>
            )}

            {/* SIGN IN vs CREATE ACCOUNT FORMS */}
            {mode === 'login' ? (
              /* LOGIN FORM */
              <form onSubmit={handlePasswordLogin} className="auth-form-fields">
                <div className="auth-input-group">
                  <label className="auth-input-label">Email address</label>
                  <div className="auth-input-box">
                    <Mail size={16} className="auth-input-icon" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="auth-text-input"
                    />
                  </div>
                </div>

                <div className="auth-input-group">
                  <label className="auth-input-label">Password</label>
                  <div className="auth-input-box">
                    <Lock size={16} className="auth-input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
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
                  <div style={{ textAlign: 'right', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={handleForgotPasswordClick}
                      className="auth-forgot-btn"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="auth-submit-btn">
                  {loading ? 'Logging in...' : 'Log in →'}
                </button>
              </form>
            ) : (
              /* SIGNUP FORM WITH 2-STEP OTP */
              <div>
                {signupStep === 'form' ? (
                  <form onSubmit={handleSignupRequest} className="auth-form-fields">
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

                    <div className="auth-input-group">
                      <label className="auth-input-label">Email address</label>
                      <div className="auth-input-box">
                        <Mail size={16} className="auth-input-icon" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="auth-text-input"
                        />
                      </div>
                    </div>

                    <div className="auth-input-group">
                      <label className="auth-input-label">Password</label>
                      <div className="auth-input-box">
                        <Lock size={16} className="auth-input-icon" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 6 characters"
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
                      {loading ? 'Sending Verification Code...' : 'Create Account →'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleSignupVerify} className="auth-form-fields">
                    <div className="auth-input-group">
                      <div className="auth-input-label-row">
                        <label className="auth-input-label">Enter 6-Digit Code</label>
                        <button
                          type="button"
                          onClick={() => setSignupStep('form')}
                          style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Edit Details
                        </button>
                      </div>
                      <div className="auth-input-box">
                        <KeyRound size={16} className="auth-input-icon" />
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={signupOtp}
                          onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="123456"
                          className="auth-text-input"
                          style={{ letterSpacing: '4px', fontWeight: 'bold' }}
                          autoFocus
                        />
                      </div>
                    </div>

                    <button type="submit" disabled={loading} className="auth-submit-btn">
                      {loading ? 'Verifying...' : 'Verify Code & Create Account →'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '12px' }}>
                      <button
                        type="button"
                        disabled={resendTimer > 0 || loading}
                        onClick={handleSignupRequest}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: resendTimer > 0 ? '#94a3b8' : '#4f46e5',
                          fontSize: '13px',
                          cursor: resendTimer > 0 ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 500
                        }}
                      >
                        <RefreshCw size={13} className={loading ? 'spin' : ''} />
                        <span>{resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend Verification Code'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="auth-secure-footer">
              <ShieldCheck size={15} />
              <span>Your data is secure with us.</span>
            </div>
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
          className="auth-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowResetModal(false);
          }}
        >
          <div className="auth-modal-card">
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
