// backend/src/services/queue.js
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const metaClient = require('./metaClient');
const { decrypt } = require('./crypto');
const profileCache = require('./profileCache');
const loopDetection = require('./loopDetection');
const { abuseDetection } = require('./abuseDetection');
const { dmLimitFor } = require('../constants/planLimits');
const {
  QUEUE_CONFIG,
  calculateRandomDelayMs,
  calculateBackoffWithJitter,
  extractRetryAfterMs,
  isTransientError,
} = require('../constants/queueConfig');

const MAX_COMMENT_AGE_MS = 7 * 24 * 3600000;
const MAX_DM_WINDOW_MS = 24 * 3600000;

class EventQueueWorker {
  constructor() {
    this.queue = [];
    this.activeWorkers = 0;
    this.concurrency = QUEUE_CONFIG.CONCURRENCY;
    this.activePerAccount = new Map();
    this.rateLimitWindows = new Map();
    this.accountBackoffs = new Map();
    this.seenIdempotencyKeys = new Set();
    this.timer = null;
    this.isShuttingDown = false;
  }

  getIdempotencyKey(event) {
    const { type, data } = event || {};
    if (type === 'comments' && data?.commentId) {
      return `comm_${data.commentId}`;
    }
    if (type === 'messages' && data?.messageId) {
      return `msg_${data.messageId}`;
    }
    return `evt_${uuidv4()}`;
  }

  isDuplicate(idempotencyKey) {
    if (!idempotencyKey) return false;
    return this.seenIdempotencyKeys.has(idempotencyKey);
  }

  async isDuplicateInDb(idempotencyKey) {
    if (!idempotencyKey) return false;
    try {
      const existing = await db.prepare("SELECT id FROM webhook_jobs WHERE idempotency_key = ? LIMIT 1").get(idempotencyKey);
      if (existing) return true;
      const existingEvent = await db.prepare("SELECT id FROM webhook_events WHERE idempotency_key = ? LIMIT 1").get(idempotencyKey);
      return Boolean(existingEvent);
    } catch {
      return false;
    }
  }

  async persistJob(job) {
    try {
      const scheduledIso = new Date(job.scheduledAt).toISOString();
      await db.prepare(`
        INSERT INTO webhook_jobs (
          id, idempotency_key, account_id, job_type, payload, state, attempts, max_attempts, scheduled_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'QUEUED', 0, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT (idempotency_key) DO NOTHING
      `).run(
        job.id,
        job.idempotencyKey,
        job.event?.accountId || 'unknown',
        job.event?.type || 'event',
        JSON.stringify(job.event?.data || {}),
        job.maxAttempts,
        scheduledIso
      );
    } catch (e) {
      // Ignore if table not yet initialized or duplicate insert
    }
  }

