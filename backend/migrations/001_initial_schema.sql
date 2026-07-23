-- ============================================================================
-- Toroloom — Migration 001: Initial Schema
-- ============================================================================
--
-- Creates all tables and indexes that were previously managed by the inline
-- migrate() method in PostgreSQLStorage. Uses CREATE TABLE/INDEX IF NOT EXISTS
-- so it is safe to run on existing databases.
--
-- ============================================================================

-- ──── 1. Extensions (idempotent) ──────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──── 2. Audit Events ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB,
  previous_hash TEXT NOT NULL,
  hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_events (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_events (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events (timestamp DESC);

-- ──── 3. Risk Profiles ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS risk_profiles (
  user_id TEXT PRIMARY KEY,
  profile JSONB NOT NULL,
  updated_at TEXT NOT NULL
);

-- ──── 4. Broker State ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS broker_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- ──── 5. Badge Counts ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS badge_counts (
  user_id TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

-- ──── 6. Notifications ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  timestamp TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  metadata JSONB
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications (timestamp DESC);

-- ──── 7. Community Posts ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  content TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL,
  tags JSONB DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_community_timestamp ON community_posts (timestamp DESC);

-- ──── 8. Telegram Links ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS telegram_links (
  user_id TEXT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  first_name TEXT NOT NULL,
  username TEXT,
  linked_at TEXT NOT NULL
);

-- ──── 9. SnapTrade Connections ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS snap_trade_connections (
  user_id TEXT PRIMARY KEY,
  snap_trade_user_id TEXT NOT NULL,
  encrypted_user_secret TEXT NOT NULL,
  authorization_id TEXT NOT NULL DEFAULT '',
  account_id TEXT NOT NULL DEFAULT '',
  broker_name TEXT NOT NULL DEFAULT '',
  broker_slug TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL DEFAULT '',
  connected_at TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──── 10. Coupons ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'free_trial')),
  value INTEGER NOT NULL,
  trial_days INTEGER,
  min_plan_tier TEXT,
  max_uses INTEGER NOT NULL DEFAULT 0,
  current_uses INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons (code) WHERE is_active = true;

-- ──── 11. Coupon Usage ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupon_usage (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL REFERENCES coupons(code) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  discount_amount INTEGER NOT NULL,
  original_price INTEGER NOT NULL,
  final_price INTEGER NOT NULL,
  used_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_code ON coupon_usage (code);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON coupon_usage (code, user_id);

-- ──── 12. Webhooks ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TEXT,
  delivery_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks (user_id);

-- ──── 13. Webhook Delivery Logs ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  duration INTEGER NOT NULL DEFAULT 0,
  response_body TEXT NOT NULL DEFAULT '',
  error_message TEXT,
  timestamp TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_webhook_id ON webhook_delivery_logs (webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_timestamp ON webhook_delivery_logs (timestamp DESC);

-- ──── 14. API Keys ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]',
  expires_at TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TEXT,
  ip_restrict TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);

-- ──── 15. Subscriptions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'free',
  plan_id TEXT NOT NULL DEFAULT 'plan_free',
  status TEXT NOT NULL DEFAULT 'active',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  payment_method TEXT,
  razorpay_order_id TEXT,
  last_payment_date TEXT,
  tenant_id TEXT,
  -- UPI Mandate fields
  mandate_id TEXT,
  mandate_upi_id TEXT,
  mandate_bank_name TEXT,
  mandate_status TEXT,
  mandate_next_charge_date TEXT,
  mandate_billing_period TEXT,
  -- Trial fields
  trial_start_date TEXT,
  trial_end_date TEXT,
  is_trial_used BOOLEAN DEFAULT false,
  -- Grace period / Payment failure fields
  grace_period_end_date TEXT,
  payment_failure_count INTEGER DEFAULT 0,
  last_payment_failure_date TEXT,
  failed_payment_retry_count INTEGER DEFAULT 0,
  last_payment_retry_date TEXT
);

-- ──── 16. Users (core identity) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  display_name    TEXT NOT NULL DEFAULT '',
  password_hash   TEXT,
  role            TEXT NOT NULL DEFAULT 'free',
  kyc_status      TEXT NOT NULL DEFAULT 'pending',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone
    ON users (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_external_id
    ON users (external_id);
CREATE INDEX IF NOT EXISTS idx_users_email_password
    ON users (email, password_hash)
    WHERE email IS NOT NULL AND password_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role
    ON users (role) WHERE role IN ('pro', 'elite', 'admin');
CREATE INDEX IF NOT EXISTS idx_users_kyc_status
    ON users (kyc_status) WHERE kyc_status != 'verified';
CREATE INDEX IF NOT EXISTS idx_users_created_at
    ON users (created_at DESC);

-- ──── 17. Broker Sessions ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS broker_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker_type       TEXT NOT NULL,
  encrypted_token   TEXT NOT NULL,
  encrypted_secret  TEXT,
  status            TEXT NOT NULL DEFAULT 'active',
  expires_at        TIMESTAMPTZ,
  last_used_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_sessions_active
    ON broker_sessions (user_id, broker_type)
    WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_broker_sessions_last_used
    ON broker_sessions (user_id, last_used_at DESC)
    WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_broker_sessions_user
    ON broker_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_sessions_cleanup
    ON broker_sessions (expires_at)
    WHERE status = 'active';

-- ──── 18. Parsed Ledgers ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS parsed_ledgers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker_session_id   UUID REFERENCES broker_sessions(id) ON DELETE SET NULL,
  execution_timestamp TIMESTAMPTZ NOT NULL,
  asset_symbol        TEXT NOT NULL,
  transaction_type    TEXT NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
  filled_quantity     NUMERIC(18,4) NOT NULL CHECK (filled_quantity > 0),
  execution_price     NUMERIC(18,2) NOT NULL CHECK (execution_price > 0),
  regulatory_fees     NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_value           NUMERIC(18,2) NOT NULL,
  source              TEXT NOT NULL DEFAULT 'manual',
  raw_text_hash       TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parsed_ledgers_user_time
    ON parsed_ledgers (user_id, execution_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_parsed_ledgers_user_type_time
    ON parsed_ledgers (user_id, transaction_type, execution_timestamp DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parsed_ledgers_raw_hash
    ON parsed_ledgers (raw_text_hash) WHERE raw_text_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parsed_ledgers_user_symbol
    ON parsed_ledgers (user_id, asset_symbol, execution_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_parsed_ledgers_exec_time
    ON parsed_ledgers (execution_timestamp DESC)
    INCLUDE (user_id, asset_symbol, transaction_type, filled_quantity, execution_price, net_value);
