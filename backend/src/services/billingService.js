// backend/src/services/billingService.js
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { dmLimitFor } = require('../constants/planLimits');

const THREE_DAYS_MS = 3 * 24 * 3600 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;
const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;

const PLAN_PRICES = {
  free: { monthly: 0, yearly: 0 },
  pro: { monthly: 1499, yearly: 13188 },
  agency: { monthly: 3999, yearly: 35988 },
  enterprise: { monthly: 7999, yearly: 71988 }
};

class BillingService {
  /**
   * Resolves active subscription for a user, or creates default free tier.
   */
  async getSubscription(userId) {
    if (!userId) return null;
    let sub = await db.prepare("SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(userId);
    const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

    if (!sub && user) {
      const now = new Date();
      const periodStart = now.toISOString();
      const periodEnd = new Date(now.getTime() + THIRTY_DAYS_MS).toISOString();
      const id = `sub_${uuidv4().slice(0, 12)}`;

      await db.prepare(`
        INSERT INTO subscriptions (
          id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at
        ) VALUES (?, ?, ?, 'active', 'monthly', ?, ?, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      `).run(id, userId, user.plan || 'free', periodStart, periodEnd);

      sub = await db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(id);
    }

    // Check if grace period has expired
    if (sub && sub.status === 'past_due' && sub.grace_period_ends_at) {
      if (new Date(sub.grace_period_ends_at).getTime() < Date.now()) {
        await db.prepare(`
          UPDATE subscriptions SET
            status = 'unpaid',
            updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          WHERE id = ?
        `).run(sub.id);
        await db.prepare("UPDATE users SET subscription_status = 'unpaid' WHERE id = ?").run(userId);
        sub.status = 'unpaid';
      }
    }

    return sub;
  }

  /**
   * Get plan limits definition
   */
  getPlanLimits(plan) {
    const limits = {
      free: { maxDmsPerMonth: 100, maxIgAccounts: 1 },
      pro: { maxDmsPerMonth: 5000, maxIgAccounts: 3 },
      agency: { maxDmsPerMonth: 25000, maxIgAccounts: 10 },
      enterprise: { maxDmsPerMonth: 100000, maxIgAccounts: 50 }
    };
    return limits[(plan || 'free').toLowerCase()] || limits.free;
  }

  /**
   * Verifies Razorpay webhook HMAC signature
   */
  verifyRazorpaySignature(rawBody, signature, secret = process.env.RAZORPAY_WEBHOOK_SECRET) {
    return this.verifyPaymentWebhookSignature(rawBody, signature, secret, 'razorpay');
  }

  /**
   * Verifies Stripe webhook HMAC signature
   */
  verifyStripeSignature(rawBody, signatureHeader, secret = process.env.STRIPE_WEBHOOK_SECRET) {
    return this.verifyPaymentWebhookSignature(rawBody, signatureHeader, secret, 'stripe');
  }

  /**
   * Verifies HMAC signature for payment webhooks (Razorpay / Stripe)
   */
  verifyPaymentWebhookSignature(rawBody, signature, secret, gateway = 'razorpay') {
    if (!signature || !secret) return false;
    if (process.env.NODE_ENV === 'test' && process.env.SKIP_PAYMENT_VERIFY === 'true') return true;

    try {
      if (gateway === 'razorpay') {
        const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
      }
      if (gateway === 'stripe') {
        // Stripe signature format: t=timestamp,v1=signature
        const parts = signature.split(',').reduce((acc, part) => {
          const [k, v] = part.split('=');
          if (k && v) acc[k.trim()] = v.trim();
          return acc;
        }, {});
        if (!parts.t || !parts.v1) return false;
        const payload = `${parts.t}.${rawBody}`;
        const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(parts.v1, 'utf8'), Buffer.from(expected, 'utf8'));
      }
    } catch {
      return false;
    }
    return false;
  }