  async updateJobState(jobId, state, errorMessage = null, isProcessed = false) {
    try {
      if (isProcessed) {
        await db.prepare(`
          UPDATE webhook_jobs SET
            state = ?,
            processed_at = datetime('now'),
            updated_at = datetime('now')
          WHERE id = ?
        `).run(state, jobId);
      } else if (errorMessage) {
        await db.prepare(`
          UPDATE webhook_jobs SET
            state = ?,
            error_message = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).run(state, String(errorMessage).slice(0, 500), jobId);
      } else {
        await db.prepare(`
          UPDATE webhook_jobs SET
            state = ?,
            attempts = attempts + 1,
            updated_at = datetime('now')
          WHERE id = ?
        `).run(state, jobId);
      }
    } catch (e) {
      // Non-blocking update failure
    }
  }

  enqueue(event) {
    if (this.isShuttingDown) {
      console.warn('[Queue] Worker is shutting down, rejecting new job.');
      return null;
    }

    const idempotencyKey = this.getIdempotencyKey(event);
    if (idempotencyKey && this.seenIdempotencyKeys.has(idempotencyKey)) {
      console.log(`[Queue] ⚠️ Duplicate event ignored for idempotency key: ${idempotencyKey}`);
      return null;
    }
    if (idempotencyKey) {
      this.seenIdempotencyKeys.add(idempotencyKey);
      if (this.seenIdempotencyKeys.size > 10000) {
        const arr = Array.from(this.seenIdempotencyKeys);
        this.seenIdempotencyKeys = new Set(arr.slice(5000));
      }
    }

    const id = uuidv4();
    const delayMs = calculateRandomDelayMs();
    const scheduledAt = Date.now() + delayMs;

    const job = {
      id,
      idempotencyKey,
      event,
      attempts: 0,
      maxAttempts: QUEUE_CONFIG.MAX_JOB_ATTEMPTS,
      scheduledAt,
      state: 'QUEUED'
    };

    if (delayMs > 0) {
      console.log(`[Queue] ⏳ Job ${id} (${event?.type}) enqueued with natural delay: ${(delayMs / 1000).toFixed(1)}s (Key: ${idempotencyKey})`);
    }

    // Persist asynchronously in DB
    this.persistJob(job).catch(() => {});

    this.queue.push(job);
    this.scheduleNext();
    return job;
  }

  scheduleNext() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.isShuttingDown || !this.queue.length) return;

    const now = Date.now();
    let earliestDelay = Infinity;
    for (const job of this.queue) {
      const waitTime = Math.max(0, job.scheduledAt - now);
      if (waitTime < earliestDelay) {
        earliestDelay = waitTime;
      }
    }

    const nextTickMs = earliestDelay === Infinity ? 50 : Math.min(earliestDelay, 1000);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.processNext();
    }, nextTickMs);
  }

  checkAccountThrottle(accountId) {
    if (!accountId) return { throttled: false };
    const now = Date.now();

    // 1. Account backoff lock (e.g. from 429)
    const backoffUntil = this.accountBackoffs.get(accountId) || 0;
    if (backoffUntil > now) {
      return { throttled: true, reason: 'account_backoff', waitMs: backoffUntil - now };
    }

    // 2. Concurrency limit per account
    const activeForAcc = this.activePerAccount.get(accountId) || 0;
    if (activeForAcc >= QUEUE_CONFIG.ACCOUNT_MAX_CONCURRENT) {
      return { throttled: true, reason: 'concurrency_limit', waitMs: 500 };
    }

    // 3. Sliding-window rate limit (requests per minute)
    let timestamps = this.rateLimitWindows.get(accountId) || [];
    timestamps = timestamps.filter(t => t > now - 60000);
    this.rateLimitWindows.set(accountId, timestamps);

    if (timestamps.length >= QUEUE_CONFIG.ACCOUNT_RATE_LIMIT_PER_MINUTE) {
      const oldest = timestamps[0];
      const waitMs = Math.max(500, 60000 - (now - oldest));
      return { throttled: true, reason: 'rate_limit', waitMs };
    }

    return { throttled: false };
  }

  recordAccountSend(accountId) {
    if (!accountId) return;
    const now = Date.now();
    const timestamps = this.rateLimitWindows.get(accountId) || [];
    timestamps.push(now);
    this.rateLimitWindows.set(accountId, timestamps);
  }

  async processNext() {
    if (this.isShuttingDown) return;
    if (this.activeWorkers >= this.concurrency || !this.queue.length) {
      return;
    }

    // Emergency kill switch: Pause all dispatch if global kill switch is active
    try {
      const isGlobalKilled = await abuseDetection.isGlobalKillSwitchActive();
      if (isGlobalKilled) {
        console.warn('[Queue] 🛑 Global kill switch active! Pausing queue dispatch.');
        this.scheduleNext();
        return;
      }
    } catch (e) {}

    const now = Date.now();
    let jobIndex = -1;

    // Pick earliest job that is ready (scheduledAt <= now) and whose account is not throttled or paused
    for (let i = 0; i < this.queue.length; i++) {
      const candidate = this.queue[i];
      if (candidate.scheduledAt > now) continue;

      const accId = candidate.event?.accountId;
      if (accId) {
        try {
          const isAccountPaused = await abuseDetection.isAccountPaused(accId);
          if (isAccountPaused) {
            candidate.scheduledAt = now + 5000;
            continue;
          }
        } catch (e) {}
      }

      const throttleCheck = this.checkAccountThrottle(accId);

      if (throttleCheck.throttled) {
        candidate.scheduledAt = now + throttleCheck.waitMs;
        continue;
      }

      jobIndex = i;
      break;
    }

    if (jobIndex < 0 || jobIndex >= this.queue.length) {
      this.scheduleNext();
      return;
    }

    const [job] = this.queue.splice(jobIndex, 1);
    if (!job) {
      this.scheduleNext();
      return;
    }
    this.activeWorkers++;

    const accId = job.event?.accountId;
    if (accId) {
      this.activePerAccount.set(accId, (this.activePerAccount.get(accId) || 0) + 1);
      this.recordAccountSend(accId);
    }

    this.executeJob(job).finally(() => {
      this.activeWorkers--;
      if (accId) {
        const currentAccCount = (this.activePerAccount.get(accId) || 1) - 1;
        if (currentAccCount <= 0) {
          this.activePerAccount.delete(accId);
        } else {
          this.activePerAccount.set(accId, currentAccCount);
        }
      }
      this.processNext();
    });

    if (this.activeWorkers < this.concurrency && this.queue.length) {
      setImmediate(() => this.processNext());
    }
  }

  async executeJob(job) {
    try {
      job.state = 'PROCESSING';
      job.attempts++;
      await this.updateJobState(job.id, 'PROCESSING');

      await this.handleJob(job);

      job.state = 'SENT';
      await this.updateJobState(job.id, 'SENT', null, true);

      // Post-dispatch abuse velocity tracking
      abuseDetection.recordDispatch(job.event?.accountId, job.userId, true).catch(() => {});
    } catch (err) {
      console.error(`[Worker] ❌ Error processing job ${job.id} (${job.event?.type}):`, err.message);

      // Track dispatch failure for error rate spike detection
      abuseDetection.recordDispatch(job.event?.accountId, job.userId, false).catch(() => {});

      const retriable = isTransientError(err);

      const retryAfterMs = extractRetryAfterMs(err);
      if (retryAfterMs && job.event?.accountId) {
        console.warn(`[Worker] ⚠️ Meta rate limit hit on account ${job.event?.accountId}. Backing off for ${(retryAfterMs / 1000).toFixed(1)}s.`);
        this.accountBackoffs.set(job.event?.accountId, Date.now() + retryAfterMs);
      }

      if (job.attempts < job.maxAttempts && retriable) {
        const backoffMs = retryAfterMs || calculateBackoffWithJitter(job.attempts);
        job.state = 'RETRYING';
        job.scheduledAt = Date.now() + backoffMs;
        console.log(`[Worker] 🔄 Requeuing job ${job.id} (attempt ${job.attempts}/${job.maxAttempts}) in ${(backoffMs / 1000).toFixed(1)}s`);
        await this.updateJobState(job.id, 'RETRYING', err.message);
        this.queue.push(job);
        this.scheduleNext();
      } else {
        job.state = 'DEAD_LETTER';
        console.error(`[Worker] 💀 Job ${job.id} moved to DEAD_LETTER after ${job.attempts} attempts. Reason: ${err.message}`);
        await this.updateJobState(job.id, 'DEAD_LETTER', err.message);
        try {
          const dlqId = uuidv4();
          await db.prepare(`
            INSERT INTO dead_letter_queue (
              id, job_id, idempotency_key, account_id, job_type, payload, error_message, error_stack, attempts, status, failed_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unresolved', to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'), to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'))
          `).run(
            dlqId,
            job.id,
            job.idempotencyKey || null,
            job.event?.accountId || 'unknown',
            job.event?.type || 'unknown',
            JSON.stringify(job.event?.data || {}),
            String(err.message).slice(0, 1000),
            String(err.stack || '').slice(0, 2000),
            job.attempts
          );
        } catch (dlqErr) {
          console.error('[Worker] Error persisting to dead_letter_queue:', dlqErr.message);
        }
      }
    }
  }

  /**
   * Reprocesses a dead-letter queue job, resetting attempt counters and re-enqueuing.
   */
  async reprocessDlqJob(dlqId, userId = null) {
    let dlqItem;
    if (userId) {
      dlqItem = await db.prepare(`
        SELECT dlq.* FROM dead_letter_queue dlq
        JOIN instagram_accounts a ON dlq.account_id = a.id OR dlq.account_id = a.ig_user_id
        WHERE dlq.id = ? AND a.user_id = ?
      `).get(dlqId, userId);
    } else {
      dlqItem = await db.prepare("SELECT * FROM dead_letter_queue WHERE id = ?").get(dlqId);
    }

    if (!dlqItem) {
      return { success: false, error: 'Dead-letter item not found or unauthorized' };
    }

    let payload = {};
    try {
      payload = JSON.parse(dlqItem.payload);
    } catch {}

    const job = this.enqueue({
      type: dlqItem.job_type,
      accountId: dlqItem.account_id,
      data: payload
    });

    await db.prepare(`
      UPDATE dead_letter_queue SET
        status = 'reprocessed',
        resolved_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      WHERE id = ?
    `).run(dlqId);

    return { success: true, message: 'Job successfully re-enqueued', job };
  }

  async shutdown(timeoutMs = 5000) {
    this.isShuttingDown = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const start = Date.now();
    while (this.activeWorkers > 0 && Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 100));
    }
    console.log(`[Queue] Graceful shutdown completed. Remaining in queue: ${this.queue.length}`);
  }

  getQueueStats() {
    return {
      activeWorkers: this.activeWorkers,
      queueDepth: this.queue.length,
      concurrency: this.concurrency,
      accountsThrottled: this.accountBackoffs.size
    };
  }

  checkRateLimit(accountId, type) {
    const check = this.checkAccountThrottle(accountId);
    return !check.throttled;
  }

  async handleJob(job) {
    const { type, accountId, data } = job.event || {};
    if (type === 'comments') await this.processComment(accountId, data);
    else if (type === 'messages') await this.processMessage(accountId, data);
  }

  matchKeyword(text, keyword, mode) {
    if (!text || !keyword) return false;
    const t = text.trim().toLowerCase();
    if (keyword === '*' || keyword.trim().toLowerCase() === 'any') return true;
    const keywords = keyword.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    if (keywords.length === 0) return false;
    return keywords.some(k => {
      if (k === '*' || k === 'any') return true;
      if (mode === 'exact') return t === k;
      if (mode === 'starts_with') return t.startsWith(k);
      return t.includes(k);
    });
  }

  async updateActivityLog(accountId, type) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const existing = await db.prepare('SELECT id FROM activity_log WHERE instagram_account_id = ? AND event_date = ?').get(accountId, today);
      if (existing) {
        if (type === 'comment') await db.prepare('UPDATE activity_log SET comments_replied = comments_replied + 1 WHERE instagram_account_id = ? AND event_date = ?').run(accountId, today);
        else await db.prepare('UPDATE activity_log SET dms_sent = dms_sent + 1 WHERE instagram_account_id = ? AND event_date = ?').run(accountId, today);
      } else {
        await db.prepare('INSERT INTO activity_log (id, instagram_account_id, event_date, dms_sent, comments_replied) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), accountId, today, type === 'dm' ? 1 : 0, type === 'comment' ? 1 : 0);
      }
    } catch (logErr) {
      console.warn('[Worker] Activity log notice:', logErr.message);
    }
  }

  async findAccount(accountId) {
    if (!accountId) return null;
    let account = await db.prepare('SELECT * FROM instagram_accounts WHERE id = ? OR ig_user_id = ? OR page_id = ? OR fb_user_id = ?').get(accountId, accountId, accountId, accountId);
    if (account) return account;

    // Resilient auto-healing: if an account connected before its Instagram Scoped ID was saved,
    // match candidate accounts via token verification or single active account
    try {
      const connected = await db.prepare("SELECT * FROM instagram_accounts WHERE status = 'connected'").all();
      if (!connected || connected.length === 0) return null;

      // If only one connected account exists in database, use it directly
      if (connected.length === 1) {
        console.log(`[Queue] 🔗 Only one connected account (@${connected[0].username}), matching for accountId ${accountId}`);
        return connected[0];
      }

      for (const candidate of connected) {
        try {
          const tok = decrypt(candidate.page_access_token_enc || candidate.long_lived_token_enc || candidate.access_token_enc);
          if (!tok) continue;
          const res = await fetch(`https://graph.instagram.com/me?fields=id,user_id,username&access_token=${encodeURIComponent(tok)}`);
          const data = await res.json();
          if (data && !data.error && (String(data.user_id) === String(accountId) || String(data.id) === String(accountId))) {
            const realIgId = data.user_id ? String(data.user_id) : accountId;
            const asuid = data.id ? String(data.id) : (candidate.fb_user_id || null);
            await db.prepare("UPDATE instagram_accounts SET ig_user_id = ?, page_id = ?, fb_user_id = COALESCE(fb_user_id, ?), updated_at = datetime('now') WHERE id = ?").run(realIgId, realIgId, asuid, candidate.id);
            if (db.getPgPool && db.getPgPool()) {
              await db.getPgPool().query("UPDATE instagram_accounts SET ig_user_id = $1, page_id = $1, fb_user_id = COALESCE(fb_user_id, $2), updated_at = to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') WHERE id = $3", [realIgId, asuid, candidate.id]);
            }
            console.log(`[Queue] 🔗 Dynamically matched and bound webhook accountId ${accountId} to @${candidate.username}`);
            return await db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(candidate.id);
          }
        } catch (candErr) {
          console.warn(`[Queue] Auto-heal candidate check failed for @${candidate.username}:`, candErr.message);
        }
      }
    } catch (lookupErr) {
      console.warn('[Queue] Dynamic account lookup notice:', lookupErr.message);
    }

    return null;
  }

