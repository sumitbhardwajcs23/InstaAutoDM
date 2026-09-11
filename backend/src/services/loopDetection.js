// backend/src/services/loopDetection.js
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// Configurable internal safety limit (NOT an official Meta limit)
const MAX_DAILY_AUTOMATED_DMS_PER_USER = parseInt(process.env.MAX_DAILY_AUTOMATED_DMS_PER_USER || '3', 10);
const RAPID_EXCHANGE_WINDOW_MS = 10 * 1000; // 10 seconds
const RAPID_EXCHANGE_THRESHOLD = 3;         // 3 messages within 10s
const REPEATED_CONTENT_THRESHOLD = 3;       // 3 identical responses in a row

/**
 * Validates whether an incoming event originated from the account itself.
 */
function isSelfEvent(account, senderId, senderUsername, isEcho = false) {
  if (isEcho) return true;
  if (!account) return false;

  const sId = String(senderId || '');
  if (sId && (
    sId === String(account.ig_user_id || '') ||
    sId === String(account.page_id || '') ||
    sId === String(account.fb_user_id || '')
  )) {
    return true;
  }

  const sUser = String(senderUsername || '').toLowerCase().replace(/^@/, '');
  const accUser = String(account.username || '').toLowerCase().replace(/^@/, '');
  if (sUser && accUser && sUser === accUser) {
    return true;
  }

  return false;
}

/**
 * Evaluates whether sending an automated response to recipient violates safety safeguards or indicates a bot loop.
 *
 * @param {Object} params
 * @param {Object} params.account - instagram_accounts DB row
 * @param {string} params.recipientId - IG scoped user ID or recipient ID
 * @param {string} params.recipientUsername - username of recipient
 * @param {string} params.replyContent - intended reply text
 * @param {string} params.ruleId - automation rule ID
 * @param {string} params.conversationId - conversations DB ID
 * @returns {Promise<{ allow: boolean, reason?: string, incidentId?: string }>}
 */
