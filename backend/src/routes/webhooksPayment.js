/**
 * Payment Webhook Router
 * Handles inbound webhook notifications from Razorpay and Stripe with signature verification,
 * deduplication, and transactional subscription lifecycle synchronization.
 */

const express = require('express');
const router = express.Router();
const billingService = require('../services/billingService');

/**
 * POST /webhooks/payment/razorpay
 * Expects header 'x-razorpay-signature'
 */
router.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        if (!signature) {
            return res.status(400).json({ error: 'Missing x-razorpay-signature header' });
        }

        // Parse raw body or json body
        let rawBody = req.body;
        let payload = {};
        if (Buffer.isBuffer(req.body)) {
            rawBody = req.body.toString('utf8');
            try {
                payload = JSON.parse(rawBody);
            } catch (err) {
                return res.status(400).json({ error: 'Invalid JSON payload' });
            }
        } else if (typeof req.body === 'object') {
            payload = req.body;
            rawBody = JSON.stringify(req.body);
        }

        const result = await billingService.processPaymentWebhook('razorpay', payload, signature, rawBody);
        
        if (result.duplicate) {
            return res.status(200).json({ received: true, duplicate: true });
        }

        return res.status(200).json({ received: true, status: result.status });
    } catch (err) {
        console.error('[Payment Webhook] Razorpay error:', err.message);
        if (err.message && err.message.includes('Invalid signature')) {
            return res.status(400).json({ error: 'Invalid webhook signature' });
        }
        return res.status(500).json({ error: 'Internal webhook processing error' });
    }
});

/**
 * POST /webhooks/payment/stripe
 * Expects header 'stripe-signature'
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['stripe-signature'];
        if (!signature) {
            return res.status(400).json({ error: 'Missing stripe-signature header' });
        }

        let rawBody = req.body;
        let payload = {};
        if (Buffer.isBuffer(req.body)) {
            rawBody = req.body.toString('utf8');
            try {
                payload = JSON.parse(rawBody);
            } catch (err) {
                return res.status(400).json({ error: 'Invalid JSON payload' });
            }
        } else if (typeof req.body === 'object') {
            payload = req.body;
            rawBody = JSON.stringify(req.body);
        }

        const result = await billingService.processPaymentWebhook('stripe', payload, signature, rawBody);

        if (result.duplicate) {
            return res.status(200).json({ received: true, duplicate: true });
        }

        return res.status(200).json({ received: true, status: result.status });
    } catch (err) {
        console.error('[Payment Webhook] Stripe error:', err.message);
        if (err.message && err.message.includes('Invalid signature')) {
            return res.status(400).json({ error: 'Invalid webhook signature' });
        }
        return res.status(500).json({ error: 'Internal webhook processing error' });
    }
});

module.exports = router;
