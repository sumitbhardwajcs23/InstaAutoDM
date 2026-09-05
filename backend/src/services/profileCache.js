// backend/src/services/profileCache.js
// Real-time in-memory profile cache for Instagram users
// Prevents repeated Meta API / DB calls. Fetches & caches on first message.

const db = require('../db');
const metaClient = require('./metaClient');
const { decrypt } = require('./crypto');

// TTL: re-fetch from Meta every 6 hours max; serve from memory instantly
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// In-memory Map: igScopedUserId -> { name, username, profile_pic, fetchedAt }
const profileMap = new Map();

// Hardcoded known testers — always available instantly, no network needed
const KNOWN_USERS = {
  '1759458871653007': { name: 'sumit bhardwaj', username: 'join_sumit_', profile_pic: 'https://instagram.fdel65-4.fna.fbcdn.net/v/t51.82787-19/671209546_18351709720242986_4694042261133486757_n.jpg?stp=dst-jpg_s206x206_tt6&_nc_cat=104&ccb=7-5&_nc_sid=bf7eb4&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=0kznyX7llrUQ7kNvwHSYMHU&_nc_oc=AdplFQw1gO469Ud_pFMYcSf_5rZzMvr4PS6kl7_G_YkQ4f7u-B5s97c3CLFs8Jd8K59Mo6iokWhZSIeZgtg_xMgJ&_nc_zt=24&_nc_ht=instagram.fdel65-4.fna&edm=ALmAK4EEAAAA&_nc_gid=29Tfo3w3z7qQ72CW0TVyBQ&oh=00_AQK6yoIl9tKjgebs3n20Syv3sd-lEutfLMNpl2AVcaQLUw&oe=6AA20743' },
  '28206324158977642': { name: 'Nitish Rajpoot', username: 'nitishrajpoot27' },
  '2694306197727421': { name: '𝙲𝚑𝚑𝚊𝚟𝚒✮', username: 'urluv.chhavi' },
  '2199839837542030': { name: 'Priyanshu Uttam | Boring Traders 📈', username: 'priyanshu__vision' },
  '2052261912093429': { name: 'Piyush Yadav', username: 'rao_piyushh_yadav' },
  '1730487928031569': { name: 'Maniesha', username: 'radhika_bhardwaj15' },
};

// Pre-load KNOWN_USERS into cache immediately
for (const [id, info] of Object.entries(KNOWN_USERS)) {
  profileMap.set(id, { ...info, fetchedAt: Date.now(), source: 'known' });
}

// Pre-warm from DB on startup — loads all existing profiles so no DB call needed on next message
function prewarm() {
  try {
    const rows = db.prepare(
      "SELECT ig_scoped_user_id, name, username, profile_pic_url FROM conversations WHERE name IS NOT NULL AND name != 'user' AND name != ''"
    ).all();
    for (const row of rows) {
      const existing = profileMap.get(row.ig_scoped_user_id);
      if (!existing) {
        profileMap.set(row.ig_scoped_user_id, {
          name: row.name,
          username: row.username,
          profile_pic: row.profile_pic_url || null,
          fetchedAt: Date.now() - CACHE_TTL_MS, // mark as stale so it can be refreshed
          source: 'db',
        });
      }
    }
    console.log(`[ProfileCache] 🔥 Pre-warmed with ${profileMap.size} profiles from DB`);
  } catch (e) {
    console.warn('[ProfileCache] Pre-warm error:', e.message);
  }
}

/**
 * Get a profile from cache — returns immediately from memory.
 * @param {string} igScopedUserId
 * @returns {{ name, username, profile_pic } | null}
 */
function get(igScopedUserId) {
  return profileMap.get(igScopedUserId) || null;
}

/**
 * Fetch profile from Meta Graph API and persist to cache + DB.
 * Called opportunistically after saving a message — non-blocking.
 * @param {string} igScopedUserId
 * @param {string} accessTokenEnc - encrypted or raw access token
 * @param {string} conversationId - to update DB record
 */
async function fetchAndCache(igScopedUserId, accessTokenEnc, conversationId) {
  if (!igScopedUserId) return;

  // Don't re-fetch if we have a fresh cache entry
  const cached = profileMap.get(igScopedUserId);
  if (cached && cached.source === 'known') return; // known users never need network
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS && cached.name) return;

  try {
    const token = accessTokenEnc && (accessTokenEnc.startsWith('EAA') || accessTokenEnc.startsWith('IGQ') || accessTokenEnc.startsWith('IG'))
      ? accessTokenEnc
      : decrypt(accessTokenEnc);

    const profile = await metaClient.getInstagramUserProfile({
      igScopedUserId,
      accessToken: token,
    });

    if (profile && (profile.name || profile.username)) {
      const entry = {
        name: profile.name || (cached?.name || null),
        username: profile.username || (cached?.username || null),
        profile_pic: profile.profile_pic || (cached?.profile_pic || null),
        fetchedAt: Date.now(),
        source: 'meta',
      };
      profileMap.set(igScopedUserId, entry);
      console.log(`[ProfileCache] ✅ Fetched & cached: ${igScopedUserId} → "${entry.name}" (@${entry.username})`);

      // Persist to DB
      if (conversationId) {
        try {
          db.prepare(`
            UPDATE conversations SET
              name = COALESCE(?, name),
              username = COALESCE(?, username),
              profile_pic_url = COALESCE(?, profile_pic_url),
              updated_at = datetime('now')
            WHERE id = ?
          `).run(entry.name, entry.username, entry.profile_pic, conversationId);
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn(`[ProfileCache] Meta fetch failed for ${igScopedUserId}:`, err.message);
  }
}

/**
 * Set a profile manually (e.g. from webhook data or KNOWN_USERS).
 */
function set(igScopedUserId, profileData) {
  profileMap.set(igScopedUserId, { ...profileData, fetchedAt: Date.now(), source: profileData.source || 'manual' });
}

/**
 * Resolve best available profile data for display (cache-first, DB-second, fallback).
 * Returns { name, username, profile_pic } — never returns "User XXXXXX".
 */
function resolve(igScopedUserId, dbRow = null) {
  const cached = profileMap.get(igScopedUserId);
  
  const name = cached?.name || dbRow?.name || null;
  const username = cached?.username || dbRow?.username || null;
  const profile_pic = cached?.profile_pic || dbRow?.profile_pic_url || null;
  
  return { name, username, profile_pic };
}

// Run pre-warm after a short delay to let DB initialize
setTimeout(prewarm, 500);

module.exports = { get, set, resolve, fetchAndCache, profileMap, KNOWN_USERS };
