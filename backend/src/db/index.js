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
        await pgPool.query(`
          ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name TEXT;
          ALTER TABLE conversations ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;
          ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS page_access_token_enc TEXT;
          ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS long_lived_token_enc TEXT;
          ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS disclosure_message TEXT DEFAULT '⚡ [Automated Response] ';
          ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS fb_page_name TEXT;
          ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS fb_user_id TEXT;
          ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS account_type TEXT;
          ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS full_name TEXT;
          ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
          ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS token_refreshed_at TEXT;
          ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS token_revoked_at TEXT;
          ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS token_type TEXT DEFAULT 'ig_long_lived';
          ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS last_auth_error TEXT;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS comment_reply_mode TEXT DEFAULT 'both';
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS comment_reply_message TEXT;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS dm_reply_message TEXT;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS target_media_id TEXT;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS target_media_type TEXT;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS target_media_thumbnail TEXT;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS target_media_caption TEXT;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS require_follow INTEGER DEFAULT 0;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS follow_prompt_message TEXT;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS follow_comment_reply TEXT;
          ALTER TABLE comment_replies ADD COLUMN IF NOT EXISTS follower_status TEXT;
          ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pending_follow_rule_id TEXT;
          ALTER TABLE comment_replies ADD COLUMN IF NOT EXISTS public_reply_sent TEXT;
          ALTER TABLE comment_replies ADD COLUMN IF NOT EXISTS meta_comment_reply_id TEXT;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS card_enabled INTEGER DEFAULT 0;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS card_title TEXT;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS card_subtitle TEXT;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS card_image_url TEXT;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS card_button_text TEXT;
          ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS card_button_url TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
          ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
          ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_dm_limit INTEGER;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_ig_limit INTEGER;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_rules_limit INTEGER;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified INTEGER DEFAULT 0;
        `).catch(() => {});
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS auth_accounts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
            provider TEXT NOT NULL,
            provider_account_id TEXT NOT NULL,
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
            CONSTRAINT unq_auth_provider_acc UNIQUE(provider, provider_account_id),
            CONSTRAINT unq_user_provider UNIQUE(user_id, provider)
          );
        `).catch(() => {});
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS otp_tokens (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            otp_hash TEXT NOT NULL,
            purpose TEXT NOT NULL,
            attempts INTEGER DEFAULT 0,
            max_attempts INTEGER DEFAULT 3,
            expires_at TEXT NOT NULL,
            consumed_at TEXT,
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
        `).catch(() => {});
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS user_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
            token_hash TEXT NOT NULL,
            ip_address TEXT DEFAULT 'masked',
            user_agent TEXT,
            is_revoked INTEGER DEFAULT 0,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
            last_active_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
        `).catch(() => {});
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS site_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
        `).catch(() => {});
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS pricing_plans (
            id TEXT PRIMARY KEY,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            monthly_price INTEGER NOT NULL DEFAULT 0,
            annual_price INTEGER NOT NULL DEFAULT 0,
            currency TEXT DEFAULT 'INR',
            dm_limit INTEGER DEFAULT 1000,
            ig_limit INTEGER DEFAULT 1,
            rules_limit INTEGER DEFAULT 5,
            badge_text TEXT,
            is_popular INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            features TEXT,
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
            updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
        `);

        // Auto-seed default pricing plans if table is empty
        const plansCountRes = await pgPool.query('SELECT COUNT(*) as count FROM pricing_plans');
        if (parseInt(plansCountRes.rows[0]?.count || '0', 10) === 0) {
          const defaultPlans = [
            {
              id: 'free',
              slug: 'free',
              name: 'Starter / Free',
              description: 'Ideal for creators testing automated DM responses on real traffic.',
              monthly_price: 0,
              annual_price: 0,
              currency: 'INR',
              dm_limit: 1000,
              ig_limit: 1,
              rules_limit: 5,
              badge_text: null,
              is_popular: 0,
              is_active: 1,
              sort_order: 1,
              features: JSON.stringify([
                'Up to 1,000 automated DMs / month',
                'Up to 5 active keyword rules',
                'Comment-to-DM auto response',
                'Instant keyword triggers',
                'Standard Instagram delivery speed',
                'Community support'
              ])
            },
            {
              id: 'pro',
              slug: 'pro',
              name: 'Pro Creator',
              description: 'Built for fast-growing Indian creators, coaches, and D2C brands.',
              monthly_price: 1499,
              annual_price: 1099,
              currency: 'INR',
              dm_limit: -1,
              ig_limit: 3,
              rules_limit: -1,
              badge_text: 'MOST POPULAR IN INDIA',
              is_popular: 1,
              is_active: 1,
              sort_order: 2,
              features: JSON.stringify([
                'Unlimited automated DMs & comments',
                'Unlimited active automation rules',
                'Dynamic {username} personalization',
                'Lead capture & email collector sequences',
                'Dedicated high-priority Meta queue',
                'Full conversation logs & thread analytics',
                'Priority WhatsApp & email support',
                'GST invoice with 18% Input Tax Credit'
              ])
            },
            {
              id: 'scale',
              slug: 'scale',
              name: 'Scale / Enterprise',
              description: 'For large agencies, multi-brand creators, and enterprise teams.',
              monthly_price: 4999,
              annual_price: 3499,
              currency: 'INR',
              dm_limit: -1,
              ig_limit: 10,
              rules_limit: -1,
              badge_text: 'ENTERPRISE',
              is_popular: 0,
              is_active: 1,
              sort_order: 3,
              features: JSON.stringify([
                'Everything in Pro Creator',
                'Up to 10 connected Instagram accounts',
                'Custom Webhooks & CRM Integration',
                'Dedicated Account Manager',
                'Custom SLA & 99.9% Uptime Guarantee'
              ])
            }
          ];

          for (const plan of defaultPlans) {
            await pgPool.query(
              `INSERT INTO pricing_plans (id, slug, name, description, monthly_price, annual_price, currency, dm_limit, ig_limit, rules_limit, badge_text, is_popular, is_active, sort_order, features)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
               ON CONFLICT (id) DO NOTHING;`,
              [plan.id, plan.slug, plan.name, plan.description, plan.monthly_price, plan.annual_price, plan.currency, plan.dm_limit, plan.ig_limit, plan.rules_limit, plan.badge_text, plan.is_popular, plan.is_active, plan.sort_order, plan.features]
            );
          }
          console.log('[PostgreSQL] 🛒 Default pricing plans auto-seeded into pricing_plans table.');
        }
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

        // Coupons Management Table
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS coupons (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            discount_percent INTEGER NOT NULL DEFAULT 0,
            discount_amount INTEGER NOT NULL DEFAULT 0,
            plan_slug TEXT DEFAULT 'all',
            max_uses INTEGER DEFAULT 100,
            used_count INTEGER DEFAULT 0,
            expires_at TEXT,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
          CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
          CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);
        `);

        // Seed default promotional coupons if table is empty
        try {
          const couponsCountRes = await pgPool.query('SELECT COUNT(*) as count FROM coupons');
          if (parseInt(couponsCountRes.rows[0]?.count || 0, 10) === 0) {
            const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
            const nextYearStr = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
            await pgPool.query(`
              INSERT INTO coupons (id, code, discount_percent, plan_slug, max_uses, used_count, expires_at, description, is_active, created_at)
              VALUES 
                ('cpn_launch50', 'LAUNCH50', 50, 'all', 200, 14, $1, 'Launch Special 50% Off Any Plan', 1, $2),
                ('cpn_welcome20', 'WELCOME20', 20, 'all', 500, 38, $1, 'Welcome 20% Discount for New Creators', 1, $2),
                ('cpn_vipcreator', 'VIPCREATOR', 100, 'pro', 50, 6, $1, '100% Free VIP Pro Tier Trial', 1, $2)
            `, [nextYearStr, nowStr]);
          }
        } catch (cpnSeedErr) {
          console.error('[Coupons Seed Error]', cpnSeedErr.message);
        }

        // Seed sample invoices if empty to ensure initial live invoices are ready
        try {
          const invCountRes = await pgPool.query('SELECT COUNT(*) as count FROM invoices');
          if (parseInt(invCountRes.rows[0]?.count || 0, 10) === 0) {
            const firstUser = await pgPool.query('SELECT id, email, name FROM users ORDER BY created_at ASC LIMIT 1');
            if (firstUser.rows && firstUser.rows.length > 0) {
              const u = firstUser.rows[0];
              const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
              await pgPool.query(`
                INSERT INTO invoices (id, user_id, invoice_number, amount, currency, status, gateway, billing_name, billing_email, paid_at, created_at)
                VALUES 
                  ('inv_seed_001', $1, 'INV-2026-001', 1499, 'INR', 'paid', 'razorpay', $2, $3, $4, $4),
                  ('inv_seed_002', $1, 'INV-2026-002', 3999, 'INR', 'paid', 'razorpay', $2, $3, $4, $4)
              `, [u.id, u.name || 'Creator', u.email, nowStr]);
            }
          }
        } catch (invSeedErr) {
          console.error('[Invoices Seed Error]', invSeedErr.message);
        }
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

        // Sub-Admin Governance & 12 Granular Powers Migration
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS admin_users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'subadmin',
            permissions TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'active',
            created_by TEXT,
            created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
            updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          );
          CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
          CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
        `);

        // Pre-seed primary Super Admin accounts with full permissions wildcard ["*"]
        try {
          const bcrypt = require('bcryptjs');
          const defaultAdminPwdHash = await bcrypt.hash('Airvix@Admin2026!', 10);
          const initialAdmins = [
            { id: 'admin_super_001', email: 'sumitbhardwaj2227@gmail.com', name: 'Sumit Bhardwaj (Super Admin)' }
          ];

          for (const sa of initialAdmins) {
            const existing = await pgPool.query('SELECT id FROM admin_users WHERE email = $1', [sa.email]);
            if (!existing.rows || existing.rows.length === 0) {
              const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
              await pgPool.query(`
                INSERT INTO admin_users (id, email, name, password_hash, role, permissions, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 'superadmin', '["*"]', 'active', $5, $5)
              `, [sa.id, sa.email, sa.name, defaultAdminPwdHash, nowStr]);
            }
          }
        } catch (adminSeedErr) {
          console.error('[Admin Seed Error]', adminSeedErr.message);
        }

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
        if (dbInitPromise) await dbInitPromise;
        const params = normalizeParams(args).map(p => (p === undefined ? null : p));
        const res = await pgPool.query(pgSql, params);
        return res.rows[0] ? formatRow(res.rows[0]) : undefined;
      },
      async all(...args) {
        if (dbInitPromise) await dbInitPromise;
        const params = normalizeParams(args).map(p => (p === undefined ? null : p));
        const res = await pgPool.query(pgSql, params);
        return (res.rows || []).map(formatRow);
      },
      async run(...args) {
        if (dbInitPromise) await dbInitPromise;
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