async function checkOutboundSafety({
  account,
  recipientId,
  recipientUsername,
  replyContent,
  ruleId = null,
  conversationId = null
}) {
  if (!account || !recipientId) {
    return { allow: true };
  }

  // Check 1: Self-event check
  if (isSelfEvent(account, recipientId, recipientUsername)) {
    return {
      allow: false,
      reason: 'self_event_prevented',
      details: `Target recipient (${recipientId}/@${recipientUsername}) matches account's own identities.`
    };
  }

  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // Check 2: Conversation-level state & paused check
  let conv = null;
  if (conversationId) {
    conv = await db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
  } else {
    conv = await db.prepare(
      'SELECT * FROM conversations WHERE instagram_account_id = ? AND ig_scoped_user_id = ?'
    ).get(account.id, recipientId);
  }

  if (conv) {
    // If conversation is already paused due to loop detection, halt immediately
    if (conv.status === 'loop_paused') {
      return {
        allow: false,
        reason: 'conversation_loop_paused',
        details: 'Conversation automation is currently paused due to an active loop incident.'
      };
    }

    // Check 3: Internal Per-User Daily Automated DM Limit (Internal Safeguard)
    // Note: This is an internal product safeguard to prevent spam and accidental bot looping, NOT an official Meta limit.
    let dailyCount = conv.daily_automated_dm_count || 0;
    const lastDate = conv.last_automated_dm_date;
    if (lastDate !== today) {
      dailyCount = 0;
    }

    if (dailyCount >= MAX_DAILY_AUTOMATED_DMS_PER_USER) {
      console.warn(`[LoopDetection] 🛑 Internal daily safety limit reached (${dailyCount}/${MAX_DAILY_AUTOMATED_DMS_PER_USER}) for recipient @${recipientUsername || recipientId}. Suppressing additional automated DM.`);
      return {
        allow: false,
        reason: 'internal_daily_limit_reached',
        details: `Reached internal product safeguard of ${MAX_DAILY_AUTOMATED_DMS_PER_USER} automated DMs per user per 24 hours.`
      };
    }

    // Check 4: Rapid ping-pong exchange cadence
    // Query recent messages in this conversation from the last 60 seconds
    const recentMessages = await db.prepare(`
      SELECT direction, content, created_at FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(conv.id);

    if (recentMessages && recentMessages.length >= RAPID_EXCHANGE_THRESHOLD) {
      const windowMessages = recentMessages.filter(m => {
        const t = new Date(m.created_at).getTime();
        return !isNaN(t) && (now - t < RAPID_EXCHANGE_WINDOW_MS);
      });

      if (windowMessages.length >= RAPID_EXCHANGE_THRESHOLD) {
        // Detected rapid oscillation between bot and recipient!
        const incidentId = await recordLoopIncident({
          accountId: account.id,
          conversationId: conv.id,
          targetUserId: recipientId,
          ruleId,
          reason: 'rapid_cadence_ping_pong',
          details: `Detected ${windowMessages.length} messages within ${(RAPID_EXCHANGE_WINDOW_MS / 1000)}s between @${account.username} and @${recipientUsername || recipientId}.`
        });

        // Pause conversation
        await db.prepare("UPDATE conversations SET status = 'loop_paused', updated_at = datetime('now') WHERE id = ?").run(conv.id);

        return {
          allow: false,
          reason: 'rapid_cadence_detected',
          incidentId
        };
      }
    }

    // Check 5: Repeated identical automated responses
    if (replyContent && recentMessages && recentMessages.length >= (REPEATED_CONTENT_THRESHOLD - 1)) {
      const outboundMessages = recentMessages.filter(m => m.direction === 'outbound');
      if (outboundMessages.length >= (REPEATED_CONTENT_THRESHOLD - 1)) {
        const cleanContent = replyContent.trim().toLowerCase();
        const consecutiveSame = outboundMessages.slice(0, REPEATED_CONTENT_THRESHOLD - 1).every(m => 
          (m.content || '').trim().toLowerCase() === cleanContent
        );

        if (consecutiveSame) {
          const incidentId = await recordLoopIncident({
            accountId: account.id,
            conversationId: conv.id,
            targetUserId: recipientId,
            ruleId,
            reason: 'repeated_identical_replies',
            details: `Identical automated reply was dispatched ${REPEATED_CONTENT_THRESHOLD - 1} times consecutively without human intervention.`
          });

          await db.prepare("UPDATE conversations SET status = 'loop_paused', updated_at = datetime('now') WHERE id = ?").run(conv.id);

          return {
            allow: false,
            reason: 'repeated_content_loop',
            incidentId
          };
        }
      }
    }
  }

  return { allow: true };
}

/**
 * Records a detected loop incident and updates security audit state.
 */
async function recordLoopIncident({
  accountId,
  conversationId,
  targetUserId,
  ruleId,
  reason,
  details
}) {
  const incidentId = uuidv4();
  try {
    await db.prepare(`
      INSERT INTO automation_loop_incidents (
        id, instagram_account_id, conversation_id, target_user_id, trigger_rule_id, loop_reason, details, status, detected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
    `).run(
      incidentId,
      accountId,
      conversationId || null,
      targetUserId,
      ruleId || null,
      reason,
      details || null
    );

    console.warn(`[LoopDetection] 🚨 Automation loop incident recorded (${incidentId}): ${reason} for recipient ${targetUserId}`);
  } catch (err) {
    console.error('[LoopDetection] Failed to record loop incident:', err.message);
  }
  return incidentId;
}

/**
 * Increments the daily automated DM counter for a conversation.
 */
async function recordAutomatedDmSent(conversationId) {
  if (!conversationId) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const conv = await db.prepare('SELECT daily_automated_dm_count, last_automated_dm_date FROM conversations WHERE id = ?').get(conversationId);
    let newCount = 1;
    if (conv && conv.last_automated_dm_date === today) {
      newCount = (conv.daily_automated_dm_count || 0) + 1;
    }
    await db.prepare(`
      UPDATE conversations SET
        daily_automated_dm_count = ?,
        last_automated_dm_date = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(newCount, today, conversationId);
  } catch (err) {
    // Non-blocking update failure
  }
}

/**
 * Resumes an automation that was paused by loop detection.
 */
async function resolveLoopIncident(incidentId, accountId) {
  const incident = await db.prepare('SELECT * FROM automation_loop_incidents WHERE id = ? AND instagram_account_id = ?').get(incidentId, accountId);
  if (!incident) return null;

  await db.prepare("UPDATE automation_loop_incidents SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?").run(incidentId);

  if (incident.conversation_id) {
    await db.prepare("UPDATE conversations SET status = 'open', updated_at = datetime('now') WHERE id = ?").run(incident.conversation_id);
  }

  console.log(`[LoopDetection] ✅ Loop incident ${incidentId} resolved. Conversation reopened.`);
  return incident;
}

module.exports = {
  isSelfEvent,
  checkOutboundSafety,
  recordLoopIncident,
  recordAutomatedDmSent,
  resolveLoopIncident,
  MAX_DAILY_AUTOMATED_DMS_PER_USER
};
