/**
 * ============================================================================
 * Toroloom Audit Trail — Immutable, Append-Only Event Log
 * ============================================================================
 *
 * Every order lifecycle event, state transition, and system action is
 * recorded here as an immutable, append-only log entry.
 *
 * Properties:
 *   - Append-only: Once written, events can NEVER be modified or deleted.
 *   - Cryptographically linked: Each event carries a `previousHash` to
 *     form a tamper-evident chain (SHA-256 of previous event).
 *   - Timestamped: All events have ISO-8601 timestamps.
 *   - Queryable: Filter by userId, eventType, or time range.
 *   - Pluggable storage: Delegates persistence to a StorageEngine.
 *     In-memory by default; swap in PostgreSQL or MongoDB in production.
 *
 * Usage:
 *   const event = await auditTrail.append({ ... });
 *   const events = await auditTrail.getEvents({ userId: 'user_1', limit: 50 });
 * ============================================================================
 */

import { randomUUID, createHash } from 'crypto';
import { InMemoryStorage } from '../storage/inMemory';
import type { StorageEngine, AuditFilter, AuditAppendParams } from '../storage/types';

// ==================== Types ====================

export type AuditEventType =
  | 'ORDER_EXECUTION'
  | 'ORDER_REJECTED'
  | 'ORDER_VALIDATED'
  | 'LOCKDOWN_TRIGGERED'
  | 'LOCKDOWN_RELEASED'
  | 'LOCKDOWN_EXIT_ALLOWED'
  | 'RISK_SETTINGS_CHANGED'
  | 'RISK_SETTINGS_BLOCKED'
  | 'BROKER_FAILOVER'
  | 'BROKER_CONNECTED'
  | 'BROKER_DISCONNECTED'
  | 'CIRCUIT_OPEN'
  | 'CIRCUIT_CLOSED'
  | 'CIRCUIT_HALF_OPEN'
  | 'CIRCUIT_FAILURE_RECORDED'
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'AUTH_FAILED'
  | 'FUNDS_ADDED'
  | 'FUNDS_WITHDRAWN'
  | 'PORTFOLIO_UPDATED'
  | 'SYSTEM_ERROR';

export interface AuditEvent {
  /** Unique event identifier (UUID v4) */
  id: string;
  /** ISO-8601 timestamp of the event */
  timestamp: string;
  /** User who triggered the event (or 'system' for automated actions) */
  userId: string;
  /** Category of the event */
  eventType: AuditEventType;
  /** Event-specific payload (immutable) */
  data: Record<string, unknown>;
  /** Optional additional context */
  metadata?: Record<string, unknown>;
  /** SHA-256 hash of the previous event (for tamper evidence) */
  previousHash: string;
  /** SHA-256 hash of THIS event (id + timestamp + previousHash + data) */
  hash: string;
}

export interface AuditQuery {
  userId?: string;
  eventType?: AuditEventType | AuditEventType[];
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export interface AuditTrailSnapshot {
  totalEvents: number;
  firstEventTime: string | null;
  lastEventTime: string | null;
  latestHash: string | null;
}

// ==================== Helpers ====================

/**
 * Map from the internal AuditQuery shape to the StorageEngine's AuditFilter.
 */
function toFilter(query?: AuditQuery): AuditFilter | undefined {
  if (!query) return undefined;
  return {
    userId: query.userId,
    eventType: query.eventType as any,
    startTime: query.startTime,
    endTime: query.endTime,
    limit: query.limit,
    offset: query.offset,
  };
}

// ==================== Service ====================

export class AuditTrail {
  /**
   * In-memory cache for fast reads.
   * The StorageEngine is the source of truth for persistence.
   */
  private cache: AuditEvent[] = [];
  private readonly storage: StorageEngine;
  private readonly maxMemoryEvents: number;

  /**
   * @param storage    Optional StorageEngine. Defaults to InMemoryStorage.
   * @param maxMemoryEvents Max events to keep in the in-memory cache.
   *                        Default: 10,000
   */
  constructor(storage?: StorageEngine, maxMemoryEvents = 10_000) {
    this.storage = storage ?? new InMemoryStorage();
    this.maxMemoryEvents = maxMemoryEvents;
  }

