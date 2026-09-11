// backend/src/services/tokenLifecycle.js
const db = require('../db');
const { encrypt, decrypt, reencryptText } = require('./crypto');

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

    const isMock = process.env.META_MOCK_MODE === 'true' || 
                   process.env.NODE_ENV === 'test' || 
                   rawToken.startsWith('mock_') || 
                   rawToken.startsWith('EAAB_secret');

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
   * Actively revokes access tokens on Meta Graph API and securely wipes them from DB.
   */
  async revokeTokenForAccount(account) {
    if (!account) return { success: false, error: 'No account provided' };

    const rawToken = decrypt(account.access_token_enc || account.page_access_token_enc || account.long_lived_token_enc);
    const isMock = process.env.META_MOCK_MODE === 'true' || process.env.NODE_ENV === 'test' || !rawToken || rawToken.startsWith('mock_');

    let metaRevoked = false;
    let metaRevokeError = null;

    if (rawToken && !isMock) {
      try {
        // Meta Graph API Revoke Permissions endpoint: DELETE /me/permissions
        const res = await fetch(`https://graph.facebook.com/v22.0/me/permissions?access_token=${encodeURIComponent(rawToken)}`, {
          method: 'DELETE',
          headers: { 'User-Agent': 'Airvix-TokenRevoker/1.0' }
        });
        const data = await res.json();
        metaRevoked = Boolean(data && data.success);
      } catch (err) {
        metaRevokeError = err.message;
        console.warn(`[TokenLifecycle] Warning: Provider revocation error for @${account.username}:`, err.message);
      }
    } else {
      metaRevoked = true; // Simulated success in mock mode
    }

    // Securely wipe encrypted tokens from database and mark as disconnected / revoked
    await db.prepare(`
      UPDATE instagram_accounts SET
        status = 'disconnected',
        access_token_enc = '',
        page_access_token_enc = '',
        long_lived_token_enc = '',
        token_revoked_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(account.id);

    console.log(`[TokenLifecycle] 🛑 Token revoked and scrubbed for account ${account.id} (@${account.username || 'unknown'})`);

    return {
      success: true,
      revoked: true,
      metaRevoked,
      metaRevokeError
    };
  }

  /**
   * Re-encrypts all stored tokens across the database with a new encryption key.
   * Enables zero-downtime key rotation.
   */
  async reencryptAllStoredTokens(newKey, oldKey = null) {
    if (!newKey) throw new Error('New encryption key required for rotation');

    const accounts = await db.prepare("SELECT id, access_token_enc, page_access_token_enc, long_lived_token_enc FROM instagram_accounts WHERE access_token_enc != ''").all();
    let migratedCount = 0;
    const errors = [];

    for (const acc of accounts) {
      try {
        const newAccessEnc = acc.access_token_enc ? reencryptText(acc.access_token_enc, newKey, oldKey) : '';
        const newPageEnc = acc.page_access_token_enc ? reencryptText(acc.page_access_token_enc, newKey, oldKey) : '';
        const newLongEnc = acc.long_lived_token_enc ? reencryptText(acc.long_lived_token_enc, newKey, oldKey) : '';

        await db.prepare(`
          UPDATE instagram_accounts SET
            access_token_enc = ?,
            page_access_token_enc = ?,
            long_lived_token_enc = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).run(newAccessEnc, newPageEnc, newLongEnc, acc.id);

        migratedCount++;
      } catch (err) {
        errors.push({ id: acc.id, error: err.message });
      }
    }

    console.log(`[TokenLifecycle] 🔐 Re-encrypted ${migratedCount} account tokens with new key.`);
    return { success: errors.length === 0, migratedCount, total: accounts.length, errors };
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
