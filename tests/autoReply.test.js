// tests/autoReply.test.js
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

process.env.NODE_ENV = 'test';
process.env.META_MOCK_MODE = 'true';
process.env.META_APP_SECRET = 'test_meta_app_secret_98765';
process.env.FREE_PLAN_DM_LIMIT = '5'; // Low limit to test cap quickly

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const db = require('../backend/src/db');
const queue = require('../backend/src/services/queue');
const { verifyMetaSignature, generateMetaSignature, encrypt, decrypt } = require('../backend/src/services/crypto');

async function waitFor(predicate, timeoutMs = 5000, intervalMs = 100) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await predicate();
      if (res) return res;
    } catch (e) {}
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return await predicate();
}

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 Starting Instagram Auto-Reply MVP Tests (PostgreSQL)');
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
      failed++;
    }
  }

  // Set up fresh test database records
  const userId = uuidv4();
  const accountId = uuidv4();
  const igUserId = 'test_ig_' + uuidv4().slice(0, 10);

  await db.prepare(`
    INSERT INTO users (id, email, plan, dm_usage_this_period, usage_period_start)
    VALUES (?, ?, 'free', 0, date('now'))
  `).run(userId, `test_creator_${Date.now()}@example.com`);

  await db.prepare(`
    INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, page_id, access_token_enc, status, disclosure_message)
    VALUES (?, ?, ?, 'test_creator_account', '109283746501928', ?, 'connected', '⚡ [Automated Response] ')
  `).run(accountId, userId, igUserId, encrypt('mock_access_token_123'));

  const commentRuleId = uuidv4();
  await db.prepare(`
    INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, match_mode, reply_message, is_active)
    VALUES (?, ?, 'comment_to_dm', 'GUIDE', 'contains', 'Here is your free guide: https://example.com/guide', 1)
  `).run(commentRuleId, accountId);

  const dmRuleId = uuidv4();
  await db.prepare(`
    INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, match_mode, reply_message, is_active)
    VALUES (?, ?, 'dm_keyword_reply', 'PRICING', 'exact', 'Our pricing starts at $29/mo', 1)
  `).run(dmRuleId, accountId);

  // 1. Test Crypto encryption & decryption
  await test('Encryption and Decryption matches original string', () => {
    const original = 'EAABwdN...page_token_secret';
    const encrypted = encrypt(original);
    assert.notStrictEqual(encrypted, original);
    const decrypted = decrypt(encrypted);
    assert.strictEqual(decrypted, original);
  });

  // 2. Test HMAC-SHA256 Webhook signature validation
  await test('Webhook signature verification succeeds on valid payload & fails on tampering', () => {
    const secret = 'test_meta_app_secret_98765';
    const payload = JSON.stringify({ object: 'instagram', entry: [] });
    const signature = generateMetaSignature(payload, secret);

    const isValid = verifyMetaSignature(payload, signature, secret);
    assert.strictEqual(isValid, true, 'Valid signature should be accepted');

    const isInvalid = verifyMetaSignature(payload + 'tampered', signature, secret);
    assert.strictEqual(isInvalid, false, 'Tampered payload should be rejected');
  });

  // 3. Test Comment-to-DM happy path
  await test('Comment containing trigger keyword receives private reply', async () => {
    const commentId = `comment_test_${Date.now()}_1`;
    queue.enqueue({
      type: 'comments',
      accountId: igUserId,
      data: {
        commentId,
        text: 'Please send me the GUIDE right away!',
        commenterId: 'user_1001',
        commenterUsername: 'commenter_alice',
        createdTime: Date.now()
      }
    });

    const reply = await waitFor(async () => {
      return await db.prepare('SELECT * FROM comment_replies WHERE comment_id = ?').get(commentId);
    });

    assert(reply, 'Reply record must exist');
    assert.strictEqual(reply.status, 'sent');
    assert(reply.reply_sent.includes('⚡ [Automated Response] Here is your free guide'));
    assert(reply.meta_message_id, 'Must contain Meta message ID');
  });

  // 4. Test Comment-to-DM Idempotency (Zero duplicate replies)
  await test('Duplicate comment webhook does not send second reply (Idempotency Check)', async () => {
    const commentId = `comment_test_idempotent_${Date.now()}`;
    
    // First send
    queue.enqueue({
      type: 'comments',
      accountId: igUserId,
      data: {
        commentId,
        text: 'I want the GUIDE',
        commenterId: 'user_1002',
        commenterUsername: 'commenter_bob',
        createdTime: Date.now()
      }
    });

    await waitFor(async () => {
      return await db.prepare('SELECT * FROM comment_replies WHERE comment_id = ?').get(commentId);
    });

    // Duplicate event arrives (Meta retry)
    queue.enqueue({
      type: 'comments',
      accountId: igUserId,
      data: {
        commentId,
        text: 'I want the GUIDE',
        commenterId: 'user_1002',
        commenterUsername: 'commenter_bob',
        createdTime: Date.now()
      }
    });

    await new Promise(r => setTimeout(r, 600));

    const count = (await db.prepare('SELECT COUNT(*) as count FROM comment_replies WHERE comment_id = ?').get(commentId)).count;
    assert.strictEqual(count, 1, 'Only exactly 1 reply record must exist in DB for same comment_id');
  });

  // 5. Test 7-Day Comment Age Limit
  await test('Comment older than 7 days is skipped with window_closed status', async () => {
    const commentId = `comment_old_${Date.now()}`;
    const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);

    queue.enqueue({
      type: 'comments',
      accountId: igUserId,
      data: {
        commentId,
        text: 'GUIDE please',
        commenterId: 'user_old',
        commenterUsername: 'old_user',
        createdTime: eightDaysAgo
      }
    });

    const reply = await waitFor(async () => {
      return await db.prepare('SELECT * FROM comment_replies WHERE comment_id = ?').get(commentId);
    });

    assert(reply, 'Reply record should be logged');
    assert.strictEqual(reply.status, 'window_closed');
  });

  // 6. Test DM Keyword Auto-Reply happy path & 24h window
  await test('DM matching keyword within 24h receives auto-reply', async () => {
    const senderId = 'ig_user_dm_101_' + Date.now();
    queue.enqueue({
      type: 'messages',
      accountId: igUserId,
      data: {
        messageId: 'mid_test_' + Date.now(),
        senderId,
        senderUsername: 'dm_tester',
        text: 'PRICING',
        timestamp: Date.now()
      }
    });

    const conv = await waitFor(async () => {
      return await db.prepare('SELECT * FROM conversations WHERE ig_scoped_user_id = ?').get(senderId);
    });
    assert(conv, 'Conversation record must be upserted');

    const sentMessage = await waitFor(async () => {
      return await db.prepare("SELECT * FROM messages WHERE conversation_id = ? AND direction = 'outbound'").get(conv.id);
    });
    assert(sentMessage, 'Outbound message record must exist');
    assert.strictEqual(sentMessage.status, 'sent');
  });

  // 7. Test Free Plan DM Cap Enforcement
  await test('Free plan cap enforcement halts sends and logs usage_capped', async () => {
    // Current cap is set to 5 for test
    await db.prepare('UPDATE users SET dm_usage_this_period = 5 WHERE id = ?').run(userId);

    const commentId = `comment_cap_test_${Date.now()}`;
    queue.enqueue({
      type: 'comments',
      accountId: igUserId,
      data: {
        commentId,
        text: 'GUIDE',
        commenterId: 'user_capped',
        commenterUsername: 'capped_user',
        createdTime: Date.now()
      }
    });

    const reply = await waitFor(async () => {
      return await db.prepare('SELECT * FROM comment_replies WHERE comment_id = ?').get(commentId);
    });

    assert(reply, 'Reply record must exist');
    assert.strictEqual(reply.status, 'usage_capped');
  });

  // Cleanup test artifacts from database
  try {
    await db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  } catch (e) {}

  if (db.getPgPool()) {
    await db.getPgPool().end();
  }

  console.log('\n----------------------------------------');
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('----------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
