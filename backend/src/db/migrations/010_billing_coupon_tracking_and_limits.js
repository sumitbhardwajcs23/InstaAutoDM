/**
 * Migration 010: Billing Coupon Tracking, Invoice Metadata & Custom Daily Limits
 * 
 * 1. Adds coupon_code, coupon_id, and discount_amount to invoices table
 * 2. Adds custom_daily_limit to users table
 * 3. Ensures index on invoices(coupon_code) for fast admin query lookups
 */

async function runPreflightCheck(client) {
  const tableCheck = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_name IN ('invoices', 'users', 'coupons', 'coupon_redemptions')
  `);
  const found = new Set(tableCheck.rows.map(r => r.table_name));
  if (!found.has('invoices') || !found.has('users')) {
    throw new Error('[Migration 010 Preflight FAILED] Required core tables (invoices, users) are missing');
  }
  return true;
}

module.exports = {
  runPreflightCheck,

  async up(client) {
    console.log('\n[Migration 010] ── Preflight Verification ──');
    await runPreflightCheck(client);
    console.log('  ✅ Preflight verified: core tables present.');

    console.log('[Migration 010] ── Step 1: Adding coupon tracking columns to invoices ──');
    await client.query(`
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS coupon_code TEXT;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS coupon_id TEXT;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0;
    `);
    console.log('  ✅ Added coupon_code, coupon_id, discount_amount to invoices.');

    console.log('[Migration 010] ── Step 2: Adding custom_daily_limit to users ──');
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_daily_limit INTEGER;
    `);
    console.log('  ✅ Added custom_daily_limit to users.');

    console.log('[Migration 010] ── Step 3: Ensuring index on invoices(coupon_code) ──');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_coupon_code ON invoices(coupon_code) WHERE coupon_code IS NOT NULL;
    `);
    console.log('  ✅ Created index idx_invoices_coupon_code.');

    // Record in schema_migrations
    await client.query(`
      INSERT INTO schema_migrations (version, name, checksum, applied_at, execution_time_ms)
      VALUES ('010', '010_billing_coupon_tracking_and_limits.js', 'mig_010_coupon_limits_v1', to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 0)
      ON CONFLICT (version) DO UPDATE SET applied_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS');
    `).catch(() => {});
    console.log('  ✅ Migration 010 recorded in schema_migrations.\n');
  },

  async down(client) {
    console.log('\n[Migration 010 Rollback] Removing added columns...');
    await client.query(`
      DROP INDEX IF EXISTS idx_invoices_coupon_code;
      ALTER TABLE invoices DROP COLUMN IF EXISTS coupon_code;
      ALTER TABLE invoices DROP COLUMN IF EXISTS coupon_id;
      ALTER TABLE invoices DROP COLUMN IF EXISTS discount_amount;
      ALTER TABLE users DROP COLUMN IF EXISTS custom_daily_limit;
    `);
    await client.query(`DELETE FROM schema_migrations WHERE version = '010';`).catch(() => {});
    console.log('  ✅ Migration 010 rollback completed.\n');
  }
};
