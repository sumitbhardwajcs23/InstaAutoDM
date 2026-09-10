// frontend/src/components/AdminLoginView.jsx
import React, { useState } from 'react';
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
  Terminal
} from 'lucide-react';
import { setAuthSession } from '../api/client';
import '../styles/admin-login.css';

export default function AdminLoginView({ onAuthSuccess, onBackToUserLogin }) {
  const [email, setEmail] = useState('sumitbhardwaj2227@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (res.ok && data.token && data.user) {
        setAuthSession(data.token, data.user);
        setNotice('✅ Identity Verified. Initializing Super Admin Control Center...');
        setTimeout(() => {
          window.location.hash = '#admin';
          onAuthSuccess(data.user);
        }, 500);
      } else {
        throw new Error(data.error || data.message || 'Admin authentication failed. Access denied.');
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
          <span>User Login</span>
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
            Restricted gateway for platform administration, user management, and system governance.
          </p>
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
          <span className="admin-quick-title">Configured Admin Accounts:</span>
          <div className="admin-quick-pills">
            <button
              type="button"
              className="admin-quick-pill"
              onClick={() => handlePillClick('sumitbhardwaj2227@gmail.com')}
              title="Click to fill primary admin email"
            >
              sumitbhardwaj2227@gmail.com
            </button>
            <button
              type="button"
              className="admin-quick-pill"
              onClick={() => handlePillClick('admin@airvix.com')}
              title="Click to fill secondary admin email"
            >
              admin@airvix.com
            </button>
          </div>
        </div>

        {/* Admin Login Form */}
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="admin-field-group">
            <label className="admin-field-label">Admin Email Address</label>
            <div className="admin-field-box">
              <Mail size={16} className="admin-field-icon" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@airvix.com"
                className="admin-input"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="admin-field-group">
            <label className="admin-field-label">Master Security Password</label>
            <div className="admin-field-box">
              <Lock size={16} className="admin-field-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password"
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

        <div className="admin-card-footer">
          <ShieldCheck size={14} style={{ color: '#10b981' }} />
          <span>256-Bit SSL Encrypted Admin Session</span>
        </div>
      </main>

      <footer className="admin-page-footer">
        <span>Airvix Platform Governance • </span>
        <a href="#login" onClick={onBackToUserLogin}>Regular User Sign In</a>
      </footer>
    </div>
  );
}
