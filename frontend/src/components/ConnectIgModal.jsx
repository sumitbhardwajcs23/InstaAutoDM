// frontend/src/components/ConnectIgModal.jsx
import React, { useState } from 'react';
import { X, Instagram, CheckCircle2, Sparkles, ExternalLink, Shield } from 'lucide-react';
import { apiFetch, getToken, API_BASE } from '../api/client';

export default function ConnectIgModal({ isOpen, onClose, onConnected }) {
  const [tab, setTab] = useState('oauth'); // 'oauth' | 'token' | 'sandbox'
  const [manualToken, setManualToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleRealOAuth = () => {
    const token = getToken();
    const origin = window.location.origin;
    window.location.href = `${API_BASE}/instagram/oauth/start?token=${encodeURIComponent(token || '')}&return_origin=${encodeURIComponent(origin)}`;
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
        {/* Instagram Gradient Icon */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #f09433, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          margin: '0 auto 14px',
          boxShadow: '0 8px 18px rgba(220, 39, 67, 0.3)',
        }}>
          <Instagram size={30} />
        </div>

        <h2 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0', textAlign: 'center' }}>
          Connect Instagram Account
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 18px 0', lineHeight: 1.45, textAlign: 'center' }}>
          Choose your connection method. The system auto-detects Facebook Pages, Instagram Business ID, and webhook settings.
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
            { id: 'oauth', label: 'Meta OAuth' },
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

        {/* Tab 1: Meta OAuth */}
        {tab === 'oauth' && (
          <div>
            <div style={{
              textAlign: 'left',
              background: 'var(--bg-subtle)',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--text-main)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} color="#10b981" />
                <span>Redirects to official Facebook login & permission dialog</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} color="#10b981" />
                <span>Auto-exchanges short-lived token to 60-day token</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} color="#10b981" />
                <span>Subscribes to Graph API webhooks automatically</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRealOAuth}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f09433, #dc2743)',
                color: '#ffffff',
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(220, 39, 67, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Instagram size={18} />
              <span>Login with Facebook (Meta OAuth)</span>
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
