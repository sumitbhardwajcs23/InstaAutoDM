// backend/src/routes/billing.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const billingService = require('../services/billingService');
const { dmLimitFor } = require('../constants/planLimits');

// Plan pricing definitions (in INR)
const PLAN_PRICES = {
  pro: { monthly: 1499, yearly: 13188 },
  agency: { monthly: 3999, yearly: 35988 },
  enterprise: { monthly: 7999, yearly: 71988 }
};

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

// POST /api/billing/create-checkout (and /create-order) — Initialize Razorpay Order
const handleCreateOrder = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { plan = 'pro', cycle = 'monthly' } = req.body;
    const planKey = plan.toLowerCase();

    if (!PLAN_PRICES[planKey]) {
      return res.status(400).json({ error: 'Invalid plan selected. Choose from: pro, agency, enterprise' });
    }

    const priceInr = PLAN_PRICES[planKey][cycle === 'yearly' ? 'yearly' : 'monthly'];
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
    if (!PLAN_PRICES[planKey]) {
      return res.status(400).json({ error: 'Invalid plan specified' });
    }

    const priceInr = PLAN_PRICES[planKey][cycle === 'yearly' ? 'yearly' : 'monthly'];
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
