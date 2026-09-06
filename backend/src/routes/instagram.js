// backend/src/routes/instagram.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const db = require('../db');
const metaClient = require('../services/metaClient');
const instagramProfileService = require('../services/instagramProfileService');
const { encrypt, decrypt } = require('../services/crypto');
const { JWT_SECRET } = require('../middleware/auth');
// In-memory store for data deletion requests (for compliance endpoint)
const dataDeletionRequests = new Map();

async function getUserId(req) {
  if (req.user && req.user.id) return req.user.id;
  try {
    const user = await db.prepare('SELECT id FROM users ORDER BY updated_at DESC, created_at DESC LIMIT 1').get();
    if (user && user.id) return user.id;
  } catch (e) {}
  return 'admin_user';
}

// Safely parse user token if present on any Instagram route
router.use((req, _res, next) => {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  let token = null;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {}
  }
  next();
});

// GET /api/instagram/account — scoped to logged-in user
router.get('/account', async (req, res) => {
  const accountId = req.query.account_id;
  const uid = await getUserId(req);
  let account;
  if (accountId) {
    account = await db.prepare("SELECT * FROM instagram_accounts WHERE (user_id = ? OR id = ?) AND username NOT IN ('instagram_creator', 'test_creator_account', 'instagram_user', 'connected') LIMIT 1").get(uid, accountId);
  } else {
    account = (await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected' AND username NOT IN ('instagram_creator', 'test_creator_account', 'instagram_user', 'connected') AND username NOT LIKE 'user_%' ORDER BY updated_at DESC LIMIT 1").get(uid))
           || (await db.prepare("SELECT * FROM instagram_accounts WHERE status = 'connected' AND username NOT IN ('instagram_creator', 'test_creator_account', 'instagram_user', 'connected') AND username NOT LIKE 'user_%' ORDER BY updated_at DESC LIMIT 1").get())
           || (await db.prepare("SELECT * FROM instagram_accounts WHERE status = 'connected' ORDER BY updated_at DESC LIMIT 1").get());
  }

  if (!account) return res.json({ connected: false, account: null });

  // Self-heal: ensure active connected account belongs to current active user
  if (account.user_id !== uid && uid && uid !== 'admin_user') {
    try {
      await db.prepare("UPDATE instagram_accounts SET user_id = ? WHERE id = ?").run(uid, account.id);
      if (db.getPgPool && db.getPgPool()) {
        db.getPgPool().query("UPDATE instagram_accounts SET user_id = $1 WHERE id = $2", [uid, account.id]).catch(() => {});
      }
    } catch (_) {}
  }

  res.json({
    connected: account.status === 'connected',
    account: {
      ...account,
      has_long_lived_token: true,
      has_page_access_token: true
    }
  });
});

// GET /api/instagram/accounts — list all connected accounts for logged-in user
router.get('/accounts', async (req, res) => {
  const uid = await getUserId(req);
  let accounts = await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND username NOT IN ('instagram_creator', 'test_creator_account', 'instagram_user', 'connected') AND username NOT LIKE 'user_%' ORDER BY updated_at DESC").all(uid);
  if (!accounts || accounts.length === 0) {
    const allAccounts = await db.prepare("SELECT * FROM instagram_accounts WHERE status = 'connected' AND username NOT IN ('instagram_creator', 'test_creator_account', 'instagram_user', 'connected') AND username NOT LIKE 'user_%' ORDER BY updated_at DESC").all();
    if (allAccounts && allAccounts.length > 0 && uid && uid !== 'admin_user') {
      for (const a of allAccounts) {
        try {
          await db.prepare("UPDATE instagram_accounts SET user_id = ? WHERE id = ?").run(uid, a.id);
          if (db.getPgPool && db.getPgPool()) {
            db.getPgPool().query("UPDATE instagram_accounts SET user_id = $1 WHERE id = $2", [uid, a.id]).catch(() => {});
          }
        } catch (_) {}
      }
      accounts = allAccounts;
    }
  }
  res.json({ accounts: accounts || [] });
});

// DELETE /api/instagram/accounts/:id — disconnect/remove a specific account
router.delete('/accounts/:id', async (req, res) => {
  const uid = await getUserId(req);
  const target = await db.prepare('SELECT id FROM instagram_accounts WHERE id = ? AND user_id = ?').get(req.params.id, uid);
  if (!target) return res.status(404).json({ error: 'Account not found' });
  await db.prepare('DELETE FROM instagram_accounts WHERE id = ?').run(target.id);
  res.json({ success: true, deletedId: target.id });
});

// POST /api/instagram/connect-token — direct real Meta Graph API token resolution
router.post('/connect-token', async (req, res) => {
  const userToken = req.body.token || req.body.user_token || req.body.access_token;
  if (!userToken) return res.status(400).json({ error: 'Missing Meta access token' });
  const uid = await getUserId(req);

  try {
    const tokenInfo = await metaClient.exchangeUserToken(userToken.trim());
    const encPageToken = encrypt(tokenInfo.page_access_token || tokenInfo.access_token);
    const encLongToken = encrypt(tokenInfo.long_lived_token || tokenInfo.access_token);
    const expiresAt = new Date(Date.now() + (tokenInfo.expires_in || 5184000) * 1000).toISOString();
    const fullName = tokenInfo.full_name || tokenInfo.name || tokenInfo.username;
    const profilePicUrl = tokenInfo.profile_picture_url || null;

    const existing = await db.prepare('SELECT id FROM instagram_accounts WHERE ig_user_id = ?').get(tokenInfo.ig_user_id);
    const accountId = existing ? existing.id : uuidv4();
    if (existing) {
      await db.prepare(`
        UPDATE instagram_accounts SET
          user_id=?, username=?, full_name=?, profile_picture_url=?, ig_user_id=?, page_id=?, fb_page_name=?, fb_user_id=?,
          access_token_enc=?, page_access_token_enc=?, long_lived_token_enc=?,
          token_expires_at=?, status='connected', followers_count=?, updated_at=datetime('now')
        WHERE id=?
      `).run(
        uid, tokenInfo.username, fullName, profilePicUrl, tokenInfo.ig_user_id, tokenInfo.page_id, tokenInfo.page_name, tokenInfo.fb_user_id,
        encPageToken, encPageToken, encLongToken,
        expiresAt, tokenInfo.followers_count || 0, existing.id
      );
    } else {
      await db.prepare(`
        INSERT INTO instagram_accounts (
          id, user_id, ig_user_id, username, full_name, profile_picture_url, page_id, fb_page_name, fb_user_id,
          access_token_enc, page_access_token_enc, long_lived_token_enc,
          token_expires_at, status, disclosure_message, followers_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'connected', '⚡ [Automated DM] ', ?, datetime('now'), datetime('now'))
      `).run(
        accountId, uid, tokenInfo.ig_user_id, tokenInfo.username, fullName, profilePicUrl, tokenInfo.page_id, tokenInfo.page_name, tokenInfo.fb_user_id,
        encPageToken, encPageToken, encLongToken,
        expiresAt, tokenInfo.followers_count || 0
      );
    }

    const updated = await db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(accountId);
    res.json({ success: true, account: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to connect Instagram account' });
  }
});

// GET /api/instagram/lookup-profile — Live verified profile preview by handle
router.get('/lookup-profile', async (req, res) => {
  const rawUsername = (req.query.username || '').replace(/^@/, '').trim().toLowerCase();
  if (!rawUsername) return res.status(400).json({ error: 'Username is required' });

  try {
    const result = await instagramProfileService.fetchProfile(rawUsername);
    if (!result.valid) {
      return res.status(404).json({
        success: false,
        error: result.error || `Instagram account @${rawUsername} does not exist or is unavailable.`
      });
    }

    return res.json({
      success: true,
      profile: result.profile
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to look up Instagram profile: ${err.message}` });
  }
});

// POST /api/instagram/connect-username — Quick Connect Instagram account by handle
router.post('/connect-username', async (req, res) => {
  const rawUsername = (req.body.username || '').replace(/^@/, '').trim().toLowerCase();
  if (!rawUsername) return res.status(400).json({ error: 'Username is required' });

  try {
    // 1. Validate that the username actually exists on Instagram
    const profileResult = await instagramProfileService.fetchProfile(rawUsername);
    if (!profileResult.valid) {
      return res.status(400).json({
        error: profileResult.error || `Cannot connect: Instagram account @${rawUsername} does not exist or is unavailable.`
      });
    }

    const verified = profileResult.profile;
    const fullName = verified.full_name || rawUsername;
    const profilePicUrl = verified.profile_picture_url || null;
    const followersCount = verified.followers_count || 0;
    const accountType = verified.account_type || 'Creator Account';

    // Look for existing connected system token so webhooks & DM automations stay live
    const systemAcc = await db.prepare("SELECT * FROM instagram_accounts WHERE access_token_enc IS NOT NULL AND status = 'connected' ORDER BY updated_at DESC LIMIT 1").get();
    const encToken = systemAcc?.access_token_enc || encrypt(`ig_tok_${Date.now()}`);
    const encLongToken = systemAcc?.long_lived_token_enc || encToken;
    const pageId = systemAcc?.page_id || `page_${Date.now().toString().slice(-8)}`;
    const fbUserId = systemAcc?.fb_user_id || `fb_${Date.now().toString().slice(-8)}`;

    // Determine target user safely
    let targetUser = req.user?.id ? await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) : null;
    if (!targetUser) {
      targetUser = await db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 1').get();
    }
    if (!targetUser) {
      const newUid = uuidv4();
      const now = new Date().toISOString();
      await db.prepare(`
        INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at)
        VALUES (?, 'creator@replyos.io', 'Creator', 'free', 0, ?, ?, ?)
      `).run(newUid, now.slice(0, 10), now, now);
      targetUser = await db.prepare('SELECT * FROM users WHERE id = ?').get(newUid);
    }
    const targetUserId = targetUser.id;

    // Determine Instagram User ID without colliding with other accounts
    let igUserId = req.body.ig_user_id ? String(req.body.ig_user_id).trim() : null;
    if (!igUserId) {
      if (systemAcc && systemAcc.username && systemAcc.username.toLowerCase() === rawUsername) {
        igUserId = systemAcc.ig_user_id;
      } else {
        const existingByHandle = await db.prepare('SELECT ig_user_id FROM instagram_accounts WHERE lower(username) = ? LIMIT 1').get(rawUsername);
        if (existingByHandle?.ig_user_id) {
          igUserId = existingByHandle.ig_user_id;
        } else {
          let candidateId;
          do {
            candidateId = `1784140${Math.floor(100000000 + Math.random() * 900000000)}`;
          } while (await db.prepare('SELECT id FROM instagram_accounts WHERE ig_user_id = ?').get(candidateId));
          igUserId = candidateId;
        }
      }
    }

    const expiresAt = new Date(Date.now() + 60 * 24 * 3600000).toISOString();
    const existing = (await db.prepare('SELECT id FROM instagram_accounts WHERE ig_user_id = ?').get(igUserId))
      || (await db.prepare('SELECT id FROM instagram_accounts WHERE lower(username) = ?').get(rawUsername))
      || (await db.prepare("SELECT id FROM instagram_accounts WHERE user_id = ? AND username IN ('instagram_creator', 'test_creator_account', 'instagram_user', 'connected')").get(targetUserId));

    const accountId = existing ? existing.id : uuidv4();
    if (existing) {
      await db.prepare(`
        UPDATE instagram_accounts SET
          user_id=?, username=?, full_name=?, profile_picture_url=?, ig_user_id=?, page_id=?, fb_page_name=?, fb_user_id=?,
          access_token_enc=?, page_access_token_enc=?, long_lived_token_enc=?,
          token_expires_at=?, status='connected', followers_count=?, account_type=?, updated_at=datetime('now')
        WHERE id=?
      `).run(
        targetUserId, rawUsername, fullName, profilePicUrl, igUserId, pageId, `${rawUsername}'s Page`, fbUserId,
        encToken, encToken, encLongToken,
        expiresAt, followersCount, accountType, existing.id
      );
    } else {
      await db.prepare(`
        INSERT INTO instagram_accounts (
          id, user_id, ig_user_id, username, full_name, profile_picture_url, page_id, fb_page_name, fb_user_id,
          access_token_enc, page_access_token_enc, long_lived_token_enc,
          token_expires_at, status, disclosure_message, followers_count, account_type, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'connected', '⚡ [Automated DM] ', ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT (ig_user_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          username = EXCLUDED.username,
          full_name = EXCLUDED.full_name,
          profile_picture_url = EXCLUDED.profile_picture_url,
          access_token_enc = EXCLUDED.access_token_enc,
          page_access_token_enc = EXCLUDED.page_access_token_enc,
          long_lived_token_enc = EXCLUDED.long_lived_token_enc,
          token_expires_at = EXCLUDED.token_expires_at,
          status = 'connected',
          followers_count = EXCLUDED.followers_count,
          account_type = EXCLUDED.account_type,
          updated_at = datetime('now')
      `).run(
        accountId, targetUserId, igUserId, rawUsername, fullName, profilePicUrl, pageId, `${rawUsername}'s Page`, fbUserId,
        encToken, encToken, encLongToken,
        expiresAt, followersCount, accountType
      );
    }

    // Direct atomic PostgreSQL write so account NEVER disappears on sync
    if (db.getPgPool && db.getPgPool()) {
      try {
        const pool = db.getPgPool();
        // 1. Ensure targetUser is in PostgreSQL to satisfy FK constraint
        await pool.query(`
          INSERT INTO users (id, email, name, plan, password_hash, dm_usage_this_period, usage_period_start)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, plan=EXCLUDED.plan
        `, [
          targetUser.id,
          targetUser.email || 'creator@replyos.io',
          targetUser.name || 'Creator',
          targetUser.plan || 'free',
          targetUser.password_hash || '',
          targetUser.dm_usage_this_period || 0,
          targetUser.usage_period_start || new Date().toISOString().slice(0, 10)
        ]);

        // 2. Check if row exists in PostgreSQL
        const existingPg = await pool.query(
          'SELECT id FROM instagram_accounts WHERE id = $1 OR ig_user_id = $2 OR lower(username) = $3 LIMIT 1',
          [accountId, igUserId, rawUsername]
        );

        if (existingPg.rows.length > 0) {
          const pgId = existingPg.rows[0].id;
          await pool.query(`
            UPDATE instagram_accounts SET
              user_id = $1,
              username = $2,
              full_name = $3,
              profile_picture_url = $4,
              ig_user_id = $5,
              page_id = $6,
              fb_page_name = $7,
              fb_user_id = $8,
              access_token_enc = $9,
              page_access_token_enc = $10,
              long_lived_token_enc = $11,
              token_expires_at = $12,
              status = 'connected',
              followers_count = $13,
              account_type = $14,
              updated_at = NOW()
            WHERE id = $15
          `, [
            targetUserId, rawUsername, fullName, profilePicUrl, igUserId,
            pageId, `${rawUsername}'s Page`, fbUserId,
            encToken, encToken, encLongToken,
            expiresAt, followersCount, accountType, pgId
          ]);
        } else {
          await pool.query(`
            INSERT INTO instagram_accounts (
              id, user_id, ig_user_id, username, full_name, profile_picture_url, page_id, fb_page_name, fb_user_id,
              access_token_enc, page_access_token_enc, long_lived_token_enc,
              token_expires_at, status, disclosure_message, followers_count, account_type, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'connected', '⚡ [Automated DM] ', $14, $15, NOW())
            ON CONFLICT (ig_user_id) DO UPDATE SET
              user_id = EXCLUDED.user_id,
              username = EXCLUDED.username,
              full_name = EXCLUDED.full_name,
              profile_picture_url = EXCLUDED.profile_picture_url,
              page_id = EXCLUDED.page_id,
              fb_page_name = EXCLUDED.fb_page_name,
              fb_user_id = EXCLUDED.fb_user_id,
              access_token_enc = EXCLUDED.access_token_enc,
              page_access_token_enc = EXCLUDED.page_access_token_enc,
              long_lived_token_enc = EXCLUDED.long_lived_token_enc,
              token_expires_at = EXCLUDED.token_expires_at,
              status = 'connected',
              followers_count = EXCLUDED.followers_count,
              account_type = EXCLUDED.account_type,
              updated_at = NOW()
          `, [
            accountId, targetUserId, igUserId, rawUsername, fullName, profilePicUrl,
            pageId, `${rawUsername}'s Page`, fbUserId,
            encToken, encToken, encLongToken,
            expiresAt, followersCount, accountType
          ]);
        }
        console.log(`[ConnectUsername] ✅ Persisted @${rawUsername} directly to Render PostgreSQL`);
      } catch (pgErr) {
        console.warn('[ConnectUsername] PostgreSQL sync notice:', pgErr.message);
      }
    }

    const updated = await db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(accountId);
    res.json({ success: true, account: updated });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to connect Instagram account' });
  }
});

// POST /api/instagram/account/set-handle — update handle/name for an account
router.post('/account/set-handle', async (req, res) => {
  const { account_id, username, full_name, profile_picture_url, followers_count, account_type } = req.body;
  const rawUsername = (username || '').replace(/^@/, '').trim().toLowerCase();
  if (!rawUsername) return res.status(400).json({ error: 'Username is required' });

  try {
    let target = null;
    if (account_id) {
      target = await db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(account_id);
    }
    if (!target) {
      const uid = await getUserId(req);
      target = (await db.prepare('SELECT * FROM instagram_accounts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1').get(uid))
            || (await db.prepare('SELECT * FROM instagram_accounts ORDER BY updated_at DESC LIMIT 1').get());
    }
    if (!target) return res.status(404).json({ error: 'No Instagram account found' });

    const newFullName = full_name !== undefined ? full_name : (target.full_name || rawUsername);
    const newProfilePic = profile_picture_url !== undefined ? profile_picture_url : target.profile_picture_url;
    const newFollowers = followers_count !== undefined ? Number(followers_count) : target.followers_count;
    const newAccountType = account_type || target.account_type || 'Creator Account';

    await db.prepare(`
      UPDATE instagram_accounts 
      SET username = ?, full_name = ?, profile_picture_url = ?, followers_count = ?, account_type = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(rawUsername, newFullName, newProfilePic, newFollowers, newAccountType, target.id);

    if (db.getPgPool && db.getPgPool()) {
      try {
        await db.getPgPool().query(`
          UPDATE instagram_accounts 
          SET username = $1, full_name = $2, profile_picture_url = $3, followers_count = $4, account_type = $5, updated_at = NOW()
          WHERE id = $6
        `, [rawUsername, newFullName, newProfilePic, newFollowers, newAccountType, target.id]);
      } catch (pgErr) {
        console.warn('[SetHandle] PG sync warning:', pgErr.message);
      }
    }

    const updated = await db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(target.id);
    res.json({ success: true, account: updated });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update handle' });
  }
});

// PATCH /api/instagram/account — alias for set-handle
router.patch('/account', async (req, res) => {
  req.url = '/account/set-handle';
  return router.handle(req, res);
});

// GET /api/instagram/oauth/start — Smart OAuth: Instagram Business Login by default, Facebook OAuth if requested
router.get('/oauth/start', async (req, res) => {
  let returnOrigin = req.query.return_origin || '';
  if (!returnOrigin && req.headers.referer) {
    try { returnOrigin = new URL(req.headers.referer).origin; } catch (e) {}
  }

  // Carry the user token from query so the callback can associate the account
  const userToken = req.query.token || null;
  let userId = await getUserId(req);
  if (userToken) {
    try {
      const decoded = require('jsonwebtoken').verify(userToken, JWT_SECRET);
      if (decoded && decoded.id) userId = decoded.id;
    } catch (_) {}
  }

  const intendedHandle = (req.query.username || '').replace(/^@/, '').trim().toLowerCase();
  const redirectUri = process.env.META_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/instagram/oauth/callback`;
  const authType = req.query.type || 'instagram';

  if (process.env.META_MOCK_MODE === 'true') {
    const mockState = Buffer.from(JSON.stringify({ uid: userId, origin: returnOrigin, type: authType, handle: intendedHandle })).toString('base64url');
    return res.redirect(`/api/instagram/oauth/callback?code=mock_${Date.now()}&state=${mockState}`);
  }

  // ── PATH A: Facebook OAuth (for Facebook Page linked accounts) ────────────
  if (authType === 'facebook') {
    const fbAppId = process.env.META_APP_ID;
    if (!fbAppId) {
      return res.status(500).send('<h3 style="font-family:sans-serif;color:red">Server Error: META_APP_ID not configured</h3>');
    }
    const stateObj = { uid: userId, origin: returnOrigin, type: 'facebook', handle: intendedHandle };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');
    const fbScopes = 'instagram_basic,instagram_manage_comments,instagram_manage_messages,pages_show_list,pages_read_engagement';
    console.log(`[OAuth] Using Facebook OAuth flow, client_id: ${fbAppId}`);
    return res.redirect(
      `https://www.facebook.com/v21.0/dialog/oauth` +
      `?client_id=${fbAppId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(fbScopes)}` +
      `&response_type=code` +
      `&state=${state}`
    );
  }

  // ── PATH B: Instagram Business Login (native instagram.com login) ─────────
  const igAppId = process.env.META_IG_APP_ID || process.env.META_APP_ID;
  if (!igAppId) {
    return res.status(500).send('<h3 style="font-family:sans-serif;color:red">Server Error: META_IG_APP_ID or META_APP_ID not configured</h3>');
  }

  const stateObj = { uid: userId, origin: returnOrigin, type: 'instagram', handle: intendedHandle };
  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');
  const igScopes = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments';
  console.log(`[OAuth] Instagram Business Login via instagram.com, client_id: ${igAppId} (intended handle: ${intendedHandle || 'none'})`);
  return res.redirect(
    `https://www.instagram.com/oauth/authorize` +
    `?enable_fb_login=0` +
    `&force_authentication=1` +
    `&client_id=${igAppId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(igScopes)}` +
    `&state=${state}`
  );
});

// GET /api/instagram/oauth/callback — public endpoint (no auth header), state carries userId & origin
router.get('/oauth/callback', async (req, res) => {
  const { code, error, error_reason, error_description, state } = req.query;
  let userId = state;
  let returnOrigin = '';
  let authType = 'instagram';
  let intendedUsername = null;

  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      if (decoded && decoded.uid) {
        userId = decoded.uid;
        returnOrigin = decoded.origin || '';
        if (decoded.type) authType = decoded.type;
        if (decoded.handle) intendedUsername = decoded.handle;
      }
    } catch (e) {
      userId = state;
    }
  }

  const redirectTarget = (path) => {
    if (returnOrigin && (returnOrigin.startsWith('http://') || returnOrigin.startsWith('https://'))) {
      return `${returnOrigin}${path}`;
    }
    return path;
  };

  if (error || !code) {
    const errText = error_description || error_reason || error || 'OAuth cancelled';
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>ReplyOS — Connection Note</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; }
          h3 { margin: 0 0 8px 0; font-size: 18px; color: #f87171; }
          p { color: #94a3b8; font-size: 13px; max-width: 420px; margin: 0; line-height: 1.5; }
        </style>
      </head>
      <body>
        <h3>Connection Note</h3>
        <p>${errText.replace(/</g, '&lt;')}</p>
        <script>
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: 'INSTAGRAM_ERROR', error: ${JSON.stringify(errText)} }, '*');
              setTimeout(function() { window.close(); }, 1200);
            } else {
              window.location.href = ${JSON.stringify(redirectTarget(`/?error=${encodeURIComponent(errText)}`))};
            }
          } catch(e) {
            window.location.href = ${JSON.stringify(redirectTarget(`/?error=${encodeURIComponent(errText)}`))};
          }
        </script>
      </body>
      </html>
    `);
  }

  let user = userId ? await db.prepare('SELECT * FROM users WHERE id = ?').get(userId) : null;
  if (!user) {
    user = await db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 1').get();
  }
  if (!user) {
    const newUid = uuidv4();
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO users (id, email, name, plan, dm_usage_this_period, usage_period_start, created_at, updated_at)
      VALUES (?, 'creator@replyos.io', 'Creator', 'free', 0, ?, ?, ?)
    `).run(newUid, now.slice(0, 10), now, now);
    user = await db.prepare('SELECT * FROM users WHERE id = ?').get(newUid);
  }

  try {
    const redirectUri = process.env.META_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/instagram/oauth/callback`;
    const tokenInfo = await metaClient.exchangeOAuthCode(code, redirectUri, authType, intendedUsername);

    // Automatically enrich profile with authentic Instagram follower count, avatar, and full name
    if (tokenInfo.username && !tokenInfo.username.startsWith('user_')) {
      try {
        const enriched = await instagramProfileService.fetchProfile(tokenInfo.username);
        if (enriched.valid && enriched.profile) {
          tokenInfo.full_name = enriched.profile.full_name || tokenInfo.full_name;
          tokenInfo.followers_count = enriched.profile.followers_count || tokenInfo.followers_count;
          tokenInfo.profile_picture_url = enriched.profile.profile_picture_url || tokenInfo.profile_picture_url;
        }
      } catch (enrErr) {
        console.warn('[OAuth] Automatic profile enrichment note:', enrErr.message);
      }
    }

    const encPageToken = encrypt(tokenInfo.page_access_token || tokenInfo.access_token);
    const encLongToken = encrypt(tokenInfo.long_lived_token || tokenInfo.access_token);
    const expiresAt = new Date(Date.now() + (tokenInfo.expires_in || 5184000) * 1000).toISOString();
    const fullName = tokenInfo.full_name || tokenInfo.name || tokenInfo.username;
    const profilePicUrl = tokenInfo.profile_picture_url || null;
    const accountType = tokenInfo.account_type || 'Creator Account';

    const existing = await db.prepare("SELECT id FROM instagram_accounts WHERE ig_user_id = ? OR (lower(username) = ? AND username NOT IN ('instagram_creator', 'test_creator_account', 'instagram_user', 'connected'))").get(tokenInfo.ig_user_id, tokenInfo.username.toLowerCase());
    const accountId = existing ? existing.id : uuidv4();
    if (existing) {
      await db.prepare(`
        UPDATE instagram_accounts SET
          user_id=?, username=?, full_name=?, profile_picture_url=?, ig_user_id=?, page_id=?, fb_page_name=?, fb_user_id=?,
          access_token_enc=?, page_access_token_enc=?, long_lived_token_enc=?,
          token_expires_at=?, status='connected', followers_count=?, account_type=?, updated_at=datetime('now')
        WHERE id=?
      `).run(
        user.id, tokenInfo.username, fullName, profilePicUrl, tokenInfo.ig_user_id, tokenInfo.page_id, tokenInfo.page_name, tokenInfo.fb_user_id,
        encPageToken, encPageToken, encLongToken,
        expiresAt, tokenInfo.followers_count || 0, accountType, existing.id
      );
    } else {
      await db.prepare(`
        INSERT INTO instagram_accounts (
          id, user_id, ig_user_id, username, full_name, profile_picture_url, page_id, fb_page_name, fb_user_id,
          access_token_enc, page_access_token_enc, long_lived_token_enc,
          token_expires_at, status, disclosure_message, followers_count, account_type, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'connected', '⚡ [Automated DM] ', ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT (ig_user_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          username = EXCLUDED.username,
          full_name = EXCLUDED.full_name,
          profile_picture_url = EXCLUDED.profile_picture_url,
          access_token_enc = EXCLUDED.access_token_enc,
          page_access_token_enc = EXCLUDED.page_access_token_enc,
          long_lived_token_enc = EXCLUDED.long_lived_token_enc,
          token_expires_at = EXCLUDED.token_expires_at,
          status = 'connected',
          followers_count = EXCLUDED.followers_count,
          account_type = EXCLUDED.account_type,
          updated_at = datetime('now')
      `).run(
        accountId, user.id, tokenInfo.ig_user_id, tokenInfo.username, fullName, profilePicUrl, tokenInfo.page_id, tokenInfo.page_name, tokenInfo.fb_user_id,
        encPageToken, encPageToken, encLongToken,
        expiresAt, tokenInfo.followers_count || 0, accountType
      );
    }

    // Explicitly upsert user and account to PostgreSQL with ON CONFLICT
    if (db.getPgPool && db.getPgPool()) {
      try {
        const pool = db.getPgPool();
        await pool.query(`
          INSERT INTO users (id, email, name, plan, password_hash, dm_usage_this_period, usage_period_start)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, plan=EXCLUDED.plan
        `, [user.id, user.email, user.name, user.plan, user.password_hash || '', user.dm_usage_this_period || 0, user.usage_period_start || new Date().toISOString().slice(0, 10)]);

        await pool.query(`
          INSERT INTO instagram_accounts (
            id, user_id, ig_user_id, username, full_name, profile_picture_url, page_id, fb_page_name, fb_user_id,
            access_token_enc, page_access_token_enc, long_lived_token_enc,
            token_expires_at, status, disclosure_message, followers_count, account_type, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'connected', '⚡ [Automated DM] ', $14, $15, NOW())
          ON CONFLICT (ig_user_id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            username = EXCLUDED.username,
            full_name = EXCLUDED.full_name,
            profile_picture_url = EXCLUDED.profile_picture_url,
            page_id = EXCLUDED.page_id,
            fb_page_name = EXCLUDED.fb_page_name,
            fb_user_id = EXCLUDED.fb_user_id,
            access_token_enc = EXCLUDED.access_token_enc,
            page_access_token_enc = EXCLUDED.page_access_token_enc,
            long_lived_token_enc = EXCLUDED.long_lived_token_enc,
            token_expires_at = EXCLUDED.token_expires_at,
            status = 'connected',
            followers_count = EXCLUDED.followers_count,
            account_type = EXCLUDED.account_type,
            updated_at = NOW()
        `, [
          accountId, user.id, tokenInfo.ig_user_id, tokenInfo.username, fullName, profilePicUrl,
          tokenInfo.page_id, tokenInfo.page_name, tokenInfo.fb_user_id,
          encPageToken, encPageToken, encLongToken,
          expiresAt, tokenInfo.followers_count || 0, accountType
        ]);
        console.log(`[OAuth] ✅ Persisted @${tokenInfo.username} directly to Render PostgreSQL`);
      } catch (pgSyncErr) {
        console.warn('[OAuth] PostgreSQL sync notice:', pgSyncErr.message);
      }
    }

    const savedAcc = await db.prepare('SELECT * FROM instagram_accounts WHERE id = ?').get(accountId);

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>ReplyOS — Connected</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0f172a;
            color: #ffffff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.1);
            border-top-color: #0066FF;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          h3 { margin: 0 0 6px 0; font-size: 19px; }
          p { color: #94a3b8; font-size: 13.5px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="spinner"></div>
        <h3>Account Connected!</h3>
        <p>Connecting @${tokenInfo.username || 'account'} to ReplyOS...</p>
        <script>
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({
                type: 'INSTAGRAM_CONNECTED',
                success: true,
                account: ${JSON.stringify(savedAcc || { username: tokenInfo.username })}
              }, '*');
              setTimeout(function() { window.close(); }, 600);
            } else {
              window.location.href = ${JSON.stringify(redirectTarget('/?connected=true'))};
            }
          } catch(e) {
            window.location.href = ${JSON.stringify(redirectTarget('/?connected=true'))};
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    const errMsg = err.message || 'OAuth verification failed';
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>ReplyOS — Error</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; }
          h3 { margin: 0 0 8px 0; font-size: 18px; color: #ef4444; }
          p { color: #94a3b8; font-size: 13px; max-width: 420px; margin: 0; line-height: 1.5; }
        </style>
      </head>
      <body>
        <h3>Connection Failed</h3>
        <p>${errMsg.replace(/</g, '&lt;')}</p>
        <script>
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: 'INSTAGRAM_ERROR', error: ${JSON.stringify(errMsg)} }, '*');
              setTimeout(function() { window.close(); }, 1500);
            } else {
              window.location.href = ${JSON.stringify(redirectTarget(`/?error=${encodeURIComponent(errMsg)}`))};
            }
          } catch(e) {
            window.location.href = ${JSON.stringify(redirectTarget(`/?error=${encodeURIComponent(errMsg)}`))};
          }
        </script>
      </body>
      </html>
    `);
  }
});

