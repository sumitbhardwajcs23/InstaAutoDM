/**
 * Automated Test Suite: Database Migration & Rollback Framework
 * Verifies versioning, SHA-256 checksum tracking, forward migration (up),
 * reversible rollback (down), and schema idempotency.
 */

const assert = require('assert');
const path = require('path');
const { migrator } = require('../backend/src/db/migrator');
const db = require('../backend/src/db');

async function runTests() {
  console.log('🧪 Starting Database Migration & Rollback Framework Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}`);
        failed++;
      }
    })();
  }

  // Ensure DB ready
  await db.ready();
  const pool = db.getPgPool();
  if (!pool) {
    console.error('Fatal: Database connection pool unavailable.');
    process.exit(1);
  }

  // Test 1: Discover Migration Files
  await test('Discovers all migration files (001 to 005) with valid structure', async () => {
    const files = migrator.getMigrationFiles();
    assert.strictEqual(files.length >= 5, true, `Expected at least 5 migration files, found ${files.length}`);
    
    const versions = files.map(f => f.version);
    assert.ok(versions.includes('001'), 'Missing 001_initial_schema');
    assert.ok(versions.includes('002'), 'Missing 002_webhook_reliability_dlq');
    assert.ok(versions.includes('003'), 'Missing 003_saas_billing_subscriptions');
    assert.ok(versions.includes('004'), 'Missing 004_admin_security_mfa_sessions');
    assert.ok(versions.includes('005'), 'Missing 005_observability_telemetry');

    // Verify SHA-256 checksum format
    for (const f of files) {
      assert.strictEqual(typeof f.checksum, 'string', 'Checksum should be string');
      assert.strictEqual(f.checksum.length, 64, 'Checksum must be 64-char hex SHA-256');
      assert.strictEqual(typeof f.module.up, 'function', `${f.file} must export up()`);
      assert.strictEqual(typeof f.module.down, 'function', `${f.file} must export down()`);
    }
  });

  // Test 2: Migration Status Reporting
  await test('Reports migration status including checksum verification', async () => {
    const status = await migrator.status();
    assert.strictEqual(Array.isArray(status), true);
    assert.strictEqual(status.length >= 5, true);
    for (const s of status) {
      assert.ok('version' in s);
      assert.ok('name' in s);
      assert.ok('applied' in s);
    }
  });

  // Test 3: Forward Migration (up)
  await test('Applies all pending migrations transactionally with schema_migrations tracking', async () => {
    const executed = await migrator.up();
    assert.ok(Array.isArray(executed));

    // Verify schema_migrations table has rows
    const res = await pool.query('SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version ASC');
    const appliedVersions = res.rows.map(r => r.version);
    assert.ok(appliedVersions.includes('001'));
    assert.ok(appliedVersions.includes('002'));
    assert.ok(appliedVersions.includes('003'));
    assert.ok(appliedVersions.includes('004'));
    assert.ok(appliedVersions.includes('005'));
  });

  // Test 4: Verify Migrated Tables Exist
  await test('Verifies all required tables from migrations exist in the database', async () => {
    const expectedTables = [
      'users',
      'instagram_accounts',
      'automation_rules',
      'conversations',
      'messages',
      'activity_log',
      'workspaces',
      'audit_logs',
      'webhook_events',
      'dead_letter_queue',
      'subscriptions',
      'invoices',
      'payment_webhook_events',
      'admin_sessions',
      'system_alerts',
      'error_events',
      'data_deletion_requests',
      'automation_loop_incidents'
    ];

    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tableNames = new Set(res.rows.map(r => r.table_name));

    for (const table of expectedTables) {
      assert.ok(tableNames.has(table), `Expected table '${table}' to exist in database`);
    }
  });

  // Test 5: Reversible Rollback (down)
  await test('Rolls back the most recent migration (005) cleanly and updates schema_migrations', async () => {
    // Current state: 005 applied
    const beforeApplied = await migrator.getAppliedMigrations();
    assert.strictEqual(beforeApplied[beforeApplied.length - 1].version, '005');

    // Rollback 005
    const rolledBack = await migrator.down();
    assert.strictEqual(rolledBack.version, '005');

    // Verify 005 is no longer in schema_migrations
    const afterApplied = await migrator.getAppliedMigrations();
    assert.strictEqual(afterApplied.some(m => m.version === '005'), false);

    // Re-apply 005 so DB remains at latest schema
    const reapplied = await migrator.up();
    assert.strictEqual(reapplied.length, 1);
    assert.strictEqual(reapplied[0].version, '005');

    // Confirm 005 is applied again
    const finalApplied = await migrator.getAppliedMigrations();
    assert.strictEqual(finalApplied[finalApplied.length - 1].version, '005');
  });

  // Test 6: Idempotent Execution
  await test('Re-running migrator.up() when fully applied is a safe no-op', async () => {
    const executed = await migrator.up();
    assert.strictEqual(executed.length, 0, 'Should not apply any migrations when already current');
  });

  console.log(`\n🏁 Test Run Completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
