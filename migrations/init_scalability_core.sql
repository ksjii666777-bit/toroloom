-- ============================================================================
-- Toroloom — Scalability Core Migration
-- ============================================================================
--
-- Purpose:  Defines the three user-facing tables that power the broker
--           session gateway, trade ledger parsing pipeline, and user
--           management subsystem. These are the HOT path tables queried
--           on every app open, every broker connect, and every trade
--           ledger import.
--
-- Design principles:
--   1. Multi-column B-tree indexes on EVERY frequent query pattern
--      (filter, sort, join) to keep sequential scans at zero.
--   2. Covering indexes where possible — avoids heap lookups for
--      the most common column projections.
--   3. Partition readiness — tables use UUID v7 (time-sortable) or
--      TIMESTAMPTZ so they can be range-partitioned by time when
--      they exceed 100M rows.
--   4. PgBouncer-safe — no session-level SET commands, no temp
--      tables, no LISTEN/NOTIFY.
--
-- Run:
--   psql $DATABASE_URL -f migrations/init_scalability_core.sql
--
-- Or via Railway CLI:
--   railway run psql -f migrations/init_scalability_core.sql
--
-- ============================================================================

-- ──── 1. Extensions (idempotent) ──────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- query performance

-- ──── 2. Users (core identity) ────────────────────────────────────────────
--
-- Columns:
--   id              UUID v4   — primary key, never exposed to clients
--   external_id     TEXT      — opaque public identifier (for URL-safe refs)
--   email           TEXT      — unique login identifier
--   phone           TEXT      — nullable; for SMS OTP, UPI autopay
--   display_name    TEXT      — profile name shown in UI
--   password_hash   TEXT      — bcrypt/scrypt hash (null for OAuth-only)
--   role            TEXT      — 'free' | 'pro' | 'elite' | 'admin'
--   kyc_status      TEXT      — 'pending' | 'verified' | 'rejected'
--   metadata        JSONB     — flexible profile bag (avatar_url, preferences)
--   created_at      TIMESTAMPTZ
--   updated_at      TIMESTAMPTZ
--
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

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users (email)
    WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone
    ON users (phone)
    WHERE phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_external_id
    ON users (external_id);

-- Login lookup (hot path)
CREATE INDEX IF NOT EXISTS idx_users_email_password
    ON users (email, password_hash)
    WHERE email IS NOT NULL AND password_hash IS NOT NULL;

-- Admin / support queries
CREATE INDEX IF NOT EXISTS idx_users_role
    ON users (role)
    WHERE role IN ('pro', 'elite', 'admin');

CREATE INDEX IF NOT EXISTS idx_users_kyc_status
    ON users (kyc_status)
    WHERE kyc_status != 'verified';

-- Time-range queries (recent signups, churn analysis)
CREATE INDEX IF NOT EXISTS idx_users_created_at
    ON users (created_at DESC);

-- ──── 3. Broker Sessions (gateway connection state) ───────────────────────
--
-- One row per user–broker pair.  Updated on every connect/disconnect
-- and token rotation.  Queried on every proxy API call to determine
-- which session cookie to attach.
--
-- Columns:
--   id                UUID       — primary key
--   user_id           UUID       → users.id
--   broker_type       TEXT       — 'zerodha' | 'angel' | 'groww' | 'ibkr' | ...
--   encrypted_token   TEXT       — AES-256-GCM encrypted session cookie
--   encrypted_secret  TEXT       — AES-256-GCM encrypted API secret (if any)
--   status            TEXT       — 'active' | 'expired' | 'revoked'
--   expires_at        TIMESTAMPTZ — token expiry; null = no expiry
--   last_used_at      TIMESTAMPTZ — updated on each proxy request
--   created_at        TIMESTAMPTZ
--   updated_at        TIMESTAMPTZ
--
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

-- HOT PATH: get active session for a user + broker type (every proxy request)
CREATE INDEX IF NOT EXISTS idx_broker_sessions_active
    ON broker_sessions (user_id, broker_type)
    WHERE status = 'active';

-- Sorted by last-used (LRU eviction, session management UI)
CREATE INDEX IF NOT EXISTS idx_broker_sessions_last_used
    ON broker_sessions (user_id, last_used_at DESC)
    WHERE status = 'active';

-- Token expiry cleanup (cron / scheduled job)
CREATE INDEX IF NOT EXISTS idx_broker_sessions_expires
    ON broker_sessions (expires_at)
    WHERE status = 'active' AND expires_at IS NOT NULL;

-- Admin: find all sessions for a user (orphan detection)
CREATE INDEX IF NOT EXISTS idx_broker_sessions_user
    ON broker_sessions (user_id, created_at DESC);

