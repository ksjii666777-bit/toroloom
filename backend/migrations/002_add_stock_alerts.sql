-- ============================================================================
-- Toroloom — Migration 002: Stock Price Alerts
-- ============================================================================
--
-- Adds a user-defined stock price alert table. Users can set alerts for
-- specific stocks at target prices with direction (above/below), and the
-- backend checks them periodically and sends push notifications when
-- targets are hit.
--
-- This migration demonstrates how to add a new table + indexes + comments
-- as a new numbered SQL file. After adding this file, run:
--
--   cd backend && npm run migrate:up
--
-- ============================================================================

-- ──── 1. Stock Price Alerts ──────────────────────────────────────────────
--
-- One row per user-set alert. The backend poller checks active alerts
-- against the latest market price and fires a notification when the
-- target is crossed.
--
-- Columns:
--   id              UUID        — primary key
--   user_id         UUID        → users.id (who set the alert)
--   symbol          TEXT        — e.g. 'RELIANCE', 'TCS', 'NIFTY50'
--   target_price    NUMERIC(18,2) — price threshold
--   direction       TEXT        — 'above' | 'below' (trigger direction)
--   status          TEXT        — 'active' | 'triggered' | 'cancelled'
--   triggered_at    TIMESTAMPTZ — when the alert fired (null if not yet)
--   triggered_price NUMERIC(18,2) — actual price when triggered
--   note            TEXT        — user note (max 200 chars)
--   created_at      TIMESTAMPTZ
--   updated_at      TIMESTAMPTZ
--
CREATE TABLE IF NOT EXISTS stock_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol          TEXT NOT NULL,
  target_price    NUMERIC(18,2) NOT NULL CHECK (target_price > 0),
  direction       TEXT NOT NULL CHECK (direction IN ('above', 'below')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'cancelled')),
  triggered_at    TIMESTAMPTZ,
  triggered_price NUMERIC(18,2) CHECK (triggered_price IS NULL OR triggered_price > 0),
  note            TEXT CHECK (note IS NULL OR char_length(note) <= 200),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HOT PATH: Active alerts for a specific user (alerts list screen)
CREATE INDEX IF NOT EXISTS idx_stock_alerts_user_active
    ON stock_alerts (user_id, created_at DESC)
    WHERE status = 'active';

-- HOT PATH: All active alerts grouped by symbol (poller checks market price
--            once per symbol, not once per alert)
-- Used by: backend price alert poller job
CREATE INDEX IF NOT EXISTS idx_stock_alerts_symbol_active
    ON stock_alerts (symbol)
    WHERE status = 'active';

-- Periodic cleanup: find triggered/cancelled alerts older than 90 days
CREATE INDEX IF NOT EXISTS idx_stock_alerts_cleanup
    ON stock_alerts (updated_at)
    WHERE status IN ('triggered', 'cancelled');

-- ──── 2. Table & Column Documentation ────────────────────────────────────

COMMENT ON TABLE stock_alerts IS 'User-defined stock price alerts. Polled by backend cron to detect target hits and send push notifications.';

COMMENT ON COLUMN stock_alerts.direction IS 'above = alert fires when price rises above target; below = fires when price falls below target';
COMMENT ON COLUMN stock_alerts.status IS 'active = monitoring; triggered = target hit, notification sent; cancelled = user dismissed';
COMMENT ON COLUMN stock_alerts.triggered_price IS 'Market price at the moment the alert was triggered (snapshot for audit)';
COMMENT ON COLUMN stock_alerts.note IS 'Optional user note shown in notification (max 200 chars)';
