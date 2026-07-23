/**
 * ============================================================================
 * Toroloom PostgreSQL Storage Engine
 * ============================================================================
 *
 * Persists audit events, risk profiles, and broker state to PostgreSQL.
 * Uses the `pg` driver with parameterized queries for safety.
 *
 * ======================== Schema (see migrate()) ===========================
 *
 * audit_events (id TEXT PK, timestamp, user_id, event_type,
 *               data JSONB, metadata JSONB, previous_hash, hash)
 *   idx_audit_user_id    ON user_id
 *   idx_audit_event_type ON event_type
 *   idx_audit_timestamp  ON timestamp DESC
 *
 * risk_profiles (user_id TEXT PK, profile JSONB, updated_at)
 *
 * broker_state (key TEXT PK, value JSONB)
 *
 * notifications (id TEXT PK, user_id TEXT, type TEXT, title TEXT,
 *                message TEXT, read BOOLEAN, timestamp TEXT,
 *                data JSONB, metadata JSONB)
 *   idx_notifications_user_id ON user_id
 *   idx_notifications_timestamp ON timestamp DESC
 *
 * community_posts (id TEXT PK, user_id TEXT, user_name TEXT, user_avatar TEXT,
 *                  content TEXT, likes INTEGER, comments INTEGER,
 *                  timestamp TEXT, tags JSONB)
 *   idx_community_timestamp ON timestamp DESC
 *
 * users (id UUID PK, external_id, email, phone, display_name, password_hash,
 *        role, kyc_status, metadata JSONB, created_at, updated_at)
 *   idx_users_email             ON email (unique, partial)
 *   idx_users_external_id       ON external_id (unique)
 *   idx_users_email_password    ON (email, password_hash) partial
 *   idx_users_created_at        ON created_at DESC
 *
 * broker_sessions (id UUID PK, user_id UUID → users, broker_type,
 *                  encrypted_token, encrypted_secret, status, expires_at,
 *                  last_used_at, created_at, updated_at)
 *   idx_broker_sessions_active   ON (user_id, broker_type) WHERE status='active'
 *   idx_broker_sessions_cleanup  ON expires_at WHERE status='active'
 *
 * parsed_ledgers (id UUID PK, user_id UUID → users, broker_session_id UUID,
 *                 execution_timestamp, asset_symbol, transaction_type,
 *                 filled_quantity, execution_price, regulatory_fees,
 *                 net_value, source, raw_text_hash, metadata JSONB, created_at)
 *   idx_parsed_ledgers_user_time        ON (user_id, execution_timestamp DESC)
 *   idx_parsed_ledgers_user_type_time   ON (user_id, transaction_type, execution_timestamp DESC)
 *   idx_parsed_ledgers_user_symbol      ON (user_id, asset_symbol, execution_timestamp DESC)
 *   idx_parsed_ledgers_exec_time        ON execution_timestamp DESC INCLUDE (...)
 *   idx_parsed_ledgers_raw_hash         ON raw_text_hash (unique, partial)
 *
 * ====================== Auto-migration on connect() ========================
 * Tables and indexes are created via CREATE TABLE/INDEX IF NOT EXISTS
 * every time the app starts. A standalone SQL init script is deliberately
 * NOT used — migrate() is the single source of truth for the schema.
 * ============================================================================
 */

import type { Pool, PoolConfig } from 'pg';
import type { StorageEngine, BrokerStateData, AuditFilter, NotificationData, CommunityPostData, UserSubscriptionData, SnapTradeConnectionData, TelegramLinkData, CouponData, CouponUsageData, WebhookStorageData, WebhookDeliveryLogData, ApiKeyStorageData } from './types';
import type { AuditEvent, AuditTrailSnapshot } from '../auditTrail';
import type { RiskProfile } from '../riskEngine/types';

/**
 * Default pool configuration.
 *
 *   max: 20 concurrent connections
 *   idleTimeoutMillis: 30s before idle client is closed (helps with
 *     AWS RDS proxy timeouts and serverless DB connection draining).
 *   connectionTimeoutMillis: 10s – fail fast rather than hanging
 *     when the database is unreachable.
 *   statementTimeout: 30s – prevent runaway queries from locking
 *     connections indefinitely (safety net for production).
 */
const DEFAULT_POOL_CONFIG: Partial<PoolConfig> = {
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
};

/**
 * Wait for `ms` – used in exponential backoff.
 */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Safely parse a JSONB column value returned by the `pg` driver.
 *
 * In older `pg` versions (<8) JSONB columns are returned as strings;
 * in v8+ they're automatically parsed as objects/arrays. This helper
 * handles both variants transparently.
 *
 * - string → JSON.parse
 * - object/array/null/undefined → returned as-is
 */