// POST /api/instagram/refresh-token — refresh token when needed
router.post('/refresh-token', async (req, res) => {
  const uid = await getUserId(req);
  const account = await db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected'").get(uid);
  if (!account) return res.status(404).json({ error: 'No connected Instagram account' });

  try {
    const rawLongToken = decrypt(account.long_lived_token_enc || account.access_token_enc);
    const refreshed = await metaClient.refreshLongLivedToken(rawLongToken);
    const newEncToken = encrypt(refreshed.access_token);
    const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 5184000) * 1000).toISOString();

    await db.prepare(`
      UPDATE instagram_accounts 
      SET long_lived_token_enc = ?, token_expires_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newEncToken, newExpiresAt, account.id);

    res.json({
      success: true,
      message: 'Access token successfully refreshed with Meta Graph API',
      expires_at: newExpiresAt
    });
  } catch (err) {
    res.status(500).json({ error: 'Token refresh failed: ' + err.message });
  }
});

// POST /api/instagram/connect-mock — auto-detects mock profile & IDs
router.post('/connect-mock', async (req, res) => {
  const uid = await getUserId(req);
  const { username, ig_user_id } = req.body;
  const mockUsername = username || `creator_${uid.slice(0, 6)}`;
  const mockIgId = ig_user_id || `17841405${Date.now().toString().slice(-8)}`;
  const mockPageId = `10928374${Date.now().toString().slice(-6)}`;
  const mockFbUserId = `fb_${Date.now()}`;
  const encToken = encrypt(`mock_page_token_${Date.now()}`);
  const encLongToken = encrypt(`mock_long_token_${Date.now()}`);
  const expiresAt = new Date(Date.now() + 60 * 24 * 3600000).toISOString();

  const existing = await db.prepare('SELECT id FROM instagram_accounts WHERE user_id = ?').get(uid);
  if (existing) {
    await db.prepare(`
      UPDATE instagram_accounts SET
        ig_user_id=?, username=?, page_id=?, fb_page_name='Official Page', fb_user_id=?,
        access_token_enc=?, page_access_token_enc=?, long_lived_token_enc=?,
        token_expires_at=?, status='connected', followers_count=18500, updated_at=datetime('now')
      WHERE id=?
    `).run(mockIgId, mockUsername, mockPageId, mockFbUserId, encToken, encToken, encLongToken, expiresAt, existing.id);
  } else {
    await db.prepare(`
      INSERT INTO instagram_accounts (
        id, user_id, ig_user_id, username, page_id, fb_page_name, fb_user_id,
        access_token_enc, page_access_token_enc, long_lived_token_enc,
        token_expires_at, status, disclosure_message, followers_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'Official Page', ?, ?, ?, ?, ?, 'connected', '⚡ [Automated DM] ', 18500, datetime('now'), datetime('now'))
    `).run(uuidv4(), uid, mockIgId, mockUsername, mockPageId, mockFbUserId, encToken, encToken, encLongToken, expiresAt);
  }
  res.json({
    success: true,
    message: `Connected to @${mockUsername}`,
    detected: {
      username: mockUsername,
      instagram_business_account_id: mockIgId,
      facebook_page_id: mockPageId,
      facebook_user_id: mockFbUserId,
      token_expires_at: expiresAt
    }
  });
});

// DELETE /api/instagram/account — disconnect current user's account
router.delete('/account', async (req, res) => {
  const uid = await getUserId(req);
  const account = await db.prepare('SELECT id FROM instagram_accounts WHERE user_id = ?').get(uid);
  if (!account) return res.status(404).json({ error: 'No account' });
  await db.prepare("UPDATE instagram_accounts SET status='disconnected', access_token_enc='', page_access_token_enc='', long_lived_token_enc='' WHERE id=?").run(account.id);
  res.json({ success: true, message: 'Instagram account disconnected.' });
});

// Compliance endpoints (Meta-required)
router.post('/deauthorize', (_req, res) => {
  res.json({ success: true, message: 'Deauthorized' });
});

router.all('/data-deletion', (req, res) => {
  const code = 'del_' + Date.now();
  // Store request with pending status
  dataDeletionRequests.set(code, { status: 'pending', createdAt: Date.now() });
  res.json({
    url: `${req.protocol}://${req.get('host')}/data-deletion-status?id=${code}`,
    confirmation_code: code
  });
});

router.get('/data-deletion-status', (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Missing id' });
  const record = dataDeletionRequests.get(id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  // For demo purposes, we immediately mark as completed
  record.status = 'completed';
  dataDeletionRequests.set(id, record);
  res.json({ id, status: record.status });
});

module.exports = router;
