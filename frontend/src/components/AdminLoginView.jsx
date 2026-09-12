// frontend/src/components/AdminLoginView.jsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldAlert, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ChevronLeft, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  KeyRound, 
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Command,
  Fingerprint
} from 'lucide-react';
import { setAuthSession, apiFetch } from '../api/client';
import '../styles/admin-login.css';

export default function AdminLoginView({ onAuthSuccess, onBackToUserLogin }) {
  const [authMode, setAuthMode] = useState('google'); // 'google' | 'otp' | 'password'
  const [email, setEmail] = useState('sumitbhardwaj2227@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '955250447660-e6rendb53k479p4iksau83vf8b4svrdl.apps.googleusercontent.com';

  // Cooldown countdown timer for OTP
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Google Admin SSO Authentication
  const handleGoogleAdminLogin = async () => {
    setLoading(true);
    setError(null);
    setNotice('Connecting to Google Admin Identity...');

    if (window.google?.accounts?.oauth2) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'openid email profile',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              setLoading(false);
              if (tokenResponse.error !== 'popup_closed_by_user') {
                setError(tokenResponse.error_description || 'Google sign-in was cancelled.');
              }
              return;
            }

            if (tokenResponse.access_token) {
              try {
                const res = await apiFetch('/auth/admin-login', {
                  method: 'POST',
                  body: JSON.stringify({ access_token: tokenResponse.access_token }),
                });

                const data = await res.json();
                if (res.ok && data.token && data.user) {
                  setAuthSession(data.token, data.user);
                  setNotice('✅ Super Admin clearance confirmed. Redirecting to Admin Dashboard...');
                  if (onAuthSuccess) {
                    onAuthSuccess(data.user);
                  }
                  try {
                    window.history.pushState({}, '', '/admin-dashboard');
                  } catch (e) {}
                  window.location.hash = '#admin-dashboard';
                } else {
                  setError(data.error || 'Admin authorization failed. Ensure this Google account has admin rights.');
                }
              } catch (err) {
                setError(err.message || 'Failed to authenticate with Google Admin gateway.');
              } finally {
                setLoading(false);
              }
            }
          },
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('[Google Admin Auth] Token client error:', err.message);
      }
    }

    // Fallback: Google Identity Services
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (response.credential) {
              try {
                const res = await apiFetch('/auth/admin-login', {
                  method: 'POST',
                  body: JSON.stringify({ id_token: response.credential }),
                });
                const data = await res.json();
                if (res.ok && data.token && data.user) {
                  setAuthSession(data.token, data.user);
                  setNotice('✅ Super Admin clearance confirmed. Redirecting to Admin Dashboard...');
                  if (onAuthSuccess) {
                    onAuthSuccess(data.user);
                  }
                  try {
                    window.history.pushState({}, '', '/admin-dashboard');
                  } catch (e) {}
                  window.location.hash = '#admin-dashboard';
                } else {
                  setError(data.error || 'Admin authorization failed.');
                }
              } catch (err) {
                setError(err.message);
              } finally {
                setLoading(false);
              }
            }
          }
        });
        window.google.accounts.id.prompt();
        return;
      } catch (err) {
        console.warn('Google GSI error:', err.message);
      }
    }

    setLoading(false);
    setError('Google Sign-In is initializing. Please check your internet connection or try Email OTP.');
  };

  // Handle Email OTP Request
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    if (!email) {
      setError('Please enter your authorized administrator email.');
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await apiFetch('/auth/admin-otp/request', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        setNotice(data.message || `A 6-digit verification code was sent to ${email}`);
        setResendCooldown(60);
        setTimeout(() => inputRefs.current[0]?.focus(), 150);
      } else {
        throw new Error(data.error || 'Failed to send admin verification code.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit changes
  const handleDigitChange = (index, value) => {
    const cleanVal = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (cleanVal.length > 1) {
      // Pasted full code
      const pasted = cleanVal.slice(0, 6).split('');
      pasted.forEach((ch, idx) => {
        if (idx < 6) newDigits[idx] = ch;
      });
      setOtpDigits(newDigits);
      const nextIdx = Math.min(pasted.length, 5);
      inputRefs.current[nextIdx]?.focus();
      if (pasted.length === 6) {
        handleVerifyOtp(newDigits.join(''));
      }
      return;
    }

    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto submit on 6 digits
    if (cleanVal && index === 5 && newDigits.every(d => d !== '')) {
      handleVerifyOtp(newDigits.join(''));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Verify OTP and complete admin login
  const handleVerifyOtp = async (codeToVerify) => {
    const fullOtp = codeToVerify || otpDigits.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          otp: fullOtp,
        }),
      });

      const data = await res.json();
      if (res.ok && data.token && data.user) {
        setAuthSession(data.token, data.user);
        setNotice('✅ Identity Verified! Redirecting to Admin Dashboard...');
        if (onAuthSuccess) {
          onAuthSuccess(data.user);
        }
        try {
          window.history.pushState({}, '', '/admin-dashboard');
        } catch (e) {}
        window.location.hash = '#admin-dashboard';
      } else {
        throw new Error(data.error || 'Invalid or expired code. Please try again.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Master Password Login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await apiFetch('/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (res.ok && data.token && data.user) {
        setAuthSession(data.token, data.user);
        setNotice('✅ Credentials authenticated. Redirecting to Admin Dashboard...');
        if (onAuthSuccess) {
          onAuthSuccess(data.user);
        }
        try {
          window.history.pushState({}, '', '/admin-dashboard');
        } catch (e) {}
        window.location.hash = '#admin-dashboard';
      } else {
        throw new Error(data.error || 'Admin authentication failed. Access denied.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePillClick = (selectedEmail) => {
    setEmail(selectedEmail);
    setError(null);
  };

  return (
    <div className="admin-login-wrapper">
      {/* Top Header Bar */}
      <header className="admin-login-header-bar">
        <button 
          type="button" 
          onClick={onBackToUserLogin || (() => { window.location.hash = '#login'; })} 
          className="admin-login-back-link"
        >
          <ChevronLeft size={15} />
          <span>Exit to App</span>
        </button>

        <div className="admin-login-badge">
          <span className="admin-login-dot" />
          <span>Restricted Portal</span>
        </div>
      </header>

      {/* Main Admin Authentication Card */}
      <main className="admin-login-card">
        <div className="admin-card-header">
          <div className="admin-icon-shield">
            <ShieldAlert size={28} />
          </div>
          <h1 className="admin-title">Super Admin Portal</h1>
          <p className="admin-subtitle">
            Platform governance, user management, and real-time operations control center.
          </p>
        </div>

        {/* Auth Method Tabs */}
        <div className="admin-auth-tabs">
          <button
            type="button"
            className={`admin-auth-tab ${authMode === 'google' ? 'active' : ''}`}
            onClick={() => { setAuthMode('google'); setError(null); }}
          >
            <Sparkles size={14} />
            <span>Google SSO</span>
          </button>
          <button
            type="button"
            className={`admin-auth-tab ${authMode === 'otp' ? 'active' : ''}`}
            onClick={() => { setAuthMode('otp'); setError(null); }}
          >
            <Mail size={14} />
            <span>Email OTP</span>
          </button>
          <button
            type="button"
            className={`admin-auth-tab ${authMode === 'password' ? 'active' : ''}`}
            onClick={() => { setAuthMode('password'); setError(null); }}
          >
            <Lock size={14} />
            <span>Password</span>
          </button>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="admin-alert-box error">
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="admin-alert-box info">
            <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: '2px', color: '#10b981' }} />
            <span>{notice}</span>
          </div>
        )}

        {/* Quick Admin Email Presets */}
        <div className="admin-quick-hints">
          <span className="admin-quick-title">Authorized Super Admins:</span>
          <div className="admin-quick-pills">
            <button
              type="button"
              className={`admin-quick-pill ${email === 'sumitbhardwaj2227@gmail.com' ? 'active-pill' : ''}`}
              onClick={() => handlePillClick('sumitbhardwaj2227@gmail.com')}
              title="Click to select primary admin email"
            >
              sumitbhardwaj2227@gmail.com
            </button>
            <button
              type="button"
              className={`admin-quick-pill ${email === 'sumit.bhardwaj_cs23@gla.ac.in' ? 'active-pill' : ''}`}
              onClick={() => handlePillClick('sumit.bhardwaj_cs23@gla.ac.in')}
              title="Click to select university admin email"
            >
              sumit.bhardwaj_cs23@gla.ac.in
            </button>
          </div>
        </div>

        {/* 1. GOOGLE SSO AUTHENTICATION */}
        {authMode === 'google' && (
          <div className="admin-google-flow">
            <p className="admin-flow-desc">
              Sign in instantly using your verified Google administrator identity.
            </p>
            <button
              type="button"
              onClick={handleGoogleAdminLogin}
              disabled={loading}
              className="admin-google-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'Authenticating with Google...' : 'Continue with Google as Admin'}</span>
            </button>
          </div>
        )}

        {/* 2. EMAIL OTP AUTHENTICATION */}
        {authMode === 'otp' && (
          <div className="admin-otp-flow">
            {!otpSent ? (
              <form onSubmit={handleRequestOtp} className="admin-form">
                <div className="admin-field-group">
                  <label className="admin-field-label">Admin Email Address</label>
                  <div className="admin-field-box">
                    <Mail size={16} className="admin-field-icon" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@airvix.online"
                      className="admin-input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="admin-submit-btn"
                >
                  {loading ? (
                    <span>Sending Admin Code...</span>
                  ) : (
                    <>
                      <Fingerprint size={16} />
                      <span>Send 6-Digit Verification Code</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="admin-form">
                <div className="admin-field-group">
                  <label className="admin-field-label">Enter 6-Digit Admin Verification Code</label>
                  <div className="admin-otp-grid">
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (inputRefs.current[idx] = el)}
                        type="text"
                        maxLength={1}
                        inputMode="numeric"
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        className="admin-otp-box"
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleVerifyOtp()}
                  disabled={loading || otpDigits.some(d => !d)}
                  className="admin-submit-btn"
                >
                  {loading ? (
                    <span>Verifying Code...</span>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>Verify &amp; Access Admin Control Center</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <div className="admin-resend-row">
                  {resendCooldown > 0 ? (
                    <span className="admin-resend-text">Resend code in {resendCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={loading}
                      className="admin-resend-btn"
                    >
                      <RefreshCw size={13} />
                      <span>Resend Code</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtpDigits(['', '', '', '', '', '']); }}
                    className="admin-change-email-btn"
                  >
                    Change email
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. PASSWORD / MASTER KEY AUTHENTICATION */}
        {authMode === 'password' && (
          <form onSubmit={handlePasswordLogin} className="admin-form">
            <div className="admin-field-group">
              <label className="admin-field-label">Admin Email Address</label>
              <div className="admin-field-box">
                <Mail size={16} className="admin-field-icon" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@airvix.online"
                  className="admin-input"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="admin-field-group">
              <label className="admin-field-label">Security Master Password</label>
              <div className="admin-field-box">
                <Lock size={16} className="admin-field-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password or master key"
                  className="admin-input"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="admin-eye-btn"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="admin-submit-btn"
            >
              {loading ? (
                <span>Authenticating Gateway...</span>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Access Admin Control Center</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        <div className="admin-card-footer">
          <ShieldCheck size={14} style={{ color: '#10b981' }} />
          <span>256-Bit SSL Encrypted Admin Session</span>
        </div>
      </main>

      <footer className="admin-page-footer">
        <span>Airvix Platform Governance • </span>
        <button 
          type="button" 
          onClick={onBackToUserLogin || (() => { window.location.hash = '#login'; })}
          style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Regular User Sign In
        </button>
      </footer>
    </div>
  );
}
