// backend/src/db/migrateCascadeAndSSOT.js
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  require('dotenv').config();
} catch (e) {}

const { Client } = require('pg');

async function applyCascadeAndSSOT() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is required');
  }

  console.log('[Cascade & SSOT Migration] Connecting to Neon / PostgreSQL...');
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('[Cascade & SSOT Migration] ✅ Connected to PostgreSQL database.');

  // 1. Alter foreign keys to support ON UPDATE CASCADE
  console.log('[Cascade & SSOT Migration] Updating Foreign Keys to ON UPDATE CASCADE ON DELETE CASCADE...');

  const foreignKeyDefinitions = [
    {
      table: 'instagram_accounts',
      constraint: 'instagram_accounts_user_id_fkey',
      sql: `ALTER TABLE instagram_accounts DROP CONSTRAINT IF EXISTS instagram_accounts_user_id_fkey;
            ALTER TABLE instagram_accounts ADD CONSTRAINT instagram_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;`
    },
    {
      table: 'automation_rules',
      constraint: 'automation_rules_instagram_account_id_fkey',
      sql: `ALTER TABLE automation_rules DROP CONSTRAINT IF EXISTS automation_rules_instagram_account_id_fkey;
            ALTER TABLE automation_rules ADD CONSTRAINT automation_rules_instagram_account_id_fkey FOREIGN KEY (instagram_account_id) REFERENCES instagram_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;`
    },
    {
      table: 'conversations',
      constraint: 'conversations_instagram_account_id_fkey',
      sql: `ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_instagram_account_id_fkey;
            ALTER TABLE conversations ADD CONSTRAINT conversations_instagram_account_id_fkey FOREIGN KEY (instagram_account_id) REFERENCES instagram_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;`
    },
    {
      table: 'messages',
      constraint: 'messages_conversation_id_fkey',
      sql: `ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;
            ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON UPDATE CASCADE ON DELETE CASCADE;`
    },
    {
      table: 'activity_log',
      constraint: 'activity_log_instagram_account_id_fkey',
      sql: `ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_instagram_account_id_fkey;
            ALTER TABLE activity_log ADD CONSTRAINT activity_log_instagram_account_id_fkey FOREIGN KEY (instagram_account_id) REFERENCES instagram_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;`
    },
    {
      table: 'workspaces',
      constraint: 'workspaces_owner_id_fkey',
      sql: `ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_owner_id_fkey;
            ALTER TABLE workspaces ADD CONSTRAINT workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;`
    },
    {
      table: 'subscriptions',
      constraint: 'subscriptions_user_id_fkey',
      sql: `ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
            ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;`
    },
    {
      table: 'invoices',
      constraint: 'invoices_user_id_fkey',
      sql: `ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_user_id_fkey;
            ALTER TABLE invoices ADD CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;`
    },
    {
      table: 'invoices',
      constraint: 'invoices_subscription_id_fkey',
      sql: `ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_subscription_id_fkey;
            ALTER TABLE invoices ADD CONSTRAINT invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON UPDATE CASCADE ON DELETE SET NULL;`
    },
    {
      table: 'comment_replies',
      constraint: 'comment_replies_instagram_account_id_fkey',
      sql: `ALTER TABLE comment_replies DROP CONSTRAINT IF EXISTS comment_replies_instagram_account_id_fkey;
            ALTER TABLE comment_replies ADD CONSTRAINT comment_replies_instagram_account_id_fkey FOREIGN KEY (instagram_account_id) REFERENCES instagram_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;`
    },
    {
      table: 'comment_replies',
      constraint: 'comment_replies_automation_rule_id_fkey',
      sql: `ALTER TABLE comment_replies DROP CONSTRAINT IF EXISTS comment_replies_automation_rule_id_fkey;
            ALTER TABLE comment_replies ADD CONSTRAINT comment_replies_automation_rule_id_fkey FOREIGN KEY (automation_rule_id) REFERENCES automation_rules(id) ON UPDATE CASCADE ON DELETE SET NULL;`
    },
    {
      table: 'data_requests',
      constraint: 'data_requests_user_id_fkey',
      sql: `ALTER TABLE data_requests DROP CONSTRAINT IF EXISTS data_requests_user_id_fkey;
            ALTER TABLE data_requests ADD CONSTRAINT data_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;`
    },
    {
      table: 'password_resets',
      constraint: 'password_resets_user_id_fkey',
      sql: `ALTER TABLE password_resets DROP CONSTRAINT IF EXISTS password_resets_user_id_fkey;
            ALTER TABLE password_resets ADD CONSTRAINT password_resets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;`
    }
  ];

  for (const fk of foreignKeyDefinitions) {
    try {
      await client.query(fk.sql);
      console.log(`  ✅ ${fk.table}.${fk.constraint} updated to CASCADE UPDATE.`);
    } catch (err) {
      console.warn(`  ⚠️ Could not update constraint on ${fk.table}:`, err.message);
    }
  }

  // 2. Data Normalization & SSOT Synchronization
  console.log('[Cascade & SSOT Migration] Synchronizing Single Source of Truth (SSOT)...');

  // A. Normalize Workspaces: ensure every user has a default normalized workspace
  const usersRes = await client.query('SELECT id, email, name, plan FROM users');
  for (const u of usersRes.rows) {
    const wsId = `ws_${u.id.replace(/-/g, '').slice(0, 12)}`;
    const wsName = `${u.name || u.email.split('@')[0]}'s Workspace`;
    await client.query(`
      INSERT INTO workspaces (id, name, owner_id, status, created_at)
      VALUES ($1, $2, $3, 'active', to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, owner_id = EXCLUDED.owner_id;
    `, [wsId, wsName, u.id]);

    // B. Normalize Subscriptions: ensure subscriptions.plan matches users.plan as SSOT
    const subRes = await client.query('SELECT id, plan FROM subscriptions WHERE user_id = $1 LIMIT 1', [u.id]);
    if (subRes.rows.length === 0) {
      const newSubId = `sub_${u.id.replace(/-/g, '').slice(0, 12)}`;
      await client.query(`
        INSERT INTO subscriptions (
          id, user_id, plan, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at
        ) VALUES ($1, $2, $3, 'active', 'monthly', to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW() + interval '30 days', 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      `, [newSubId, u.id, u.plan || 'free']);
    } else {
      // Synchronize plan
      await client.query('UPDATE subscriptions SET plan = $1, status = \'active\' WHERE user_id = $2', [u.plan || 'free', u.id]);
    }
  }

  console.log(`[Cascade & SSOT Migration] ✅ Synchronized ${usersRes.rows.length} users with normalized workspaces and subscriptions.`);

  // Verify constraints
  const verifyRes = await client.query(`
    SELECT conname, conrelid::regclass::text as table_name, confupdtype, confdeltype 
    FROM pg_constraint 
    WHERE contype = 'f' AND confupdtype = 'c'
  `);
  console.log(`[Cascade & SSOT Migration] ✅ Verified ${verifyRes.rows.length} foreign keys actively enforcing ON UPDATE CASCADE.`);

  await client.end();
  console.log('[Cascade & SSOT Migration] Done!');
}

applyCascadeAndSSOT().catch(err => {
  console.error('[Cascade & SSOT Migration] Failed:', err);
  process.exit(1);
});
