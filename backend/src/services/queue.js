// backend/src/services/queue.js
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const metaClient = require('./metaClient');
const { decrypt } = require('./crypto');
const profileCache = require('./profileCache');

const FREE_CAP = parseInt(process.env.FREE_PLAN_DM_LIMIT || '1000', 10);
const MAX_COMMENT_AGE_MS = 7 * 24 * 3600000;
const MAX_DM_WINDOW_MS = 24 * 3600000;
const rateLimitWindows = new Map();

class EventQueueWorker {
  constructor() { this.queue = []; this.activeWorkers = 0; this.concurrency = 3; }

  enqueue(event) {
    const job = { id: uuidv4(), event, attempts: 0, maxAttempts: 3 };
    this.queue.push(job);
    this.processNext();
    return job.id;
  }

  checkRateLimit(accountId, type) {
    const now = Date.now();
    if (!rateLimitWindows.has(accountId)) rateLimitWindows.set(accountId, { pr: [], dm: [] });
    const r = rateLimitWindows.get(accountId);
    if (type === 'comment_to_dm') {
      r.pr = r.pr.filter(t => t > now - 3600000);
      if (r.pr.length >= 120) return false;
      r.pr.push(now); return true;
    } else {
      r.dm = r.dm.filter(t => t > now - 60000);
      if (r.dm.length >= 30) return false;
      r.dm.push(now); return true;
    }
  }

  async processNext() {
    if (!this.queue.length || this.activeWorkers >= this.concurrency) return;
    const job = this.queue.shift();
    this.activeWorkers++;
    try { await this.handleJob(job); }
    catch (err) {
      if (job.attempts < job.maxAttempts && !err.isPermanent) {
        job.attempts++;
        setTimeout(() => { this.queue.push(job); this.processNext(); }, Math.pow(2, job.attempts) * 500);
      }
    } finally { this.activeWorkers--; this.processNext(); }
  }

  async handleJob(job) {
    const { type, accountId, data } = job.event;
    if (type === 'comments') await this.processComment(accountId, data);
    else if (type === 'messages') await this.processMessage(accountId, data);
  }

  matchKeyword(text, keyword, mode) {
    if (!text || !keyword) return false;
    const t = text.trim().toLowerCase(), k = keyword.trim().toLowerCase();
    return mode === 'exact' ? t === k : t.includes(k);
  }

