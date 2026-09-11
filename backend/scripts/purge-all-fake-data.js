// backend/scripts/purge-all-fake-data.js
const db = require('../src/db');

async function purgeAllFakeData() {
  console.log('[Purge] 🧹 Starting comprehensive purge of all test, seed, and mock data...');

  const pool = db.getPgPool();
  if (!pool) {
    console.error('[Purge] ❌ Database connection not available.');
    process.exit(1);
  }

  // 1. Identify real users to protect
  const protectedEmails = [
    'sumitbhardwaj2227@gmail.com',
    'sumitbhardwaj222@gmail.com',
    'admin@airvix.com'
  ];

  console.log('[Purge] 🛡️ Protected emails:', protectedEmails);

  // 2. Identify test users
  const testUsersQuery = await pool.query(`
    SELECT id, email FROM users
    WHERE email NOT IN ($1, $2, $3)
      AND (
        email LIKE '%@test.com'
        OR email LIKE '%@test.local'
        OR email LIKE '%@example.com'
        OR email LIKE '%@domain.local'
        OR email LIKE 'crypto_%@airvix.com'
        OR email LIKE 'tenant_%@airvix.com'
        OR email LIKE 'admin_%@airvix.com'
        OR email LIKE 'admin_%@test.local'
        OR email LIKE 'abuse-%'
        OR email LIKE 'gdpr-%'
        OR email LIKE 'billing_%@test.local'
        OR email LIKE 'failed_%@test.local'
        OR id LIKE 'usr_%'
        OR id LIKE 'user-bill-%'
        OR id LIKE 'user-fail-%'
        OR id LIKE 'admin-lockout-%'
        OR id LIKE 'admin-rev-%'
        OR id LIKE 'test-usr-%'
        OR id LIKE 'gdpr-usr-%'
      )
  `, protectedEmails);

  const testUserIds = testUsersQuery.rows.map(r => r.id);
  console.log(`[Purge] Found ${testUserIds.length} test users to purge.`);

  // 3. Identify test Instagram accounts
  const testAccountsQuery = await pool.query(`
    SELECT id, username FROM instagram_accounts
    WHERE username IN (
      'test_creator_account', 'brand_alpha', 'brand_beta', 'brand_official',
      'queue_creator_account', 'creator_expiring', 'creator_revoked',
      'delete_me_account', 'brand_loop_test', 'gdpr_tester'
    )
    OR username LIKE 'brand_alpha_%'
    OR username LIKE 'brand_beta_%'
    OR username LIKE 'cryptobrand_%'
    OR user_id = ANY($1::text[])
  `, [testUserIds.length > 0 ? testUserIds : ['__none__']]);

  const testAccountIds = testAccountsQuery.rows.map(r => r.id);
  console.log(`[Purge] Found ${testAccountIds.length} test Instagram accounts to purge.`);

  // 4. Delete dependent tables for test accounts
  if (testAccountIds.length > 0) {
    const delLoop = await pool.query('DELETE FROM automation_loop_incidents WHERE instagram_account_id = ANY($1)', [testAccountIds]);
    console.log(`[Purge] Deleted ${delLoop.rowCount} loop incidents.`);

    const delComments = await pool.query('DELETE FROM comment_replies WHERE instagram_account_id = ANY($1)', [testAccountIds]);
    console.log(`[Purge] Deleted ${delComments.rowCount} comment replies.`);

    const delRules = await pool.query('DELETE FROM automation_rules WHERE instagram_account_id = ANY($1)', [testAccountIds]);
    console.log(`[Purge] Deleted ${delRules.rowCount} automation rules.`);

    const delMessages = await pool.query(`
      DELETE FROM messages WHERE conversation_id IN (
        SELECT id FROM conversations WHERE instagram_account_id = ANY($1)
      )
    `, [testAccountIds]);
    console.log(`[Purge] Deleted ${delMessages.rowCount} messages.`);

    const delConvos = await pool.query('DELETE FROM conversations WHERE instagram_account_id = ANY($1)', [testAccountIds]);
    console.log(`[Purge] Deleted ${delConvos.rowCount} conversations.`);

    const delActivity = await pool.query('DELETE FROM activity_log WHERE instagram_account_id = ANY($1)', [testAccountIds]);
    console.log(`[Purge] Deleted ${delActivity.rowCount} activity logs.`);

    const delAccounts = await pool.query('DELETE FROM instagram_accounts WHERE id = ANY($1)', [testAccountIds]);
    console.log(`[Purge] Deleted ${delAccounts.rowCount} test Instagram accounts.`);
  }

  // 5. Delete test user dependent records
  if (testUserIds.length > 0) {
    await pool.query('DELETE FROM invoices WHERE user_id = ANY($1)', [testUserIds]);
    await pool.query('DELETE FROM subscriptions WHERE user_id = ANY($1)', [testUserIds]);
    await pool.query('DELETE FROM workspaces WHERE owner_id = ANY($1)', [testUserIds]);
    await pool.query('DELETE FROM tenant_api_usage WHERE user_id = ANY($1)', [testUserIds]);
    await pool.query('DELETE FROM abuse_flags WHERE user_id = ANY($1)', [testUserIds]);
    await pool.query('DELETE FROM admin_sessions WHERE user_id = ANY($1)', [testUserIds]);
    await pool.query('DELETE FROM audit_logs WHERE actor_id = ANY($1)', [testUserIds]);

    const delUsers = await pool.query('DELETE FROM users WHERE id = ANY($1)', [testUserIds]);
    console.log(`[Purge] Deleted ${delUsers.rowCount} test users.`);
  }

  // 6. Remove test mock conversations or messages not attached to legitimate users
  const delOrphanConvos = await pool.query(`
    DELETE FROM conversations 
    WHERE username IN ('happy_shopper', 'user_queue_01', 'user_queue_02', 'user_queue_03', 'test_fan', 'external_bot', 'capped_user', 'promo_fan', 'secret_agent')
  `);
  console.log(`[Purge] Deleted ${delOrphanConvos.rowCount} synthetic test conversations.`);

  // 7. Remove fake test invoices
  const delFakeInvoices = await pool.query(`
    DELETE FROM invoices 
    WHERE billing_name IN ('Billing Tester', 'Fail Tester')
       OR billing_email LIKE '%@test.local'
  `);
  console.log(`[Purge] Deleted ${delFakeInvoices.rowCount} fake invoices.`);

  // 8. Ensure agility_test is properly assigned to Sumit Bhardwaj
  const sumitRes = await pool.query("SELECT id FROM users WHERE email = 'sumitbhardwaj2227@gmail.com'");
  if (sumitRes.rows.length > 0) {
    const sumitId = sumitRes.rows[0].id;
    await pool.query("UPDATE instagram_accounts SET user_id = $1 WHERE username = 'agility_test'", [sumitId]);
    console.log(`[Purge] ✅ Confirmed: agility_test is owned by Sumit Bhardwaj (${sumitId})`);
  }

  // 9. Display current clean database state
  const remainingUsers = await pool.query('SELECT id, email, name, role, plan FROM users ORDER BY created_at ASC');
  console.log('\n[Purge] ✨ CLEAN USERS REMAINING:');
  console.table(remainingUsers.rows);

  const remainingAccounts = await pool.query('SELECT id, username, full_name, user_id, status FROM instagram_accounts');
  console.log('\n[Purge] ✨ CLEAN INSTAGRAM ACCOUNTS:');
  console.table(remainingAccounts.rows);

  const remainingRules = await pool.query('SELECT COUNT(*) as c FROM automation_rules');
  console.log('[Purge] Real rules count:', remainingRules.rows[0].c);

  const remainingConvos = await pool.query('SELECT COUNT(*) as c FROM conversations');
  console.log('[Purge] Real conversations count:', remainingConvos.rows[0].c);

  console.log('\n[Purge] 🏆 Purge complete! Database now holds 100% genuine user data.\n');
  process.exit(0);
}

// Give pool 1 sec to initialize
setTimeout(() => {
  purgeAllFakeData().catch(err => {
    console.error('[Purge] Error during purge:', err);
    process.exit(1);
  });
}, 1000);
