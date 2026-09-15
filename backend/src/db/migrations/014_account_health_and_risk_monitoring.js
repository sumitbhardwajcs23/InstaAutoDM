// backend/src/db/migrations/014_account_health_and_risk_monitoring.js
//
// Migration 014: Instagram Account Health & Automation Risk Monitoring System
//
// KEY INVARIANTS ENFORCED:
// 1. Health is ACCOUNT-SCOPED (instagram_accounts.id). Quota is SUBSCRIPTION-SCOPED (subscriptions.id).
// 2. Health monitoring never creates a second quota system or alters subscription entitlements.
// 3. Foreign key on audit events uses ON DELETE SET NULL to preserve audit trail integrity
//    under GDPR/account retention compliance (events are pruned explicitly via dataRetention.js).
// 4. Historical health events retain immutable subscription context at the time the event occurred.
// 5. Lightweight snapshots enable fast 24h/7d trend rendering without re-scanning raw logs.
//
// IDEMPOTENT: Uses IF NOT EXISTS / IF EXISTS.

module.exports = {
  name: '014_account_health_and_risk_monitoring.js',

  async up(client) {
    console.log('[Migration 014] Starting Account Health & Risk Monitoring schema creation...');

    // ─────────────────────────────────────────────────────────────────────
    // STEP 1: Create instagram_account_health_events (Audit Ledger)
    // ─────────────────────────────────────────────────────────────────────
    console.log('[Migration 014] Step 1: Creating instagram_account_health_events...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS instagram_account_health_events (
        id                   TEXT PRIMARY KEY,
        instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE SET NULL ON UPDATE CASCADE,
        user_id              TEXT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        subscription_id      TEXT REFERENCES subscriptions(id) ON DELETE SET NULL ON UPDATE CASCADE,
        event_type           TEXT NOT NULL,
        severity             TEXT NOT NULL DEFAULT 'info'
                             CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
        source               TEXT NOT NULL DEFAULT 'worker_queue',
        status_code          INTEGER,
        error_code           TEXT,
        metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
        occurred_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_iahe_account_occurred
        ON instagram_account_health_events (instagram_account_id, occurred_at DESC);

      CREATE INDEX IF NOT EXISTS idx_iahe_sub_occurred
        ON instagram_account_health_events (subscription_id, occurred_at DESC);

      CREATE INDEX IF NOT EXISTS idx_iahe_type_occurred
        ON instagram_account_health_events (event_type, occurred_at DESC);
    `);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: Create instagram_account_health_state (Fast O(1) Snapshot)
    // ─────────────────────────────────────────────────────────────────────
    console.log('[Migration 014] Step 2: Creating instagram_account_health_state...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS instagram_account_health_state (
        instagram_account_id       TEXT PRIMARY KEY REFERENCES instagram_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
        health_score               INTEGER NOT NULL DEFAULT 100
                                   CHECK (health_score >= 0 AND health_score <= 100),
        health_status              TEXT NOT NULL DEFAULT 'HEALTHY'
                                   CHECK (health_status IN ('HEALTHY', 'CAUTION', 'ELEVATED_RISK', 'CRITICAL')),
        automation_mode            TEXT NOT NULL DEFAULT 'NORMAL'
                                   CHECK (automation_mode IN ('NORMAL', 'CAUTION', 'PROTECTION', 'PAUSED')),
        observed_risk_level        TEXT NOT NULL DEFAULT 'low'
                                   CHECK (observed_risk_level IN ('low', 'moderate', 'elevated', 'critical')),
        last_calculated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_incident_at           TIMESTAMPTZ,
        last_incident_type         TEXT,
        consecutive_failures       INTEGER NOT NULL DEFAULT 0,
        rolling_24h_successes      INTEGER NOT NULL DEFAULT 0,
        rolling_24h_failures       INTEGER NOT NULL DEFAULT 0,
        observed_rate_limit_count  INTEGER NOT NULL DEFAULT 0,
        recent_error_rate          NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
        score_reasons              JSONB NOT NULL DEFAULT '[]'::jsonb,
        recovery_step              INTEGER NOT NULL DEFAULT 0,
        updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_iahs_status
        ON instagram_account_health_state (health_status);

      CREATE INDEX IF NOT EXISTS idx_iahs_mode
        ON instagram_account_health_state (automation_mode);

      CREATE INDEX IF NOT EXISTS idx_iahs_updated
        ON instagram_account_health_state (updated_at DESC);
    `);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: Create instagram_account_health_snapshots (Trend History)
    // ─────────────────────────────────────────────────────────────────────
    console.log('[Migration 014] Step 3: Creating instagram_account_health_snapshots...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS instagram_account_health_snapshots (
        id                   TEXT PRIMARY KEY,
        instagram_account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
        health_score         INTEGER NOT NULL,
        health_status        TEXT NOT NULL,
        automation_mode      TEXT NOT NULL,
        error_rate           NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
        rate_limit_count     INTEGER NOT NULL DEFAULT 0,
        snapshot_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_iahs_snap_acc_time
        ON instagram_account_health_snapshots (instagram_account_id, snapshot_at DESC);
    `);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4: Seed baseline health state for all existing connected accounts
    // ─────────────────────────────────────────────────────────────────────
    console.log('[Migration 014] Step 4: Seeding baseline health state for existing accounts...');
    await client.query(`
      INSERT INTO instagram_account_health_state (
        instagram_account_id, health_score, health_status, automation_mode, observed_risk_level,
        consecutive_failures, rolling_24h_successes, rolling_24h_failures, recent_error_rate,
        score_reasons, last_calculated_at, updated_at
      )
      SELECT 
        id, 
        100, 
        'HEALTHY', 
        'NORMAL', 
        'low',
        0, 
        0, 
        0, 
        0.00,
        '["Initial baseline health state created"]'::jsonb,
        NOW(), 
        NOW()
      FROM instagram_accounts
      ON CONFLICT (instagram_account_id) DO NOTHING;
    `);

    console.log('[Migration 014] ✅ Migration completed successfully.');
  },

  async down(client) {
    console.log('[Migration 014] Reverting Account Health & Risk Monitoring schema...');
    await client.query(`DROP TABLE IF EXISTS instagram_account_health_snapshots CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS instagram_account_health_state CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS instagram_account_health_events CASCADE;`);
    console.log('[Migration 014] Reversion complete.');
  }
};
