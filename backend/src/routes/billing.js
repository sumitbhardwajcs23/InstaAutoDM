// backend/src/routes/billing.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const billingService = require('../services/billingService');
const { dmLimitFor } = require('../constants/planLimits');

// Plan pricing definitions — static fallback (overridden by admin-configured plans from DB)
const PLAN_PRICES_FALLBACK = {
  free:     { monthly: 0,    yearly: 0 },
  starter:  { monthly: 0,    yearly: 0 },
  pro:      { monthly: 1499, yearly: 13188 },
  agency:   { monthly: 3999, yearly: 35988 },
  business: { monthly: 2999, yearly: 29988 },
  enterprise: { monthly: 7999, yearly: 71988 }
};

// Load admin-configured plans from pricing_plans table or site_settings
async function getAdminStoredPlans() {
  try {
    const rows = await db.prepare("SELECT * FROM pricing_plans WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC").all();
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map(r => {
        let features = [];
        try {
          if (r.features) features = typeof r.features === 'string' ? JSON.parse(r.features) : r.features;
        } catch (_) {
          features = typeof r.features === 'string' ? r.features.split('\n').filter(Boolean) : [];
        }
        return {
          id: r.id,
          slug: r.slug || r.id,
          name: r.name,
          description: r.description || '',
          monthlyPrice: Number(r.monthly_price) || 0,
          annualPrice: Number(r.annual_price) || 0,
          currency: r.currency || 'INR',
          dmLimit: Number(r.dm_limit) || 1000,
          igLimit: Number(r.ig_limit) || 1,
          rulesLimit: Number(r.rules_limit) || 5,
          badge: r.badge_text || '',
          popular: Boolean(r.is_popular),
          active: r.is_active !== 0,
          features
        };
      });
    }
  } catch (e) {}

  try {
    const row = await db.prepare("SELECT value FROM site_settings WHERE key = 'custom_pricing_plans'").get();
    if (row && row.value) {
      const plans = JSON.parse(row.value);
      if (Array.isArray(plans) && plans.length > 0) return plans;
    }
  } catch (e) {}
  return null;
}

// Resolve price (monthly or yearly) for a plan slug from admin settings, falling back to static
async function resolvePlanPrice(planSlug, cycle) {
  const isYearly = cycle === 'yearly';
  const normSlug = (planSlug || '').toLowerCase().trim();
  const adminPlans = await getAdminStoredPlans();
  if (adminPlans && adminPlans.length > 0) {
    const match = adminPlans.find(p =>
      (p.slug || '').toLowerCase().trim() === normSlug ||
      (p.name || '').toLowerCase().trim() === normSlug ||
      (p.id || '').toLowerCase().trim() === normSlug
    );
    if (match) {
      const monthly = Number(match.monthlyPrice) || 0;
      const annualRate = Number(match.annualPrice) || 0;
      const annualTotal = Number(match.annualTotal) || (annualRate > 0 ? annualRate * 12 : monthly * 12);
      const price = isYearly ? annualTotal : monthly;
      return { price, planName: match.name, plan: match };
    }
  }
  // Fallback to static prices
  const fallback = PLAN_PRICES_FALLBACK[normSlug] || PLAN_PRICES_FALLBACK.pro;
  return { price: isYearly ? fallback.yearly : fallback.monthly, planName: normSlug, plan: null };
}

