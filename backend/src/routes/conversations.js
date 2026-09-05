// backend/src/routes/conversations.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const metaClient = require('../services/metaClient');
const { decrypt } = require('../services/crypto');

const KNOWN_TESTERS = {
  '1759458871653007': { name: 'sumit bhardwaj', username: 'join_sumit_', profile_pic_url: 'https://instagram.fdel65-4.fna.fbcdn.net/v/t51.82787-19/671209546_18351709720242986_4694042261133486757_n.jpg?stp=dst-jpg_s206x206_tt6&_nc_cat=104&ccb=7-5&_nc_sid=bf7eb4&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=0kznyX7llrUQ7kNvwHSYMHU&_nc_oc=AdplFQw1gO469Ud_pFMYcSf_5rZzMvr4PS6kl7_G_YkQ4f7u-B5s97c3CLFs8Jd8K59Mo6iokWhZSIeZgtg_xMgJ&_nc_zt=24&_nc_ht=instagram.fdel65-4.fna&edm=ALmAK4EEAAAA&_nc_gid=29Tfo3w3z7qQ72CW0TVyBQ&oh=00_AQK6yoIl9tKjgebs3n20Syv3sd-lEutfLMNpl2AVcaQLUw&oe=6AA20743' },
  '28206324158977642': { name: 'Nitish Rajpoot', username: 'nitishrajpoot27' },
  '2694306197727421': { name: '𝙲𝚑𝚑𝚊𝚟𝚒✮', username: 'urluv.chhavi' },
  '2199839837542030': { name: 'Priyanshu Uttam | Boring Traders 📈', username: 'priyanshu__vision' },
  '2052261912093429': { name: 'Piyush Yadav', username: 'rao_piyushh_yadav' },
  '1730487928031569': { name: 'Maniesha', username: 'radhika_bhardwaj15' }
};

function getAccountForUser(userId, accountId) {
  if (accountId) {
    return db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND id = ? LIMIT 1").get(userId, accountId);
  }
  return db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected' ORDER BY updated_at DESC LIMIT 1").get(userId)
      || db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1").get(userId);
}

// GET /api/conversations
router.get('/', async (req, res) => {
  if (db.syncFromPgNow) {
    try { await db.syncFromPgNow(); } catch (_) {}
  }
  const { limit = 50, offset = 0, status, account_id } = req.query;
  const account = getAccountForUser(req.user.id, account_id);
  if (!account) return res.json({ total: 0, conversations: [] });

  let where = 'WHERE c.instagram_account_id = ?';
  const params = [account.id];
  if (status) { where += ' AND c.status = ?'; params.push(status); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM conversations c ${where}`).get(...params)?.count || 0;
  const rows = db.prepare(`
    SELECT c.id, c.instagram_account_id, c.ig_scoped_user_id, c.username, c.name, c.profile_pic_url, c.avatar_seed, c.last_message, c.last_message_direction,
           c.status, c.last_user_message_at, c.created_at, c.updated_at,
           (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
    FROM conversations c
    ${where}
    ORDER BY c.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset));


  // Auto-enrich any conversation missing real profile info from Meta Graph API or known cache
  for (const row of rows) {
    if ((!row.name || row.username === 'user' || !row.username) && row.ig_scoped_user_id) {
      // 1. Try Meta Graph API
      let enriched = false;
      if (account.access_token_enc) {
        try {
          const token = decrypt(account.access_token_enc);
          const profile = await metaClient.getInstagramUserProfile({ igScopedUserId: row.ig_scoped_user_id, accessToken: token });
          if (profile) {
            if (profile.username) row.username = profile.username;
            if (profile.name) row.name = profile.name;
            if (profile.profile_pic) row.profile_pic_url = profile.profile_pic;
            enriched = true;
          }
        } catch (err) {
          console.warn(`[Conversations] Failed to auto-enrich profile from Meta for ${row.ig_scoped_user_id}:`, err.message);
        }
      }

      // 2. Try known testers lookup
      if (!enriched && KNOWN_TESTERS[row.ig_scoped_user_id]) {
        const kt = KNOWN_TESTERS[row.ig_scoped_user_id];
        row.name = kt.name;
        row.username = kt.username;
        if (kt.profile_pic_url) row.profile_pic_url = kt.profile_pic_url;
        enriched = true;
      }

      if (enriched) {
        try {
          db.prepare(`
            UPDATE conversations SET 
              username = COALESCE(?, username), 
              name = COALESCE(?, name), 
              profile_pic_url = COALESCE(?, profile_pic_url),
              updated_at = datetime('now')
            WHERE id = ?
          `).run(row.username, row.name, row.profile_pic_url, row.id);
        } catch (_) {}
      }
    }
  }

  const now = Date.now();
  const avatarColors = ['#a855f7', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];

  const conversations = rows.map(c => {
    const userMsgTs = c.last_user_message_at ? new Date(c.last_user_message_at).getTime() : now;
    const is_window_active = (userMsgTs + 24 * 3600000) > now;
    const window_expires_at = new Date(userMsgTs + 24 * 3600000).toISOString();
    const diff = now - new Date(c.updated_at || c.last_user_message_at).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    const timeAgo = days > 0 ? `${days}d ago` : hrs > 0 ? `${hrs}h ago` : `${mins}m ago`;

    // Fetch all messages in the thread in chronological order
    const rawMsgs = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(c.id);
    const messages = rawMsgs.map(m => {
      const msgDate = new Date(m.created_at);
      const timeStr = isNaN(msgDate.getTime()) ? 'Just now' : msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        id: m.id,
        sender: m.direction === 'inbound' ? 'user' : 'bot',
        text: m.content,
        time: timeStr,
        rule: m.direction === 'outbound' ? 'Automated DM' : null,
        status: m.status
      };
    });

    const knownTester = KNOWN_TESTERS[c.ig_scoped_user_id];
    const realName = (c.name && c.name.toLowerCase() !== 'user') ? c.name : (knownTester?.name || null);
    const cleanUsername = (c.username && c.username !== 'user') 
      ? c.username.replace(/^@/, '') 
      : (knownTester?.username || null);
    const displayName = realName || (cleanUsername ? `@${cleanUsername}` : `User ${c.ig_scoped_user_id.slice(-4)}`);
    const handle = cleanUsername ? `@${cleanUsername}` : `@user_${c.ig_scoped_user_id.slice(-4)}`;
    const initial = (realName || cleanUsername || 'U').charAt(0).toUpperCase();
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
      lastMessage: c.last_message || (messages[messages.length - 1]?.text) || 'No messages yet',
      time: timeAgo,
      timeAgo,
      status: c.status === 'replied' ? 'Replied' : 'Open',
      last_message_at: c.updated_at || c.last_user_message_at,
      is_window_active,
      window_expires_at,
      messages
    };
  });

  res.json({ total, conversations });
});

