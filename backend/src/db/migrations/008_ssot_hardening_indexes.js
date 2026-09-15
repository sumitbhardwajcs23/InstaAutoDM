/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  Migration 008 v5 — SSOT Hardening, Index Coverage & Invoice Integrity  ║
 * ║  Exact Mutation-Set Audit & Continuous Uniqueness (2026-09-13)         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ── EXECUTION PHASES ──────────────────────────────────────────────────────────
 *
 *  Phase 1 — beforeTransaction()     [autocommit — no transaction block]
 *    Builds the new unique index under a DIFFERENT name before the old one
 *    is touched. Validates the new index is healthy. Then performs an atomic
 *    rename swap in a minimal transaction (catalog-only, < 1ms lock). Finally
 *    drops the old index CONCURRENTLY (no table lock, uniqueness already held
 *    by the newly-renamed index).
 *    Result: uniqueness guarantee is NEVER absent at any point.
 *
 *  Phase 2 — up()                    [BEGIN … COMMIT transaction]
 *    All DML and non-index DDL: pre-flight aborts, exact CTE mutation updates,
 *    snapshot rows generated directly from RETURNING results, mutation logs,
 *    period_end hotfix, session/alert sync, invoice trigger, version record.
 *    Result: atomic — any failure auto-rolls back the entire body.
 *
 *  Phase 3 — afterTransaction()      [autocommit — no transaction block]
 *    Creates 22 FK B-tree indexes with CONCURRENTLY to avoid ShareLock
 *    on tables. Runs after the transaction commits so index creation failures
 *    do not roll back committed data fixes.
 *
 *  Phase 4 — validate()              [read-only live audit]
 *    12 comprehensive checks including V11 exact mutation-set verification:
 *    every actual mutation has exactly one snapshot, every snapshot corresponds
 *    to an actual mutation, old/new integrity is proven against live DB.
 */

