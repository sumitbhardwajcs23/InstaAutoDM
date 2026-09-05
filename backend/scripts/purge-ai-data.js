// backend/scripts/purge-ai-data.js
const db = require('../src/db');

console.log('[Cleanup] Starting purge of all unwanted AI-generated and mock data...');

// 1. Delete all fake conversations created by mock/seed/test scripts
const fakeUsernames = ['inbound_lead', 'alex_lead', 'testuser', 'tester_alex', 'sophia.designs', 'alex_runner', 'luna.creates'];
const delMessages = db.prepare(`
  DELETE FROM messages 
  WHERE conversation_id IN (
    SELECT id FROM conversations WHERE username IN (${fakeUsernames.map(() => '?').join(',')})
  )
`).run(...fakeUsernames);
console.log(`[Cleanup] Deleted ${delMessages.changes} fake messages.`);

const delConversations = db.prepare(`
  DELETE FROM conversations WHERE username IN (${fakeUsernames.map(() => '?').join(',')})
`).run(...fakeUsernames);
console.log(`[Cleanup] Deleted ${delConversations.changes} fake conversations.`);

// 2. Delete AI-seeded test rules (GUIDE, PRICING, HELLO, random_text) so users start with only their own rules
const testKeywords = ['GUIDE', 'PRICING', 'HELLO', 'random_text', 'PRICE', 'LINK'];
const delRules = db.prepare(`
  DELETE FROM automation_rules WHERE trigger_keyword IN (${testKeywords.map(() => '?').join(',')})
`).run(...testKeywords);
console.log(`[Cleanup] Deleted ${delRules.changes} AI-seeded rules.`);

// 3. Clear fake activity_log records
const delActivity = db.prepare("DELETE FROM activity_log WHERE dms_sent > 50 OR comments_replied > 50").run();
console.log(`[Cleanup] Deleted ${delActivity.changes} fake activity log entries.`);

// 4. Reset comment_replies with test IDs
const delReplies = db.prepare("DELETE FROM comment_replies WHERE comment_id LIKE 'test_%' OR comment_id LIKE 'mock_%'").run();
console.log(`[Cleanup] Deleted ${delReplies.changes} fake comment replies.`);

// 5. Clean test users (keep sumitbhardwaj2227@gmail.com and admin accounts)
const delTestUsers = db.prepare("DELETE FROM users WHERE email = 'creator@instagram-growth.io'").run();
console.log(`[Cleanup] Deleted ${delTestUsers.changes} placeholder test users.`);

if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  pool.query(`
    DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE username = ANY($1));
    DELETE FROM conversations WHERE username = ANY($1);
    DELETE FROM automation_rules WHERE trigger_keyword = ANY($2);
    DELETE FROM users WHERE email = 'creator@instagram-growth.io' OR email LIKE '%@instareply.io';
  `, [fakeUsernames, testKeywords]).then(() => {
    console.log('[Cleanup] ✅ PostgreSQL is also 100% clean!');
    pool.end();
  }).catch(e => {
    console.error('[Cleanup PG]', e.message);
    pool.end();
  });
}