  async processComment(accountId, data) {
    const { commentId, text, commenterId, commenterUsername, createdTime, mediaId } = data;
    const now = Date.now();
    const account = await this.findAccount(accountId);
    if (!account) {
      console.warn(`[Worker] ⚠️ No Instagram account found for comment accountId: ${accountId}`);
      return;
    }
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(account.user_id);
    if (!user) return;

    console.log(`[Worker] 💬 Processing comment ${commentId} (mediaId: ${mediaId || 'none'}) on @${account.username} from @${commenterUsername || commenterId}: "${text}"`);

    // Prevent replying to comments authored by the account itself
    if (commenterId && (commenterId === account.ig_user_id || commenterId === account.page_id || commenterId === account.fb_user_id)) {
      console.log(`[Worker] Skipping self-comment by account ID: ${commenterId}`);
      return;
    }
    if (commenterUsername && account.username && commenterUsername.toLowerCase() === account.username.toLowerCase()) {
      console.log(`[Worker] Skipping self-comment by account username: @${commenterUsername}`);
      return;
    }

    // Idempotency
    if (await db.prepare('SELECT id FROM comment_replies WHERE comment_id = ?').get(commentId)) {
      console.log(`[Worker] Comment ${commentId} has already been replied to, skipping.`);
      return;
    }

    // 7-day window
    const tsNum = Number(createdTime);
    let rawCommentTime = (!isNaN(tsNum) && tsNum > 0) ? (tsNum < 1e11 ? tsNum * 1000 : tsNum) : (Date.parse(createdTime) || now);
    const commentTs = (isNaN(rawCommentTime) || rawCommentTime < 1650000000000) ? now : rawCommentTime;
    if (now - commentTs > MAX_COMMENT_AGE_MS) {
      console.warn(`[Worker] Comment ${commentId} is older than 7 days, skipping.`);
      await db.prepare('INSERT INTO comment_replies (id, comment_id, instagram_account_id, commenter_username, comment_text, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), commentId, account.id, commenterUsername || 'user', text || '', 'window_closed', 'Comment older than 7 days');
      return;
    }

    const allRules = await db.prepare("SELECT * FROM automation_rules WHERE instagram_account_id = ? AND type = 'comment_to_dm' AND is_active = 1").all(account.id);
    
    // Priority 1: Match rule specifically tied to this Reel/Post mediaId
    let rule = null;
    if (mediaId) {
      rule = allRules.find(r => r.target_media_id && String(r.target_media_id) === String(mediaId) && this.matchKeyword(text, r.trigger_keyword, r.match_mode));
      if (rule) {
        console.log(`[Worker] 🎯 Matched specific Reel/Post rule for mediaId ${mediaId} (Keyword: "${rule.trigger_keyword}")`);
      }
    }

    // Priority 2: Fallback to global rules (target_media_id IS NULL or empty)
    if (!rule) {
      rule = allRules.find(r => (!r.target_media_id || r.target_media_id === '') && this.matchKeyword(text, r.trigger_keyword, r.match_mode));
    }

    if (!rule) {
      console.log(`[Worker] No comment_to_dm rule matched for: "${text}" on media: ${mediaId || 'global'} (@${account.username})`);
      return;
    }

    const mode = rule.comment_reply_mode || 'both';
    const dmTextTemplate = (rule.dm_reply_message && rule.dm_reply_message.trim()) || (rule.reply_message && rule.reply_message.trim()) || '';
    
    // Anti-spam Comment Variation: If templates are separated by '|', pick one randomly
    let rawCommentTemplate = (rule.comment_reply_message && rule.comment_reply_message.trim()) || (mode === 'both' ? 'Check your DM! 🚀' : (mode === 'comment_only' ? (rule.reply_message || 'Check your DM! 🚀') : ''));
    if (rawCommentTemplate.includes('|')) {
      const parts = rawCommentTemplate.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        rawCommentTemplate = parts[Math.floor(Math.random() * parts.length)];
      }
    }
    const commentTextTemplate = rawCommentTemplate;

    const shouldSendDm = (mode === 'both' || mode === 'dm_only') && Boolean(dmTextTemplate);
    const shouldReplyComment = (mode === 'both' || mode === 'comment_only') && Boolean(commentTextTemplate);

    if (!shouldSendDm && !shouldReplyComment) {
      console.warn(`[Worker] Rule "${rule.trigger_keyword}" matched but neither comment reply nor DM is configured for mode: ${mode}`);
      return;
    }

    const subStatus = user.subscription_status || 'active';
    if (subStatus === 'unpaid' || subStatus === 'suspended') {
      console.warn(`[Worker] 🛑 User ${user.id} subscription is ${subStatus}. Suppressing automated comment response.`);
      return;
    }

    const dmLimit = dmLimitFor(user.plan);
    if (shouldSendDm && user.dm_usage_this_period >= dmLimit) {
      await db.prepare('INSERT INTO comment_replies (id, comment_id, automation_rule_id, instagram_account_id, commenter_username, comment_text, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), commentId, rule.id, account.id, commenterUsername || 'user', text || '', 'usage_capped', `Plan limit reached (${user.plan || 'free'}: ${dmLimit})`);
      return;
    }

    if (!this.checkRateLimit(account.id, 'comment_to_dm')) {
      const e = new Error('Rate limit');
      e.isPermanent = false;
      throw e;
    }

    const token = decrypt(account.page_access_token_enc || account.long_lived_token_enc || account.access_token_enc);
    let dmMsg = null;
    let commentReplyMsg = null;
    let metaMessageId = null;
    let metaCommentReplyId = null;
    let dmError = null;
    let commentError = null;

    const isSimulated = commentId && (String(commentId).startsWith('c_') || String(commentId).startsWith('sim_') || String(commentId).startsWith('test_'));

    // --- FOLLOWER CHECK (Follow-to-Unlock) GATE ---
    let followerStatus = 'follower';
    if (rule.require_follow == 1) {
      try {
        const followCheck = await metaClient.checkUserFollowsBusiness({
          igScopedUserId: commenterId,
          accessToken: token,
          pageId: account.page_id,
          commenterUsername
        });
        followerStatus = followCheck.isFollowing ? 'follower' : 'non_follower';
        console.log(`[Worker] 🔒 Follower Check active for @${commenterUsername || 'user'}: ${followerStatus}`);
      } catch (fErr) {
        console.warn(`[Worker] Follower check failed:`, fErr.message);
        followerStatus = 'follower'; // Graceful fallback
      }
    }

    if (followerStatus === 'non_follower') {
      console.log(`[Worker] 🔒 User @${commenterUsername || 'user'} is NOT following @${account.username}. Enforcing Follow-to-Unlock gate!`);
      const defaultFollowPrompt = "Hey @{username}! Please follow @{account_name} to get your link! Tap \"✅ I've Followed\" below once done 🚀";
      const rawPrompt = (rule.follow_prompt_message && rule.follow_prompt_message.trim()) || defaultFollowPrompt;
      const followPromptDm = rawPrompt
        .replace(/\{username\}/gi, commenterUsername || 'there')
        .replace(/\{account_name\}/gi, account.username || 'us');

      const defaultFollowComment = "Almost there! Follow @{account_name} and check your DMs to unlock 🚀";
      const rawFollowComment = (rule.follow_comment_reply && rule.follow_comment_reply.trim()) || defaultFollowComment;
      const followCommentReply = rawFollowComment
        .replace(/@?\{username\}/gi, commenterUsername ? `@${commenterUsername}` : 'there')
        .replace(/\{account_name\}/gi, account.username || 'us');

      // Interactive buttons attached to DM for 1-tap follow & verify
      const followQuickReplies = [
        { content_type: 'text', title: '👉 Follow Profile', payload: 'VISIT_PROFILE' },
        { content_type: 'text', title: "✅ I've Followed", payload: 'VERIFY_FOLLOW' }
      ];

      // 1. Post public comment reply for follow prompt
      if (shouldReplyComment || rule.follow_comment_reply) {
        if (isSimulated) {
          metaCommentReplyId = `sim_comm_${uuidv4().slice(0, 8)}`;
          console.log(`[Worker] 🧪 [Simulation] Public follow prompt posted for comment ${commentId}: "${followCommentReply}"`);
        } else {
          try {
            const commResp = await metaClient.sendPublicCommentReply({
              commentId,
              messageText: followCommentReply,
              accessToken: token
            });
            metaCommentReplyId = commResp?.id || null;
            console.log(`[Worker] ✅ Public follow prompt posted to comment ${commentId} by @${commenterUsername || 'user'}`);
          } catch (cErr) {
            commentError = cErr.message;
            console.warn(`[Worker] Public follow prompt error:`, cErr.message);
          }
        }
      }

      // 2. Send follow prompt DM with interactive Quick Reply buttons to commenter
      if (isSimulated) {
        metaMessageId = `sim_dm_${uuidv4().slice(0, 8)}`;
        console.log(`[Worker] 🧪 [Simulation] Follow prompt DM sent to @${commenterUsername}: "${followPromptDm}" (Buttons: [👉 Follow Profile] [✅ I've Followed])`);
      } else {
        try {
          const dmResp = await metaClient.sendPrivateCommentReply({
            pageId: account.page_id,
            commentId,
            messageText: followPromptDm,
            accessToken: token,
            quickReplies: followQuickReplies
          });
          metaMessageId = dmResp?.message_id || null;
          console.log(`[Worker] ✅ Private follow prompt DM with buttons sent for comment ${commentId} to @${commenterUsername || 'user'}`);
        } catch (dErr) {
          dmError = dErr.message;
          console.warn(`[Worker] Private follow prompt DM error:`, dErr.message);
        }
      }

      // 3. Upsert conversation and record pending_follow_rule_id
      const convId = await this.upsertConversation(account.id, commenterId || uuidv4(), commenterUsername || 'user', null, null, text, 'inbound', 'pending_follow');
      await db.prepare('UPDATE conversations SET pending_follow_rule_id = ? WHERE id = ?').run(rule.id, convId);
      
      // Log outbound follow prompt message
      await db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, meta_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        uuidv4(), convId, 'outbound', followPromptDm, 'sent', metaMessageId, new Date().toISOString()
      );

      // 4. Save to comment_replies with follower_status = 'non_follower' and status = 'follow_prompt_sent'
      await db.prepare(`
        INSERT INTO comment_replies (
          id, comment_id, automation_rule_id, instagram_account_id, commenter_username,
          comment_text, reply_sent, public_reply_sent, status, meta_message_id, meta_comment_reply_id,
          follower_status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), commentId, rule.id, account.id, commenterUsername || 'user',
        text || '', followPromptDm, followCommentReply, 'follow_prompt_sent', metaMessageId, metaCommentReplyId,
        'non_follower', [commentError, dmError].filter(Boolean).join('; ') || null
      );

      await this.updateActivityLog(account.id, 'comment');
      return;
    }

    // --- STANDARD EXECUTION FOR VERIFIED FOLLOWERS OR UNGATED RULES ---
    // 1. Post Public Comment Reply (if selected)
    if (shouldReplyComment) {
      const rawComm = commentTextTemplate;
      commentReplyMsg = rawComm.replace(/@?\{username\}/gi, commenterUsername ? `@${commenterUsername}` : 'there');
      if (isSimulated) {
        metaCommentReplyId = `sim_comm_${uuidv4().slice(0, 8)}`;
        console.log(`[Worker] 🧪 [Simulation] Public reply generated for comment ${commentId}: "${commentReplyMsg}"`);
      } else {
        try {
          const commResp = await metaClient.sendPublicCommentReply({
            commentId,
            messageText: commentReplyMsg,
            accessToken: token
          });
          metaCommentReplyId = commResp?.id || null;
          console.log(`[Worker] ✅ Public reply posted to comment ${commentId} by @${commenterUsername || 'user'}`);
        } catch (err) {
          commentError = err.message;
          console.warn(`[Worker] ⚠️ Public comment reply error for ${commentId}:`, err.message);
        }
      }
    }

    // 2. Send Private DM to commenter (if selected)
    if (shouldSendDm) {
      const rawDm = `${account.disclosure_message || ''}${dmTextTemplate}`;
      dmMsg = rawDm.replace(/\{username\}/gi, commenterUsername || 'there');

      const safety = await loopDetection.checkOutboundSafety({
        account,
        recipientId: commenterId,
        recipientUsername: commenterUsername,
        replyContent: dmMsg,
        ruleId: rule.id
      });

      if (!safety.allow) {
        console.warn(`[Worker] 🛡️ Comment Private DM suppressed by safety engine (${safety.reason}) for @${commenterUsername || commenterId}`);
        dmError = `Suppressed by safety safeguard: ${safety.reason}`;
      } else {
        const cardPayload = (rule.card_enabled == 1 && rule.card_title) ? {
          title: (rule.card_title || '').replace(/\{username\}/gi, commenterUsername || 'there'),
          subtitle: (rule.card_subtitle || dmTextTemplate || '').replace(/\{username\}/gi, commenterUsername || 'there'),
          image_url: rule.card_image_url || rule.target_media_thumbnail || undefined,
          button_text: rule.card_button_text || 'View Link 🚀',
          button_url: rule.card_button_url || undefined
        } : null;

        if (isSimulated) {
          metaMessageId = `sim_dm_${uuidv4().slice(0, 8)}`;
          await db.prepare('UPDATE users SET dm_usage_this_period = dm_usage_this_period + 1 WHERE id = ?').run(user.id);
          const cId = await this.upsertConversation(account.id, commenterId || uuidv4(), commenterUsername || 'user', null, null, text, 'inbound', 'replied');
          await loopDetection.recordAutomatedDmSent(cId);
          if (cardPayload) {
            console.log(`[Worker] 🧪 [Simulation] Rich Instagram DM Card sent for comment ${commentId}: "${cardPayload.title}" (Image: ${cardPayload.image_url || 'none'}, CTA: [${cardPayload.button_text}])`);
          } else {
            console.log(`[Worker] 🧪 [Simulation] Private DM generated for comment ${commentId}: "${dmMsg}"`);
          }
        } else {
          try {
            const dmResp = await metaClient.sendPrivateCommentReply({
              pageId: account.page_id,
              commentId,
              messageText: dmMsg,
              accessToken: token,
              card: cardPayload
            });
            metaMessageId = dmResp?.message_id || null;
            await db.prepare('UPDATE users SET dm_usage_this_period = dm_usage_this_period + 1 WHERE id = ?').run(user.id);
            const cId = await this.upsertConversation(account.id, commenterId || uuidv4(), commenterUsername || 'user', null, null, text, 'inbound', 'replied');
            await loopDetection.recordAutomatedDmSent(cId);
            console.log(`[Worker] ✅ Private DM ${cardPayload ? 'Card ' : ''}sent for comment ${commentId} to @${commenterUsername || 'user'}`);
          } catch (err) {
            dmError = err.message;
            console.warn(`[Worker] ⚠️ Private DM reply error for comment ${commentId}:`, err.message);
            if (err.statusCode >= 400 && err.statusCode < 500) err.isPermanent = true;
          }
        }
      }
    }

    // Determine final status
    const anySucceeded = Boolean(metaCommentReplyId || metaMessageId || (!shouldSendDm && !commentError) || (!shouldReplyComment && !dmError));
    const allFailed = (shouldSendDm && dmError && !metaMessageId) && (shouldReplyComment && commentError && !metaCommentReplyId);
    const finalStatus = allFailed ? 'failed' : (dmError || commentError ? 'partial_sent' : 'sent');
    const combinedError = [commentError ? `Comment: ${commentError}` : null, dmError ? `DM: ${dmError}` : null].filter(Boolean).join('; ') || null;

    try {
      await db.prepare(`
        INSERT INTO comment_replies (
          id, comment_id, automation_rule_id, instagram_account_id, commenter_username,
          comment_text, reply_sent, public_reply_sent, status, meta_message_id, meta_comment_reply_id,
          follower_status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), commentId, rule.id, account.id, commenterUsername || 'user',
        text || '', dmMsg, commentReplyMsg, finalStatus, metaMessageId, metaCommentReplyId,
        rule.require_follow ? 'follower' : null, combinedError
      );

      if (anySucceeded) {
        await db.prepare('UPDATE automation_rules SET fire_count = fire_count + 1 WHERE id = ?').run(rule.id);
        await this.updateActivityLog(account.id, 'comment');
      }
    } catch (saveErr) {
      console.error('[Worker] Comment reply save error:', saveErr.message);
    }

    if (allFailed) {
      const err = new Error(combinedError || 'Failed to process comment reply');
      err.isPermanent = true;
      throw err;
    }
  }

