// backend/src/db/migrations/013_activity_log_subscription_attribution.js
//
// Migration 013: Unambiguous Subscription & User Attribution for Daily Usage
//
// KEY INVARIANTS ENFORCED:
// 1. Daily usage in activity_log belongs to the subscription/quota context in which
//    the reply was incurred, NOT to the currently active connection state.
// 2. If Instagram Account X disconnects from Subscription A, Subscription A's daily
//    usage for today remains unchanged.
// 3. If Instagram Account X connects to Subscription B on the same day, Subscription B
//    starts with 0 daily usage and does NOT inherit Subscription A's previous replies.
// 4. Free-tier accounts (without subscription_id) are unambiguously attributed to user_id.
// 5. usage_counters remains the authoritative SSOT for monthly consumption.
//
// IDEMPOTENT: Each step uses IF NOT EXISTS / IF EXISTS / ON CONFLICT DO NOTHING.

module.exports = {
  name: '013_activity_log_subscription_attribution.js',

  async up(client) {
    console.log('[Migration 013] Starting activity_log subscription attribution migration...');

    // ─────────────────────────────────────────────────────────────────────
    // STEP 1: Add user_id and subscription_id columns to activity_log
    // ─────────────────────────────────────────────────────────────────────
    console.log('[Migration 013] Step 1: Adding user_id and subscription_id to activity_log...');
    await client.query(`
      ALTER TABLE activity_log
        ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        ADD COLUMN IF NOT EXISTS subscription_id TEXT REFERENCES subscriptions(id) ON DELETE RESTRICT ON UPDATE CASCADE;
    `);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: Backfill user_id and subscription_id for existing activity_log rows
    // ─────────────────────────────────────────────────────────────────────
    console.log('[Migration 013] Step 2: Backfilling user_id from instagram_accounts...');
    await client.query(`
      UPDATE activity_log al
      SET user_id = ig.user_id
      FROM instagram_accounts ig
      WHERE al.instagram_account_id = ig.id
        AND al.user_id IS NULL;
    `);

    console.log('[Migration 013] Step 2b: Backfilling subscription_id from active subscriptions...');
    await client.query(`
      UPDATE activity_log al
      SET subscription_id = sub.id
      FROM subscriptions sub
      WHERE sub.user_id = al.user_id
        AND sub.status IN ('active', 'trialing')
        AND al.subscription_id IS NULL;
    `);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: Drop old unique constraint on (instagram_account_id, event_date)
    // ─────────────────────────────────────────────────────────────────────
    console.log('[Migration 013] Step 3: Replacing unique constraint on activity_log...');
    await client.query(`
      DO $$
      DECLARE
        c TEXT;
      BEGIN
        SELECT constraint_name INTO c
          FROM information_schema.table_constraints
         WHERE table_name = 'activity_log'
           AND constraint_type = 'UNIQUE'
           AND constraint_name LIKE '%instagram_account_id%event_date%';
        IF c IS NOT NULL THEN
          EXECUTE 'ALTER TABLE activity_log DROP CONSTRAINT ' || c;
        END IF;
      END
      $$;
    `);

    // Also drop old index if it exists independently
    await client.query(`
      DROP INDEX IF EXISTS activity_log_instagram_account_id_event_date_key;
    `);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4: Create new composite unique indexes for unambiguous daily scoping
    // ─────────────────────────────────────────────────────────────────────
    console.log('[Migration 013] Step 4: Creating new scoped unique indexes on activity_log...');

    // For subscription-tied rows: unique per (instagram_account_id, subscription_id, event_date)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unq_activity_log_sub_acc_date
        ON activity_log(instagram_account_id, subscription_id, event_date)
        WHERE subscription_id IS NOT NULL;
    `);

    // For user-tied rows (free tier without subscription): unique per (instagram_account_id, user_id, event_date)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unq_activity_log_user_acc_date
        ON activity_log(instagram_account_id, user_id, event_date)
        WHERE subscription_id IS NULL;
    `);

    // Fast lookup indexes for daily aggregation queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_log_sub_date
        ON activity_log(subscription_id, event_date);
      CREATE INDEX IF NOT EXISTS idx_activity_log_user_date
        ON activity_log(user_id, event_date);
    `);

    console.log('[Migration 013] ✅ Migration 013 complete: activity_log is now subscription-scoped.');
  },

  async down(client) {
    console.log('[Migration 013] Rollback: Reverting activity_log subscription attribution...');
    await client.query(`
      DROP INDEX IF EXISTS unq_activity_log_sub_acc_date;
      DROP INDEX IF EXISTS unq_activity_log_user_acc_date;
      DROP INDEX IF EXISTS idx_activity_log_sub_date;
      DROP INDEX IF EXISTS idx_activity_log_user_date;
    `);
    await client.query(`
      ALTER TABLE activity_log
        DROP COLUMN IF EXISTS subscription_id,
        DROP COLUMN IF EXISTS user_id;
    `);
    await client.query(`
      ALTER TABLE activity_log
        ADD CONSTRAINT activity_log_instagram_account_id_event_date_key
        UNIQUE (instagram_account_id, event_date);
    `);
    console.log('[Migration 013] Rollback complete.');
  }
};
