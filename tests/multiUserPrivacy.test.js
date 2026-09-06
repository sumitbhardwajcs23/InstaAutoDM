// tests/multiUserPrivacy.test.js
const assert = require('assert');
const http = require('http');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

process.env.NODE_ENV = 'test';
process.env.META_MOCK_MODE = 'true';

const app = require('../backend/src/server');
const db = require('../backend/src/db');
const { encrypt } = require('../backend/src/services/crypto');

async function run() {
  console.log('====================================================');
  console.log('🔒 Testing Multi-User Tenant Isolation & Data Privacy');
  console.log('====================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // ---------------------------------------------------------------
    // 1. Register User A & User B
    // ---------------------------------------------------------------
    const emailA = `alice_${Date.now()}@privacy.test`;
    const emailB = `bob_${Date.now()}@privacy.test`;
    const password = 'Password123!';

    console.log('Step 1: Registering User A (Alice) and User B (Bob)...');
    const resA = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailA, password, name: 'Alice Creator' })
    });
    const dataA = await resA.json();
    assert.strictEqual(resA.status, 201, 'User A should register successfully');
    const tokenA = dataA.token;
    const userA = dataA.user;

    const resB = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailB, password, name: 'Bob Creator' })
    });
    const dataB = await resB.json();
    assert.strictEqual(resB.status, 201, 'User B should register successfully');
    const tokenB = dataB.token;
    const userB = dataB.user;
    console.log('  ✅ PASS: Both users registered with unique credentials and tokens.');

    // ---------------------------------------------------------------
    // 2. Connect Instagram Account to User A
    // ---------------------------------------------------------------
    console.log('\nStep 2: Connecting Instagram Account to User A...');
    const accAId = uuidv4();
    const now = new Date().toISOString();
    const mockToken = `EAAB_secret_token_${Date.now()}`;
    await db.prepare(`
      INSERT INTO instagram_accounts (
        id, user_id, ig_user_id, username, full_name, page_id, fb_page_name, fb_user_id,
        access_token_enc, page_access_token_enc, long_lived_token_enc,
        token_expires_at, status, followers_count, created_at, updated_at
      ) VALUES (?, ?, ?, 'alice_brand', 'Alice Brand Official', 'page_alice', 'Alice Page', 'fb_alice',
        ?, ?, ?, ?, 'connected', 12500, ?, ?)
    `).run(
      accAId, userA.id, `ig_alice_${Date.now()}`,
      encrypt(mockToken), encrypt(mockToken), encrypt(mockToken),
      new Date(Date.now() + 60 * 86400000).toISOString(), now, now
    );

    // ---------------------------------------------------------------
    // 3. Token Sanitization: Verify User A's API responses NEVER contain tokens
    // ---------------------------------------------------------------
    console.log('\nStep 3: Checking Token Sanitization in GET /api/instagram/account...');
    const accResA = await fetch(`${baseUrl}/api/instagram/account`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const accDataA = await accResA.json();
    assert.strictEqual(accDataA.connected, true);
    assert.strictEqual(accDataA.account.username, 'alice_brand');

    // CRITICAL DATA PRIVACY CHECK:
    assert.strictEqual(accDataA.account.access_token_enc, undefined, 'access_token_enc MUST NOT be sent to client');
    assert.strictEqual(accDataA.account.page_access_token_enc, undefined, 'page_access_token_enc MUST NOT be sent to client');
    assert.strictEqual(accDataA.account.long_lived_token_enc, undefined, 'long_lived_token_enc MUST NOT be sent to client');
    assert.strictEqual(accDataA.account.has_access_token, true, 'has_access_token flag should be true');
    console.log('  ✅ PASS: Tokens are stripped from client response; safe flags returned.');

    // ---------------------------------------------------------------
    // 4. Multi-Tenant Isolation: User B cannot see User A's Account
    // ---------------------------------------------------------------
    console.log('\nStep 4: Verifying User B cannot access User A\'s Instagram account...');
    const accResB = await fetch(`${baseUrl}/api/instagram/account`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    const accDataB = await accResB.json();
    assert.strictEqual(accDataB.connected, false, 'User B must not see User A connected account');
    assert.strictEqual(accDataB.account, null, 'User B account must be null');

    const accountsResB = await fetch(`${baseUrl}/api/instagram/accounts`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    const accountsDataB = await accountsResB.json();
    assert.strictEqual(accountsDataB.accounts.length, 0, 'User B must have 0 accounts');
    console.log('  ✅ PASS: Strict account isolation enforced between tenants.');

    // ---------------------------------------------------------------
    // 5. Multi-Tenant Rule Authorization: User B cannot mutate User A's rule
    // ---------------------------------------------------------------
    console.log('\nStep 5: Creating rule for User A and attempting mutation by User B...');
    const ruleResA = await fetch(`${baseUrl}/api/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
      body: JSON.stringify({
        account_id: accAId,
        type: 'dm_keyword_reply',
        trigger_keyword: 'PRICE',
        reply_message: 'Our pricing is $49/mo'
      })
    });
    const ruleDataA = await ruleResA.json();
    assert.strictEqual(ruleResA.status, 201, 'Rule should be created for User A');
    const ruleId = ruleDataA.id;

    // Bob attempts to toggle Alice's rule
    const bobHackRes = await fetch(`${baseUrl}/api/rules/${ruleId}/toggle`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    assert.strictEqual(bobHackRes.status, 404, 'User B mutating User A rule must be rejected with 404');
    console.log('  ✅ PASS: Cross-tenant rule tampering prevented with 404 Not Found.');

    // ---------------------------------------------------------------
    // 6. GDPR Data Portability: GET /api/auth/export-data
    // ---------------------------------------------------------------
    console.log('\nStep 6: Testing GDPR Data Portability (Export My Data)...');
    const exportResA = await fetch(`${baseUrl}/api/auth/export-data`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert.strictEqual(exportResA.status, 200, 'Export data should return 200');
    const exportBundle = await exportResA.json();
    assert.strictEqual(exportBundle.user.email, emailA);
    assert.strictEqual(exportBundle.user.password_hash, undefined, 'Export must not leak password hash');
    assert.strictEqual(exportBundle.instagram_accounts.length, 1);
    assert.strictEqual(exportBundle.instagram_accounts[0].username, 'alice_brand');
    assert.strictEqual(exportBundle.instagram_accounts[0].access_token_enc, undefined, 'Export must never leak access tokens');
    assert.strictEqual(exportBundle.automation_rules.length, 1);
    assert.strictEqual(exportBundle.automation_rules[0].trigger_keyword, 'PRICE');
    console.log('  ✅ PASS: Complete GDPR Article 20 data bundle exported with secrets redacted.');

    // ---------------------------------------------------------------
    // 7. Gateway Security: Unauthenticated connect-mock must be rejected
    // ---------------------------------------------------------------
    console.log('\nStep 7: Testing unauthenticated account connection attempt...');
    const noAuthRes = await fetch(`${baseUrl}/api/instagram/connect-mock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'hacker_account' })
    });
    assert.strictEqual(noAuthRes.status, 401, 'Unauthenticated connection must return 401 Unauthorized');
    console.log('  ✅ PASS: Unauthenticated connection rejected at gateway.');

    // ---------------------------------------------------------------
    // 8. GDPR Right to Erasure: DELETE /api/auth/me
    // ---------------------------------------------------------------
    console.log('\nStep 8: Testing GDPR Right to Erasure (Delete Account & All Data)...');
    const delResA = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert.strictEqual(delResA.status, 200, 'Account deletion should succeed with 200');

    // Verify User A is deleted from DB
    const checkUserA = await db.prepare('SELECT id FROM users WHERE id = ?').get(userA.id);
    assert.strictEqual(checkUserA, undefined, 'User A must be completely removed from users table');

    // Verify User A's Instagram account is cascaded
    const checkAccA = await db.prepare('SELECT id FROM instagram_accounts WHERE user_id = ?').get(userA.id);
    assert.strictEqual(checkAccA, undefined, 'User A connected account must be cascade-deleted');

    // Verify User A's rules are cascaded
    const checkRuleA = await db.prepare('SELECT id FROM automation_rules WHERE id = ?').get(ruleId);
    assert.strictEqual(checkRuleA, undefined, 'User A automation rule must be cascade-deleted');

    // Verify User B is completely intact
    const checkUserB = await db.prepare('SELECT id, email FROM users WHERE id = ?').get(userB.id);
    assert.strictEqual(checkUserB?.email, emailB, 'User B must remain completely intact');
    console.log('  ✅ PASS: User A erased with clean cascade; User B data preserved.');

    // ---------------------------------------------------------------
    // 9. Meta Compliance: /data-deletion-status
    // ---------------------------------------------------------------
    console.log('\nStep 9: Testing Meta Data Deletion status check...');
    const delStatusRes = await fetch(`${baseUrl}/data-deletion-status?id=del_12345`);
    assert.strictEqual(delStatusRes.status, 200);
    const htmlText = await delStatusRes.text();
    assert.strictEqual(htmlText.includes('Data Deletion Request Processed'), true);
    console.log('  ✅ PASS: Meta data deletion status endpoint returned confirmation page.');

    console.log('\n====================================================');
    console.log('🎉 ALL 9 MULTI-USER & DATA PRIVACY TESTS PASSED 100%');
    console.log('====================================================');
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
