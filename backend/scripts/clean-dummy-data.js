// backend/scripts/clean-dummy-data.js
const db = require('../src/db');

console.log('[Clean] Starting dummy data purge...');

// 1. Reassign agility_test to Sumit Bhardwaj
const sumit = db.prepare('SELECT id FROM users WHERE email = ?').get('sumitbhardwaj2227@gmail.com');
if (sumit) {
  db.prepare('UPDATE instagram_accounts SET user_id = ? WHERE username = ?').run(sumit.id, 'agility_test');
  console.log('[Clean] ✅ agility_test account linked to Sumit Bhardwaj (' + sumit.id + ')');
} else {
  console.warn('[Clean] ⚠️ User sumitbhardwaj2227@gmail.com not found');
}

// 2. Remove dummy users
const delUsers = db.prepare("DELETE FROM users WHERE email = 'devid@instareply.io' OR email LIKE '%@test.com' OR email LIKE '%@example.com'").run();
console.log('[Clean] Removed dummy users, changes:', delUsers.changes);

// 3. Remove dummy accounts
const delAccounts = db.prepare("DELETE FROM instagram_accounts WHERE username = 'luna.creates' OR username LIKE 'alice_%' OR username LIKE 'bob_%'").run();
console.log('[Clean] Removed dummy accounts, changes:', delAccounts.changes);

// 4. Remove any orphaned rules or convos from dummy accounts
const accounts = db.prepare("SELECT id FROM instagram_accounts").all().map(a => a.id);
if (accounts.length > 0) {
  const placeholders = accounts.map(() => '?').join(',');
  const delRules = db.prepare(`DELETE FROM automation_rules WHERE instagram_account_id NOT IN (${placeholders})`).run(...accounts);
  console.log('[Clean] Purged orphaned rules:', delRules.changes);
  const delConvos = db.prepare(`DELETE FROM conversations WHERE instagram_account_id NOT IN (${placeholders})`).run(...accounts);
  console.log('[Clean] Purged orphaned conversations:', delConvos.changes);
  const delComments = db.prepare(`DELETE FROM comment_replies WHERE instagram_account_id NOT IN (${placeholders}) OR comment_id LIKE 'seed_comment_%'`).run(...accounts);
  console.log('[Clean] Purged dummy comment replies:', delComments.changes);
}

// 5. Verify current state
console.log('[Clean] Active Users:', db.prepare('SELECT id, email, name FROM users').all());
console.log('[Clean] Active Accounts:', db.prepare('SELECT id, username, user_id, status FROM instagram_accounts').all());
console.log('[Clean] Active Rules count:', db.prepare('SELECT COUNT(*) as c FROM automation_rules').get().c);
console.log('[Clean] Active Conversations count:', db.prepare('SELECT COUNT(*) as c FROM conversations').get().c);
console.log('[Clean] ✅ Purge complete!');
