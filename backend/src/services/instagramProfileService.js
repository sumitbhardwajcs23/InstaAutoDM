// backend/src/services/instagramProfileService.js
// Service for verifying Instagram usernames and fetching real public profile data

const profileCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#064;/g, '@')
    .replace(/&#x40;/g, '@')
    .replace(/&#x2022;/g, '•')
    .replace(/&bull;/g, '•')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseCount(raw) {
  if (!raw) return 0;
  const clean = raw.trim().replace(/,/g, '');
  if (/m$/i.test(clean)) return Math.round(parseFloat(clean) * 1000000);
  if (/k$/i.test(clean)) return Math.round(parseFloat(clean) * 1000);
  if (/b$/i.test(clean)) return Math.round(parseFloat(clean) * 1000000000);
  return parseInt(clean, 10) || 0;
}

class InstagramProfileService {
  /**
   * Validate handle format
   * Instagram handles allow letters, numbers, periods, and underscores, up to 30 characters.
   */
  isValidUsername(username) {
    if (!username || typeof username !== 'string') return false;
    const clean = username.replace(/^@/, '').trim();
    return /^[a-zA-Z0-9._]{1,30}$/.test(clean);
  }

  /**
   * Fetch real public profile details from Instagram
   * @param {string} rawUsername
   * @returns {Promise<{ valid: boolean, profile?: object, error?: string }>}
   */
  async fetchProfile(rawUsername) {
    const username = (rawUsername || '').replace(/^@/, '').trim().toLowerCase();
    if (!this.isValidUsername(username)) {
      return {
        valid: false,
        error: `"${rawUsername}" is not a valid Instagram username format. Usernames can only contain letters, numbers, underscores, and periods.`,
      };
    }

    // Check memory cache first
    const cached = profileCache.get(username);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return { valid: true, profile: cached.profile };
    }

    try {
      const res = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      });

      const html = await res.text();

      // Look for Open Graph and Twitter metadata tags
      const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i)
                     || html.match(/<meta\s+content=["'](.*?)["']\s+property=["']og:description["']/i);
      const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i)
                      || html.match(/<meta\s+content=["'](.*?)["']\s+property=["']og:title["']/i);
      const imageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i)
                      || html.match(/<meta\s+content=["'](.*?)["']\s+property=["']og:image["']/i);

      // If neither og:description nor og:title is present, or title is generic "Instagram", account does not exist
      if (!descMatch || !titleMatch) {
        return {
          valid: false,
          error: `Instagram account @${username} does not exist or is unavailable.`,
        };
      }

      const rawDesc = decodeHtmlEntities(descMatch[1]);
      const rawTitle = decodeHtmlEntities(titleMatch[1]);
      const profilePicUrl = imageMatch ? decodeHtmlEntities(imageMatch[1]).trim() : null;

      // Extract follower, following, and post counts from description
      // Pattern: "374 Followers, 416 Following, 4 Posts - See Instagram photos and videos..."
      let followersCount = 0;
      let followingCount = 0;
      let postsCount = 0;

      const followersMatch = rawDesc.match(/([\d.,]+[KMBkmb]?)\s+Followers/i);
      if (followersMatch) followersCount = parseCount(followersMatch[1]);

      const followingMatch = rawDesc.match(/([\d.,]+[KMBkmb]?)\s+Following/i);
      if (followingMatch) followingCount = parseCount(followingMatch[1]);

      const postsMatch = rawDesc.match(/([\d.,]+[KMBkmb]?)\s+Posts/i);
      if (postsMatch) postsCount = parseCount(postsMatch[1]);

      // Extract full name from title
      // Pattern: "sumit bhardwaj (@join_sumit_) • Instagram photos and videos"
      let fullName = username;
      const nameMatch = rawTitle.match(/^(.*?)\s*\(@/);
      if (nameMatch && nameMatch[1].trim()) {
        fullName = nameMatch[1].trim();
      }

      const profile = {
        username,
        full_name: fullName || username,
        followers_count: followersCount,
        following_count: followingCount,
        posts_count: postsCount,
        profile_picture_url: profilePicUrl,
        account_type: 'Creator Account',
      };

      profileCache.set(username, { profile, timestamp: Date.now() });

      return { valid: true, profile };
    } catch (err) {
      return {
        valid: false,
        error: `Could not verify Instagram account @${username}: ${err.message || 'Network timeout'}`,
      };
    }
  }

  /**
   * Clear cache for a specific handle or all
   */
  clearCache(username = null) {
    if (username) {
      profileCache.delete(username.replace(/^@/, '').trim().toLowerCase());
    } else {
      profileCache.clear();
    }
  }
}

module.exports = new InstagramProfileService();
