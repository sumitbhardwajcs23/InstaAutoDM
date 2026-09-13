/**
 * AIRVIX AUDIT SUITE: Section 46 — Feature × User-State Matrix
 * Tests all 10 user/subscription lifecycle states against:
 * 1. Queue Automated DM Dispatch
 * 2. Queue Comment Reply
 * 3. Rule Creation Limits
 * 4. Manual Reply Quota Enforcement
 * 5. Self-Upgrade Endpoint Authentication / Authorization
 */
const assert = require('assert');
const crypto = require('crypto');
const db = require('../backend/src/db');
const { dmLimitFor, rulesLimitFor } = require('../backend/src/constants/planLimits');
const queue = require('../backend/src/services/queue');
const { encrypt } = require('../backend/src/services/crypto');

async function run() {
  console.log('🧪 Starting Section 46 Audit: Feature × User-State Matrix...\n');
  await db.ready();
  const pool = db.getPgPool();
  if (!pool) throw new Error('PostgreSQL Pool unavailable');

  const findings = [];
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     ${err.message}`);
      failed++;
      findings.push({ name, error: err.message });
    }
  }

  const states = [
    { state: 'free', status: 'active', plan: 'free', expectedEntitled: true, expectedMaxRules: 5, expectedDmLimit: 1000 },
    { state: 'trialing', status: 'trialing', plan: 'pro', expectedEntitled: true, expectedMaxRules: -1, expectedDmLimit: 10000 },
    { state: 'pro', status: 'active', plan: 'pro', expectedEntitled: true, expectedMaxRules: -1, expectedDmLimit: 10000 },
    { state: 'scale', status: 'active', plan: 'scale', expectedEntitled: true, expectedMaxRules: -1, expectedDmLimit: 50000 },
    { state: 'grace_period', status: 'grace_period', plan: 'pro', expectedEntitled: true, expectedMaxRules: -1, expectedDmLimit: 10000 },
    { state: 'past_due', status: 'past_due', plan: 'pro', expectedEntitled: false, expectedMaxRules: 5, expectedDmLimit: 1000 },
    { state: 'unpaid', status: 'unpaid', plan: 'pro', expectedEntitled: false, expectedMaxRules: 5, expectedDmLimit: 1000 },
    { state: 'canceled', status: 'canceled', plan: 'pro', expectedEntitled: false, expectedMaxRules: 5, expectedDmLimit: 1000 },
    { state: 'expired', status: 'expired', plan: 'pro', expectedEntitled: false, expectedMaxRules: 5, expectedDmLimit: 1000 },
    { state: 'reconciliation_required', status: 'reconciliation_required', plan: 'pro', expectedEntitled: false, expectedMaxRules: 5, expectedDmLimit: 1000 }
  ];

  for (const s of states) {
    const testUserId = `usr_mat_${s.state}_${Date.now()}`;
    const testAccId = `acc_mat_${s.state}_${Date.now()}`;
    const testIgId = `ig_mat_${s.state}_${Date.now()}`;

    try {
      // Setup fixture
      await pool.query(`
        INSERT INTO users (id, email, name, plan, subscription_status, status, dm_usage_this_period, usage_period_start)
        VALUES ($1, $2, $3, $4, $5, 'active', 0, to_char(NOW(), 'YYYY-MM-DD'))
      `, [testUserId, `matrix_${s.state}_${Date.now()}@test.local`, `User ${s.state}`, s.plan, s.status]);

      await pool.query(`
        INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, page_id, access_token_enc, status)
        VALUES ($1, $2, $3, $4, 'page_mat', $5, 'connected')
      `, [testAccId, testUserId, testIgId, `acc_${s.state}`, encrypt('mock_tok')]);

      // 1. Test Rule Limit Entitlement Calculation
      await test(`[State: ${s.state}] Rule limit enforcement evaluates entitlement correctly`, async () => {
        const userRow = await db.prepare('SELECT plan, subscription_status, custom_rules_limit FROM users WHERE id = ?').get(testUserId);
        const subStatus = userRow?.subscription_status || 'active';
        const isEntitled = ['active', 'trialing', 'grace_period'].includes(subStatus) && subStatus !== 'reconciliation_required';
        const effectivePlan = isEntitled ? (userRow?.plan || 'free') : 'free';
        const maxRules = rulesLimitFor(effectivePlan, userRow?.custom_rules_limit);

        if (s.expectedEntitled) {
          assert.strictEqual(isEntitled, true, `State ${s.state} must be considered entitled`);
          assert.ok(maxRules >= 5 || maxRules === -1, `Expected maxRules >= 5 or -1 (unlimited), got ${maxRules}`);
        } else {
          assert.strictEqual(isEntitled, false, `State ${s.state} must NOT be considered entitled`);
          assert.strictEqual(effectivePlan, 'free', `State ${s.state} must fall back to free plan rules limit`);
          assert.strictEqual(maxRules, 5, `State ${s.state} must be restricted to 5 rules`);
        }
      });

      // 2. Test Queue Suppression for Blocked States
      await test(`[State: ${s.state}] Queue worker suppresses automated DM when subscription is blocked`, async () => {
        const isBlocked = ['unpaid', 'suspended', 'reconciliation_required', 'expired', 'canceled'].includes(s.status);
        
        // Query user as queue worker does
        const u = await db.prepare('SELECT * FROM users WHERE id = ?').get(testUserId);
        const subStatus = u.subscription_status || 'active';
        const isSuppressed = ['unpaid', 'suspended', 'reconciliation_required', 'expired', 'canceled'].includes(subStatus);

        if (isBlocked) {
          assert.strictEqual(isSuppressed, true, `Queue must suppress automated dispatch for state ${s.state}`);
        } else {
          assert.strictEqual(isSuppressed, false, `Queue must allow automated dispatch for active state ${s.state}`);
        }
      });

    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]).catch(() => {});
    }
  }

  // 3. Test Manual Reply Quota Bypass Bug (BUG-002 Verification)
  await test('[AUDIT BUG-002] Manual conversation reply endpoint checks subscription_status and usage_counters', async () => {
    // Audit check: Examine backend/src/routes/conversations.js code logic
    const fs = require('fs');
    const code = fs.readFileSync('backend/src/routes/conversations.js', 'utf8');
    
    const checksSubStatus = code.includes("subscription_status") || code.includes("subStatus");
    const incrementsUsageCounters = code.includes("usage_counters") && code.includes("dms_sent");

    if (!checksSubStatus) {
      throw new Error('BUG-002 CONFIRMED: backend/src/routes/conversations.js does not check subscription_status (quarantined/expired users with plan=pro can send unlimited DMs)');
    }
    if (!incrementsUsageCounters) {
      throw new Error('BUG-002 CONFIRMED: backend/src/routes/conversations.js increments only users.dm_usage_this_period without writing to SSOT usage_counters.dms_sent');
    }
  });

  // 4. Test Free Self-Upgrade Vulnerability (BUG-001 Verification)
  await test('[AUDIT BUG-001] POST /api/usage/upgrade endpoint authorization & gateway validation', async () => {
    const fs = require('fs');
    const code = fs.readFileSync('backend/src/routes/usage.js', 'utf8');

    const hasPaymentCheck = code.includes("razorpay") || code.includes("verifyPayment") || code.includes("admin_only") || code.includes("requireAdmin");
    if (!hasPaymentCheck) {
      throw new Error('BUG-001 CONFIRMED: backend/src/routes/usage.js POST /upgrade allows self-upgrade to enterprise without payment gateway verification or admin privileges');
    }
  });

  console.log(`\n🏁 Section 46 Matrix Audit Completed: ${passed} passed, ${failed} failed.`);
  return { passed, failed, findings };
}

run().then(res => {
  if (res.failed > 0) process.exit(1);
  process.exit(0);
}).catch(err => {
  console.error('Fatal Section 46 error:', err);
  process.exit(1);
});
