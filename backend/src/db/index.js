// backend/src/db/index.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { CREATE_TABLES_SQL } = require('./schema');

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.DB_PATH === ':memory:';
const PG_URL = isTestEnv ? null : (process.env.DATABASE_URL || 'postgresql://instautoreply_user:ngJK4XtKJSEYDlnXZpevibT2TawWEJWH@dpg-dadvcvf40ujc73d522i0-a.oregon-postgres.render.com/instautoreply');

let pgPool = null;
let sqliteDb = null;

// Initialize SQLite for testing / offline fallback
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../../data/instautoreply.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

sqliteDb = new Database(DB_PATH);
sqliteDb.pragma('journal_mode = WAL');
sqliteDb.pragma('foreign_keys = ON');
sqliteDb.exec(CREATE_TABLES_SQL);

// Safe migrations for conversations enrichment columns
try { sqliteDb.exec('ALTER TABLE conversations ADD COLUMN name TEXT;'); } catch (e) {}
try { sqliteDb.exec('ALTER TABLE conversations ADD COLUMN profile_pic_url TEXT;'); } catch (e) {}
try { sqliteDb.exec('ALTER TABLE instagram_accounts ADD COLUMN page_access_token_enc TEXT;'); } catch (e) {}
try { sqliteDb.exec('ALTER TABLE instagram_accounts ADD COLUMN long_lived_token_enc TEXT;'); } catch (e) {}
try { sqliteDb.exec("ALTER TABLE instagram_accounts ADD COLUMN disclosure_message TEXT DEFAULT '⚡ [Automated Response] ';"); } catch (e) {}
try { sqliteDb.exec('ALTER TABLE instagram_accounts ADD COLUMN fb_page_name TEXT;'); } catch (e) {}
try { sqliteDb.exec('ALTER TABLE instagram_accounts ADD COLUMN fb_user_id TEXT;'); } catch (e) {}
try { sqliteDb.exec('ALTER TABLE instagram_accounts ADD COLUMN account_type TEXT;'); } catch (e) {}
try { sqliteDb.exec('ALTER TABLE instagram_accounts ADD COLUMN full_name TEXT;'); } catch (e) {}
try { sqliteDb.exec('ALTER TABLE instagram_accounts ADD COLUMN profile_picture_url TEXT;'); } catch (e) {}
try { sqliteDb.exec('ALTER TABLE instagram_accounts ADD COLUMN followers_count INTEGER DEFAULT 0;'); } catch (e) {}
try { sqliteDb.exec("DELETE FROM instagram_accounts WHERE username IN ('instagram_creator', 'test_creator_account', 'instagram_user', 'connected');"); } catch (e) {}

function toPgSql(sql) {
  let paramIdx = 1;
  let pgSql = sql.replace(/\?/g, () => `$${paramIdx++}`);
  // Translate SQLite date functions to PG text-compatible to_char expressions
  pgSql = pgSql.replace(/date\('now',\s*'-(\d+)\s*days?'\)/gi, "to_char(CURRENT_DATE - INTERVAL '$1 days', 'YYYY-MM-DD')");
  pgSql = pgSql.replace(/date\('now',\s*'start of month',\s*'-1 month'\)/gi, "to_char(date_trunc('month', CURRENT_DATE) - INTERVAL '1 month', 'YYYY-MM-DD')");
  pgSql = pgSql.replace(/date\('now',\s*'start of month'\)/gi, "to_char(date_trunc('month', CURRENT_DATE), 'YYYY-MM-DD')");
  pgSql = pgSql.replace(/date\('now'\)/gi, "to_char(CURRENT_DATE, 'YYYY-MM-DD')");
  pgSql = pgSql.replace(/datetime\('now'\)/gi, "to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')");
  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(pgSql)) {
    pgSql = pgSql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT INTO') + ' ON CONFLICT DO NOTHING';
  }
  return pgSql;
}

function formatRow(row) {
  if (!row) return row;
  for (const k of Object.keys(row)) {
    if ((k === 'count' || k === 'c' || k.endsWith('_count')) && typeof row[k] === 'string' && /^-?\d+$/.test(row[k])) {
      row[k] = parseInt(row[k], 10);
    }
  }
  return row;
}

function normalizeParams(args) {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  return args;
}

// ── Pure PostgreSQL Connection Pool ───────────────────────────────────────
if (PG_URL) {
  try {
    const { Pool } = require('pg');
    const isRenderInternal = PG_URL.includes('dpg-') && !PG_URL.includes('.render.com');
    pgPool = new Pool({
      connectionString: PG_URL,
      ssl: isRenderInternal ? false : { rejectUnauthorized: false },
      max: 15,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pgPool.query('SELECT NOW()')
      .then(async () => {
        console.log('[PostgreSQL] ✅ Connected to Render PostgreSQL as Primary Database (Pure PG Mode)');
        try {
          await pgPool.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name TEXT;');
          await pgPool.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS page_access_token_enc TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS long_lived_token_enc TEXT;');
          await pgPool.query("ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS disclosure_message TEXT DEFAULT '⚡ [Automated Response] ';");
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS fb_page_name TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS fb_user_id TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS account_type TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS full_name TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;');
          await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;');
          await pgPool.query("DELETE FROM instagram_accounts WHERE username IN ('instagram_creator', 'test_creator_account', 'instagram_user', 'connected');");
        } catch (migErr) {
          console.warn('[PostgreSQL] Migration notice:', migErr.message);
        }
      })
      .catch((err) => {
        console.warn('[PostgreSQL] Warning connecting to PG Pool:', err.message);
      });
  } catch (err) {
    console.warn('[PostgreSQL] Pool initialization error:', err.message);
  }
}

const db = {
  prepare(sql) {
    if (isTestEnv || !pgPool) {
      return sqliteDb.prepare(sql);
    }
    const pgSql = toPgSql(sql);
    return {
      async get(...args) {
        const params = normalizeParams(args).map(p => (p === undefined ? null : p));
        const res = await pgPool.query(pgSql, params);
        return res.rows[0] ? formatRow(res.rows[0]) : undefined;
      },
      async all(...args) {
        const params = normalizeParams(args).map(p => (p === undefined ? null : p));
        const res = await pgPool.query(pgSql, params);
        return (res.rows || []).map(formatRow);
      },
      async run(...args) {
        const params = normalizeParams(args).map(p => (p === undefined ? null : p));
        const res = await pgPool.query(pgSql, params);
        return { changes: res.rowCount, rowCount: res.rowCount };
      }
    };
  },

  async query(sql, ...args) {
    const params = normalizeParams(args).map(p => (p === undefined ? null : p));
    if (isTestEnv || !pgPool) {
      return sqliteDb.prepare(sql).all(...params);
    }
    const pgSql = toPgSql(sql);
    const res = await pgPool.query(pgSql, params);
    return (res.rows || []).map(formatRow);
  },

  async get(sql, ...args) {
    return this.prepare(sql).get(...args);
  },

  async all(sql, ...args) {
    return this.prepare(sql).all(...args);
  },

  async run(sql, ...args) {
    return this.prepare(sql).run(...args);
  },

  getPgPool() {
    return pgPool;
  },

  getSqlite() {
    return sqliteDb;
  }
};

console.log('[DB] ✅ Database initialized for production / live data (Pure PostgreSQL).');
module.exports = db;
