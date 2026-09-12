// frontend/src/components/BillingView.jsx
import React, { useState, useEffect } from 'react';
import { Check, Crown, Zap, Shield, Sparkles, HelpCircle, FileText, CreditCard, ArrowRight } from 'lucide-react';
import { apiFetch } from '../api/client';

const STATIC_PLANS = [
  { id: 'free', slug: 'free', name: 'Starter / Free', monthlyPrice: 0, annualPrice: 0, period: '/month', description: 'Ideal for creators testing automated DM responses on real traffic.', features: ['Up to 1,000 automated DMs / month', 'Up to 5 active keyword rules', 'Comment-to-DM auto response', 'Instant keyword triggers', 'Standard Instagram delivery speed', 'Community support'], popular: false },
  { id: 'pro', slug: 'pro', name: 'Pro Creator', monthlyPrice: 1499, annualPrice: 1099, period: '/month', badge: 'MOST POPULAR IN INDIA', description: 'Built for fast-growing Indian creators, coaches, and D2C brands.', features: ['Unlimited automated DMs & comments', 'Unlimited active automation rules', 'Dynamic {username} personalization', 'Lead capture & email collector sequences', 'Dedicated high-priority Meta queue', 'Full conversation logs & thread analytics', 'Priority WhatsApp & email support', 'GST invoice with 18% Input Credit'], popular: true },
  { id: 'enterprise', slug: 'enterprise', name: 'Agency & Enterprise', monthlyPrice: 4999, annualPrice: 3749, period: '/month', description: 'For digital agencies & multi-brand growth teams in India.', features: ['Everything in Pro Creator', 'Manage up to 10 Instagram accounts', 'Multi-user team dashboard access', 'Webhook integrations (Shopify, Shiprocket, CRM)', 'Dedicated account manager in India', 'Custom onboarding & setup call', 'Official vendor GST contract'], popular: false },
];

