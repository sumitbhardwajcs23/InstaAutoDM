// backend/src/routes/simulator.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const queue = require('../services/queue');

async function getAccount(userId) {
  return await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected' LIMIT 1").get(userId);
}

router.post('/comment', async (req, res) => {
  const comment_text = req.body.text || req.body.comment_text || 'GUIDE please!';
  const commenter_username = req.body.commenter_username || 'user_tester';
  const comment_id = req.body.comment_id || `c_${Date.now()}`;
  const days_ago = req.body.days_ago !== undefined ? req.body.days_ago : (req.body.days_old !== undefined ? req.body.days_old : 0);
  const duplicate = req.body.duplicate || false;

  const account = await getAccount(req.user.id);
  if (!account) return res.status(400).json({ error: 'No connected Instagram account' });

  const ts = Date.now() - (days_ago * 86400000);
  const data = {
    commentId: comment_id,
    text: comment_text,
    commenterId: `uid_${uuidv4().slice(0, 8)}`,
    commenterUsername: commenter_username,
    createdTime: ts
  };

  const jobId = queue.enqueue({ type: 'comments', accountId: account.ig_user_id, data });
  if (duplicate) {
    queue.enqueue({ type: 'comments', accountId: account.ig_user_id, data });
  }

  // Wait for worker processing
  await new Promise(r => setTimeout(r, 300));

  const reply = await db.prepare('SELECT * FROM comment_replies WHERE comment_id = ?').get(comment_id);
  const matchedRule = (await db.prepare('SELECT * FROM automation_rules WHERE instagram_account_id = ? AND is_active = 1').all(account.id)).find(r => {
    return queue.matchKeyword(comment_text, r.trigger_keyword, r.match_mode);
  });

  let action = 'no_match';
  let reply_sent = null;
  let reason = 'No active automation rule matched comment text.';

  if (reply) {
    if (reply.status === 'sent') {
      action = 'private_reply_sent';
      reply_sent = reply.reply_sent;
      reason = 'Matched keyword rule and private reply dispatched successfully.';
    } else if (reply.status === 'window_closed') {
      action = 'window_closed';
      reason = 'Rejected: Comment is older than Meta 7-day cutoff limit.';
    } else if (reply.status === 'usage_capped') {
      action = 'usage_capped';
      reason = 'Rejected: Free plan monthly 1,000 DM cap exceeded.';
    } else if (reply.status === 'rate_limited') {
      action = 'rate_limited';
      reason = 'Throttled: 120/hr sliding window limit exceeded.';
    } else {
      action = reply.status;
      reason = `Status: ${reply.status}`;
    }
  }

  res.json({
    success: true,
    jobId,
    comment_id,
    action,
    rule_matched: matchedRule ? matchedRule.trigger_keyword : null,
    reply_sent,
    reason,
    result: reply || { status: action },
    logs: [
      `[Webhook Ingest] Received comment "${comment_text}" from @${commenter_username}`,
      `[Age Check] Comment timestamp: ${new Date(ts).toISOString()} (${days_ago} days ago)`,
      `[Rule Match] ${matchedRule ? `Matched "${matchedRule.trigger_keyword}"` : 'No rule match'}`,
      `[Pipeline Result] Action: ${action} - ${reason}`
    ]
  });
});

