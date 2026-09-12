/**
 * Migration 008 v5 — Four-Phase Production Runner
 *
 * Phase 1: beforeTransaction() — Safe CONCURRENTLY index swap (autocommit)
 * Phase 2: up()               — Transactional DML/DDL body with exact mutation-set snapshots
 * Phase 3: afterTransaction() — FK indexes CONCURRENTLY (autocommit, post-commit)
 * Phase 4: validate()         — 12 automated checks (including V11 exact mutation-set audit)
 *
 * Exit codes:
 *   0 = complete success
 *   1 = failed (rolled back or aborted before commit)
 *   2 = committed but validation failures detected
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
});

const migration = require('./migrations/008_ssot_hardening_indexes');

async function withClient(fn) {
  const c = await pool.connect();
  try {
    return await fn(c);
  } finally {
    c.release();
  }
}

async function runMigration008() {
  const startTime = Date.now();
  const elapsed = () => `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  Airvix Migration 008 v5 Runner                      ║');
  console.log('║  SSOT Hardening, Index Coverage & Invoice Integrity   ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ── Check if migration already recorded ──────────────────────────────────
  await withClient(async (c) => {
    const already = await c.query(
      `SELECT 1 FROM schema_migrations WHERE version = '008'`
    ).catch(() => ({ rowCount: 0 }));
    if (already.rowCount > 0) {
      console.log('⚠️  Migration 008 already recorded in schema_migrations.');
      console.log('   To re-run, delete the record first:');
      console.log("   DELETE FROM schema_migrations WHERE version = '008';");
      process.exit(0);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  PHASE 1 — beforeTransaction()
  //  Safe CONCURRENTLY index swap (autocommit — no transaction wrapper)
  //  Uniqueness is continuous and NEVER absent.
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`[+0.00s] ── Phase 1: Safe unique index swap (CONCURRENTLY) ──`);

  if (migration.beforeTransaction) {
    try {
      await withClient(async (c) => {
        await migration.beforeTransaction(c);
      });
      console.log(`[+${elapsed()}] ✅ Phase 1 complete.\n`);
    } catch (err) {
      console.error(`\n[+${elapsed()}] ❌ Phase 1 FAILED — no data changes made.`);
      console.error('Error:', err.message);
      console.error('Safe to retry without state damage.');
      await pool.end();
      process.exit(1);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PHASE 2 — up()
  //  All DML and non-index DDL inside an explicit transaction.
  //  Captures exact entity IDs, old values, new values via CTE.
  //  Inserts snapshots directly from UPDATE RETURNING results.
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`[+${elapsed()}] ── Phase 2: Transactional migration body ──`);

  const phase2Client = await pool.connect();
  try {
    await phase2Client.query('BEGIN');
    await migration.up(phase2Client);
    await phase2Client.query('COMMIT');
    console.log(`[+${elapsed()}] ✅ Phase 2 COMMITTED.\n`);
  } catch (err) {
    try { await phase2Client.query('ROLLBACK'); } catch (_) {}
    phase2Client.release();
    console.error(`\n[+${elapsed()}] ❌ Phase 2 FAILED — transaction ROLLED BACK.`);
    console.error('Error:', err.message);
    console.error('Database state: UNCHANGED (full atomic rollback).');
    await pool.end();
    process.exit(1);
  }
  phase2Client.release();

  // Update execution_time_ms
  await withClient(async (c) => {
    await c.query(
      `UPDATE schema_migrations SET execution_time_ms = $1 WHERE version = '008'`,
      [Date.now() - startTime]
    ).catch(() => {});
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  PHASE 3 — afterTransaction()
  //  FK indexes created CONCURRENTLY — no table lock, no blocking.
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`[+${elapsed()}] ── Phase 3: FK indexes (CONCURRENTLY, post-commit) ──`);

  if (migration.afterTransaction) {
    try {
      await withClient(async (c) => {
        await migration.afterTransaction(c);
      });
      console.log(`[+${elapsed()}] ✅ Phase 3 complete.\n`);
    } catch (err) {
      console.warn(`[+${elapsed()}] ⚠️  Phase 3 had errors — migration remains committed.`);
      console.warn('Error:', err.message);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PHASE 4 — validate()
  //  12 automated checks against live DB state (including V11 exact mutation audit).
  // ══════════════════════════════════════════════════════════════════════════
  console.log(`[+${elapsed()}] ── Phase 4: Post-migration validation (12 checks) ──`);

  if (migration.validate) {
    try {
      await withClient(async (c) => {
        await migration.validate(c);
      });
      console.log(`[+${elapsed()}] ✅ Phase 4 validation PASSED.\n`);
    } catch (err) {
      await pool.end();
      console.error(`\n[+${elapsed()}] ⚠️  Phase 4 validation FAILED — migration is COMMITTED.`);
      console.error('Validation error:', err.message);
      process.exit(2);
    }
  }

  const totalMs = Date.now() - startTime;
  await pool.end();

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log(`║  ✅ Migration 008 COMPLETE in ${(totalMs/1000).toFixed(2)}s`.padEnd(53) + '║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  process.exit(0);
}

runMigration008().catch(err => {
  console.error('Unexpected runner error:', err);
  pool.end().catch(() => {});
  process.exit(1);
});
