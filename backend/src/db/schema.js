// backend/src/db/schema.js
// Pure PostgreSQL Schema Definition

const CREATE_TABLES_PG_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT 'Creator',
  avatar_url TEXT,
  password_hash TEXT,
  email_verified INTEGER DEFAULT 0,
  plan TEXT DEFAULT 'free',
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  custom_dm_limit INTEGER,
  custom_ig_limit INTEGER,
  custom_rules_limit INTEGER,
  dm_usage_this_period INTEGER DEFAULT 0,
  usage_period_start TEXT NOT NULL,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  CONSTRAINT unq_auth_provider_acc UNIQUE(provider, provider_account_id),
  CONSTRAINT unq_user_provider UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS otp_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  token_hash TEXT NOT NULL,
  ip_address TEXT DEFAULT 'masked',
  user_agent TEXT,
  is_revoked INTEGER DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  last_active_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS pricing_plans (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price INTEGER NOT NULL DEFAULT 0,
  annual_price INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  dm_limit INTEGER DEFAULT 1000,
  ig_limit INTEGER DEFAULT 1,
  rules_limit INTEGER DEFAULT 5,
  badge_text TEXT,
  is_popular INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  features TEXT,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
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
  token_refreshed_at TEXT,
  token_type TEXT DEFAULT 'ig_long_lived',
  last_auth_error TEXT,
  token_revoked_at TEXT,
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
  instagram_account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
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
  automation_rule_id TEXT REFERENCES automation_rules(id) ON DELETE SET NULL ON UPDATE CASCADE,
  instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
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
  instagram_account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
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
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  direction TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  meta_message_id TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT,
  account_id TEXT,
  sender_id TEXT,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  signature_hash TEXT,
  delivery_timestamp TEXT,
  processing_time_ms INTEGER,
  processed_at TEXT,
  status TEXT DEFAULT 'pending',
  error TEXT,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
  event_date TEXT NOT NULL,
  dms_sent INTEGER DEFAULT 0,
  comments_replied INTEGER DEFAULT 0,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  UNIQUE(instagram_account_id, event_date)
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
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

CREATE TABLE IF NOT EXISTS data_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_email TEXT,
  request_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  requested_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  details TEXT,
  ip_address TEXT DEFAULT 'masked',
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS webhook_jobs (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  account_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'QUEUED',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  scheduled_at TEXT NOT NULL,
  processed_at TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  user_id TEXT,
  account_id TEXT,
  idempotency_key TEXT,
  queue_name TEXT DEFAULT 'dm-dispatch',
  job_type TEXT DEFAULT 'INSTAGRAM_DM',
  payload TEXT NOT NULL,
  error_name TEXT,
  error_message TEXT,
  error_stack TEXT,
  retry_count INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  is_resolved INTEGER DEFAULT 0,
  status TEXT DEFAULT 'unresolved',
  resolved_at TEXT,
  failed_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancel_at_period_end INTEGER DEFAULT 0,
  canceled_at TEXT,
  trial_ends_at TEXT,
  grace_period_ends_at TEXT,
  gateway TEXT DEFAULT 'razorpay',
  gateway_subscription_id TEXT,
  gateway_customer_id TEXT,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  subscription_id TEXT REFERENCES subscriptions(id) ON DELETE SET NULL ON UPDATE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'paid',
  gateway TEXT DEFAULT 'razorpay',
  gateway_payment_id TEXT,
  gateway_order_id TEXT,
  billing_name TEXT,
  billing_email TEXT,
  gst_number TEXT,
  billing_address TEXT,
  paid_at TEXT,
  failed_reason TEXT,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id TEXT PRIMARY KEY,
  gateway TEXT NOT NULL,
  event_type TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  payload TEXT NOT NULL,
  signature_verified INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processed',
  error TEXT,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  token_hash TEXT NOT NULL,
  ip_address TEXT DEFAULT 'masked',
  user_agent TEXT,
  is_revoked INTEGER DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  last_active_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS system_alerts (
  id TEXT PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'warning',
  message TEXT NOT NULL,
  details TEXT,
  resolved INTEGER DEFAULT 0,
  resolved_at TEXT,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS error_events (
  id TEXT PRIMARY KEY,
  error_fingerprint TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  url TEXT,
  method TEXT,
  user_id TEXT,
  request_id TEXT,
  occurrence_count INTEGER DEFAULT 1,
  first_seen_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  last_seen_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id TEXT PRIMARY KEY,
  confirmation_code TEXT UNIQUE NOT NULL,
  user_id TEXT,
  account_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  details TEXT,
  requested_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  completed_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS automation_loop_incidents (
  id TEXT PRIMARY KEY,
  instagram_account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  target_user_id TEXT NOT NULL,
  trigger_rule_id TEXT,
  loop_reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'active',
  detected_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_data_deletion_code ON data_deletion_requests(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_loop_incidents_account ON automation_loop_incidents(instagram_account_id, status);
CREATE INDEX IF NOT EXISTS idx_loop_incidents_conv ON automation_loop_incidents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ig_accounts_user ON instagram_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_replies_comment_id ON comment_replies(comment_id);
CREATE INDEX IF NOT EXISTS idx_rules_account_active ON automation_rules(instagram_account_id, is_active);
CREATE INDEX IF NOT EXISTS idx_conversations_account ON conversations(instagram_account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(instagram_account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_log(event_date);
CREATE INDEX IF NOT EXISTS idx_comment_replies_created ON comment_replies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_requests_user ON data_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_jobs_sched_state ON webhook_jobs(state, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_webhook_jobs_account ON webhook_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_pay_webhooks_key ON payment_webhook_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id, is_revoked);
CREATE INDEX IF NOT EXISTS idx_system_alerts_res ON system_alerts(resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_events_fp ON error_events(error_fingerprint);

CREATE TABLE IF NOT EXISTS tenant_api_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT REFERENCES instagram_accounts(id) ON DELETE SET NULL,
  api_type TEXT NOT NULL,
  endpoint TEXT,
  cost_units INTEGER DEFAULT 1,
  status_code INTEGER,
  details TEXT,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS abuse_flags (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  severity TEXT DEFAULT 'warning',
  details TEXT,
  auto_paused INTEGER DEFAULT 0,
  resolved INTEGER DEFAULT 0,
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS global_kill_switch (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  target_id TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  reason TEXT,
  activated_by TEXT,
  activated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  deactivated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenant_api_usage_user ON tenant_api_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_api_usage_type ON tenant_api_usage(api_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_flags_res ON abuse_flags(resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_flags_acc ON abuse_flags(instagram_account_id, resolved);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kill_switch_scope_target ON global_kill_switch(scope, target_id);
CREATE INDEX IF NOT EXISTS idx_kill_switch_active ON global_kill_switch(is_active);

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  plan_slug TEXT DEFAULT 'all',
  max_uses INTEGER DEFAULT 100,
  used_count INTEGER DEFAULT 0,
  expires_at TEXT,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'subadmin',
  permissions TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

CREATE TABLE IF NOT EXISTS rule_card_attachments (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE ON UPDATE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  button_text TEXT,
  button_url TEXT,
  created_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_rule_card_attachments_rule ON rule_card_attachments(rule_id, sort_order);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  discount_applied INTEGER NOT NULL DEFAULT 0,
  redeemed_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  CONSTRAINT uq_user_coupon UNIQUE(coupon_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON coupon_redemptions(user_id);

CREATE TABLE IF NOT EXISTS usage_counters (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  period_start TEXT NOT NULL,
  dms_sent INTEGER NOT NULL DEFAULT 0,
  comments_replied INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);
CREATE INDEX IF NOT EXISTS idx_usage_counters_user ON usage_counters(user_id);
`;

module.exports = {
  CREATE_TABLES_PG_SQL,
  CREATE_TABLES_SQL: CREATE_TABLES_PG_SQL,
};
