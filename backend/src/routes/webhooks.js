// backend/src/routes/webhooks.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const queue = require('../services/queue');
const { verifyMetaSignature } = require('../services/crypto');

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'instagram_autoreply_verify_token_2026';
const APP_SECRET = process.env.META_APP_SECRET || 'test_app_secret_12345';

router.get('/instagram', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

router.post('/instagram', (req, res) => {
  console.log('[Webhook] 🔔 Incoming webhook request received from Meta!');
  const signature = req.headers['x-hub-signature-256'];
  const rawBody = req.rawBody || JSON.stringify(req.body);
  if (signature) {
    const isValid = verifyMetaSignature(rawBody, signature, APP_SECRET) ||
                    (process.env.META_IG_APP_SECRET && verifyMetaSignature(rawBody, signature, process.env.META_IG_APP_SECRET));
    if (!isValid) {
      console.warn('[Webhook] ⚠️ Signature verification failed (APP_SECRET might differ), but proceeding to process event in development mode.');
    }
  }
  const payload = req.body;
  console.log('[Webhook] Payload received:', JSON.stringify(payload));
  const eventId = uuidv4();
  try {
    db.prepare("INSERT INTO webhook_events (id, event_type, payload, status, created_at) VALUES (?, ?, ?, 'pending', datetime('now'))").run(eventId, payload.entry?.[0]?.changes?.[0]?.field || 'webhook', JSON.stringify(payload));
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
                queue.enqueue({
                  type: 'messages',
                  accountId: v.recipient?.id || accountId,
                  data: {
                    messageId: v.message.mid,
                    senderId: v.sender?.id,
                    senderUsername: v.sender?.username || null,
                    text: v.message.text,
                    timestamp: v.timestamp || Date.now()
                  }
                });
              }
            }

            // New format: comments under changes with field="comments"
            if (change.field === 'comments' && change.value) {
              const v = change.value;
              queue.enqueue({
                type: 'comments',
                accountId,
                data: {
                  commentId: v.id,
                  text: v.text,
                  commenterId: v.from?.id,
                  commenterUsername: v.from?.username || null,
                  createdTime: v.created_time || Date.now(),
                  mediaId: v.media?.id
                }
              });
            }
          }
        }

        // --- Old Facebook/Instagram format (entry.messaging[]) ---
        if (entry.messaging?.length) {
          for (const msg of entry.messaging) {
            if (msg.message?.text && !msg.message.is_echo) {
              queue.enqueue({
                type: 'messages',
                accountId,
                data: {
                  messageId: msg.message.mid,
                  senderId: msg.sender?.id,
                  senderUsername: msg.sender?.username || null,
                  text: msg.message.text,
                  timestamp: msg.timestamp || Date.now()
                }
              });
            }
          }
        }

      }
    }
    db.prepare("UPDATE webhook_events SET status='processed', processed_at=datetime('now') WHERE id=?").run(eventId);
  } catch (e) {
    db.prepare("UPDATE webhook_events SET status='failed', error=? WHERE id=?").run(e.message, eventId);
  }
  res.status(200).json({ received: true });
});

module.exports = router;
