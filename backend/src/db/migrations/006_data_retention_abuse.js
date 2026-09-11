/**
 * Migration 006: Data Retention, Abuse Prevention, Cost Protection & Kill Switches
 * Tables: tenant_api_usage, abuse_flags, global_kill_switch
 */

module.exports = {
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_api_usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id TEXT REFERENCES instagram_accounts(id) ON DELETE SET NULL,
        api_type TEXT NOT NULL,
        endpoint TEXT,
        cost_units INTEGER DEFAULT 1,
        status_code INTEGER,
        details TEXT,
        created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE INDEX IF NOT EXISTS idx_tenant_api_usage_user ON tenant_api_usage(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tenant_api_usage_type ON tenant_api_usage(api_type, created_at DESC);

      CREATE TABLE IF NOT EXISTS abuse_flags (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE CASCADE,
        flag_type TEXT NOT NULL,
        severity TEXT DEFAULT 'warning',
        details TEXT,
        auto_paused INTEGER DEFAULT 0,
        resolved INTEGER DEFAULT 0,
        resolved_by TEXT,
        resolved_at TEXT,
        created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE INDEX IF NOT EXISTS idx_abuse_flags_res ON abuse_flags(resolved, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_abuse_flags_acc ON abuse_flags(instagram_account_id, resolved);

      CREATE TABLE IF NOT EXISTS global_kill_switch (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        target_id TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        reason TEXT,
        activated_by TEXT,
        activated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        deactivated_at TEXT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_kill_switch_scope_target ON global_kill_switch(scope, target_id);
      CREATE INDEX IF NOT EXISTS idx_kill_switch_active ON global_kill_switch(is_active);
    `);
  },

  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS global_kill_switch CASCADE;
      DROP TABLE IF EXISTS abuse_flags CASCADE;
      DROP TABLE IF EXISTS tenant_api_usage CASCADE;
    `);
  }
};