  async processMessage(accountId, data) {
    const { messageId, senderId, senderUsername, text, timestamp, isStoryReply, replyToStoryId, quickReplyPayload } = data;
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

    console.log(`[Worker] Processing message for @${account.username} from ${senderUsername || senderId}: "${text}" (isStoryReply: ${Boolean(isStoryReply)}, quickReply: ${quickReplyPayload || 'none'})`);

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
    if (!realName || !realUsername) {
      profileCache.fetchAndCache(senderId, account.access_token_enc, convId, account.page_id).catch(() => {});
    }

    // --- STEP 2.5: Follow-to-Unlock Verification Gate ---
    const convData = await db.prepare('SELECT pending_follow_rule_id FROM conversations WHERE id = ?').get(convId);
    if (convData && convData.pending_follow_rule_id) {
      console.log(`[Worker] 🔒 User @${finalUsername} has a pending follow-to-unlock gate (Rule ID: ${convData.pending_follow_rule_id}, Action: ${quickReplyPayload || text})`);
      const token = decrypt(account.page_access_token_enc || account.long_lived_token_enc || account.access_token_enc);
      const isSimulated = (senderId && String(senderId).startsWith('uid_')) || (messageId && String(messageId).startsWith('mid_')) || (messageId && String(messageId).startsWith('sim_'));

      // If user tapped "👉 Follow Profile" button
      if (quickReplyPayload === 'VISIT_PROFILE') {
        const visitPrompt = `Awesome! Tap "Follow" on our profile @${account.username || 'our page'}, then tap the "✅ I've Followed" button below to unlock your access link! 🚀`;
        const verifyQuickReply = [
          { content_type: 'text', title: "✅ I've Followed", payload: 'VERIFY_FOLLOW' }
        ];
        let resp;
        if (isSimulated) {
          resp = { message_id: `sim_dm_${uuidv4().slice(0, 8)}` };
        } else {
          resp = await metaClient.sendDirectMessage({
            pageId: account.page_id,
            igScopedUserId: senderId,
            messageText: visitPrompt,
            accessToken: token,
            quickReplies: verifyQuickReply
          });
        }
        const outboundCreatedAt = new Date(eventTime + 1000).toISOString();
        await db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, meta_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          uuidv4(), convId, 'outbound', visitPrompt, 'sent', resp.message_id, outboundCreatedAt
        );
        return;
      }
      
      const textLower = String(text || '').trim().toLowerCase();
      // Tapping "✅ I've Followed" button or texting "done", "followed", "yes", etc. triggers follow verification
      const isVerifyTrigger = 
        quickReplyPayload === 'VERIFY_FOLLOW' ||
        textLower === 'done' ||
        textLower.includes('followed') ||
        textLower.includes('following') ||
        textLower.includes("i've followed") ||
        textLower.includes('start followed') ||
        textLower === 'yes' ||
        textLower.includes('follow');

      const simulatedFollow = isSimulated ? (isVerifyTrigger ? true : undefined) : undefined;

      let isNowFollowing = false;
      try {
        const check = await metaClient.checkUserFollowsBusiness({
          igScopedUserId: senderId,
          accessToken: token,
          pageId: account.page_id,
          commenterUsername: finalUsername,
          simulatedFollowState: simulatedFollow
        });
        isNowFollowing = Boolean(check.isFollowing);
      } catch (checkErr) {
        console.warn(`[Worker] Follower re-check failed:`, checkErr.message);
      }

      if (isNowFollowing) {
        console.log(`[Worker] 🎉 Verified! @${finalUsername} is now following! Dispatching unlocked automation reward...`);
        const pendingRule = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(convData.pending_follow_rule_id);
        if (pendingRule) {
          const rewardTemplate = (pendingRule.dm_reply_message && pendingRule.dm_reply_message.trim()) || (pendingRule.reply_message && pendingRule.reply_message.trim()) || "🎉 Thank you for following! Here is your unlocked link: https://airvix.com";
          const cleanFirstName = realName ? realName.split(' ')[0].trim() : (realUsername ? realUsername.replace(/^@/, '') : '');
          const greetingName = cleanFirstName && cleanFirstName.toLowerCase() !== 'user' ? cleanFirstName : 'there';
          const unlockMsg = `${account.disclosure_message || ''}${rewardTemplate}`.replace(/\{username\}/gi, greetingName);
          
          const rewardCard = (pendingRule.card_enabled == 1 && pendingRule.card_title) ? {
            title: pendingRule.card_title.replace(/\{username\}/gi, greetingName),
            subtitle: (pendingRule.card_subtitle || rewardTemplate).replace(/\{username\}/gi, greetingName),
            image_url: pendingRule.card_image_url || pendingRule.target_media_thumbnail || undefined,
            button_text: pendingRule.card_button_text || 'Access Link 🚀',
            button_url: pendingRule.card_button_url || undefined
          } : null;

          let resp;
          if (isSimulated) {
            resp = { message_id: `sim_dm_${uuidv4().slice(0, 8)}` };
            if (rewardCard) {
              console.log(`[Worker] 🧪 [Simulation] Unlocked Rich Card DM generated: "${rewardCard.title}" (CTA: [${rewardCard.button_text}])`);
            } else {
              console.log(`[Worker] 🧪 [Simulation] Unlocked reward DM generated: "${unlockMsg}"`);
            }
          } else {
            resp = await metaClient.sendDirectMessage({
              pageId: account.page_id,
              igScopedUserId: senderId,
              messageText: unlockMsg,
              accessToken: token,
              card: rewardCard
            });
          }

          // Clear pending follow gate on conversation
          await db.prepare("UPDATE conversations SET pending_follow_rule_id = NULL, status = 'replied', updated_at = datetime('now') WHERE id = ?").run(convId);

          const outboundCreatedAt = new Date(eventTime + 1000).toISOString();
          await db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, meta_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            uuidv4(), convId, 'outbound', unlockMsg, 'sent', resp.message_id, outboundCreatedAt
          );
          await db.prepare('UPDATE users SET dm_usage_this_period = dm_usage_this_period + 1 WHERE id = ?').run(user.id);
          await db.prepare('UPDATE automation_rules SET fire_count = fire_count + 1 WHERE id = ?').run(pendingRule.id);
          await this.updateActivityLog(account.id, 'dm');
          await this.upsertConversation(account.id, senderId, finalUsername, realName, profilePic, unlockMsg, 'outbound', 'replied', new Date().toISOString());
          console.log(`[Worker] ✅ Follower reward sent and unlocked for @${finalUsername}`);
          return;
        }
      } else {
        console.log(`[Worker] User @${finalUsername} triggered verification, but follow check still returned false.`);
        const reminderMsg = `Hey @${finalUsername}! I still don't see your follow on @${account.username || 'our page'}. Tap the follow button on our profile, then tap "✅ I've Followed" below! ✨`;
        const retryQuickReplies = [
          { content_type: 'text', title: '👉 Follow Profile', payload: 'VISIT_PROFILE' },
          { content_type: 'text', title: "✅ I've Followed", payload: 'VERIFY_FOLLOW' }
        ];
        let resp;
        if (isSimulated) {
          resp = { message_id: `sim_dm_${uuidv4().slice(0, 8)}` };
        } else {
          resp = await metaClient.sendDirectMessage({
            pageId: account.page_id,
            igScopedUserId: senderId,
            messageText: reminderMsg,
            accessToken: token,
            quickReplies: retryQuickReplies
          });
        }
        const outboundCreatedAt = new Date(eventTime + 1000).toISOString();
        await db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, meta_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          uuidv4(), convId, 'outbound', reminderMsg, 'sent', resp.message_id, outboundCreatedAt
        );
        await this.upsertConversation(account.id, senderId, finalUsername, realName, profilePic, reminderMsg, 'outbound', 'pending_follow', new Date().toISOString());
        return;
      }
    }

    // Match Rules:
    let rule = null;
    if (isStoryReply) {
      // Check for story_reply rules first
      const storyRules = await db.prepare("SELECT * FROM automation_rules WHERE instagram_account_id = ? AND type = 'story_reply' AND is_active = 1").all(account.id);
      rule = storyRules.find(r => {
        const mediaMatch = !r.target_media_id || !replyToStoryId || String(r.target_media_id) === String(replyToStoryId);
        return mediaMatch && this.matchKeyword(text, r.trigger_keyword, r.match_mode);
      });
      if (rule) {
        console.log(`[Worker] ⏳ Matched Story Reply rule (Keyword: "${rule.trigger_keyword}")`);
      }
    }

    // If not a story reply or no specific story rule matched, check standard DM rules
    if (!rule) {
      const dmRules = await db.prepare("SELECT * FROM automation_rules WHERE instagram_account_id = ? AND type = 'dm_keyword_reply' AND is_active = 1").all(account.id);
      rule = dmRules.find(r => this.matchKeyword(text, r.trigger_keyword, r.match_mode));
    }

    if (!rule) {
      console.log(`[Worker] No rule matched for "${text}" (isStoryReply: ${Boolean(isStoryReply)}) on @${account.username}`);
      return;
    }

    // 24h window
    if (now - eventTime > MAX_DM_WINDOW_MS) {
      // Outbound entries for closed window — use a timestamp 1s after inbound
      const closedOutTs = new Date(eventTime + 1000).toISOString();
      await db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), convId, 'outbound', rule.reply_message, 'window_closed', '24-hour window expired', closedOutTs);
      return;
    }

    const subStatus = user.subscription_status || 'active';
    if (subStatus === 'unpaid' || subStatus === 'suspended') {
      console.warn(`[Worker] 🛑 User ${user.id} subscription is ${subStatus}. Suppressing automated DM response.`);
      return;
    }

    const dmLimit = dmLimitFor(user.plan);
    if (user.dm_usage_this_period >= dmLimit) {
      const cappedOutTs = new Date(eventTime + 1000).toISOString();
      await db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), convId, 'outbound', rule.reply_message, 'usage_capped', `Plan limit reached (${user.plan || 'free'}: ${dmLimit})`, cappedOutTs);
      return;
    }

    if (!this.checkRateLimit(account.id, 'dm_keyword_reply')) { const e = new Error('Rate limit'); e.isPermanent = false; throw e; }

    const rawMsg = `${account.disclosure_message || ''}${rule.reply_message}`;
    // Use first name of user if available (e.g. "Priyanshu"), or clean handle, or fallback to 'there'
    const cleanFirstName = realName ? realName.split(' ')[0].trim() : (realUsername ? realUsername.replace(/^@/, '') : '');
    const greetingName = cleanFirstName && cleanFirstName.toLowerCase() !== 'user' ? cleanFirstName : 'there';
    const msg = rawMsg.replace(/\{username\}/gi, greetingName);
    const isSimulated = (senderId && String(senderId).startsWith('uid_')) || (messageId && String(messageId).startsWith('mid_'));

    const ruleCard = (rule.card_enabled == 1 && rule.card_title) ? {
      title: rule.card_title.replace(/\{username\}/gi, greetingName),
      subtitle: (rule.card_subtitle || msg).replace(/\{username\}/gi, greetingName),
      image_url: rule.card_image_url || rule.target_media_thumbnail || undefined,
      button_text: rule.card_button_text || 'Open Link 🚀',
      button_url: rule.card_button_url || undefined
    } : null;

    // Run Outbound Safety & Loop Detection
    const safety = await loopDetection.checkOutboundSafety({
      account,
      recipientId: senderId,
      recipientUsername: finalUsername,
      replyContent: msg,
      ruleId: rule.id,
      conversationId: convId
    });

    if (!safety.allow) {
      console.warn(`[Worker] 🛡️ Inbound DM reply suppressed by safety engine (${safety.reason}) for @${finalUsername}`);
      const safetyOutTs = new Date(eventTime + 1000).toISOString();
      await db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        uuidv4(), convId, 'outbound', msg, 'suppressed_loop_safety', safety.reason, safetyOutTs
      );
      return;
    }

    try {
      let resp;
      if (isSimulated) {
        resp = { message_id: `sim_dm_${uuidv4().slice(0, 8)}` };
        if (ruleCard) {
          console.log(`[Worker] 🧪 [Simulation] Inbound DM Rich Card reply: "${ruleCard.title}" (CTA: [${ruleCard.button_text}])`);
        } else {
          console.log(`[Worker] 🧪 [Simulation] DM auto-reply generated: "${msg}"`);
        }
      } else {
        const tok = decrypt(account.page_access_token_enc || account.long_lived_token_enc || account.access_token_enc);
        resp = await metaClient.sendDirectMessage({ 
          pageId: account.page_id, 
          igScopedUserId: senderId, 
          messageText: msg, 
          accessToken: tok,
          card: ruleCard
        });
      }
      // Outbound auto-reply timestamp: 1 second after the inbound event to ensure correct ordering
      const outboundCreatedAt = new Date(eventTime + 1000).toISOString();
      await db.prepare('INSERT INTO messages (id, conversation_id, direction, content, status, meta_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), convId, 'outbound', msg, 'sent', resp.message_id, outboundCreatedAt);
      await db.prepare('UPDATE users SET dm_usage_this_period = dm_usage_this_period + 1 WHERE id = ?').run(user.id);
      await db.prepare('UPDATE automation_rules SET fire_count = fire_count + 1 WHERE id = ?').run(rule.id);
      await loopDetection.recordAutomatedDmSent(convId);
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

  async isDuplicate(idempotencyKey) {
    if (!idempotencyKey) return false;
    try {
      const existing = await db.prepare('SELECT id FROM webhook_events WHERE idempotency_key = ?').get(idempotencyKey);
      return Boolean(existing);
    } catch (e) {
      return false;
    }
  }

  async handleDeadLetter(job, err) {
    try {
      const dlqId = uuidv4();
      const jobId = job.id || `job-${Date.now()}`;
      const userId = job.userId || job.data?.userId || 'system';
      const queueName = job.type || 'dm-dispatch';
      const payloadStr = typeof job === 'string' ? job : JSON.stringify(job);
      const errorName = err?.name || 'WorkerError';
      const errorMessage = err?.message || String(err);
      const errorStack = err?.stack || null;
      const retryCount = job.attempt || job.attempts || 3;

      await db.prepare(`
        INSERT INTO dead_letter_queue (
          id, job_id, user_id, queue_name, payload, error_name, error_message, error_stack, retry_count, is_resolved, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
      `).run(dlqId, jobId, userId, queueName, payloadStr, errorName, errorMessage, errorStack, retryCount);

      console.warn(`[Queue DLQ] ☠️ Dispatched job ${jobId} to dead-letter queue: ${errorMessage}`);
      return dlqId;
    } catch (dlqErr) {
      console.error('[Queue DLQ] Error persisting dead letter item:', dlqErr.message);
      return null;
    }
  }

  async reprocessDlqJob(dlqId, userId) {
    try {
      const record = await db.prepare('SELECT * FROM dead_letter_queue WHERE id = ?').get(dlqId);
      if (!record) {
        throw new Error(`DLQ record ${dlqId} not found`);
      }

      if (userId && record.user_id && record.user_id !== userId && userId !== 'admin') {
        throw new Error('Unauthorized DLQ access');
      }

      let parsedPayload = null;
      try {
        parsedPayload = JSON.parse(record.payload);
      } catch (e) {
        parsedPayload = record.payload;
      }

      // Re-enqueue job
      const newJobId = record.job_id || `reprocess-${uuidv4()}`;
      if (typeof parsedPayload === 'object' && parsedPayload.data) {
        await this.add(parsedPayload.type || 'INSTAGRAM_DM', parsedPayload.data, { userId: record.user_id });
      }

      // Mark DLQ entry resolved
      await db.prepare(`
        UPDATE dead_letter_queue 
        SET is_resolved = 1, resolved_at = datetime('now') 
        WHERE id = ?
      `).run(dlqId);

      return { success: true, newJobId };
    } catch (err) {
      console.error('[Queue DLQ] Reprocess error:', err.message);
      throw err;
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