export default function BillingView({ user, onUpgrade }) {
  const currentPlan = user?.plan || 'free';
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [plans, setPlans] = useState(STATIC_PLANS);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    apiFetch('/billing/plans')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && Array.isArray(data.plans) && data.plans.length > 0) {
          // Merge API plans with current-plan state
          const merged = data.plans.map(p => ({
            ...p,
            current: (p.slug || p.id || '').toLowerCase() === currentPlan,
            buttonText: (p.slug || p.id || '').toLowerCase() === currentPlan
              ? 'Current Active Plan'
              : `Upgrade to ${p.name}`
          }));
          setPlans(merged);
        }
      })
      .catch(() => {})
      .finally(() => setPlansLoading(false));
  }, [currentPlan]);

  // Augment with current-plan metadata
  const normCurrent = (currentPlan || 'free').toLowerCase().trim();
  const displayPlans = plans.map(p => {
    const pSlug = (p.slug || '').toLowerCase().trim();
    const pId = (p.id || '').toLowerCase().trim();
    const pName = (p.name || '').toLowerCase().trim();
    const isCurrent = pSlug === normCurrent || pId === normCurrent || pName === normCurrent;

    let featuresList = Array.isArray(p.features) && p.features.length > 0 ? p.features : [];
    if (featuresList.length === 0) {
      featuresList = [
        (p.dmLimit >= 500000 || p.dmLimit === 0) ? 'Unlimited automated DMs & comments' : `Up to ${(p.dmLimit || 1000).toLocaleString()} automated DMs / month`,
        `Up to ${p.igLimit || 1} connected Instagram Account${(p.igLimit || 1) > 1 ? 's' : ''}`,
        `Up to ${p.rulesLimit || 5} active keyword automation rules`,
        'Instant Meta Graph API trigger response',
        'Full conversation logs & thread analytics',
        'GST invoice with 18% Input Credit'
      ];
    }

    return {
      ...p,
      features: featuresList,
      current: isCurrent,
      buttonText: isCurrent
        ? 'Current Active Plan'
        : (p.monthlyPrice === 0 ? 'Downgrade to Free' : `Upgrade to ${p.name}`),
      monthlyPriceLabel: `₹${(p.monthlyPrice || 0).toLocaleString('en-IN')}`,
      yearlyPriceLabel: `₹${(p.annualPrice || p.monthlyPrice || 0).toLocaleString('en-IN')}`,
      annualBilledText: p.savingsPct > 0
        ? `₹${((p.annualPrice || 0) * 12).toLocaleString('en-IN')} billed annually (Save ${p.savingsPct}%)`
        : undefined,
    };
  });

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 32px' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          borderRadius: '99px',
          background: 'rgba(99, 102, 241, 0.1)',
          color: 'var(--primary, #6366f1)',
          fontSize: '12.5px',
          fontWeight: 700,
          marginBottom: '12px',
        }}>
          <Crown size={14} /> SIMPLE &amp; TRANSPARENT PRICING FOR INDIA
        </span>
        <h1 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: '0 0 10px 0' }}>
          Scale your Instagram engagement in Rupees
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
          No hidden international conversion charges. Instant activation with UPI, Cards &amp; Net Banking with GST invoices.
        </p>

        {/* Monthly / Yearly Billing Switch */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'var(--bg-card)',
          padding: '4px',
          borderRadius: '14px',
          border: '1px solid var(--border-light)',
          marginTop: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: 'none',
              background: billingCycle === 'monthly' ? 'var(--primary, #6366f1)' : 'transparent',
              color: billingCycle === 'monthly' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: 'none',
              background: billingCycle === 'yearly' ? 'var(--primary, #6366f1)' : 'transparent',
              color: billingCycle === 'yearly' ? '#ffffff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Annual Billing</span>
            <span style={{
              background: '#ecfdf5',
              color: '#059669',
              padding: '2px 8px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 800,
            }}>
              SAVE 25%
            </span>
          </button>
        </div>
      </div>

      {/* Dynamic Responsive Plan Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'stretch' }}>
        {displayPlans.map((plan) => {
          const displayPrice = billingCycle === 'yearly' ? plan.yearlyPriceLabel : plan.monthlyPriceLabel;
          return (
            <div
              key={plan.id}
              style={{
                padding: '30px 28px',
                borderRadius: '22px',
                background: 'var(--bg-card)',
                border: plan.badge ? '2px solid var(--primary, #6366f1)' : '1px solid var(--border-light)',
                boxShadow: plan.badge ? '0 12px 30px rgba(99, 102, 241, 0.15)' : 'var(--shadow-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
              }}
            >
              {plan.badge && (
                <span style={{
                  position: 'absolute',
                  top: '-13px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '5px 14px',
                  borderRadius: '99px',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                }}>
                  {plan.badge}
                </span>
              )}

              <div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>
                  {plan.name}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', minHeight: '38px', lineHeight: 1.45 }}>
                  {plan.description}
                </p>

                <div style={{ margin: '22px 0 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontSize: '38px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                      {displayPrice}
                    </span>
                    <span style={{ fontSize: '13.5px', color: 'var(--text-muted)' }}>
                      {plan.period}
                    </span>
                  </div>

                  {billingCycle === 'yearly' && plan.annualBilledText && (
                    <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                      {plan.annualBilledText}
                    </div>
                  )}
                </div>

                <div style={{ height: '1px', background: 'var(--border-light)', margin: '20px 0' }} />

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '13px' }}>
                  {plan.features.map((feat, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.4 }}>
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
                        marginTop: '1px',
                      }}>
                        <Check size={11} strokeWidth={3.5} />
                      </div>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                disabled={plan.current}
                onClick={() => onUpgrade(plan.id)}
                style={{
                  marginTop: '32px',
                  width: '100%',
                  padding: '13px',
                  borderRadius: '12px',
                  background: plan.current ? 'var(--bg-subtle)' : (plan.badge ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--primary, #6366f1)'),
                  color: plan.current ? 'var(--text-light)' : '#ffffff',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: plan.current ? 'default' : 'pointer',
                  boxShadow: plan.badge && !plan.current ? '0 6px 18px rgba(99, 102, 241, 0.35)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {plan.buttonText}
              </button>
            </div>
          );
        })}
      </div>

      {/* India Payment Methods & GST Banner */}
      <div style={{
        marginTop: '40px',
        padding: '24px 32px',
        borderRadius: '18px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <FileText size={22} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
              100% Indian Tax Compliant (GST Invoicing)
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Enter your GSTIN number to receive official monthly tax invoices with 18% Input Tax Credit (ITC).
            </div>
          </div>
        </div>

        {/* Payment Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {['UPI / QR', 'Google Pay', 'PhonePe', 'Paytm', 'RuPay', 'NetBanking', 'Credit/Debit'].map((method, idx) => (
            <span
              key={idx}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'var(--bg-subtle)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid var(--border-subtle)',
              }}
            >
              {method}
            </span>
          ))}
        </div>
      </div>

      {/* India FAQ Accordion */}
      <div style={{ marginTop: '48px', maxWidth: '880px', margin: '48px auto 0' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', textAlign: 'center', marginBottom: '24px' }}>
          Frequently Asked Questions (India)
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            {
              q: 'Can I pay via UPI, Google Pay, or PhonePe?',
              a: 'Yes! We support all Indian payment modes including UPI, Google Pay, PhonePe, Paytm, RuPay cards, and Net Banking across all Indian banks.',
            },
            {
              q: 'Do you provide a GST Invoice for Indian businesses?',
              a: 'Yes. Upon upgrading, you can enter your registered business name and GSTIN to instantly generate a tax invoice and claim 18% GST Input Tax Credit (ITC).',
            },
            {
              q: 'What happens when I hit the 1,000 Free DM limit?',
              a: 'Your account safely pauses automated replies until the next monthly cycle or until you upgrade to Pro. You will never be charged unexpected overage fees.',
            },
            {
              q: 'Is this compliant with Instagram / Meta platform policies in India?',
              a: 'Yes! Our tool connects strictly via the official Meta Graph API v21.0, honoring the 24-hour customer messaging window to keep your Instagram account 100% safe.',
            },
          ].map((faq, i) => (
            <div
              key={i}
              style={{
                padding: '18px 22px',
                borderRadius: '14px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                {faq.q}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {faq.a}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
