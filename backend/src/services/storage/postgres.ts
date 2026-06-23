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
import type { StorageEngine, BrokerStateData, AuditFilter, NotificationData, CommunityPostData } from './types';
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
}
