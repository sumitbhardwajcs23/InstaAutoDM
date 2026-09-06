// backend/src/db/index.js
// Pure PostgreSQL Database Layer for ReplyOS
const path = require('path');

// Ensure environment variables are loaded regardless of how this file is called
try {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  require('dotenv').config();
} catch (e) {}

const { Pool } = require('pg');
const { CREATE_TABLES_PG_SQL } = require('./schema');

const PG_URL = process.env.DATABASE_URL;

if (!PG_URL) {
  console.error('[PostgreSQL] ❌ FATAL: DATABASE_URL environment variable is missing! ReplyOS runs exclusively on PostgreSQL.');
}

const isRenderInternal = PG_URL && PG_URL.includes('dpg-') && !PG_URL.includes('.render.com');
const pgPool = PG_URL ? new Pool({
  connectionString: PG_URL,
  ssl: isRenderInternal ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
}) : null;

// Initialize tables and columns on startup
if (pgPool) {
  pgPool.query('SELECT NOW()')
    .then(async () => {
      const isNeon = PG_URL.includes('neon.tech');
      const isRender = PG_URL.includes('render.com');
      const providerName = isNeon ? 'Neon Serverless PostgreSQL' : (isRender ? 'Render PostgreSQL' : 'PostgreSQL');
      console.log(`[PostgreSQL] ✅ Connected to ${providerName} as Primary Database (Pure PG Mode)`);
      try {
        if (CREATE_TABLES_PG_SQL) {
          await pgPool.query(CREATE_TABLES_PG_SQL);
        }
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
      } catch (migErr) {
        console.warn('[PostgreSQL] Migration notice:', migErr.message);
      }
    })
    .catch((err) => {
      console.warn('[PostgreSQL] Warning connecting to PG Pool:', err.message);
    });
}

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

const db = {
  prepare(sql) {
    if (!pgPool) {
      throw new Error('Database connection not available. DATABASE_URL is required.');
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
    if (!pgPool) {
      throw new Error('Database connection not available. DATABASE_URL is required.');
    }
    const params = normalizeParams(args).map(p => (p === undefined ? null : p));
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
  }
};

console.log('[DB] ✅ Database initialized for production / live data (Pure PostgreSQL).');
module.exports = db;
