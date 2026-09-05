// backend/src/db/index.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { CREATE_TABLES_SQL } = require('./schema');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../../data/instautoreply.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(CREATE_TABLES_SQL);

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return;

  const userId = uuidv4();
  const accountId = uuidv4();
  const now = new Date().toISOString();
  const periodStart = now.slice(0, 10);

  db.prepare(`
    INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, 'devid@instareply.io', 'Devid Sharma', 'free', 620, periodStart, now, now);

  db.prepare(`
    INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, account_type, page_id, access_token_enc, token_expires_at, status, disclosure_message, followers_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(accountId, userId, '17841405829103942', 'luna.creates', 'Business Account',
    '109283746501928', 'mock_encrypted_token_demo',
    new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
    'connected', '⚡ [Automated Response] ', 24800, now, now);

  // Seed automation rules
  const rules = [
    { type: 'comment_to_dm', keyword: 'GUIDE', mode: 'contains', reply: "Here is your free guide: https://example.com/guide", count: 148 },
    { type: 'dm_keyword_reply', keyword: 'PRICING', mode: 'exact', reply: 'Our pricing starts at $29/mo with unlimited auto-replies.', count: 320 },
    { type: 'comment_to_dm', keyword: 'VIP', mode: 'contains', reply: 'Welcome to VIP! Here is your exclusive access token.', count: 86 },
    { type: 'comment_to_dm', keyword: 'LINK', mode: 'contains', reply: 'Check your DM! Here is the link: https://example.com/start', count: 252 },
  ];
  for (const r of rules) {
    db.prepare(`
      INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, match_mode, reply_message, is_active, fire_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(uuidv4(), accountId, r.type, r.keyword, r.mode, r.reply, r.count, now, now);
  }

  // Seed recent conversations
  const convUsers = [
    { username: 'priya.singh', msg: 'Comment: "price?"', status: 'replied', hrsAgo: 2 },
    { username: '_akshay.verma', msg: 'DM: "details"', status: 'replied', hrsAgo: 5 },
    { username: 'neha.official', msg: 'DM: "link"', status: 'replied', hrsAgo: 12 },
    { username: 'rohan.kapoor', msg: 'DM: "brochure"', status: 'replied', hrsAgo: 18 },
    { username: 'sneha.artist', msg: 'Comment: "wow"', status: 'skipped', hrsAgo: 25 },
  ];
  for (const u of convUsers) {
    const convId = uuidv4();
    const convTime = new Date(Date.now() - u.hrsAgo * 3600000).toISOString();
    db.prepare(`
      INSERT INTO conversations (id, instagram_account_id, ig_scoped_user_id, username, avatar_seed, last_message, last_message_direction, status, last_user_message_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'inbound', ?, ?, ?, ?)
    `).run(convId, accountId, uuidv4(), u.username, u.username, u.msg, u.status, convTime, convTime, convTime);
  }

  // Seed comment_replies for stats
  const commentStatuses = ['sent', 'sent', 'sent', 'skipped_duplicate', 'window_closed'];
  for (let i = 0; i < 48; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const ts = new Date(Date.now() - daysAgo * 86400000).toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO comment_replies (id, comment_id, instagram_account_id, commenter_username, comment_text, reply_sent, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), `seed_comment_${i}`, accountId, `user_${i}`, 'price', 'Reply sent', commentStatuses[i % commentStatuses.length], ts);
  }

  // Seed 30-day activity log
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toISOString().slice(0, 10);
    const dms = Math.floor(Math.random() * 35) + 5;
    const comments = Math.floor(Math.random() * 20) + 2;
    db.prepare(`
      INSERT OR IGNORE INTO activity_log (id, instagram_account_id, event_date, dms_sent, comments_replied)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), accountId, dateStr, dms, comments);
  }

  console.log('[DB] ✅ Seeded demo data successfully.');
}

seedInitialData();

// Ensure standard rules exist on existing database
const account = db.prepare("SELECT id FROM instagram_accounts WHERE status = 'connected' LIMIT 1").get();
if (account) {
  const guideRule = db.prepare("SELECT id FROM automation_rules WHERE instagram_account_id = ? AND trigger_keyword = 'GUIDE'").get(account.id);
  if (!guideRule) {
    db.prepare(`
      INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, match_mode, reply_message, is_active, fire_count)
      VALUES (?, ?, 'comment_to_dm', 'GUIDE', 'contains', 'Here is your free guide: https://example.com/guide', 1, 148)
    `).run(uuidv4(), account.id);
  }
  const pricingRule = db.prepare("SELECT id FROM automation_rules WHERE instagram_account_id = ? AND trigger_keyword = 'PRICING'").get(account.id);
  if (!pricingRule) {
    db.prepare(`
      INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, match_mode, reply_message, is_active, fire_count)
      VALUES (?, ?, 'dm_keyword_reply', 'PRICING', 'exact', 'Our pricing starts at $29/mo with unlimited auto-replies.', 1, 320)
    `).run(uuidv4(), account.id);
  }
}

module.exports = db;
