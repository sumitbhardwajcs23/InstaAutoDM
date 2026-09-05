// backend/src/db/migrateToPg.js
const { Client } = require('pg');
const db = require('./index');

const PG_URL = process.env.DATABASE_URL || 'postgresql://instautoreply_user:ngJK4XtKJSEYDlnXZpevibT2TawWEJWH@dpg-dadvcvf40ujc73d522i0-a.oregon-postgres.render.com/instautoreply';

async function migrate() {
  const client = new Client({
    connectionString: PG_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log('Connecting to PostgreSQL...');
  await client.connect();
  console.log('Connected!');

  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT 'Creator',
      avatar_url TEXT,
      password_hash TEXT,
      plan TEXT DEFAULT 'free',
      dm_usage_this_period INTEGER DEFAULT 0,
      usage_period_start TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS instagram_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ig_user_id TEXT UNIQUE NOT NULL,
      username TEXT,
      account_type TEXT DEFAULT 'Business Account',
      page_id TEXT NOT NULL,
      fb_page_name TEXT,
      fb_user_id TEXT,
      access_token_enc TEXT NOT NULL,
      page_access_token_enc TEXT,
      long_lived_token_enc TEXT,
      token_expires_at TEXT,
      status TEXT DEFAULT 'connected',
      disclosure_message TEXT DEFAULT '⚡ [Automated Response] ',
      followers_count INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS automation_rules (
      id TEXT PRIMARY KEY,
      instagram_account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      trigger_keyword TEXT NOT NULL,
      match_mode TEXT DEFAULT 'exact',
      reply_message TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      fire_count INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS comment_replies (
      id TEXT PRIMARY KEY,
      comment_id TEXT UNIQUE NOT NULL,
      automation_rule_id TEXT REFERENCES automation_rules(id) ON DELETE SET NULL,
      instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE CASCADE,
      commenter_username TEXT,
      comment_text TEXT,
      reply_sent TEXT,
      status TEXT NOT NULL,
      meta_message_id TEXT,
      error_message TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      instagram_account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
      ig_scoped_user_id TEXT NOT NULL,
      username TEXT,
      avatar_seed TEXT,
      last_message TEXT,
      last_message_direction TEXT DEFAULT 'inbound',
      status TEXT DEFAULT 'open',
      last_user_message_at TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(instagram_account_id, ig_scoped_user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      direction TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      meta_message_id TEXT,
      error_message TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      processed_at TEXT,
      status TEXT DEFAULT 'pending',
      error TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      instagram_account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
      event_date TEXT NOT NULL,
      dms_sent INTEGER DEFAULT 0,
      comments_replied INTEGER DEFAULT 0,
      created_at TEXT,
      UNIQUE(instagram_account_id, event_date)
    );
  `;

  await client.query(schema);
  console.log('PostgreSQL schema initialized successfully!');

  // Migrate users
  const users = db.prepare('SELECT * FROM users').all();
  for (const u of users) {
    await client.query(
      `INSERT INTO users (id, email, name, avatar_url, password_hash, plan, dm_usage_this_period, usage_period_start, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [u.id, u.email, u.name, u.avatar_url, u.password_hash, u.plan, u.dm_usage_this_period, u.usage_period_start, u.created_at, u.updated_at]
    );
  }
  console.log(`Migrated ${users.length} users.`);

  // Migrate accounts
  const accounts = db.prepare('SELECT * FROM instagram_accounts').all();
  for (const a of accounts) {
    await client.query(
      `INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, account_type, page_id, fb_page_name, fb_user_id, access_token_enc, page_access_token_enc, long_lived_token_enc, token_expires_at, status, disclosure_message, followers_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (id) DO NOTHING`,
      [a.id, a.user_id, a.ig_user_id, a.username, a.account_type, a.page_id, a.fb_page_name, a.fb_user_id, a.access_token_enc, a.page_access_token_enc, a.long_lived_token_enc, a.token_expires_at, a.status, a.disclosure_message, a.followers_count, a.created_at, a.updated_at]
    );
  }
  console.log(`Migrated ${accounts.length} accounts.`);

  // Migrate rules
  const rules = db.prepare('SELECT * FROM automation_rules').all();
  for (const r of rules) {
    await client.query(
      `INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, match_mode, reply_message, is_active, fire_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [r.id, r.instagram_account_id, r.type, r.trigger_keyword, r.match_mode, r.reply_message, r.is_active, r.fire_count, r.created_at, r.updated_at]
    );
  }
  console.log(`Migrated ${rules.length} rules.`);

  // Migrate conversations
  const convos = db.prepare('SELECT * FROM conversations').all();
  for (const c of convos) {
    await client.query(
      `INSERT INTO conversations (id, instagram_account_id, ig_scoped_user_id, username, avatar_seed, last_message, last_message_direction, status, last_user_message_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [c.id, c.instagram_account_id, c.ig_scoped_user_id, c.username, c.avatar_seed, c.last_message, c.last_message_direction, c.status, c.last_user_message_at, c.created_at, c.updated_at]
    );
  }
  console.log(`Migrated ${convos.length} conversations.`);

  // Migrate messages
  const msgs = db.prepare('SELECT * FROM messages').all();
  for (const m of msgs) {
    await client.query(
      `INSERT INTO messages (id, conversation_id, direction, content, status, meta_message_id, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [m.id, m.conversation_id, m.direction, m.content, m.status, m.meta_message_id, m.error_message, m.created_at]
    );
  }
  console.log(`Migrated ${msgs.length} messages.`);

  console.log('All tables and records successfully seeded in PostgreSQL!');
  await client.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
