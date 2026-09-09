// frontend/src/components/ConnectIgModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Instagram, CheckCircle2, Shield, ArrowRight, ExternalLink } from 'lucide-react';
import { getToken } from '../api/client';

export default function ConnectIgModal({ isOpen, onClose, onConnected }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Listen for popup window completion message from Meta OAuth
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
      'Airvix_Meta_Auth',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=no,resizable=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
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

  const getBackendUrl = () => {
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '');
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${window.location.protocol}//${window.location.hostname}:3000`;
    }
    return 'https://instaautodm-kh61.onrender.com';
  };

  // Instagram-only OAuth — uses native Instagram Business Login (instagram.com)
  const handleInstagramOAuth = () => {
    const origin = window.location.origin;
    const token = getToken() || '';
    const BACKEND = getBackendUrl();
    const startUrl = `${BACKEND}/api/instagram/oauth/start?type=instagram&return_origin=${encodeURIComponent(origin)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    openOAuthPopup(startUrl);
  };

  // Facebook OAuth — alternative for accounts linked to a Facebook Page
  const handleFacebookOAuth = () => {
    const origin = window.location.origin;
    const token = getToken() || '';
    const BACKEND = getBackendUrl();
    const startUrl = `${BACKEND}/api/instagram/oauth/start?type=facebook&return_origin=${encodeURIComponent(origin)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    openOAuthPopup(startUrl);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border-light)',
        overflow: 'hidden',
        padding: '32px 28px',
        position: 'relative',
        animation: 'fadeIn 0.2s ease-out',
      }}>
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'var(--bg-subtle)',
            border: 'none',
            color: 'var(--text-muted)',
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          <X size={16} />
        </button>

        {/* Brand & Instagram Connected Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          margin: '0 auto 16px',
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: '#ffffff',
            border: '1px solid var(--border-light)',
            boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '7px',
          }}>
            <img src="/logo-icon.png" alt="Airvix" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ color: 'var(--text-light)', fontSize: '18px', fontWeight: 600 }}>+</div>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 8px 22px rgba(220, 39, 67, 0.35)',
          }}>
            <Instagram size={28} />
          </div>
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0', textAlign: 'center', letterSpacing: '-0.02em' }}>
          Connect Instagram
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px 0', lineHeight: 1.5, textAlign: 'center' }}>
          Log in with your Instagram Professional (Creator or Business) account via Meta to enable real-time automations.
        </p>

        {error && (
          <div style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            fontSize: '12.5px',
            fontWeight: 500,
            marginBottom: '18px',
            textAlign: 'left',
            lineHeight: 1.4,
          }}>
            {error}
          </div>
        )}

        {/* Benefits Checklist */}
        <div style={{
          textAlign: 'left',
          background: 'var(--bg-subtle)',
          borderRadius: '14px',
          padding: '16px 18px',
          marginBottom: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontSize: '12.5px',
          color: 'var(--text-main)',
          border: '1px solid var(--border-light)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={16} color="#10b981" />
            <span>Auto-fetches real profile name, avatar &amp; follower count</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={16} color="#10b981" />
            <span>Enables 24/7 instant DM replies &amp; Follower Check gates</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={16} color="#10b981" />
            <span>Official Meta Graph API authorized connection</span>
          </div>
        </div>

        {/* Primary Action: Instagram OAuth */}
        <button
          type="button"
          onClick={handleInstagramOAuth}
          disabled={loading}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
            color: '#ffffff',
            border: 'none',
            fontSize: '15px',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 28px rgba(220, 39, 67, 0.38)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '12px',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            opacity: loading ? 0.75 : 1,
          }}
        >
          <Instagram size={20} />
          <span>{loading ? 'Opening Meta Login...' : 'Continue with Instagram'}</span>
        </button>

        {/* Secondary Alternative: Facebook Page Login */}
        <button
          type="button"
          onClick={handleFacebookOAuth}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '12px',
            background: 'rgba(24, 119, 242, 0.08)',
            color: '#1877f2',
            border: '1px solid rgba(24, 119, 242, 0.25)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '18px',
            transition: 'all 0.15s ease',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877f2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <span>Or connect via Facebook Page (Meta Business)</span>
        </button>

        {/* Security and Trust Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontSize: '11.5px',
          color: 'var(--text-light)',
          marginBottom: '12px',
        }}>
          <Shield size={13} color="#10b981" />
          <span>Official Meta Verified App Integration • Safe &amp; Compliant</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: '12.5px',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
