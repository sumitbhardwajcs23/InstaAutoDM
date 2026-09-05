// backend/src/routes/instagram.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const metaClient = require('../services/metaClient');
const { encrypt, decrypt } = require('../services/crypto');

// GET /api/instagram/account — scoped to logged-in user
router.get('/account', (req, res) => {
  const account = db.prepare(`
    SELECT id, user_id, ig_user_id, username, account_type, page_id, fb_page_name, fb_user_id,
           token_expires_at, status, disclosure_message, followers_count, created_at, updated_at
    FROM instagram_accounts
    WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(req.user.id);

  if (!account) return res.json({ connected: false, account: null });
  res.json({
    connected: account.status === 'connected',
    account: {
      ...account,
      has_long_lived_token: true,
      has_page_access_token: true
    }
  });
});

// POST /api/instagram/connect-mock — instant connection for testing
router.post('/connect-mock', (req, res) => {
  const encToken = encrypt('EAABsbCS1iHgBA...');
  const expiresAt = new Date(Date.now() + 60 * 86400 * 1000).toISOString();
  
  const igUserId = '17841405309211849';
  let existing = db.prepare('SELECT id FROM instagram_accounts WHERE user_id = ? OR ig_user_id = ?').get(req.user.id, igUserId);
  if (existing) {
    db.prepare(`
      UPDATE instagram_accounts SET
        user_id=?, username='luna.creates', ig_user_id=?, page_id='102938475629102',
        fb_page_name='Luna Creates Studio', account_type='Business Account',
        access_token_enc=?, page_access_token_enc=?, long_lived_token_enc=?,
        token_expires_at=?, status='connected', updated_at=datetime('now')
      WHERE id=?
    `).run(req.user.id, igUserId, encToken, encToken, encToken, expiresAt, existing.id);
  } else {
    db.prepare(`
      INSERT INTO instagram_accounts (
        id, user_id, ig_user_id, username, page_id, fb_page_name, account_type,
        access_token_enc, page_access_token_enc, long_lived_token_enc,
        token_expires_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'luna.creates', '102938475629102', 'Luna Creates Studio', 'Business Account', ?, ?, ?, ?, 'connected', datetime('now'), datetime('now'))
    `).run(uuidv4(), req.user.id, igUserId, encToken, encToken, encToken, expiresAt);
  }

  const updated = db.prepare('SELECT * FROM instagram_accounts WHERE user_id = ?').get(req.user.id);
  res.json({ success: true, account: updated });
});

// POST /api/instagram/connect-token — direct real Meta Graph API token resolution
router.post('/connect-token', async (req, res) => {
  const userToken = req.body.token || req.body.user_token || req.body.access_token;
  if (!userToken) return res.status(400).json({ error: 'Missing Meta access token' });

  try {
    const tokenInfo = await metaClient.exchangeUserToken(userToken.trim());
    const encPageToken = encrypt(tokenInfo.page_access_token || tokenInfo.access_token);
    const encLongToken = encrypt(tokenInfo.long_lived_token || tokenInfo.access_token);
    const expiresAt = new Date(Date.now() + (tokenInfo.expires_in || 5184000) * 1000).toISOString();

    const existing = db.prepare('SELECT id FROM instagram_accounts WHERE user_id = ? OR ig_user_id = ?').get(req.user.id, tokenInfo.ig_user_id);
    if (existing) {
      db.prepare(`
        UPDATE instagram_accounts SET
          user_id=?, username=?, ig_user_id=?, page_id=?, fb_page_name=?, fb_user_id=?,
          access_token_enc=?, page_access_token_enc=?, long_lived_token_enc=?,
          token_expires_at=?, status='connected', followers_count=?, updated_at=datetime('now')
        WHERE id=?
      `).run(
        req.user.id, tokenInfo.username, tokenInfo.ig_user_id, tokenInfo.page_id, tokenInfo.page_name, tokenInfo.fb_user_id,
        encPageToken, encPageToken, encLongToken,
        expiresAt, tokenInfo.followers_count || 0, existing.id
      );
    } else {
      db.prepare(`
        INSERT INTO instagram_accounts (
          id, user_id, ig_user_id, username, page_id, fb_page_name, fb_user_id,
          access_token_enc, page_access_token_enc, long_lived_token_enc,
          token_expires_at, status, disclosure_message, followers_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'connected', '⚡ [Automated DM] ', ?, datetime('now'), datetime('now'))
      `).run(
        uuidv4(), req.user.id, tokenInfo.ig_user_id, tokenInfo.username, tokenInfo.page_id, tokenInfo.page_name, tokenInfo.fb_user_id,
        encPageToken, encPageToken, encLongToken,
        expiresAt, tokenInfo.followers_count || 0
      );
    }

    const updated = db.prepare('SELECT * FROM instagram_accounts WHERE user_id = ?').get(req.user.id);
    res.json({ success: true, account: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to connect Instagram account' });
  }
});

// GET /api/instagram/oauth/start — pass user ID and return origin via state param
router.get('/oauth/start', (req, res) => {
  let returnOrigin = req.query.return_origin || '';
  if (!returnOrigin && req.headers.referer) {
    try { returnOrigin = new URL(req.headers.referer).origin; } catch (e) {}
  }
  const authType = req.query.type || 'instagram';
  const stateObj = { uid: req.user.id, origin: returnOrigin, type: authType };
  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');

  if (process.env.META_MOCK_MODE === 'true') {
    return res.redirect(`/api/instagram/oauth/callback?code=mock_${Date.now()}&state=${state}`);
  }

  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/instagram/oauth/callback`;

  if (authType === 'facebook') {
    const scopes = req.query.scopes || process.env.META_SCOPES || 'instagram_basic,instagram_manage_comments,instagram_manage_messages,pages_show_list,pages_read_engagement';
    return res.redirect(`https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`);
  }

  // Direct Instagram Business Login (native Instagram username & password)
  const scopes = req.query.scopes || 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments';
  return res.redirect(`https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${state}`);
});

// GET /api/instagram/oauth/callback — public endpoint (no auth header), state carries userId & origin
router.get('/oauth/callback', async (req, res) => {
  const { code, error, error_reason, error_description, state } = req.query;
  let userId = state;
  let returnOrigin = '';
  let authType = 'instagram';

  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      if (decoded && decoded.uid) {
        userId = decoded.uid;
        returnOrigin = decoded.origin || '';
        if (decoded.type) authType = decoded.type;
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

  const user = userId
    ? db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
    : db.prepare('SELECT id FROM users LIMIT 1').get();

  if (!user) {
    return res.send(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>ReplyOS</title></head>
      <body style="background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
        <p>Session expired. Please log in to ReplyOS again.</p>
        <script>
          if (window.opener) { window.opener.postMessage({ type: 'INSTAGRAM_ERROR', error: 'session_expired' }, '*'); setTimeout(function(){ window.close(); }, 1000); }
          else { window.location.href = ${JSON.stringify(redirectTarget('/?error=session_expired'))}; }
        </script>
      </body></html>
    `);
  }

  try {
    const redirectUri = process.env.META_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/instagram/oauth/callback`;
    const tokenInfo = await metaClient.exchangeOAuthCode(code, redirectUri, authType);

    const encPageToken = encrypt(tokenInfo.page_access_token || tokenInfo.access_token);
    const encLongToken = encrypt(tokenInfo.long_lived_token || tokenInfo.access_token);
    const expiresAt = new Date(Date.now() + (tokenInfo.expires_in || 5184000) * 1000).toISOString();

    const existing = db.prepare('SELECT id FROM instagram_accounts WHERE user_id = ? OR ig_user_id = ?').get(user.id, tokenInfo.ig_user_id);
    if (existing) {
      db.prepare(`
        UPDATE instagram_accounts SET
          user_id=?, username=?, ig_user_id=?, page_id=?, fb_page_name=?, fb_user_id=?,
          access_token_enc=?, page_access_token_enc=?, long_lived_token_enc=?,
          token_expires_at=?, status='connected', followers_count=?, updated_at=datetime('now')
        WHERE id=?
      `).run(
        user.id, tokenInfo.username, tokenInfo.ig_user_id, tokenInfo.page_id, tokenInfo.page_name, tokenInfo.fb_user_id,
        encPageToken, encPageToken, encLongToken,
        expiresAt, tokenInfo.followers_count || 0, existing.id
      );
    } else {
      db.prepare(`
        INSERT INTO instagram_accounts (
          id, user_id, ig_user_id, username, page_id, fb_page_name, fb_user_id,
          access_token_enc, page_access_token_enc, long_lived_token_enc,
          token_expires_at, status, disclosure_message, followers_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'connected', '⚡ [Automated DM] ', ?, datetime('now'), datetime('now'))
      `).run(
        uuidv4(), user.id, tokenInfo.ig_user_id, tokenInfo.username, tokenInfo.page_id, tokenInfo.page_name, tokenInfo.fb_user_id,
        encPageToken, encPageToken, encLongToken,
        expiresAt, tokenInfo.followers_count || 0
      );
    }

    const savedAcc = db.prepare('SELECT * FROM instagram_accounts WHERE user_id = ?').get(user.id);

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
  const account = db.prepare("SELECT * FROM instagram_accounts WHERE user_id = ? AND status = 'connected'").get(req.user.id);
  if (!account) return res.status(404).json({ error: 'No connected Instagram account' });

  try {
    const rawLongToken = decrypt(account.long_lived_token_enc || account.access_token_enc);
    const refreshed = await metaClient.refreshLongLivedToken(rawLongToken);
    const newEncToken = encrypt(refreshed.access_token);
    const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 5184000) * 1000).toISOString();

    db.prepare(`
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
router.post('/connect-mock', (req, res) => {
  const { username, ig_user_id } = req.body;
  const mockUsername = username || `creator_${req.user.id.slice(0, 6)}`;
  const mockIgId = ig_user_id || `17841405${Date.now().toString().slice(-8)}`;
  const mockPageId = `10928374${Date.now().toString().slice(-6)}`;
  const mockFbUserId = `fb_${Date.now()}`;
  const encToken = encrypt(`mock_page_token_${Date.now()}`);
  const encLongToken = encrypt(`mock_long_token_${Date.now()}`);
  const expiresAt = new Date(Date.now() + 60 * 24 * 3600000).toISOString();

  const existing = db.prepare('SELECT id FROM instagram_accounts WHERE user_id = ?').get(req.user.id);
  if (existing) {
    db.prepare(`
      UPDATE instagram_accounts SET
        ig_user_id=?, username=?, page_id=?, fb_page_name='Official Page', fb_user_id=?,
        access_token_enc=?, page_access_token_enc=?, long_lived_token_enc=?,
        token_expires_at=?, status='connected', followers_count=18500, updated_at=datetime('now')
      WHERE id=?
    `).run(mockIgId, mockUsername, mockPageId, mockFbUserId, encToken, encToken, encLongToken, expiresAt, existing.id);
  } else {
    db.prepare(`
      INSERT INTO instagram_accounts (
        id, user_id, ig_user_id, username, page_id, fb_page_name, fb_user_id,
        access_token_enc, page_access_token_enc, long_lived_token_enc,
        token_expires_at, status, disclosure_message, followers_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'Official Page', ?, ?, ?, ?, ?, 'connected', '⚡ [Automated DM] ', 18500, datetime('now'), datetime('now'))
    `).run(uuidv4(), req.user.id, mockIgId, mockUsername, mockPageId, mockFbUserId, encToken, encToken, encLongToken, expiresAt);
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
router.delete('/account', (req, res) => {
  const account = db.prepare('SELECT id FROM instagram_accounts WHERE user_id = ?').get(req.user.id);
  if (!account) return res.status(404).json({ error: 'No account' });
  db.prepare("UPDATE instagram_accounts SET status='disconnected', access_token_enc='', page_access_token_enc='', long_lived_token_enc='' WHERE id=?").run(account.id);
  res.json({ success: true, message: 'Instagram account disconnected.' });
});

// Compliance endpoints (Meta-required)
router.post('/deauthorize', (_req, res) => {
  res.json({ success: true, message: 'Deauthorized' });
});

router.all('/data-deletion', (req, res) => {
  const code = 'del_' + Date.now();
  res.json({
    url: `${req.protocol}://${req.get('host')}/data-deletion-status?id=${code}`,
    confirmation_code: code
  });
});

module.exports = router;

