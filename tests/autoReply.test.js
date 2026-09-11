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

async function waitFor(predicate, timeoutMs = 12000, intervalMs = 100) {
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

  // 8. Test Comment Rule with comment_reply_mode = 'both'
  await test('Comment Rule with mode=both posts public comment reply AND sends private DM', async () => {
    // Reset usage for test
    await db.prepare('UPDATE users SET dm_usage_this_period = 0 WHERE id = ?').run(userId);

    const bothRuleId = uuidv4();
    await db.prepare(`
      INSERT INTO automation_rules (
        id, instagram_account_id, type, trigger_keyword, match_mode, 
        reply_message, comment_reply_mode, comment_reply_message, dm_reply_message, is_active
      ) VALUES (?, ?, 'comment_to_dm', 'PROMO', 'exact', 'Here is the promo: PROMO20', 'both', 'Check your DM! 🚀', 'Hey {username}! Here is your promo code: PROMO20', 1)
    `).run(bothRuleId, accountId);

    const commentId = `comm_both_${Date.now()}`;
    queue.enqueue({
      type: 'comments',
      accountId: igUserId,
      data: {
        commentId,
        text: 'PROMO',
        commenterId: 'user_both_' + Date.now(),
        commenterUsername: 'promo_fan',
        createdTime: Date.now()
      }
    });

    const reply = await waitFor(async () => {
      return await db.prepare('SELECT * FROM comment_replies WHERE comment_id = ?').get(commentId);
    });

    assert(reply, 'Reply record must exist');
    assert.strictEqual(reply.status, 'sent', 'Status should be sent');
    assert(reply.public_reply_sent && reply.public_reply_sent.includes('Check your DM!'), 'Public reply should be sent');
    assert(reply.reply_sent && reply.reply_sent.includes('promo code: PROMO20'), 'DM reply should be sent');
    assert(reply.reply_sent && reply.reply_sent.includes('promo_fan'), 'DM reply should substitute {username}');
  });

  // 9. Test Comment Rule with comment_reply_mode = 'comment_only'
  await test('Comment Rule with mode=comment_only posts public comment reply but sends NO DM', async () => {
    const commentOnlyRuleId = uuidv4();
    await db.prepare(`
      INSERT INTO automation_rules (
        id, instagram_account_id, type, trigger_keyword, match_mode, 
        reply_message, comment_reply_mode, comment_reply_message, dm_reply_message, is_active
      ) VALUES (?, ?, 'comment_to_dm', 'THANKS', 'exact', 'Thank you so much!', 'comment_only', 'Thank you @{username}! ❤️', NULL, 1)
    `).run(commentOnlyRuleId, accountId);

    const commentId = `comm_comment_only_${Date.now()}`;
    queue.enqueue({
      type: 'comments',
      accountId: igUserId,
      data: {
        commentId,
        text: 'THANKS',
        commenterId: 'user_comment_only_' + Date.now(),
        commenterUsername: 'grateful_user',
        createdTime: Date.now()
      }
    });

    const reply = await waitFor(async () => {
      return await db.prepare('SELECT * FROM comment_replies WHERE comment_id = ?').get(commentId);
    });

    assert(reply, 'Reply record must exist');
    assert.strictEqual(reply.status, 'sent');
    assert(reply.public_reply_sent && reply.public_reply_sent.includes('Thank you @grateful_user! ❤️'), 'Public reply should be sent and substitute @username');
    assert.strictEqual(reply.reply_sent, null, 'Private DM must NOT be sent for comment_only mode');
  });

  // 10. Test Comment Rule with comment_reply_mode = 'dm_only'
  await test('Comment Rule with mode=dm_only sends private DM but posts NO public comment reply', async () => {
    const dmOnlyRuleId = uuidv4();
    await db.prepare(`
      INSERT INTO automation_rules (
        id, instagram_account_id, type, trigger_keyword, match_mode, 
        reply_message, comment_reply_mode, comment_reply_message, dm_reply_message, is_active
      ) VALUES (?, ?, 'comment_to_dm', 'SECRET', 'exact', 'Secret link: https://secret.com', 'dm_only', NULL, 'Shh {username}, here is the secret link!', 1)
    `).run(dmOnlyRuleId, accountId);

    const commentId = `comm_dm_only_${Date.now()}`;
    queue.enqueue({
      type: 'comments',
      accountId: igUserId,
      data: {
        commentId,
        text: 'SECRET',
        commenterId: 'user_dm_only_' + Date.now(),
        commenterUsername: 'secret_agent',
        createdTime: Date.now()
      }
    });

    const reply = await waitFor(async () => {
      return await db.prepare('SELECT * FROM comment_replies WHERE comment_id = ?').get(commentId);
    });

    assert(reply, 'Reply record must exist');
    assert.strictEqual(reply.status, 'sent');
    assert.strictEqual(reply.public_reply_sent, null, 'Public reply must NOT be posted for dm_only mode');
    assert(reply.reply_sent && reply.reply_sent.includes('Shh secret_agent'), 'Private DM must be sent with username');
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