// GET /api/billing/subscription — Get current user's subscription details & usage
router.get('/subscription', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const subscription = await billingService.getSubscription(userId);
    const user = await db.prepare("SELECT plan, dm_usage_this_period, usage_period_start, subscription_status FROM users WHERE id = ?").get(userId);

    const plan = user?.plan || subscription?.plan || 'free';
    const limit = dmLimitFor(plan);
    const usage = user?.dm_usage_this_period || 0;

    res.json({
      success: true,
      subscription: {
        id: subscription?.id,
        plan,
        status: subscription?.status || 'active',
        billing_cycle: subscription?.billing_cycle || 'monthly',
        current_period_start: subscription?.current_period_start,
        current_period_end: subscription?.current_period_end,
        cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
        canceled_at: subscription?.canceled_at,
        grace_period_ends_at: subscription?.grace_period_ends_at,
        in_grace_period: subscription?.status === 'past_due' && subscription?.grace_period_ends_at && new Date(subscription.grace_period_ends_at).getTime() > Date.now()
      },
      usage: {
        dms_sent: usage,
        dm_limit: limit,
        remaining: Math.max(0, limit - usage),
        percent: Math.min(100, Math.round((usage / (limit || 1)) * 100)),
        period_start: user?.usage_period_start
      }
    });
  } catch (err) {
    console.error('[Billing] Get subscription error:', err.message);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// GET /api/billing/plans — Returns all active pricing plans as configured by admin (for user-facing billing/upgrade views)
router.get('/plans', async (_req, res) => {
  try {
    const adminPlans = await getAdminStoredPlans();
    if (adminPlans && adminPlans.length > 0) {
      // Compute savings %
      const plans = adminPlans.map(p => {
        const monthly = Number(p.monthlyPrice) || 0;
        const annual = Number(p.annualPrice) || 0;
        const savingsPct = (monthly > 0 && annual > 0 && annual < monthly)
          ? Math.round(((monthly - annual) / monthly) * 100)
          : 0;
        return {
          id: p.id,
          slug: p.slug || (p.name || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
          name: p.name,
          monthlyPrice: monthly,
          annualPrice: annual,
          annualTotal: annual * 12,
          savingsPct,
          dmLimit: Number(p.dmLimit) || 0,
          igLimit: Number(p.igLimit) || 1,
          rulesLimit: Number(p.rulesLimit) || 5,
          badge: p.badge || '',
          popular: Boolean(p.popular),
          description: p.description || '',
          features: p.features || [],
          active: p.active !== false
        };
      }).filter(p => p.active);
      return res.json({ plans });
    }
    // Fallback: return static defaults
    res.json({
      plans: [
        { id: 'plan-free', slug: 'free', name: 'Free Starter', monthlyPrice: 0, annualPrice: 0, annualTotal: 0, savingsPct: 0, dmLimit: 1000, igLimit: 1, rulesLimit: 5, badge: 'COMMUNITY', popular: false, description: 'Perfect for creators starting out.', features: ['1,000 Automated DMs / Mo', '1 Connected Instagram Account', '5 Active Keyword Rules'], active: true },
        { id: 'plan-pro', slug: 'pro', name: 'Pro Creator', monthlyPrice: 1499, annualPrice: 1199, annualTotal: 14388, savingsPct: 20, dmLimit: 25000, igLimit: 3, rulesLimit: 25, badge: '🔥 MOST POPULAR', popular: true, description: 'For growing creators who need high-speed DM automation.', features: ['25,000 Automated DMs / Mo', '3 Connected Instagram Accounts', '25 Active Keyword Rules', 'Priority Support'], active: true },
        { id: 'plan-agency', slug: 'agency', name: 'Agency Scale', monthlyPrice: 3999, annualPrice: 2999, annualTotal: 35988, savingsPct: 25, dmLimit: 100000, igLimit: 10, rulesLimit: 100, badge: '⚡ MULTI-BRAND', popular: false, description: 'For digital agencies and multi-brand teams.', features: ['100,000 Automated DMs / Mo', '10 Connected Instagram Accounts', '100 Active Rules', 'Team Dashboard', 'Priority WhatsApp Support'], active: true },
        { id: 'plan-enterprise', slug: 'enterprise', name: 'Enterprise VIP', monthlyPrice: 7999, annualPrice: 5999, annualTotal: 71988, savingsPct: 25, dmLimit: 500000, igLimit: 25, rulesLimit: 500, badge: '👑 CUSTOM VOLUME', popular: false, description: 'For enterprise teams requiring custom automation volume.', features: ['Unlimited Automated DMs', 'Unlimited Instagram Accounts', 'Custom API & SLA', 'Dedicated Account Manager'], active: true }
      ]
    });
  } catch (err) {
    console.error('[Billing] Get plans error:', err.message);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// POST /api/billing/create-checkout (and /create-order) — Initialize Razorpay Order
const handleCreateOrder = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { plan = 'pro', cycle = 'monthly' } = req.body;
    const planKey = plan.toLowerCase();

    // Resolve price dynamically from admin configuration
    const { price: priceInr, planName } = await resolvePlanPrice(planKey, cycle);
    if (priceInr === 0 && planKey !== 'free' && planKey !== 'starter') {
      return res.status(400).json({ error: `Invalid plan selected: '${planKey}'. No pricing found.` });
    }
    const amountInPaise = priceInr * 100;

    const rzpKeyId = process.env.RAZORPAY_KEY_ID || '';
    const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
    const isLiveConfigured = rzpKeyId && rzpKeySecret && !rzpKeyId.includes('placeholder');

    let orderId = `order_${uuidv4().replace(/-/g, '').slice(0, 14)}`;

    if (isLiveConfigured) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${rzpKeyId}:${rzpKeySecret}`).toString('base64');
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `rcpt_${userId.slice(0, 8)}_${Date.now().toString().slice(-6)}`,
            notes: {
              user_id: userId,
              plan: planKey,
              cycle: cycle === 'yearly' ? 'yearly' : 'monthly'
            }
          })
        });

        if (rzpRes.ok) {
          const rzpData = await rzpRes.json();
          orderId = rzpData.id;
        } else {
          const errData = await rzpRes.json().catch(() => ({}));
          console.warn('[Billing] Razorpay order creation returned non-200, fallback to simulated order:', errData);
        }
      } catch (callErr) {
        console.warn('[Billing] Razorpay API call failed, falling back to simulated order:', callErr.message);
      }
    }

    res.json({
      success: true,
      key_id: isLiveConfigured ? rzpKeyId : (rzpKeyId || 'rzp_test_placeholder'),
      order_id: orderId,
      amount: amountInPaise,
      amount_inr: priceInr,
      currency: 'INR',
      plan: planKey,
      cycle: cycle === 'yearly' ? 'yearly' : 'monthly',
      user: {
        name: user.name || 'Valued Creator',
        email: user.email,
        phone: user.phone || ''
      },
      is_simulated: !isLiveConfigured
    });
  } catch (err) {
    console.error('[Billing] Create checkout error:', err.message);
    res.status(500).json({ error: 'Failed to initiate checkout' });
  }
};

router.post('/create-checkout', handleCreateOrder);
router.post('/create-order', handleCreateOrder);

// POST /api/billing/verify-payment — Verify Razorpay HMAC & Activate Plan
router.post('/verify-payment', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan = 'pro',
      cycle = 'monthly',
      billing_name,
      billing_email,
      gst_number
    } = req.body;

    const planKey = plan.toLowerCase();
    const { price: priceInr } = await resolvePlanPrice(planKey, cycle);
    const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
    const isLiveConfigured = rzpKeySecret && !rzpKeySecret.includes('placeholder');

    if (isLiveConfigured && razorpay_signature) {
      const payloadToSign = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = crypto
        .createHmac('sha256', rzpKeySecret)
        .update(payloadToSign)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        console.error('[Billing] ❌ Razorpay signature mismatch for order:', razorpay_order_id);
        return res.status(400).json({ error: 'Payment signature verification failed' });
      }
    }

    const paymentId = razorpay_payment_id || `pay_${uuidv4().replace(/-/g, '').slice(0, 14)}`;

    // Process upgrade via billingService (updates subscriptions, users table, and records GST invoice)
    const webhookResult = await billingService.processPaymentWebhook(
      'razorpay',
      'payment.captured',
      paymentId,
      {
        id: paymentId,
        amount: priceInr,
        notes: {
          user_id: userId,
          plan: planKey,
          cycle: cycle === 'yearly' ? 'yearly' : 'monthly'
        },
        billing_name: billing_name || user.name || 'Valued Creator',
        billing_email: billing_email || user.email,
        gst_number: gst_number || null
      },
      true
    );

    const updatedUser = await db.prepare("SELECT id, email, name, plan, subscription_status, dm_usage_this_period FROM users WHERE id = ?").get(userId);

    res.json({
      success: true,
      message: `🎉 Successfully upgraded to ${planKey.toUpperCase()} plan!`,
      plan: updatedUser?.plan || planKey,
      invoice_number: webhookResult.invoiceNumber || null,
      user: updatedUser
    });
  } catch (err) {
    console.error('[Billing] Verify payment error:', err.message);
    res.status(500).json({ error: 'Failed to verify payment and upgrade subscription' });
  }
});

// POST /api/billing/webhook — Razorpay Webhook Receiver
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body.toString();
    const payload = JSON.parse(rawBody);

    const result = await billingService.processPaymentWebhook(
      'razorpay',
      payload,
      signature,
      rawBody
    );

    res.json({ received: true, result });
  } catch (err) {
    console.error('[Billing] Webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/billing/cancel — Cancel active subscription at period end
router.post('/cancel', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await billingService.cancelSubscription(userId);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Billing] Cancel subscription error:', err.message);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// POST /api/billing/resume — Resume a canceled subscription
router.post('/resume', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await billingService.resumeSubscription(userId);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Billing] Resume subscription error:', err.message);
    res.status(500).json({ error: 'Failed to resume subscription' });
  }
});

// GET /api/billing/invoices — List user's payment records & GST invoices
router.get('/invoices', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const invoices = await db.prepare(`
      SELECT * FROM invoices
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(userId) || [];

    res.json({
      success: true,
      count: invoices.length,
      invoices
    });
  } catch (err) {
    console.error('[Billing] Get invoices error:', err.message);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/billing/invoices/:id — Get specific invoice details
router.get('/invoices/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const invoice = await db.prepare(`
      SELECT * FROM invoices
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, userId);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ success: true, invoice });
  } catch (err) {
    console.error('[Billing] Get single invoice error:', err.message);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

module.exports = router;
