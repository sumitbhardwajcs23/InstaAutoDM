// frontend/src/components/BillingView.jsx
import React from 'react';
import { Check, Crown, Zap, Shield, Sparkles } from 'lucide-react';

export default function BillingView({ user, onUpgrade }) {
  const currentPlan = user?.plan || 'free';

  const plans = [
    {
      id: 'free',
      name: 'Starter / Free',
      price: '$0',
      period: '/month',
      description: 'Perfect for testing and small accounts starting with automation.',
      features: [
        'Up to 1,000 automated DMs / month',
        'Up to 5 active automation rules',
        'Comment auto-replies',
        'Basic keyword matching',
        'Standard response speed',
      ],
      current: currentPlan === 'free',
      buttonText: currentPlan === 'free' ? 'Current Plan' : 'Downgrade to Free',
    },
    {
      id: 'pro',
      name: 'Pro Automation',
      price: '$29',
      period: '/month',
      badge: 'POPULAR',
      description: 'For growing creators, influencers, and e-commerce stores.',
      features: [
        'Unlimited automated DMs & comments',
        'Unlimited active automation rules',
        'AI smart response generation (GPT-4o)',
        'Fuzzy keyword & sentiment matching',
        'Priority Instagram webhook queue',
        'Exportable analytics & CSV leads',
        '24/7 Priority support',
      ],
      current: currentPlan === 'pro',
      buttonText: currentPlan === 'pro' ? 'Current Plan' : 'Upgrade to Pro',
    },
    {
      id: 'enterprise',
      name: 'Agency & Enterprise',
      price: '$99',
      period: '/month',
      description: 'For marketing agencies handling multiple brand accounts.',
      features: [
        'Everything in Pro',
        'Manage up to 10 Instagram accounts',
        'Dedicated IP & proxy routing',
        'Custom webhooks & CRM webhooks',
        'White-label dashboard',
        'Dedicated account manager',
      ],
      current: currentPlan === 'enterprise',
      buttonText: 'Contact Sales',
    },
  ];

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 36px' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '99px',
          background: 'var(--primary-light)',
          color: 'var(--primary)',
          fontSize: '12px',
          fontWeight: 700,
          marginBottom: '12px',
        }}>
          <Crown size={14} /> FLEXIBLE PRICING
        </span>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
          Scale your Instagram engagement effortlessly
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Choose a plan that fits your growth. Upgrade, downgrade, or cancel anytime.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', alignItems: 'stretch' }}>
        {plans.map((plan) => (
          <div
            key={plan.id}
            style={{
              padding: '28px',
              borderRadius: '20px',
              background: 'var(--bg-card)',
              border: plan.badge ? '2px solid var(--primary)' : '1px solid var(--border-light)',
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
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '4px 12px',
                borderRadius: '99px',
                background: 'var(--primary-gradient)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.05em',
              }}>
                {plan.badge}
              </span>
            )}

            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
                {plan.name}
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '6px', minHeight: '36px' }}>
                {plan.description}
              </p>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '20px 0' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-main)' }}>
                  {plan.price}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {plan.period}
                </span>
              </div>

              <div style={{ height: '1px', background: 'var(--border-light)', marginBottom: '20px' }} />

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {plan.features.map((feat, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-main)' }}>
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
                marginTop: '28px',
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: plan.current ? 'var(--bg-subtle)' : (plan.badge ? 'var(--primary-gradient)' : 'var(--primary)'),
                color: plan.current ? 'var(--text-light)' : '#ffffff',
                border: 'none',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: plan.current ? 'default' : 'pointer',
                boxShadow: plan.badge && !plan.current ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
              }}
            >
              {plan.buttonText}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
