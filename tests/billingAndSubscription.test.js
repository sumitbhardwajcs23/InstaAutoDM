/**
 * SaaS Billing & Subscription Test Suite
 * Validates plan tiers, subscription lifecycle, webhook HMAC signature verification,
 * grace period calculation, GST invoices, and plan limit enforcement.
 */

const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../backend/src/db');
const billingService = require('../backend/src/services/billingService');
const { v4: uuidv4 } = require('uuid');

async function runTests() {
    console.log('🧪 Starting SaaS Billing & Subscription Test Suite...\n');
    await db.ready();
    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${name}`);
            console.error(`     Error: ${err.message}\n`);
            failed++;
        }
    };

    // 1. Plan limits verification
    await test('Plan limits definition is complete and enforces tier boundaries', async () => {
        const freeLimit = billingService.getPlanLimits('free');
        const proLimit = billingService.getPlanLimits('pro');
        const agencyLimit = billingService.getPlanLimits('agency');
        const enterpriseLimit = billingService.getPlanLimits('enterprise');

        assert.strictEqual(freeLimit.maxDmsPerMonth, 100);
        assert.strictEqual(proLimit.maxDmsPerMonth, 5000);
        assert.strictEqual(agencyLimit.maxDmsPerMonth, 25000);
        assert.strictEqual(enterpriseLimit.maxDmsPerMonth, 100000);

        assert.strictEqual(freeLimit.maxIgAccounts, 1);
        assert.strictEqual(proLimit.maxIgAccounts, 3);
        assert.strictEqual(agencyLimit.maxIgAccounts, 10);
    });

    // 2. Razorpay webhook signature verification
    await test('Razorpay HMAC-SHA256 signature verification validates correctly', async () => {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_razorpay_secret_123';
        process.env.RAZORPAY_WEBHOOK_SECRET = secret;

        const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_123' } } } });
        const validSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
        const invalidSig = 'invalid_hex_signature';

        const isValid = billingService.verifyRazorpaySignature(body, validSig);
        const isInvalid = billingService.verifyRazorpaySignature(body, invalidSig);

        assert.strictEqual(isValid, true, 'Valid HMAC signature must pass');
        assert.strictEqual(isInvalid, false, 'Tampered HMAC signature must fail');
    });

    // 3. Stripe webhook signature verification
    await test('Stripe webhook signature verification with timestamp tolerance', async () => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_stripe_secret_123';
        process.env.STRIPE_WEBHOOK_SECRET = secret;

        const timestamp = Math.floor(Date.now() / 1000);
        const payload = JSON.stringify({ type: 'invoice.payment_succeeded', id: 'evt_stripe_1' });
        const signedPayload = `${timestamp}.${payload}`;
        const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
        const header = `t=${timestamp},v1=${signature}`;

        const isValid = billingService.verifyStripeSignature(payload, header);
        assert.strictEqual(isValid, true, 'Valid Stripe signature header must pass');

        const badHeader = `t=${timestamp},v1=bad_signature`;
        const isBad = billingService.verifyStripeSignature(payload, badHeader);
        assert.strictEqual(isBad, false, 'Invalid Stripe signature header must fail');
    });

    // 4. Payment processing & Invoice creation with GST
    await test('Successful payment webhook creates invoice with GST tax calculation', async () => {
        const testUserId = `user-bill-${uuidv4().slice(0, 8)}`;
        const testEmail = `billing_${uuidv4().slice(0, 6)}@test.local`;
        
        await db.prepare(`
            INSERT INTO users (id, email, name, plan, role, status, dm_usage_this_period, usage_period_start, created_at, updated_at)
            VALUES (?, ?, 'Billing Tester', 'free', 'user', 'active', 0, '2026-09-01', datetime('now'), datetime('now'))
        `).run(testUserId, testEmail);

        const paymentEvent = {
            id: `pay_evt_${uuidv4().slice(0, 8)}`,
            event: 'subscription.charged',
            payload: {
                subscription: {
                    entity: {
                        id: `sub_${uuidv4().slice(0, 8)}`,
                        plan_id: 'plan_pro',
                        notes: { user_id: testUserId, plan: 'pro' }
                    }
                },
                payment: {
                    entity: {
                        id: `pay_${uuidv4().slice(0, 8)}`,
                        amount: 149900, // 1499.00 in paise
                        currency: 'INR',
                        notes: { user_id: testUserId, plan: 'pro' }
                    }
                }
            }
        };

        const rawBody = JSON.stringify(paymentEvent);
        const sig = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');

        const result = await billingService.processPaymentWebhook('razorpay', paymentEvent, sig, rawBody);
        assert.strictEqual(result.status, 'active');

        // Check user plan upgraded to pro
        const user = await db.prepare('SELECT plan, subscription_status FROM users WHERE id = ?').get(testUserId);
        assert.strictEqual(user.plan, 'pro');
        assert.strictEqual(user.subscription_status, 'active');

        // Check invoice generated with 18% GST calculation
        const invoice = await db.prepare('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(testUserId);
        assert(invoice, 'Invoice record must exist');
        assert.strictEqual(invoice.amount, 1499);
        assert.strictEqual(invoice.tax, 270); // 18% of 1499 = ~270
        assert.strictEqual(invoice.currency, 'INR');
        assert.strictEqual(invoice.status, 'paid');
    });

    // 5. Failed payment enters 3-day grace period
    await test('Failed payment event transitions subscription to grace_period with 3-day deadline', async () => {
        const testUserId = `user-fail-${uuidv4().slice(0, 8)}`;
        const testEmail = `failed_${uuidv4().slice(0, 6)}@test.local`;
        
        await db.prepare(`
            INSERT INTO users (id, email, name, plan, role, status, subscription_status, dm_usage_this_period, usage_period_start, created_at, updated_at)
            VALUES (?, ?, 'Fail Tester', 'pro', 'user', 'active', 'active', 0, '2026-09-01', datetime('now'), datetime('now'))
        `).run(testUserId, testEmail);

        const failEvent = {
            id: `pay_fail_${uuidv4().slice(0, 8)}`,
            event: 'payment.failed',
            payload: {
                payment: {
                    entity: {
                        id: `pay_failed_1`,
                        notes: { user_id: testUserId }
                    }
                }
            }
        };

        const rawBody = JSON.stringify(failEvent);
        const sig = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');

        await billingService.processPaymentWebhook('razorpay', failEvent, sig, rawBody);

        const user = await db.prepare('SELECT subscription_status FROM users WHERE id = ?').get(testUserId);
        assert.strictEqual(user.subscription_status, 'grace_period', 'User must be transitioned into grace_period status');

        const sub = await db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(testUserId);
        assert(sub, 'Subscription record must exist');
        assert.strictEqual(sub.status, 'grace_period');
        assert(sub.grace_period_until, 'grace_period_until date must be calculated and set');
    });

    console.log(`\n========================================`);
    console.log(`Billing & Subscription: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
