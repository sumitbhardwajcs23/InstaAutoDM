// frontend/src/components/UpgradeModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Crown, Check, Sparkles, Zap, ShieldCheck, CreditCard, FileText, ChevronDown, Building } from 'lucide-react';
import { apiFetch } from '../api/client';

const PLAN_DETAILS = {
  pro: {
    name: 'Pro Creator',
    badge: '🔥 MOST POPULAR',
    monthlyPrice: 1499,
    yearlyPrice: 1099,
    annualTotal: 13188,
    features: [
      'Unlimited automated DMs & comment replies',
      'Unlimited keyword automation rules',
      'Dynamic {username} personalization',
      'Priority Meta Graph API queue delivery',
      'Full conversation logs & thread analytics',
      '18% GST Input Tax Credit (ITC) invoice'
    ]
  },
  agency: {
    name: 'Agency Scale',
    badge: '⚡ MULTI-BRAND',
    monthlyPrice: 3999,
    yearlyPrice: 2999,
    annualTotal: 35988,
    features: [
      'Everything in Pro Creator',
      'Up to 10 connected Instagram accounts',
      'Multi-team seat permissions',
      'Dedicated high-throughput Meta queue',
      'Webhooks for Shopify, CRM & Lead pipelines',
      'Priority WhatsApp VIP support'
    ]
  },
  enterprise: {
    name: 'Enterprise VIP',
    badge: '👑 CUSTOM VOLUME',
    monthlyPrice: 7999,
    yearlyPrice: 5999,
    annualTotal: 71988,
    features: [
      'Everything in Agency Scale',
      'Unlimited connected Instagram accounts',
      'Custom rate limit bypass & dedicated IP',
      'Custom webhook triggers & private API',
      'Dedicated account manager in India',
      'SLA guarantee & custom billing contract'
    ]
  }
};

