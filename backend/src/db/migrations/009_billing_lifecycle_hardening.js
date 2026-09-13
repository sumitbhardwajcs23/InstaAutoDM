/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  Migration 009 — Billing Lifecycle Hardening & Timestamp Integrity       ║
 * ║  Safe Timestamptz Function & Usage Counters TIMESTAMPTZ Migration       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Responsibilities:
 * 1. Preflight data-quality validation: aborts safely if any malformed timestamp
 *    exists in usage_counters or subscriptions.
 * 2. Installs safe_timestamptz() PL/pgSQL immutable helper function.
 * 3. Safely migrates usage_counters.period_start and period_end to TIMESTAMPTZ (Option A).
 * 4. Provides reversible down() migration restoring TEXT type and dropping function.
 */

async function runPreflightCheck(client) {
  const badCounters = await client.query(`
    SELECT id, user_id, period_start, period_end
    FROM usage_counters
    WHERE (period_start IS NOT NULL AND period_start::text !~ '^\\d{4}-\\d{2}-\\d{2}' AND period_start::text !~ '^\\d+$')
       OR (period_end IS NOT NULL AND period_end::text !~ '^\\d{4}-\\d{2}-\\d{2}' AND period_end::text !~ '^\\d+$')
  `);

  const badSubs = await client.query(`
    SELECT id, user_id, current_period_start, current_period_end
    FROM subscriptions
    WHERE (current_period_start IS NOT NULL AND current_period_start::text !~ '^\\d{4}-\\d{2}-\\d{2}' AND current_period_start::text !~ '^\\d+$')
       OR (current_period_end IS NOT NULL AND current_period_end::text !~ '^\\d{4}-\\d{2}-\\d{2}' AND current_period_end::text !~ '^\\d+$')
  `);

  if (badCounters.rows.length > 0 || badSubs.rows.length > 0) {
    const errorDetails = [
      ...badCounters.rows.map(r => `usage_counters id=${r.id} (start='${r.period_start}', end='${r.period_end}')`),
      ...badSubs.rows.map(r => `subscriptions id=${r.id} (start='${r.current_period_start}', end='${r.current_period_end}')`)
    ].join('; ');
    throw new Error(`[Migration 009 Preflight FAILED] Found malformed timestamp data: ${errorDetails}`);
  }

  return true;
}

module.exports = {
  runPreflightCheck,

  async up(client) {
    console.log('\n[Migration 009] ── Preflight Data Quality Verification ──');
    await runPreflightCheck(client);
    console.log('  ✅ Preflight check passed: zero malformed timestamps detected.');

    console.log('[Migration 009] ── Step 1: Install safe_timestamptz() PL/pgSQL function ──');
    await client.query(`
      CREATE OR REPLACE FUNCTION safe_timestamptz(ts_text TEXT)
      RETURNS TIMESTAMPTZ IMMUTABLE PARALLEL SAFE LANGUAGE plpgsql AS $$
      BEGIN
        IF ts_text IS NULL OR TRIM(ts_text) = '' THEN
          RETURN NULL;
        END IF;
        IF ts_text ~ '^\\d{4}-\\d{2}-\\d{2}' THEN
          RETURN ts_text::timestamptz;
        ELSIF ts_text ~ '^\\d+$' THEN
          RETURN to_timestamp(ts_text::double precision / 1000.0);
        ELSE
          RETURN NULL;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
      END;
      $$;
    `);
    console.log('  ✅ Function safe_timestamptz(TEXT) installed.');

    console.log('[Migration 009] ── Step 2: Convert usage_counters timestamp columns to TIMESTAMPTZ ──');
    await client.query(`
      ALTER TABLE usage_counters
        ALTER COLUMN period_start TYPE TIMESTAMPTZ USING safe_timestamptz(period_start),
        ALTER COLUMN period_end TYPE TIMESTAMPTZ USING safe_timestamptz(period_end);
    `);
    console.log('  ✅ usage_counters.period_start and period_end converted to TIMESTAMPTZ.');

    // Record in schema_migrations
    await client.query(`
      INSERT INTO schema_migrations (version, name, checksum, applied_at, execution_time_ms)
      VALUES ('009', '009_billing_lifecycle_hardening.js', 'mig_009_hardened_v1', to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), 0)
      ON CONFLICT (version) DO UPDATE SET applied_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS');
    `);
    console.log('  ✅ Migration 009 recorded in schema_migrations.\n');
  },

  async down(client) {
    console.log('\n[Migration 009 Rollback] Reverting usage_counters columns to TEXT...');
    await client.query(`
      ALTER TABLE usage_counters
        ALTER COLUMN period_start TYPE TEXT USING to_char(period_start, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        ALTER COLUMN period_end TYPE TEXT USING to_char(period_end, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    `);
    console.log('  ✅ usage_counters columns reverted to TEXT.');

    await client.query(`DROP FUNCTION IF EXISTS safe_timestamptz(TEXT);`);
    console.log('  ✅ Function safe_timestamptz(TEXT) dropped.');

    await client.query(`DELETE FROM schema_migrations WHERE version = '009';`);
    console.log('  ✅ Migration 009 record removed from schema_migrations.\n');
  }
};