  async updateActivityLog(accountId, type) {
    const today = new Date().toISOString().slice(0, 10);
    const existing = await db.prepare('SELECT id FROM activity_log WHERE instagram_account_id = ? AND event_date = ?').get(accountId, today);
    if (existing) {
      if (type === 'comment') await db.prepare('UPDATE activity_log SET comments_replied = comments_replied + 1 WHERE instagram_account_id = ? AND event_date = ?').run(accountId, today);
      else await db.prepare('UPDATE activity_log SET dms_sent = dms_sent + 1 WHERE instagram_account_id = ? AND event_date = ?').run(accountId, today);
    } else {
      await db.prepare('INSERT INTO activity_log (id, instagram_account_id, event_date, dms_sent, comments_replied) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), accountId, today, type === 'dm' ? 1 : 0, type === 'comment' ? 1 : 0);
    }
  }

  async findAccount(accountId) {
    if (!accountId) return null;
    return await db.prepare('SELECT * FROM instagram_accounts WHERE id = ? OR ig_user_id = ? OR page_id = ? OR fb_user_id = ?').get(accountId, accountId, accountId, accountId);
  }

  async processComment(accountId, data) {
    const { commentId, text, commenterId, commenterUsername, createdTime } = data;
    const now = Date.now();
    const account = await this.findAccount(accountId);
    if (!account) {
      console.warn(`[Worker] ⚠️ No Instagram account found for comment accountId: ${accountId}`);
      return;
    }
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(account.user_id);
    if (!user) return;

    // Prevent replying to comments authored by the account itself
    if (commenterId && (commenterId === account.ig_user_id || commenterId === account.page_id || commenterId === account.fb_user_id)) {
      return;
    }
    if (commenterUsername && account.username && commenterUsername.toLowerCase() === account.username.toLowerCase()) {
      return;
    }

    // Idempotency
    if (await db.prepare('SELECT id FROM comment_replies WHERE comment_id = ?').get(commentId)) return;

    // 7-day window
    const tsNum = Number(createdTime);
    let rawCommentTime = (!isNaN(tsNum) && tsNum > 0) ? (tsNum < 1e11 ? tsNum * 1000 : tsNum) : (Date.parse(createdTime) || now);
    const commentTs = (isNaN(rawCommentTime) || rawCommentTime < 1650000000000) ? now : rawCommentTime;
    if (now - commentTs > MAX_COMMENT_AGE_MS) {
      await db.prepare('INSERT INTO comment_replies (id, comment_id, instagram_account_id, commenter_username, comment_text, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), commentId, account.id, commenterUsername || 'user', text || '', 'window_closed', 'Comment older than 7 days');
      return;
    }

    const rules = await db.prepare("SELECT * FROM automation_rules WHERE instagram_account_id = ? AND type = 'comment_to_dm' AND is_active = 1").all(account.id);
    const rule = rules.find(r => this.matchKeyword(text, r.trigger_keyword, r.match_mode));
    if (!rule) {
      console.log(`[Worker] No comment_to_dm rule matched for: "${text}" on @${account.username}`);
      return;
    }

    if (user.dm_usage_this_period >= FREE_CAP) {
      await db.prepare('INSERT INTO comment_replies (id, comment_id, automation_rule_id, instagram_account_id, commenter_username, comment_text, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), commentId, rule.id, account.id, commenterUsername || 'user', text || '', 'usage_capped', 'Free plan monthly cap reached');
      return;
    }

    if (!this.checkRateLimit(account.id, 'comment_to_dm')) { const e = new Error('Rate limit'); e.isPermanent = false; throw e; }

    const rawMsg = `${account.disclosure_message || ''}${rule.reply_message}`;
    const msg = rawMsg.replace(/\{username\}/gi, commenterUsername || 'there');
    try {
      const resp = await metaClient.sendPrivateCommentReply({ pageId: account.page_id, commentId, messageText: msg, accessToken: decrypt(account.access_token_enc) });
      await db.prepare('INSERT INTO comment_replies (id, comment_id, automation_rule_id, instagram_account_id, commenter_username, comment_text, reply_sent, status, meta_message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), commentId, rule.id, account.id, commenterUsername || 'user', text || '', msg, 'sent', resp.message_id);
      await db.prepare('UPDATE users SET dm_usage_this_period = dm_usage_this_period + 1 WHERE id = ?').run(user.id);
      await db.prepare('UPDATE automation_rules SET fire_count = fire_count + 1 WHERE id = ?').run(rule.id);
      await this.updateActivityLog(account.id, 'comment');
      // Upsert conversation for log
      await this.upsertConversation(account.id, commenterId || uuidv4(), commenterUsername || 'user', null, null, text, 'inbound', 'replied');
      console.log(`[Worker] ✅ Private reply to comment ${commentId} (Rule: "${rule.trigger_keyword}")`);
    } catch (err) {
      await db.prepare('INSERT INTO comment_replies (id, comment_id, automation_rule_id, instagram_account_id, commenter_username, comment_text, reply_sent, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), commentId, rule.id, account.id, commenterUsername || 'user', text || '', msg, 'failed', err.message);
      if (err.statusCode >= 400 && err.statusCode < 500) err.isPermanent = true;
      throw err;
    }
  }

  async processMessage(accountId, data) {
    const { messageId, senderId, senderUsername, text, timestamp } = data;
    const now = Date.now();
    const tsNum = Number(timestamp);
    let rawEventTime = (!isNaN(tsNum) && tsNum > 0) ? (tsNum < 1e11 ? tsNum * 1000 : tsNum) : (Date.parse(timestamp) || now);
    const eventTime = (isNaN(rawEventTime) || rawEventTime < 1650000000000) ? now : rawEventTime;
    const account = await this.findAccount(accountId);
    if (!account) {
      console.warn(`[Worker] ⚠️ No Instagram account found for message accountId: ${accountId}`);
      return;
    }
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(account.user_id);
    if (!user) return;

    // Prevent replying to messages sent by the account itself
    if (senderId && (senderId === account.ig_user_id || senderId === account.page_id || senderId === account.fb_user_id)) {
      return;
    }
    if (senderUsername && account.username && senderUsername.toLowerCase() === account.username.toLowerCase()) {
      return;
    }

    console.log(`[Worker] Processing message for @${account.username} from ${senderUsername || senderId}: "${text}"`);

    // --- STEP 1: Instant cache lookup (zero latency, from memory) ---
    const cached = profileCache.resolve(senderId);
    let realName = cached.name || null;
    let realUsername = (cached.username && cached.username !== 'user') ? cached.username
      : (senderUsername && senderUsername.toLowerCase() !== 'user' ? senderUsername : null);
    let profilePic = cached.profile_pic || null;

    const finalUsername = realUsername || 'user';
    const nowIso = new Date(eventTime).toISOString();

    // Upsert conversation immediately with best available data (cache-first, no blocking wait)
    const convId = await this.upsertConversation(account.id, senderId, finalUsername, realName, profilePic, text, 'inbound', 'open', nowIso);

    // Log inbound message with the event timestamp so ordering is correct
    const inboundCreatedAt = new Date(eventTime).toISOString();
    await db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, meta_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), convId, 'inbound', text || '', 'received', messageId || null, inboundCreatedAt);

    // --- STEP 2: Background profile enrichment (non-blocking async) ---
    // For brand new users without a name, kick off a Meta API fetch in the background.
    // When it completes it will update the in-memory cache AND the DB row.
    if (!realName || !realUsername) {
      profileCache.fetchAndCache(senderId, account.access_token_enc, convId, account.page_id).catch(() => {});
    }

    const rules = await db.prepare("SELECT * FROM automation_rules WHERE instagram_account_id = ? AND type = 'dm_keyword_reply' AND is_active = 1").all(account.id);
    const rule = rules.find(r => this.matchKeyword(text, r.trigger_keyword, r.match_mode));
    if (!rule) {
      console.log(`[Worker] No dm_keyword_reply rule matched for "${text}" on @${account.username}`);
      return;
    }

    // 24h window
    if (now - eventTime > MAX_DM_WINDOW_MS) {
      // Outbound entries for closed window — use a timestamp 1s after inbound
      const closedOutTs = new Date(eventTime + 1000).toISOString();
      await db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), convId, 'outbound', rule.reply_message, 'window_closed', '24-hour window expired', closedOutTs);
      return;
    }

    if (user.dm_usage_this_period >= FREE_CAP) {
      const cappedOutTs = new Date(eventTime + 1000).toISOString();
      await db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), convId, 'outbound', rule.reply_message, 'usage_capped', 'Free cap reached', cappedOutTs);
      return;
    }

