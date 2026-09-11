// backend/src/routes/webhooks.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const queue = require('../services/queue');
const { verifyMetaSignature } = require('../services/crypto');
const { webhookLimiter } = require('../middleware/rateLimiter');
const { META_VERIFY_TOKEN, META_APP_SECRET } = require('../config/secrets');

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || META_VERIFY_TOKEN;
const APP_SECRET = process.env.META_APP_SECRET || META_APP_SECRET;

router.get('/instagram', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

router.post('/instagram', webhookLimiter, async (req, res) => {
  console.log('[Webhook] 🔔 Incoming webhook request received from Meta!');
  const signature = req.headers['x-hub-signature-256'];
  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

  const bypassVerification = process.env.NODE_ENV === 'test' && process.env.SKIP_WEBHOOK_VERIFY === 'true';

  if (!bypassVerification) {
    if (!signature) {
      console.warn('[Webhook] ❌ Rejected webhook: Missing x-hub-signature-256 header.');
      return res.status(401).json({ error: 'Missing x-hub-signature-256 header' });
    }

    const isValid = verifyMetaSignature(rawBody, signature, APP_SECRET) ||
                    (process.env.META_IG_APP_SECRET && verifyMetaSignature(rawBody, signature, process.env.META_IG_APP_SECRET));
    if (!isValid) {
      console.warn('[Webhook] ❌ Rejected webhook: Invalid HMAC signature.');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  }
  const payload = req.body;
  console.log('[Webhook] Payload received:', JSON.stringify(payload));
  const eventId = uuidv4();
  try {
    await db.prepare("INSERT INTO webhook_events (id, event_type, payload, status, created_at) VALUES (?, ?, ?, 'pending', datetime('now'))").run(eventId, payload.entry?.[0]?.changes?.[0]?.field || 'webhook', JSON.stringify(payload));
  } catch (e) { console.error('[Webhook] Save error:', e.message); }

  try {
    if (payload.entry?.length) {
      for (const entry of payload.entry) {
        const accountId = entry.id;

        // --- New Instagram Business API format (entry.changes[]) ---
        if (entry.changes?.length) {
          for (const change of entry.changes) {

            // New format: DMs under changes with field="messages"
            if (change.field === 'messages' && change.value) {
              const v = change.value;
              if (v.message?.text && !v.message?.is_echo) {
                const targetAccountId = v.recipient?.id || accountId;
                const isStoryReply = Boolean(
                  v.message.reply_to?.story || 
                  v.message.is_story_reply || 
                  v.message.story_share ||
                  (v.message.attachments && v.message.attachments.some(a => a.type === 'story_mention' || a.type === 'story_share'))
                );
                const replyToStoryId = v.message.reply_to?.story?.id || null;
                const quickReplyPayload = v.message.quick_reply?.payload || null;

                console.log(`[Webhook] ✉️ Direct DM event (isStoryReply: ${isStoryReply}, quickReply: ${quickReplyPayload || 'none'}) for accountId ${targetAccountId} from @${v.sender?.username || v.sender?.id}: "${v.message.text}"`);
                try {
                  await queue.processMessage(targetAccountId, {
                    messageId: v.message.mid,
                    senderId: v.sender?.id,
                    senderUsername: v.sender?.username || null,
                    text: v.message.text,
                    timestamp: v.timestamp || entry.time || Date.now(),
                    isStoryReply,
                    replyToStoryId,
                    quickReplyPayload
                  });
                  console.log(`[Webhook] ✅ Successfully processed DM ${v.message.mid}`);
                } catch (msgErr) {
                  console.error(`[Webhook] ❌ Failed to process DM ${v.message.mid}:`, msgErr.message);
                }
              }
            }

            // New format: comments under changes with field="comments"
            if (change.field === 'comments' && change.value) {
              const v = change.value;
              console.log(`[Webhook] 💬 Direct Comment event for accountId ${accountId} (mediaId: ${v.media?.id || 'none'}) from @${v.from?.username || v.from?.id}: "${v.text}" (commentId: ${v.id})`);
              try {
                await queue.processComment(accountId, {
                  commentId: v.id,
                  text: v.text,
                  commenterId: v.from?.id,
                  commenterUsername: v.from?.username || null,
                  createdTime: v.created_time || entry.time || Date.now(),
                  mediaId: v.media?.id
                });
                console.log(`[Webhook] ✅ Successfully processed comment ${v.id}`);
              } catch (commErr) {
                console.error(`[Webhook] ❌ Failed to process comment ${v.id}:`, commErr.message);
              }
            }
          }
        }

        // --- Old Facebook/Instagram format (entry.messaging[]) ---
        if (entry.messaging?.length) {
          for (const msg of entry.messaging) {
            if (msg.message?.text && !msg.message.is_echo) {
              const isStoryReply = Boolean(
                msg.message.reply_to?.story || 
                msg.message.is_story_reply || 
                msg.message.story_share ||
                (msg.message.attachments && msg.message.attachments.some(a => a.type === 'story_mention' || a.type === 'story_share'))
              );
              const replyToStoryId = msg.message.reply_to?.story?.id || null;
              const quickReplyPayload = msg.message.quick_reply?.payload || null;

              console.log(`[Webhook] ✉️ Messaging DM event (isStoryReply: ${isStoryReply}, quickReply: ${quickReplyPayload || 'none'}) for accountId ${accountId} from @${msg.sender?.username || msg.sender?.id}: "${msg.message.text}"`);
              try {
                await queue.processMessage(accountId, {
                  messageId: msg.message.mid,
                  senderId: msg.sender?.id,
                  senderUsername: msg.sender?.username || null,
                  text: msg.message.text,
                  timestamp: msg.timestamp || entry.time || Date.now(),
                  isStoryReply,
                  replyToStoryId,
                  quickReplyPayload
                });
                console.log(`[Webhook] ✅ Successfully processed messaging DM ${msg.message.mid}`);
              } catch (msgErr) {
                console.error(`[Webhook] ❌ Failed to process messaging DM ${msg.message.mid}:`, msgErr.message);
              }
            }
          }
        }

      }
    }
    await db.prepare("UPDATE webhook_events SET status='processed', processed_at=datetime('now') WHERE id=?").run(eventId);
  } catch (e) {
    console.error('[Webhook] Fatal processing error:', e.message);
    await db.prepare("UPDATE webhook_events SET status='failed', error=? WHERE id=?").run(e.message, eventId);
  }
  res.status(200).json({ received: true });
});

module.exports = router;