  /**
   * Idempotent payment webhook event processor
   * Supports both (gateway, payload, signature, rawBody) and (gateway, eventType, idempotencyKey, payload, signatureVerified)
   */
  async processPaymentWebhook(gateway, arg2, arg3, arg4, arg5) {
    let eventType = null;
    let idempotencyKey = null;
    let payload = null;
    let signatureVerified = true;
    let rawBody = null;

    if (typeof arg2 === 'object' && typeof arg3 === 'string') {
      // Called as: (gateway, payloadObj, signature, rawBody)
      payload = arg2;
      const signature = arg3;
      rawBody = arg4;

      const secret = gateway === 'razorpay' ? process.env.RAZORPAY_WEBHOOK_SECRET : process.env.STRIPE_WEBHOOK_SECRET;
      if (secret && signature) {
        const valid = this.verifyPaymentWebhookSignature(rawBody || JSON.stringify(payload), signature, secret, gateway);
        if (!valid) {
          throw new Error('Invalid signature for payment webhook');
        }
      }

      eventType = payload.event || payload.type || 'payment.captured';
      idempotencyKey = payload.id || (payload.payload?.payment?.entity?.id) || (payload.data?.object?.id) || `pay_evt_${uuidv4().slice(0, 8)}`;
    } else {
      // Called as: (gateway, eventType, idempotencyKey, payload, signatureVerified)
      eventType = arg2;
      idempotencyKey = arg3;
      payload = arg4;
      signatureVerified = arg5 !== undefined ? arg5 : true;
    }

    // 1. Idempotency check in payment_webhook_events
    const existing = await db.prepare("SELECT id, status FROM payment_webhook_events WHERE idempotency_key = ?").get(idempotencyKey);
    if (existing) {
      console.log(`[BillingWebhook] ⚠️ Duplicate payment webhook ignored: ${idempotencyKey}`);
      return { duplicate: true, status: existing.status };
    }

    const eventId = `pwe_${uuidv4().slice(0, 12)}`;
    await db.prepare(`
      INSERT INTO payment_webhook_events (
        id, gateway, event_type, idempotency_key, payload, signature_verified, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'processed', to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
    `).run(eventId, gateway, eventType, idempotencyKey, JSON.stringify(payload), signatureVerified ? 1 : 0);

    // Extract notes and entity properties from Razorpay or Stripe formats
    const paymentEntity = payload.payload?.payment?.entity || payload.data?.object || payload;
    const subEntity = payload.payload?.subscription?.entity || {};
    const notes = paymentEntity.notes || subEntity.notes || payload.notes || {};

    const userId = notes.user_id || payload.user_id || payload.customer_id;
    const plan = (notes.plan || payload.plan || 'pro').toLowerCase();
    const cycle = notes.cycle || payload.cycle || 'monthly';
    
    let rawAmount = paymentEntity.amount !== undefined ? paymentEntity.amount : (payload.amount || PLAN_PRICES[plan]?.[cycle] || 1499);
    // Convert paise/cents to standard units if necessary
    const amount = rawAmount > 10000 ? Math.round(rawAmount / 100) : rawAmount;
    const tax = Math.round(amount * 0.18);

    let user = null;
    if (userId) {
      user = await db.prepare("SELECT * FROM users WHERE id = ? OR email = ?").get(userId, userId);
    }

    if (!user && (payload.email || notes.email)) {
      user = await db.prepare("SELECT * FROM users WHERE email = ?").get(payload.email || notes.email);
    }

    if (!user) {
      console.warn(`[BillingWebhook] Target user not found for webhook ${idempotencyKey}`);
      return { duplicate: false, processed: false, error: 'User not found' };
    }

    // Process event types
    switch (eventType) {
      case 'subscription.charged':
      case 'payment.captured':
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
      case 'subscription.activated': {
        const now = new Date();
        const periodStart = now.toISOString();
        const durationMs = cycle === 'yearly' ? ONE_YEAR_MS : THIRTY_DAYS_MS;
        const periodEnd = new Date(now.getTime() + durationMs).toISOString();

        // Update / Insert Subscription
        let sub = await db.prepare("SELECT id FROM subscriptions WHERE user_id = ?").get(user.id);
        if (sub) {
          await db.prepare(`
            UPDATE subscriptions SET
              plan = ?,
              status = 'active',
              billing_cycle = ?,
              current_period_start = ?,
              current_period_end = ?,
              cancel_at_period_end = 0,
              canceled_at = NULL,
              grace_period_ends_at = NULL,
              grace_period_until = NULL,
              updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
            WHERE id = ?
          `).run(plan, cycle, periodStart, periodEnd, sub.id);
        } else {
          sub = { id: `sub_${uuidv4().slice(0, 12)}` };
          await db.prepare(`
            INSERT INTO subscriptions (
              id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at
            ) VALUES (?, ?, ?, 'active', ?, ?, ?, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
          `).run(sub.id, user.id, plan, cycle, periodStart, periodEnd);
        }

        // Reset user usage and update plan
        await db.prepare(`
          UPDATE users SET
            plan = ?,
            subscription_status = 'active',
            dm_usage_this_period = 0,
            usage_period_start = ?,
            updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          WHERE id = ?
        `).run(plan, periodStart.slice(0, 10), user.id);

        // Record paid invoice with GST tax calculation
        const invoiceId = `inv_${uuidv4().slice(0, 12)}`;
        const invoiceNum = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        await db.prepare(`
          INSERT INTO invoices (
            id, user_id, subscription_id, invoice_number, amount, tax, currency, status, gateway, gateway_payment_id,
            billing_name, billing_email, gst_number, paid_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'INR', 'paid', ?, ?, ?, ?, ?, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
        `).run(
          invoiceId, user.id, sub.id, invoiceNum, amount, tax, gateway, paymentEntity.id || `pay_${uuidv4().slice(0, 8)}`,
          payload.billing_name || user.name || 'Valued Creator', payload.billing_email || user.email, payload.gst_number || null
        );

        console.log(`[BillingService] ✅ Subscription activated for user ${user.id} (${plan}, ${cycle}). Invoice: ${invoiceNum}`);
        return { duplicate: false, processed: true, plan, status: 'active', invoiceNumber: invoiceNum };
      }

      case 'payment.failed':
      case 'invoice.payment_failed': {
        const gracePeriodEnd = new Date(Date.now() + THREE_DAYS_MS).toISOString();
        let sub = await db.prepare("SELECT id FROM subscriptions WHERE user_id = ?").get(user.id);

        if (sub) {
          await db.prepare(`
            UPDATE subscriptions SET
              status = 'grace_period',
              grace_period_ends_at = ?,
              grace_period_until = ?,
              updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
            WHERE id = ?
          `).run(gracePeriodEnd, gracePeriodEnd, sub.id);
        } else {
          sub = { id: `sub_${uuidv4().slice(0, 12)}` };
          await db.prepare(`
            INSERT INTO subscriptions (
              id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, grace_period_ends_at, grace_period_until, created_at, updated_at
            ) VALUES (?, ?, ?, 'grace_period', 'monthly', datetime('now'), datetime('now'), ?, ?, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
          `).run(sub.id, user.id, user.plan || 'free', gracePeriodEnd, gracePeriodEnd);
        }

        await db.prepare(`
          UPDATE users SET
            subscription_status = 'grace_period',
            updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          WHERE id = ?
        `).run(user.id);

        // Record failed invoice record
        const invoiceId = `inv_${uuidv4().slice(0, 12)}`;
        const invoiceNum = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        await db.prepare(`
          INSERT INTO invoices (
            id, user_id, subscription_id, invoice_number, amount, tax, currency, status, gateway, billing_name, billing_email, failed_reason, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'INR', 'failed', ?, ?, ?, ?, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
        `).run(
          invoiceId, user.id, sub?.id || null, invoiceNum, amount, tax, gateway,
          user.name || 'Creator', user.email, payload.error_reason || 'Card declined / payment failed'
        );

        console.warn(`[BillingService] ⚠️ Payment failed for user ${user.id}. Grace period active until ${gracePeriodEnd}.`);
        return { duplicate: false, processed: true, status: 'grace_period', gracePeriodEndsAt: gracePeriodEnd };
      }


      case 'subscription.cancelled': {
        let sub = await db.prepare("SELECT id FROM subscriptions WHERE user_id = ?").get(user.id);
        if (sub) {
          await db.prepare(`
            UPDATE subscriptions SET
              cancel_at_period_end = 1,
              canceled_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
              updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
            WHERE id = ?
          `).run(sub.id);
        }
        return { duplicate: false, processed: true, cancelAtPeriodEnd: true };
      }

      default:
        return { duplicate: false, processed: true, status: 'acknowledged' };
    }
  }

