// frontend/src/components/SettingsView.jsx
import React, { useState } from 'react';
import { Instagram, Key, Shield, CheckCircle2, Copy, ExternalLink, RefreshCw } from 'lucide-react';

export default function SettingsView({ account, onOpenConnect }) {
  const [copied, setCopied] = useState(false);
  const webhookUrl = `${window.location.origin}/api/webhook`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
                background: 'linear-gradient(135deg, #f09433, #dc2743)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}>
                <Instagram size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Connected Instagram Account
                </h2>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                  Auto-detected via Meta Graph API OAuth 2.0
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenConnect}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reconnect / Switch Account
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '16px' }}>
            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600 }}>USERNAME</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                @{account?.username || 'luna.creates'}
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600 }}>ACCOUNT TYPE</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                {account?.account_type || 'Business Account'}
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600 }}>INSTAGRAM USER ID</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px', fontFamily: 'monospace' }}>
                {account?.ig_user_id || '17841405309211849'}
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600 }}>FACEBOOK PAGE ID</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px', fontFamily: 'monospace' }}>
                {account?.fb_page_id || '102938475629102'}
              </div>
            </div>
          </div>
        </div>

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
            <strong>Verify Token:</strong> <code style={{ background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: '4px' }}>instareply_verify_token_2026</code>
          </div>
        </div>
      </div>
    </div>
  );
}
