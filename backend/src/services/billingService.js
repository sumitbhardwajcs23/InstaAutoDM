// backend/src/services/billingService.js
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { dmLimitFor } = require('../constants/planLimits');
const { processPaymentWebhookProduction, getCurrentEntitlementSubscription } = require('./billingEngine');

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
    const sub = await db.prepare("SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(userId);
    return sub || null;
  }

  /**
   * Resolves the single authoritative current entitlement subscription (excludes terminal and reconciliation_required)
   */
  async getEntitlementSubscription(userId) {
    if (!userId) return null;
    const pool = db.getPgPool();
    if (!pool) return null;
    return await getCurrentEntitlementSubscription(pool, userId);
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
    let payload = null;
    let signature = null;
    let rawBody = null;

    if (typeof arg2 === 'object' && typeof arg3 === 'string') {
      payload = arg2;
      signature = arg3;
      rawBody = arg4;

      const secret = gateway === 'razorpay' ? process.env.RAZORPAY_WEBHOOK_SECRET : process.env.STRIPE_WEBHOOK_SECRET;
      if (secret && signature) {
        const valid = this.verifyPaymentWebhookSignature(rawBody || JSON.stringify(payload), signature, secret, gateway);
        if (!valid) {
          throw new Error('Invalid signature for payment webhook');
        }
      }
    }

    return await processPaymentWebhookProduction(gateway, arg2, arg3, arg4, arg5);
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