function parseJSON<T = any>(value: unknown): T {
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

export class PostgreSQLStorage implements StorageEngine {
  private pool: Pool | null = null;
  private initialized = false;
  private connectAttempts = 0;

  constructor(private connectionString: string) {}

  // ──── Lifecycle ────

  /**
   * Connect to PostgreSQL with exponential backoff retry.
   *
   * Retry schedule:
   *   attempt 1 → 500 ms
   *   attempt 2 → 1 000 ms
   *   attempt 3 → 2 000 ms
   *   attempt 4 → 4 000 ms
   *   attempt 5 → 8 000 ms (cap)
   *   ...        8 000 ms until success
   */
  async connect(): Promise<void> {
    const { Pool } = await import('pg');

    this.pool = new Pool({
      connectionString: this.connectionString,
      ...DEFAULT_POOL_CONFIG,
    });

    // Register an error handler to avoid crashing on idle client errors
    this.pool.on('error', (err) => {
      console.error('[PostgreSQL] Unexpected pool error:', err.message);
    });

    // Retry loop with exponential backoff (max 5 attempts ≈ ~9s total wait)
    const MAX_ATTEMPTS = 5;
    const MAX_BACKOFF_MS = 8_000;
    while (this.connectAttempts < MAX_ATTEMPTS) {
      this.connectAttempts++;
      try {
        // Verify the connection works
        const client = await this.pool.connect();
        client.release();

        await this.migrate();
        this.initialized = true;
        return;
      } catch (err: any) {
        const backoff = Math.min(500 * Math.pow(2, this.connectAttempts - 1), MAX_BACKOFF_MS);
        console.error(
          `[PostgreSQL] Connection attempt ${this.connectAttempts}/${MAX_ATTEMPTS} failed: ${err.message}. ` +
          `Retrying in ${backoff}ms...`,
        );
        await sleep(backoff);
      }
    }

    throw new Error(
      `PostgreSQL connection failed after ${MAX_ATTEMPTS} attempts. ` +
      `Check that the database is running and DATABASE_URL is correct.`,
    );
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.pool || !this.initialized) return false;
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async migrate(): Promise<void> {
    if (!this.pool) throw new Error('Not connected');

    await this.pool.query(`
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
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS risk_profiles (
        user_id TEXT PRIMARY KEY,
        profile JSONB NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS broker_state (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS badge_counts (
        user_id TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0
      );
    `);

    await this.pool.query(`
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
    `);

    await this.pool.query(`
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
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS telegram_links (
        user_id TEXT PRIMARY KEY,
        chat_id BIGINT NOT NULL,
        first_name TEXT NOT NULL,
        username TEXT,
        linked_at TEXT NOT NULL
      );
    `);

    await this.pool.query(`
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
    `);

    await this.pool.query(`
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
    `);

    await this.pool.query(`
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
    `);

    await this.pool.query(`
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
        razorpay_payment_id TEXT,
        razorpay_subscription_id TEXT,
        last_payment_date TEXT,
        tenant_id TEXT,
        mandate_id TEXT,
        mandate_status TEXT,
        upi_id TEXT,
        is_auto_pay_enabled BOOLEAN NOT NULL DEFAULT false,
        next_charge_date TEXT,
        payment_failure_count INTEGER NOT NULL DEFAULT 0,
        grace_period_end_date TEXT,
        last_payment_failure_date TEXT,
        last_payment_retry_date TEXT,
        failed_payment_retry_count INTEGER NOT NULL DEFAULT 0,
        is_trial_used BOOLEAN NOT NULL DEFAULT false,
        trial_start_date TEXT,
        trial_end_date TEXT
      );
    `);

    // ── API keys table ──
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        scopes JSONB NOT NULL DEFAULT '[]',
        expires_at TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_used_at TEXT,
        ip_restrict TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
    `);

    // ── Webhook storage tables ──
    await this.pool.query(`
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
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
        id TEXT PRIMARY KEY,
        webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
        event TEXT NOT NULL,
        status_code INTEGER NOT NULL DEFAULT 0,
        success BOOLEAN NOT NULL DEFAULT false,
        duration INTEGER NOT NULL DEFAULT 0,
        response_body TEXT NOT NULL DEFAULT '',
        error_message TEXT,
        timestamp TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_delivery_logs (webhook_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_timestamp ON webhook_delivery_logs (timestamp DESC);
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id TEXT PRIMARY KEY,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // ──── Scalability Core Tables ───────────────────────────────────
    // users, broker_sessions, parsed_ledgers
    // Full reference: migrations/init_scalability_core.sql

    await this.pool.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
    `);

    await this.pool.query(`
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
      -- Cleanup index: covers both (expires_at < now()) range scans
      -- AND (expires_at IS NOT NULL) filters — no separate index needed.
      CREATE INDEX IF NOT EXISTS idx_broker_sessions_cleanup
          ON broker_sessions (expires_at)
          WHERE status = 'active';
    `);

    await this.pool.query(`
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
    `);
  }

  // ──── Audit Trail ────

  async appendEvent(event: AuditEvent): Promise<AuditEvent> {
    if (!this.pool) throw new Error('Not connected');

    await this.pool.query(
      `INSERT INTO audit_events (id, timestamp, user_id, event_type, data, metadata, previous_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.id,
        event.timestamp,
        event.userId,
        event.eventType,
        JSON.stringify(event.data),
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.previousHash,
        event.hash,
      ],
    );
    return event;
  }

  async getLatestEvent(): Promise<AuditEvent | null> {
    if (!this.pool) return null;

    const result = await this.pool.query(
      'SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT 1',
    );
    return result.rows.length > 0 ? this.rowToEvent(result.rows[0]) : null;
  }

  async getEventCount(): Promise<number> {
    if (!this.pool) return 0;
    const result = await this.pool.query('SELECT COUNT(*) as count FROM audit_events');
    return parseInt(result.rows[0].count, 10);
  }

  async queryEvents(filter: AuditFilter): Promise<AuditEvent[]> {
    if (!this.pool) return [];

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (filter.userId) {
      conditions.push(`user_id = $${paramIdx++}`);
      params.push(filter.userId);
    }
    if (filter.eventType) {
      const types = Array.isArray(filter.eventType) ? filter.eventType : [filter.eventType];
      conditions.push(`event_type = ANY($${paramIdx++}::text[])`);
      params.push(types);
    }
    if (filter.startTime) {
      conditions.push(`timestamp >= $${paramIdx++}`);
      params.push(filter.startTime);
    }
    if (filter.endTime) {
      conditions.push(`timestamp <= $${paramIdx++}`);
      params.push(filter.endTime);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ? `LIMIT ${filter.limit}` : '';
    const offset = filter.offset ? `OFFSET ${filter.offset}` : '';

    const query = `SELECT * FROM audit_events ${where} ORDER BY timestamp DESC ${limit} ${offset}`;
    const result = await this.pool.query(query, params);
    return result.rows.map((r: any) => this.rowToEvent(r));
  }

  async getEvent(id: string): Promise<AuditEvent | null> {
    if (!this.pool) return null;
    const result = await this.pool.query('SELECT * FROM audit_events WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToEvent(result.rows[0]) : null;
  }

  async getAllEvents(): Promise<AuditEvent[]> {
    if (!this.pool) return [];
    const result = await this.pool.query('SELECT * FROM audit_events ORDER BY timestamp ASC');
    return result.rows.map((r: any) => this.rowToEvent(r));
  }

  async clearForTesting(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM parsed_ledgers');
    await this.pool.query('DELETE FROM broker_sessions');
    await this.pool.query('DELETE FROM users');
    await this.pool.query('DELETE FROM audit_events');
    await this.pool.query('DELETE FROM risk_profiles');
    await this.pool.query('DELETE FROM broker_state');
    await this.pool.query('DELETE FROM notifications');
    await this.pool.query('DELETE FROM badge_counts');
    await this.pool.query('DELETE FROM community_posts');
    await this.pool.query('DELETE FROM telegram_links');
    await this.pool.query('DELETE FROM subscriptions');
    await this.pool.query('DELETE FROM api_keys');
    await this.pool.query('DELETE FROM coupon_usage');
    await this.pool.query('DELETE FROM coupons');
  }

  private rowToEvent(row: any): AuditEvent {
    return {
      id: row.id,
      timestamp: row.timestamp,
      userId: row.user_id,
      eventType: row.event_type,
      data: parseJSON(row.data),
      metadata: row.metadata ? parseJSON(row.metadata) : undefined,
      previousHash: row.previous_hash,
      hash: row.hash,
    };
  }

  // ──── Risk Profiles ────

  async loadRiskProfile(userId: string): Promise<RiskProfile | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      'SELECT profile FROM risk_profiles WHERE user_id = $1',
      [userId],
    );
    if (result.rows.length === 0) return null;
    return parseJSON<RiskProfile>(result.rows[0].profile);
  }

  async saveRiskProfile(profile: RiskProfile): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO risk_profiles (user_id, profile, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET profile = EXCLUDED.profile, updated_at = EXCLUDED.updated_at`,
      [profile.userId, JSON.stringify(profile), profile.updatedAt],
    );
  }

  async deleteRiskProfile(userId: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM risk_profiles WHERE user_id = $1', [userId]);
  }

  // ──── Broker State ────

  async loadBrokerState(): Promise<BrokerStateData> {
    const defaultState: BrokerStateData = {
      currentBrokerType: null,
      dedupCache: {},
    };
    if (!this.pool) return defaultState;

    const result = await this.pool.query(
      "SELECT value FROM broker_state WHERE key = 'broker_state'",
    );
    if (result.rows.length === 0) return defaultState;
    return parseJSON<BrokerStateData>(result.rows[0].value);
  }

  async saveBrokerState(state: BrokerStateData): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO broker_state (key, value) VALUES ('broker_state', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(state)],
    );
  }

  // ──── Badge Counts ────

  async loadBadgeCount(userId: string): Promise<number> {
    if (!this.pool) return 0;
    const result = await this.pool.query(
      'SELECT count FROM badge_counts WHERE user_id = $1',
      [userId],
    );
    if (result.rows.length === 0) return 0;
    return parseInt(result.rows[0].count, 10);
  }

  async saveBadgeCount(userId: string, count: number): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO badge_counts (user_id, count) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET count = EXCLUDED.count`,
      [userId, count],
    );
  }

  // ──── Notifications ────

  async saveNotification(notification: NotificationData): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO notifications (id, user_id, type, title, message, read, timestamp, data, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         type = EXCLUDED.type,
         title = EXCLUDED.title,
         message = EXCLUDED.message,
         read = EXCLUDED.read,
         timestamp = EXCLUDED.timestamp,
         data = EXCLUDED.data,
         metadata = EXCLUDED.metadata`,
      [
        notification.id,
        notification.userId,
        notification.type,
        notification.title,
        notification.message,
        notification.read,
        notification.timestamp,
        JSON.stringify(notification.data || {}),
        notification.metadata ? JSON.stringify(notification.metadata) : null,
      ],
    );
  }

  async loadNotifications(userId: string): Promise<NotificationData[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY timestamp DESC',
      [userId],
    );
    return result.rows.map(this.rowToNotification.bind(this));
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      'UPDATE notifications SET read = true WHERE id = $1',
      [notificationId],
    );
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      'UPDATE notifications SET read = true WHERE user_id = $1',
      [userId],
    );
  }

  async deleteNotification(notificationId: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM notifications WHERE id = $1', [notificationId]);
  }

  private rowToNotification(row: any): NotificationData {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      read: row.read,
      timestamp: row.timestamp,
      data: row.data ? parseJSON(row.data) : undefined,
      metadata: row.metadata ? parseJSON(row.metadata) : undefined,
    };
  }

  // ──── Telegram Links ────

  async loadTelegramLink(userId: string): Promise<TelegramLinkData | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      'SELECT * FROM telegram_links WHERE user_id = $1',
      [userId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      userId: row.user_id,
      chatId: parseInt(row.chat_id, 10),
      firstName: row.first_name,
      username: row.username || undefined,
      linkedAt: row.linked_at,
    };
  }

  async saveTelegramLink(userId: string, link: TelegramLinkData): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO telegram_links (user_id, chat_id, first_name, username, linked_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         chat_id = EXCLUDED.chat_id,
         first_name = EXCLUDED.first_name,
         username = EXCLUDED.username,
         linked_at = EXCLUDED.linked_at`,
      [link.userId, link.chatId, link.firstName, link.username || null, link.linkedAt],
    );
  }

  async deleteTelegramLink(userId: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM telegram_links WHERE user_id = $1', [userId]);
  }

  async loadAllTelegramLinks(): Promise<TelegramLinkData[]> {
    if (!this.pool) return [];
    const result = await this.pool.query('SELECT * FROM telegram_links');
    return result.rows.map((row: any) => ({
      userId: row.user_id,
      chatId: parseInt(row.chat_id, 10),
      firstName: row.first_name,
      username: row.username || undefined,
      linkedAt: row.linked_at,
    }));
  }

  // ──── SnapTrade Connections ────

  async loadSnapTradeConnection(userId: string): Promise<SnapTradeConnectionData | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      'SELECT * FROM snap_trade_connections WHERE user_id = $1',
      [userId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      snapTradeUserId: row.snap_trade_user_id,
      encryptedUserSecret: row.encrypted_user_secret,
      authorizationId: row.authorization_id,
      accountId: row.account_id,
      brokerName: row.broker_name,
      brokerSlug: row.broker_slug,
      accountName: row.account_name,
      connectedAt: row.connected_at,
    };
  }

  async saveSnapTradeConnection(userId: string, connection: SnapTradeConnectionData): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO snap_trade_connections (user_id, snap_trade_user_id, encrypted_user_secret, authorization_id, account_id, broker_name, broker_slug, account_name, connected_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (user_id) DO UPDATE SET
         snap_trade_user_id = EXCLUDED.snap_trade_user_id,
         encrypted_user_secret = EXCLUDED.encrypted_user_secret,
         authorization_id = EXCLUDED.authorization_id,
         account_id = EXCLUDED.account_id,
         broker_name = EXCLUDED.broker_name,
         broker_slug = EXCLUDED.broker_slug,
         account_name = EXCLUDED.account_name,
         connected_at = EXCLUDED.connected_at,
         updated_at = now()`,
      [
        userId,
        connection.snapTradeUserId,
        connection.encryptedUserSecret,
        connection.authorizationId,
        connection.accountId,
        connection.brokerName,
        connection.brokerSlug,
        connection.accountName,
        connection.connectedAt,
      ],
    );
  }

  async deleteSnapTradeConnection(userId: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      'DELETE FROM snap_trade_connections WHERE user_id = $1',
      [userId],
    );
  }

  // ──── Subscriptions ────

  async loadSubscription(userId: string): Promise<UserSubscriptionData | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [userId],
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      userId: r.user_id,
      tier: r.tier,
      planId: r.plan_id,
      status: r.status,
      startDate: r.start_date,
      endDate: r.end_date,
      autoRenew: r.auto_renew,
      paymentMethod: r.payment_method || undefined,
      razorpayOrderId: r.razorpay_order_id || undefined,
      razorpayPaymentId: r.razorpay_payment_id || undefined,
      razorpaySubscriptionId: r.razorpay_subscription_id || undefined,
      lastPaymentDate: r.last_payment_date || undefined,
      tenantId: r.tenant_id || undefined,
      mandateId: r.mandate_id || undefined,
      mandateStatus: r.mandate_status || undefined,
      upiId: r.upi_id || undefined,
      isAutoPayEnabled: r.is_auto_pay_enabled || undefined,
      nextChargeDate: r.next_charge_date || undefined,
      paymentFailureCount: r.payment_failure_count || undefined,
      gracePeriodEndDate: r.grace_period_end_date || undefined,
      lastPaymentFailureDate: r.last_payment_failure_date || undefined,
      lastPaymentRetryDate: r.last_payment_retry_date || undefined,
      failedPaymentRetryCount: r.failed_payment_retry_count || undefined,
      isTrialUsed: r.is_trial_used || undefined,
      trialStartDate: r.trial_start_date || undefined,
      trialEndDate: r.trial_end_date || undefined,
      updatedAt: r.updated_at,
    };
  }

  async loadAllSubscriptions(): Promise<UserSubscriptionData[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM subscriptions ORDER BY updated_at DESC'
    );
    return result.rows.map((r: any) => ({
      userId: r.user_id,
      tier: r.tier,
      planId: r.plan_id,
      status: r.status,
      startDate: r.start_date,
      endDate: r.end_date,
      autoRenew: r.auto_renew,
      paymentMethod: r.payment_method || undefined,
      razorpayOrderId: r.razorpay_order_id || undefined,
      razorpayPaymentId: r.razorpay_payment_id || undefined,
      razorpaySubscriptionId: r.razorpay_subscription_id || undefined,
      lastPaymentDate: r.last_payment_date || undefined,
      tenantId: r.tenant_id || undefined,
      mandateId: r.mandate_id || undefined,
      mandateStatus: r.mandate_status || undefined,
      upiId: r.upi_id || undefined,
      isAutoPayEnabled: r.is_auto_pay_enabled || undefined,
      nextChargeDate: r.next_charge_date || undefined,
      paymentFailureCount: r.payment_failure_count || undefined,
      gracePeriodEndDate: r.grace_period_end_date || undefined,
      lastPaymentFailureDate: r.last_payment_failure_date || undefined,
      lastPaymentRetryDate: r.last_payment_retry_date || undefined,
      failedPaymentRetryCount: r.failed_payment_retry_count || undefined,
      isTrialUsed: r.is_trial_used || undefined,
      trialStartDate: r.trial_start_date || undefined,
      trialEndDate: r.trial_end_date || undefined,
      updatedAt: r.updated_at,
    }));
  }

  async saveSubscription(userId: string, sub: UserSubscriptionData): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO subscriptions (
         user_id, tier, plan_id, status, start_date, end_date, auto_renew,
         payment_method, razorpay_order_id, razorpay_payment_id, razorpay_subscription_id,
         last_payment_date, tenant_id,
         mandate_id, mandate_status, upi_id, is_auto_pay_enabled, next_charge_date,
         payment_failure_count, grace_period_end_date, last_payment_failure_date,
         last_payment_retry_date, failed_payment_retry_count,
         is_trial_used, trial_start_date, trial_end_date, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
       ON CONFLICT (user_id) DO UPDATE SET
         tier = EXCLUDED.tier,
         plan_id = EXCLUDED.plan_id,
         status = EXCLUDED.status,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         auto_renew = EXCLUDED.auto_renew,
         payment_method = EXCLUDED.payment_method,
         razorpay_order_id = EXCLUDED.razorpay_order_id,
         razorpay_payment_id = EXCLUDED.razorpay_payment_id,
         razorpay_subscription_id = EXCLUDED.razorpay_subscription_id,
         last_payment_date = EXCLUDED.last_payment_date,
         tenant_id = EXCLUDED.tenant_id,
         mandate_id = EXCLUDED.mandate_id,
         mandate_status = EXCLUDED.mandate_status,
         upi_id = EXCLUDED.upi_id,
         is_auto_pay_enabled = EXCLUDED.is_auto_pay_enabled,
         next_charge_date = EXCLUDED.next_charge_date,
         payment_failure_count = EXCLUDED.payment_failure_count,
         grace_period_end_date = EXCLUDED.grace_period_end_date,
         last_payment_failure_date = EXCLUDED.last_payment_failure_date,
         last_payment_retry_date = EXCLUDED.last_payment_retry_date,
         failed_payment_retry_count = EXCLUDED.failed_payment_retry_count,
         is_trial_used = EXCLUDED.is_trial_used,
         trial_start_date = EXCLUDED.trial_start_date,
         trial_end_date = EXCLUDED.trial_end_date,
         updated_at = EXCLUDED.updated_at`,
      [
        userId,
        sub.tier,
        sub.planId,
        sub.status,
        sub.startDate,
        sub.endDate,
        sub.autoRenew,
        sub.paymentMethod || null,
        sub.razorpayOrderId || null,
        sub.razorpayPaymentId || null,
        sub.razorpaySubscriptionId || null,
        sub.lastPaymentDate || null,
        sub.tenantId || null,
        sub.mandateId || null,
        sub.mandateStatus || null,
        sub.upiId || null,
        sub.isAutoPayEnabled ?? false,
        sub.nextChargeDate || null,
        sub.paymentFailureCount ?? 0,
        sub.gracePeriodEndDate || null,
        sub.lastPaymentFailureDate || null,
        sub.lastPaymentRetryDate || null,
        sub.failedPaymentRetryCount ?? 0,
        sub.isTrialUsed ?? false,
        sub.trialStartDate || null,
        sub.trialEndDate || null,
        sub.updatedAt,
      ],
    );
  }

  // ──── Community ────

  async saveCommunityPost(post: CommunityPostData): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO community_posts (id, user_id, user_name, user_avatar, content, likes, comments, timestamp, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content,
         likes = EXCLUDED.likes,
         comments = EXCLUDED.comments,
         tags = EXCLUDED.tags`,
      [
        post.id,
        post.userId,
        post.userName,
        post.userAvatar || null,
        post.content,
        post.likes,
        post.comments,
        post.timestamp,
        JSON.stringify(post.tags),
      ],
    );
  }

  async loadCommunityPosts(): Promise<CommunityPostData[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM community_posts ORDER BY timestamp DESC',
    );
    return result.rows.map(this.rowToCommunityPost.bind(this));
  }

  async loadCommunityPost(id: string): Promise<CommunityPostData | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      'SELECT * FROM community_posts WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.rowToCommunityPost(result.rows[0]);
  }

  async likeCommunityPost(postId: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      'UPDATE community_posts SET likes = likes + 1 WHERE id = $1',
      [postId],
    );
  }

  async deleteCommunityPost(postId: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM community_posts WHERE id = $1', [postId]);
  }

  private rowToCommunityPost(row: any): CommunityPostData {
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userAvatar: row.user_avatar || undefined,
      content: row.content,
      likes: row.likes,
      comments: row.comments,
      timestamp: row.timestamp,
      tags: row.tags ? parseJSON<string[]>(row.tags) : [],
    };
  }

  // ──── API Keys ────

  async saveApiKey(key: ApiKeyStorageData): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, scopes, expires_at, is_active, last_used_at, ip_restrict, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         scopes = EXCLUDED.scopes,
         is_active = EXCLUDED.is_active,
         last_used_at = EXCLUDED.last_used_at,
         ip_restrict = EXCLUDED.ip_restrict,
         updated_at = EXCLUDED.updated_at`,
      [key.id, key.userId, key.name, key.keyPrefix, key.keyHash, JSON.stringify(key.scopes), key.expiresAt, key.isActive, key.lastUsedAt, key.ipRestrict, key.createdAt, key.updatedAt],
    );
  }

  async loadApiKeyByHash(hash: string): Promise<ApiKeyStorageData | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      'SELECT * FROM api_keys WHERE key_hash = $1',
      [hash],
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      name: r.name,
      keyPrefix: r.key_prefix,
      keyHash: r.key_hash,
      scopes: parseJSON<string[]>(r.scopes),
      expiresAt: r.expires_at || null,
      isActive: r.is_active,
      lastUsedAt: r.last_used_at || null,
      ipRestrict: r.ip_restrict || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async loadUserApiKeys(userId: string): Promise<ApiKeyStorageData[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      keyPrefix: r.key_prefix,
      keyHash: r.key_hash,
      scopes: parseJSON<string[]>(r.scopes),
      expiresAt: r.expires_at || null,
      isActive: r.is_active,
      lastUsedAt: r.last_used_at || null,
      ipRestrict: r.ip_restrict || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async loadApiKey(id: string): Promise<ApiKeyStorageData | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      'SELECT * FROM api_keys WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      name: r.name,
      keyPrefix: r.key_prefix,
      keyHash: r.key_hash,
      scopes: parseJSON<string[]>(r.scopes),
      expiresAt: r.expires_at || null,
      isActive: r.is_active,
      lastUsedAt: r.last_used_at || null,
      ipRestrict: r.ip_restrict || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async deleteApiKey(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM api_keys WHERE id = $1', [id]);
  }

  async touchApiKey(id: string): Promise<void> {
    if (!this.pool) return;
    const now = new Date().toISOString();
    await this.pool.query(
      'UPDATE api_keys SET last_used_at = $1, updated_at = $2 WHERE id = $3',
      [now, now, id],
    );
  }

  // ──── Coupons ────

  async loadCoupon(code: string): Promise<CouponData | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      'SELECT * FROM coupons WHERE code = $1',
      [code.toUpperCase()],
    );
    if (result.rows.length === 0) return null;
    return this.rowToCoupon(result.rows[0]);
  }

  async saveCoupon(coupon: CouponData): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO coupons (code, type, value, trial_days, min_plan_tier, max_uses, current_uses, expires_at, is_active, description, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (code) DO UPDATE SET
         type = EXCLUDED.type,
         value = EXCLUDED.value,
         trial_days = EXCLUDED.trial_days,
         min_plan_tier = EXCLUDED.min_plan_tier,
         max_uses = EXCLUDED.max_uses,
         current_uses = EXCLUDED.current_uses,
         expires_at = EXCLUDED.expires_at,
         is_active = EXCLUDED.is_active,
         description = EXCLUDED.description,
         created_by = EXCLUDED.created_by,
         updated_at = EXCLUDED.updated_at`,
      [
        coupon.code.toUpperCase(),
        coupon.type,
        coupon.value,
        coupon.trialDays || null,
        coupon.minPlanTier || null,
        coupon.maxUses,
        coupon.currentUses,
        coupon.expiresAt,
        coupon.isActive,
        coupon.description,
        coupon.createdBy || null,
        coupon.createdAt,
        coupon.updatedAt,
      ],
    );
  }

  async deleteCoupon(code: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM coupon_usage WHERE code = $1', [code.toUpperCase()]);
    await this.pool.query('DELETE FROM coupons WHERE code = $1', [code.toUpperCase()]);
  }

  async loadAllCoupons(): Promise<CouponData[]> {
    if (!this.pool) return [];
    const result = await this.pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
    return result.rows.map((r: any) => this.rowToCoupon(r));
  }

  async incrementCouponUsage(code: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      'UPDATE coupons SET current_uses = current_uses + 1, updated_at = $2 WHERE code = $1',
      [code.toUpperCase(), new Date().toISOString()],
    );
  }

  async recordCouponUsage(usage: CouponUsageData): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO coupon_usage (id, code, user_id, plan_id, discount_amount, original_price, final_price, used_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [usage.id, usage.code.toUpperCase(), usage.userId, usage.planId, usage.discountAmount, usage.originalPrice, usage.finalPrice, usage.usedAt],
    );
  }

  async hasUserUsedCoupon(code: string, userId: string): Promise<boolean> {
    if (!this.pool) return false;
    const result = await this.pool.query(
      'SELECT 1 FROM coupon_usage WHERE code = $1 AND user_id = $2 LIMIT 1',
      [code.toUpperCase(), userId],
    );
    return result.rows.length > 0;
  }

  async loadUserCouponUsages(userId: string): Promise<CouponUsageData[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM coupon_usage WHERE user_id = $1 ORDER BY used_at DESC',
      [userId],
    );
    return result.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      userId: r.user_id,
      planId: r.plan_id,
      discountAmount: r.discount_amount,
      originalPrice: r.original_price,
      finalPrice: r.final_price,
      usedAt: r.used_at,
    }));
  }

  async loadAllCouponUsages(): Promise<CouponUsageData[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM coupon_usage ORDER BY used_at DESC',
    );
    return result.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      userId: r.user_id,
      planId: r.plan_id,
      discountAmount: r.discount_amount,
      originalPrice: r.original_price,
      finalPrice: r.final_price,
      usedAt: r.used_at,
    }));
  }

  private rowToCoupon(row: any): CouponData {
    return {
      code: row.code,
      type: row.type,
      value: row.value,
      trialDays: row.trial_days || undefined,
      minPlanTier: row.min_plan_tier || undefined,
      maxUses: row.max_uses,
      currentUses: row.current_uses,
      expiresAt: row.expires_at,
      isActive: row.is_active,
      description: row.description,
      createdBy: row.created_by || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ──── Webhook Storage ────

  async saveWebhook(webhook: WebhookStorageData): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO webhooks (id, user_id, name, url, secret, events, is_active, last_triggered_at, delivery_count, success_count, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         url = EXCLUDED.url,
         events = EXCLUDED.events,
         is_active = EXCLUDED.is_active,
         last_triggered_at = EXCLUDED.last_triggered_at,
         delivery_count = EXCLUDED.delivery_count,
         success_count = EXCLUDED.success_count,
         description = EXCLUDED.description,
         updated_at = EXCLUDED.updated_at`,
      [
        webhook.id, webhook.userId, webhook.name, webhook.url, webhook.secret,
        JSON.stringify(webhook.events), webhook.isActive,
        webhook.lastTriggeredAt, webhook.deliveryCount, webhook.successCount,
        webhook.description, webhook.createdAt, webhook.updatedAt,
      ],
    );
  }

  async loadWebhook(id: string): Promise<WebhookStorageData | null> {
    if (!this.pool) return null;
    const result = await this.pool.query('SELECT * FROM webhooks WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToWebhook(result.rows[0]);
  }

  async loadUserWebhooks(userId: string): Promise<WebhookStorageData[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows.map((r: any) => this.rowToWebhook(r));
  }

  async loadActiveWebhooksByEvent(event: string): Promise<WebhookStorageData[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM webhooks WHERE is_active = true AND events::jsonb @> $1::jsonb',
      [JSON.stringify([event])],
    );
    return result.rows.map((r: any) => this.rowToWebhook(r));
  }

  async deleteWebhook(id: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM webhook_delivery_logs WHERE webhook_id = $1', [id]);
    await this.pool.query('DELETE FROM webhooks WHERE id = $1', [id]);
  }

  async saveWebhookDeliveryLog(log: WebhookDeliveryLogData): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO webhook_delivery_logs (id, webhook_id, event, status_code, success, duration, response_body, error_message, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [log.id, log.webhookId, log.event, log.statusCode, log.success, log.duration, log.responseBody, log.errorMessage, log.timestamp],
    );
  }

  async loadWebhookDeliveryLogs(webhookId: string, limit?: number): Promise<WebhookDeliveryLogData[]> {
    if (!this.pool) return [];
    const query = limit
      ? 'SELECT * FROM webhook_delivery_logs WHERE webhook_id = $1 ORDER BY timestamp DESC LIMIT $2'
      : 'SELECT * FROM webhook_delivery_logs WHERE webhook_id = $1 ORDER BY timestamp DESC';
    const params = limit ? [webhookId, limit] : [webhookId];
    const result = await this.pool.query(query, params);
    return result.rows.map((r: any) => ({
      id: r.id,
      webhookId: r.webhook_id,
      event: r.event,
      statusCode: r.status_code,
      success: r.success,
      duration: r.duration,
      responseBody: r.response_body,
      errorMessage: r.error_message,
      timestamp: r.timestamp,
    }));
  }

  private rowToWebhook(row: any): WebhookStorageData {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      url: row.url,
      secret: row.secret,
      events: parseJSON<string[]>(row.events),
      isActive: row.is_active,
      lastTriggeredAt: row.last_triggered_at,
      deliveryCount: row.delivery_count,
      successCount: row.success_count,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ──── Idempotency ────

  async markEventProcessed(eventId: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      'INSERT INTO processed_events (event_id) VALUES ($1) ON CONFLICT (event_id) DO NOTHING',
      [eventId],
    );
  }

  async isEventProcessed(eventId: string): Promise<boolean> {
    if (!this.pool) return false;
    const result = await this.pool.query(
      'SELECT 1 FROM processed_events WHERE event_id = $1',
      [eventId],
    );
    return result.rows.length > 0;
  }
}
