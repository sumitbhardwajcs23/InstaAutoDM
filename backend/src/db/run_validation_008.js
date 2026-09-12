require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const c = await pool.connect();
  try {
    // A. admin_sessions columns
    const asCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='admin_sessions' ORDER BY ordinal_position");
    console.log('A. admin_sessions cols:', asCols.rows.map(r=>r.column_name).join(', '));

    // B. subscriptions columns
    const sCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='subscriptions' ORDER BY ordinal_position");
    console.log('B. subscriptions cols:', sCols.rows.map(r=>r.column_name).join(', '));

    // C. Duplicate active subscriptions
    const dupRes = await c.query("SELECT user_id, count(*) as cnt FROM subscriptions WHERE status IN ('active','trialing','past_due','grace_period') GROUP BY user_id HAVING count(*) > 1");
    console.log('C. Duplicate active subs (BLOCKING, must be 0):', dupRes.rowCount, JSON.stringify(dupRes.rows));

    // D. Cross-user invoice/subscription
    const crossRes = await c.query("SELECT i.id, i.user_id as iuid, s.user_id as suid FROM invoices i JOIN subscriptions s ON s.id = i.subscription_id WHERE i.user_id != s.user_id");
    console.log('D. Cross-user invoice/sub mismatch (BLOCKING, must be 0):', crossRes.rowCount, JSON.stringify(crossRes.rows));

    // E. Plan mismatch
    const planRes = await c.query("SELECT u.email, u.plan as up, s.plan as sp FROM users u LEFT JOIN subscriptions s ON s.user_id=u.id AND s.status IN ('active','trialing','grace_period') WHERE s.id IS NOT NULL AND u.plan != s.plan");
    console.log('E. Plan mismatch (users.plan vs subs.plan):', planRes.rowCount, JSON.stringify(planRes.rows));

    // F. subscription_status mismatch
    const usersHasSubStatus = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='subscription_status'");
    if (usersHasSubStatus.rowCount > 0) {
      const statRes = await c.query("SELECT u.email, u.subscription_status as uss, s.status as ss FROM users u LEFT JOIN subscriptions s ON s.user_id=u.id WHERE s.id IS NOT NULL AND u.subscription_status != s.status LIMIT 5");
      console.log('F. subscription_status mismatch:', statRes.rowCount, JSON.stringify(statRes.rows));
    } else {
      console.log('F. subscription_status column does NOT exist on users table');
    }

    // G. Coupon used_count drift
    const cDrift = await c.query("SELECT c.code, c.used_count, COALESCE(r.cnt,0) as actual FROM coupons c LEFT JOIN (SELECT coupon_id, count(*) as cnt FROM coupon_redemptions GROUP BY coupon_id) r ON r.coupon_id=c.id WHERE c.used_count != COALESCE(r.cnt,0)");
    console.log('G. Coupon used_count drift:', cDrift.rowCount, JSON.stringify(cDrift.rows));

    // H. Usage counter drift
    const uDrift = await c.query("SELECT u.email, u.dm_usage_this_period as uu, uc.dms_sent as cu FROM users u LEFT JOIN usage_counters uc ON uc.user_id=u.id WHERE ABS(u.dm_usage_this_period - COALESCE(uc.dms_sent,0)) > 5");
    console.log('H. Usage counter drift (>5 threshold):', uDrift.rowCount, JSON.stringify(uDrift.rows));

    // I. Admin session desync
    const sessDeSync = await c.query("SELECT id, is_active, is_revoked FROM admin_sessions WHERE (is_active=1 AND is_revoked=1) OR (is_active=0 AND is_revoked=0) LIMIT 5").catch(()=>({rows:[],rowCount:0}));
    console.log('I. Admin session is_active/is_revoked desync:', sessDeSync.rowCount, JSON.stringify(sessDeSync.rows));

    // J. Existing subscriptions unique indexes
    const idxRes = await c.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename='subscriptions'");
    console.log('J. Subscriptions indexes:', JSON.stringify(idxRes.rows.map(r=>({name:r.indexname, def:r.indexdef}))));

    // K. Missing FK indexes (simpler form to avoid PowerShell issues)
    const allFks = await c.query("SELECT tc.table_name, kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' ORDER BY tc.table_name, kcu.column_name");
    for (const fk of allFks.rows) {
      const hasIdx = await c.query(`SELECT 1 FROM pg_indexes WHERE tablename=$1 AND indexdef ILIKE $2 LIMIT 1`, [fk.table_name, `%(${fk.column_name})%`]);
      if (hasIdx.rowCount === 0) {
        console.log(`K. Missing FK index: ${fk.table_name}.${fk.column_name}`);
      }
    }

    // L. Billing period alignment sample
    const periodRes = await c.query("SELECT u.email, u.usage_period_start, uc.period_start as uc_period, s.current_period_start as sub_period, s.billing_cycle FROM users u LEFT JOIN usage_counters uc ON uc.user_id=u.id LEFT JOIN subscriptions s ON s.user_id=u.id LIMIT 5");
    console.log('L. Period alignment sample:', JSON.stringify(periodRes.rows, null, 2));

    // M. Check system_alerts columns
    const alertCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='system_alerts' ORDER BY ordinal_position");
    console.log('M. system_alerts cols:', alertCols.rows.map(r=>r.column_name).join(', '));

    // N. Check usage_counters columns
    const ucCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='usage_counters' ORDER BY ordinal_position");
    console.log('N. usage_counters cols:', ucCols.rows.map(r=>r.column_name).join(', '));

    // O. Check users columns (key ones)
    const userCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position");
    console.log('O. users cols:', userCols.rows.map(r=>r.column_name).join(', '));

    // P. Row counts
    const tableRowCounts = ['users','subscriptions','invoices','usage_counters','coupon_redemptions','admin_sessions','admin_users'];
    for (const t of tableRowCounts) {
      const cnt = await c.query(`SELECT COUNT(*) as cnt FROM ${t}`).catch(()=>({rows:[{cnt:'N/A'}]}));
      console.log(`P. ${t} row count: ${cnt.rows[0].cnt}`);
    }

    console.log('\n=== VALIDATION DONE ===');
  } finally {
    c.release();
    await pool.end();
  }
}
run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