  /**
   * Append an event to the immutable audit trail.
   * The event is persisted via the StorageEngine AND cached in memory.
   * Returns the fully constructed AuditEvent (with id, timestamp, hash).
   */
  async append(params: AuditAppendParams): Promise<AuditEvent> {
    const latestEvent = await this.storage.getLatestEvent();
    const previousHash = latestEvent ? latestEvent.hash : 'GENESIS_BLOCK';

    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const userId = params.userId || 'system';

    const event: AuditEvent = {
      id,
      timestamp,
      userId,
      eventType: params.eventType as AuditEventType,
      data: { ...params.data },
      metadata: params.metadata ? { ...params.metadata } : undefined,
      previousHash,
      hash: '', // Will be set below
    };

    // Compute hash: SHA-256 of (id + timestamp + previousHash + JSON(data))
    const hashInput = `${id}|${timestamp}|${previousHash}|${JSON.stringify(params.data)}|${JSON.stringify(params.metadata || {})}`;
    event.hash = createHash('sha256').update(hashInput).digest('hex');

    // Persist via StorageEngine
    await this.storage.appendEvent({
      ...event,
      eventType: params.eventType as any,
    });

    // Cache in memory
    this.cache.push(event);
    if (this.cache.length > this.maxMemoryEvents) {
      this.cache = this.cache.slice(this.cache.length - this.maxMemoryEvents);
    }

    return event;
  }

  /**
   * Query events with optional filters.
   * Events are returned in reverse chronological order (most recent first).
   * Queries the StorageEngine first, falls back to cache.
   */
  async getEvents(query?: AuditQuery): Promise<AuditEvent[]> {
    const filter = toFilter(query);
    if (filter) {
      return this.storage.queryEvents(filter);
    }
    // No filters — return all from cache (fast path)
    return [...this.cache].reverse();
  }

  /**
   * Get a specific event by ID.
   */
  async getEvent(id: string): Promise<AuditEvent | undefined> {
    const fromStorage = await this.storage.getEvent(id);
    return fromStorage ?? undefined;
  }

  /**
   * Verify the integrity of the entire audit chain.
   * Returns true if all hashes are valid and the chain is untampered.
   */
  async verifyIntegrity(): Promise<boolean> {
    const allEvents = await this.storage.getAllEvents();
    if (allEvents.length === 0) return true;

    let previousHash = 'GENESIS_BLOCK';

    for (const event of allEvents) {
      if (event.previousHash !== previousHash) return false;

      const hashInput = `${event.id}|${event.timestamp}|${event.previousHash}|${JSON.stringify(event.data)}|${JSON.stringify(event.metadata || {})}`;
      const computedHash = createHash('sha256')
        .update(hashInput)
        .digest('hex');

      if (event.hash !== computedHash) return false;

      previousHash = event.hash;
    }

    return true;
  }

  /**
   * Get a snapshot of the audit trail state.
   */
  async snapshot(): Promise<AuditTrailSnapshot> {
    const count = await this.storage.getEventCount();
    if (count === 0) {
      return {
        totalEvents: 0,
        firstEventTime: null,
        lastEventTime: null,
        latestHash: null,
      };
    }

    const allEvents = await this.storage.getAllEvents();
    return {
      totalEvents: count,
      firstEventTime: allEvents[0].timestamp,
      lastEventTime: allEvents[allEvents.length - 1].timestamp,
      latestHash: allEvents[allEvents.length - 1].hash,
    };
  }

  /**
   * Get the in-memory cache (for testing/debugging).
   */
  getCachedEvents(): readonly AuditEvent[] {
    return this.cache;
  }

  /**
   * Replace the storage backend at runtime (called during server startup).
   * This allows the singleton to be constructed with an in-memory default
   * and later swapped to PostgreSQL/MongoDB once the DB connection is ready.
   *
   * Any events buffered in the previous storage are migrated to the new one.
   */
  async configureStorage(newStorage: StorageEngine): Promise<void> {
    // Migrate any events that were in the old storage
    const oldEvents = await this.storage.getAllEvents();
    for (const event of oldEvents) {
      await newStorage.appendEvent(event);
    }
    // Update the cache to match the new storage
    this.cache = oldEvents;

    // Swap storage
    Object.defineProperty(this, 'storage', {
      value: newStorage,
      writable: false,
      configurable: false,
    });
  }

  /**
   * Clear all events (for testing only).
   */
  async _clearForTesting(): Promise<void> {
    this.cache = [];
    await this.storage.clearForTesting();
  }
}

// ==================== Global Singleton ====================
// In production, construct this with a persistent StorageEngine.
// The singleton is configured at server startup.
export const auditTrail = new AuditTrail();