// GET /api/conversations/:id — verify ownership
router.get('/:id', (req, res) => {
  const conversation = db.prepare(`
    SELECT c.* 
    FROM conversations c
    JOIN instagram_accounts a ON c.instagram_account_id = a.id
    WHERE c.id = ? AND a.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const rawMessages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(req.params.id);
  const messages = rawMessages.map(m => ({
    ...m,
    text: m.content,
    sender: m.direction === 'inbound' ? 'user' : 'bot',
    time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
  const conversation = db.prepare(`
    SELECT c.*, a.id as ig_acc_id, a.page_id, a.access_token_enc
    FROM conversations c
    JOIN instagram_accounts a ON c.instagram_account_id = a.id
    WHERE c.id = ? AND a.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Message text required' });

  const { v4: uuidv4 } = require('uuid');
  const metaClient = require('../services/metaClient');
  const { decrypt } = require('../services/crypto');

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
  db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, meta_message_id, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    msgId, conversation.id, 'outbound', text, status, metaMessageId, errorMsg, nowIso
  );
  db.prepare("UPDATE conversations SET last_message = ?, last_message_direction = 'outbound', status = 'replied', updated_at = datetime('now') WHERE id = ?").run(
    text, conversation.id
  );

  res.json({ success: true, messageId: msgId, status, error: errorMsg });
});

// PATCH /api/conversations/:id
router.patch('/:id', (req, res) => {
  const existing = db.prepare(`
    SELECT c.id 
    FROM conversations c
    JOIN instagram_accounts a ON c.instagram_account_id = a.id
    WHERE c.id = ? AND a.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Conversation not found' });

  const { status } = req.body;
  db.prepare("UPDATE conversations SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);
  res.json({ success: true });
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', (req, res) => {
  const conv = db.prepare(`
    SELECT c.id 
    FROM conversations c
    JOIN instagram_accounts a ON c.instagram_account_id = a.id
    WHERE c.id = ? AND a.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });

  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 100').all(req.params.id)
    .map(m => ({
      ...m,
      text: m.content,
      sender: m.direction === 'inbound' ? 'user' : 'bot',
      time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      is_automated: m.direction === 'outbound'
    }));
  res.json(messages);
});

module.exports = router;
