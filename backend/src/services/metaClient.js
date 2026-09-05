// backend/src/services/metaClient.js
const { v4: uuidv4 } = require('uuid');
const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';
const GRAPH_IG_BASE = 'https://graph.instagram.com/v21.0';

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

  async exchangeOAuthCode(code, redirectUri, authType = 'instagram') {
    if (this.mockMode) {
      return {
        access_token: `mock_page_token_${Date.now()}`,
        page_access_token: `mock_page_token_${Date.now()}`,
        long_lived_token: `mock_long_token_${Date.now()}`,
        page_id: '109283746501928',
        page_name: 'Creator Studio Official',
        fb_user_id: '102938475619283',
        ig_user_id: '17841405829103942',
        username: 'luna.creates',
        followers_count: 24800,
        expires_in: 5184000
      };
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const cleanCode = (code || '').replace(/#_$/, '').trim();

    // 1. If authType is 'instagram', try direct Instagram token exchange first, then fall back
    if (authType === 'instagram') {
      try {
        console.log('[MetaClient] Exchanging authorization code via api.instagram.com...');
        const formParams = new URLSearchParams();
        formParams.append('client_id', appId);
        formParams.append('client_secret', appSecret);
        formParams.append('grant_type', 'authorization_code');
        formParams.append('redirect_uri', redirectUri);
        formParams.append('code', cleanCode);

        const igTokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formParams.toString()
        });
        const igTokenData = await igTokenRes.json();

        if (igTokenRes.ok && igTokenData.access_token) {
          console.log('[MetaClient] ✅ Received Instagram access token for user ID:', igTokenData.user_id);
          return await this._exchangeInstagramToken(igTokenData.access_token, appId, appSecret);
        } else {
          console.warn('[MetaClient] Instagram code exchange returned error, attempting Facebook Graph API fallback:', JSON.stringify(igTokenData));
        }
      } catch (igErr) {
        console.warn('[MetaClient] Instagram code exchange failed, attempting Facebook Graph API fallback:', igErr.message);
      }
    }

    // 2. Facebook Graph API flow
    console.log('[MetaClient] Exchanging authorization code via graph.facebook.com...');
    const tokenRes = await fetch(`${GRAPH_API_BASE}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${encodeURIComponent(cleanCode)}`);
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData?.error?.message || 'Short-lived Facebook token exchange failed');

    // Step 2: Exchange short-lived token for 60-day long-lived user token
    const longRes = await fetch(`${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(tokenData.access_token)}`);
    const longData = await longRes.json();
    if (!longRes.ok) throw new Error(longData?.error?.message || 'Long-lived token upgrade failed');
    const longLivedUserToken = longData.access_token;

    // Step 3: Get Facebook User ID & basic info
    const meRes = await fetch(`${GRAPH_API_BASE}/me?fields=id,name,email&access_token=${encodeURIComponent(longLivedUserToken)}`);
    const meData = await meRes.json();
    const fbUserId = meData?.id || null;

    // Step 4: Auto-detect Facebook Pages & connected Instagram Business Accounts
    const accsRes = await fetch(`${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,followers_count}&access_token=${encodeURIComponent(longLivedUserToken)}`);
    const accsData = await accsRes.json();
    if (!accsRes.ok) throw new Error(accsData?.error?.message || 'Failed to retrieve Facebook pages');

    const page = accsData.data?.find(p => p.instagram_business_account?.id);
    if (!page) {
      throw new Error('No Facebook Page connected to an Instagram Business or Creator Account was found. Please connect your Instagram account to a Facebook Page in Meta Business Suite.');
    }

    // Step 5: Auto-subscribe Facebook Page to Webhooks so events flow automatically
    try {
      await fetch(`${GRAPH_API_BASE}/${page.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed,mention,comments&access_token=${page.access_token}`, {
        method: 'POST'
      });
      console.log(`[Meta] ✅ Subscribed Page ${page.id} to Meta webhooks`);
    } catch (subErr) {
      console.warn(`[Meta] ⚠️ Webhook subscription warning:`, subErr.message);
    }

    return {
      access_token: page.access_token,
      page_access_token: page.access_token,
      long_lived_token: longLivedUserToken,
      page_id: page.id,
      page_name: page.name,
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
        username: 'luna.creates',
        followers_count: 24800,
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
    const accsRes = await fetch(`${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,followers_count}&access_token=${encodeURIComponent(longLivedToken)}`);
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
      fb_user_id: fbUserId,
      ig_user_id: page.instagram_business_account.id,
      username: page.instagram_business_account.username,
      followers_count: page.instagram_business_account.followers_count || 0,
      expires_in: 5184000
    };
  }

  // --- Instagram Business Login token flow (new Instagram API) ---
  async _exchangeInstagramToken(shortToken, appId, appSecret) {
    console.log('[MetaClient] Detected Instagram Business Login token — using Instagram Graph API');

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

    // Step 2: Get Instagram user profile
    let meData = null;
    try {
      const meRes = await fetch(`${GRAPH_IG_BASE}/me?fields=id,username,name,followers_count,profile_picture_url&access_token=${encodeURIComponent(longLivedToken)}`);
      if (meRes.ok) {
        meData = await meRes.json();
      }
    } catch (e) {}

    if (!meData || !meData.id) {
      const basicRes = await fetch(`${GRAPH_IG_BASE}/me?fields=id,username&access_token=${encodeURIComponent(longLivedToken)}`);
      const basicData = await basicRes.json();
      if (!basicRes.ok || !basicData.id) {
        throw new Error(basicData?.error?.message || 'Failed to retrieve Instagram user profile');
      }
      meData = basicData;
    }

    console.log(`[MetaClient] ✅ Instagram user: @${meData.username} (ID: ${meData.id})`);

    // Step 3: Auto-subscribe Instagram account to webhooks
    try {
      const subRes = await fetch(`${GRAPH_IG_BASE}/me/subscribed_apps?subscribed_fields=messages,comments,messaging_postbacks,message_reactions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${longLivedToken}` }
      });
      const subData = await subRes.json();
      if (subData.success) {
        console.log(`[MetaClient] ✅ Subscribed @${meData.username} to Instagram webhooks`);
      }
    } catch (subErr) {
      console.warn('[MetaClient] Webhook auto-subscribe warning:', subErr.message);
    }

    return {
      access_token: longLivedToken,
      page_access_token: longLivedToken,  // Instagram token used directly for messaging
      long_lived_token: longLivedToken,
      page_id: meData.id,                 // Instagram Business Account ID used as page_id
      page_name: meData.name || meData.username,
      fb_user_id: null,
      ig_user_id: meData.id,
      username: meData.username,
      followers_count: meData.followers_count || 0,
      expires_in: expiresIn
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

