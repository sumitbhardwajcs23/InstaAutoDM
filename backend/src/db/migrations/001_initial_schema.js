/**
 * Migration 001: Initial Core Schema
 */

module.exports = {
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        plan TEXT DEFAULT 'free',
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'active',
        password_hash TEXT,
        dm_usage_this_period INTEGER DEFAULT 0,
        usage_period_start TEXT NOT NULL,
        created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE TABLE IF NOT EXISTS instagram_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ig_user_id TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        account_type TEXT,
        page_id TEXT,
        fb_page_name TEXT,
        fb_user_id TEXT,
        status TEXT DEFAULT 'active',
        disclosure_message TEXT DEFAULT '⚡ [Automated Response] ',
        followers_count INTEGER DEFAULT 0,
        full_name TEXT,
        profile_picture_url TEXT,
        access_token_enc TEXT,
        page_access_token_enc TEXT,
        long_lived_token_enc TEXT,
        token_refreshed_at TEXT,
        token_revoked_at TEXT,
        token_type TEXT DEFAULT 'ig_long_lived',
        last_auth_error TEXT,
        created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE TABLE IF NOT EXISTS automation_rules (
        id TEXT PRIMARY KEY,
        instagram_account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        trigger_keyword TEXT NOT NULL,
        match_mode TEXT DEFAULT 'exact',
        reply_message TEXT NOT NULL,
        comment_reply_mode TEXT DEFAULT 'both',
        comment_reply_message TEXT,
        dm_reply_message TEXT,
        target_media_id TEXT,
        target_media_type TEXT,
        target_media_thumbnail TEXT,
        target_media_caption TEXT,
        require_follow INTEGER DEFAULT 0,
        follow_prompt_message TEXT,
        follow_comment_reply TEXT,
        card_enabled INTEGER DEFAULT 0,
        card_title TEXT,
        card_subtitle TEXT,
        card_image_url TEXT,
        card_button_text TEXT,
        card_button_url TEXT,
        is_active INTEGER DEFAULT 1,
        fire_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        instagram_account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
        ig_scoped_user_id TEXT NOT NULL,
        username TEXT,
        name TEXT,
        profile_pic_url TEXT,
        avatar_seed TEXT,
        last_message TEXT,
        last_message_direction TEXT,
        status TEXT DEFAULT 'active',
        last_user_message_at TEXT,
        daily_automated_dm_count INTEGER DEFAULT 0,
        last_automated_dm_date TEXT,
        pending_follow_rule_id TEXT,
        created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        UNIQUE(instagram_account_id, ig_scoped_user_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        direction TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        meta_message_id TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE CASCADE,
        event_date TEXT NOT NULL,
        dms_sent INTEGER DEFAULT 0,
        comments_replied INTEGER DEFAULT 0,
        created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
        UNIQUE(instagram_account_id, event_date)
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        actor_id TEXT NOT NULL,
        actor_email TEXT,
        action TEXT NOT NULL,
        target_resource TEXT,
        ip_address TEXT DEFAULT 'masked',
        details TEXT,
        created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
      );
    `);
  },

  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS workspaces CASCADE;
      DROP TABLE IF EXISTS activity_log CASCADE;
      DROP TABLE IF EXISTS messages CASCADE;
      DROP TABLE IF EXISTS conversations CASCADE;
      DROP TABLE IF EXISTS automation_rules CASCADE;
      DROP TABLE IF EXISTS instagram_accounts CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
  }
};
