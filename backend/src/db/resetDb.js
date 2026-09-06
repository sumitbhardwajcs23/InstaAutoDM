// backend/src/db/resetDb.js
const path = require('path');
const fs = require('fs');

try {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  require('dotenv').config();
} catch (e) {}

const { Client } = require('pg');
const Database = require('better-sqlite3');
const { CREATE_TABLES_PG_SQL, CREATE_TABLES_SQL } = require('./schema');

const TARGET_URL = process.argv[2] || process.env.DATABASE_URL;

async function resetPostgres(pgUrl) {
  const isNeon = pgUrl.includes('neon.tech');
  console.log(`[Reset DB] Connecting to PostgreSQL (${isNeon ? 'Neon Serverless' : 'Remote'})...`);

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

function resetSqlite() {
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../../data/instautoreply.db');
  console.log('[Reset DB] Resetting local SQLite database:', DB_PATH);
  
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('[Reset DB] 🗑️  Deleted existing sqlite file.');
  }

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(CREATE_TABLES_SQL);
  db.close();
  console.log('[Reset DB] ✅ Fresh SQLite database initialized.');
}

async function main() {
  console.log('========================================');
  console.log('⚡ DATABASE RESET - START FRESH');
  console.log('========================================');

  if (TARGET_URL) {
    await resetPostgres(TARGET_URL);
  } else {
    console.log('[Reset DB] No DATABASE_URL specified in environment. Resetting local SQLite...');
    resetSqlite();
  }

  console.log('========================================');
  console.log('🎉 Database is completely fresh and clean!');
  console.log('========================================');
}

main().catch((err) => {
  console.error('[Reset DB] ❌ Failed to reset database:', err.message);
  process.exit(1);
});
