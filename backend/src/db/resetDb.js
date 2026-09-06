// backend/src/db/resetDb.js
const path = require('path');
const fs = require('fs');

try {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  require('dotenv').config();
} catch (e) {}

const { Client } = require('pg');
const { CREATE_TABLES_PG_SQL } = require('./schema');

const TARGET_URL = process.argv[2] || process.env.DATABASE_URL;

async function resetPostgres(pgUrl) {
  const isNeon = pgUrl.includes('neon.tech');
  console.log(`[Reset DB] Connecting to PostgreSQL (${isNeon ? 'Neon Serverless' : 'PostgreSQL'})...`);

  const client = new Client({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('[Reset DB] ✅ Connected to PostgreSQL.');

  console.log('[Reset DB] 🗑️  Dropping all existing tables...');
  const dropTablesSql = `
    DROP TABLE IF EXISTS activity_log CASCADE;
    DROP TABLE IF EXISTS webhook_events CASCADE;
    DROP TABLE IF EXISTS messages CASCADE;
    DROP TABLE IF EXISTS comment_replies CASCADE;
    DROP TABLE IF EXISTS conversations CASCADE;
    DROP TABLE IF EXISTS automation_rules CASCADE;
    DROP TABLE IF EXISTS instagram_accounts CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `;
  await client.query(dropTablesSql);
  console.log('[Reset DB] ✅ All existing tables deleted.');

  console.log('[Reset DB] 🚀 Creating fresh tables and indexes...');
  await client.query(CREATE_TABLES_PG_SQL);
  console.log('[Reset DB] ✅ Fresh tables and indexes initialized successfully!');

  // Check table count
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log('[Reset DB] Tables created:', res.rows.map(r => r.table_name).join(', '));

  await client.end();
}

async function main() {
  console.log('========================================');
  console.log('⚡ DATABASE RESET - START FRESH (PostgreSQL)');
  console.log('========================================');

  if (!TARGET_URL) {
    throw new Error('DATABASE_URL is not set in environment or arguments. Cannot reset database.');
  }

  await resetPostgres(TARGET_URL);

  console.log('========================================');
  console.log('🎉 PostgreSQL Database is completely fresh and clean!');
  console.log('========================================');
}

main().catch((err) => {
  console.error('[Reset DB] ❌ Failed to reset database:', err.message);
  process.exit(1);
});