-- ──── 4. Parsed Ledgers (trade records from contract notes) ───────────────
--
-- One row per executed trade extracted from PDFs or CSVs.
-- Appended via the Zero-API trade ledger parser pipeline.
-- Queried for portfolio analytics, tax reports, and cognitive AI.
--
-- Columns:
--   id                  UUID       — primary key
--   user_id             UUID       → users.id
--   broker_session_id   UUID       → broker_sessions.id (nullable)
--   execution_timestamp TIMESTAMPTZ — when the trade was executed
--   asset_symbol        TEXT       — e.g. 'RELIANCE', 'NIFTY50FEBFUT'
--   transaction_type    TEXT       — 'BUY' | 'SELL'
--   filled_quantity     NUMERIC(18,4)
--   execution_price     NUMERIC(18,2)
--   regulatory_fees     NUMERIC(18,2) — STT + brokerage + other charges
--   net_value           NUMERIC(18,2) — filled_qty * execution_price ± fees
--   source              TEXT       — 'zerodha_contract_note' | 'angel_csv' | ...
--   raw_text_hash       TEXT       — SHA-256 of original line (dedup)
--   metadata            JSONB      — flexible bag (trade_id, order_id, ...)
--   created_at          TIMESTAMPTZ
--
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

-- ========================================================================
-- PERFORMANCE INDEXES
-- ========================================================================
--
-- HOT PATH 1: Portfolio P&L — all trades for a user, sorted by time
--   Used by: portfolio screen, P&L chart, analytics engine
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_parsed_ledgers_user_time
    ON parsed_ledgers (user_id, execution_timestamp DESC);

-- ========================================================================
-- HOT PATH 2: Win/Loss analytics — user + type + time range
--   Used by: cognitive analytics, AI summary, tax reports
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_parsed_ledgers_user_type_time
    ON parsed_ledgers (user_id, transaction_type, execution_timestamp DESC);

-- ========================================================================
-- HOT PATH 3: Dedup check — avoid re-importing the same contract note
--   Used by: trade ledger parser pipeline
-- ========================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_parsed_ledgers_raw_hash
    ON parsed_ledgers (raw_text_hash)
    WHERE raw_text_hash IS NOT NULL;

-- ========================================================================
-- HOT PATH 4: Symbol lookup — all trades for a specific asset
--   Used by: stock detail screen, sector concentration analytics
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_parsed_ledgers_user_symbol
    ON parsed_ledgers (user_id, asset_symbol, execution_timestamp DESC);

-- ========================================================================
-- ANALYTICS: Time-bounded queries (daily/monthly aggregate)
--   Used by: monthly returns, yearly breakdowns, tax period filtering
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_parsed_ledgers_exec_time
    ON parsed_ledgers (execution_timestamp DESC)
    INCLUDE (user_id, asset_symbol, transaction_type, filled_quantity, execution_price, net_value);

-- ========================================================================
-- CLEANUP: Expired session purging
--   Used by: periodic maintenance job
--
--   Note: Partial index predicate uses ONLY status = 'active' (not
--   expires_at < now()) because PostgreSQL evaluates partial index
--   predicates at INSERT/UPDATE time, not query time. Using now()
--   in the predicate would only index rows that were expired at the
--   moment of their last UPDATE. The query-level WHERE clause handles
--   the time-based filter efficiently via b-tree range scan.
-- ========================================================================
CREATE INDEX IF NOT EXISTS idx_broker_sessions_cleanup
    ON broker_sessions (expires_at)
    WHERE status = 'active';

-- ──── 5. Table comments (documentation in catalog) ────────────────────────

COMMENT ON TABLE users IS 'Core user identities. Rows: expected 1 per human user.';
COMMENT ON TABLE broker_sessions IS 'Encrypted broker session tokens. Rows: ~1-5 per user.';
COMMENT ON TABLE parsed_ledgers IS 'Executed trades extracted via Zero-API gateway. Rows: 10-10,000 per user.';

COMMENT ON COLUMN users.external_id IS 'Opaque public identifier exposed in API responses.';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash. NULL for OAuth-only accounts.';
COMMENT ON COLUMN users.role IS 'free | pro | elite | admin';
COMMENT ON COLUMN users.kyc_status IS 'pending | verified | rejected';

COMMENT ON COLUMN broker_sessions.encrypted_token IS 'AES-256-GCM encrypted session cookie.';
COMMENT ON COLUMN broker_sessions.encrypted_secret IS 'AES-256-GCM encrypted API secret (nullable).';
COMMENT ON COLUMN broker_sessions.status IS 'active | expired | revoked';

COMMENT ON COLUMN parsed_ledgers.execution_timestamp IS 'Exchange-reported trade time (IST).';
COMMENT ON COLUMN parsed_ledgers.raw_text_hash IS 'SHA-256 of the original line. Used for dedup.';
COMMENT ON COLUMN parsed_ledgers.source IS 'Origin: zerodha_contract_note, angel_csv, manual, etc.';

-- ============================================================================
-- End of migration
-- ============================================================================
