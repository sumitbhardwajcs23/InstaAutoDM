// backend/src/routes/billing.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const billingService = require('../services/billingService');
const { dmLimitFor } = require('../constants/planLimits');

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

// POST /api/billing/create-checkout — Initialize plan upgrade checkout session
router.post('/create-checkout', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { plan, cycle = 'monthly', gateway = 'razorpay' } = req.body;
    const validPlans = ['pro', 'agency', 'enterprise'];
    if (!validPlans.includes((plan || '').toLowerCase())) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const prices = {
      pro: { monthly: 1499, yearly: 13188 },
      agency: { monthly: 3999, yearly: 35988 },
      enterprise: { monthly: 7999, yearly: 71988 }
    };

    const amount = prices[plan.toLowerCase()][cycle === 'yearly' ? 'yearly' : 'monthly'];
    const orderId = `order_${uuidv4().slice(0, 12)}`;

    res.json({
      success: true,
      order_id: orderId,
      amount,
      currency: 'INR',
      plan,
      cycle,
      gateway,
      checkout_url: `/checkout?order_id=${orderId}`
    });
  } catch (err) {
    console.error('[Billing] Create checkout error:', err.message);
    res.status(500).json({ error: 'Failed to initiate checkout' });
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
