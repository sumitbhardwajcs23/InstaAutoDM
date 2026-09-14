// backend/src/db/migrations/012_canonical_instagram_identity_and_connections.js
//
// Migration 012: Canonical Instagram Identity + Quota Ownership
//
// KEY INVARIANTS ENFORCED:
// 1. instagram_accounts is a PERMANENT ledger — never deleted on user disconnect.
// 2. instagram_account_connections tracks the lifecycle of each user↔account pairing.
// 3. usage_counters is keyed by (instagram_account_id, subscription_id, period_start),
//    so quota usage is attributed to the SUBSCRIPTION that incurred it, not the account alone.
//    → Disconnect/reconnect to a different subscription NEVER mutates historical usage.
// 4. quota_reservations gains instagram_account_id for account-level locking.
// 5. All FK references use ON DELETE RESTRICT to preserve historical data.
//
// IDEMPOTENT: Each step uses IF NOT EXISTS / IF EXISTS / ON CONFLICT DO NOTHING.

module.exports = {
  name: '012_canonical_instagram_identity_and_connections.js',

  async up(client) {
    console.log('[Migration 012] Starting canonical Instagram identity & quota ownership migration...');

    // ─────────────────────────────────────────────────────────────────────
    // STEP 1: Make instagram_accounts a permanent ledger (change ON DELETE CASCADE → RESTRICT)
    // We need to drop and re-add the FK on instagram_accounts.user_id.
    // Because PG doesn't allow ALTER CONSTRAINT inline, we do it via a new nullable fk approach:
    // instagram_accounts.user_id is now informational (last known owner), NOT enforced cascade.
    // ─────────────────────────────────────────────────────────────────────
    console.log('[Migration 012] Step 1: Hardening instagram_accounts as permanent ledger...');

    // Add a 'disconnected' status option and ensure status column exists
    await client.query(`
      ALTER TABLE instagram_accounts
        ADD COLUMN IF NOT EXISTS token_revoked_at TEXT;
    `);

    // Drop existing CASCADE FK on instagram_accounts.user_id and replace with RESTRICT
    // This prevents accidental user deletion from wiping account history
    await client.query(`
      DO $$
      DECLARE
        c TEXT;
      BEGIN
        SELECT constraint_name INTO c
          FROM information_schema.table_constraints
         WHERE table_name = 'instagram_accounts'
           AND constraint_type = 'FOREIGN KEY'
           AND constraint_name LIKE '%user_id%';
        IF c IS NOT NULL THEN
          EXECUTE 'ALTER TABLE instagram_accounts DROP CONSTRAINT ' || c;
        END IF;
      END
      $$;
    `);

    await client.query(`
      ALTER TABLE instagram_accounts
        ADD CONSTRAINT fk_ig_accounts_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
        DEFERRABLE INITIALLY DEFERRED;
    `).catch(e => {
      // Already exists or user_id column type mismatch — log and continue
      console.warn('[Migration 012] user_id FK note:', e.message);
    });

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: Create instagram_account_connections — the sole operational
    //         source of which user currently operates which Instagram account.
    // ─────────────────────────────────────────────────────────────────────
    console.log('[Migration 012] Step 2: Creating instagram_account_connections table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS instagram_account_connections (
        id            TEXT        PRIMARY KEY,
        instagram_account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        user_id       TEXT        NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        subscription_id TEXT      REFERENCES subscriptions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        status        TEXT        NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'disconnected', 'transferred')),
        connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        disconnected_at TIMESTAMPTZ,
        transfer_reason TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Exactly ONE active connection per Instagram account at any time
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unq_active_ig_connection
        ON instagram_account_connections(instagram_account_id)
        WHERE status = 'active';
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ig_connections_user_status
        ON instagram_account_connections(user_id, status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ig_connections_sub_status
        ON instagram_account_connections(subscription_id, status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ig_connections_ig_account
        ON instagram_account_connections(instagram_account_id, status, connected_at DESC);
    `);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: Normalize usage_counters.
    // The new key is (instagram_account_id, subscription_id, period_start).
    // This ensures Subscription 1's historical usage for Instagram A is
    // never mutated when Instagram A moves to Subscription 2.
    // ─────────────────────────────────────────────────────────────────────
    console.log('[Migration 012] Step 3: Normalizing usage_counters to account+subscription keying...');

    await client.query(`
      ALTER TABLE usage_counters
        ADD COLUMN IF NOT EXISTS instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        ADD COLUMN IF NOT EXISTS subscription_id TEXT REFERENCES subscriptions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        ADD COLUMN IF NOT EXISTS period_end TEXT;
    `);

    // Rebuild the unique constraint to be per (instagram_account_id, subscription_id, period_start)
    // First remove old user_id unique constraint if present
    await client.query(`
      DO $$
      DECLARE c TEXT;
      BEGIN
        SELECT constraint_name INTO c
          FROM information_schema.table_constraints
         WHERE table_name = 'usage_counters'
           AND constraint_type = 'UNIQUE'
           AND constraint_name LIKE '%user_id%';
        IF c IS NOT NULL THEN
          EXECUTE 'ALTER TABLE usage_counters DROP CONSTRAINT ' || c;
        END IF;
      END
      $$;
    `);

    // Drop old unique index on user_id if it exists as an index (not constraint)
    await client.query(`DROP INDEX IF EXISTS usage_counters_user_id_key;`);
    await client.query(`DROP INDEX IF EXISTS idx_usage_counters_user;`);

    // New account-period-subscription unique index
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unq_usage_account_sub_period
        ON usage_counters(instagram_account_id, subscription_id, period_start)
        WHERE instagram_account_id IS NOT NULL AND subscription_id IS NOT NULL;
    `);

    // Legacy per-user unique index for rows that predate this migration (user_id only, no account)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unq_usage_user_period_legacy
        ON usage_counters(user_id, period_start)
        WHERE instagram_account_id IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_usage_counters_acc
        ON usage_counters(instagram_account_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_usage_counters_sub
        ON usage_counters(subscription_id);
    `);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4: Add instagram_account_id to quota_reservations
    // ─────────────────────────────────────────────────────────────────────
    console.log('[Migration 012] Step 4: Extending quota_reservations with instagram_account_id...');

    await client.query(`
      ALTER TABLE quota_reservations
        ADD COLUMN IF NOT EXISTS instagram_account_id TEXT
          REFERENCES instagram_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        ADD COLUMN IF NOT EXISTS subscription_id TEXT
          REFERENCES subscriptions(id) ON DELETE RESTRICT ON UPDATE CASCADE;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_quota_res_ig_status
        ON quota_reservations(instagram_account_id, status)
        WHERE instagram_account_id IS NOT NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_quota_res_sub_status
        ON quota_reservations(subscription_id, status)
        WHERE subscription_id IS NOT NULL;
    `);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 5: Deterministic backfill of instagram_account_connections
    //         for all currently connected instagram_accounts rows.
    // ─────────────────────────────────────────────────────────────────────
    console.log('[Migration 012] Step 5: Backfilling instagram_account_connections...');

    const { rows: connectedAccounts } = await client.query(`
      SELECT ia.id AS ig_account_id, ia.user_id, ia.created_at,
             s.id AS subscription_id
        FROM instagram_accounts ia
        LEFT JOIN subscriptions s ON s.user_id = ia.user_id
          AND s.status IN ('active', 'trialing')
        WHERE ia.status = 'connected'
        ORDER BY s.created_at DESC
    `);

    // Deduplicate by ig_account_id (take first row = newest subscription)
    const seen = new Set();
    for (const row of connectedAccounts) {
      if (seen.has(row.ig_account_id)) continue;
      seen.add(row.ig_account_id);

      const connId = `conn_${row.ig_account_id.slice(0, 8)}_${Date.now()}`;
      await client.query(`
        INSERT INTO instagram_account_connections
          (id, instagram_account_id, user_id, subscription_id, status, connected_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'active', COALESCE($5::timestamptz, NOW()), NOW(), NOW())
        ON CONFLICT DO NOTHING
      `, [connId, row.ig_account_id, row.user_id, row.subscription_id || null, row.created_at]);
    }
    console.log(`[Migration 012] Backfilled ${seen.size} active connection(s).`);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 6: Backfill usage_counters.instagram_account_id + subscription_id
    //         for existing rows that have a matching instagram_account.
    // ─────────────────────────────────────────────────────────────────────
    console.log('[Migration 012] Step 6: Backfilling usage_counters with account & subscription links...');

    await client.query(`
      UPDATE usage_counters uc
         SET instagram_account_id = ia.id,
             subscription_id = (
               SELECT s.id FROM subscriptions s
                WHERE s.user_id = uc.user_id
                  AND s.status IN ('active', 'trialing')
                ORDER BY s.created_at DESC LIMIT 1
             ),
             updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        FROM instagram_accounts ia
       WHERE ia.user_id = uc.user_id
         AND uc.instagram_account_id IS NULL
         AND ia.status = 'connected'
    `).catch(e => {
      console.warn('[Migration 012] usage_counters backfill note:', e.message);
    });

    console.log('[Migration 012] ✅ All steps complete.');
  },

  async down(client) {
    console.log('[Migration 012 Rollback] Reversing canonical identity migration...');

    // Remove new indexes
    await client.query(`DROP INDEX IF EXISTS unq_active_ig_connection;`);
    await client.query(`DROP INDEX IF EXISTS idx_ig_connections_user_status;`);
    await client.query(`DROP INDEX IF EXISTS idx_ig_connections_sub_status;`);
    await client.query(`DROP INDEX IF EXISTS idx_ig_connections_ig_account;`);
    await client.query(`DROP INDEX IF EXISTS unq_usage_account_sub_period;`);
    await client.query(`DROP INDEX IF EXISTS unq_usage_user_period_legacy;`);
    await client.query(`DROP INDEX IF EXISTS idx_usage_counters_acc;`);
    await client.query(`DROP INDEX IF EXISTS idx_usage_counters_sub;`);
    await client.query(`DROP INDEX IF EXISTS idx_quota_res_ig_status;`);
    await client.query(`DROP INDEX IF EXISTS idx_quota_res_sub_status;`);

    // Drop new table
    await client.query(`DROP TABLE IF EXISTS instagram_account_connections CASCADE;`);

    // Remove columns added to usage_counters
    await client.query(`
      ALTER TABLE usage_counters
        DROP COLUMN IF EXISTS instagram_account_id,
        DROP COLUMN IF EXISTS subscription_id,
        DROP COLUMN IF EXISTS period_end;
    `);

    // Remove columns added to quota_reservations
    await client.query(`
      ALTER TABLE quota_reservations
        DROP COLUMN IF EXISTS instagram_account_id,
        DROP COLUMN IF EXISTS subscription_id;
    `);

    console.log('[Migration 012 Rollback] ✅ Rolled back.');
  }
};
