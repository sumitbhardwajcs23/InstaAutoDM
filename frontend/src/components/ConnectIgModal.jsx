// frontend/src/components/ConnectIgModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Instagram, CheckCircle2, Sparkles, ExternalLink, Shield } from 'lucide-react';
import { apiFetch, getToken, getCurrentUser, API_BASE } from '../api/client';

export default function ConnectIgModal({ isOpen, onClose, onConnected }) {
  const [tab, setTab] = useState('oauth'); // 'oauth' | 'token' | 'sandbox'
  const [manualToken, setManualToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Listen for popup window completion message
  useEffect(() => {
    const handleAuthMessage = (event) => {
      if (event.data?.type === 'INSTAGRAM_CONNECTED') {
        setLoading(false);
        if (onConnected) onConnected(event.data.account);
        onClose();
      } else if (event.data?.type === 'INSTAGRAM_ERROR') {
        setLoading(false);
        setError(event.data.error || 'Connection failed');
      }
    };
    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [onConnected, onClose]);

  if (!isOpen) return null;

  const openOAuthPopup = (url) => {
    const width = 600;
    const height = 720;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    setLoading(true);
    setError(null);

    const popup = window.open(
      url,
      'ReplyOS_Meta_Auth',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=no,resizable=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      // Browser popup blocker triggered; fall back to window.location.href
      window.location.href = url;
      return;
    }

    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        setLoading(false);
      }
    }, 1000);
  };

  const handleInstagramOAuth = () => {
    const user = getCurrentUser();
    const origin = window.location.origin;
    const userId = user?.id || '';

    // Encode state with userId, origin, and auth type
    const stateObj = { uid: userId, origin, type: 'instagram' };
    const state = btoa(JSON.stringify(stateObj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const appId = '28265020499789803';
    const redirectUri = 'https://instaautodm-kh61.onrender.com/api/instagram/oauth/callback';
    const scopes = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments';
    
    // Direct Instagram Login Dialog on instagram.com
    const igAuthUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${state}`;
    openOAuthPopup(igAuthUrl);
  };

  const handleFacebookOAuth = () => {
    const user = getCurrentUser();
    const origin = window.location.origin;
    const userId = user?.id || '';
    const stateObj = { uid: userId, origin, type: 'facebook' };
    const state = btoa(JSON.stringify(stateObj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const appId = '28265020499789803';
    const redirectUri = 'https://instaautodm-kh61.onrender.com/api/instagram/oauth/callback';
    const scopes = 'instagram_basic,instagram_manage_comments,instagram_manage_messages,pages_show_list,pages_read_engagement';
    const fbAuthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;
    openOAuthPopup(fbAuthUrl);
  };

  const handleManualTokenConnect = async (e) => {
    e.preventDefault();
    if (!manualToken.trim()) {
      setError('Please paste a valid Meta User or Page Access Token');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/instagram/connect-token', {
        method: 'POST',
        body: JSON.stringify({ token: manualToken.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (onConnected) onConnected(data.account);
        onClose();
      } else {
        throw new Error(data.error || data.message || 'Token verification failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSandboxConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/instagram/connect-mock', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        if (onConnected) onConnected(data.account || { username: 'luna.creates', account_type: 'Business Account' });
        onClose();
      } else {
        throw new Error(data.message || data.error || 'Connection failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-light)',
        overflow: 'hidden',
        padding: '28px 26px',
      }}>
        {/* Brand & Instagram Connected Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          margin: '0 auto 16px',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: '#ffffff',
            border: '1px solid var(--border-light)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '5px',
          }}>
            <img src="/logo-icon.png" alt="ReplyOS" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ color: 'var(--text-light)', fontSize: '18px', fontWeight: 600 }}>+</div>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #f09433, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 6px 16px rgba(220, 39, 67, 0.3)',
          }}>
            <Instagram size={24} />
          </div>
        </div>

        <h2 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0', textAlign: 'center' }}>
          Connect Instagram to ReplyOS
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px 0', lineHeight: 1.45, textAlign: 'center' }}>
          Link your Instagram Business or Creator account to start automating DMs and comments.
        </p>

        {/* Tab Switcher */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '6px',
          background: 'var(--bg-subtle)',
          padding: '4px',
          borderRadius: '10px',
          marginBottom: '20px',
        }}>
          {[
            { id: 'oauth', label: 'Instagram Login' },
            { id: 'token', label: 'Access Token' },
            { id: 'sandbox', label: 'Sandbox' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setError(null); }}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                background: tab === t.id ? 'var(--bg-card)' : 'transparent',
                color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: tab === t.id ? 700 : 500,
                fontSize: '12.5px',
                cursor: 'pointer',
                boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: '0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: '#fef2f2',
            color: '#dc2626',
            fontSize: '12.5px',
            fontWeight: 500,
            marginBottom: '16px',
            textAlign: 'left',
          }}>
            {error}
          </div>
        )}

        {/* Tab 1: Instagram / Meta Login */}
        {tab === 'oauth' && (
          <div>
            <div style={{
              textAlign: 'left',
              background: 'var(--bg-subtle)',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--text-main)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} color="#10b981" />
                <span>Official Meta Graph API authorization</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} color="#10b981" />
                <span>Select your Instagram Business or Creator profile</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} color="#10b981" />
                <span>Auto-activates automated DMs, comments & webhooks</span>
              </div>
            </div>

            {/* Recommended Meta Login Button */}
            <button
              type="button"
              onClick={handleFacebookOAuth}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #1877F2 0%, #0066FF 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(24, 119, 242, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                marginBottom: '8px',
                transition: 'transform 0.15s ease',
              }}
            >
              <span style={{
                background: '#ffffff',
                color: '#1877F2',
                borderRadius: '50%',
                width: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
                fontWeight: 800,
                lineHeight: 1,
              }}>f</span>
              <span>Connect Instagram via Meta Login</span>
              <span style={{
                fontSize: '10px',
                background: 'rgba(255,255,255,0.25)',
                padding: '2px 7px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: 700,
              }}>Recommended</span>
            </button>

            <p style={{
              fontSize: '11.5px',
              color: 'var(--text-muted)',
              margin: '0 0 16px 0',
              lineHeight: 1.4,
              textAlign: 'center',
            }}>
              💡 Meta manages Instagram Business APIs. When prompted, select your Instagram profile to grant automation access.
            </p>

            {/* Explanation box for Instagram Direct Login Error */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 14px',
              textAlign: 'left',
              fontSize: '11.5px',
              color: '#475569',
              lineHeight: 1.45,
              marginBottom: '14px',
            }}>
              <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>ℹ️ Seeing "Sorry, this page isn't available" on Instagram?</span>
              </div>
              <p style={{ margin: 0 }}>
                Meta App <code>28265020499789803</code> is in <strong>Development Mode</strong>. Meta blocks direct <code>instagram.com</code> logins unless your username is added as an <strong>Instagram Tester</strong> in the Meta App Dashboard.
                <br />
                👉 Use the blue <strong>"Connect via Meta Login"</strong> button above, or paste a token in the <strong>Access Token</strong> tab.
              </p>
            </div>

            {/* Direct Instagram Login Alternate */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0', color: 'var(--text-light)', fontSize: '11px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
              <span style={{ padding: '0 8px' }}>or direct login (testers only)</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            </div>

            <button
              type="button"
              onClick={handleInstagramOAuth}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--bg-subtle)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-subtle)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Instagram size={16} color="#dc2743" />
              <span>Log in with Instagram Credentials</span>
            </button>
          </div>
        )}

        {/* Tab 2: Manual Access Token */}
        {tab === 'token' && (
          <form onSubmit={handleManualTokenConnect} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                Meta User or Page Access Token
              </label>
              <textarea
                rows={3}
                required
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste token starting with EAABsb... (from Graph API Explorer or Meta App)"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-subtle)',
                  fontSize: '12.5px',
                  outline: 'none',
                  fontFamily: 'monospace',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px', display: 'block' }}>
                The server will query Meta Graph API to auto-discover your Facebook Page ID, Page Access Token, and Instagram Business Account.
              </span>
              <div style={{
                marginTop: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11.5px',
                color: 'var(--text-muted)',
                lineHeight: 1.45,
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  ⚡ Quick Token Guide (Instant 0-Redirect Connect):
                </div>
                <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <li>Open <a href="https://developers.facebook.com/tools/explorer/?app_id=28265020499789803" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>Meta Graph API Explorer ↗</a></li>
                  <li>Ensure Meta App <code>28265020499789803</code> is selected</li>
                  <li>Click <strong>Generate Access Token</strong> and copy the token</li>
                  <li>Paste below and click Verify!</li>
                </ol>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                background: 'var(--primary-gradient)',
                color: '#ffffff',
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 18px rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={16} />
              <span>{loading ? 'Verifying with Meta API...' : 'Verify & Connect Account'}</span>
            </button>
          </form>
        )}

        {/* Tab 3: Instant Sandbox */}
        {tab === 'sandbox' && (
          <div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px', textAlign: 'left', lineHeight: 1.45 }}>
              Use our pre-configured sandbox environment with simulated Instagram webhooks, test followers, and keyword response verification.
            </p>
            <button
              type="button"
              onClick={handleSandboxConnect}
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                background: 'var(--bg-subtle)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-subtle)',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={16} color="var(--primary)" />
              <span>{loading ? 'Connecting Sandbox...' : 'Connect Instant Sandbox (@luna.creates)'}</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: '14px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-light)',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