router.post('/dm', async (req, res) => {
  const text = req.body.text || req.body.message_text || req.body.message || 'PRICING';
  const sender_username = req.body.sender_username || req.body.username || 'test_lead';
  const sender_id = req.body.sender_id || `uid_${uuidv4().slice(0, 8)}`;
  const hours_ago = req.body.hours_ago !== undefined ? req.body.hours_ago : 0;

  const account = await getAccount(req.user.id);
  if (!account) return res.status(400).json({ error: 'No connected Instagram account' });

  const ts = Date.now() - (hours_ago * 3600000);
  const messageId = `mid_${uuidv4().slice(0, 12)}`;
  const data = {
    messageId,
    senderId: sender_id,
    senderUsername: sender_username,
    text,
    timestamp: ts
  };

  const jobId = queue.enqueue({ type: 'messages', accountId: account.ig_user_id, data });
  await new Promise(r => setTimeout(r, 500));

  const conv = await db.prepare('SELECT * FROM conversations WHERE instagram_account_id = ? AND ig_scoped_user_id = ?').get(account.id, sender_id);
  const sentMsg = conv ? await db.prepare("SELECT * FROM messages WHERE conversation_id = ? AND direction = 'outbound' ORDER BY created_at DESC LIMIT 1").get(conv.id) : null;
  const matchedRule = (await db.prepare("SELECT * FROM automation_rules WHERE instagram_account_id = ? AND type = 'dm_keyword_reply' AND is_active = 1").all(account.id)).find(r => {
    return queue.matchKeyword(text, r.trigger_keyword, r.match_mode);
  });

  let action = 'no_match';
  let reply_sent = null;
  let reason = 'Inbound message logged. No auto-reply rule matched keyword.';

  if (hours_ago > 24) {
    action = 'window_closed';
    reason = 'Rejected: 24-hour messaging window has elapsed.';
  } else if (sentMsg && sentMsg.status === 'sent') {
    action = 'dm_reply_sent';
    reply_sent = sentMsg.content; // messages table uses 'content' column, not 'text'
    reason = 'Inbound DM matched trigger keyword and 24h compliance window is active.';
  } else if (sentMsg && sentMsg.status === 'usage_capped') {
    action = 'usage_capped';
    reason = 'Free plan 1,000 DM limit reached.';
  }

  res.json({
    success: true,
    jobId,
    message_id: messageId,
    action,
    rule_matched: matchedRule ? matchedRule.trigger_keyword : null,
    reply_sent,
    reason,
    logs: [
      `[Webhook Ingest] Inbound DM: "${text}" from @${sender_username}`,
      `[Compliance Check] 24h window expires at: ${new Date(ts + 24 * 3600000).toISOString()}`,
      `[Rule Match] ${matchedRule ? `Matched "${matchedRule.trigger_keyword}"` : 'No trigger match'}`,
      `[Outbound Delivery] ${action}: ${reason}`
    ]
  });
});

router.post('/burst', async (req, res) => {
  const count = Math.min(250, Math.max(1, parseInt(req.body.count || 10, 10)));
  const type = req.body.type || 'comment';
  const keyword = req.body.keyword || (type === 'dm' ? 'PRICING' : 'GUIDE');

  const account = await getAccount(req.user.id);
  if (!account) return res.status(400).json({ error: 'No connected Instagram account' });

  let sent = 0;
  let rate_limited = 0;

  for (let i = 1; i <= count; i++) {
    const isUnderLimit = queue.checkRateLimit(account.id, type === 'dm' ? 'messages' : 'comment_to_dm');
    if (isUnderLimit) {
      sent++;
      if (type === 'dm') {
        queue.enqueue({
          type: 'messages',
          accountId: account.ig_user_id,
          data: {
            messageId: `burst_mid_${Date.now()}_${i}`,
            senderId: `burst_user_${i}`,
            senderUsername: `burst_fan_${i}`,
            text: keyword,
            timestamp: Date.now()
          }
        });
      } else {
        queue.enqueue({
          type: 'comments',
          accountId: account.ig_user_id,
          data: {
            commentId: `burst_cid_${Date.now()}_${i}`,
            text: keyword,
            commenterId: `burst_user_${i}`,
            commenterUsername: `burst_fan_${i}`,
            createdTime: Date.now()
          }
        });
      }
    } else {
      rate_limited++;
    }
  }

  res.json({
    success: true,
    total: count,
    sent,
    rate_limited,
    type,
    message: `Processed ${count} burst events: ${sent} accepted into sliding window, ${rate_limited} rate-limited.`
  });
});

module.exports = router;
