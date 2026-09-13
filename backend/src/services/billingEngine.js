// backend/src/services/billingEngine.js
// Production Implementation for Migration 009 & Hardened Billing Lifecycle

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { dmLimitFor } = require('../constants/planLimits');

const THREE_DAYS_MS = 3 * 24 * 3600 * 1000;

const PLAN_PRICES = {
  free: { monthly: 0, yearly: 0 },
  pro: { monthly: 1499, yearly: 13188 },
  scale: { monthly: 4999, yearly: 41988 },
  agency: { monthly: 3999, yearly: 35988 },
  enterprise: { monthly: 7999, yearly: 71988 }
};

/**
 * Resolves the unique Current Entitlement Subscription for a user
 * Excludes terminal states and reconciliation_required (Zero Paid Entitlement)
 */
async function getCurrentEntitlementSubscription(clientOrPool, userId) {
  const res = await clientOrPool.query(`
    SELECT id, user_id, plan, status, billing_cycle,
           current_period_start, current_period_end,
           cancel_at_period_end, canceled_at,
           trial_ends_at, grace_period_ends_at,
           created_at, updated_at
    FROM subscriptions
    WHERE user_id = $1
      AND status IN ('active', 'trialing', 'past_due', 'grace_period')
    ORDER BY created_at DESC
    LIMIT 1
  `, [userId]);
  return res.rows[0] || null;
}

/**
 * Resolves the canonical free tier slug from pricing_plans SSOT
 */
async function getCanonicalFreePlan(clientOrPool) {
  const res = await clientOrPool.query(`
    SELECT slug FROM pricing_plans 
    WHERE monthly_price = 0 AND is_active = 1 
    ORDER BY sort_order ASC LIMIT 1
  `);
  return res.rows[0]?.slug || 'free';
}

/**
 * Preflight data quality validator for Migration 009
 */
async function runMigration009PreflightCheck(clientOrPool) {
  const badCounters = await clientOrPool.query(`
    SELECT id, user_id, period_start, period_end
    FROM usage_counters
    WHERE (period_start IS NOT NULL AND period_start::text !~ '^\\d{4}-\\d{2}-\\d{2}' AND period_start::text !~ '^\\d+$')
       OR (period_end IS NOT NULL AND period_end::text !~ '^\\d{4}-\\d{2}-\\d{2}' AND period_end::text !~ '^\\d+$')
  `);

  const badSubs = await clientOrPool.query(`
    SELECT id, user_id, current_period_start, current_period_end
    FROM subscriptions
    WHERE (current_period_start IS NOT NULL AND current_period_start::text !~ '^\\d{4}-\\d{2}-\\d{2}' AND current_period_start::text !~ '^\\d+$')
       OR (current_period_end IS NOT NULL AND current_period_end::text !~ '^\\d{4}-\\d{2}-\\d{2}' AND current_period_end::text !~ '^\\d+$')
  `);

  if (badCounters.rows.length > 0 || badSubs.rows.length > 0) {
    const errorDetails = [
      ...badCounters.rows.map(r => `usage_counters id=${r.id} (start='${r.period_start}', end='${r.period_end}')`),
      ...badSubs.rows.map(r => `subscriptions id=${r.id} (start='${r.current_period_start}', end='${r.current_period_end}')`)
    ].join('; ');
    throw new Error(`[Migration 009 Preflight FAILED] Found malformed timestamp data: ${errorDetails}`);
  }

  return { ok: true, inspectedCounters: true, inspectedSubscriptions: true };
}

/**
 * Hardened atomic payment webhook processing engine
 */
