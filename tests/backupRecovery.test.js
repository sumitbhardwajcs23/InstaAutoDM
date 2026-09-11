/**
 * Automated Test Suite: Backup & Disaster Recovery
 * Verifies AES-256-GCM encryption/decryption symmetry, SHA-256 checksum integrity,
 * JSON metadata manifest generation, dry-run transactional restore, and tamper detection.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { runBackup, encryptBuffer, exportDatabaseData, BACKUP_DIR } = require('../backend/src/scripts/backupDb');
const { restoreBackup, decryptBuffer } = require('../backend/src/scripts/restoreDb');
const { ENCRYPTION_KEY } = require('../backend/src/config/secrets');
const db = require('../backend/src/db');

async function runTests() {
  console.log('🧪 Starting Backup & Disaster Recovery Test Suite...\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  await db.ready();

  // Test 1: AES-256-GCM Encryption / Decryption Round-Trip
  await test('AES-256-GCM encryption and decryption round-trip correctly', async () => {
    const originalText = 'Airvix Secret Tenant Data ' + crypto.randomBytes(32).toString('hex');
    const originalBuffer = Buffer.from(originalText, 'utf8');

    const encrypted = encryptBuffer(originalBuffer, ENCRYPTION_KEY);
    assert.strictEqual(typeof encrypted.iv, 'string', 'iv should be a string');
    assert.strictEqual(typeof encrypted.authTag, 'string', 'authTag should be a string');
    assert.strictEqual(typeof encrypted.ciphertext, 'string', 'ciphertext should be a string');
    assert.strictEqual(encrypted.iv.length, 32, 'IV should be 16 bytes = 32 hex chars');

    const decryptedBuffer = decryptBuffer(encrypted, ENCRYPTION_KEY);
    assert.strictEqual(decryptedBuffer.toString('utf8'), originalText);
  });

  // Test 2: Decryption Failure on Tampered Ciphertext
  await test('Rejects tampered ciphertext with authentication tag failure', async () => {
    const originalBuffer = Buffer.from('Sensitive Information', 'utf8');
    const encrypted = encryptBuffer(originalBuffer, ENCRYPTION_KEY);

    // Tamper with ciphertext by flipping bits
    const tamperedCiphertext = Buffer.from(encrypted.ciphertext, 'base64');
    tamperedCiphertext[0] ^= 0xFF;
    const tamperedObj = {
      ...encrypted,
      ciphertext: tamperedCiphertext.toString('base64')
    };

    let threw = false;
    try {
      decryptBuffer(tamperedObj, ENCRYPTION_KEY);
    } catch (err) {
      threw = true;
    }
    assert.strictEqual(threw, true, 'Decryption must fail when ciphertext is tampered');
  });

  // Test 3: Export Database Data Structure
  await test('Exports valid serializable JSON representation of database tables', async () => {
    const dump = await exportDatabaseData();
    assert.strictEqual(typeof dump, 'object', 'dump should be an object');
    assert.strictEqual(typeof dump.tables, 'object', 'dump.tables should be an object');
    assert.strictEqual(typeof dump.timestamp, 'string', 'dump.timestamp should be a string');
    assert.ok('users' in dump.tables, 'Expected users table in dump');
  });

  // Test 4: Automated Encrypted Backup Run
  let generatedEncFile = null;
  let generatedManifestFile = null;
  let generatedChecksum = null;

  await test('Generates encrypted backup archive and SHA-256 metadata manifest', async () => {
    const result = await runBackup();
    assert.ok(result.backupFile, 'result.backupFile must be defined');
    assert.ok(result.manifestFile, 'result.manifestFile must be defined');
    assert.strictEqual(result.algorithm, 'aes-256-gcm', 'algorithm should be aes-256-gcm');
    assert.strictEqual(typeof result.checksum, 'string', 'checksum should be a string');
    assert.strictEqual(result.checksum.length, 64, 'checksum should be 64-char SHA-256 hex');

    generatedEncFile = result.backupFile;
    generatedManifestFile = result.manifestFile;
    generatedChecksum = result.checksum;

    assert.ok(fs.existsSync(generatedEncFile), 'Encrypted backup file must exist on disk');
    assert.ok(fs.existsSync(generatedManifestFile), 'Manifest file must exist on disk');

    const manifest = JSON.parse(fs.readFileSync(generatedManifestFile, 'utf8'));
    assert.strictEqual(manifest.checksum_sha256, generatedChecksum, 'Manifest checksum must match result.checksum');
    assert.strictEqual(manifest.algorithm, 'aes-256-gcm', 'Manifest algorithm should be aes-256-gcm');
    assert.ok(manifest.table_count > 0, 'Manifest must record at least 1 table');
  });

  // Test 5: Dry-Run Restoration & Checksum Validation
  await test('Validates SHA-256 checksum and decrypts backup successfully in dry-run mode', async () => {
    assert.ok(generatedEncFile, 'Requires backup file from Test 4');
    const result = await restoreBackup(generatedEncFile, { dryRun: true });
    assert.strictEqual(result.dryRun, true, 'dryRun must be true');
    assert.ok(result.tableCount > 0, 'tableCount must be > 0');
    assert.ok(result.totalRows >= 0, 'totalRows must be >= 0');
  });

  // Test 6: Tampered Manifest Checksum Rejection
  await test('Rejects restoration if manifest SHA-256 checksum does not match payload', async () => {
    assert.ok(generatedEncFile, 'Requires backup file from Test 4');

    const tempDir = path.dirname(generatedEncFile);
    const baseName = `tamper_test_${Date.now()}`;
    const mockEncPath = path.join(tempDir, `${baseName}.enc.json`);
    const mockManifestPath = path.join(tempDir, `${baseName}.manifest.json`);

    fs.copyFileSync(generatedEncFile, mockEncPath);
    const manifest = JSON.parse(fs.readFileSync(generatedManifestFile, 'utf8'));
    // Deliberately corrupt the stored checksum
    manifest.checksum_sha256 = '0000000000000000000000000000000000000000000000000000000000000000';
    manifest.backup_file = `${baseName}.enc.json`;
    fs.writeFileSync(mockManifestPath, JSON.stringify(manifest, null, 2));

    let threw = false;
    try {
      await restoreBackup(mockEncPath, { dryRun: true });
    } catch (err) {
      threw = true;
    }

    if (fs.existsSync(mockEncPath)) fs.unlinkSync(mockEncPath);
    if (fs.existsSync(mockManifestPath)) fs.unlinkSync(mockManifestPath);

    assert.strictEqual(threw, true, 'Restore must fail when manifest checksum is tampered');
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
