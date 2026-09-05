// backend/src/db/schema.js
const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT 'Creator',
  avatar_url TEXT,
  password_hash TEXT,
  plan TEXT DEFAULT 'free',
  dm_usage_this_period INTEGER DEFAULT 0,
  usage_period_start TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
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
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,
  instagram_account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  trigger_keyword TEXT NOT NULL,
  match_mode TEXT DEFAULT 'exact',
  reply_message TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  fire_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comment_replies (
  id TEXT PRIMARY KEY,
  comment_id TEXT UNIQUE NOT NULL,
  automation_rule_id TEXT REFERENCES automation_rules(id) ON DELETE SET NULL,
  instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  commenter_username TEXT,
  comment_text TEXT,
  reply_sent TEXT,
  status TEXT NOT NULL,
  meta_message_id TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
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
  last_message_direction TEXT DEFAULT 'inbound',
  status TEXT DEFAULT 'open',
  last_user_message_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
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
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  processed_at TEXT,
  status TEXT DEFAULT 'pending',
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  event_date TEXT NOT NULL,
  dms_sent INTEGER DEFAULT 0,
  comments_replied INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(instagram_account_id, event_date)
);

CREATE INDEX IF NOT EXISTS idx_comment_replies_comment_id ON comment_replies(comment_id);
CREATE INDEX IF NOT EXISTS idx_rules_account_active ON automation_rules(instagram_account_id, is_active);
CREATE INDEX IF NOT EXISTS idx_conversations_account ON conversations(instagram_account_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_log(event_date);
CREATE INDEX IF NOT EXISTS idx_comment_replies_created ON comment_replies(created_at DESC);
`;

module.exports = { CREATE_TABLES_SQL };
