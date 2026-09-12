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
  Command,
  Fingerprint
} from 'lucide-react';
import { setAuthSession, apiFetch } from '../api/client';
import '../styles/admin-login.css';

export default function AdminLoginView({ onAuthSuccess, onBackToUserLogin }) {
  const [authMode, setAuthMode] = useState('otp'); // 'otp' | 'password'
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

  // Cooldown countdown timer for OTP
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

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
            className={`admin-auth-tab ${authMode === 'otp' ? 'active' : ''}`}
            onClick={() => { setAuthMode('otp'); setError(null); }}
          >
            <Mail size={14} />
            <span>Login by Email & OTP</span>
          </button>
          <button
            type="button"
            className={`admin-auth-tab ${authMode === 'password' ? 'active' : ''}`}
            onClick={() => { setAuthMode('password'); setError(null); }}
          >
            <Lock size={14} />
            <span>Login by Email & Password</span>
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
