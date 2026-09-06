// backend/src/db/migrateToPg.js
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  require('dotenv').config();
} catch (e) {}

const { Client } = require('pg');
const { CREATE_TABLES_PG_SQL } = require('./schema');
const db = require('./index');

const TARGET_URL = process.argv[2] || process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://instautoreply_user:ngJK4XtKJSEYDlnXZpevibT2TawWEJWH@dpg-dadvcvf40ujc73d522i0-a.oregon-postgres.render.com/instautoreply';

async function migrate() {
  const isNeon = TARGET_URL.includes('neon.tech');
  console.log(`[Migration] Connecting to target PostgreSQL (${isNeon ? 'Neon Serverless' : 'PostgreSQL'})...`);
  const client = new Client({
    connectionString: TARGET_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('[Migration] ✅ Target PostgreSQL Connected!');

  console.log('[Migration] Initializing schema and indexes...');
  await client.query(CREATE_TABLES_PG_SQL);
  console.log('[Migration] ✅ Schema initialized successfully!');

  // Migrate users
  const users = await db.prepare('SELECT * FROM users').all();
  for (const u of users) {
    await client.query(
      `INSERT INTO users (id, email, name, avatar_url, password_hash, plan, dm_usage_this_period, usage_period_start, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         name = EXCLUDED.name,
         avatar_url = EXCLUDED.avatar_url,
         password_hash = EXCLUDED.password_hash,
         plan = EXCLUDED.plan,
         updated_at = EXCLUDED.updated_at`,
      [u.id, u.email, u.name, u.avatar_url, u.password_hash, u.plan, u.dm_usage_this_period, u.usage_period_start, u.created_at, u.updated_at]
    );
  }
  console.log(`[Migration] ✅ Migrated ${users.length} users.`);

  // Migrate accounts
  const accounts = await db.prepare('SELECT * FROM instagram_accounts').all();
  for (const a of accounts) {
    await client.query(
      `INSERT INTO instagram_accounts (id, user_id, ig_user_id, username, account_type, page_id, fb_page_name, fb_user_id, access_token_enc, page_access_token_enc, long_lived_token_enc, token_expires_at, status, disclosure_message, followers_count, full_name, profile_picture_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       ON CONFLICT (id) DO UPDATE SET
         username = EXCLUDED.username,
         followers_count = EXCLUDED.followers_count,
         full_name = EXCLUDED.full_name,
         profile_picture_url = EXCLUDED.profile_picture_url,
         access_token_enc = EXCLUDED.access_token_enc,
         page_access_token_enc = EXCLUDED.page_access_token_enc,
         long_lived_token_enc = EXCLUDED.long_lived_token_enc,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [a.id, a.user_id, a.ig_user_id, a.username, a.account_type, a.page_id, a.fb_page_name, a.fb_user_id, a.access_token_enc, a.page_access_token_enc, a.long_lived_token_enc, a.token_expires_at, a.status, a.disclosure_message, a.followers_count || 0, a.full_name || null, a.profile_picture_url || null, a.created_at, a.updated_at]
    );
  }
  console.log(`[Migration] ✅ Migrated ${accounts.length} accounts.`);

  // Migrate rules
  const rules = await db.prepare('SELECT * FROM automation_rules').all();
  for (const r of rules) {
    await client.query(
      `INSERT INTO automation_rules (id, instagram_account_id, type, trigger_keyword, match_mode, reply_message, is_active, fire_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         reply_message = EXCLUDED.reply_message,
         is_active = EXCLUDED.is_active,
         fire_count = EXCLUDED.fire_count,
         updated_at = EXCLUDED.updated_at`,
      [r.id, r.instagram_account_id, r.type, r.trigger_keyword, r.match_mode, r.reply_message, r.is_active, r.fire_count, r.created_at, r.updated_at]
    );
  }
  console.log(`[Migration] ✅ Migrated ${rules.length} rules.`);

  // Migrate conversations
  const convos = await db.prepare('SELECT * FROM conversations').all();
  for (const c of convos) {
    await client.query(
      `INSERT INTO conversations (id, instagram_account_id, ig_scoped_user_id, username, name, profile_pic_url, avatar_seed, last_message, last_message_direction, status, last_user_message_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO NOTHING`,
      [c.id, c.instagram_account_id, c.ig_scoped_user_id, c.username, c.name || null, c.profile_pic_url || null, c.avatar_seed, c.last_message, c.last_message_direction, c.status, c.last_user_message_at, c.created_at, c.updated_at]
    );
  }
  console.log(`[Migration] ✅ Migrated ${convos.length} conversations.`);

  // Migrate messages
  const msgs = await db.prepare('SELECT * FROM messages').all();
  for (const m of msgs) {
    await client.query(
      `INSERT INTO messages (id, conversation_id, direction, content, status, meta_message_id, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [m.id, m.conversation_id, m.direction, m.content, m.status, m.meta_message_id, m.error_message, m.created_at]
    );
  }
  console.log(`[Migration] ✅ Migrated ${msgs.length} messages.`);

  console.log('All tables and records successfully seeded in PostgreSQL!');
  await client.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
