/**
 * Database Migration & Rollback Engine
 * Provides deterministic versioned database migrations, checksum validation,
 * transactional execution, and rollback capabilities.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const db = require('./index');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

class Migrator {
  constructor(migrationsDir = MIGRATIONS_DIR) {
    this.migrationsDir = migrationsDir;
  }

  async init() {
    await db.ready();
    const pool = db.getPgPool();
    if (!pool) throw new Error('Database connection pool unavailable.');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        execution_time_ms INTEGER NOT NULL
      );
    `);
  }

  /**
   * Get all migration files from the migrations directory ordered by version
   */
  getMigrationFiles() {
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.js'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return files.map(file => {
      const parts = file.split('_');
      const version = parts[0];
      const name = file.replace(`${version}_`, '').replace('.js', '');
      const filePath = path.join(this.migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');

      return {
        file,
        filePath,
        version,
        name,
        checksum,
        module: require(filePath)
      };
    });
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations() {
    await this.init();
    const pool = db.getPgPool();
    const res = await pool.query('SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version ASC');
    return res.rows || [];
  }

  /**
   * Status of all migrations
   */
  async status() {
    await this.init();
    const files = this.getMigrationFiles();
    const applied = await this.getAppliedMigrations();
    const appliedMap = new Map(applied.map(m => [m.version, m]));

    return files.map(m => {
      const isApplied = appliedMap.has(m.version);
      const record = appliedMap.get(m.version);
      const checksumMatch = isApplied ? record.checksum === m.checksum : null;

      return {
        version: m.version,
        name: m.name,
        applied: isApplied,
        applied_at: isApplied ? record.applied_at : null,
        checksumMatch
      };
    });
  }

  /**
   * Apply all pending migrations in forward sequence
   */
  async up() {
    await this.init();
    const pool = db.getPgPool();
    const files = this.getMigrationFiles();
    const applied = await this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map(a => a.version));

    // Verify integrity of already applied migrations
    for (const app of applied) {
      const file = files.find(f => f.version === app.version);
      if (file && file.checksum !== app.checksum) {
        console.warn(`[Migrator] ⚠️ Checksum mismatch on version ${app.version} (${app.name})! File was modified after being applied.`);
      }
    }

    const pending = files.filter(f => !appliedVersions.has(f.version));
    if (pending.length === 0) {
      console.log('[Migrator] ✨ Database is up to date. No pending migrations.');
      return [];
    }

    console.log(`[Migrator] 🚀 Applying ${pending.length} pending migration(s)...`);
    const executed = [];

    for (const m of pending) {
      const client = await pool.connect();
      const start = Date.now();
      try {
        console.log(`[Migrator]   ▶ Applying ${m.version}: ${m.name}...`);
        await client.query('BEGIN');
        await m.module.up(client);
        const duration = Date.now() - start;

        await client.query(`
          INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
          VALUES ($1, $2, $3, $4)
        `, [m.version, m.name, m.checksum, duration]);

        await client.query('COMMIT');
        console.log(`[Migrator]   ✅ Completed ${m.version} in ${duration}ms.`);
        executed.push({ version: m.version, name: m.name, duration });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migrator]   ❌ Migration ${m.version} failed:`, err.message);
        throw err;
      } finally {
        client.release();
      }
    }

    return executed;
  }

  /**
   * Rollback the most recently applied migration
   */
  async down() {
    await this.init();
    const pool = db.getPgPool();
    const applied = await this.getAppliedMigrations();

    if (applied.length === 0) {
      console.log('[Migrator] ℹ️ No migrations have been applied to roll back.');
      return null;
    }

    const last = applied[applied.length - 1];
    const files = this.getMigrationFiles();
    const file = files.find(f => f.version === last.version);

    if (!file) {
      throw new Error(`Migration file for version ${last.version} not found in directory.`);
    }

    if (typeof file.module.down !== 'function') {
      throw new Error(`Migration ${last.version} (${last.name}) does not implement a down() rollback function.`);
    }

    const client = await pool.connect();
    console.log(`[Migrator] ⏪ Rolling back migration ${last.version}: ${last.name}...`);
    try {
      await client.query('BEGIN');
      await file.module.down(client);
      await client.query('DELETE FROM schema_migrations WHERE version = $1', [last.version]);
      await client.query('COMMIT');
      console.log(`[Migrator]   ✅ Rolled back ${last.version} successfully.`);
      return { version: last.version, name: last.name };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[Migrator]   ❌ Rollback failed:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  }
}

const migrator = new Migrator();

if (require.main === module) {
  const command = process.argv[2] || 'status';

  (async () => {
    if (command === 'up') {
      await migrator.up();
    } else if (command === 'down') {
      await migrator.down();
    } else if (command === 'status') {
      const stats = await migrator.status();
      console.log('\nMigration Status:');
      console.table(stats);
    } else {
      console.error(`Unknown command: ${command}. Use 'up', 'down', or 'status'.`);
      process.exit(1);
    }
    process.exit(0);
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  Migrator,
  migrator
};