    if (!this.checkRateLimit(account.id, 'dm_keyword_reply')) { const e = new Error('Rate limit'); e.isPermanent = false; throw e; }

    const rawMsg = `${account.disclosure_message || ''}${rule.reply_message}`;
    // Use first name of user if available (e.g. "Priyanshu"), or clean handle, or fallback to 'there'
    const cleanFirstName = realName ? realName.split(' ')[0].trim() : (realUsername ? realUsername.replace(/^@/, '') : '');
    const greetingName = cleanFirstName && cleanFirstName.toLowerCase() !== 'user' ? cleanFirstName : 'there';
    const msg = rawMsg.replace(/\{username\}/gi, greetingName);
    try {
      const resp = await metaClient.sendDirectMessage({ pageId: account.page_id, igScopedUserId: senderId, messageText: msg, accessToken: decrypt(account.access_token_enc) });
      // Outbound auto-reply timestamp: 1 second after the inbound event to ensure correct ordering
      const outboundCreatedAt = new Date(eventTime + 1000).toISOString();
      await db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, meta_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), convId, 'outbound', msg, 'sent', resp.message_id, outboundCreatedAt);
      await db.prepare('UPDATE users SET dm_usage_this_period = dm_usage_this_period + 1 WHERE id = ?').run(user.id);
      await db.prepare('UPDATE automation_rules SET fire_count = fire_count + 1 WHERE id = ?').run(rule.id);
      await this.updateActivityLog(account.id, 'dm');
      await this.upsertConversation(account.id, senderId, finalUsername, realName, profilePic, msg, 'outbound', 'replied', new Date().toISOString());
      console.log(`[Worker] ✅ DM auto-reply sent to ${realName || finalUsername} (Rule: "${rule.trigger_keyword}")`);
    } catch (err) {
      const outboundFailCreatedAt = new Date(eventTime + 1000).toISOString();
      await db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), convId, 'outbound', msg, 'failed', err.message, outboundFailCreatedAt);
      if (err.statusCode >= 400 && err.statusCode < 500) err.isPermanent = true;
      throw err;
    }
  }

  async upsertConversation(accountId, igUserId, username, name = null, profilePic = null, lastMessage = '', direction = 'inbound', status = 'open', lastMsgAt = null) {
    const nowIso = lastMsgAt || new Date().toISOString();
    const existing = await db.prepare('SELECT id, username, name, profile_pic_url FROM conversations WHERE instagram_account_id = ? AND ig_scoped_user_id = ?').get(accountId, igUserId);
    if (existing) {
      const resolvedUsername = (username && username.toLowerCase() !== 'user') ? username : existing.username;
      const resolvedName = name || existing.name;
      const resolvedPic = profilePic || existing.profile_pic_url;
      await db.prepare(`
        UPDATE conversations SET 
          username = ?,
          name = ?,
          profile_pic_url = ?,
          last_message = ?, 
          last_message_direction = ?, 
          status = ?, 
          updated_at = datetime('now') 
        WHERE id = ?
      `).run(resolvedUsername, resolvedName, resolvedPic, lastMessage, direction, status, existing.id);
      return existing.id;
    } else {
      const id = uuidv4();
      await db.prepare(`
        INSERT INTO conversations (
          id, instagram_account_id, ig_scoped_user_id, username, name, profile_pic_url, avatar_seed,
          last_message, last_message_direction, status, last_user_message_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, accountId, igUserId, username, name || username, profilePic || null, username, lastMessage, direction, status, nowIso, nowIso, nowIso);
      return id;
    }
  }

  getRateLimitStatus(accountId) {
    const now = Date.now();
    const r = rateLimitWindows.get(accountId) || { pr: [], dm: [] };
    const prActive = r.pr.filter(t => t > now - 3600000).length;
    const dmActive = r.dm.filter(t => t > now - 60000).length;
    return {
      private_replies_last_hour: prActive,
      private_reply_limit_per_hour: 120,
      dms_last_minute: dmActive,
      dm_limit_per_minute: 30
    };
  }
}

module.exports = new EventQueueWorker();
