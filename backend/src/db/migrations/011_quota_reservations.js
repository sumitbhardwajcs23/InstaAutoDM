// backend/src/db/migrations/011_quota_reservations.js
// Migration 011: Creates quota_reservations table for atomic reservation state management
// Distinguishes RESERVED, COMMITTED, ROLLED_BACK with unique reservation ID and idempotency key.

module.exports = {
  name: '011_quota_reservations.js',
  async up(client) {
    console.log('[Migration 011] Creating quota_reservations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS quota_reservations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        reply_type TEXT NOT NULL CHECK (reply_type IN ('dm', 'comment')),
        idempotency_key TEXT UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('RESERVED', 'COMMITTED', 'ROLLED_BACK')),
        expires_at TIMESTAMPTZ NOT NULL,
        committed_at TIMESTAMPTZ,
        rolled_back_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_quota_reservations_user_status ON quota_reservations(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_quota_reservations_idempotency ON quota_reservations(idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_quota_reservations_expires ON quota_reservations(expires_at) WHERE status = 'RESERVED';
    `);
    console.log('[Migration 011] ✅ quota_reservations table and indexes created.');
  },
  async down(client) {
    console.log('[Migration 011 Rollback] Dropping quota_reservations table...');
    await client.query(`DROP TABLE IF EXISTS quota_reservations CASCADE;`);
    console.log('[Migration 011 Rollback] ✅ Dropped.');
  }
};