async function processPaymentWebhookProduction(gateway, arg2, arg3, arg4, arg5) {
  let eventType = null;
  let idempotencyKey = null;
  let payload = null;
  let signatureVerified = true;
  let rawBody = null;

  if (typeof arg2 === 'object' && typeof arg3 === 'string') {
    payload = arg2;
    eventType = payload.event || payload.type || 'payment.captured';
    idempotencyKey = payload.id || (payload.payload?.payment?.entity?.id) || (payload.data?.object?.id) || `pay_evt_${uuidv4().slice(0, 8)}`;
  } else {
    eventType = arg2;
    idempotencyKey = arg3;
    payload = arg4;
    signatureVerified = arg5 !== undefined ? arg5 : true;
  }

  const pool = db.getPgPool();
  if (!pool) throw new Error('[BillingService] PostgreSQL pool not available');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. ATOMIC IDEMPOTENCY GATE: INSERT ON CONFLICT DO NOTHING RETURNING id
    const eventId = `pwe_${uuidv4().slice(0, 12)}`;
    if (idempotencyKey) {
      const idempotencyRes = await client.query(`
        INSERT INTO payment_webhook_events (
          id, gateway, event_type, idempotency_key, payload, signature_verified, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'processing', to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id
      `, [eventId, gateway, eventType, idempotencyKey, JSON.stringify(payload), signatureVerified ? 1 : 0]);

      if (idempotencyRes.rows.length === 0) {
        // Loser of concurrent race: immediately terminate without mutating state
        await client.query('ROLLBACK');
        const existing = await pool.query(
          'SELECT status FROM payment_webhook_events WHERE idempotency_key = $1',
          [idempotencyKey]
        );
        return { duplicate: true, status: existing.rows[0]?.status || 'duplicate' };
      }
    }

    const paymentEntity = payload.payload?.payment?.entity || payload.data?.object || payload;
    const subEntity = payload.payload?.subscription?.entity || {};
    const notes = paymentEntity.notes || subEntity.notes || payload.notes || {};

    const userId = notes.user_id || payload.user_id || payload.customer_id;
    const explicitSubId = notes.subscription_id || payload.subscription_id || subEntity.id;

    // Plan validation against pricing_plans SSOT
    const rawPlan = (notes.plan || payload.plan || '').toLowerCase().trim();
    let validatedPlan = null;
    if (rawPlan) {
      const planRes = await client.query(
        'SELECT slug FROM pricing_plans WHERE (slug = $1 OR id = $2) AND is_active = 1 LIMIT 1',
        [rawPlan, rawPlan]
      );
      if (planRes.rows.length > 0) {
        validatedPlan = planRes.rows[0].slug;
      } else {
        if (idempotencyKey) {
          await client.query(
            "UPDATE payment_webhook_events SET status = 'rejected', error = $1 WHERE id = $2",
            [`Invalid plan slug: '${rawPlan}' not in pricing_plans`, eventId]
          );
        }
        await client.query('COMMIT');
        return { duplicate: false, processed: false, rejectionReason: 'plan_not_in_pricing_plans' };
      }
    }

    let user = null;
    if (userId) {
      const uRes = await client.query('SELECT * FROM users WHERE id = $1 OR email = $2', [userId, userId]);
      user = uRes.rows[0] || null;
    }
    if (!user && (payload.email || notes.email)) {
      const uRes = await client.query('SELECT * FROM users WHERE email = $1', [payload.email || notes.email]);
      user = uRes.rows[0] || null;
    }

    if (!user) {
      await client.query('ROLLBACK');
      return { duplicate: false, processed: false, error: 'User not found' };
    }

    if ([
      'subscription.charged',
      'payment.captured',
      'invoice.paid',
      'invoice.payment_succeeded',
      'subscription.activated',
      'subscription.upgraded',
      'subscription.plan_changed',
      'customer.subscription.updated'
    ].includes(eventType)) {
      const now = new Date();

      // 2. Lock affected active/grace subscription row FOR UPDATE
      let subLockRes;
      if (explicitSubId) {
        subLockRes = await client.query(`
          SELECT id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, cancel_at_period_end
          FROM subscriptions
          WHERE id = $1
          FOR UPDATE
        `, [explicitSubId]);
      } else {
        subLockRes = await client.query(`
          SELECT id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, cancel_at_period_end
          FROM subscriptions
          WHERE user_id = $1
            AND status IN ('active', 'trialing', 'past_due', 'grace_period')
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE
        `, [user.id]);
      }

      // Check if this specific payment entity was already invoiced/processed
      const gwPaymentId = paymentEntity.id || payload.payment_id || payload.gateway_payment_id;
      if (gwPaymentId) {
        const existingInv = await client.query('SELECT id, invoice_number FROM invoices WHERE gateway_payment_id = $1 LIMIT 1', [gwPaymentId]);
        if (existingInv.rows.length > 0) {
          if (idempotencyKey) {
            await client.query("UPDATE payment_webhook_events SET status = 'duplicate' WHERE id = $1", [eventId]);
          }
          await client.query('COMMIT');
          return {
            duplicate: true,
            alreadyInvoiced: true,
            invoiceId: existingInv.rows[0].id,
            invoiceNumber: existingInv.rows[0].invoice_number
          };
        }
      }

      let targetSubId;
      let periodStart;
      let periodEnd;
      let isNewSubscription = false;
      let finalPlan;
      let finalCycle;

      const activeSub = (subLockRes.rows.length > 0 && ['active', 'trialing', 'past_due', 'grace_period'].includes(subLockRes.rows[0].status))
        ? subLockRes.rows[0]
        : null;

      if (activeSub) {
        // ── RE-READ AUTHORITATIVE STATE & PRESERVE SSOT ──
        targetSubId = activeSub.id;

        // RULE 1: Existing subscription billing_cycle is AUTHORITATIVE
        // Never default an existing annual subscription to monthly because webhook omitted it!
        finalCycle = (activeSub.billing_cycle || '').toLowerCase().trim();
        if (!finalCycle) {
          finalCycle = 'monthly';
        }
        const webhookCycle = (notes.cycle || payload.cycle || '').toLowerCase().trim();
        if (webhookCycle && webhookCycle !== finalCycle) {
          console.warn(`[BillingWebhook] Notice: Webhook claims cycle '${webhookCycle}', but subscription ${activeSub.id} has authoritative cycle '${finalCycle}'. Preserving '${finalCycle}'.`);
        }

        // RULE 2: subscriptions.plan is SSOT
        // Renewal webhooks cannot silently change the plan unless explicit plan-change event
        const isExplicitPlanChange = ['subscription.upgraded', 'subscription.plan_changed', 'customer.subscription.updated'].includes(eventType)
          || (notes.is_plan_change === true || payload.is_plan_change === true);

        if (isExplicitPlanChange && validatedPlan) {
          finalPlan = validatedPlan;
        } else {
          finalPlan = activeSub.plan;
          if (validatedPlan && validatedPlan !== activeSub.plan) {
            console.warn(`[BillingWebhook] Ordinary renewal webhook contained plan '${validatedPlan}', but subscription ${activeSub.id} authoritative plan is '${activeSub.plan}'. Preserving authoritative plan '${activeSub.plan}'.`);
          }
        }

        const isYearly = finalCycle === 'yearly' || finalCycle === 'annual';
        const existingEnd = new Date(activeSub.current_period_end);
        const baseDate = (!isNaN(existingEnd.getTime()) && existingEnd > now) ? existingEnd : now;
        periodStart = now.toISOString();

        // Calendar-based calculation: 1 full calendar year or 1 calendar month
        const endCalc = new Date(baseDate);
        if (isYearly) {
          endCalc.setFullYear(endCalc.getFullYear() + 1);
        } else {
          endCalc.setMonth(endCalc.getMonth() + 1);
        }
        periodEnd = endCalc.toISOString();

        await client.query(`
          UPDATE subscriptions SET
            plan = $1,
            status = 'active',
            billing_cycle = $2,
            current_period_start = $3,
            current_period_end = $4,
            cancel_at_period_end = 0,
            canceled_at = NULL,
            grace_period_ends_at = NULL,
            updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          WHERE id = $5
        `, [finalPlan, finalCycle, periodStart, periodEnd, targetSubId]);
      } else {
        // ── NON-RESURRECTION POLICY: Provision clean new subscription ──
        isNewSubscription = true;
        targetSubId = `sub_${uuidv4().slice(0, 12)}`;
        finalPlan = validatedPlan || 'pro';

        // For a NEW subscription, require verified cycle metadata; do not silently assume monthly when cycle is ambiguous
        const rawNewCycle = (notes.cycle || payload.cycle || subEntity.billing_cycle || payload.billing_cycle || '').toLowerCase().trim();
        if (rawNewCycle === 'yearly' || rawNewCycle === 'annual') {
          finalCycle = 'yearly';
        } else if (rawNewCycle === 'monthly') {
          finalCycle = 'monthly';
        } else {
          // Verify via authoritative source: price match in pricing_plans
          let rawAmount = paymentEntity.amount !== undefined ? paymentEntity.amount : (payload.amount !== undefined ? payload.amount : null);
          const normAmount = (rawAmount !== null && rawAmount > 10000) ? Math.round(rawAmount / 100) : rawAmount;

          let matchedFromPrice = null;
          if (normAmount !== null && normAmount > 0) {
            const planPricingRes = await client.query(
              'SELECT monthly_price, annual_price FROM pricing_plans WHERE slug = $1 LIMIT 1',
              [finalPlan]
            );
            if (planPricingRes.rows.length > 0) {
              const pRow = planPricingRes.rows[0];
              if (pRow.annual_price && normAmount === pRow.annual_price) {
                matchedFromPrice = 'yearly';
              } else if (pRow.monthly_price && normAmount >= (pRow.monthly_price * 10)) {
                matchedFromPrice = 'yearly';
              } else if (pRow.monthly_price && normAmount === pRow.monthly_price) {
                matchedFromPrice = 'monthly';
              }
            }
          }

          if (matchedFromPrice) {
            finalCycle = matchedFromPrice;
          } else {
            // Cycle is ambiguous and unverified: REJECT instead of silently assuming monthly
            if (idempotencyKey) {
              await client.query(
                "UPDATE payment_webhook_events SET status = 'rejected', error = $1 WHERE id = $2",
                [`Ambiguous billing cycle for new subscription: verified cycle metadata ('monthly'|'yearly') or authoritative price match required`, eventId]
              );
            }
            await client.query('COMMIT');
            return { duplicate: false, processed: false, rejectionReason: 'ambiguous_billing_cycle' };
          }
        }

        const isYearly = finalCycle === 'yearly' || finalCycle === 'annual';
        periodStart = now.toISOString();

        const endCalc = new Date(now);
        if (isYearly) {
          endCalc.setFullYear(endCalc.getFullYear() + 1);
        } else {
          endCalc.setMonth(endCalc.getMonth() + 1);
        }
        periodEnd = endCalc.toISOString();

        await client.query(`
          INSERT INTO subscriptions (
            id, user_id, plan, status, billing_cycle, current_period_start, current_period_end,
            cancel_at_period_end, created_at, updated_at
          ) VALUES ($1, $2, $3, 'active', $4, $5, $6, 0, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
        `, [targetSubId, user.id, finalPlan, finalCycle, periodStart, periodEnd]);
      }

      // 3. Update users cache
      await client.query(`
        UPDATE users SET
          plan = $1,
          subscription_status = 'active',
          dm_usage_this_period = 0,
          usage_period_start = $2,
          updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        WHERE id = $3
      `, [finalPlan, periodStart.slice(0, 10), user.id]);

      // 4. Update usage counter (exactly-once per recognized billing transition)
      const durationInterval = (finalCycle === 'yearly' || finalCycle === 'annual') ? '1 year' : '1 month';
      await client.query(`
        INSERT INTO usage_counters (id, user_id, period_start, period_end, dms_sent, comments_replied, updated_at)
        VALUES ($1, $2, NOW(), NOW() + $3::interval, 0, 0, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
        ON CONFLICT (user_id) DO UPDATE SET
          dms_sent = 0,
          comments_replied = 0,
          period_start = EXCLUDED.period_start,
          period_end = EXCLUDED.period_end,
          updated_at = EXCLUDED.updated_at
      `, [`cnt_${user.id}`, user.id, durationInterval]);

      // 5. Create invoice
      let rawAmount = paymentEntity.amount !== undefined ? paymentEntity.amount : (payload.amount || PLAN_PRICES[finalPlan]?.[finalCycle] || 1499);
      const amount = rawAmount > 10000 ? Math.round(rawAmount / 100) : rawAmount;
      const tax = Math.round(amount * 0.18);

      const invoiceId = `inv_${uuidv4().slice(0, 12)}`;
      const invoiceNum = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      await client.query(`
        INSERT INTO invoices (
          id, user_id, subscription_id, invoice_number, amount, tax, currency, status, gateway, gateway_payment_id,
          billing_name, billing_email, gst_number, paid_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'INR', 'paid', $7, $8, $9, $10, $11, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      `, [
        invoiceId, user.id, targetSubId, invoiceNum, amount, tax, gateway,
        paymentEntity.id || `pay_${uuidv4().slice(0, 8)}`,
        payload.billing_name || user.name || 'Valued Creator',
        payload.billing_email || user.email,
        payload.gst_number || null
      ]);

      // Mark webhook event processed
      if (idempotencyKey) {
        await client.query("UPDATE payment_webhook_events SET status = 'processed' WHERE id = $1", [eventId]);
      }

      await client.query('COMMIT');
      return {
        duplicate: false,
        processed: true,
        plan: finalPlan,
        billingCycle: finalCycle,
        status: 'active',
        subscriptionId: targetSubId,
        isNewSubscription,
        periodEnd,
        invoiceNumber: invoiceNum,
        invoiceId
      };
    }

    if (['payment.failed', 'invoice.payment_failed'].includes(eventType)) {
      const gracePeriodEnd = new Date(Date.now() + THREE_DAYS_MS).toISOString();
      const subLockRes = await client.query(`
        SELECT id FROM subscriptions
        WHERE user_id = $1 AND status IN ('active', 'past_due', 'grace_period')
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE
      `, [user.id]);

      if (subLockRes.rows.length > 0) {
        await client.query(`
          UPDATE subscriptions SET
            status = 'grace_period',
            grace_period_ends_at = $1,
            grace_period_until = $1,
            updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          WHERE id = $2
        `, [gracePeriodEnd, subLockRes.rows[0].id]);
      } else {
        const newSubId = `sub_${uuidv4().slice(0, 12)}`;
        await client.query(`
          INSERT INTO subscriptions (
            id, user_id, plan, status, billing_cycle, current_period_start, current_period_end,
            grace_period_ends_at, grace_period_until, created_at, updated_at
          ) VALUES ($1, $2, $3, 'grace_period', 'monthly', to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), $4, $4, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
        `, [newSubId, user.id, user.plan || 'free', gracePeriodEnd]);
      }

      await client.query(`
        UPDATE users SET
          subscription_status = 'grace_period',
          updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        WHERE id = $1
      `, [user.id]);

      if (idempotencyKey) {
        await client.query("UPDATE payment_webhook_events SET status = 'processed' WHERE id = $1", [eventId]);
      }

      await client.query('COMMIT');
      return { duplicate: false, processed: true, status: 'grace_period' };
    }

    if (idempotencyKey) {
      await client.query("UPDATE payment_webhook_events SET status = 'processed' WHERE id = $1", [eventId]);
    }
    await client.query('COMMIT');
    return { duplicate: false, processed: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Hardened subscription expiry and reconciliation processor
 */
async function processSubscriptionExpiriesProduction(pool, explicitSubId = null) {
  const p = pool || db.getPgPool();
  if (!p) return { processed: 0 };

  const whereClause = explicitSubId
    ? 'WHERE id = $1'
    : `WHERE status IN ('active', 'trialing', 'past_due', 'grace_period')
         AND (
           (status = 'grace_period' AND safe_timestamptz(grace_period_ends_at) < NOW())
           OR (status IN ('active', 'trialing') AND safe_timestamptz(current_period_end) < NOW())
           OR (current_period_end IS NOT NULL AND safe_timestamptz(current_period_end) IS NULL)
         )`;
  const queryParams = explicitSubId ? [explicitSubId] : [];

  const candidatesRes = await p.query(`SELECT id FROM subscriptions ${whereClause}`, queryParams);
  let processedCount = 0;
  let lastResult = null;

  for (const candidate of candidatesRes.rows) {
    const client = await p.connect();
    try {
      await client.query('BEGIN');

      const subRes = await client.query(`
        SELECT id, user_id, plan, status, billing_cycle, cancel_at_period_end, current_period_end, grace_period_ends_at
        FROM subscriptions
        WHERE id = $1
        FOR UPDATE
      `, [candidate.id]);

      if (subRes.rows.length === 0) {
        await client.query('ROLLBACK');
        continue;
      }

      const sub = subRes.rows[0];

      // Terminal absorbing check
      if (!['active', 'trialing', 'grace_period', 'past_due'].includes(sub.status)) {
        await client.query('ROLLBACK');
        lastResult = { transitioned: false, reason: 'terminal_state_absorbing' };
        continue;
      }

      // Malformed timestamp quarantine check (Safe Failure - Zero Paid Entitlement)
      if (!sub.current_period_end || isNaN(new Date(sub.current_period_end).getTime())) {
        await client.query(`
          UPDATE subscriptions SET status = 'reconciliation_required', updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') WHERE id = $1
        `, [sub.id]);
        await client.query(`
          UPDATE users SET subscription_status = 'reconciliation_required', updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') WHERE id = $1
        `, [sub.user_id]);
        await client.query('COMMIT');
        lastResult = { transitioned: false, quarantined: true, reason: 'malformed_timestamp_quarantined' };
        processedCount++;
        continue;
      }

      const now = new Date();
      const periodEnd = new Date(sub.current_period_end);

      // Active grace period check
      if (sub.status === 'grace_period' && sub.grace_period_ends_at) {
        const graceEnd = new Date(sub.grace_period_ends_at);
        if (graceEnd > now) {
          await client.query('ROLLBACK');
          lastResult = { transitioned: false, reason: 'active_grace_period' };
          continue;
        }
      }

      // Period end check
      if (periodEnd >= now) {
        await client.query('ROLLBACK');
        lastResult = { transitioned: false, reason: 'period_not_ended' };
        continue;
      }

      // Strengthened Invoice Verification: direct subscription FK correlation within 48h renewal window
      const invoiceRes = await client.query(`
        SELECT id, invoice_number, amount, paid_at, created_at
        FROM invoices
        WHERE subscription_id = $1
          AND status = 'paid'
          AND (
            (paid_at IS NOT NULL AND safe_timestamptz(paid_at) >= safe_timestamptz($2) - INTERVAL '48 hours')
            OR (created_at IS NOT NULL AND safe_timestamptz(created_at) >= safe_timestamptz($2) - INTERVAL '48 hours')
          )
        ORDER BY COALESCE(safe_timestamptz(paid_at), safe_timestamptz(created_at)) DESC
        LIMIT 1
      `, [sub.id, sub.current_period_end]);

      if (invoiceRes.rows.length > 0) {
        // SELF-HEALING RECONCILIATION: Derive cycle from authoritative sub.billing_cycle (No NOW() + 30 days)
        const inv = invoiceRes.rows[0];
        const isYearly = (sub.billing_cycle || '').toLowerCase() === 'yearly' || (sub.billing_cycle || '').toLowerCase() === 'annual';

        const anchorDate = new Date(sub.current_period_end);
        const baseDate = !isNaN(anchorDate.getTime()) ? anchorDate : new Date(inv.paid_at || inv.created_at || now);

        // One calendar year or one calendar month
        let extendedEnd = new Date(baseDate);
        if (isYearly) {
          extendedEnd.setFullYear(extendedEnd.getFullYear() + 1);
        } else {
          extendedEnd.setMonth(extendedEnd.getMonth() + 1);
        }

        while (extendedEnd.getTime() <= now.getTime()) {
          if (isYearly) {
            extendedEnd.setFullYear(extendedEnd.getFullYear() + 1);
          } else {
            extendedEnd.setMonth(extendedEnd.getMonth() + 1);
          }
        }

        const extendedPeriodEnd = extendedEnd.toISOString();
        const recoveredPeriodStart = baseDate.toISOString();

        // Extend subscription
        await client.query(`
          UPDATE subscriptions SET
            status = 'active',
            current_period_end = $1,
            cancel_at_period_end = 0,
            canceled_at = NULL,
            grace_period_ends_at = NULL,
            updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          WHERE id = $2
        `, [extendedPeriodEnd, sub.id]);

        // Query usage counter to preserve: users.dm_usage_this_period = usage_counters.dms_sent
        const cntRes = await client.query('SELECT dms_sent, comments_replied FROM usage_counters WHERE user_id = $1', [sub.user_id]);
        const currentDmsSent = cntRes.rows[0]?.dms_sent || 0;
        const currentComments = cntRes.rows[0]?.comments_replied || 0;

        // Synchronize usage_counters with recovered subscription period
        await client.query(`
          INSERT INTO usage_counters (id, user_id, period_start, period_end, dms_sent, comments_replied, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
          ON CONFLICT (user_id) DO UPDATE SET
            period_start = EXCLUDED.period_start,
            period_end = EXCLUDED.period_end,
            dms_sent = EXCLUDED.dms_sent,
            comments_replied = EXCLUDED.comments_replied,
            updated_at = EXCLUDED.updated_at
        `, [`cnt_${sub.user_id}`, sub.user_id, recoveredPeriodStart, extendedPeriodEnd, currentDmsSent, currentComments]);

        // Update users cache: strictly preserves dm_usage_this_period = usage_counters.dms_sent
        await client.query(`
          UPDATE users SET
            plan = $1,
            subscription_status = 'active',
            dm_usage_this_period = $2,
            usage_period_start = $3,
            updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          WHERE id = $4
        `, [sub.plan, currentDmsSent, recoveredPeriodStart.slice(0, 10), sub.user_id]);

        await client.query('COMMIT');
        lastResult = {
          transitioned: false,
          reconciled: true,
          invoiceId: inv.id,
          newPeriodEnd: extendedPeriodEnd,
          recoveredPeriodStart,
          preservedUsage: currentDmsSent,
          isYearly
        };
        processedCount++;
        continue;
      }

      // Terminal Downgrade
      const terminalStatus = sub.cancel_at_period_end === 1 ? 'canceled' : 'expired';
      await client.query(`
        UPDATE subscriptions SET status = $1, updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') WHERE id = $2
      `, [terminalStatus, sub.id]);
      await client.query(`
        UPDATE users SET
          plan = 'free',
          subscription_status = $1,
          dm_usage_this_period = 0,
          usage_period_start = to_char(CURRENT_DATE, 'YYYY-MM-DD'),
          updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        WHERE id = $2
      `, [terminalStatus, sub.user_id]);
      await client.query(`
        INSERT INTO usage_counters (id, user_id, period_start, period_end, dms_sent, comments_replied, updated_at)
        VALUES ($1, $2, NOW(), NOW() + INTERVAL '30 days', 0, 0, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
        ON CONFLICT (user_id) DO UPDATE SET
          period_start = EXCLUDED.period_start,
          period_end = EXCLUDED.period_end,
          dms_sent = 0,
          comments_replied = 0,
          updated_at = EXCLUDED.updated_at
      `, [`cnt_${sub.user_id}`, sub.user_id]);

      await client.query('COMMIT');
      lastResult = { transitioned: true, terminalStatus, subId: sub.id, userId: sub.user_id };
      processedCount++;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  return { processed: processedCount, lastResult };
}

module.exports = {
  getCurrentEntitlementSubscription,
  getCanonicalFreePlan,
  runMigration009PreflightCheck,
  processPaymentWebhookProduction,
  processSubscriptionExpiriesProduction
};