  /**
   * User self-service cancellation (cancel at period end)
   */
  async cancelSubscription(userId) {
    const sub = await db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(userId);
    if (!sub) return { success: false, error: 'No active subscription found' };

    await db.prepare(`
      UPDATE subscriptions SET
        cancel_at_period_end = 1,
        canceled_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      WHERE id = ?
    `).run(sub.id);

    return {
      success: true,
      message: 'Subscription will cancel at the end of the current billing period.',
      currentPeriodEnd: sub.current_period_end
    };
  }

  /**
   * Resumes a canceled subscription prior to period expiration
   */
  async resumeSubscription(userId) {
    const sub = await db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(userId);
    if (!sub) return { success: false, error: 'No subscription found' };

    await db.prepare(`
      UPDATE subscriptions SET
        cancel_at_period_end = 0,
        canceled_at = NULL,
        updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      WHERE id = ?
    `).run(sub.id);

    return {
      success: true,
      message: 'Subscription successfully resumed.',
      status: sub.status
    };
  }

  /**
   * Check for grace period expiration across all subscriptions
   */
  async checkGracePeriods() {
    try {
      const expiredSubs = await db.prepare(`
        SELECT id, user_id FROM subscriptions
        WHERE status = 'past_due' AND grace_period_ends_at < to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      `).all() || [];

      for (const sub of expiredSubs) {
        await db.prepare(`
          UPDATE subscriptions SET
            status = 'unpaid',
            updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          WHERE id = ?
        `).run(sub.id);
        await db.prepare("UPDATE users SET subscription_status = 'unpaid' WHERE id = ?").run(sub.user_id);
        console.log(`[BillingService] 🛑 Subscription ${sub.id} (user ${sub.user_id}) marked unpaid after grace period expiration.`);
      }
      return expiredSubs.length;
    } catch (e) {
      console.error('[BillingService] Error checking grace periods:', e.message);
      return 0;
    }
  }
}

module.exports = new BillingService();
