// frontend/src/components/UpgradeModal.jsx
import React, { useState } from 'react';
import { X, Crown, Check, Sparkles, Zap, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../api/client';

export default function UpgradeModal({ isOpen, onClose, onUpgraded }) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/usage/upgrade', {
        method: 'POST',
        body: JSON.stringify({ plan: 'pro' }),
      });
      if (res.ok) {
        if (onUpgraded) onUpgraded('pro');
        alert('🎉 Congratulations! Your account has been upgraded to Pro Plan with Unlimited DMs!');
        onClose();
      }
    } catch (err) {
      alert('Upgrade error: ' + err.message);
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
        borderRadius: '24px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-light)',
        overflow: 'hidden',
        position: 'relative',
        padding: '32px 28px',
      }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            border: 'none',
            background: 'var(--bg-subtle)',
            color: 'var(--text-light)',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)',
          }}>
            <Crown size={28} />
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
            Upgrade to InstaReply Pro
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
            Unlock unlimited volume, AI smart replies, and maximum engagement.
          </p>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px', margin: '18px 0 6px' }}>
            <span style={{ fontSize: '38px', fontWeight: 800, color: 'var(--text-main)' }}>$29</span>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ month</span>
          </div>
          <span style={{ fontSize: '11.5px', color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '3px 10px', borderRadius: '99px' }}>
            Save 20% with annual billing
          </span>
        </div>

        {/* Feature checklist */}
        <div style={{
          background: 'var(--bg-subtle)',
          borderRadius: '14px',
          padding: '18px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          fontSize: '13px',
        }}>
          {[
            'Unlimited automated DMs & comment replies',
            'Unlimited active automation rules',
            'Smart AI reply generator powered by OpenAI GPT-4o',
            'Fuzzy keyword & sentiment matching',
            'Priority webhook dispatch queue',
            'Detailed analytics & CSV lead export',
          ].map((text, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Check size={12} strokeWidth={3} />
              </div>
              <span style={{ color: 'var(--text-main)' }}>{text}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleUpgrade}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
            color: '#fff',
            border: 'none',
            fontSize: '14.5px',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 6px 18px rgba(99, 102, 241, 0.4)',
          }}
        >
          {loading ? 'Activating Pro Plan...' : 'Upgrade to Pro Now — $29/mo'}
        </button>
      </div>
    </div>
  );
}
