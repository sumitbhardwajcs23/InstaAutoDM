/**
 * Migration 002: Webhook Reliability & Dead-Letter Queue (DLQ)
 */

module.exports = {
  async up(client) {
    await client.query(`
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

      CREATE INDEX IF NOT EXISTS idx_webhook_events_idemp ON webhook_events(idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_webhook_events_acc ON webhook_events(account_id);

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

      CREATE INDEX IF NOT EXISTS idx_dlq_user ON dead_letter_queue(user_id, is_resolved);
      CREATE INDEX IF NOT EXISTS idx_dlq_created ON dead_letter_queue(created_at DESC);
    `);
  },

  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS dead_letter_queue CASCADE;
      DROP TABLE IF EXISTS webhook_events CASCADE;
    `);
  }
};
