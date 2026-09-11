// tests/metaPrerequisitesAndLoopSafety.test.js
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

process.env.NODE_ENV = 'test';
process.env.META_MOCK_MODE = 'true';
process.env.META_APP_SECRET = 'test_meta_app_secret_98765';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const db = require('../backend/src/db');
const { encrypt } = require('../backend/src/services/crypto');
const diagnostics = require('../backend/src/services/diagnostics');
const loopDetection = require('../backend/src/services/loopDetection');

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 Starting Meta Prerequisites, Diagnostics & Loop Safety Tests');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  // Allow Neon PostgreSQL background migrations to settle and ensure columns/tables exist
  await new Promise(r => setTimeout(r, 2000));
  if (db.getPgPool && db.getPgPool()) {
    const pool = db.getPgPool();
    await pool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS last_diagnostic_result TEXT;').catch(() => {});
    await pool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS last_diagnostic_at TEXT;').catch(() => {});
    await pool.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS daily_automated_dm_count INTEGER DEFAULT 0;').catch(() => {});
    await pool.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_automated_dm_date TEXT;').catch(() => {});
    await pool.query(`
      CREATE TABLE IF NOT EXISTS automation_loop_incidents (
        id TEXT PRIMARY KEY,
        instagram_account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
        conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
        target_user_id TEXT NOT NULL,
        trigger_rule_id TEXT,
        loop_reason TEXT NOT NULL,
        details TEXT,
        status TEXT DEFAULT 'active',
        detected_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        resolved_at TEXT
      );
    `).catch(() => {});
  }

  // -------------------------------------------------------------
  // Test 1: Diagnostics passes all 7 checks on a fully configured Professional account
  // -------------------------------------------------------------
  await test('runDiagnostics returns all 7 passed checks for a healthy Professional account', async () => {
    const mockAccount = {
      id: uuidv4(),
      username: 'creator_pro_valid',
      account_type: 'BUSINESS',
      page_id: '1092837465',
      fb_page_name: 'Creator Page',
      access_token_enc: encrypt('valid_active_token_12345'),
      token_expires_at: new Date(Date.now() + 50 * 24 * 3600 * 1000).toISOString(),
      status: 'connected'
    };

    const result = await diagnostics.runDiagnostics(mockAccount);
    assert.strictEqual(result.all_passed, true, 'All checks must pass');
    assert.strictEqual(result.checks.length, 7, 'Must evaluate all 7 checks');
    assert.strictEqual(result.passed_count, 7);
    assert.strictEqual(result.failed_count, 0);

    const checkIds = result.checks.map(c => c.id);
    assert(checkIds.includes('auth'));
    assert(checkIds.includes('account_type'));
    assert(checkIds.includes('business_asset'));
    assert(checkIds.includes('permissions'));
    assert(checkIds.includes('messaging_access'));
    assert(checkIds.includes('webhooks'));
    assert(checkIds.includes('api_capability'));
  });

  // -------------------------------------------------------------
  // Test 2: Diagnostics detects Personal account and provides actionable switch instructions
  // -------------------------------------------------------------
  await test('runDiagnostics flags Personal account with clear Instagram App switch instructions', async () => {
    const mockAccount = {
      id: uuidv4(),
      username: 'personal_user_123',
      account_type: 'PERSONAL',
      page_id: '1092837465',
      access_token_enc: encrypt('valid_token'),
      token_expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      status: 'connected'
    };

    const result = await diagnostics.runDiagnostics(mockAccount);
    assert.strictEqual(result.all_passed, false, 'Personal account must not pass diagnostics');
    const accTypeCheck = result.checks.find(c => c.id === 'account_type');
    assert(accTypeCheck, 'account_type check must be present');
    assert.strictEqual(accTypeCheck.status, 'failed');
    assert(accTypeCheck.problem.includes('Personal'));
    assert(accTypeCheck.resolution.includes('Professional Account'));
    assert.strictEqual(accTypeCheck.action, 'configure');
  });

  // -------------------------------------------------------------
  // Test 3: Diagnostics detects disabled "Allow Access to Messages" and guides user to Connected Tools
  // -------------------------------------------------------------
  await test('runDiagnostics flags disabled messaging access with instructions for Connected Tools', async () => {
    const mockAccount = {
      id: uuidv4(),
      username: 'creator_no_msg',
      account_type: 'CREATOR',
      page_id: '1092837465',
      access_token_enc: encrypt('token_no_messaging_access'),
      token_expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      status: 'connected'
    };

    const result = await diagnostics.runDiagnostics(mockAccount, { simulatedMessagingDisabled: true });
    assert.strictEqual(result.all_passed, false);
    const msgCheck = result.checks.find(c => c.id === 'messaging_access');
    assert(msgCheck, 'messaging_access check must be present');
    assert.strictEqual(msgCheck.status, 'failed');
    assert(msgCheck.resolution.includes('Connected Tools'));
    assert(msgCheck.resolution.includes('Allow Access to Messages'));
  });

  // -------------------------------------------------------------
  // Test 4: Self-Event Prevention correctly filters account ID, Page ID, FB ID, and username
  // -------------------------------------------------------------
  await test('isSelfEvent prevents self-replies across all connected account identities and echo events', () => {
    const account = {
      ig_user_id: '1784140000000001',
      page_id: '1092837465',
      fb_user_id: '9988776655',
      username: 'my_brand_page'
    };

    // Self IDs
    assert.strictEqual(loopDetection.isSelfEvent(account, '1784140000000001', 'some_fan'), true, 'ig_user_id match must be self-event');
    assert.strictEqual(loopDetection.isSelfEvent(account, '1092837465', 'some_fan'), true, 'page_id match must be self-event');
    assert.strictEqual(loopDetection.isSelfEvent(account, '9988776655', 'some_fan'), true, 'fb_user_id match must be self-event');
    assert.strictEqual(loopDetection.isSelfEvent(account, '9999999999', 'my_brand_page'), true, 'username match must be self-event');
    assert.strictEqual(loopDetection.isSelfEvent(account, '9999999999', '@my_brand_page'), true, 'username with @ match must be self-event');
    assert.strictEqual(loopDetection.isSelfEvent(account, '9999999999', 'other_user', true), true, 'echo event must be self-event');

    // Genuine external fan
    assert.strictEqual(loopDetection.isSelfEvent(account, '1234567890', 'genuine_fan'), false, 'external user must not be self-event');
  });

  // -------------------------------------------------------------
  // Test 5: Internal Per-User Daily Automated DM Limit (Internal Safeguard)
  // -------------------------------------------------------------
  await test('checkOutboundSafety enforces internal daily limit of automated DMs per recipient', async () => {
    const userId = uuidv4();
    const accountId = uuidv4();
    const convId = uuidv4();
    const recipientId = 'ig_fan_' + uuidv4().slice(0, 8);
    const today = new Date().toISOString().slice(0, 10);

    await db.prepare(`
      INSERT INTO users (id, email, plan, dm_usage_this_period, usage_period_start)
      VALUES (?, ?, 'pro', 0, date('now'))
    `).run(userId, `user_limit_${Date.now()}@example.com`);

    await db.prepare(`
      INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, page_id, access_token_enc, status)
      VALUES (?, ?, 'ig_host_99', 'host_brand', 'page_host_99', ?, 'connected')
    `).run(accountId, userId, encrypt('mock_host_token_99'));

    // Create conversation with 3 already-sent automated DMs today
    await db.prepare(`
      INSERT INTO conversations (
        id, instagram_account_id, ig_scoped_user_id, username, daily_automated_dm_count, last_automated_dm_date, last_user_message_at
      ) VALUES (?, ?, ?, 'test_fan', 3, ?, datetime('now'))
    `).run(convId, accountId, recipientId, today);

    const account = await db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(accountId);

    const safety = await loopDetection.checkOutboundSafety({
      account,
      recipientId,
      recipientUsername: 'test_fan',
      replyContent: 'Here is another DM link!',
      conversationId: convId
    });

    assert.strictEqual(safety.allow, false, 'Should be blocked once daily safeguard is reached');
    assert.strictEqual(safety.reason, 'internal_daily_limit_reached');
  });

  // -------------------------------------------------------------
  // Test 6: Bot-to-bot identical reply loop detection pauses conversation & records incident
  // -------------------------------------------------------------
  await test('checkOutboundSafety detects repeated identical automated replies and pauses conversation', async () => {
    const userId = uuidv4();
    const accountId = uuidv4();
    const convId = uuidv4();
    const recipientId = 'ig_bot_' + uuidv4().slice(0, 8);
    const ruleId = uuidv4();
    const repeatMsg = 'Thank you for messaging us! Tap link below.';

    await db.prepare(`
      INSERT INTO users (id, email, plan, dm_usage_this_period, usage_period_start)
      VALUES (?, ?, 'agency', 0, date('now'))
    `).run(userId, `user_loop_${Date.now()}@example.com`);

    await db.prepare(`
      INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, page_id, access_token_enc, status)
      VALUES (?, ?, 'ig_host_100', 'brand_loop_test', 'page_host_100', ?, 'connected')
    `).run(accountId, userId, encrypt('mock_host_token_100'));

    await db.prepare(`
      INSERT INTO conversations (
        id, instagram_account_id, ig_scoped_user_id, username, daily_automated_dm_count, last_automated_dm_date, status, last_user_message_at
      ) VALUES (?, ?, ?, 'external_bot', 0, date('now'), 'open', datetime('now'))
    `).run(convId, accountId, recipientId);

    // Insert 2 previous outbound messages with the exact same content in this conversation
    await db.prepare(`
      INSERT INTO messages (id, conversation_id, direction, content, status, created_at)
      VALUES (?, ?, 'outbound', ?, 'sent', datetime('now'))
    `).run(uuidv4(), convId, repeatMsg);
    await db.prepare(`
      INSERT INTO messages (id, conversation_id, direction, content, status, created_at)
      VALUES (?, ?, 'outbound', ?, 'sent', datetime('now'))
    `).run(uuidv4(), convId, repeatMsg);

    const account = await db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(accountId);

    // Attempting 3rd identical outbound message
    const safety = await loopDetection.checkOutboundSafety({
      account,
      recipientId,
      recipientUsername: 'external_bot',
      replyContent: repeatMsg,
      ruleId,
      conversationId: convId
    });

    assert.strictEqual(safety.allow, false, 'Must block recursive identical automated message');
    assert.strictEqual(safety.reason, 'repeated_content_loop');
    assert(safety.incidentId, 'Must return incident ID');

    // Verify conversation was paused
    const convAfter = await db.prepare('SELECT status FROM conversations WHERE id = ?').get(convId);
    assert.strictEqual(convAfter.status, 'loop_paused', 'Conversation must transition to loop_paused');

    // Verify incident record in database
    const incident = await db.prepare('SELECT * FROM automation_loop_incidents WHERE id = ?').get(safety.incidentId);
    assert(incident, 'Incident must be recorded in automation_loop_incidents');
    assert.strictEqual(incident.status, 'active');
    assert.strictEqual(incident.loop_reason, 'repeated_identical_replies');

    // -------------------------------------------------------------
    // Test 7: Loop incident resolution unpauses conversation
    // -------------------------------------------------------------
    const resolved = await loopDetection.resolveLoopIncident(safety.incidentId, accountId);
    assert(resolved, 'Incident must be resolved');

    const convReopened = await db.prepare('SELECT status FROM conversations WHERE id = ?').get(convId);
    assert.strictEqual(convReopened.status, 'open', 'Conversation status must return to open after resolution');
  });

  // -------------------------------------------------------------
  // Test 8: Webhook schema rejection for unsupported payload structure
  // -------------------------------------------------------------
  await test('POST /webhooks/instagram rejects invalid payload structures with HTTP 400', async () => {
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use('/webhooks', require('../backend/src/routes/webhooks'));

    const server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;

    const crypto = require('crypto');
    const appSecret = process.env.META_APP_SECRET || 'test_meta_app_secret_98765';

    try {
      // Invalid object type
      const body1 = JSON.stringify({ object: 'unsupported_object', entry: [] });
      const sig1 = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body1).digest('hex');
      const resp = await fetch(`http://127.0.0.1:${port}/webhooks/instagram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': sig1
        },
        body: body1
      });
      assert.strictEqual(resp.status, 400, 'Must reject unsupported object types with HTTP 400');

      // Malformed non-array entry
      const body2 = JSON.stringify({ object: 'instagram', entry: 'not_an_array' });
      const sig2 = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body2).digest('hex');
      const resp2 = await fetch(`http://127.0.0.1:${port}/webhooks/instagram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': sig2
        },
        body: body2
      });
      assert.strictEqual(resp2.status, 400, 'Must reject malformed entry with HTTP 400');
    } finally {
      server.close();
    }
  });

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    if (db.getPgPool && db.getPgPool()) {
      try { await db.getPgPool().end(); } catch (e) {}
    }
    setTimeout(() => process.exit(0), 100);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
