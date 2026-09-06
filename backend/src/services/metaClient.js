// backend/src/services/metaClient.js
const { v4: uuidv4 } = require('uuid');
const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';
const GRAPH_IG_BASE = 'https://graph.instagram.com';

class MetaClient {
  get mockMode() {
    return process.env.META_MOCK_MODE === 'true';
  }

  async sendPrivateCommentReply({ pageId, commentId, messageText, accessToken }) {
    if (this.mockMode) {
      await new Promise(r => setTimeout(r, 60 + Math.random() * 80));
      return { success: true, recipient_id: `ig_${uuidv4().slice(0,8)}`, message_id: `m_mock_pr_${uuidv4().slice(0,12)}` };
    }
    const isIgToken = accessToken.startsWith('IG');
    const endpoint = isIgToken ? `${GRAPH_IG_BASE}/me/messages` : `${GRAPH_API_BASE}/${pageId}/messages`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: messageText } })
    });
    const data = await res.json();
    if (!res.ok) { const e = new Error(data?.error?.message || 'Meta API error'); e.statusCode = res.status; e.metaError = data?.error; throw e; }
    return { success: true, recipient_id: data.recipient_id, message_id: data.message_id };
  }

  async sendDirectMessage({ pageId, igScopedUserId, messageText, accessToken }) {
    if (this.mockMode) {
      await new Promise(r => setTimeout(r, 60 + Math.random() * 80));
      return { success: true, recipient_id: igScopedUserId, message_id: `m_mock_dm_${uuidv4().slice(0,12)}` };
    }
    const isIgToken = accessToken.startsWith('IG');
    const endpoint = isIgToken ? `${GRAPH_IG_BASE}/me/messages` : `${GRAPH_API_BASE}/${pageId}/messages`;
    console.log(`[MetaClient] Sending DM via ${endpoint} to recipient ${igScopedUserId}`);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ recipient: { id: igScopedUserId }, message: { text: messageText } })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[MetaClient] DM send failed:', JSON.stringify(data));
      const e = new Error(data?.error?.message || 'Meta API error');
      e.statusCode = res.status;
      e.metaError = data?.error;
      throw e;
    }
    console.log(`[MetaClient] DM sent successfully, message_id:`, data.message_id);
    return { success: true, recipient_id: data.recipient_id, message_id: data.message_id };
  }

  async getInstagramUserProfile({ igScopedUserId, accessToken, pageId }) {
    if (!igScopedUserId || !accessToken) return null;
    if (this.mockMode) {
      return { id: igScopedUserId, name: 'Instagram Lead', username: 'ig_lead', profile_pic: null };
    }

    const isIgToken = accessToken.startsWith('IG') || accessToken.startsWith('IGQ');

    // Field variants — different API versions support different fields
    const fieldSets = [
      'name,username,profile_picture_url',
      'name,username,profile_pic',
      'name,username',
      'name',
    ];

    const bases = isIgToken
      ? [GRAPH_IG_BASE, GRAPH_API_BASE]
      : [GRAPH_API_BASE, GRAPH_IG_BASE];

    // Permanent error messages — throw so profileCache can blacklist immediately
    const PERMANENT_ERRORS = [
      'api access deactivated',
      'cannot parse access token',
      'invalid oauth access token',
      'access token has expired',
      'token has been invalidated',
    ];

    for (const base of bases) {
      for (const fields of fieldSets) {
        const url = `${base}/${igScopedUserId}?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`;
        try {
          const res = await fetch(url);
          const data = await res.json();
          if (!res.ok) {
            const errMsg = data?.error?.message || '';
            const errLower = errMsg.toLowerCase();
            // Throw on permanent errors so caller can blacklist
            if (PERMANENT_ERRORS.some(p => errLower.includes(p))) {
              throw new Error(errMsg || 'Permanent Meta API error');
            }
            // Don't try more fields if token is invalid/expired
            if (data?.error?.code === 190 || data?.error?.code === 102) break;
            continue;
          }
          if (data && (data.username || data.name)) {
            console.log(`[MetaClient] ✅ Profile for ${igScopedUserId}: "${data.name || ''}" (@${data.username || ''})`);
            return {
              id: data.id || igScopedUserId,
              name: data.name || null,
              username: data.username || null,
              profile_pic: data.profile_picture_url || data.profile_pic || null
            };
          }
          // Got a valid response but only id — no name/username available via this endpoint
          if (data?.id) break;
        } catch (err) {
          // Re-throw permanent errors upward
          if (PERMANENT_ERRORS.some(p => err.message.toLowerCase().includes(p))) throw err;
          console.warn(`[MetaClient] Network error fetching profile (${fields}):`, err.message);
        }
      }
    }

    // Fallback: try GET /me/conversations?user_id={igsid} to extract profile from conversation participant
    const igAccountId = pageId;
    if (igAccountId) {
      try {
        const convUrl = `${GRAPH_API_BASE}/${igAccountId}/conversations?user_id=${igScopedUserId}&fields=participants&access_token=${encodeURIComponent(accessToken)}`;
        const convRes = await fetch(convUrl);
        if (convRes.ok) {
          const convData = await convRes.json();
          const participants = convData?.data?.[0]?.participants?.data || [];
          const participant = participants.find(p => p.id !== igAccountId);
          if (participant && (participant.name || participant.email)) {
            console.log(`[MetaClient] ✅ Profile from conversations for ${igScopedUserId}: "${participant.name || ''}"`);
            return {
              id: igScopedUserId,
              name: participant.name || null,
              username: participant.username || null,
              profile_pic: null
            };
          }
        }
      } catch (convErr) {
        console.warn(`[MetaClient] Conversations fallback failed:`, convErr.message);
      }
    }

    console.warn(`[MetaClient] ⚠️ Could not get profile for ${igScopedUserId} — all endpoints exhausted`);
    return null;
  }


  async exchangeOAuthCode(code, redirectUri, authType = 'instagram', intendedUsername = null) {
    if (this.mockMode) {
      return {
        access_token: `mock_page_token_${Date.now()}`,
        page_access_token: `mock_page_token_${Date.now()}`,
        long_lived_token: `mock_user_token_${Date.now()}`,
        page_id: '109283746501928',
        page_name: 'Creator Studio Official',
        fb_user_id: '102938475619283',
        ig_user_id: '17841405829103942',
        username: intendedUsername || 'instagram_user',
        followers_count: 1250,
        expires_in: 5184000
      };
    }

    // Use Instagram App ID/Secret when META_IG_APP_ID is set (Instagram Business Login)
    // Use main Meta App ID otherwise (Facebook OAuth flow)
    const igAppId = process.env.META_IG_APP_ID;
    const igAppSecret = process.env.META_IG_APP_SECRET || process.env.META_APP_SECRET;
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const cleanCode = (code || '').replace(/#_$/, '').trim();

    // ─── PATH 1: Instagram Business Login (native instagram.com flow) ────
    if (authType === 'instagram') {
      const igAppId = process.env.META_IG_APP_ID;
      const igAppSecret = process.env.META_IG_APP_SECRET;
      const appId = process.env.META_APP_ID;
      const appSecret = process.env.META_APP_SECRET;

      const clientId = igAppId || appId;
      const clientSecret = igAppSecret || appSecret;

      if (igAppId && !igAppSecret) {
        console.warn(`[MetaClient] ⚠️ META_IG_APP_ID is set (${igAppId}) but META_IG_APP_SECRET is not set. Using META_APP_SECRET as fallback.`);
      }

      console.log(`[MetaClient] Exchanging Instagram authorization code via api.instagram.com (client_id: ${clientId})...`);
      try {
        const formParams = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          code: cleanCode,
        });
        const igTokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formParams.toString(),
        });
        const rawBodyText = await igTokenRes.text();
        let parsedUserId = null;
        const uidMatch = rawBodyText.match(/"user_id"\s*:\s*"?(\d+)"?/);
        if (uidMatch && uidMatch[1]) {
          parsedUserId = uidMatch[1];
        }
        let igTokenData = {};
        try { igTokenData = JSON.parse(rawBodyText); } catch (_) {}
        if (parsedUserId) {
          igTokenData.user_id = parsedUserId;
        }

        if (igTokenRes.ok && igTokenData.access_token) {
          console.log('[MetaClient] ✅ Instagram token received, upgrading to long-lived...');
          return await this._exchangeInstagramToken(igTokenData.access_token, clientId, clientSecret, igTokenData.user_id, intendedUsername);
        }

        console.warn('[MetaClient] Instagram token exchange error response:', JSON.stringify(igTokenData));

        const errMsg = igTokenData?.error_message || igTokenData?.error?.message || 'Instagram token exchange failed';
        if (errMsg.toLowerCase().includes('client secret') && !igAppSecret) {
          throw new Error(
            'Error validating client secret: Instagram Business Login requires the Instagram App Secret. ' +
            'Please find the Instagram App Secret in your Meta Developer Portal (under Instagram > API Setup) and add META_IG_APP_SECRET to your Render environment variables.'
          );
        }
        throw new Error(errMsg);
      } catch (igErr) {
        console.error('[MetaClient] Instagram exchange error:', igErr.message);
        throw igErr;
      }
    }

    // ─── PATH 2: Facebook Login fallback ────────────────────────────────
    // For accounts connected via Facebook Page (traditional flow)
    console.log('[MetaClient] Trying Facebook Graph API token exchange...');
    const tokenRes = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${encodeURIComponent(cleanCode)}`
    );
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData?.error?.message || 'Token exchange failed. Please try again.');

    const longRes = await fetch(
      `${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(tokenData.access_token)}`
    );
    const longData = await longRes.json();
    if (!longRes.ok) throw new Error(longData?.error?.message || 'Long-lived token upgrade failed');
    const longLivedUserToken = longData.access_token;

    const meRes = await fetch(`${GRAPH_API_BASE}/me?fields=id,name,email&access_token=${encodeURIComponent(longLivedUserToken)}`);
    const meData = await meRes.json();
    const fbUserId = meData?.id || null;

    const accsRes = await fetch(
      `${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count}&access_token=${encodeURIComponent(longLivedUserToken)}`
    );
    const accsData = await accsRes.json();
    if (!accsRes.ok) throw new Error(accsData?.error?.message || 'Failed to retrieve Facebook pages');

    const page = accsData.data?.find(p => p.instagram_business_account?.id);
    if (!page) {
      throw new Error(
        'No Instagram Business/Creator account found. ' +
        'Please make sure your Instagram is connected to a Facebook Page in Meta Business Suite.'
      );
    }

    try {
      await fetch(`${GRAPH_API_BASE}/${page.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed,mention,comments&access_token=${page.access_token}`, { method: 'POST' });
      console.log(`[Meta] ✅ Subscribed Page ${page.id} to webhooks`);
    } catch (subErr) {
      console.warn('[Meta] Webhook subscription warning:', subErr.message);
    }

    return {
      access_token: page.access_token,
      page_access_token: page.access_token,
      long_lived_token: longLivedUserToken,
      page_id: page.id,
      page_name: page.name,
      full_name: page.instagram_business_account.name || page.name,
      profile_picture_url: page.instagram_business_account.profile_picture_url || null,
      account_type: 'Business Account',
      fb_user_id: fbUserId,
      ig_user_id: page.instagram_business_account.id,
      username: page.instagram_business_account.username,
      followers_count: page.instagram_business_account.followers_count || 0,
      expires_in: longData.expires_in || 5184000
    };
  }


  async exchangeUserToken(userToken) {
    if (this.mockMode) {
      return {
        access_token: `mock_page_token_${Date.now()}`,
        page_access_token: `mock_page_token_${Date.now()}`,
        long_lived_token: userToken,
        page_id: '109283746501928',
        page_name: 'Creator Studio Official',
        fb_user_id: '102938475619283',
        ig_user_id: '17841405829103942',
        username: 'instagram_user',
        followers_count: 0,
        expires_in: 5184000
      };
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    // Detect token type: Instagram Business Login (IGAAA..., IGQ..., IG...) vs Facebook Login (EAA...)
    const isInstagramToken = userToken.startsWith('IG') || userToken.startsWith('IGAAA') || userToken.startsWith('IGQ') || userToken.startsWith('IGA');

    if (isInstagramToken) {
      return this._exchangeInstagramToken(userToken, appId, appSecret);
    }

    // --- Legacy Facebook Login flow (EAABsb... tokens) ---
    // Step 1: Upgrade user token to long-lived 60-day token
    let longLivedToken = userToken;
    try {
      const longRes = await fetch(`${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(userToken)}`);
      const longData = await longRes.json();
      if (longRes.ok && longData.access_token) {
        longLivedToken = longData.access_token;
      }
    } catch (e) {
      console.warn('[MetaClient] Token exchange note:', e.message);
    }

    // Step 2: Query /me to get Facebook User ID
    const meRes = await fetch(`${GRAPH_API_BASE}/me?fields=id,name,email&access_token=${encodeURIComponent(longLivedToken)}`);
    const meData = await meRes.json();
    const fbUserId = meData?.id || null;

    // Step 3: Query /me/accounts for Pages and linked Instagram Business Account
    const accsRes = await fetch(`${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count}&access_token=${encodeURIComponent(longLivedToken)}`);
    const accsData = await accsRes.json();
    if (!accsRes.ok) {
      throw new Error(accsData?.error?.message || 'Failed to retrieve Facebook pages from Meta API');
    }

    const page = accsData.data?.find(p => p.instagram_business_account?.id);
    if (!page) {
      throw new Error('No Facebook Page connected to an Instagram Business account was found. Please ensure your Instagram Professional account is connected to a Facebook Page in Meta Business Suite.');
    }

    // Step 4: Auto-subscribe Page to Webhooks
    try {
      await fetch(`${GRAPH_API_BASE}/${page.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed,mention,comments&access_token=${page.access_token}`, {
        method: 'POST'
      });
      console.log(`[Meta] ✅ Subscribed Page ${page.id} to Meta webhooks`);
    } catch (subErr) {
      console.warn('[Meta] ⚠️ Webhook subscription warning:', subErr.message);
    }

    return {
      access_token: page.access_token,
      page_access_token: page.access_token,
      long_lived_token: longLivedToken,
      page_id: page.id,
      page_name: page.name,
      full_name: page.instagram_business_account.name || page.name,
      profile_picture_url: page.instagram_business_account.profile_picture_url || null,
      account_type: 'Business Account',
      fb_user_id: fbUserId,
      ig_user_id: page.instagram_business_account.id,
      username: page.instagram_business_account.username,
      followers_count: page.instagram_business_account.followers_count || 0,
      expires_in: 5184000
    };
  }

  // --- Instagram Business Login token flow (new Instagram API) ---
  async _exchangeInstagramToken(shortToken, appId, appSecret, igUserId = null, intendedUsername = null) {
    console.log(`[MetaClient] Detected Instagram Business Login token — using Instagram Graph API (user_id: ${igUserId})`);

    // Step 1: Exchange short-lived Instagram token for long-lived token (60 days)
    let longLivedToken = shortToken;
    let expiresIn = 5184000;
    try {
      const longRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${encodeURIComponent(shortToken)}`);
      const longData = await longRes.json();
      if (longRes.ok && longData.access_token) {
        longLivedToken = longData.access_token;
        expiresIn = longData.expires_in || 5184000;
        console.log('[MetaClient] ✅ Instagram token upgraded to long-lived token');
      } else {
        console.warn('[MetaClient] Instagram token upgrade note:', longData?.error?.message || 'Could not upgrade, using short-lived token');
      }
    } catch (e) {
      console.warn('[MetaClient] Instagram token exchange warning:', e.message);
    }

    // Step 2: Get Instagram user profile with multi-token, multi-version fallback endpoints
    let meData = null;
    const tokensToTry = [longLivedToken, shortToken].filter((t, i, arr) => t && arr.indexOf(t) === i);

    for (const tok of tokensToTry) {
      if (meData && (meData.username || meData.id)) break;

      const profileEndpoints = [
        `https://graph.instagram.com/v22.0/me?fields=id,username,name,account_type,followers_count,profile_picture_url&access_token=${encodeURIComponent(tok)}`,
        `https://graph.instagram.com/v21.0/me?fields=id,username,name,account_type,followers_count,profile_picture_url&access_token=${encodeURIComponent(tok)}`,
        `https://graph.instagram.com/me?fields=id,username,name,account_type,followers_count,profile_picture_url&access_token=${encodeURIComponent(tok)}`,
        `https://graph.instagram.com/me?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(tok)}`,
        `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${encodeURIComponent(tok)}`,
        `https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(tok)}`,
        igUserId ? `https://graph.instagram.com/v21.0/${igUserId}?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(tok)}` : null,
        igUserId ? `https://graph.instagram.com/${igUserId}?fields=id,username,name&access_token=${encodeURIComponent(tok)}` : null,
        igUserId ? `https://graph.facebook.com/v21.0/${igUserId}?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(tok)}` : null,
      ].filter(Boolean);

      for (const ep of profileEndpoints) {
        try {
          const res = await fetch(ep);
          const data = await res.json();
          if (res.ok && data && (data.username || data.id)) {
            meData = data;
            console.log(`[MetaClient] ✅ Profile fetched from ${ep.split('?')[0]}: @${meData.username || meData.id}`);
            break;
          } else {
            console.warn(`[MetaClient] Profile endpoint note (${ep.split('?')[0]}):`, data?.error?.message || res.statusText);
          }
        } catch (err) {
          console.warn(`[MetaClient] Profile endpoint error (${ep.split('?')[0]}):`, err.message);
        }
      }
    }

    // Step 3: Handle restricted profile (e.g. Meta app in Dev Mode without tester role)
    const fallbackId = igUserId ? String(igUserId) : (meData?.id || `ig_${Date.now()}`);
    let realUsername = meData?.username || null;
    let realName = meData?.name || realUsername || null;
    let accountType = meData?.account_type || 'Creator Account';
    let requiresHandle = false;

    // If Meta's profile endpoints were restricted, recover real handle from intendedUsername or DB
    if (!realUsername) {
      if (intendedUsername && typeof intendedUsername === 'string' && intendedUsername.trim()) {
        realUsername = intendedUsername.replace(/^@/, '').trim().toLowerCase();
        realName = realUsername;
        console.log(`[MetaClient] Recovered real username from user intent: @${realUsername}`);
      } else {
        // Look in DB to see if this exact igUserId was previously connected with a valid handle
        try {
          const db = require('../db');
          const existing = await db.prepare("SELECT username, full_name, account_type FROM instagram_accounts WHERE ig_user_id = ? AND username NOT IN ('instagram_creator', 'test_creator_account', 'instagram_user', 'connected') AND username NOT LIKE 'user_%' LIMIT 1").get(fallbackId);
          if (existing && existing.username) {
            realUsername = existing.username;
            realName = existing.full_name || existing.username;
            accountType = existing.account_type || accountType;
            console.log(`[MetaClient] Recovered known username from DB: @${realUsername}`);
          }
        } catch (_) {}
      }
    }

    if (!realUsername) {
      requiresHandle = true;
      realUsername = `user_${fallbackId.slice(-6)}`;
      realName = `Instagram Creator`;
    }

    console.log(`[MetaClient] ✅ Instagram account: @${realUsername} (ID: ${fallbackId}, requires_handle: ${requiresHandle})`);

    // Step 4: Auto-subscribe Instagram account to webhooks
    try {
      const subRes = await fetch(`https://graph.instagram.com/me/subscribed_apps?subscribed_fields=messages,comments,messaging_postbacks,message_reactions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${longLivedToken}` }
      });
      const subData = await subRes.json();
      if (subData && subData.success) {
        console.log(`[MetaClient] ✅ Subscribed @${realUsername} to Instagram webhooks`);
      }
    } catch (subErr) {
      console.warn('[MetaClient] Webhook auto-subscribe warning:', subErr.message);
    }

    return {
      access_token: longLivedToken,
      page_access_token: longLivedToken,  // Instagram token used directly for messaging
      long_lived_token: longLivedToken,
      page_id: fallbackId,                 // Instagram Business Account ID used as page_id
      page_name: realName || realUsername,
      full_name: realName || realUsername,
      profile_picture_url: meData?.profile_picture_url || null,
      account_type: accountType,
      fb_user_id: null,
      ig_user_id: fallbackId,
      username: realUsername,
      followers_count: meData?.followers_count || 0,
      expires_in: expiresIn,
      requires_handle: requiresHandle,
    };
  }

  async refreshLongLivedToken(existingToken) {
    if (this.mockMode) {
      return {
        access_token: `mock_refreshed_token_${Date.now()}`,
        expires_in: 5184000
      };
    }
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (existingToken && existingToken.startsWith('IG')) {
      const res = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(existingToken)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to refresh Instagram token');
      return data;
    }

    const res = await fetch(`${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(existingToken)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Failed to refresh token');
    return data;
  }
}

module.exports = new MetaClient();

