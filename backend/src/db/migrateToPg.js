// backend/src/db/migrateToPg.js
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  require('dotenv').config();
} catch (e) {}

const { Client } = require('pg');
const { CREATE_TABLES_PG_SQL } = require('./schema');

const TARGET_URL = process.argv[2] || process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

async function migrate() {
  if (!TARGET_URL) {
    throw new Error('DATABASE_URL is not set in environment or arguments.');
  }

  const isNeon = TARGET_URL.includes('neon.tech');
  console.log(`[Migration] Connecting to PostgreSQL (${isNeon ? 'Neon Serverless' : 'PostgreSQL'})...`);
  const client = new Client({
    connectionString: TARGET_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('[Migration] ✅ PostgreSQL Connected!');

  console.log('[Migration] Ensuring latest schema and indexes...');
  await client.query(CREATE_TABLES_PG_SQL);
  console.log('[Migration] ✅ Schema and tables verified successfully!');

  // Run column migrations
  await client.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name TEXT;');
  await client.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;');
  await client.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS page_access_token_enc TEXT;');
  await client.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS long_lived_token_enc TEXT;');
  await client.query("ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS disclosure_message TEXT DEFAULT '⚡ [Automated Response] ';");
  await client.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS fb_page_name TEXT;');
  await client.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS fb_user_id TEXT;');
  await client.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS account_type TEXT;');
  await client.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS full_name TEXT;');
  await client.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;');
  await client.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;');
  console.log('[Migration] ✅ Column migrations verified successfully!');

  await client.end();
  console.log('[Migration] Complete!');
}

migrate().catch((err) => {
  console.error('[Migration] Migration failed:', err.message);
  process.exit(1);
});