export default function UpgradeModal({ isOpen, onClose, onUpgraded, initialPlan = 'pro' }) {
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [loading, setLoading] = useState(false);
  const [showGstForm, setShowGstForm] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  useEffect(() => {
    if (initialPlan && PLAN_DETAILS[initialPlan.toLowerCase()]) {
      setSelectedPlan(initialPlan.toLowerCase());
    }
  }, [initialPlan, isOpen]);

  if (!isOpen) return null;

  const currentPlanMeta = PLAN_DETAILS[selectedPlan] || PLAN_DETAILS.pro;
  const currentPrice = billingCycle === 'yearly' ? currentPlanMeta.yearlyPrice : currentPlanMeta.monthlyPrice;
  const formattedPrice = `₹${currentPrice.toLocaleString('en-IN')}`;

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      // 1. Ensure Razorpay checkout script is loaded
      await loadRazorpayScript();

      // 2. Create order on backend
      const res = await apiFetch('/billing/create-checkout', {
        method: 'POST',
        body: JSON.stringify({
          plan: selectedPlan,
          cycle: billingCycle,
          gateway: 'razorpay'
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to initiate Razorpay checkout');
      }

      const orderData = await res.json();

      // 3. Open Razorpay Checkout modal if Razorpay is available
      if (window.Razorpay && orderData.key_id && !orderData.key_id.includes('placeholder')) {
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'Airvix Technologies',
          description: `${currentPlanMeta.name} (${billingCycle.toUpperCase()})`,
          order_id: orderData.order_id,
          prefill: {
            name: orderData.user?.name || businessName || '',
            email: orderData.user?.email || '',
            contact: orderData.user?.phone || ''
          },
          notes: {
            plan: selectedPlan,
            cycle: billingCycle,
            business_name: businessName,
            gst_number: gstNumber
          },
          theme: {
            color: '#6366f1'
          },
          handler: async function (response) {
            try {
              const verifyRes = await apiFetch('/billing/verify-payment', {
                method: 'POST',
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id || orderData.order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  plan: selectedPlan,
                  cycle: billingCycle,
                  billing_name: businessName || orderData.user?.name,
                  billing_email: orderData.user?.email,
                  gst_number: gstNumber
                })
              });

              if (verifyRes.ok) {
                const verifyData = await verifyRes.json();
                if (onUpgraded) onUpgraded(verifyData.plan || selectedPlan);
                alert(`🎉 Payment Successful! Your account has been upgraded to ${selectedPlan.toUpperCase()} plan.`);
                onClose();
              } else {
                const err = await verifyRes.json();
                alert(`Payment verification notice: ${err.error || 'Please refresh to verify'}`);
              }
            } catch (vErr) {
              alert('Verification request failed: ' + vErr.message);
            } finally {
              setLoading(false);
            }
          },
          modal: {
            ondismiss: function () {
              setLoading(false);
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          setLoading(false);
          alert(`Payment failed: ${resp.error?.description || 'Transaction declined'}`);
        });
        rzp.open();
      } else {
        // Test / Development simulated checkout when keys are placeholders or dev mode
        const confirmTest = window.confirm(
          `[Razorpay Demo Mode] Proceed to activate ${currentPlanMeta.name} (${billingCycle}) for ${formattedPrice}? (Simulated Payment)`
        );
        if (confirmTest) {
          const verifyRes = await apiFetch('/billing/verify-payment', {
            method: 'POST',
            body: JSON.stringify({
              razorpay_order_id: orderData.order_id,
              razorpay_payment_id: `pay_sim_${Date.now().toString().slice(-8)}`,
              razorpay_signature: 'test_signature',
              plan: selectedPlan,
              cycle: billingCycle,
              billing_name: businessName || orderData.user?.name,
              billing_email: orderData.user?.email,
              gst_number: gstNumber
            })
          });

          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            if (onUpgraded) onUpgraded(verifyData.plan || selectedPlan);
            alert(`🎉 Subscription Activated! Upgraded to ${selectedPlan.toUpperCase()} plan.`);
            onClose();
          } else {
            const err = await verifyRes.json();
            alert(`Error activating plan: ${err.error || 'Failed'}`);
          }
        }
        setLoading(false);
      }
    } catch (err) {
      alert('Checkout error: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '90vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1px solid var(--border-light, #e2e8f0)',
        overflowY: 'auto',
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
            background: 'var(--bg-subtle, #f1f5f9)',
            color: 'var(--text-light, #64748b)',
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
            margin: '0 auto 14px',
            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)',
          }}>
            <Crown size={28} />
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 6px 0' }}>
            Upgrade with Razorpay
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-muted, #64748b)', margin: 0 }}>
            Instant activation via UPI, Cards, NetBanking with Official GST Invoice.
          </p>

          {/* Plan Selector Pills */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginTop: '18px',
          }}>
            {Object.entries(PLAN_DETAILS).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedPlan(key)}
                style={{
                  padding: '10px 8px',
                  borderRadius: '12px',
                  border: selectedPlan === key ? '2px solid #6366f1' : '1px solid var(--border-light, #e2e8f0)',
                  background: selectedPlan === key ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-subtle, #f8fafc)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: selectedPlan === key ? '#4f46e5' : 'var(--text-main, #0f172a)' }}>
                  {p.name.split(' ')[0]}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                  ₹{billingCycle === 'yearly' ? p.yearlyPrice : p.monthlyPrice}/mo
                </div>
              </button>
            ))}
          </div>

          {/* Billing Cycle Switch */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--bg-subtle, #f1f5f9)',
            padding: '4px',
            borderRadius: '10px',
            marginTop: '14px',
            border: '1px solid var(--border-subtle, #e2e8f0)',
          }}>
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: billingCycle === 'monthly' ? 'var(--primary, #6366f1)' : 'transparent',
                color: billingCycle === 'monthly' ? '#ffffff' : 'var(--text-muted, #64748b)',
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
                color: billingCycle === 'yearly' ? '#ffffff' : 'var(--text-muted, #64748b)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Yearly (Save 25%)
            </button>
          </div>

          {/* Price Header */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px', margin: '14px 0 2px' }}>
            <span style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>{formattedPrice}</span>
            <span style={{ fontSize: '14px', color: 'var(--text-muted, #64748b)' }}>/ month</span>
          </div>
          {billingCycle === 'yearly' && (
            <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: 600 }}>
              ₹{currentPlanMeta.annualTotal.toLocaleString('en-IN')} billed annually (includes 2 months free)
            </div>
          )}
        </div>

        {/* Feature Highlights */}
        <div style={{
          background: 'var(--bg-subtle, #f8fafc)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '9px',
          border: '1px solid var(--border-light, #e2e8f0)'
        }}>
          {currentPlanMeta.features.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-main, #0f172a)' }}>
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

        {/* GST / Business Details Optional Accordion */}
        <div style={{ marginBottom: '18px' }}>
          <button
            type="button"
            onClick={() => setShowGstForm(!showGstForm)}
            style={{
              background: 'none',
              border: 'none',
              color: '#4f46e5',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: 0
            }}
          >
            <Building size={14} />
            <span>{showGstForm ? 'Hide GST & Business Info' : '+ Add GSTIN / Business Name for Tax Invoice'}</span>
          </button>

          {showGstForm && (
            <div style={{
              marginTop: '10px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--bg-subtle, #f8fafc)',
              border: '1px solid var(--border-light, #e2e8f0)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <input
                type="text"
                placeholder="Business / Legal Name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px'
                }}
              />
              <input
                type="text"
                placeholder="GSTIN (e.g. 29ABCDE1234F1Z5)"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px'
                }}
              />
            </div>
          )}
        </div>

        {/* Razorpay Badges */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '11px',
          color: 'var(--text-muted, #64748b)',
          marginBottom: '18px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>Secured by Razorpay:</span>
          <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>UPI / QR</span>
          <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Google Pay</span>
          <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>PhonePe</span>
          <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>RuPay / Cards</span>
          <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>NetBanking</span>
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
            fontSize: '15px',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
            transition: 'all 0.15s ease',
          }}
        >
          {loading ? 'Opening Razorpay Gateway...' : `Pay ${formattedPrice} with Razorpay`}
        </button>

        <p style={{ fontSize: '11px', color: 'var(--text-light, #94a3b8)', textAlign: 'center', marginTop: '12px', margin: '12px 0 0' }}>
          Instant activation. Meta Graph API v21.0 Compliant. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
