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
 * ====================== Auto-migration on connect() ========================
 * Tables and indexes are created via CREATE TABLE/INDEX IF NOT EXISTS
 * every time the app starts. A standalone SQL init script is deliberately
 * NOT used — migrate() is the single source of truth for the schema.
 * ============================================================================
 */

import type { Pool, PoolClient, PoolConfig } from 'pg';
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
  }

  private async getClient(): Promise<PoolClient> {
    if (!this.pool) throw new Error('PostgreSQL not connected');
    return this.pool.connect();
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
    await this.pool.query('DELETE FROM audit_events');
    await this.pool.query('DELETE FROM risk_profiles');
    await this.pool.query('DELETE FROM broker_state');
    await this.pool.query('DELETE FROM notifications');
    await this.pool.query('DELETE FROM community_posts');
  }

  private rowToEvent(row: any): AuditEvent {
    return {
      id: row.id,
      timestamp: row.timestamp,
      userId: row.user_id,
      eventType: row.event_type,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      metadata: row.metadata
        ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata)
        : undefined,
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
    const profile = result.rows[0].profile;
    return typeof profile === 'string' ? JSON.parse(profile) : profile;
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
    const value = result.rows[0].value;
    return typeof value === 'string' ? JSON.parse(value) : value;
  }

  async saveBrokerState(state: BrokerStateData): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO broker_state (key, value) VALUES ('broker_state', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(state)],
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
      data: row.data ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : undefined,
      metadata: row.metadata
        ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata)
        : undefined,
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
      tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : [],
    };
  }
}
