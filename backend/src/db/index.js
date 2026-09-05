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

// Safe migrations for conversations enrichment columns
try { db.exec('ALTER TABLE conversations ADD COLUMN name TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE conversations ADD COLUMN profile_pic_url TEXT;'); } catch (e) {}

// Safe migrations for instagram_accounts profile details
try { db.exec('ALTER TABLE instagram_accounts ADD COLUMN page_access_token_enc TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE instagram_accounts ADD COLUMN long_lived_token_enc TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE instagram_accounts ADD COLUMN disclosure_message TEXT DEFAULT \'⚡ [Automated Response] \';'); } catch (e) {}
try { db.exec('ALTER TABLE instagram_accounts ADD COLUMN fb_page_name TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE instagram_accounts ADD COLUMN fb_user_id TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE instagram_accounts ADD COLUMN account_type TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE instagram_accounts ADD COLUMN full_name TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE instagram_accounts ADD COLUMN profile_picture_url TEXT;'); } catch (e) {}
try { db.exec('ALTER TABLE instagram_accounts ADD COLUMN followers_count INTEGER DEFAULT 0;'); } catch (e) {}

// ── PostgreSQL Replication Layer ───────────────────────────────────────
const PG_URL = process.env.DATABASE_URL || 'postgresql://instautoreply_user:ngJK4XtKJSEYDlnXZpevibT2TawWEJWH@dpg-dadvcvf40ujc73d522i0-a.oregon-postgres.render.com/instautoreply';
let pgPool = null;
let isSeeding = false;
let isSyncingFromPg = false;

function syncWriteToPg(pool, sql, params) {
  if (isSeeding || isSyncingFromPg || !pool) return;
  try {
    let i = 1;
    let pgSql = sql.replace(/\?/g, () => `$${i++}`);
    pgSql = pgSql.replace(/datetime\('now'\)/gi, 'NOW()');
    if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(pgSql)) {
      pgSql = pgSql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO') + ' ON CONFLICT DO NOTHING';
    }

    pool.query(pgSql, params).catch((e) => {
      // Ignore duplicate key conflicts cleanly
      if (e.code !== '23505') {
        console.error('[PG Write Sync Error]', e.message);
      }
    });
  } catch (err) {
    console.error('[PG Write Sync Error]', err.message);
  }
}

async function syncFromPg(pool, sqliteDb) {
  if (isSyncingFromPg || !pool) return;
  isSyncingFromPg = true;
  try {
    const tables = ['users', 'instagram_accounts', 'automation_rules', 'conversations', 'messages', 'comment_replies', 'activity_log'];
    for (const table of tables) {
      try {
        const res = await pool.query(`SELECT * FROM ${table}`);
        if (res.rows && res.rows.length > 0) {
          // If table has primary key id, purge records that no longer exist in PG
          try {
            const pgIds = res.rows.map(r => r.id).filter(Boolean);
            if (pgIds.length > 0) {
              originalPrepare(`DELETE FROM ${table} WHERE id NOT IN (${pgIds.map(() => '?').join(',')})`).run(...pgIds);
            }
          } catch (delErr) {}

          for (const row of res.rows) {
            const keys = Object.keys(row);
            const placeholders = keys.map(() => '?').join(', ');
            const values = keys.map((k) => {
              const val = row[k];
              if (val instanceof Date) return val.toISOString();
              return val;
            });
            try {
              originalPrepare(`INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
            } catch (insErr) {}
          }
        }
      } catch (tableErr) {
        // Table might not exist yet
      }
    }
    console.log('[PostgreSQL] ✅ Synchronized latest tables from Render PostgreSQL to runtime engine.');
  } catch (err) {
    console.error('[PostgreSQL Sync Warning]', err.message);
  } finally {
    isSyncingFromPg = false;
  }
}

if (PG_URL) {
  try {
    const { Pool } = require('pg');
    const isRenderInternal = PG_URL.includes('dpg-') && !PG_URL.includes('.render.com');
    pgPool = new Pool({
      connectionString: PG_URL,
      ssl: isRenderInternal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });

    pgPool.query('SELECT NOW()')
      .then(async () => {
        console.log('[PostgreSQL] ✅ Connected to Render PostgreSQL');
        try {
          await pgPool.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name TEXT;');
          await pgPool.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS page_access_token_enc TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS long_lived_token_enc TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS disclosure_message TEXT DEFAULT \'⚡ [Automated Response] \';');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS fb_page_name TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS fb_user_id TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS account_type TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS full_name TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;');
        } catch (migErr) {
          console.warn('[PostgreSQL] Column migration notice:', migErr.message);
        }
        await syncFromPg(pgPool, db);

        // Auto-sync every 15 seconds to keep Render runtime fresh
        setInterval(() => {
          syncFromPg(pgPool, db).catch(() => {});
        }, 15000);
      })
      .catch((err) => {
        console.warn('[PostgreSQL] Connection fallback to local store:', err.message);
        pgPool = null;
      });
  } catch (err) {
    console.warn('[PostgreSQL] Pool initialization failed:', err.message);
    pgPool = null;
  }
}

// Wrap db.prepare to intercept write operations and mirror them to PostgreSQL
const originalPrepare = db.prepare.bind(db);
db.prepare = function (sql) {
  const stmt = originalPrepare(sql);
  const originalRun = stmt.run.bind(stmt);
  stmt.run = function (...params) {
    const res = originalRun(...params);
    if (pgPool) {
      syncWriteToPg(pgPool, sql, params);
    }
    return res;
  };
  return stmt;
};

// Provide explicit sync method for routes
db.syncFromPgNow = async function () {
  if (pgPool) {
    await syncFromPg(pgPool, db);
  }
};

// Real data only — no dummy or mock accounts seeded
console.log('[DB] ✅ Database initialized for production / live data.');

module.exports = db;
