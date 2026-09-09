// tests/mediaAndTargeting.test.js
// Automated verification for Media Hub, Reel targeting, and Story reply engine
const assert = require('assert');
const metaClient = require('../backend/src/services/metaClient');
const queue = require('../backend/src/services/queue');
const db = require('../backend/src/db');
const { v4: uuidv4 } = require('uuid');

async function runTests() {
  console.log('\n--- 🧪 STARTING MEDIA HUB & REEL/STORY AUTOMATION TESTS ---');

  // 1. Test MetaClient Media List Fetch (top 30 default)
  console.log('Test 1: Fetching top 30 media items...');
  const mediaResult = await metaClient.getAccountMedia({ limit: 30 });
  assert(Array.isArray(mediaResult.data), 'mediaResult.data should be an array');
  assert.strictEqual(mediaResult.data.length, 30, 'Should return exactly 30 items by default');
  assert(mediaResult.paging?.cursors?.after, 'Should return next pagination cursor');
  assert(mediaResult.data[0].id, 'Media item should have an id');
  assert(mediaResult.data[0].thumbnail_url, 'Media item should have thumbnail_url');
  console.log('✅ Test 1 Passed: 30 media items fetched with pagination cursor:', mediaResult.paging.cursors.after);

  // 2. Test Pagination (Load More next 30 items)
  console.log('Test 2: Fetching page 2 with cursor...');
  const page2Result = await metaClient.getAccountMedia({ limit: 30, after: mediaResult.paging.cursors.after });
  assert.strictEqual(page2Result.data.length, 30, 'Page 2 should return 30 items');
  assert.notStrictEqual(page2Result.data[0].id, mediaResult.data[0].id, 'Page 2 first item should differ from Page 1');
  console.log('✅ Test 2 Passed: Page 2 cursor pagination works cleanly.');

  // 3. Test Stories Fetch
  console.log('Test 3: Fetching active 24h stories...');
  const stories = await metaClient.getAccountStories({});
  assert(Array.isArray(stories), 'Stories should be an array');
  assert(stories.length > 0, 'Should return stories list');
  console.log(`✅ Test 3 Passed: ${stories.length} stories retrieved.`);

  // 4. Test DB Rule Targeting Specific Reel
  console.log('Test 4: Creating Rule for specific Reel...');
  const testUserId = uuidv4();
  const testAccId = uuidv4();
  const reelId = 'reel_test_1001';
  const otherReelId = 'reel_test_9999';

  // Seed test user and account
  await db.prepare("INSERT INTO users (id, email, usage_period_start) VALUES (?, ?, datetime('now'))").run(testUserId, `test_${Date.now()}@example.com`);
  await db.prepare("INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, page_id, access_token_enc, status) VALUES (?, ?, ?, 'test_creator', 'pid_1', 'dummy_enc', 'connected')").run(testAccId, testUserId, `ig_${Date.now()}`);

  const specificRuleId = uuidv4();
  const globalRuleId = uuidv4();
  const storyRuleId = uuidv4();

  // Rule A: Specific Reel rule on "PRICE"
  await db.prepare(`
    INSERT INTO automation_rules (
      id, instagram_account_id, type, trigger_keyword, match_mode,
      reply_message, comment_reply_mode, comment_reply_message, dm_reply_message,
      target_media_id, target_media_type, target_media_caption, is_active, created_at, updated_at
    ) VALUES (?, ?, 'comment_to_dm', 'PRICE', 'contains', 'DM: Reel Specific Price Sheet', 'both', 'Check DM! 🚀 | Link sent! 📩', 'DM: Reel Specific Price Sheet', ?, 'reel', 'VIP pricing reel', 1, datetime('now'), datetime('now'))
  `).run(specificRuleId, testAccId, reelId);

  // Rule B: Global rule on "PRICE"
  await db.prepare(`
    INSERT INTO automation_rules (
      id, instagram_account_id, type, trigger_keyword, match_mode,
      reply_message, comment_reply_mode, comment_reply_message, dm_reply_message,
      target_media_id, target_media_type, is_active, created_at, updated_at
    ) VALUES (?, ?, 'comment_to_dm', 'PRICE', 'contains', 'DM: Global General Price', 'both', 'General comment reply', 'DM: Global General Price', NULL, 'all', 1, datetime('now'), datetime('now'))
  `).run(globalRuleId, testAccId);

  // Rule C: Story Reply rule on "HI"
  await db.prepare(`
    INSERT INTO automation_rules (
      id, instagram_account_id, type, trigger_keyword, match_mode,
      reply_message, dm_reply_message, target_media_type, is_active, created_at, updated_at
    ) VALUES (?, ?, 'story_reply', 'HI', 'contains', 'Thanks for replying to our story! 🌟', 'Thanks for replying to our story! 🌟', 'story', 1, datetime('now'), datetime('now'))
  `).run(storyRuleId, testAccId);

  console.log('✅ Test 4 Passed: Rules created with specific target_media_id and story_reply type.');

  // 5. Test Specific Reel Comment Execution
  console.log('Test 5: Testing comment on targeted Reel (priority check)...');
  const commentId1 = `c_sim_${Date.now()}_1`;
  await queue.processComment(testAccId, {
    commentId: commentId1,
    text: 'What is the price?',
    commenterId: 'uid_commenter_1',
    commenterUsername: 'alex_buyer',
    createdTime: Date.now(),
    mediaId: reelId
  });

  const replyRecord1 = await db.prepare('SELECT * FROM comment_replies WHERE comment_id = ?').get(commentId1);
  assert(replyRecord1, 'Reply record should be saved');
  assert.strictEqual(replyRecord1.automation_rule_id, specificRuleId, 'Specific reel rule should take precedence over global rule');
  console.log('✅ Test 5 Passed: Specific Reel rule prioritized correctly over global rule.');

  // 6. Test Global Rule Fallback on other media
  console.log('Test 6: Testing comment on untargeted media (global fallback check)...');
  const commentId2 = `c_sim_${Date.now()}_2`;
  await queue.processComment(testAccId, {
    commentId: commentId2,
    text: 'What is the price?',
    commenterId: 'uid_commenter_2',
    commenterUsername: 'sara_buyer',
    createdTime: Date.now(),
    mediaId: otherReelId
  });

  const replyRecord2 = await db.prepare('SELECT * FROM comment_replies WHERE comment_id = ?').get(commentId2);
  assert(replyRecord2, 'Reply record 2 should be saved');
  assert.strictEqual(replyRecord2.automation_rule_id, globalRuleId, 'Global rule should be used when no specific rule matches');
  console.log('✅ Test 6 Passed: Global rule triggered as fallback on untargeted media.');

  // 7. Test Story Reply Execution
  console.log('Test 7: Testing Story Reply detection and execution...');
  await queue.processMessage(testAccId, {
    messageId: `mid_story_${Date.now()}`,
    senderId: 'uid_story_replier',
    senderUsername: 'story_fan',
    text: 'Hi, loved this!',
    timestamp: Date.now(),
    isStoryReply: true
  });

  // Verify conversation and message logged
  const conv = await db.prepare('SELECT * FROM conversations WHERE instagram_account_id = ? AND ig_scoped_user_id = ?').get(testAccId, 'uid_story_replier');
  assert(conv, 'Conversation should be created for story replier');
  const msgs = await db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conv.id);
  assert(msgs.length >= 2, 'Should have inbound story reply and outbound automated DM');
  const outbound = msgs.find(m => m.direction === 'outbound');
  assert(outbound, 'Outbound message should exist');
  assert(outbound.content.includes('Thanks for replying to our story!'), 'Outbound should contain story reply message');
  console.log('✅ Test 7 Passed: Story reply rule matched and executed successfully!');

  // Cleanup test data
  await db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);

  console.log('\n🎉 ALL 7 TESTS PASSED PERFECTLY!\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
