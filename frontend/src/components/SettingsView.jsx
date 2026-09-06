// frontend/src/components/SettingsView.jsx
import React, { useState } from 'react';
import { Instagram, Key, Shield, CheckCircle2, Copy, ExternalLink, RefreshCw, Edit3 } from 'lucide-react';
import { apiFetch } from '../api/client';

export default function SettingsView({ account, onOpenConnect, onDisconnectAccount, onRefresh }) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editHandle, setEditHandle] = useState('');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const webhookUrl = 'https://instaautodm-kh61.onrender.com/webhooks/instagram';

  const isConnected = !!(account && (account.status === 'connected' || account.username));

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveHandle = async (e) => {
    e.preventDefault();
    const clean = editHandle.replace(/^@/, '').trim().toLowerCase();
    if (!clean) return;
    setSaving(true);
    try {
      const res = await apiFetch('/instagram/account/set-handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: account?.id,
          username: clean,
          full_name: editName.trim() || clean,
        }),
      });
      if (res.ok) {
        setIsEditing(false);
        if (onRefresh) onRefresh();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update handle');
      }
    } catch (err) {
      alert('Error updating handle: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Account & Webhook Settings
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
          Manage your Meta Developer integration, Facebook Page connection, and Instagram webhook endpoints.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Instagram Account Card */}
        <div className="card" style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: isConnected ? 'linear-gradient(135deg, #f09433, #dc2743)' : 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isConnected ? '#fff' : 'var(--text-muted)',
              }}>
                <Instagram size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Connected Instagram Account
                </h2>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                  {isConnected ? 'Auto-detected via Meta Graph API OAuth 2.0' : 'No Instagram account currently linked'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {isConnected && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditHandle(account.username || '');
                      setEditName(account.full_name || account.username || '');
                      setIsEditing(true);
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Edit Profile / Handle
                  </button>
                  <button
                    type="button"
                    onClick={() => onDisconnectAccount && onDisconnectAccount(account?.id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#dc2626',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Disconnect
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onOpenConnect}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: isConnected ? 'transparent' : 'var(--primary)',
                  color: isConnected ? 'var(--primary)' : '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isConnected ? 'Reconnect / Switch' : 'Connect Instagram Account'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '16px' }}>
            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600 }}>USERNAME</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{isConnected ? `@${account.username}` : 'Not Connected'}</span>
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600 }}>ACCOUNT TYPE</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                {isConnected ? (account?.account_type || account?.accountType || 'Professional Account') : 'Disconnected'}
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600 }}>INSTAGRAM USER ID</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px', fontFamily: 'monospace' }}>
                {isConnected ? (account?.ig_user_id || '—') : '—'}
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600 }}>CONNECTED VIA</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                {isConnected ? (
                  account?.page_id && account.page_id !== account.ig_user_id
                    ? `Facebook Page (${account.fb_page_name || account.page_id})`
                    : 'Instagram Business Login (Direct)'
                ) : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Handle Modal */}
        {isEditing && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 16px 36px rgba(0,0,0,0.3)'
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: 'var(--text-main)' }}>
                Edit Instagram Profile Handle
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                Set your verified Instagram handle and display name for this connection.
              </p>
              <form onSubmit={handleSaveHandle}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-light)', marginBottom: '4px' }}>
                    Instagram Username
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
                    <span style={{ padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>@</span>
                    <input
                      type="text"
                      value={editHandle}
                      onChange={(e) => setEditHandle(e.target.value)}
                      placeholder="e.g. join_sumit_"
                      required
                      style={{ flex: 1, padding: '8px 12px', border: 'none', background: 'transparent', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-light)', marginBottom: '4px' }}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Sumit Bhardwaj"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Webhook Configuration Card */}
        <div className="card" style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
            Meta Webhook Callback URL
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
            Paste this URL into your Meta App Dashboard under <strong>Instagram Graph API &gt; Webhooks</strong>.
          </p>

          <div style={{ display: 'flex', gap: '10px', maxWidth: '680px' }}>
            <input
              type="text"
              readOnly
              value={webhookUrl}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-subtle)',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: 'var(--text-main)',
              }}
            />
            <button
              type="button"
              onClick={handleCopyWebhook}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 16px',
                borderRadius: '10px',
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-light)' }}>
            <strong>Verify Token:</strong> <code style={{ background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: '4px' }}>instagram_autoreply_verify_token_2026</code>
          </div>
        </div>
      </div>
    </div>
  );
}