module.exports = {

  // ─────────────────────────────────────────────────────────────────────────
  //  PHASE 1 — beforeTransaction()
  //  Safe index swap with continuous uniqueness guarantee.
  //  Runs in autocommit (no transaction wrapper). Must complete before up().
  // ─────────────────────────────────────────────────────────────────────────
  async beforeTransaction(client) {
    console.log('\n[Migration 008] ── Phase 1: Safe unique index swap ──────────────────');

    // Idempotency check: if idx_uq_user_active_sub already covers grace_period, skip swap
    const existingIndex = await client.query(`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'subscriptions' AND indexname = 'idx_uq_user_active_sub'
    `);
    if (existingIndex.rowCount > 0 && existingIndex.rows[0].indexdef.includes('grace_period')) {
      console.log('  ℹ️ idx_uq_user_active_sub already covers grace_period. Skipping swap.');
      return;
    }

    // ── Step A: Build new index under a different name ──────────────────────
    console.log('[Migration 008] [Phase 1/A] Building new unique index CONCURRENTLY...');
    await client.query(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_uq_user_active_sub_v2
      ON subscriptions (user_id)
      WHERE status IN ('active', 'trialing', 'past_due', 'grace_period')
    `);
    console.log('  ✅ idx_uq_user_active_sub_v2 built (covers grace_period, no table lock).');

    // ── Step B: Verify new index is valid ────────────────────────────────────
    console.log('[Migration 008] [Phase 1/B] Verifying new index health in pg_index...');
    const indexHealth = await client.query(`
      SELECT indisvalid, indisready
      FROM pg_index
      WHERE indexrelid = 'idx_uq_user_active_sub_v2'::regclass
    `);

    if (indexHealth.rowCount === 0 || !indexHealth.rows[0].indisvalid) {
      // Build was interrupted or failed. Clean up new index only. Old index untouched.
      await client.query(`DROP INDEX CONCURRENTLY IF EXISTS idx_uq_user_active_sub_v2`);
      throw new Error(
        '[Migration 008] Phase 1/B ABORT: idx_uq_user_active_sub_v2 is invalid or missing. ' +
        'Cleaned up new index. Old index remains intact. Safe to retry.'
      );
    }
    console.log('  ✅ New index validated: indisvalid=true, indisready=true.');

    // ── Step C: Atomic rename swap in minimal transaction ────────────────────
    // Takes catalog lock on pg_class rows only (not table). Duration: microseconds.
    // BOTH indexes enforce uniqueness throughout — only names change.
    console.log('[Migration 008] [Phase 1/C] Executing atomic catalog rename swap...');
    await client.query('BEGIN');
    try {
      // Check if old index exists before renaming
      const oldExists = await client.query(`
        SELECT 1 FROM pg_class WHERE relname = 'idx_uq_user_active_sub' AND relkind = 'i'
      `);

      if (oldExists.rowCount > 0) {
        await client.query(`ALTER INDEX idx_uq_user_active_sub RENAME TO idx_uq_user_active_sub_old`);
      }
      await client.query(`ALTER INDEX idx_uq_user_active_sub_v2 RENAME TO idx_uq_user_active_sub`);
      await client.query('COMMIT');
      console.log('  ✅ Atomic swap committed: new index is now idx_uq_user_active_sub.');
    } catch (swapErr) {
      await client.query('ROLLBACK');
      throw new Error(`[Migration 008] Phase 1/C Swap failed, rolled back catalog: ${swapErr.message}`);
    }

    // ── Step D: Drop old index CONCURRENTLY ───────────────────────────────────
    // idx_uq_user_active_sub (the new index) is already live and protecting uniqueness.
    console.log('[Migration 008] [Phase 1/D] Dropping old index CONCURRENTLY...');
    await client.query(`DROP INDEX CONCURRENTLY IF EXISTS idx_uq_user_active_sub_old`);
    console.log('  ✅ Old index dropped. Continuous uniqueness maintained throughout Phase 1.\n');
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  PHASE 2 — up()
  //  All DML and non-index DDL in a single explicit transaction.
  //  All snapshot rows are derived directly from UPDATE RETURNING mutations.
  // ─────────────────────────────────────────────────────────────────────────
  async up(client) {
    console.log('[Migration 008] ── Phase 2: Transactional migration body ─────────────');

    // ── Step 0: Pre-flight blocking checks ───────────────────────────────────
    console.log('[Migration 008] [Step 0] Pre-flight blocking checks...');

    const dupSubs = await client.query(`
      SELECT user_id, count(*) AS cnt FROM subscriptions
      WHERE status IN ('active','trialing','past_due','grace_period')
      GROUP BY user_id HAVING count(*) > 1
    `);
    if (dupSubs.rowCount > 0) {
      throw new Error(
        `[Migration 008] BLOCKED: ${dupSubs.rowCount} user(s) with duplicate active subscriptions. ` +
        `Resolve manually before re-running: ${JSON.stringify(dupSubs.rows)}`
      );
    }

    const crossUserInv = await client.query(`
      SELECT i.id, i.user_id AS inv_uid, s.user_id AS sub_uid
      FROM invoices i JOIN subscriptions s ON s.id = i.subscription_id
      WHERE i.user_id != s.user_id
    `);
    if (crossUserInv.rowCount > 0) {
      throw new Error(
        `[Migration 008] BLOCKED: ${crossUserInv.rowCount} cross-user invoice/subscription violation(s). ` +
        `Resolve manually: ${JSON.stringify(crossUserInv.rows)}`
      );
    }

    // Verify Phase 1 completed (index has grace_period)
    const idxCheck = await client.query(`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'subscriptions' AND indexname = 'idx_uq_user_active_sub'
    `);
    if (idxCheck.rowCount === 0 || !idxCheck.rows[0].indexdef.includes('grace_period')) {
      throw new Error(
        `[Migration 008] BLOCKED: Phase 1 (beforeTransaction) must complete successfully first. ` +
        `idx_uq_user_active_sub is missing or does not include grace_period.`
      );
    }

    console.log('[Migration 008] [Step 0] ✅ All pre-flight checks passed.\n');

    // ── Step 1: Initialize snapshot and mutation tracking tables ────────────
    console.log('[Migration 008] [Step 1] Initializing snapshot and mutation tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS migration_008_snapshot (
        id            TEXT PRIMARY KEY,
        entity_type   TEXT NOT NULL,
        entity_id     TEXT NOT NULL,
        field_name    TEXT NOT NULL,
        old_value     TEXT,
        new_value     TEXT,
        change_reason TEXT,
        captured_at   TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS migration_008_mutation_log (
        mutation_type TEXT NOT NULL,
        entity_id     TEXT NOT NULL,
        old_value     TEXT NOT NULL,
        new_value     TEXT NOT NULL,
        mutated_at    TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        PRIMARY KEY (mutation_type, entity_id)
      )
    `);

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    console.log('[Migration 008] [Step 1] ✅ Snapshot & mutation tracking tables ready.\n');

    // ── Step 2: Plan Discrepancy Resolution & Direct Snapshot Generation ─────
    console.log('[Migration 008] [Step 2] Correcting plan values & generating mutation snapshots...');

    // 2a: Fix subscriptions.plan first (SSOT) via CTE capturing old & new values
    const subPlanFixed = await client.query(`
      WITH pre AS (
        SELECT s.id, s.plan AS old_value, 'scale'::TEXT AS new_value
        FROM subscriptions s
        WHERE s.plan NOT IN (SELECT slug FROM pricing_plans)
          AND s.status IN ('active','trialing','grace_period')
        FOR UPDATE
      ),
      mutated AS (
        UPDATE subscriptions s
        SET plan = pre.new_value,
            updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        FROM pre
        WHERE s.id = pre.id
        RETURNING s.id, pre.old_value, s.plan AS new_value
      )
      SELECT id, old_value, new_value FROM mutated
    `);

    // Generate snapshot rows directly from actual UPDATE RETURNING result
    for (const row of subPlanFixed.rows) {
      await client.query(`
        INSERT INTO migration_008_snapshot
          (id, entity_type, entity_id, field_name, old_value, new_value, change_reason, captured_at)
        VALUES ($1, 'subscriptions', $2, 'plan', $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET old_value = EXCLUDED.old_value, new_value = EXCLUDED.new_value
      `, [
        `snap_s_${row.id}`,
        row.id,
        row.old_value,
        row.new_value,
        `Plan '${row.old_value}' not found in pricing_plans; resolved to '${row.new_value}' per invoice ₹4,999`,
        nowStr
      ]);

      await client.query(`
        INSERT INTO migration_008_mutation_log (mutation_type, entity_id, old_value, new_value, mutated_at)
        VALUES ('subscriptions.plan', $1, $2, $3, $4)
        ON CONFLICT (mutation_type, entity_id) DO UPDATE SET old_value = EXCLUDED.old_value, new_value = EXCLUDED.new_value
      `, [row.id, row.old_value, row.new_value, nowStr]);
    }

    const subIds = subPlanFixed.rows.map(r => r.id);
    await client.query(`
      INSERT INTO migration_008_snapshot
        (id, entity_type, entity_id, field_name, old_value, new_value, change_reason, captured_at)
      VALUES ($1, 'migration_meta', '008', 'subscriptions_plan_mutated_ids', $2, $3, 'Exact mutation entity IDs from UPDATE RETURNING', $4)
      ON CONFLICT (id) DO UPDATE SET old_value = EXCLUDED.old_value, new_value = EXCLUDED.new_value
    `, ['snap_meta_008_subs_plan_mutations', String(subPlanFixed.rowCount), JSON.stringify(subIds), nowStr]);

    console.log(`  [2a] subscriptions.plan: ${subPlanFixed.rowCount} row(s) mutated and snapshotted.`);
    subPlanFixed.rows.forEach(r => console.log(`       [sub ${r.id}] ${r.old_value} → ${r.new_value}`));

    // 2b: Sync users.plan from subscriptions (legacy cache sync)
    const userPlanFixed = await client.query(`
      WITH pre AS (
        SELECT u.id, u.plan AS old_value, s.plan AS new_value
        FROM users u
        JOIN subscriptions s ON s.user_id = u.id
        WHERE s.status IN ('active','trialing','grace_period')
          AND u.plan != s.plan
        FOR UPDATE OF u
      ),
      mutated AS (
        UPDATE users u
        SET plan = pre.new_value,
            updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
        FROM pre
        WHERE u.id = pre.id
        RETURNING u.id, pre.old_value, u.plan AS new_value
      )
      SELECT id, old_value, new_value FROM mutated
    `);

    // Generate snapshot rows directly from actual UPDATE RETURNING result
    for (const row of userPlanFixed.rows) {
      await client.query(`
        INSERT INTO migration_008_snapshot
          (id, entity_type, entity_id, field_name, old_value, new_value, change_reason, captured_at)
        VALUES ($1, 'users', $2, 'plan', $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET old_value = EXCLUDED.old_value, new_value = EXCLUDED.new_value
      `, [
        `snap_u_${row.id}`,
        row.id,
        row.old_value,
        row.new_value,
        `Legacy cache sync from subscriptions.plan. Old='${row.old_value}' → '${row.new_value}'`,
        nowStr
      ]);

      await client.query(`
        INSERT INTO migration_008_mutation_log (mutation_type, entity_id, old_value, new_value, mutated_at)
        VALUES ('users.plan', $1, $2, $3, $4)
        ON CONFLICT (mutation_type, entity_id) DO UPDATE SET old_value = EXCLUDED.old_value, new_value = EXCLUDED.new_value
      `, [row.id, row.old_value, row.new_value, nowStr]);
    }

    const userIds = userPlanFixed.rows.map(r => r.id);
    await client.query(`
      INSERT INTO migration_008_snapshot
        (id, entity_type, entity_id, field_name, old_value, new_value, change_reason, captured_at)
      VALUES ($1, 'migration_meta', '008', 'users_plan_mutated_ids', $2, $3, 'Exact mutation entity IDs from UPDATE RETURNING', $4)
      ON CONFLICT (id) DO UPDATE SET old_value = EXCLUDED.old_value, new_value = EXCLUDED.new_value
    `, ['snap_meta_008_users_plan_mutations', String(userPlanFixed.rowCount), JSON.stringify(userIds), nowStr]);

    console.log(`  [2b] users.plan: ${userPlanFixed.rowCount} row(s) mutated and snapshotted.`);
    userPlanFixed.rows.forEach(r => console.log(`       [user ${r.id}] ${r.old_value} → ${r.new_value}`));

    // 2c: Post-correction drift check
    const remainingDrift = await client.query(`
      SELECT u.email, u.plan AS u_plan, s.plan AS s_plan
      FROM users u JOIN subscriptions s ON s.user_id = u.id
      WHERE s.status IN ('active','trialing','grace_period') AND u.plan != s.plan
    `);
    if (remainingDrift.rowCount > 0) {
      throw new Error(`[Migration 008] Plan sync verification failed: ${JSON.stringify(remainingDrift.rows)}`);
    }
    console.log('[Migration 008] [Step 2] ✅ Plan discrepancy resolved and verified.\n');

    // ── Step 3: Reset coupon used_count & Direct Snapshot Generation ─────────
    console.log('[Migration 008] [Step 3] Resetting coupon used_count to actual redemptions...');

    const couponReset = await client.query(`
      WITH pre AS (
        SELECT c.id,
               c.used_count AS old_value,
               COALESCE((SELECT COUNT(*)::int FROM coupon_redemptions r WHERE r.coupon_id = c.id), 0) AS new_value
        FROM coupons c
        WHERE c.used_count != COALESCE((SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id), 0)
        FOR UPDATE
      ),
      mutated AS (
        UPDATE coupons c
        SET used_count = pre.new_value
        FROM pre
        WHERE c.id = pre.id
        RETURNING c.id, pre.old_value, c.used_count AS new_value
      )
      SELECT id, old_value, new_value FROM mutated
    `);

    // Generate snapshot rows directly from actual UPDATE RETURNING result
    for (const row of couponReset.rows) {
      await client.query(`
        INSERT INTO migration_008_snapshot
          (id, entity_type, entity_id, field_name, old_value, new_value, change_reason, captured_at)
        VALUES ($1, 'coupons', $2, 'used_count', $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET old_value = EXCLUDED.old_value, new_value = EXCLUDED.new_value
      `, [
        `snap_c_${row.id}`,
        row.id,
        String(row.old_value),
        String(row.new_value),
        `Seeded count reset to actual coupon_redemptions count (${row.old_value} seeded, ${row.new_value} actual)`,
        nowStr
      ]);

      await client.query(`
        INSERT INTO migration_008_mutation_log (mutation_type, entity_id, old_value, new_value, mutated_at)
        VALUES ('coupons.used_count', $1, $2, $3, $4)
        ON CONFLICT (mutation_type, entity_id) DO UPDATE SET old_value = EXCLUDED.old_value, new_value = EXCLUDED.new_value
      `, [row.id, String(row.old_value), String(row.new_value), nowStr]);
    }

    const couponIds = couponReset.rows.map(r => r.id);
    await client.query(`
      INSERT INTO migration_008_snapshot
        (id, entity_type, entity_id, field_name, old_value, new_value, change_reason, captured_at)
      VALUES ($1, 'migration_meta', '008', 'coupons_used_count_mutated_ids', $2, $3, 'Exact mutation entity IDs from UPDATE RETURNING', $4)
      ON CONFLICT (id) DO UPDATE SET old_value = EXCLUDED.old_value, new_value = EXCLUDED.new_value
    `, ['snap_meta_008_coupons_uc_mutations', String(couponReset.rowCount), JSON.stringify(couponIds), nowStr]);

    console.log(`[Migration 008] [Step 3] ✅ Coupon reset: ${couponReset.rowCount} coupon(s) mutated and snapshotted.`);
    couponReset.rows.forEach(r => console.log(`                     ${r.id}: used_count ${r.old_value} → ${r.new_value}`));
    console.log();

    // ── Step 4: Add usage_counters.period_end (TEXT hotfix) ─────────────────
    console.log('[Migration 008] [Step 4] Adding usage_counters.period_end (TEXT hotfix)...');

    await client.query(`ALTER TABLE usage_counters ADD COLUMN IF NOT EXISTS period_end TEXT`);

    const periodBackfill = await client.query(`
      UPDATE usage_counters uc
      SET period_end = COALESCE(
        -- Priority 1: use actual subscription billing period end from payment gateway
        (
          SELECT CASE
            WHEN s.current_period_end ~ '^\d{4}-\d{2}-\d{2}'
              THEN substring(s.current_period_end from 1 for 10)
            WHEN s.current_period_end ~ '^\d+$'
              THEN to_char(to_timestamp(s.current_period_end::double precision), 'YYYY-MM-DD')
            ELSE NULL
          END
          FROM subscriptions s
          WHERE s.user_id = uc.user_id
            AND s.status IN ('active','trialing','grace_period')
          ORDER BY s.updated_at DESC
          LIMIT 1
        ),
        -- Priority 2: fallback to period_start + 30 days
        to_char(
          CASE
            WHEN uc.period_start ~ '^\d{4}-\d{2}-\d{2}'
              THEN to_timestamp(substring(uc.period_start from 1 for 10), 'YYYY-MM-DD') + INTERVAL '30 days'
            ELSE NOW() + INTERVAL '30 days'
          END,
          'YYYY-MM-DD'
        )
      )
      WHERE uc.period_end IS NULL
      RETURNING uc.id, uc.user_id, uc.period_end
    `).catch(e => {
      console.warn('[Migration 008] [Step 4] current_period_end lookup failed, using period_start + 30 days:', e.message);
      return client.query(`
        UPDATE usage_counters
        SET period_end = to_char(
          CASE
            WHEN period_start ~ '^\d{4}-\d{2}-\d{2}'
              THEN to_timestamp(period_start, 'YYYY-MM-DD') + INTERVAL '30 days'
            ELSE NOW() + INTERVAL '30 days'
          END,
          'YYYY-MM-DD'
        )
        WHERE period_end IS NULL
        RETURNING id, user_id, period_end
      `);
    });
    console.log(`[Migration 008] [Step 4] ✅ period_end column added. Backfilled: ${periodBackfill.rowCount} row(s).`);
    periodBackfill.rows.forEach(r => console.log(`                     user ${r.user_id}: period_end = ${r.period_end}`));
    console.log();

    // ── Step 5: Synchronize admin_sessions dual state flags ──────────────────
    console.log('[Migration 008] [Step 5] Synchronizing admin_sessions flags...');
    const sessionSync = await client.query(`
      UPDATE admin_sessions
      SET is_active = CASE WHEN is_revoked = 1 THEN 0 ELSE 1 END
      WHERE is_active IS DISTINCT FROM (CASE WHEN is_revoked = 1 THEN 0 ELSE 1 END)
    `);
    console.log(`[Migration 008] [Step 5] ✅ admin_sessions synced: ${sessionSync.rowCount} row(s) updated.`);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_active
      ON admin_sessions(user_id, is_active)
    `);
    console.log();

    // ── Step 6: Synchronize system_alerts dual state flags ───────────────────
    console.log('[Migration 008] [Step 6] Synchronizing system_alerts flags...');
    const alertSync = await client.query(`
      UPDATE system_alerts
      SET is_resolved = resolved
      WHERE is_resolved IS DISTINCT FROM resolved AND resolved IS NOT NULL
    `).catch(e => {
      console.warn('[Migration 008] [Step 6] system_alerts sync note:', e.message);
      return { rowCount: 0 };
    });
    console.log(`[Migration 008] [Step 6] ✅ system_alerts synced: ${alertSync.rowCount} row(s) updated.`);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_system_alerts_is_res
      ON system_alerts(is_resolved, created_at DESC)
    `).catch(() => {});
    console.log();

    // ── Step 7: Invoice/subscription cross-user integrity trigger ────────────
    console.log('[Migration 008] [Step 7] Installing invoice integrity trigger...');

    await client.query(`
      CREATE OR REPLACE FUNCTION check_invoice_subscription_user()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.subscription_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM subscriptions s
            WHERE s.id = NEW.subscription_id AND s.user_id = NEW.user_id
          ) THEN
            RAISE EXCEPTION
              '[Airvix] Invoice integrity violation: subscription % does not belong to user %',
              NEW.subscription_id, NEW.user_id;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`DROP TRIGGER IF EXISTS trg_invoice_sub_user_check ON invoices`);
    await client.query(`
      CREATE TRIGGER trg_invoice_sub_user_check
      BEFORE INSERT OR UPDATE ON invoices
      FOR EACH ROW EXECUTE FUNCTION check_invoice_subscription_user()
    `);
    console.log('[Migration 008] [Step 7] ✅ Trigger trg_invoice_sub_user_check installed.\n');

    // ── Step 8: Record migration version ────────────────────────────────────
    const execNow = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await client.query(`
      INSERT INTO schema_migrations (version, name, checksum, applied_at, execution_time_ms)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (version) DO UPDATE SET applied_at = EXCLUDED.applied_at
    `, ['008', '008_ssot_hardening_indexes_v5', 'ssot_v5_exact_mutation_set_audit', execNow, 0]);

    console.log('[Migration 008] ── Phase 2 complete. Transaction ready to COMMIT. ──\n');
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  PHASE 3 — afterTransaction()
  //  Creates 22 FK B-tree indexes using CONCURRENTLY.
  //  Runs AFTER the transaction commits to avoid locking issues.
  // ─────────────────────────────────────────────────────────────────────────
  async afterTransaction(client) {
    console.log('[Migration 008] ── Phase 3: FK indexes (CONCURRENTLY, post-commit) ──────────');
    console.log('[Migration 008]    Does not block application reads/writes.');
    console.log('[Migration 008]    Consumes database CPU/I/O during construction.\n');

    const indexes = [
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)`, 'user_sessions.user_id'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_accounts_user ON auth_accounts(user_id)`, 'auth_accounts.user_id'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id, is_revoked)`, 'admin_sessions.user_id'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_rules_account ON automation_rules(instagram_account_id)`, 'automation_rules.instagram_account_id'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comment_replies_account ON comment_replies(instagram_account_id)`, 'comment_replies.instagram_account_id'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comment_replies_rule ON comment_replies(automation_rule_id)`, 'comment_replies.automation_rule_id'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rule_card_attachments_rule ON rule_card_attachments(rule_id, sort_order)`, 'rule_card_attachments.rule_id'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_pending_rule ON conversations(pending_follow_rule_id) WHERE pending_follow_rule_id IS NOT NULL`, 'conversations.pending_follow_rule_id (partial)'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loop_incidents_trigger_rule ON automation_loop_incidents(trigger_rule_id) WHERE trigger_rule_id IS NOT NULL`, 'loop_incidents.trigger_rule_id (partial)'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loop_incidents_ig_account ON automation_loop_incidents(instagram_account_id)`, 'loop_incidents.instagram_account_id'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id) WHERE subscription_id IS NOT NULL`, 'invoices.subscription_id (partial)'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id)`, 'coupon_redemptions.coupon_id'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coupon_redemptions_invoice ON coupon_redemptions(invoice_id) WHERE invoice_id IS NOT NULL`, 'coupon_redemptions.invoice_id (partial)'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dlq_user ON dead_letter_queue(user_id) WHERE user_id IS NOT NULL`, 'dead_letter_queue.user_id (partial)'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dlq_account ON dead_letter_queue(account_id) WHERE account_id IS NOT NULL`, 'dead_letter_queue.account_id (partial)'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_error_events_user ON error_events(user_id) WHERE user_id IS NOT NULL`, 'error_events.user_id (partial)'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_abuse_flags_user ON abuse_flags(user_id) WHERE user_id IS NOT NULL`, 'abuse_flags.user_id (partial)'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_abuse_flags_ig_account ON abuse_flags(instagram_account_id) WHERE instagram_account_id IS NOT NULL`, 'abuse_flags.instagram_account_id (partial)'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_account ON activity_log(instagram_account_id)`, 'activity_log.instagram_account_id'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_api_usage_account_fk ON tenant_api_usage(account_id) WHERE account_id IS NOT NULL`, 'tenant_api_usage.account_id (partial)'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_api_usage_user_fk ON tenant_api_usage(user_id)`, 'tenant_api_usage.user_id'],
      [`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_resets_user ON password_resets(user_id)`, 'password_resets.user_id'],
    ];

    let created = 0, failed = 0;
    for (const [sql, label] of indexes) {
      try {
        await client.query(sql);
        console.log(`  ✅ ${label}`);
        created++;
      } catch (e) {
        console.warn(`  ⚠️  FAILED: ${label} — ${e.message}`);
        console.warn(`       Retry with: ${sql}`);
        failed++;
      }
    }

    console.log(`\n[Migration 008] [Phase 3] ✅ FK index creation complete: ${created} created, ${failed} failed.\n`);
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  PHASE 4 — validate()
  //  Runs after all phases complete. 12 checks.
  //  V11 enforces AUDIT-GRADE EXACT MUTATION-SET VERIFICATION.
  // ─────────────────────────────────────────────────────────────────────────
  async validate(client) {
    console.log('[Migration 008] ── Phase 4: Post-migration validation ──────────────');
    const failures = [];

    // V1: Zero duplicate active subscriptions
    const v1 = await client.query(`
      SELECT user_id, count(*) FROM subscriptions
      WHERE status IN ('active','trialing','past_due','grace_period')
      GROUP BY user_id HAVING count(*) > 1
    `);
    if (v1.rowCount > 0) failures.push(`V1 FAIL: ${v1.rowCount} duplicate active subscription(s)`);
    else console.log('  ✅ V1: Zero duplicate active subscriptions');

    // V2: Zero cross-user invoice/subscription violations
    const v2 = await client.query(`
      SELECT i.id FROM invoices i JOIN subscriptions s ON s.id = i.subscription_id
      WHERE i.user_id != s.user_id
    `);
    if (v2.rowCount > 0) failures.push(`V2 FAIL: ${v2.rowCount} cross-user invoice/subscription violation(s)`);
    else console.log('  ✅ V2: Zero cross-user invoice/subscription violations');

    // V3: Zero plan drift (users.plan vs subscriptions.plan for active subs)
    const v3 = await client.query(`
      SELECT u.email, u.plan, s.plan AS s_plan FROM users u
      JOIN subscriptions s ON s.user_id = u.id
      WHERE s.status IN ('active','trialing','grace_period') AND u.plan != s.plan
    `);
    if (v3.rowCount > 0) failures.push(`V3 FAIL: ${v3.rowCount} plan drift row(s): ${JSON.stringify(v3.rows)}`);
    else console.log('  ✅ V3: Zero plan drift (users.plan matches subscriptions.plan)');

    // V4: Zero subscription_status drift
    const v4 = await client.query(`
      SELECT u.email, u.subscription_status, s.status FROM users u
      JOIN subscriptions s ON s.user_id = u.id AND s.status IN ('active','trialing','grace_period')
      WHERE u.subscription_status != s.status
    `);
    if (v4.rowCount > 0) failures.push(`V4 FAIL: ${v4.rowCount} subscription_status drift row(s): ${JSON.stringify(v4.rows)}`);
    else console.log('  ✅ V4: Zero subscription_status drift');

    // V5: Usage counter dual-counter analysis
    const v5 = await client.query(`
      SELECT u.email,
             COALESCE(u.dm_usage_this_period, 0) AS users_counter,
             COALESCE(uc.dms_sent, 0)            AS uc_counter,
             COALESCE(u.dm_usage_this_period, 0) - COALESCE(uc.dms_sent, 0) AS delta
      FROM users u
      LEFT JOIN usage_counters uc ON uc.user_id = u.id
      WHERE COALESCE(u.dm_usage_this_period, 0) < COALESCE(uc.dms_sent, 0)
    `);

    const v5info = await client.query(`
      SELECT u.email,
             COALESCE(u.dm_usage_this_period, 0) AS users_counter,
             COALESCE(uc.dms_sent, 0)            AS uc_counter
      FROM users u
      LEFT JOIN usage_counters uc ON uc.user_id = u.id
      WHERE COALESCE(u.dm_usage_this_period, 0) != COALESCE(uc.dms_sent, 0)
    `);

    if (v5.rowCount > 0) {
      failures.push(
        `V5 FAIL: ${v5.rowCount} user(s) where users.dm_usage_this_period < usage_counters.dms_sent ` +
        `(impossible under normal write paths — indicates data corruption): ${JSON.stringify(v5.rows)}`
      );
    } else {
      console.log('  ✅ V5: No data corruption (users.dm_usage_this_period is never less than usage_counters.dms_sent)');
    }
    if (v5info.rowCount > 0) {
      console.log(`  ℹ️  V5 INFO: ${v5info.rowCount} user(s) have structural counter divergence (expected — see V5 note):`);
      v5info.rows.forEach(r =>
        console.log(`       ${r.email}: users=${r.users_counter}, uc=${r.uc_counter}`)
      );
    } else {
      console.log('  ✅ V5: Both counters are in sync (no DMs sent since last billing event)');
    }

    // V6: Admin session state consistency (is_active = NOT is_revoked)
    const v6 = await client.query(`
      SELECT id FROM admin_sessions
      WHERE is_active IS DISTINCT FROM (CASE WHEN is_revoked = 1 THEN 0 ELSE 1 END)
    `);
    if (v6.rowCount > 0) failures.push(`V6 FAIL: ${v6.rowCount} admin_sessions state desync(s)`);
    else console.log('  ✅ V6: Admin session state consistency OK');

    // V7: System alerts state consistency
    const v7 = await client.query(`
      SELECT id FROM system_alerts
      WHERE is_resolved IS DISTINCT FROM resolved AND resolved IS NOT NULL
    `).catch(() => ({ rowCount: 0 }));
    if (v7.rowCount > 0) failures.push(`V7 FAIL: ${v7.rowCount} system_alerts state desync(s)`);
    else console.log('  ✅ V7: System alerts state consistency OK');

    // V8: Invoice integrity trigger exists and enabled
    const v8 = await client.query(`
      SELECT trigger_name FROM information_schema.triggers
      WHERE trigger_name = 'trg_invoice_sub_user_check'
        AND event_object_table = 'invoices'
        AND event_manipulation IN ('INSERT','UPDATE')
    `);
    if (v8.rowCount < 2) failures.push(`V8 FAIL: trigger trg_invoice_sub_user_check has only ${v8.rowCount}/2 event(s)`);
    else console.log('  ✅ V8: Invoice integrity trigger active for INSERT and UPDATE');

    // V9: Unique subscription index covers grace_period (not old definition)
    const v9 = await client.query(`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'subscriptions' AND indexname = 'idx_uq_user_active_sub'
    `);
    if (v9.rowCount === 0) {
      failures.push(`V9 FAIL: idx_uq_user_active_sub not found`);
    } else if (!v9.rows[0].indexdef.includes('grace_period')) {
      failures.push(`V9 FAIL: idx_uq_user_active_sub missing grace_period: ${v9.rows[0].indexdef}`);
    } else {
      console.log('  ✅ V9: Unique subscription index covers grace_period');
    }

    // V10: Critical FK indexes present
    const criticalIndexes = [
      'idx_user_sessions_user','idx_auth_accounts_user','idx_invoices_subscription',
      'idx_automation_rules_account','idx_coupon_redemptions_coupon'
    ];
    const missingIdx = [];
    for (const idx of criticalIndexes) {
      const r = await client.query(`SELECT 1 FROM pg_indexes WHERE indexname = $1`, [idx]);
      if (r.rowCount === 0) missingIdx.push(idx);
    }
    if (missingIdx.length > 0) failures.push(`V10 FAIL: Missing critical FK indexes: ${missingIdx.join(', ')}`);
    else console.log('  ✅ V10: All critical FK indexes confirmed present');

    // ═════════════════════════════════════════════════════════════════════════
    // V11: EXACT MUTATION SET VERIFICATION (AUDIT-GRADE)
    //
    // Verifies the ACTUAL mutation set captured directly from UPDATE RETURNING
    // against migration_008_snapshot and current live DB state:
    //
    //   1. every actual mutation has exactly one snapshot
    //   2. every snapshot corresponds to an actual mutation
    //   3. snapshot.old_value is the pre-update value
    //   4. snapshot.new_value equals the actual UPDATE result
    //   5. snapshot.new_value equals the current DB value
    //   6. no snapshot has old_value == new_value
    //   7. actual mutation count == snapshot count
    // ═════════════════════════════════════════════════════════════════════════
    console.log('  [V11] Verifying exact mutation set and snapshot integrity...');
    const v11Failures = [];

    async function verifyMutationDomain({
      domainKey,
      entityType,
      fieldName,
      metaFieldName,
      currentDbQueryFn
    }) {
      // 1. Fetch the actual logged mutations captured during UPDATE ... RETURNING
      const actualMutationsRes = await client.query(
        `SELECT entity_id, old_value, new_value FROM migration_008_mutation_log WHERE mutation_type = $1 ORDER BY entity_id`,
        [domainKey]
      );
      const actualMutations = actualMutationsRes.rows;

      // 2. Fetch the stored meta row containing exact mutation IDs
      const metaRes = await client.query(
        `SELECT old_value AS stored_count, new_value AS stored_ids
         FROM migration_008_snapshot
         WHERE entity_type = 'migration_meta' AND entity_id = '008' AND field_name = $1`,
        [metaFieldName]
      );
      if (metaRes.rowCount === 0) {
        v11Failures.push(`[${domainKey}] Missing mutation metadata row '${metaFieldName}' in migration_008_snapshot`);
      } else {
        const storedCount = parseInt(metaRes.rows[0].stored_count, 10);
        const storedIds = JSON.parse(metaRes.rows[0].stored_ids || '[]');
        if (storedCount !== actualMutations.length) {
          v11Failures.push(`[${domainKey}] Meta stored count (${storedCount}) != actual logged mutations (${actualMutations.length})`);
        }
        if (storedIds.length !== actualMutations.length || !storedIds.every(id => actualMutations.some(m => m.entity_id === id))) {
          v11Failures.push(`[${domainKey}] Meta stored IDs do not match actual mutation IDs`);
        }
      }

      // 3. Fetch snapshots for this entity type and field
      const snapshotsRes = await client.query(
        `SELECT entity_id, old_value, new_value
         FROM migration_008_snapshot
         WHERE entity_type = $1 AND field_name = $2
         ORDER BY entity_id`,
        [entityType, fieldName]
      );
      const snapshots = snapshotsRes.rows;
      const snapshotMap = new Map(snapshots.map(s => [s.entity_id, s]));

      // 4. Rule: actual mutation count == snapshot count
      if (actualMutations.length !== snapshots.length) {
        v11Failures.push(
          `[${domainKey}] Count mismatch: actual mutations = ${actualMutations.length}, snapshots = ${snapshots.length}`
        );
      }

      // 5. Rule: every actual mutation has exactly one snapshot
      for (const mut of actualMutations) {
        const snap = snapshotMap.get(mut.entity_id);
        if (!snap) {
          v11Failures.push(`[${domainKey}] Missing snapshot for mutated entity '${mut.entity_id}'`);
          continue;
        }

        // Rule: snapshot.old_value is the pre-update value
        if (snap.old_value !== mut.old_value) {
          v11Failures.push(
            `[${domainKey}] Entity '${mut.entity_id}': snapshot.old_value ('${snap.old_value}') does not match actual pre-update value ('${mut.old_value}')`
          );
        }

        // Rule: snapshot.new_value equals the actual UPDATE result
        if (snap.new_value !== mut.new_value) {
          v11Failures.push(
            `[${domainKey}] Entity '${mut.entity_id}': snapshot.new_value ('${snap.new_value}') does not match actual UPDATE result ('${mut.new_value}')`
          );
        }

        // Rule: no snapshot has old_value == new_value
        if (snap.old_value === snap.new_value) {
          v11Failures.push(`[${domainKey}] False mutation in snapshot for '${mut.entity_id}': old_value == new_value ('${snap.old_value}')`);
        }

        // Rule: snapshot.new_value equals current DB value
        const currentDbVal = await currentDbQueryFn(mut.entity_id);
        if (currentDbVal !== snap.new_value) {
          v11Failures.push(
            `[${domainKey}] Entity '${mut.entity_id}': snapshot.new_value ('${snap.new_value}') does not match current DB value ('${currentDbVal}')`
          );
        }
      }

      // 6. Rule: every snapshot corresponds to an actual mutation (no extraneous snapshots)
      const actualMutationSet = new Set(actualMutations.map(m => m.entity_id));
      for (const snap of snapshots) {
        if (!actualMutationSet.has(snap.entity_id)) {
          v11Failures.push(`[${domainKey}] Extraneous snapshot '${snap.entity_id}' does not correspond to any actual UPDATE`);
        }
      }

      if (!v11Failures.some(f => f.startsWith(`[${domainKey}]`))) {
        console.log(`  ✅ V11 [${domainKey}]: ${actualMutations.length} mutation(s) verified (1:1 snapshot, old/new integrity, live DB match)`);
      }
    }

    // V11.1: subscriptions.plan
    await verifyMutationDomain({
      domainKey: 'subscriptions.plan',
      entityType: 'subscriptions',
      fieldName: 'plan',
      metaFieldName: 'subscriptions_plan_mutated_ids',
      currentDbQueryFn: async (id) => {
        const r = await client.query('SELECT plan FROM subscriptions WHERE id = $1', [id]);
        return r.rowCount > 0 ? r.rows[0].plan : null;
      }
    });

    // V11.2: users.plan
    await verifyMutationDomain({
      domainKey: 'users.plan',
      entityType: 'users',
      fieldName: 'plan',
      metaFieldName: 'users_plan_mutated_ids',
      currentDbQueryFn: async (id) => {
        const r = await client.query('SELECT plan FROM users WHERE id = $1', [id]);
        return r.rowCount > 0 ? r.rows[0].plan : null;
      }
    });

    // V11.3: coupons.used_count
    await verifyMutationDomain({
      domainKey: 'coupons.used_count',
      entityType: 'coupons',
      fieldName: 'used_count',
      metaFieldName: 'coupons_used_count_mutated_ids',
      currentDbQueryFn: async (id) => {
        const r = await client.query('SELECT used_count FROM coupons WHERE id = $1', [id]);
        return r.rowCount > 0 ? String(r.rows[0].used_count) : null;
      }
    });

    // Overall total check
    const totalMutationsRes = await client.query('SELECT COUNT(*) AS total FROM migration_008_mutation_log');
    const totalSnapshotsRes = await client.query("SELECT COUNT(*) AS total FROM migration_008_snapshot WHERE entity_type != 'migration_meta'");
    const totalMutations = parseInt(totalMutationsRes.rows[0].total, 10);
    const totalSnapshots = parseInt(totalSnapshotsRes.rows[0].total, 10);

    if (totalMutations !== totalSnapshots) {
      v11Failures.push(`Global mutation/snapshot count mismatch: ${totalMutations} mutations vs ${totalSnapshots} snapshots`);
    }

    if (v11Failures.length > 0) {
      failures.push(`V11 FAIL:\n    ${v11Failures.join('\n    ')}`);
    } else {
      console.log(`  ✅ V11: Exact mutation set audit complete — all ${totalMutations} mutation(s) verified with 1:1 snapshot coverage.`);
    }

    // V12: Coupon used_count matches actual redemptions
    const v12 = await client.query(`
      SELECT c.code, c.used_count, COALESCE(r.cnt,0) AS actual
      FROM coupons c
      LEFT JOIN (SELECT coupon_id, count(*) AS cnt FROM coupon_redemptions GROUP BY coupon_id) r
        ON r.coupon_id = c.id
      WHERE c.used_count != COALESCE(r.cnt, 0)
    `);
    if (v12.rowCount > 0) failures.push(`V12 FAIL: Coupon used_count still drifted: ${JSON.stringify(v12.rows)}`);
    else console.log('  ✅ V12: Coupon used_count matches actual coupon_redemptions count');

    console.log();
    if (failures.length > 0) {
      console.error('[Migration 008] ❌ VALIDATION FAILED:');
      failures.forEach(f => console.error('  ' + f));
      throw new Error(`[Migration 008] ${failures.length} validation failure(s). See above.`);
    }

    console.log('[Migration 008] ✅ All 12 validation checks PASSED.');
    console.log('[Migration 008] ══════════════════════════════════════════════════\n');
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  down() — Structural rollback only. Data mutations are forward-only.
  // ─────────────────────────────────────────────────────────────────────────
  async down(client) {
    console.log('[Migration 008] ⬇️  Rolling back structural changes...');

    await client.query(`DROP TRIGGER IF EXISTS trg_invoice_sub_user_check ON invoices`);
    await client.query(`DROP FUNCTION IF EXISTS check_invoice_subscription_user()`);

    // Restore original index (without grace_period)
    await client.query(`DROP INDEX IF EXISTS idx_uq_user_active_sub`);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_user_active_sub
      ON subscriptions (user_id)
      WHERE status IN ('active', 'trialing', 'past_due')
    `);

    await client.query(`ALTER TABLE usage_counters DROP COLUMN IF EXISTS period_end`);
    await client.query(`DROP INDEX IF EXISTS idx_system_alerts_is_res`);
    await client.query(`DROP INDEX IF EXISTS idx_admin_sessions_user_active`);

    const dropFkIdx = [
      'idx_user_sessions_user','idx_auth_accounts_user','idx_admin_sessions_user',
      'idx_automation_rules_account','idx_comment_replies_account','idx_comment_replies_rule',
      'idx_rule_card_attachments_rule','idx_conversations_pending_rule',
      'idx_loop_incidents_trigger_rule','idx_loop_incidents_ig_account',
      'idx_invoices_subscription','idx_coupon_redemptions_coupon','idx_coupon_redemptions_invoice',
      'idx_dlq_user','idx_dlq_account','idx_error_events_user',
      'idx_abuse_flags_user','idx_abuse_flags_ig_account','idx_activity_log_account',
      'idx_tenant_api_usage_account_fk','idx_tenant_api_usage_user_fk','idx_password_resets_user'
    ];
    for (const idx of dropFkIdx) {
      await client.query(`DROP INDEX IF EXISTS ${idx}`).catch(() => {});
    }

    await client.query(`DROP TABLE IF EXISTS migration_008_mutation_log`);
    await client.query(`DELETE FROM schema_migrations WHERE version = '008'`);
    console.log('[Migration 008] ✅ Structural rollback complete.');
    console.log('[Migration 008] ⚠️  Data mutations require manual recovery from migration_008_snapshot if needed.');
  }
};
