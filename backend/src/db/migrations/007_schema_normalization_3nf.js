/**
 * Migration 007: Database Architecture Normalization & 3NF Referential Integrity
 * Tables:
 *   - rule_card_attachments (1NF extraction of flattened card columns from automation_rules)
 *   - coupon_redemptions (Junction table enforcing 1-per-user coupon usage & audit trail)
 *   - usage_counters (Materialized rate-limiting usage ledger linked to users)
 * Constraints & Foreign Keys:
 *   - dead_letter_queue -> users(id), instagram_accounts(id)
 *   - error_events -> users(id)
 *   - automation_loop_incidents -> automation_rules(id)
 *   - conversations.pending_follow_rule_id -> automation_rules(id)
 *   - subscriptions partial unique index (user_id, active status)
 * Backfills:
 *   - Backfill rule_card_attachments from automation_rules
 *   - Backfill usage_counters from users
 *   - Backfill default workspaces for users without one
 *   - Synchronize duplicate status flags (admin_sessions, system_alerts, subscriptions)
 */

module.exports = {
  async up(client) {
    console.log('[Migration 007] Starting 3NF Database Normalization & Integrity Migration...');

    // 1. Create rule_card_attachments (1NF extraction of Generic Template card attachments)
    await client.query(`
      CREATE TABLE IF NOT EXISTS rule_card_attachments (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE ON UPDATE CASCADE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        title TEXT NOT NULL,
        subtitle TEXT,
        image_url TEXT,
        button_text TEXT,
        button_url TEXT,
        created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );
      CREATE INDEX IF NOT EXISTS idx_rule_card_attachments_rule ON rule_card_attachments(rule_id, sort_order);
    `);
    console.log('[Migration 007] ✅ rule_card_attachments table verified.');

    // 2. Create coupon_redemptions (Junction table)
    await client.query(`
      CREATE TABLE IF NOT EXISTS coupon_redemptions (
        id TEXT PRIMARY KEY,
        coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
        discount_applied INTEGER NOT NULL DEFAULT 0,
        redeemed_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        CONSTRAINT uq_user_coupon UNIQUE(coupon_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON coupon_redemptions(user_id);
    `);
    console.log('[Migration 007] ✅ coupon_redemptions table verified.');

    // 3. Create usage_counters (Materialized rate-limiting usage ledger)
    await client.query(`
      CREATE TABLE IF NOT EXISTS usage_counters (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        period_start TEXT NOT NULL,
        dms_sent INTEGER NOT NULL DEFAULT 0,
        comments_replied INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );
      CREATE INDEX IF NOT EXISTS idx_usage_counters_user ON usage_counters(user_id);
    `);
    console.log('[Migration 007] ✅ usage_counters table verified.');

    // 4. Clean up dangling references before adding Foreign Key constraints
    console.log('[Migration 007] Cleaning up dangling references before enforcing FK constraints...');
    await client.query(`
      UPDATE dead_letter_queue SET user_id = NULL WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);
      UPDATE dead_letter_queue SET account_id = NULL WHERE account_id IS NOT NULL AND account_id NOT IN (SELECT id FROM instagram_accounts);
      UPDATE error_events SET user_id = NULL WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);
      UPDATE automation_loop_incidents SET trigger_rule_id = NULL WHERE trigger_rule_id IS NOT NULL AND trigger_rule_id NOT IN (SELECT id FROM automation_rules);
      UPDATE conversations SET pending_follow_rule_id = NULL WHERE pending_follow_rule_id IS NOT NULL AND pending_follow_rule_id NOT IN (SELECT id FROM automation_rules);
    `);

    // 5. Add missing Foreign Key constraints safely
    console.log('[Migration 007] Adding missing Foreign Key constraints...');
    const foreignKeys = [
      {
        table: 'dead_letter_queue',
        constraint: 'fk_dlq_user',
        sql: `ALTER TABLE dead_letter_queue DROP CONSTRAINT IF EXISTS fk_dlq_user;
              ALTER TABLE dead_letter_queue ADD CONSTRAINT fk_dlq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;`
      },
      {
        table: 'dead_letter_queue',
        constraint: 'fk_dlq_account',
        sql: `ALTER TABLE dead_letter_queue DROP CONSTRAINT IF EXISTS fk_dlq_account;
              ALTER TABLE dead_letter_queue ADD CONSTRAINT fk_dlq_account FOREIGN KEY (account_id) REFERENCES instagram_accounts(id) ON DELETE SET NULL;`
      },
      {
        table: 'error_events',
        constraint: 'fk_error_events_user',
        sql: `ALTER TABLE error_events DROP CONSTRAINT IF EXISTS fk_error_events_user;
              ALTER TABLE error_events ADD CONSTRAINT fk_error_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;`
      },
      {
        table: 'automation_loop_incidents',
        constraint: 'fk_loop_trigger_rule',
        sql: `ALTER TABLE automation_loop_incidents DROP CONSTRAINT IF EXISTS fk_loop_trigger_rule;
              ALTER TABLE automation_loop_incidents ADD CONSTRAINT fk_loop_trigger_rule FOREIGN KEY (trigger_rule_id) REFERENCES automation_rules(id) ON DELETE SET NULL;`
      },
      {
        table: 'conversations',
        constraint: 'fk_convo_pending_rule',
        sql: `ALTER TABLE conversations DROP CONSTRAINT IF EXISTS fk_convo_pending_rule;
              ALTER TABLE conversations ADD CONSTRAINT fk_convo_pending_rule FOREIGN KEY (pending_follow_rule_id) REFERENCES automation_rules(id) ON DELETE SET NULL;`
      }
    ];

    for (const fk of foreignKeys) {
      try {
        await client.query(fk.sql);
        console.log(`  ✅ Foreign key ${fk.table}.${fk.constraint} enforced.`);
      } catch (e) {
        console.warn(`  ⚠️ Notice adding FK ${fk.table}.${fk.constraint}:`, e.message);
      }
    }

    // 6. Enforce partial unique index on active subscriptions (preventing duplicate active subs)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_user_active_sub 
      ON subscriptions (user_id) 
      WHERE status IN ('active', 'trialing', 'past_due');
    `);
    console.log('[Migration 007] ✅ Subscriptions partial unique index enforced.');

    // 7. Data Backfill: Extract cards from automation_rules into rule_card_attachments
    console.log('[Migration 007] Backfilling rule_card_attachments from automation_rules...');
    await client.query(`
      INSERT INTO rule_card_attachments (id, rule_id, sort_order, title, subtitle, image_url, button_text, button_url, created_at)
      SELECT
        'card_' || id,
        id,
        0,
        COALESCE(card_title, 'View Link'),
        card_subtitle,
        card_image_url,
        card_button_text,
        card_button_url,
        created_at
      FROM automation_rules
      WHERE (card_enabled = 1 OR card_title IS NOT NULL)
        AND id NOT IN (SELECT rule_id FROM rule_card_attachments)
      ON CONFLICT (id) DO NOTHING;
    `);

    // 8. Data Backfill: Populate usage_counters for all users
    console.log('[Migration 007] Backfilling usage_counters from users table...');
    await client.query(`
      INSERT INTO usage_counters (id, user_id, period_start, dms_sent, comments_replied, updated_at)
      SELECT
        'uc_' || id,
        id,
        COALESCE(usage_period_start, to_char(NOW(), 'YYYY-MM-DD')),
        COALESCE(dm_usage_this_period, 0),
        0,
        to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      FROM users
      ON CONFLICT (user_id) DO UPDATE SET
        dms_sent = EXCLUDED.dms_sent,
        period_start = EXCLUDED.period_start;
    `);

    // 9. Data Backfill: Workspaces lifecycle guarantee
    console.log('[Migration 007] Ensuring default workspaces exist for all users...');
    await client.query(`
      INSERT INTO workspaces (id, name, owner_id, status, created_at, updated_at)
      SELECT
        'ws_' || REPLACE(id, '-', ''),
        COALESCE(name, SPLIT_PART(email, '@', 1)) || '''s Workspace',
        id,
        'active',
        to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      FROM users
      WHERE id NOT IN (SELECT owner_id FROM workspaces);
    `);

    // 10. Synchronize intra-table duplicate state columns
    console.log('[Migration 007] Synchronizing duplicate state columns...');
    // system_alerts: sync is_resolved <-> resolved and ensure index exists
    await client.query(`
      UPDATE system_alerts SET is_resolved = resolved WHERE is_resolved IS NULL OR is_resolved = 0 AND resolved = 1;
      UPDATE system_alerts SET resolved = is_resolved WHERE resolved IS NULL OR resolved = 0 AND is_resolved = 1;
      CREATE INDEX IF NOT EXISTS idx_system_alerts_is_res ON system_alerts(is_resolved, created_at DESC);
    `);

    // admin_sessions: sync is_active <-> is_revoked and ensure index exists
    await client.query(`
      UPDATE admin_sessions SET is_active = (CASE WHEN is_revoked = 1 THEN 0 ELSE 1 END) WHERE is_active IS NULL;
      UPDATE admin_sessions SET is_revoked = (CASE WHEN is_active = 0 THEN 1 ELSE 0 END) WHERE is_revoked IS NULL;
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON admin_sessions(user_id, is_active);
    `);

    // subscriptions: sync grace_period_until <-> grace_period_ends_at
    await client.query(`
      UPDATE subscriptions SET grace_period_until = grace_period_ends_at WHERE grace_period_until IS NULL AND grace_period_ends_at IS NOT NULL;
      UPDATE subscriptions SET grace_period_ends_at = grace_period_until WHERE grace_period_ends_at IS NULL AND grace_period_until IS NOT NULL;
    `);

    // Record migration in schema_migrations
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await client.query(`
      INSERT INTO schema_migrations (version, name, checksum, applied_at, execution_time_ms)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (version) DO UPDATE SET applied_at = EXCLUDED.applied_at;
    `, ['007', '007_schema_normalization_3nf', '3nf_normalization_v1', nowStr, 100]);

    console.log('[Migration 007] ✅ 3NF Database Normalization completed successfully!');
  },

  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS coupon_redemptions CASCADE;
      DROP TABLE IF EXISTS rule_card_attachments CASCADE;
      DROP TABLE IF EXISTS usage_counters CASCADE;
      DELETE FROM schema_migrations WHERE version = '007';
    `);
  }
};
