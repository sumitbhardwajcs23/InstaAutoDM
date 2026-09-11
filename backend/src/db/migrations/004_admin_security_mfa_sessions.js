/**
 * Migration 004: Admin Security, 2FA/MFA Secrets & Admin Session Auditing
 * Tables: admin_sessions, users (MFA columns)
 */

module.exports = {
  async up(client) {
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled INTEGER DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret_enc TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes_enc TEXT;

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
  },

  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS admin_sessions CASCADE;
      ALTER TABLE users DROP COLUMN IF EXISTS mfa_backup_codes_enc;
      ALTER TABLE users DROP COLUMN IF EXISTS mfa_secret_enc;
      ALTER TABLE users DROP COLUMN IF EXISTS mfa_enabled;
    `);
  }
};
