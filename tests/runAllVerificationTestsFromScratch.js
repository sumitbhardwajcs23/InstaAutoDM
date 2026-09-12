// tests/runAllVerificationTestsFromScratch.js
const path = require('path');
const { spawn } = require('child_process');

process.env.NODE_ENV = 'test';

const testFiles = [
  'adminPlanSyncAndLimits.test.js',
  'verifyBillingSystemEndToEnd.test.js',
  'planLimits.test.js',
  'billingAndSubscription.test.js',
  'autoReply.test.js',
  'abuseDetection.test.js',
  'adminSecurity.test.js',
  'followerCheck.test.js',
  'isolationVerification.test.js',
  'mediaAndTargeting.test.js',
  'metaPrerequisitesAndLoopSafety.test.js',
  'multiTenantSecurity.test.js',
  'multiUserPrivacy.test.js',
  'observability.test.js',
  'queueArchitecture.test.js',
  'rateLimiter.test.js',
  'saasIsolation.test.js',
  'secretAndTokenEncryption.test.js',
  'securityAudit.test.js',
  'securityHeaders.test.js',
  'tenantAuthz.test.js',
  'tokenLifecycleAndMetaCompliance.test.js',
  'webhookReliability.test.js'
];

async function runSingleTest(file) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const filePath = path.join(__dirname, file);
    const proc = spawn(process.execPath, [filePath], {
      cwd: path.join(__dirname, '..'),
      env: process.env
    });

    let output = '';
    proc.stdout.on('data', (d) => { output += d.toString(); });
    proc.stderr.on('data', (d) => { output += d.toString(); });

    proc.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      resolve({
        file,
        code,
        duration,
        output
      });
    });
  });
}

async function runAllFromScratch() {
  console.log('================================================================');
  console.log('🚀 Starting Complete System-Wide Verification From Scratch');
  console.log(`📋 Total Test Suites to Execute: ${testFiles.length}`);
  console.log('================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  for (const file of testFiles) {
    process.stdout.write(` Running [${file}]... `);
    const res = await runSingleTest(file);
    if (res.code === 0) {
      console.log(`✅ PASSED (${res.duration}s)`);
      passedCount++;
    } else {
      console.log(`❌ FAILED (${res.duration}s)`);
      console.error(`\n--- Error Output for ${file} ---`);
      console.error(res.output);
      console.error(`-----------------------------------\n`);
      failedCount++;
    }
  }

  console.log('\n================================================================');
  console.log(`🏁 Complete Verification Summary: ${passedCount} Passed, ${failedCount} Failed out of ${testFiles.length} Test Suites`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllFromScratch().catch(err => {
  console.error('Master runner failed:', err);
  process.exit(1);
});
