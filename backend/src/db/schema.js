// backend/src/db/schema.js
// Pure PostgreSQL Schema Definition

const CREATE_TABLES_PG_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT 'Creator',
  avatar_url TEXT,
  password_hash TEXT,
  plan TEXT DEFAULT 'free',
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  dm_usage_this_period INTEGER DEFAULT 0,
  usage_period_start TEXT NOT NULL,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ig_user_id TEXT UNIQUE NOT NULL,
  username TEXT,
  account_type TEXT DEFAULT 'Business Account',
  page_id TEXT NOT NULL,
  fb_page_name TEXT,
  fb_user_id TEXT,
  access_token_enc TEXT NOT NULL,
  page_access_token_enc TEXT,
  long_lived_token_enc TEXT,
  token_expires_at TEXT,
  status TEXT DEFAULT 'connected',
  disclosure_message TEXT DEFAULT '⚡ [Automated Response] ',
  followers_count INTEGER DEFAULT 0,
  full_name TEXT,
  profile_picture_url TEXT,
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

CREATE TABLE IF NOT EXISTS comment_replies (
  id TEXT PRIMARY KEY,
  comment_id TEXT UNIQUE NOT NULL,
  automation_rule_id TEXT REFERENCES automation_rules(id) ON DELETE SET NULL,
  instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  commenter_username TEXT,
  comment_text TEXT,
  reply_sent TEXT,
  public_reply_sent TEXT,
  follower_status TEXT,
  status TEXT NOT NULL,
  meta_message_id TEXT,
  meta_comment_reply_id TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  instagram_account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  ig_scoped_user_id TEXT NOT NULL,
  username TEXT,
  name TEXT,
  profile_pic_url TEXT,
  avatar_seed TEXT,
  pending_follow_rule_id TEXT,
  last_message TEXT,
  last_message_direction TEXT DEFAULT 'inbound',
  status TEXT DEFAULT 'open',
  last_user_message_at TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  processed_at TEXT,
  status TEXT DEFAULT 'pending',
  error TEXT,
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

CREATE INDEX IF NOT EXISTS idx_ig_accounts_user ON instagram_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_replies_comment_id ON comment_replies(comment_id);
CREATE INDEX IF NOT EXISTS idx_rules_account_active ON automation_rules(instagram_account_id, is_active);
CREATE INDEX IF NOT EXISTS idx_conversations_account ON conversations(instagram_account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(instagram_account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_log(event_date);
CREATE INDEX IF NOT EXISTS idx_comment_replies_created ON comment_replies(created_at DESC);
`;

module.exports = {
  CREATE_TABLES_PG_SQL,
  CREATE_TABLES_SQL: CREATE_TABLES_PG_SQL,
};
