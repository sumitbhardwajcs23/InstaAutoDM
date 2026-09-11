/**
 * Automated Database Restore Script
 * Decrypts AES-256-GCM encrypted database snapshots, validates SHA-256
 * integrity checksums against manifests, and restores tables transactionally.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const db = require('../db');
const { ENCRYPTION_KEY } = require('../config/secrets');
const { BACKUP_DIR } = require('./backupDb');

/**
 * Derive a 32-byte AES-256 key from any-length key material via SHA-256 (matches backupDb.js).
 */
function deriveKey(keyMaterial) {
  return crypto.createHash('sha256').update(Buffer.from(keyMaterial, 'utf8')).digest();
}

/**
 * Decrypt an AES-256-GCM encrypted backup payload
 */
function decryptBuffer(encryptedObj, keyHex = ENCRYPTION_KEY) {
  const key = deriveKey(keyHex);
  const iv = Buffer.from(encryptedObj.iv, 'hex');
  const authTag = Buffer.from(encryptedObj.authTag, 'hex');
  const ciphertext = Buffer.from(encryptedObj.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Executes restoration of an encrypted backup file
 */
async function restoreBackup(backupFilePath, options = { dryRun: false }) {
  await db.ready();
  const pool = db.getPgPool();
  if (!pool) throw new Error('PostgreSQL connection pool unavailable.');

  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found: ${backupFilePath}`);
  }

  // Look for corresponding manifest file
  const dir = path.dirname(backupFilePath);
  const baseName = path.basename(backupFilePath).replace('.enc.json', '');
  const manifestPath = path.join(dir, `${baseName}.manifest.json`);

  let expectedChecksum = null;
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expectedChecksum = manifest.checksum_sha256;
  }

  console.log(`[Restore] 🔓 Decrypting backup file: ${path.basename(backupFilePath)}...`);
  const encryptedObj = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
  const compressedBuffer = decryptBuffer(encryptedObj);

  // Validate SHA-256 checksum if manifest exists
  if (expectedChecksum) {
    const actualChecksum = crypto.createHash('sha256').update(compressedBuffer).digest('hex');
    if (actualChecksum !== expectedChecksum) {
      throw new Error(`Integrity Check Failed! Expected SHA-256: ${expectedChecksum}, Actual: ${actualChecksum}`);
    }
    console.log(`[Restore] ✅ SHA-256 integrity checksum verified: ${actualChecksum.slice(0, 16)}...`);
  }

  // Decompress JSON
  const decompressed = zlib.gunzipSync(compressedBuffer);
  const dump = JSON.parse(decompressed.toString('utf8'));

  const tableNames = Object.keys(dump.tables);
  console.log(`[Restore] 📊 Found ${tableNames.length} tables to restore.`);

  if (options.dryRun) {
    const totalRows = Object.values(dump.tables).reduce((sum, rows) => sum + (rows ? rows.length : 0), 0);
    console.log(`[Restore] 🔍 Dry run mode: verification succeeded without modifying database.`);
    return { success: true, dryRun: true, tableCount: tableNames.length, totalRows, tables: tableNames, manifest: dump };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(`[Restore] ⏳ Restoring tables in transactional batch...`);

    // In dependency order, populate data
    for (const tableName of tableNames) {
      const rows = dump.tables[tableName];
      if (!rows || rows.length === 0) continue;

      // Clean existing rows before re-populating (preserve schema)
      await client.query(`TRUNCATE TABLE "${tableName}" CASCADE`);

      for (const row of rows) {
        const cols = Object.keys(row);
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const values = cols.map(c => row[c]);
        const sql = `INSERT INTO "${tableName}" ("${cols.join('", "')}") VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        await client.query(sql, values);
      }
      console.log(`[Restore]   ✓ Restored ${rows.length} records into table: ${tableName}`);
    }

    await client.query('COMMIT');
    console.log(`[Restore] 🎉 Database successfully restored from backup!`);
    return { success: true, restoredTables: tableNames.length };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Restore] ❌ Restoration failed and was safely rolled back:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const targetFile = process.argv[2];
  if (!targetFile) {
    console.error('Usage: node restoreDb.js <path-to-backup.enc.json> [--dry-run]');
    process.exit(1);
  }
  const isDryRun = process.argv.includes('--dry-run');
  restoreBackup(targetFile, { dryRun: isDryRun })
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = {
  restoreBackup,
  decryptBuffer
};
