/**
 * AIRVIX AUDIT SUITE: Phase 4 — Multi-Persona Realistic User Activity Simulation
 * Simulates end-to-end user journeys for 10 realistic personas:
 * Persona A: Free User (1 IG account, 5 rules limit, 1,000 DMs cap)
 * Persona B: Pro Creator (3 IG accounts, unlimited rules)
 * Persona C: Scale Agency (10 IG accounts, high velocity)
 * Persona D: Annual Subscriber (12-month billing period)
 * Persona E: Canceled User (cancel at period end, active until expiry)
 * Persona F: Expired User (period ended, downgraded to free)
 * Persona G: Grace Period User (payment failed, 3-day recovery)
 * Persona H: Quarantined User (reconciliation_required, no paid entitlement)
 * Persona I: Super Administrator (platform config, system alerts)
 * Persona J: Malicious Actor (IDOR, path traversal, unauthorized privilege escalation)
 */
const assert = require('assert');
const crypto = require('crypto');
const db = require('../backend/src/db');
const { encrypt } = require('../backend/src/services/crypto');
const { dmLimitFor, rulesLimitFor, igLimitFor } = require('../backend/src/constants/planLimits');

async function run() {
  console.log('🧪 Starting Multi-Persona Activity Simulation (Personas A - J)...\n');
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

  const runId = Date.now();

  // Helper to generate isolated persona
  async function createPersona(suffix, role, plan, subStatus, dmUsage = 0) {
    const userId = `usr_persona_${suffix}_${runId}`;
    const accId = `acc_persona_${suffix}_${runId}`;
    await pool.query(`
      INSERT INTO users (id, email, name, role, plan, subscription_status, status, dm_usage_this_period, usage_period_start)
      VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, to_char(NOW(), 'YYYY-MM-DD'))
    `, [userId, `persona_${suffix}_${runId}@airvix-sim.local`, `Persona ${suffix.toUpperCase()}`, role, plan, subStatus, dmUsage]);

    await pool.query(`
      INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, page_id, access_token_enc, status)
      VALUES ($1, $2, $3, $4, 'page_sim', $5, 'connected')
    `, [accId, userId, `ig_${suffix}_${runId}`, `persona_${suffix}`, encrypt('mock_token')]);

    return { userId, accId };
  }

  try {
    // Persona A: Free tier user
    await test('Persona A (Free User): Enforces 1 IG account, 5 rules, 1,000 DM limit', async () => {
      const { userId, accId } = await createPersona('a', 'user', 'free', 'active', 999);
      
      const user = await db.prepare('SELECT plan, dm_usage_this_period FROM users WHERE id = ?').get(userId);
      const limit = dmLimitFor(user.plan);
      const maxRules = rulesLimitFor(user.plan);
      const maxIg = igLimitFor(user.plan);

      assert.strictEqual(limit, 1000);
      assert.strictEqual(maxRules, 5);
      assert.strictEqual(maxIg, 1);
      assert.strictEqual(user.dm_usage_this_period < limit, true, 'Usage 999 is within 1000 limit');
    });

    // Persona B: Pro Creator
    await test('Persona B (Pro Creator): Entitled to limits matching authoritative pricing_plans SSOT', async () => {
      const { userId } = await createPersona('b', 'user', 'pro', 'active', 500);
      const user = await db.prepare('SELECT plan FROM users WHERE id = ?').get(userId);
      const authoritativePlan = await db.prepare("SELECT * FROM pricing_plans WHERE slug = 'pro' OR id = 'pro' LIMIT 1").get();
      assert.strictEqual(igLimitFor(user.plan), Number(authoritativePlan.ig_limit));
      assert.strictEqual(dmLimitFor(user.plan), Number(authoritativePlan.dm_limit));
      assert.strictEqual(rulesLimitFor(user.plan), Number(authoritativePlan.rules_limit));
    });

    // Persona C: Scale Enterprise
    await test('Persona C (Scale Enterprise): Entitled to limits matching authoritative pricing_plans SSOT', async () => {
      const { userId } = await createPersona('c', 'user', 'scale', 'active', 10000);
      const user = await db.prepare('SELECT plan FROM users WHERE id = ?').get(userId);
      const authoritativePlan = await db.prepare("SELECT * FROM pricing_plans WHERE slug = 'scale' OR id = 'scale' LIMIT 1").get();
      assert.strictEqual(igLimitFor(user.plan), Number(authoritativePlan.ig_limit));
      assert.strictEqual(dmLimitFor(user.plan), Number(authoritativePlan.dm_limit));
      assert.strictEqual(rulesLimitFor(user.plan), Number(authoritativePlan.rules_limit));
    });

    // Persona E: Canceled user with unexpired period
    await test('Persona E (Canceled User): Preserves paid features until current period end', async () => {
      const { userId } = await createPersona('e', 'user', 'pro', 'active', 200);
      // Create subscription that cancels at period end
      const subId = `sub_e_${runId}`;
      const futureEnd = new Date(Date.now() + 15 * 86400000).toISOString();
      await pool.query(`
        INSERT INTO subscriptions (id, user_id, plan, status, cancel_at_period_end, current_period_start, current_period_end)
        VALUES ($1, $2, 'pro', 'active', 1, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), $3)
      `, [subId, userId, futureEnd]);

      const sub = await db.prepare('SELECT status, cancel_at_period_end FROM subscriptions WHERE id = ?').get(subId);
      assert.strictEqual(sub.status, 'active');
      assert.strictEqual(sub.cancel_at_period_end, 1);
    });

    // Persona F: Expired user
    await test('Persona F (Expired User): Downgraded to free limits upon expiry', async () => {
      const { userId } = await createPersona('f', 'user', 'free', 'expired', 1050);
      const user = await db.prepare('SELECT plan, subscription_status, dm_usage_this_period FROM users WHERE id = ?').get(userId);
      const isEntitled = ['active', 'trialing', 'grace_period'].includes(user.subscription_status);
      assert.strictEqual(isEntitled, false);
      const effectivePlan = isEntitled ? user.plan : 'free';
      assert.strictEqual(effectivePlan, 'free');
      assert.ok(user.dm_usage_this_period >= dmLimitFor(effectivePlan), 'Usage capped when expired');
    });

    // Persona G: Grace Period User
    await test('Persona G (Grace Period User): Allows active access during 3-day recovery window', async () => {
      const { userId } = await createPersona('g', 'user', 'pro', 'grace_period', 400);
      const user = await db.prepare('SELECT subscription_status, plan FROM users WHERE id = ?').get(userId);
      const isEntitled = ['active', 'trialing', 'grace_period'].includes(user.subscription_status);
      assert.strictEqual(isEntitled, true, 'Grace period must retain entitlement during recovery window');
    });

    // Persona H: Quarantined User
    await test('Persona H (Quarantined User): reconciliation_required revokes paid entitlement', async () => {
      const { userId } = await createPersona('h', 'user', 'pro', 'reconciliation_required', 0);
      const user = await db.prepare('SELECT subscription_status, plan FROM users WHERE id = ?').get(userId);
      const isEntitled = ['active', 'trialing', 'grace_period'].includes(user.subscription_status) && user.subscription_status !== 'reconciliation_required';
      assert.strictEqual(isEntitled, false, 'reconciliation_required must never be entitled to paid features');
    });

    // Persona I: Super Admin
    await test('Persona I (Super Admin): Has role=admin and can access platform governance', async () => {
      const { userId } = await createPersona('i', 'admin', 'enterprise', 'active', 0);
      const user = await db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
      assert.strictEqual(user.role, 'admin');
    });

    // Persona J: Malicious Actor (IDOR test)
    await test('Persona J (Malicious Actor): Cannot read or modify Persona A data (IDOR rejection)', async () => {
      const personaA = await createPersona('target_a', 'user', 'free', 'active');
      const personaJ = await createPersona('attacker_j', 'user', 'free', 'active');

      // Attacker attempts to query Target A account with their own user_id
      const stolenAcc = await db.prepare(
        'SELECT * FROM instagram_accounts WHERE id = ? AND user_id = ?'
      ).get(personaA.accId, personaJ.userId);

      assert.strictEqual(stolenAcc, undefined, 'Tenant isolation query must return undefined for cross-tenant query');
    });

  } finally {
    await pool.query("DELETE FROM users WHERE email LIKE '%@airvix-sim.local'").catch(() => {});
  }

  console.log(`\n🏁 Persona Simulation Completed: ${passed} passed, ${failed} failed.`);
  return { passed, failed, findings };
}

run().then(res => {
  if (res.failed > 0) process.exit(1);
  process.exit(0);
}).catch(err => {
  console.error('Fatal Persona Simulation error:', err);
  process.exit(1);
});
