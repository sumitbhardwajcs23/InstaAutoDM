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
  const startTime = Date.now();
  const signatureHash = signature ? require('crypto').createHash('sha256').update(signature).digest('hex') : null;
  const payload = req.body;
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.entry) || (payload.object !== 'instagram' && payload.object !== 'page')) {
    console.warn('[Webhook] ❌ Rejected webhook: Malformed payload or unsupported object type:', payload?.object);
    return res.status(400).json({ error: 'Invalid webhook payload structure' });
  }

  // Helper to log audit entries into webhook_events
  async function logWebhookEvent({ idempotencyKey, accountId, senderId, eventType, payloadData, status, error = null }) {
    try {
      const id = uuidv4();
      const sanitized = JSON.stringify(payloadData || {}).replace(/("access_token"|"token"):"[^"]+"/g, '$1:"[REDACTED]"');
      const elapsedMs = Date.now() - startTime;
      await db.prepare(`
        INSERT INTO webhook_events (
          id, idempotency_key, account_id, sender_id, event_type, payload, signature_hash, delivery_timestamp, processing_time_ms, status, error, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), ?, ?, ?, to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
      `).run(
        id,
        idempotencyKey || null,
        accountId || 'unknown',
        senderId || null,
        eventType || 'webhook',
        sanitized,
        signatureHash,
        elapsedMs,
        status,
        error ? String(error).slice(0, 500) : null
      );
    } catch (auditErr) {
      console.error('[WebhookAudit] Save error:', auditErr.message);
    }
  }

  // Scrub sensitive tokens before logging
  const safeLog = JSON.stringify(payload).replace(/("access_token"|"token"):"[^"]+"/g, '$1:"[REDACTED]"');
  console.log('[Webhook] Payload received (sanitized):', safeLog);

  const now = Date.now();
  const maxDriftMs = 10 * 60 * 1000; // 10 minutes replay window
  let totalEvents = 0;
  let duplicateEvents = 0;
  let staleEvents = 0;
  let enqueuedEvents = 0;

  try {
    if (payload.entry?.length) {
      for (const entry of payload.entry) {
        const entryTimeMs = entry.time ? (Number(entry.time) < 1e11 ? Number(entry.time) * 1000 : Number(entry.time)) : now;
        const accountId = entry.id;

        // Check entry-level replay freshness
        const isEntryStale = (process.env.NODE_ENV === 'production' || process.env.ENFORCE_REPLAY_CHECK === 'true') && 
                             (now - entryTimeMs > maxDriftMs || entryTimeMs - now > 5 * 60 * 1000);

        // --- 1. Instagram Business API format (entry.changes[]) ---
        if (entry.changes?.length) {
          for (const change of entry.changes) {
            totalEvents++;

            // DMs under changes with field="messages"
            if (change.field === 'messages' && change.value) {
              const v = change.value;
              if (v.message?.text && !v.message?.is_echo) {
                const targetAccountId = v.recipient?.id || accountId;
                const idempotencyKey = `msg_${v.message.mid || uuidv4()}`;

                if (isEntryStale) {
                  staleEvents++;
                  console.warn(`[Webhook] ⏱️ Discarding stale replay message event ${v.message.mid}`);
                  await logWebhookEvent({
                    idempotencyKey,
                    accountId: targetAccountId,
                    senderId: v.sender?.id,
                    eventType: 'messages',
                    payloadData: v,
                    status: 'stale_replayed'
                  });
                  continue;
                }

                // Duplicate Detection
                const isDup = queue.isDuplicate(idempotencyKey) || await queue.isDuplicateInDb(idempotencyKey);
                if (isDup) {
                  duplicateEvents++;
                  console.log(`[Webhook] ⚠️ Duplicate webhook DM ignored for key: ${idempotencyKey}`);
                  await logWebhookEvent({
                    idempotencyKey,
                    accountId: targetAccountId,
                    senderId: v.sender?.id,
                    eventType: 'messages',
                    payloadData: v,
                    status: 'duplicate_ignored'
                  });
                  continue;
                }

                const isStoryReply = Boolean(
                  v.message.reply_to?.story || 
                  v.message.is_story_reply || 
                  v.message.story_share ||
                  (v.message.attachments && v.message.attachments.some(a => a.type === 'story_mention' || a.type === 'story_share'))
                );
                const replyToStoryId = v.message.reply_to?.story?.id || null;
                const quickReplyPayload = v.message.quick_reply?.payload || null;

                try {
                  queue.enqueue({
                    type: 'messages',
                    accountId: targetAccountId,
                    data: {
                      messageId: v.message.mid,
                      senderId: v.sender?.id,
                      senderUsername: v.sender?.username || null,
                      text: v.message.text,
                      timestamp: v.timestamp || entry.time || Date.now(),
                      isStoryReply,
                      replyToStoryId,
                      quickReplyPayload
                    }
                  });
                  enqueuedEvents++;
                  await logWebhookEvent({
                    idempotencyKey,
                    accountId: targetAccountId,
                    senderId: v.sender?.id,
                    eventType: 'messages',
                    payloadData: v,
                    status: 'enqueued'
                  });
                  console.log(`[Webhook] 📥 Enqueued DM ${v.message.mid} to background worker`);
                } catch (msgErr) {
                  console.error(`[Webhook] ❌ Failed to enqueue DM ${v.message.mid}:`, msgErr.message);
                  await logWebhookEvent({
                    idempotencyKey,
                    accountId: targetAccountId,
                    senderId: v.sender?.id,
                    eventType: 'messages',
                    payloadData: v,
                    status: 'failed',
                    error: msgErr.message
                  });
                }
              }
            }

            // Comments under changes with field="comments"
            if (change.field === 'comments' && change.value) {
              const v = change.value;
              const idempotencyKey = `comm_${v.id || uuidv4()}`;

              if (isEntryStale) {
                staleEvents++;
                console.warn(`[Webhook] ⏱️ Discarding stale replay comment event ${v.id}`);
                await logWebhookEvent({
                  idempotencyKey,
                  accountId,
                  senderId: v.from?.id,
                  eventType: 'comments',
                  payloadData: v,
                  status: 'stale_replayed'
                });
                continue;
              }

              // Duplicate Detection
              const isDup = queue.isDuplicate(idempotencyKey) || await queue.isDuplicateInDb(idempotencyKey);
              if (isDup) {
                duplicateEvents++;
                console.log(`[Webhook] ⚠️ Duplicate webhook comment ignored for key: ${idempotencyKey}`);
                await logWebhookEvent({
                  idempotencyKey,
                  accountId,
                  senderId: v.from?.id,
                  eventType: 'comments',
                  payloadData: v,
                  status: 'duplicate_ignored'
                });
                continue;
              }

              try {
                queue.enqueue({
                  type: 'comments',
                  accountId,
                  data: {
                    commentId: v.id,
                    text: v.text,
                    commenterId: v.from?.id,
                    commenterUsername: v.from?.username || null,
                    createdTime: v.created_time || entry.time || Date.now(),
                    mediaId: v.media?.id
                  }
                });
                enqueuedEvents++;
                await logWebhookEvent({
                  idempotencyKey,
                  accountId,
                  senderId: v.from?.id,
                  eventType: 'comments',
                  payloadData: v,
                  status: 'enqueued'
                });
                console.log(`[Webhook] 📥 Enqueued comment ${v.id} to background worker`);
              } catch (commErr) {
                console.error(`[Webhook] ❌ Failed to enqueue comment ${v.id}:`, commErr.message);
                await logWebhookEvent({
                  idempotencyKey,
                  accountId,
                  senderId: v.from?.id,
                  eventType: 'comments',
                  payloadData: v,
                  status: 'failed',
                  error: commErr.message
                });
              }
            }
          }
        }

        // --- 2. Legacy Facebook/Instagram format (entry.messaging[]) ---
        if (entry.messaging?.length) {
          for (const msg of entry.messaging) {
            if (msg.message?.text && !msg.message.is_echo) {
              totalEvents++;
              const idempotencyKey = `msg_${msg.message.mid || uuidv4()}`;

              if (isEntryStale) {
                staleEvents++;
                console.warn(`[Webhook] ⏱️ Discarding stale replay messaging event ${msg.message.mid}`);
                await logWebhookEvent({
                  idempotencyKey,
                  accountId,
                  senderId: msg.sender?.id,
                  eventType: 'messages',
                  payloadData: msg,
                  status: 'stale_replayed'
                });
                continue;
              }

              const isDup = queue.isDuplicate(idempotencyKey) || await queue.isDuplicateInDb(idempotencyKey);
              if (isDup) {
                duplicateEvents++;
                console.log(`[Webhook] ⚠️ Duplicate webhook messaging DM ignored for key: ${idempotencyKey}`);
                await logWebhookEvent({
                  idempotencyKey,
                  accountId,
                  senderId: msg.sender?.id,
                  eventType: 'messages',
                  payloadData: msg,
                  status: 'duplicate_ignored'
                });
                continue;
              }

              const isStoryReply = Boolean(
                msg.message.reply_to?.story || 
                msg.message.is_story_reply || 
                msg.message.story_share ||
                (msg.message.attachments && msg.message.attachments.some(a => a.type === 'story_mention' || a.type === 'story_share'))
              );
              const replyToStoryId = msg.message.reply_to?.story?.id || null;
              const quickReplyPayload = msg.message.quick_reply?.payload || null;

              try {
                queue.enqueue({
                  type: 'messages',
                  accountId,
                  data: {
                    messageId: msg.message.mid,
                    senderId: msg.sender?.id,
                    senderUsername: msg.sender?.username || null,
                    text: msg.message.text,
                    timestamp: msg.timestamp || entry.time || Date.now(),
                    isStoryReply,
                    replyToStoryId,
                    quickReplyPayload
                  }
                });
                enqueuedEvents++;
                await logWebhookEvent({
                  idempotencyKey,
                  accountId,
                  senderId: msg.sender?.id,
                  eventType: 'messages',
                  payloadData: msg,
                  status: 'enqueued'
                });
                console.log(`[Webhook] 📥 Enqueued messaging DM ${msg.message.mid} to background worker`);
              } catch (msgErr) {
                console.error(`[Webhook] ❌ Failed to enqueue messaging DM ${msg.message.mid}:`, msgErr.message);
                await logWebhookEvent({
                  idempotencyKey,
                  accountId,
                  senderId: msg.sender?.id,
                  eventType: 'messages',
                  payloadData: msg,
                  status: 'failed',
                  error: msgErr.message
                });
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('[Webhook] Fatal processing error:', e.message);
  }

  // If all events were duplicates or stale, inform client transparently while returning 200 OK
  const isAllDuplicate = totalEvents > 0 && duplicateEvents === totalEvents;
  const isAllStale = totalEvents > 0 && staleEvents === totalEvents;

  res.status(200).json({ 
    received: true, 
    duplicate: isAllDuplicate,
    stale: isAllStale,
    stats: {
      total: totalEvents,
      enqueued: enqueuedEvents,
      duplicate: duplicateEvents,
      stale: staleEvents
    }
  });
});

// ── GET /api/webhooks/audit — Queryable Webhook Event Audit Trail ─────────
router.get('/audit', async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const status = req.query.status;
    const accountId = req.query.account_id;

    let query = "SELECT * FROM webhook_events";
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
    if (accountId) {
      conditions.push("account_id = ?");
      params.push(accountId);
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY created_at DESC LIMIT " + limit;

    const events = await db.prepare(query).all(...params) || [];
    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (err) {
    console.error('[WebhooksAudit] Query error:', err.message);
    res.status(500).json({ error: 'Failed to query webhook audit events' });
  }
});

// ── GET /api/webhooks/dlq — Dead-Letter Queue Inspection ─────────────────
router.get('/dlq', async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const status = req.query.status || 'unresolved';

    const items = await db.prepare(`
      SELECT * FROM dead_letter_queue
      WHERE status = ?
      ORDER BY failed_at DESC
      LIMIT ?
    `).all(status, limit) || [];

    const totalUnresolved = (await db.prepare("SELECT COUNT(*) as c FROM dead_letter_queue WHERE status = 'unresolved'").get())?.c || 0;

    res.json({
      success: true,
      unresolved_count: totalUnresolved,
      count: items.length,
      items
    });
  } catch (err) {
    console.error('[DLQ] Query error:', err.message);
    res.status(500).json({ error: 'Failed to query dead-letter queue' });
  }
});

// ── POST /api/webhooks/dlq/:id/retry — Reprocess Dead-Letter Job ─────────
router.post('/dlq/:id/retry', async (req, res) => {
  try {
    const dlqId = req.params.id;
    const result = await queue.reprocessDlqJob(dlqId);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('[DLQ] Reprocess error:', err.message);
    res.status(500).json({ error: 'Failed to reprocess dead-letter job' });
  }
});

// ── POST /api/webhooks/dlq/:id/resolve — Mark Dead-Letter Item Resolved ──
router.post('/dlq/:id/resolve', async (req, res) => {
  try {
    const dlqId = req.params.id;
    await db.prepare(`
      UPDATE dead_letter_queue SET
        status = 'resolved',
        resolved_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      WHERE id = ?
    `).run(dlqId);
    res.json({ success: true, message: 'Dead-letter item marked as resolved' });
  } catch (err) {
    console.error('[DLQ] Resolve error:', err.message);
    res.status(500).json({ error: 'Failed to resolve dead-letter item' });
  }
});

module.exports = router;
