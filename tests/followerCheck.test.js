// tests/followerCheck.test.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });
const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const db = require('../backend/src/db');
const queue = require('../backend/src/services/queue');
const metaClient = require('../backend/src/services/metaClient');

async function runFollowerCheckTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 RUNNING FOLLOWER CHECK (FOLLOW-TO-UNLOCK) TEST SUITE');
  console.log('🧪 ========================================================');

  // 1. Get or create test user and Instagram account
  let user = await db.prepare("SELECT * FROM users WHERE email = 'test@example.com' LIMIT 1").get();
  if (!user) {
    user = await db.prepare("SELECT * FROM users LIMIT 1").get();
  }
  assert(user, 'A user must exist in database');

  let account = await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected' LIMIT 1").get(user.id);
  if (!account) {
    account = await db.prepare("SELECT * FROM instagram_accounts WHERE status = 'connected' LIMIT 1").get();
  }
  assert(account, 'A connected Instagram account must exist in database');

  console.log(`[Test] Using account @${account.username} (ID: ${account.id})`);

  // 2. Create a rule with require_follow = 1
  const ruleId = uuidv4();
  const triggerKeyword = `UNLOCK_${Date.now().toString().slice(-4)}`;
  const rewardDm = `🎉 UNLOCKED! Here is your exclusive masterclass link: https://airvix.com/vip-access`;
  const followPromptDm = `Hey {username}! You need to follow @${account.username} first to unlock your access! Reply DONE once you follow 🚀`;
  const followCommentReply = `Almost there! Follow @${account.username} and check DMs 📩`;

  await db.prepare(`
    INSERT INTO automation_rules (
      id, instagram_account_id, type, trigger_keyword, match_mode,
      reply_message, dm_reply_message, comment_reply_mode, comment_reply_message,
      require_follow, follow_prompt_message, follow_comment_reply,
      is_active, fire_count, created_at, updated_at
    ) VALUES (?, ?, 'comment_to_dm', ?, 'contains', ?, ?, 'both', 'Check your DM! 🚀', 1, ?, ?, 1, 0, datetime('now'), datetime('now'))
  `).run(ruleId, account.id, triggerKeyword, rewardDm, rewardDm, followPromptDm, followCommentReply);

  const rule = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(ruleId);
  assert.strictEqual(rule.require_follow, 1, 'Rule require_follow must be 1');
  console.log(`[Test] ✅ Created Follower-Gated rule with keyword "${triggerKeyword}"`);

  // 3. Test Non-Follower comment
  const nonFollowerUsername = `non_follower_${Date.now().toString().slice(-4)}`;
  const nonFollowerUid = `uid_${Date.now().toString().slice(-6)}`;
  const commentId1 = `c_nf_${Date.now()}`;

  console.log(`\n[Test 1] Simulating comment from non-follower: @${nonFollowerUsername}`);
  await queue.processComment(account.id, {
    commentId: commentId1,
    commenterId: nonFollowerUid,
    commenterUsername: nonFollowerUsername,
    text: `Send me ${triggerKeyword} please!`,
    createdTime: Date.now()
  });

  const replyRecord1 = await db.prepare('SELECT * FROM comment_replies WHERE comment_id = ?').get(commentId1);
  assert(replyRecord1, 'comment_replies record should exist for non-follower');
  assert.strictEqual(replyRecord1.follower_status, 'non_follower', 'follower_status must be non_follower');
  assert.strictEqual(replyRecord1.status, 'follow_prompt_sent', 'status must be follow_prompt_sent');
  assert(replyRecord1.reply_sent.includes('You need to follow'), 'Reply sent must be the follow prompt DM');
  console.log(`[Test 1] ✅ Non-follower detected! Follow prompt DM dispatched: "${replyRecord1.reply_sent}"`);

  // Check conversation has pending_follow_rule_id
  const conv1 = await db.prepare('SELECT * FROM conversations WHERE instagram_account_id = ? AND ig_scoped_user_id = ?').get(account.id, nonFollowerUid);
  assert(conv1, 'Conversation must exist');
  assert.strictEqual(conv1.pending_follow_rule_id, ruleId, 'Conversation pending_follow_rule_id must point to the gated rule');
  console.log(`[Test 1] ✅ Conversation saved with pending_follow_rule_id: ${conv1.pending_follow_rule_id}`);

  // 4. Test Inbound message from non-follower who hasn't followed yet
  console.log(`\n[Test 2] Simulating non-follower replying without following ("still waiting")...`);
  await queue.processMessage(account.ig_user_id, {
    messageId: `mid_msg_${Date.now()}`,
    senderId: nonFollowerUid,
    senderUsername: nonFollowerUsername,
    text: 'still waiting',
    timestamp: Date.now()
  });

  const conv1AfterWait = await db.prepare('SELECT * FROM conversations WHERE id = ?').get(conv1.id);
  assert.strictEqual(conv1AfterWait.pending_follow_rule_id, ruleId, 'Pending rule ID must remain because user has not followed');
  console.log(`[Test 2] ✅ Gate held! User reminded to follow.`);

  // 5. Test Follower Confirmation via Interactive Quick Reply Button ("✅ I've Followed" / payload: VERIFY_FOLLOW)
  console.log(`\n[Test 3] Simulating user tapping the interactive button "[✅ I've Followed]" (payload: VERIFY_FOLLOW)...`);
  await queue.processMessage(account.ig_user_id, {
    messageId: `mid_msg_btn_${Date.now()}`,
    senderId: nonFollowerUid,
    senderUsername: nonFollowerUsername,
    text: "✅ I've Followed",
    quickReplyPayload: 'VERIFY_FOLLOW',
    timestamp: Date.now()
  });

  const conv1Unlocked = await db.prepare('SELECT * FROM conversations WHERE id = ?').get(conv1.id);
  assert.strictEqual(conv1Unlocked.pending_follow_rule_id, null, 'Pending follow rule ID must be cleared after verification via interactive button');

  const unlockedMsg = await db.prepare("SELECT * FROM messages WHERE conversation_id = ? AND direction = 'outbound' ORDER BY created_at DESC LIMIT 1").get(conv1.id);
  assert(unlockedMsg, 'Unlocked outbound message must exist');
  assert(unlockedMsg.content.includes('UNLOCKED'), 'Delivered message must contain unlocked reward content');
  console.log(`[Test 3] ✅ Follow-to-Unlock verification via interactive button succeeded! Delivered: "${unlockedMsg.content}"`);

  // 6. Test Active Follower commenting directly
  const followerUsername = `follower_alice_${Date.now().toString().slice(-4)}`;
  const followerUid = `uid_fl_${Date.now().toString().slice(-6)}`;
  const commentId2 = `c_fl_${Date.now()}`;

  console.log(`\n[Test 4] Simulating comment from active follower: @${followerUsername}`);
  await queue.processComment(account.id, {
    commentId: commentId2,
    commenterId: followerUid,
    commenterUsername: followerUsername,
    text: `Give me ${triggerKeyword}!`,
    createdTime: Date.now()
  });

  const replyRecord2 = await db.prepare('SELECT * FROM comment_replies WHERE comment_id = ?').get(commentId2);
  assert(replyRecord2, 'comment_replies record should exist for active follower');
  assert.strictEqual(replyRecord2.follower_status, 'follower', 'follower_status must be follower');
  assert.strictEqual(replyRecord2.status, 'sent', 'status must be sent');
  assert(replyRecord2.reply_sent.includes('UNLOCKED'), 'Active follower must receive unlocked link immediately');
  console.log(`[Test 4] ✅ Active follower bypassed gate! Instant delivery: "${replyRecord2.reply_sent}"`);

  // Cleanup test rule
  await db.prepare('DELETE FROM automation_rules WHERE id = ?').run(ruleId);
  console.log('\n🎉 ALL FOLLOWER CHECK INTEGRATION TESTS PASSED PERFECTLY!');
  process.exit(0);
}

runFollowerCheckTests().catch(err => {
  console.error('❌ Follower check test failed:', err);
  process.exit(1);
});
