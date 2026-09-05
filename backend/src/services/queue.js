// backend/src/services/queue.js
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const metaClient = require('./metaClient');
const { decrypt } = require('./crypto');

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

  updateActivityLog(accountId, type) {
    const today = new Date().toISOString().slice(0, 10);
    const existing = db.prepare('SELECT id FROM activity_log WHERE instagram_account_id = ? AND event_date = ?').get(accountId, today);
    if (existing) {
      if (type === 'comment') db.prepare('UPDATE activity_log SET comments_replied = comments_replied + 1 WHERE instagram_account_id = ? AND event_date = ?').run(accountId, today);
      else db.prepare('UPDATE activity_log SET dms_sent = dms_sent + 1 WHERE instagram_account_id = ? AND event_date = ?').run(accountId, today);
    } else {
      db.prepare('INSERT INTO activity_log (id, instagram_account_id, event_date, dms_sent, comments_replied) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), accountId, today, type === 'dm' ? 1 : 0, type === 'comment' ? 1 : 0);
    }
  }

  findAccount(accountId) {
    if (!accountId) return null;
    return db.prepare('SELECT * FROM instagram_accounts WHERE id = ? OR ig_user_id = ? OR page_id = ? OR fb_user_id = ?').get(accountId, accountId, accountId, accountId);
  }

  async processComment(accountId, data) {
    const { commentId, text, commenterId, commenterUsername, createdTime } = data;
    const now = Date.now();
    const account = this.findAccount(accountId);
    if (!account) {
      console.warn(`[Worker] ⚠️ No Instagram account found for comment accountId: ${accountId}`);
      return;
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(account.user_id);
    if (!user) return;

    // Idempotency
    if (db.prepare('SELECT id FROM comment_replies WHERE comment_id = ?').get(commentId)) return;

    // 7-day window
    const tsNum = Number(createdTime);
    let rawCommentTime = (!isNaN(tsNum) && tsNum > 0) ? (tsNum < 1e11 ? tsNum * 1000 : tsNum) : (Date.parse(createdTime) || now);
    const commentTs = (isNaN(rawCommentTime) || rawCommentTime < 1650000000000) ? now : rawCommentTime;
    if (now - commentTs > MAX_COMMENT_AGE_MS) {
      db.prepare('INSERT INTO comment_replies (id, comment_id, instagram_account_id, commenter_username, comment_text, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), commentId, account.id, commenterUsername || 'user', text || '', 'window_closed', 'Comment older than 7 days');
      return;
    }

    const rules = db.prepare("SELECT * FROM automation_rules WHERE instagram_account_id = ? AND type = 'comment_to_dm' AND is_active = 1").all(account.id);
    const rule = rules.find(r => this.matchKeyword(text, r.trigger_keyword, r.match_mode));
    if (!rule) {
      console.log(`[Worker] No comment_to_dm rule matched for: "${text}" on @${account.username}`);
      return;
    }

    if (user.dm_usage_this_period >= FREE_CAP) {
      db.prepare('INSERT INTO comment_replies (id, comment_id, automation_rule_id, instagram_account_id, commenter_username, comment_text, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), commentId, rule.id, account.id, commenterUsername || 'user', text || '', 'usage_capped', 'Free plan monthly cap reached');
      return;
    }

    if (!this.checkRateLimit(account.id, 'comment_to_dm')) { const e = new Error('Rate limit'); e.isPermanent = false; throw e; }

    const rawMsg = `${account.disclosure_message || ''}${rule.reply_message}`;
    const msg = rawMsg.replace(/\{username\}/gi, commenterUsername || 'there');
    try {
      const resp = await metaClient.sendPrivateCommentReply({ pageId: account.page_id, commentId, messageText: msg, accessToken: decrypt(account.access_token_enc) });
      db.prepare('INSERT INTO comment_replies (id, comment_id, automation_rule_id, instagram_account_id, commenter_username, comment_text, reply_sent, status, meta_message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), commentId, rule.id, account.id, commenterUsername || 'user', text || '', msg, 'sent', resp.message_id);
      db.prepare('UPDATE users SET dm_usage_this_period = dm_usage_this_period + 1 WHERE id = ?').run(user.id);
      db.prepare('UPDATE automation_rules SET fire_count = fire_count + 1 WHERE id = ?').run(rule.id);
      this.updateActivityLog(account.id, 'comment');
      // Upsert conversation for log
      this.upsertConversation(account.id, commenterId || uuidv4(), commenterUsername || 'user', text, 'inbound', 'replied');
      console.log(`[Worker] ✅ Private reply to comment ${commentId} (Rule: "${rule.trigger_keyword}")`);
    } catch (err) {
      db.prepare('INSERT INTO comment_replies (id, comment_id, automation_rule_id, instagram_account_id, commenter_username, comment_text, reply_sent, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), commentId, rule.id, account.id, commenterUsername || 'user', text || '', msg, 'failed', err.message);
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
    const account = this.findAccount(accountId);
    if (!account) {
      console.warn(`[Worker] ⚠️ No Instagram account found for message accountId: ${accountId}`);
      return;
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(account.user_id);
    if (!user) return;

    console.log(`[Worker] Processing message for @${account.username} from ${senderUsername || senderId}: "${text}"`);

    const nowIso = new Date(eventTime).toISOString();
    // Upsert conversation
    const convId = this.upsertConversation(account.id, senderId, senderUsername || 'User', text, 'inbound', 'open', nowIso);

    // Log inbound message
    db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, meta_message_id) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), convId, 'inbound', text || '', 'received', messageId || null);

    const rules = db.prepare("SELECT * FROM automation_rules WHERE instagram_account_id = ? AND type = 'dm_keyword_reply' AND is_active = 1").all(account.id);
    const rule = rules.find(r => this.matchKeyword(text, r.trigger_keyword, r.match_mode));
    if (!rule) {
      console.log(`[Worker] No dm_keyword_reply rule matched for "${text}" on @${account.username}`);
      return;
    }

    // 24h window
    if (now - eventTime > MAX_DM_WINDOW_MS) {
      db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, error_message) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), convId, 'outbound', rule.reply_message, 'window_closed', '24-hour window expired');
      return;
    }

    if (user.dm_usage_this_period >= FREE_CAP) {
      db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, error_message) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), convId, 'outbound', rule.reply_message, 'usage_capped', 'Free cap reached');
      return;
    }

    if (!this.checkRateLimit(account.id, 'dm_keyword_reply')) { const e = new Error('Rate limit'); e.isPermanent = false; throw e; }

    const rawMsg = `${account.disclosure_message || ''}${rule.reply_message}`;
    const msg = rawMsg.replace(/\{username\}/gi, senderUsername || 'there');
    try {
      const resp = await metaClient.sendDirectMessage({ pageId: account.page_id, igScopedUserId: senderId, messageText: msg, accessToken: decrypt(account.access_token_enc) });
      db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, meta_message_id) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), convId, 'outbound', msg, 'sent', resp.message_id);
      db.prepare('UPDATE users SET dm_usage_this_period = dm_usage_this_period + 1 WHERE id = ?').run(user.id);
      db.prepare('UPDATE automation_rules SET fire_count = fire_count + 1 WHERE id = ?').run(rule.id);
      this.updateActivityLog(account.id, 'dm');
      this.upsertConversation(account.id, senderId, senderUsername || 'User', msg, 'outbound', 'replied', new Date().toISOString());
      console.log(`[Worker] ✅ DM auto-reply sent to ${senderUsername || senderId} (Rule: "${rule.trigger_keyword}")`);
    } catch (err) {
      db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, error_message) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), convId, 'outbound', msg, 'failed', err.message);
      if (err.statusCode >= 400 && err.statusCode < 500) err.isPermanent = true;
      throw err;
    }
  }

  upsertConversation(accountId, igUserId, username, lastMessage, direction, status, lastMsgAt = null) {
    const nowIso = lastMsgAt || new Date().toISOString();
    const existing = db.prepare('SELECT id FROM conversations WHERE instagram_account_id = ? AND ig_scoped_user_id = ?').get(accountId, igUserId);
    if (existing) {
      db.prepare("UPDATE conversations SET last_message = ?, last_message_direction = ?, status = ?, updated_at = datetime('now') WHERE id = ?").run(lastMessage, direction, status, existing.id);
      return existing.id;
    } else {
      const id = uuidv4();
      db.prepare('INSERT INTO conversations (id, instagram_account_id, ig_scoped_user_id, username, avatar_seed, last_message, last_message_direction, status, last_user_message_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, accountId, igUserId, username, username, lastMessage, direction, status, nowIso, nowIso, nowIso);
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
