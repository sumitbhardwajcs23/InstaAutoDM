// backend/src/services/tokenLifecycle.js
const db = require('../db');
const { encrypt, decrypt } = require('./crypto');

const FIFTEEN_DAYS_MS = 15 * 24 * 3600 * 1000;
const SIXTY_DAYS_MS = 60 * 24 * 3600 * 1000;

class TokenLifecycleService {
  constructor() {
    this.timer = null;
    this.isChecking = false;
  }

  /**
   * Refreshes a single Instagram / Meta account token using the appropriate Meta API.
   */
  async refreshTokenForAccount(account) {
    if (!account) return { success: false, error: 'No account provided' };
    const rawToken = decrypt(account.access_token_enc);
    if (!rawToken) {
      await this.markReauthRequired(account.id, 'Unable to decrypt stored access token');
      return { success: false, error: 'Decryption failed' };
    }

    const isMock = process.env.META_MOCK_MODE === 'true' || process.env.NODE_ENV === 'test';

    try {
      if (isMock) {
        // Mock token refresh simulation
        if (rawToken.includes('revoked') || rawToken.includes('invalid')) {
          throw new Error('OAuthException: Error validating access token: Session has expired or been revoked (code 190, subcode 458)');
        }
        const refreshedToken = rawToken.startsWith('refreshed_') ? rawToken : `refreshed_${rawToken}`;
        const newExpiresAt = new Date(Date.now() + SIXTY_DAYS_MS).toISOString();

        await db.prepare(`
          UPDATE instagram_accounts SET
            access_token_enc = ?,
            token_expires_at = ?,
            token_refreshed_at = datetime('now'),
            status = 'connected',
            last_auth_error = NULL,
            updated_at = datetime('now')
          WHERE id = ?
        `).run(encrypt(refreshedToken), newExpiresAt, account.id);

        console.log(`[TokenLifecycle] ✅ [MOCK] Successfully refreshed token for @${account.username || account.id}`);
        return { success: true, refreshed: true, expiresAt: newExpiresAt };
      }

      // Live Meta Graph API Refresh Flow
      // Check if Instagram Basic Display or Meta Graph API Page Token
      let url;
      if (account.token_type === 'ig_user_token' || (!account.page_id && !process.env.META_APP_SECRET)) {
        url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(rawToken)}`;
      } else {
        // Standard long-lived system / user exchange
        const appId = process.env.META_IG_APP_ID || process.env.META_APP_ID;
        const appSecret = process.env.META_IG_APP_SECRET || process.env.META_APP_SECRET;
        url = `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(rawToken)}`;
      }

      const res = await fetch(url, { headers: { 'User-Agent': 'Airvix-TokenRefresher/1.0' } });
      const data = await res.json();

      if (!res.ok || data.error) {
        const errorMsg = data.error?.message || `Meta HTTP ${res.status}`;
        const errorCode = data.error?.code;
        const errorSubcode = data.error?.error_subcode;

        // Code 190 indicates invalid/expired/revoked token
        if (errorCode === 190 || [458, 463, 467].includes(errorSubcode)) {
          await this.markReauthRequired(account.id, errorMsg);
        } else {
          await db.prepare(`
            UPDATE instagram_accounts SET
              last_auth_error = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `).run(`Token refresh attempt failed: ${errorMsg}`, account.id);
        }
        return { success: false, error: errorMsg };
      }

      const newToken = data.access_token;
      const expiresIn = data.expires_in || 5184000; // 60 days in seconds
      const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      await db.prepare(`
        UPDATE instagram_accounts SET
          access_token_enc = ?,
          token_expires_at = ?,
          token_refreshed_at = datetime('now'),
          status = 'connected',
          last_auth_error = NULL,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(encrypt(newToken), newExpiresAt, account.id);

      console.log(`[TokenLifecycle] ✅ Successfully refreshed token for @${account.username || account.id} (Expires: ${newExpiresAt})`);
      return { success: true, refreshed: true, expiresAt: newExpiresAt };
    } catch (err) {
      console.error(`[TokenLifecycle] ❌ Exception refreshing token for ${account.username || account.id}:`, err.message);
      if (err.message.includes('code 190') || err.message.includes('revoked') || err.message.includes('expired')) {
        await this.markReauthRequired(account.id, err.message);
      }
      return { success: false, error: err.message };
    }
  }

  /**
   * Marks an account as requiring reauthorization and halts sending
   */
  async markReauthRequired(accountId, errorMessage) {
    try {
      await db.prepare(`
        UPDATE instagram_accounts SET
          status = 'reauth_required',
          last_auth_error = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(String(errorMessage).slice(0, 500), accountId);
      console.warn(`[TokenLifecycle] ⚠️ Account ${accountId} marked as 'reauth_required': ${errorMessage}`);
    } catch (e) {
      console.error(`[TokenLifecycle] Error marking reauth_required for ${accountId}:`, e.message);
    }
  }

  /**
   * Scans all connected accounts and triggers refreshes for tokens approaching expiration.
   */
  async checkAndRefreshTokens() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const accounts = await db.prepare(`
        SELECT id, user_id, ig_user_id, username, page_id, access_token_enc, token_expires_at, status
        FROM instagram_accounts
        WHERE status = 'connected'
      `).all();

      if (!accounts || !accounts.length) return;

      const now = Date.now();
      let refreshedCount = 0;

      for (const account of accounts) {
        let shouldRefresh = false;

        if (!account.token_expires_at) {
          // No expiration recorded — set a baseline or refresh
          shouldRefresh = true;
        } else {
          const expiresTime = new Date(account.token_expires_at).getTime();
          // If expiring within 15 days or already expired
          if (isNaN(expiresTime) || expiresTime - now < FIFTEEN_DAYS_MS) {
            shouldRefresh = true;
          }
        }

        if (shouldRefresh) {
          const result = await this.refreshTokenForAccount(account);
          if (result.success && result.refreshed) {
            refreshedCount++;
          }
        }
      }

      if (refreshedCount > 0) {
        console.log(`[TokenLifecycle] 🔄 Completed scheduled check: Refreshed ${refreshedCount} account token(s).`);
      }
    } catch (err) {
      console.error('[TokenLifecycle] ❌ Error in scheduled checkAndRefreshTokens:', err.message);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Starts background recurring token lifecycle management (defaults to every 12 hours)
   */
  startTokenLifecycleService(intervalMs = 12 * 3600 * 1000) {
    if (this.timer) clearInterval(this.timer);
    // Initial check after brief delay
    setTimeout(() => {
      this.checkAndRefreshTokens().catch(() => {});
    }, 5000);

    this.timer = setInterval(() => {
      this.checkAndRefreshTokens().catch(() => {});
    }, intervalMs);

    if (this.timer.unref) this.timer.unref();
    console.log(`[TokenLifecycle] 🛡️ Token Lifecycle Service initialized (Interval: ${(intervalMs / 3600000).toFixed(1)}h).`);
  }

  stopTokenLifecycleService() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[TokenLifecycle] Token Lifecycle Service stopped.');
    }
  }
}

const tokenLifecycle = new TokenLifecycleService();
module.exports = tokenLifecycle;
