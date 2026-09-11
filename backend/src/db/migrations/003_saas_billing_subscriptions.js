/**
 * Migration 003: SaaS Billing & Subscription Lifecycle Architecture
 * Tables: subscriptions, invoices, payment_webhook_events
 */

module.exports = {
  async up(client) {
    await client.query(`
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
        tax INTEGER DEFAULT 0,
        subtotal INTEGER,
        created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);

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
  },

  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS payment_webhook_events CASCADE;
      DROP TABLE IF EXISTS invoices CASCADE;
      DROP TABLE IF EXISTS subscriptions CASCADE;
    `);
  }
};
