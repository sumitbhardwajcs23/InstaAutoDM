// backend/src/services/billingRollover.js
const db = require('../db');

/**
 * Checks for users whose billing cycle (usage_period_start) is >= 30 days old
 * and resets their dm_usage_this_period to 0 while advancing usage_period_start to current date.
 * 
 * @returns {Promise<{ rolledOverCount: number, error?: string }>}
 */
async function rolloverBillingCycles() {
  try {
    // Find all users eligible for billing cycle rollover (period started 30+ days ago)
    const result = await db.prepare(`
      UPDATE users 
      SET dm_usage_this_period = 0,
          usage_period_start = date('now'),
          updated_at = datetime('now')
      WHERE usage_period_start IS NOT NULL 
        AND usage_period_start <= date('now', '-30 days')
    `).run();

    // Rollover normalized usage_counters table in sync
    await db.prepare(`
      UPDATE usage_counters
      SET dms_sent = 0,
          comments_processed = 0,
          stories_replied = 0,
          period_start = NOW(),
          period_end = NOW() + INTERVAL '30 days',
          updated_at = NOW()
      WHERE period_start IS NOT NULL 
        AND period_start <= NOW() - INTERVAL '30 days'
    `).run().catch(e => console.warn('[BillingRollover] usage_counters rollover notice:', e.message));

    const count = result?.rowCount || result?.changes || 0;
    if (count > 0) {
      console.log(`[BillingRollover] 🔄 Rolled over usage counter for ${count} user(s) past 30-day billing cycle.`);
    }
    return { rolledOverCount: count };
  } catch (err) {
    console.error('[BillingRollover] ❌ Error executing billing cycle rollover:', err.message);
    return { rolledOverCount: 0, error: err.message };
  }
}

let rolloverTimer = null;

/**
 * Starts the background billing rollover job.
 * Runs once immediately and then periodically (default: every 1 hour).
 * 
 * @param {number} [intervalMs=3600000] - Interval in ms (1 hour)
 */
function startBillingRolloverJob(intervalMs = 3600000) {
  if (rolloverTimer) {
    clearInterval(rolloverTimer);
  }

  // Initial run after short delay to let DB connect
  setTimeout(() => {
    rolloverBillingCycles().catch(err => {
      console.warn('[BillingRollover] Initial check notice:', err.message);
    });
  }, 5000);

  rolloverTimer = setInterval(() => {
    rolloverBillingCycles().catch(err => {
      console.warn('[BillingRollover] Scheduled check notice:', err.message);
    });
  }, intervalMs);

  // Unref timer so it doesn't block process exit in tests
  if (rolloverTimer && typeof rolloverTimer.unref === 'function') {
    rolloverTimer.unref();
  }

  console.log(`[BillingRollover] ⏱️ Billing cycle rollover job scheduled (interval: ${Math.round(intervalMs / 60000)}m)`);
}

function stopBillingRolloverJob() {
  if (rolloverTimer) {
    clearInterval(rolloverTimer);
    rolloverTimer = null;
  }
}

module.exports = {
  rolloverBillingCycles,
  startBillingRolloverJob,
  stopBillingRolloverJob
};
