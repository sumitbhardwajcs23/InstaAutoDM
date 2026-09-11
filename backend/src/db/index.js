// backend/src/db/index.js
// Pure PostgreSQL Database Layer for Airvix
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
  console.error('[PostgreSQL] ❌ FATAL: DATABASE_URL environment variable is missing! Airvix runs exclusively on PostgreSQL.');
}

const isRenderInternal = PG_URL && PG_URL.includes('dpg-') && !PG_URL.includes('.render.com');
let sslOption = false;
if (PG_URL && !isRenderInternal) {
  sslOption = {
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
    ...(process.env.PG_CA_CERT ? { ca: process.env.PG_CA_CERT } : {})
  };
}

const pgPool = PG_URL ? new Pool({
  connectionString: PG_URL,
  ssl: sslOption,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
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
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS comment_reply_mode TEXT DEFAULT 'both';");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS comment_reply_message TEXT;");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS dm_reply_message TEXT;");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS target_media_id TEXT;");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS target_media_type TEXT;");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS target_media_thumbnail TEXT;");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS target_media_caption TEXT;");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS require_follow INTEGER DEFAULT 0;");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS follow_prompt_message TEXT;");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS follow_comment_reply TEXT;");
        await pgPool.query("ALTER TABLE comment_replies ADD COLUMN IF NOT EXISTS follower_status TEXT;");
        await pgPool.query("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pending_follow_rule_id TEXT;");
        await pgPool.query("ALTER TABLE comment_replies ADD COLUMN IF NOT EXISTS public_reply_sent TEXT;");
        await pgPool.query("ALTER TABLE comment_replies ADD COLUMN IF NOT EXISTS meta_comment_reply_id TEXT;");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS card_enabled INTEGER DEFAULT 0;");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS card_title TEXT;");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS card_subtitle TEXT;");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS card_image_url TEXT;");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS card_button_text TEXT;");
        await pgPool.query("ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS card_button_url TEXT;");
        await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';");
        await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';");
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS site_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
        `);
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS password_resets (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
        `);
        // Ensure default admin user exists safely without hardcoded credentials
        const existingAdmin = await pgPool.query("SELECT id, password_hash FROM users WHERE email = 'admin@airvix.com'");
        if (!existingAdmin.rows || existingAdmin.rows.length === 0) {
          const crypto = require('crypto');
          const bcrypt = require('bcryptjs');
          const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD || crypto.randomBytes(16).toString('hex');
          const adminPasswordHash = await bcrypt.hash(bootstrapPassword, 12);
          
          await pgPool.query(`
            INSERT INTO users (id, email, name, plan, role, status, password_hash, dm_usage_this_period, usage_period_start, created_at, updated_at)
            VALUES ('admin-root-001', 'admin@airvix.com', 'Super Admin', 'agency', 'admin', 'active', $1, 0, to_char(CURRENT_DATE, 'YYYY-MM-DD'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
          `, [adminPasswordHash]);

          if (!process.env.ADMIN_BOOTSTRAP_PASSWORD) {
            console.log(`\n[Security] 🔑 New admin account created for admin@airvix.com with generated bootstrap password: ${bootstrapPassword}\n[Security] Set ADMIN_BOOTSTRAP_PASSWORD in environment to customize this initial credential.\n`);
          }
        } else {
          // Keep existing password, simply ensure admin role and active status
          await pgPool.query("UPDATE users SET role = 'admin', status = 'active' WHERE email = 'admin@airvix.com'");
        }

        // Ensure owner email also elevated to admin if registered
        const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'sumitbhardwaj2227@gmail.com,admin@airvix.com')
          .toLowerCase()
          .split(',')
          .map(e => e.trim());
        for (const aEmail of adminEmails) {
          if (aEmail) {
            await pgPool.query("UPDATE users SET role = 'admin' WHERE LOWER(email) = $1", [aEmail]);
          }
        }
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
