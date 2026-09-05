// frontend/src/components/UpgradeModal.jsx
import React, { useState } from 'react';
import { X, Crown, Check, Sparkles, Zap, ShieldCheck, CreditCard, FileText } from 'lucide-react';
import { apiFetch } from '../api/client';

export default function UpgradeModal({ isOpen, onClose, onUpgraded }) {
  const [loading, setLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/usage/upgrade', {
        method: 'POST',
        body: JSON.stringify({ plan: 'pro', cycle: billingCycle }),
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

  const displayPrice = billingCycle === 'yearly' ? '₹1,099' : '₹1,499';

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(5px)',
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
        {/* Close Button */}
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

        {/* Top Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
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
            Upgrade to ReplyOS Pro
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0 }}>
            Unlock unlimited volume, AI smart replies, and maximum engagement.
          </p>

          {/* Billing Cycle Switch */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--bg-subtle)',
            padding: '3px',
            borderRadius: '10px',
            marginTop: '16px',
            border: '1px solid var(--border-subtle)',
          }}>
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: billingCycle === 'monthly' ? 'var(--primary, #6366f1)' : 'transparent',
                color: billingCycle === 'monthly' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: billingCycle === 'yearly' ? 'var(--primary, #6366f1)' : 'transparent',
                color: billingCycle === 'yearly' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Yearly (Save 25%)
            </button>
          </div>

          {/* Price */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px', margin: '16px 0 4px' }}>
            <span style={{ fontSize: '38px', fontWeight: 800, color: 'var(--text-main)' }}>{displayPrice}</span>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ month</span>
          </div>
          {billingCycle === 'yearly' && (
            <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: 600 }}>
              ₹13,188 billed annually + 2 months free
            </div>
          )}
        </div>

        {/* Feature Highlights */}
        <div style={{
          background: 'var(--bg-subtle)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {[
            'Unlimited automated DMs & comment replies',
            'Unlimited keyword automation rules',
            'Dynamic {username} lead personalization',
            'Priority Meta Graph API queue delivery',
            '18% GST Tax Invoice for Indian businesses',
            'UPI, Net Banking & RuPay/Cards accepted',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-main)' }}>
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
                <Check size={11} strokeWidth={3.5} />
              </div>
              <span>{item}</span>
            </div>
          ))}
        </div>

        {/* Payment Methods Banner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          fontSize: '11.5px',
          color: 'var(--text-muted)',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Pay securely via:</span>
          <span>Google Pay</span> • <span>PhonePe</span> • <span>Paytm</span> • <span>UPI</span> • <span>Cards</span> • <span>NetBanking</span>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          onClick={handleUpgrade}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#ffffff',
            border: 'none',
            fontSize: '14.5px',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
            transition: 'all 0.15s ease',
          }}
        >
          {loading ? 'Activating Pro Plan...' : `Upgrade to Pro Now — ${displayPrice}/mo`}
        </button>

        <p style={{ fontSize: '11.5px', color: 'var(--text-light)', textAlign: 'center', marginTop: '12px', margin: '12px 0 0' }}>
          Instant activation. Cancel anytime in 1-click with no questions asked.
        </p>
      </div>
    </div>
  );
}
