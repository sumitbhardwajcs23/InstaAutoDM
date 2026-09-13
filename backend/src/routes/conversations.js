// backend/src/routes/conversations.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { decrypt } = require('../services/crypto');
const profileCache = require('../services/profileCache');
const { dmLimitFor } = require('../constants/planLimits');

// KNOWN_TESTERS is now part of profileCache — no need to duplicate here
const KNOWN_TESTERS = profileCache.KNOWN_USERS;
const redisClient = require('../services/redisClient');

const inflightAccounts = new Map();
async function getAccountForUser(userId, accountId) {
  if (!userId) return null;
  const key = `${userId}:${accountId || 'default'}`;
  const cacheKey = `cache:acc:${key}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return cached;
  } catch (_) {}

  let fetchPromise = inflightAccounts.get(key);
  if (!fetchPromise) {
    fetchPromise = (async () => {
      try {
        let acc;
        if (accountId) {
          acc = await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND id = ? LIMIT 1").get(userId, accountId);
        } else {
          acc = await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected' ORDER BY updated_at DESC LIMIT 1").get(userId);
        }
        if (acc) {
          redisClient.set(cacheKey, acc, 30).catch(() => {});
        }
        return acc || null;
      } finally {
        inflightAccounts.delete(key);
      }
    })();
    inflightAccounts.set(key, fetchPromise);
  }
  return await fetchPromise;
}

const inflightConvs = new Map();

// GET /api/conversations
router.get('/', async (req, res) => {
  const { limit = 50, offset = 0, status, account_id } = req.query;
  const convKey = `${req.user.id}:${account_id || 'default'}:${status || 'all'}:${limit}:${offset}`;
  const cacheKey = `cache:convs:${convKey}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
  } catch (_) {}

  let fetchPromise = inflightConvs.get(convKey);
  if (!fetchPromise) {
    fetchPromise = (async () => {
      try {
        const account = await getAccountForUser(req.user.id, account_id);
        if (!account) return { total: 0, conversations: [] };

        let where = 'WHERE c.instagram_account_id = ?';
        const params = [account.id];
        if (status) { where += ' AND c.status = ?'; params.push(status); }

        const total = (await db.prepare(`SELECT COUNT(*) as count FROM conversations c ${where}`).get(...params))?.count || 0;
        const rows = await db.prepare(`
          SELECT c.id, c.instagram_account_id, c.ig_scoped_user_id, c.username, c.name, c.profile_pic_url, c.avatar_seed, c.last_message, c.last_message_direction,
                 c.status, c.pending_follow_rule_id, c.last_user_message_at, c.created_at, c.updated_at,
                 (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
          FROM conversations c
          ${where}
          ORDER BY c.updated_at DESC
          LIMIT ? OFFSET ?
        `).all(...params, Number(limit), Number(offset));

        // Batch fetch messages for all returned conversations in a SINGLE query instead of N+1
        const messagesByConvId = new Map();
        if (rows && rows.length > 0) {
          const placeholders = rows.map(() => '?').join(',');
          const rawMsgs = await db.prepare(
            `SELECT id, conversation_id, direction, content, created_at, status 
             FROM messages 
             WHERE conversation_id IN (${placeholders}) 
             ORDER BY created_at ASC`
          ).all(...rows.map(r => r.id));
          for (const m of (rawMsgs || [])) {
            let list = messagesByConvId.get(m.conversation_id);
            if (!list) {
              list = [];
              messagesByConvId.set(m.conversation_id, list);
            }
            list.push(m);
          }
        }

        // Enrich rows from cache instantly (zero network calls needed for known users)
        for (const row of rows) {
          const resolved = profileCache.resolve(row.ig_scoped_user_id, row);
          if (resolved.name) row.name = resolved.name;
          if (resolved.username && resolved.username !== 'user') row.username = resolved.username;
          if (resolved.profile_pic) row.profile_pic_url = resolved.profile_pic;
          // If still no real name, trigger background enrichment (non-blocking)
          if (!row.name && account.access_token_enc) {
            profileCache.fetchAndCache(row.ig_scoped_user_id, account.access_token_enc, row.id, account.page_id).catch(() => {});
          }
        }

        const now = Date.now();
        const avatarColors = ['#a855f7', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];

        const conversations = (rows || []).map((c) => {
          const userMsgTs = c.last_user_message_at ? new Date(c.last_user_message_at).getTime() : now;
          const is_window_active = (userMsgTs + 24 * 3600000) > now;
          const window_expires_at = new Date(userMsgTs + 24 * 3600000).toISOString();
          const diff = now - new Date(c.updated_at || c.last_user_message_at).getTime();
          const mins = Math.floor(diff / 60000);
          const hrs = Math.floor(mins / 60);
          const days = Math.floor(hrs / 24);
          const timeAgo = days > 0 ? `${days}d ago` : hrs > 0 ? `${hrs}h ago` : `${mins}m ago`;

          const rawMsgs = messagesByConvId.get(c.id) || [];
          const messages = rawMsgs.map(m => {
            const msgDate = new Date(m.created_at);
            const timeStr = isNaN(msgDate.getTime()) ? 'Just now' : msgDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
            return {
              id: m.id,
              sender: m.direction === 'inbound' ? 'user' : 'bot',
              text: m.content,
              time: timeStr,
              created_at: m.created_at,
              rule: m.direction === 'outbound' ? 'Automated DM' : null,
              status: m.status
            };
          });

          const knownTester = KNOWN_TESTERS[c.ig_scoped_user_id];
          const realName = (c.name && c.name.toLowerCase() !== 'user') ? c.name : (knownTester?.name || null);
          const cleanUsername = (c.username && c.username !== 'user') 
            ? c.username.replace(/^@/, '') 
            : (knownTester?.username || null);
          const displayName = realName || (cleanUsername ? `@${cleanUsername}` : 'Instagram User');
          const handle = cleanUsername ? `@${cleanUsername}` : `IG ID: ${c.ig_scoped_user_id}`;
          const initial = (realName || cleanUsername || 'I').charAt(0).toUpperCase();
          const charCodeSum = (c.id || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
          const avatarBg = avatarColors[charCodeSum % avatarColors.length];
          const profilePic = c.profile_pic_url || (knownTester?.profile_pic_url || null);

          return {
            ...c,
            name: realName || displayName,
            displayName,
            sender: handle,
            username: handle,
            handle,
            cleanUsername,
            initial,
            avatarBg,
            profile_pic_url: profilePic,
            ig_scoped_user_id: c.ig_scoped_user_id,
            pending_follow_rule_id: c.pending_follow_rule_id || null,
            lastMessage: c.last_message || (messages[messages.length - 1]?.text) || 'No messages yet',
            time: timeAgo,
            timeAgo,
            status: c.pending_follow_rule_id ? 'Waiting on Follow' : (c.status === 'replied' ? 'Replied' : 'Open'),
            last_message_at: c.updated_at || c.last_user_message_at,
            is_window_active,
            window_expires_at,
            messages
          };
        });

        const payload = { total, conversations };
        redisClient.set(cacheKey, payload, 10).catch(() => {});
        return payload;
      } finally {
        inflightConvs.delete(convKey);
      }
    })();
    inflightConvs.set(convKey, fetchPromise);
  }

  try {
    const result = await fetchPromise;
    res.json(result);
  } catch (err) {
    console.error('[Conversations] GET / error:', err.message);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/conversations/incidents - List loop detection incidents (must precede /:id)
router.get('/incidents', async (req, res) => {
  const account = await getAccountForUser(req.user.id, req.query.account_id);
  if (!account) return res.json({ incidents: [] });

  const rows = await db.prepare(`
    SELECT i.*, c.username, c.name
    FROM automation_loop_incidents i
    LEFT JOIN conversations c ON i.conversation_id = c.id
    WHERE i.instagram_account_id = ?
    ORDER BY i.detected_at DESC
    LIMIT 50
  `).all(account.id);

  res.json({ incidents: rows });
});

// POST /api/conversations/incidents/:id/resume - Resume a loop-paused automation (tenant scoped)
router.post('/incidents/:id/resume', async (req, res) => {
  const loopDetection = require('../services/loopDetection');
  const incident = await loopDetection.resolveLoopIncident(req.params.id, req.user.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found or unauthorized' });

  res.json({ success: true, message: 'Automation loop resolved and conversation resumed.' });
});

// GET /api/conversations/:id — verify ownership
router.get('/:id', async (req, res) => {
  const conversation = await db.prepare(`
    SELECT c.* 
    FROM conversations c
    JOIN instagram_accounts a ON c.instagram_account_id = a.id
    WHERE c.id = ? AND a.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const rawMessages = await db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(req.params.id);
  const messages = rawMessages.map(m => ({
    ...m,
    text: m.content,
    sender: m.direction === 'inbound' ? 'user' : 'bot',
    time: new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
    is_automated: m.direction === 'outbound'
  }));

  const userMsgTs = conversation.last_user_message_at ? new Date(conversation.last_user_message_at).getTime() : Date.now();
  const is_window_active = (userMsgTs + 24 * 3600000) > Date.now();
  const window_expires_at = new Date(userMsgTs + 24 * 3600000).toISOString();

  const knownTester = KNOWN_TESTERS[conversation.ig_scoped_user_id];
  const realName = (conversation.name && conversation.name.toLowerCase() !== 'user') ? conversation.name : (knownTester?.name || null);
  const cleanUsername = (conversation.username && conversation.username !== 'user') 
    ? conversation.username.replace(/^@/, '') 
    : (knownTester?.username || null);
  const displayName = realName || (cleanUsername ? `@${cleanUsername}` : `User ${conversation.ig_scoped_user_id.slice(-4)}`);
  const handle = cleanUsername ? `@${cleanUsername}` : `@user_${conversation.ig_scoped_user_id.slice(-4)}`;
  const initial = (realName || cleanUsername || 'U').charAt(0).toUpperCase();
  const profilePic = conversation.profile_pic_url || (knownTester?.profile_pic_url || null);

  res.json({
    conversation: {
      ...conversation,
      name: realName || displayName,
      displayName,
      sender: handle,
      username: handle,
      handle,
      cleanUsername,
      initial,
      profile_pic_url: profilePic,
      is_window_active,
      window_expires_at,
      last_message_at: conversation.updated_at || conversation.last_user_message_at
    },
    messages
  });
});

// POST /api/conversations/:id/reply — manual outbound reply
router.post('/:id/reply', async (req, res) => {
  const conversation = await db.prepare(`
    SELECT c.*, a.id as ig_acc_id, a.page_id, a.access_token_enc
    FROM conversations c
    JOIN instagram_accounts a ON c.instagram_account_id = a.id
    WHERE c.id = ? AND a.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Message text required' });

  // Authoritative subscription entitlement & plan resolution
  const user = await db.prepare('SELECT id, plan, dm_usage_this_period, subscription_status FROM users WHERE id = ?').get(req.user.id);
  const sub = await db.prepare('SELECT id, plan, status, current_period_end, grace_period_ends_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(req.user.id);

  const subStatus = (sub?.status || user?.subscription_status || 'active').toLowerCase();

  // Explicitly block canceled, expired, unpaid, reconciliation_required
  const blockedStatuses = ['canceled', 'expired', 'unpaid', 'reconciliation_required'];
  if (blockedStatuses.includes(subStatus)) {
    return res.status(403).json({
      error: `Outbound messaging is blocked for your account status (${subStatus}). Please update your subscription.`,
      code: 'SUBSCRIPTION_STATE_BLOCKED'
    });
  }

  // Authoritative entitlement check
  const isEntitled = ['active', 'trialing', 'grace_period'].includes(subStatus);
  const effectivePlan = isEntitled ? (sub?.plan || user?.plan || 'free') : 'free';
  const planLimit = dmLimitFor(effectivePlan);

  // Authoritative usage counter check (compare max of usage_counters and users)
  const counter = await db.prepare('SELECT dms_sent FROM usage_counters WHERE user_id = ?').get(req.user.id);
  const currentUsage = Math.max(counter?.dms_sent || 0, user?.dm_usage_this_period || 0);

  if (planLimit !== -1 && currentUsage >= planLimit) {
    return res.status(403).json({
      error: `Monthly DM limit reached for your plan (${effectivePlan}: ${planLimit}). Upgrade your plan to send more messages.`,
      code: 'QUOTA_EXCEEDED'
    });
  }

  const { v4: uuidv4 } = require('uuid');
  const metaClient = require('../services/metaClient');

  let status = 'sent';
  let metaMessageId = null;
  let errorMsg = null;

  try {
    const resp = await metaClient.sendDirectMessage({
      pageId: conversation.page_id,
      igScopedUserId: conversation.ig_scoped_user_id,
      messageText: text,
      accessToken: decrypt(conversation.access_token_enc)
    });
    metaMessageId = resp?.message_id || null;
  } catch (err) {
    status = 'failed';
    errorMsg = err.message;
  }

  const msgId = uuidv4();
  const nowIso = new Date().toISOString();
  await db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, meta_message_id, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    msgId, conversation.id, 'outbound', text, status, metaMessageId, errorMsg, nowIso
  );
  await db.prepare("UPDATE conversations SET last_message = ?, last_message_direction = 'outbound', status = 'replied', updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') WHERE id = ?").run(
    text, conversation.id
  );

  // Meter outbound DM usage atomically across usage_counters (SSOT) and users (cache)
  if (status === 'sent') {
    const pool = db.getPgPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const resCnt = await client.query(`
          INSERT INTO usage_counters (id, user_id, period_start, period_end, dms_sent, updated_at)
          VALUES ($1, $2, NOW(), NOW() + INTERVAL '30 days', 1, NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            dms_sent = usage_counters.dms_sent + 1,
            updated_at = NOW()
          RETURNING dms_sent
        `, [`cnt_${req.user.id}`, req.user.id]);

        const authoritativeCount = resCnt.rows[0]?.dms_sent || (currentUsage + 1);
        await client.query(`
          UPDATE users SET
            dm_usage_this_period = $1,
            updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
          WHERE id = $2
        `, [authoritativeCount, req.user.id]);
        await client.query('COMMIT');
      } catch (incErr) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[Conversations] Failed to increment authoritative usage:', incErr.message);
      } finally {
        client.release();
      }
    } else {
      await db.prepare("UPDATE users SET dm_usage_this_period = dm_usage_this_period + 1, updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') WHERE id = ?").run(req.user.id);
    }
  }

  res.json({ success: true, messageId: msgId, status, error: errorMsg });
});

// PATCH /api/conversations/:id
router.patch('/:id', async (req, res) => {
  const existing = await db.prepare(`
    SELECT c.id 
    FROM conversations c
    JOIN instagram_accounts a ON c.instagram_account_id = a.id
    WHERE c.id = ? AND a.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Conversation not found' });

  const { status } = req.body;
  await db.prepare("UPDATE conversations SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);
  res.json({ success: true });
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', async (req, res) => {
  const conv = await db.prepare(`
    SELECT c.id 
    FROM conversations c
    JOIN instagram_accounts a ON c.instagram_account_id = a.id
    WHERE c.id = ? AND a.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });

  const raw = await db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 100').all(req.params.id);
  const messages = raw.map(m => ({
    ...m,
    text: m.content,
    sender: m.direction === 'inbound' ? 'user' : 'bot',
    time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    is_automated: m.direction === 'outbound'
  }));
  res.json(messages);
});

module.exports = router;
