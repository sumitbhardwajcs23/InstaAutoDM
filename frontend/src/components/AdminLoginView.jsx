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
  const [email, setEmail] = useState(() => localStorage.getItem('admin_last_email') || '');
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

  // Reset Password State
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

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
        try { localStorage.setItem('admin_last_email', email.trim()); } catch (e) {}
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
        try { localStorage.setItem('admin_last_email', email.trim()); } catch (e) {}
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

  // Handle Request OTP for Password Reset
  const handleRequestResetOtp = async (e) => {
    if (e) e.preventDefault();
    if (!email) {
      setError('Please enter your administrator email.');
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
        setResetOtpSent(true);
        setNotice(data.message || `A 6-digit verification code was sent to ${email}`);
      } else {
        throw new Error(data.error || 'Failed to send admin verification code.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Confirm Password Reset
  const handleConfirmResetPassword = async (e) => {
    e.preventDefault();
    if (!resetOtp || resetOtp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/auth/admin-password/reset', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          otp: resetOtp.trim(),
          newPassword: newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice('✅ Password reset successfully! You can now log in with your new password.');
        setIsResetMode(false);
        setResetOtpSent(false);
        setResetOtp('');
        setPassword(newPassword);
        setAuthMode('password');
      } else {
        throw new Error(data.error || 'Failed to reset password.');
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

        {/* Reset Mode UI */}
        {isResetMode ? (
          <div className="admin-otp-flow">
            <div style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <KeyRound size={16} style={{ flexShrink: 0 }} />
              <span>Reset your Super Admin / Administrator password via verified email code.</span>
            </div>

            {!resetOtpSent ? (
              <form onSubmit={handleRequestResetOtp} className="admin-form">
                <div className="admin-field-group">
                  <label className="admin-field-label">Administrator Email Address</label>
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
                    <span>Sending Reset Code...</span>
                  ) : (
                    <>
                      <Fingerprint size={16} />
                      <span>Send 6-Digit Reset Code</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => { setIsResetMode(false); setError(null); setNotice(null); }}
                    className="admin-change-email-btn"
                  >
                    ← Back to Admin Login
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmResetPassword} className="admin-form">
                <div className="admin-field-group">
                  <label className="admin-field-label">6-Digit Verification Code (Sent to {email})</label>
                  <div className="admin-field-box">
                    <Fingerprint size={16} className="admin-field-icon" />
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 123456"
                      className="admin-input"
                      style={{ letterSpacing: '4px', fontWeight: 700, fontSize: '16px' }}
                    />
                  </div>
                </div>

                <div className="admin-field-group">
                  <label className="admin-field-label">New Administrator Password (Min. 6 chars)</label>
                  <div className="admin-field-box">
                    <Lock size={16} className="admin-field-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="admin-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="admin-eye-btn"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="admin-field-group">
                  <label className="admin-field-label">Confirm New Password</label>
                  <div className="admin-field-box">
                    <Lock size={16} className="admin-field-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Re-type new password"
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
                    <span>Updating Password...</span>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>Reset &amp; Save New Password</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <div className="admin-resend-row" style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={handleRequestResetOtp}
                    disabled={loading}
                    className="admin-resend-btn"
                  >
                    <RefreshCw size={13} />
                    <span>Resend Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsResetMode(false); setError(null); setNotice(null); }}
                    className="admin-change-email-btn"
                  >
                    Cancel &amp; Return
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <>
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

            {/* 3. PASSWORD AUTHENTICATION */}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="admin-field-label" style={{ marginBottom: 0 }}>Administrator Password</label>
                    <button
                      type="button"
                      onClick={() => { setIsResetMode(true); setError(null); setNotice(null); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6366f1',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Reset Password?
                    </button>
                  </div>
                  <div className="admin-field-box" style={{ marginTop: '6px' }}>
                    <Lock size={16} className="admin-field-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter administrator password"
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
          </>
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
