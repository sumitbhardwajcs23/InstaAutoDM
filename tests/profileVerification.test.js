// tests/profileVerification.test.js
const assert = require('assert');
const instagramProfileService = require('../backend/src/services/instagramProfileService');

async function runTests() {
  console.log('========================================');
  console.log('🧪 Testing Instagram Profile Verification');
  console.log('========================================');

  // Test 1: Username format validation
  console.log('\nTest 1: Validating handle formats...');
  assert.strictEqual(instagramProfileService.isValidUsername('join_sumit_'), true);
  assert.strictEqual(instagramProfileService.isValidUsername('@join_sumit_'), true);
  assert.strictEqual(instagramProfileService.isValidUsername('virat.kohli'), true);
  assert.strictEqual(instagramProfileService.isValidUsername('invalid username with spaces'), false);
  assert.strictEqual(instagramProfileService.isValidUsername('invalid!@#$%'), false);
  assert.strictEqual(instagramProfileService.isValidUsername(''), false);
  console.log('  ✅ PASS: Username format validation works');

  // Test 2: Reject non-existent handle
  console.log('\nTest 2: Rejecting non-existent handles...');
  const fakeResult = await instagramProfileService.fetchProfile('hkk');
  assert.strictEqual(fakeResult.valid, false);
  assert.ok(fakeResult.error.includes('does not exist or is unavailable'));
  console.log('  ✅ PASS: Non-existent handle "hkk" successfully rejected');

  // Test 3: Fetch authentic real profile for @join_sumit_
  console.log('\nTest 3: Fetching authentic profile for @join_sumit_...');
  const realResult = await instagramProfileService.fetchProfile('join_sumit_');
  assert.strictEqual(realResult.valid, true);
  assert.strictEqual(realResult.profile.username, 'join_sumit_');
  assert.strictEqual(realResult.profile.full_name, 'sumit bhardwaj');
  assert.strictEqual(realResult.profile.followers_count, 374); // Authentic follower count, not 4280!
  assert.ok(realResult.profile.profile_picture_url.includes('cdninstagram.com'));
  console.log('  ✅ PASS: Authentic profile @join_sumit_ fetched with real followers (374) and CDN avatar');

  console.log('\n========================================');
  console.log('🎉 All profile verification tests passed!');
  console.log('========================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
