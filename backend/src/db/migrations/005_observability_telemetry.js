/**
 * Migration 005: Observability, Error Tracking & Compliance Incidents
 * Tables: system_alerts, error_events, data_deletion_requests, automation_loop_incidents
 */

module.exports = {
  async up(client) {
    await client.query(`
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

      CREATE INDEX IF NOT EXISTS idx_data_deletion_code ON data_deletion_requests(confirmation_code);

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
  },

  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS automation_loop_incidents CASCADE;
      DROP TABLE IF EXISTS data_deletion_requests CASCADE;
      DROP TABLE IF EXISTS error_events CASCADE;
      DROP TABLE IF EXISTS system_alerts CASCADE;
    `);
  }
};
