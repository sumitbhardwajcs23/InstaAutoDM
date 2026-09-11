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
let dbInitPromise = null;
if (pgPool) {
  dbInitPromise = pgPool.query('SELECT NOW()')
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
        await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;');
        await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS token_refreshed_at TEXT;');
        await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS token_revoked_at TEXT;');
        await pgPool.query("ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS token_type TEXT DEFAULT 'ig_long_lived';");
        await pgPool.query('ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS last_auth_error TEXT;');
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
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS webhook_jobs (
            id TEXT PRIMARY KEY,
            idempotency_key TEXT UNIQUE NOT NULL,
            account_id TEXT NOT NULL,
            job_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'QUEUED',
            attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL DEFAULT 5,
            scheduled_at TEXT NOT NULL,
            processed_at TEXT,
            error_message TEXT,
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
            updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
          CREATE INDEX IF NOT EXISTS idx_webhook_jobs_sched_state ON webhook_jobs(state, scheduled_at);
          CREATE INDEX IF NOT EXISTS idx_webhook_jobs_account ON webhook_jobs(account_id);
        `);
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS data_deletion_requests (
            id TEXT PRIMARY KEY,
            confirmation_code TEXT UNIQUE NOT NULL,
            user_id TEXT,
            account_id TEXT,
            status TEXT NOT NULL DEFAULT 'completed',
            details TEXT,
            requested_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
            completed_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
        `);
        await pgPool.query("CREATE INDEX IF NOT EXISTS idx_data_deletion_code ON data_deletion_requests(confirmation_code);");
        await pgPool.query("ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS token_refreshed_at TEXT;");
        await pgPool.query("ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS token_type TEXT DEFAULT 'ig_long_lived';");
        await pgPool.query("ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS last_auth_error TEXT;");
        await pgPool.query("ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS last_diagnostic_result TEXT;");
        await pgPool.query("ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS last_diagnostic_at TEXT;");
        await pgPool.query("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS daily_automated_dm_count INTEGER DEFAULT 0;");
        await pgPool.query("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_automated_dm_date TEXT;");
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS automation_loop_incidents (
            id TEXT PRIMARY KEY,
            instagram_account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
            conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
            target_user_id TEXT NOT NULL,
            trigger_rule_id TEXT,
            loop_reason TEXT NOT NULL,
            details TEXT,
            status TEXT DEFAULT 'active',
            detected_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
            resolved_at TEXT
          );
          CREATE INDEX IF NOT EXISTS idx_loop_incidents_account ON automation_loop_incidents(instagram_account_id, status);
          CREATE INDEX IF NOT EXISTS idx_loop_incidents_conv ON automation_loop_incidents(conversation_id);
        `);
        // Webhook Reliability Migrations
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS webhook_events (
            id TEXT PRIMARY KEY,
            idempotency_key TEXT,
            account_id TEXT,
            sender_id TEXT,
            event_type TEXT DEFAULT 'messages',
            payload TEXT DEFAULT '{}',
            signature_hash TEXT,
            delivery_timestamp TEXT,
            processing_time_ms INTEGER,
            is_processed INTEGER DEFAULT 0,
            processed_at TEXT,
            status TEXT DEFAULT 'pending',
            error TEXT,
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
        `);
        await pgPool.query("ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT;");
        await pgPool.query("ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS account_id TEXT;");
        await pgPool.query("ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS sender_id TEXT;");
        await pgPool.query("ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS signature_hash TEXT;");
        await pgPool.query("ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS delivery_timestamp TEXT;");
        await pgPool.query("ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;");
        await pgPool.query("ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS is_processed INTEGER DEFAULT 0;");
        await pgPool.query("CREATE INDEX IF NOT EXISTS idx_webhook_events_idemp ON webhook_events(idempotency_key);");
        await pgPool.query("CREATE INDEX IF NOT EXISTS idx_webhook_events_acc ON webhook_events(account_id);");
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS dead_letter_queue (
            id TEXT PRIMARY KEY,
            job_id TEXT,
            user_id TEXT,
            account_id TEXT,
            queue_name TEXT DEFAULT 'dm-dispatch',
            job_type TEXT DEFAULT 'INSTAGRAM_DM',
            payload TEXT NOT NULL,
            error_name TEXT,
            error_message TEXT,
            error_stack TEXT,
            retry_count INTEGER DEFAULT 0,
            attempts INTEGER DEFAULT 0,
            is_resolved INTEGER DEFAULT 0,
            status TEXT DEFAULT 'unresolved',
            resolved_at TEXT,
            failed_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
        `);
        await pgPool.query("ALTER TABLE dead_letter_queue ADD COLUMN IF NOT EXISTS user_id TEXT;");
        await pgPool.query("ALTER TABLE dead_letter_queue ADD COLUMN IF NOT EXISTS queue_name TEXT DEFAULT 'dm-dispatch';");
        await pgPool.query("ALTER TABLE dead_letter_queue ADD COLUMN IF NOT EXISTS error_name TEXT;");
        await pgPool.query("ALTER TABLE dead_letter_queue ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;");
        await pgPool.query("ALTER TABLE dead_letter_queue ADD COLUMN IF NOT EXISTS is_resolved INTEGER DEFAULT 0;");
        await pgPool.query("ALTER TABLE dead_letter_queue ADD COLUMN IF NOT EXISTS resolved_at TEXT;");
        await pgPool.query("CREATE INDEX IF NOT EXISTS idx_dlq_user ON dead_letter_queue(user_id, is_resolved);");
        await pgPool.query("CREATE INDEX IF NOT EXISTS idx_dlq_created ON dead_letter_queue(created_at DESC);");



        // SaaS Billing & Subscription Migrations
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS subscriptions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            plan TEXT NOT NULL DEFAULT 'free',
            status TEXT NOT NULL DEFAULT 'active',
            billing_cycle TEXT NOT NULL DEFAULT 'monthly',
            current_period_start TEXT NOT NULL,
            current_period_end TEXT NOT NULL,
            cancel_at_period_end INTEGER DEFAULT 0,
            canceled_at TEXT,
            trial_ends_at TEXT,
            grace_period_ends_at TEXT,
            gateway TEXT DEFAULT 'razorpay',
            gateway_subscription_id TEXT,
            gateway_customer_id TEXT,
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
            updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
          CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
          CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status);
        `);
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            subscription_id TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
            invoice_number TEXT UNIQUE NOT NULL,
            amount INTEGER NOT NULL,
            currency TEXT NOT NULL DEFAULT 'INR',
            status TEXT NOT NULL DEFAULT 'paid',
            gateway TEXT DEFAULT 'razorpay',
            gateway_payment_id TEXT,
            gateway_order_id TEXT,
            billing_name TEXT,
            billing_email TEXT,
            gst_number TEXT,
            billing_address TEXT,
            paid_at TEXT,
            failed_reason TEXT,
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
          CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
        `);
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS payment_webhook_events (
            id TEXT PRIMARY KEY,
            gateway TEXT NOT NULL,
            event_type TEXT NOT NULL,
            idempotency_key TEXT UNIQUE NOT NULL,
            payload TEXT NOT NULL,
            signature_verified INTEGER DEFAULT 0,
            status TEXT DEFAULT 'processed',
            error TEXT,
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
          CREATE INDEX IF NOT EXISTS idx_pay_webhooks_key ON payment_webhook_events(idempotency_key);
        `);
        await pgPool.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax INTEGER DEFAULT 0;");
        await pgPool.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal INTEGER;");
        await pgPool.query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS grace_period_until TEXT;");
        await pgPool.query("ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;");
        await pgPool.query("ALTER TABLE system_alerts ADD COLUMN IF NOT EXISTS is_resolved INTEGER DEFAULT 0;");
        await pgPool.query("ALTER TABLE system_alerts ADD COLUMN IF NOT EXISTS metadata TEXT;");
        await pgPool.query("ALTER TABLE error_events ADD COLUMN IF NOT EXISTS error_type TEXT;");
        await pgPool.query("ALTER TABLE error_events ADD COLUMN IF NOT EXISTS stack_trace TEXT;");
        await pgPool.query("ALTER TABLE error_events ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'error';");
        await pgPool.query("ALTER TABLE error_events ADD COLUMN IF NOT EXISTS context_data TEXT;");
        await pgPool.query("ALTER TABLE error_events ADD COLUMN IF NOT EXISTS correlation_id TEXT;");
        await pgPool.query("ALTER TABLE error_events ADD COLUMN IF NOT EXISTS created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS');");
        await pgPool.query("ALTER TABLE error_events ALTER COLUMN error_fingerprint DROP NOT NULL;").catch(() => {});



        // Admin Security Migrations
        await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role TEXT DEFAULT 'admin';");
        await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled INTEGER DEFAULT 0;");
        await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret_enc TEXT;");
        await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes_enc TEXT;");
        await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;");
        await pgPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TEXT;");
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS admin_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL,
            ip_address TEXT DEFAULT 'masked',
            user_agent TEXT,
            is_revoked INTEGER DEFAULT 0,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
            last_active_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
          CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id, is_revoked);
        `);

        // Observability & System Monitoring Migrations
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS system_alerts (
            id TEXT PRIMARY KEY,
            alert_type TEXT NOT NULL,
            severity TEXT DEFAULT 'warning',
            message TEXT NOT NULL,
            details TEXT,
            resolved INTEGER DEFAULT 0,
            resolved_at TEXT,
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
          CREATE INDEX IF NOT EXISTS idx_system_alerts_res ON system_alerts(resolved, created_at DESC);
        `);
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS error_events (
            id TEXT PRIMARY KEY,
            error_fingerprint TEXT NOT NULL,
            message TEXT NOT NULL,
            stack TEXT,
            url TEXT,
            method TEXT,
            user_id TEXT,
            request_id TEXT,
            occurrence_count INTEGER DEFAULT 1,
            first_seen_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
            last_seen_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
          CREATE INDEX IF NOT EXISTS idx_error_events_fp ON error_events(error_fingerprint);
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

  async ready() {
    if (dbInitPromise) {
      await dbInitPromise;
    }
  },

  getPgPool() {
    return pgPool;
  }
};

console.log('[DB] ✅ Database initialized for production / live data (Pure PostgreSQL).');
module.exports = db;
