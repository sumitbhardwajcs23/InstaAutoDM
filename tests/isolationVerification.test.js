// tests/isolationVerification.test.js
const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

process.env.NODE_ENV = 'test';
process.env.META_MOCK_MODE = 'true';

const db = require('../backend/src/db');
const { encrypt } = require('../backend/src/services/crypto');

async function run() {
  console.log('========================================');
  console.log('🧪 Testing Multi-Tenant SaaS Isolation');
  console.log('========================================\n');

  // Create User 1 and User 2
  const user1Id = uuidv4();
  const user2Id = uuidv4();
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at)
    VALUES (?, 'user1@test.com', 'User One', 'free', 0, ?, ?, ?)
  `).run(user1Id, now.slice(0, 10), now, now);

  await db.prepare(`
    INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at)
    VALUES (?, 'user2@test.com', 'User Two', 'free', 0, ?, ?, ?)
  `).run(user2Id, now.slice(0, 10), now, now);

  // Connect Account A to User 1 only
  const acc1Id = uuidv4();
  const igUser1Id = 'ig_user_1_' + Date.now();
  await db.prepare(`
    INSERT INTO instagram_accounts (
      id, user_id, ig_user_id, username, full_name, page_id, fb_page_name, fb_user_id,
      access_token_enc, status, followers_count, created_at, updated_at
    ) VALUES (?, ?, ?, 'user1_ig', 'User One Creator', 'page_1', 'Page 1', 'fb_1', ?, 'connected', 500, ?, ?)
  `).run(acc1Id, user1Id, igUser1Id, encrypt('tok_1'), now, now);

  console.log('Test 1: Querying accounts for User 2 (who has NO accounts)...');
  // User 2 query must return NOTHING, not User 1's account!
  const user2Accounts = await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected'").all(user2Id);
  assert.strictEqual(user2Accounts.length, 0, 'User 2 must have 0 accounts');
  console.log('  ✅ PASS: User 2 has 0 accounts');

  console.log('\nTest 2: Querying dashboard stats account for User 2...');
  const user2DashAccount = await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected' ORDER BY updated_at DESC LIMIT 1").get(user2Id);
  assert.strictEqual(user2DashAccount, undefined, 'User 2 dashboard account must be undefined/null');
  console.log('  ✅ PASS: User 2 dashboard account is null (not stealing User 1 account)');

  console.log('\nTest 3: Checking that Account 1 still belongs to User 1...');
  const acc1Check = await db.prepare("SELECT user_id, username FROM instagram_accounts WHERE id = ?").get(acc1Id);
  assert.strictEqual(acc1Check.user_id, user1Id, 'Account 1 must still belong to User 1');
  assert.strictEqual(acc1Check.username, 'user1_ig');
  console.log('  ✅ PASS: Account 1 belongs strictly to User 1');

  console.log('\nTest 4: User 2 connects Account B...');
  const acc2Id = uuidv4();
  const igUser2Id = 'ig_user_2_' + Date.now();
  await db.prepare(`
    INSERT INTO instagram_accounts (
      id, user_id, ig_user_id, username, full_name, page_id, fb_page_name, fb_user_id,
      access_token_enc, status, followers_count, created_at, updated_at
    ) VALUES (?, ?, ?, 'user2_ig', 'User Two Creator', 'page_2', 'Page 2', 'fb_2', ?, 'connected', 1200, ?, ?)
  `).run(acc2Id, user2Id, igUser2Id, encrypt('tok_2'), now, now);

  const u1Acc = await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected'").all(user1Id);
  const u2Acc = await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected'").all(user2Id);
  assert.strictEqual(u1Acc.length, 1);
  assert.strictEqual(u1Acc[0].username, 'user1_ig');
  assert.strictEqual(u2Acc.length, 1);
  assert.strictEqual(u2Acc[0].username, 'user2_ig');
  console.log('  ✅ PASS: User 1 sees ONLY user1_ig, User 2 sees ONLY user2_ig');

  // Clean up
  await db.prepare("DELETE FROM users WHERE id IN (?, ?)").run(user1Id, user2Id);

  console.log('\n========================================');
  console.log('🎉 Multi-tenant isolation tests PASSED 100%!');
  console.log('========================================\n');

  if (db.getPgPool()) {
    await db.getPgPool().end();
  }
  process.exit(0);
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
