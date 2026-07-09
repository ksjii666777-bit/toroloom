/**
 * ============================================================================
 * Toroloom — PostgreSQLStorage Unit Tests (mocked pg driver)
 * ============================================================================
 *
 * Tests ALL methods of PostgreSQLStorage using a mocked `pg` Pool.
 * No real PostgreSQL database required.
 *
 * Domains tested:
 *   1. Lifecycle — connect (success + retry + fail), disconnect, isHealthy
 *   2. Audit Trail — append, getLatest, count, query, get, getAll, clear
 *   3. Risk Profiles — load, save, delete
 *   4. Broker State — load, save (default + custom)
 *   5. Badge Counts — load, save
 *   6. Notifications — save, load, mark read, mark all, delete
 *   7. Community — save, load, like, delete, load single
 *   8. Subscriptions — load, save
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/postgresStorage.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PostgreSQLStorage } from '../services/storage/postgres';
import type { NotificationData, CommunityPostData, UserSubscriptionData, BrokerStateData } from '../services/storage/types';
import type { RiskProfile } from '../services/riskEngine/types';

// ==================== Mock pg Pool ====================
//
// IMPORTANT: mockPoolInstance is PRE-INITIALIZED with default working mocks
// so that tests can configure the pool behavior BEFORE calling storage.connect().
// The MockPool constructor RETURNS this existing instance rather than creating
// a new one, so test-configured behavior is preserved.

const defaultQuery = vi.fn(async () => ({ rows: [], rowCount: 0 }));
const defaultConnect = vi.fn(async () => ({ release: vi.fn() }));
const defaultEnd = vi.fn(async () => undefined);
const defaultOn = vi.fn(() => { /* noop — event handler registered */ });

const mockPoolInstance = {
  query: defaultQuery,
  connect: defaultConnect,
  end: defaultEnd,
  on: defaultOn,
  emittedErrors: [] as Array<{ event: string; handler: (err: Error) => void }>,
};

function resetMockPool(): void {
  // Reset all mocks while keeping them as vi.fn()
  mockPoolInstance.query.mockReset();
  mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
  mockPoolInstance.connect.mockReset();
  mockPoolInstance.connect.mockResolvedValue({ release: vi.fn() });
  mockPoolInstance.end.mockReset();
  mockPoolInstance.end.mockResolvedValue(undefined);
  mockPoolInstance.on.mockReset();
  mockPoolInstance.on.mockImplementation((_event: string, _handler: any) => {});
  mockPoolInstance.emittedErrors = [];
}

vi.mock('pg', () => {
  function MockPool(_config: any) {
    // Return the pre-existing mockPoolInstance — do NOT overwrite it
    // because tests may have already configured its behavior.
    return mockPoolInstance;
  }
  MockPool.prototype.constructor = MockPool;
  return { Pool: MockPool, default: { Pool: MockPool } };
});

// ==================== Helpers ====================

const CONNECTION_STRING = 'postgres://test:test@localhost:5432/testdb';
const USER_ID = 'user-test-pg-001';

function createStorage(): PostgreSQLStorage {
  return new PostgreSQLStorage(CONNECTION_STRING);
}

// ============================================================================
// Tests
// ============================================================================

describe('PostgreSQLStorage', () => {
  let storage: PostgreSQLStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockPool();
    storage = createStorage();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  describe('Lifecycle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should connect successfully', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      mockPoolInstance.connect.mockResolvedValue({ release: vi.fn() });

      await storage.connect();

      expect(mockPoolInstance.connect).toHaveBeenCalled();
      expect(mockPoolInstance.query).toHaveBeenCalled();
    });

    it('should retry on connection failure and eventually succeed', async () => {
      mockPoolInstance.connect
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValue({ release: vi.fn() });
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const connectPromise = storage.connect();
      await vi.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(mockPoolInstance.connect).toHaveBeenCalledTimes(3);
    });

    it('should throw after exhausting retry attempts', async () => {
      mockPoolInstance.connect.mockRejectedValue(new Error('DB down'));

      const connectPromise = storage.connect();
      // Attach a catch handler BEFORE advancing time to prevent unhandled
      // rejection.  connectPromise rejects during advanceTimersByTimeAsync
      // (when the retry loop exhausts), but expect().rejects attaches its
      // catch handler after that await, creating a window where the
      // rejection is unhandled.
      connectPromise.catch(() => {});
      await vi.advanceTimersByTimeAsync(16000);

      await expect(connectPromise).rejects.toThrow(
        /PostgreSQL connection failed after 5 attempts/,
      );

      expect(mockPoolInstance.connect).toHaveBeenCalledTimes(5);
    });

    it('should handle pool error events gracefully', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      mockPoolInstance.connect.mockResolvedValue({ release: vi.fn() });

      await storage.connect();

      expect(mockPoolInstance.on).toHaveBeenCalledWith('error', expect.any(Function));

      // Simulate a pool-level error — should not throw
      const errorCall = mockPoolInstance.on.mock.calls.find(
        (c: any[]) => c[0] === 'error',
      );
      if (errorCall) {
        const handler = errorCall[1] as (err: Error) => void;
        expect(() => handler(new Error('Idle client error'))).not.toThrow();
      }
    });

    it('should disconnect successfully', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      mockPoolInstance.connect.mockResolvedValue({ release: vi.fn() });
      await storage.connect();

      await storage.disconnect();

      expect(mockPoolInstance.end).toHaveBeenCalled();
    });

    it('should not throw on disconnect when not connected', async () => {
      await expect(storage.disconnect()).resolves.not.toThrow();
    });

    it('should report healthy status when connected and query succeeds', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 });
      mockPoolInstance.connect.mockResolvedValue({ release: vi.fn() });

      await storage.connect();
      const healthy = await storage.isHealthy();

      expect(healthy).toBe(true);
      expect(mockPoolInstance.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should report unhealthy status when not connected', async () => {
      const healthy = await storage.isHealthy();
      expect(healthy).toBe(false);
    });

    it('should report unhealthy status when query fails', async () => {
      // Use mockImplementation so only isHealthy's SELECT 1 fails; migrate passes
      mockPoolInstance.query.mockImplementation(async (sql: string) => {
        if (sql.trim().toUpperCase() === 'SELECT 1') throw new Error('Connection lost');
        return { rows: [], rowCount: 0 };
      });
      mockPoolInstance.connect.mockResolvedValue({ release: vi.fn() });

      await storage.connect();
      const healthy = await storage.isHealthy();

      expect(healthy).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Audit Trail
  // ─────────────────────────────────────────────────────────────────────────

  describe('Audit Trail', () => {
    beforeEach(async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      mockPoolInstance.connect.mockResolvedValue({ release: vi.fn() });
      await storage.connect();
      mockPoolInstance.query.mockReset();
    });

    it('should append an event', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const event = await storage.appendEvent({
        id: 'ae-001', userId: USER_ID, eventType: 'LOGIN',
        timestamp: '2025-01-01T00:00:00.000Z',
        data: { email: 'test@toro.loom' },
        previousHash: '', hash: 'abc123',
      });

      expect(event.id).toBe('ae-001');
      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_events'),
        expect.arrayContaining(['ae-001', USER_ID, 'LOGIN']),
      );
    });

    it('should get the latest event', async () => {
      mockPoolInstance.query.mockResolvedValue({
        rows: [{
          id: 'ae-002', timestamp: '2025-01-02T00:00:00.000Z',
          user_id: USER_ID, event_type: 'LOGOUT',
          data: '{}', metadata: null,
          previous_hash: '', hash: 'def456',
        }],
        rowCount: 1,
      });

      const latest = await storage.getLatestEvent();
      expect(latest).not.toBeNull();
      expect(latest!.id).toBe('ae-002');
      expect(latest!.eventType).toBe('LOGOUT');
    });

    it('should return null for latest event when table is empty', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const latest = await storage.getLatestEvent();
      expect(latest).toBeNull();
    });

    it('should return 0 for event count when not connected', async () => {
      const disconnected = createStorage();
      const count = await disconnected.getEventCount();
      expect(count).toBe(0);
    });

    it('should return event count', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [{ count: '5' }], rowCount: 1 });

      const count = await storage.getEventCount();
      expect(count).toBe(5);
    });

    it('should query events with userId filter', async () => {
      mockPoolInstance.query.mockResolvedValue({
        rows: [{ id: 'ae-003', timestamp: '2025-01-03T00:00:00.000Z', user_id: USER_ID, event_type: 'LOGIN', data: '{}', metadata: null, previous_hash: '', hash: 'xyz' }],
        rowCount: 1,
      });

      const events = await storage.queryEvents({ userId: USER_ID });
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('ae-003');
    });

    it('should query events with array eventType filter', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const events = await storage.queryEvents({ eventType: ['LOGIN', 'LOGOUT'] });
      expect(events).toHaveLength(0);
      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('event_type = ANY'),
        expect.arrayContaining([expect.arrayContaining(['LOGIN', 'LOGOUT'])]),
      );
    });

    it('should query events with time range', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await storage.queryEvents({
        startTime: '2025-01-01T00:00:00Z',
        endTime: '2025-01-02T00:00:00Z',
      });

      const call = mockPoolInstance.query.mock.calls[0];
      const sql = call[0] as string;
      expect(sql).toContain('timestamp >=');
      expect(sql).toContain('timestamp <=');
    });

    it('should query events with pagination', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await storage.queryEvents({ limit: 10, offset: 5 });

      const call = mockPoolInstance.query.mock.calls[0];
      const sql = call[0] as string;
      expect(sql).toContain('LIMIT 10');
      expect(sql).toContain('OFFSET 5');
    });

    it('should get a single event by id', async () => {
      mockPoolInstance.query.mockResolvedValue({
        rows: [{ id: 'ae-001', timestamp: '2025-01-01T00:00:00.000Z', user_id: USER_ID, event_type: 'LOGIN', data: '{}', metadata: null, previous_hash: '', hash: 'a' }],
        rowCount: 1,
      });

      const event = await storage.getEvent('ae-001');
      expect(event).not.toBeNull();
      expect(event!.id).toBe('ae-001');
    });

    it('should return null for non-existent event', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const event = await storage.getEvent('non-existent');
      expect(event).toBeNull();
    });

    it('should return null for getEvent when not connected', async () => {
      const disconnected = createStorage();
      const event = await disconnected.getEvent('any');
      expect(event).toBeNull();
    });

    it('should get all events', async () => {
      mockPoolInstance.query.mockResolvedValue({
        rows: [
          { id: '1', timestamp: '2025-01-01T00:00:00.000Z', user_id: USER_ID, event_type: 'LOGIN', data: '{}', metadata: null, previous_hash: '', hash: 'a' },
          { id: '2', timestamp: '2025-01-02T00:00:00.000Z', user_id: USER_ID, event_type: 'LOGOUT', data: '{}', metadata: null, previous_hash: 'a', hash: 'b' },
        ],
        rowCount: 2,
      });

      const events = await storage.getAllEvents();
      expect(events).toHaveLength(2);
      expect(events[0].id).toBe('1');
      expect(events[1].id).toBe('2');
    });

    it('should return empty array from getAllEvents when not connected', async () => {
      const disconnected = createStorage();
      const events = await disconnected.getAllEvents();
      expect(events).toEqual([]);
    });

    it('should clear all data for testing', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await storage.clearForTesting();

      const deleteTables = mockPoolInstance.query.mock.calls
        .map((c: any[]) => c[0] as string)
        .filter((sql: string) => sql.startsWith('DELETE'));
      expect(deleteTables.length).toBe(10);
    });

    it('should handle JSONB data as string (legacy pg driver)', async () => {
      mockPoolInstance.query.mockResolvedValue({
        rows: [{
          id: 'ae-legacy', timestamp: '2025-01-01T00:00:00.000Z',
          user_id: USER_ID, event_type: 'LOGIN',
          data: '{"email":"test@toro.loom"}',
          metadata: null, previous_hash: '', hash: 'h',
        }],
        rowCount: 1,
      });

      const event = await storage.getEvent('ae-legacy');
      expect(event?.data).toEqual({ email: 'test@toro.loom' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Risk Profiles
  // ─────────────────────────────────────────────────────────────────────────

  describe('Risk Profiles', () => {
    const riskProfile: RiskProfile = {
      userId: USER_ID,
      dailyLossLimit: 50000,
      dailyLossPercentLimit: 5,
      maxPositionSizePercent: 20,
      maxLeverage: 3,
      allowIntraday: true,
      allowFNO: true,
      portfolioValueAtOpen: 1000000,
      today: { startingValue: 1000000, currentPnl: 0, peakPnl: 0, tradesToday: 0, totalTurnover: 0 },
      lockdown: { status: 'none' as const, triggeredAt: null, liftsAt: null, triggerLoss: null, breachedLimit: null },
      settingsFrozen: false,
      settingsFrozenUntil: null,
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    beforeEach(async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      mockPoolInstance.connect.mockResolvedValue({ release: vi.fn() });
      await storage.connect();
      mockPoolInstance.query.mockReset();
    });

    it('should return null for non-existent profile', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const loaded = await storage.loadRiskProfile('unknown');
      expect(loaded).toBeNull();
    });

    it('should load a risk profile', async () => {
      mockPoolInstance.query.mockResolvedValue({
        rows: [{ profile: JSON.stringify(riskProfile) }],
        rowCount: 1,
      });

      const loaded = await storage.loadRiskProfile(USER_ID);
      expect(loaded).not.toBeNull();
      expect(loaded!.dailyLossLimit).toBe(50000);
    });

    it('should save a risk profile', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await storage.saveRiskProfile(riskProfile);

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO risk_profiles'),
        expect.arrayContaining([USER_ID, expect.any(String), riskProfile.updatedAt]),
      );
    });

    it('should delete a risk profile', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await storage.deleteRiskProfile(USER_ID);

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM risk_profiles'),
        [USER_ID],
      );
    });

    it('should return null when not connected (loadRiskProfile)', async () => {
      const disconnected = createStorage();
      expect(await disconnected.loadRiskProfile(USER_ID)).toBeNull();
    });

    it('should not throw on save when not connected', async () => {
      const disconnected = createStorage();
      await expect(disconnected.saveRiskProfile(riskProfile)).resolves.not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Broker State
  // ─────────────────────────────────────────────────────────────────────────

  describe('Broker State', () => {
    beforeEach(async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      mockPoolInstance.connect.mockResolvedValue({ release: vi.fn() });
      await storage.connect();
      mockPoolInstance.query.mockReset();
    });

    it('should return default empty state when no data exists', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const state = await storage.loadBrokerState();
      expect(state.currentBrokerType).toBeNull();
      expect(state.dedupCache).toEqual({});
    });

    it('should load a saved broker state', async () => {
      const savedState: BrokerStateData = {
        currentBrokerType: 'zerodha',
        dedupCache: {
          zerodha: { lastEvent: 'BROKER_CONNECTED', timestamp: 1700000000000 },
        },
      };
      mockPoolInstance.query.mockResolvedValue({
        rows: [{ value: JSON.stringify(savedState) }],
        rowCount: 1,
      });

      const state = await storage.loadBrokerState();
      expect(state.currentBrokerType).toBe('zerodha');
      expect(state.dedupCache.zerodha.lastEvent).toBe('BROKER_CONNECTED');
    });

    it('should save broker state', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const state: BrokerStateData = { currentBrokerType: 'angel', dedupCache: {} };
      await storage.saveBrokerState(state);

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO broker_state'),
        expect.any(Array),
      );
    });

    it('should return default state when not connected', async () => {
      const disconnected = createStorage();
      const state = await disconnected.loadBrokerState();
      expect(state.currentBrokerType).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Badge Counts
  // ─────────────────────────────────────────────────────────────────────────

  describe('Badge Counts', () => {
    beforeEach(async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      mockPoolInstance.connect.mockResolvedValue({ release: vi.fn() });
      await storage.connect();
      mockPoolInstance.query.mockReset();
    });

    it('should return 0 for users without a saved count', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      expect(await storage.loadBadgeCount(USER_ID)).toBe(0);
    });

    it('should load a saved badge count', async () => {
      mockPoolInstance.query.mockResolvedValue({
        rows: [{ count: '7' }],
        rowCount: 1,
      });
      expect(await storage.loadBadgeCount(USER_ID)).toBe(7);
    });

    it('should save a badge count', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      await storage.saveBadgeCount(USER_ID, 5);

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO badge_counts'),
        [USER_ID, 5],
      );
    });

    it('should return 0 when not connected', async () => {
      const disconnected = createStorage();
      expect(await disconnected.loadBadgeCount(USER_ID)).toBe(0);
    });

    it('should not throw on save when not connected', async () => {
      const disconnected = createStorage();
      await expect(disconnected.saveBadgeCount(USER_ID, 3)).resolves.not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Notifications
  // ─────────────────────────────────────────────────────────────────────────

  describe('Notifications', () => {
    const notif: NotificationData = {
      id: 'pg-notif-1', userId: USER_ID, type: 'price_alert',
      title: 'Test Alert', message: 'Test message',
      read: false, timestamp: '2025-01-01T00:00:00.000Z',
    };

    beforeEach(async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      mockPoolInstance.connect.mockResolvedValue({ release: vi.fn() });
      await storage.connect();
      mockPoolInstance.query.mockReset();
    });

    it('should save and load notifications', async () => {
      mockPoolInstance.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [{ id: 'pg-notif-1', user_id: USER_ID, type: 'price_alert', title: 'Test Alert', message: 'Test message', read: false, timestamp: '2025-01-01T00:00:00.000Z', data: null, metadata: null }],
        rowCount: 1,
      });

      await storage.saveNotification(notif);
      const loaded = await storage.loadNotifications(USER_ID);

      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('pg-notif-1');
    });

    it('should return empty array for users with no notifications', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const loaded = await storage.loadNotifications(USER_ID);
      expect(loaded).toEqual([]);
    });

    it('should mark a notification as read', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await storage.markNotificationRead('pg-notif-1');

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notifications SET read = true'),
        ['pg-notif-1'],
      );
    });

    it('should mark all notifications as read for a user', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await storage.markAllNotificationsRead(USER_ID);

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notifications SET read = true WHERE user_id = $1'),
        [USER_ID],
      );
    });

    it('should delete a notification', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await storage.deleteNotification('pg-notif-1');

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM notifications'),
        ['pg-notif-1'],
      );
    });

    it('should handle notification with data and metadata', async () => {
      const richNotif: NotificationData = {
        ...notif,
        data: { price: 2890, symbol: 'RELIANCE' },
        metadata: { source: 'test' },
      };

      mockPoolInstance.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [{ id: 'pg-notif-1', user_id: USER_ID, type: 'price_alert', title: 'Test Alert', message: 'Test message', read: false, timestamp: '2025-01-01T00:00:00.000Z', data: JSON.stringify(richNotif.data), metadata: JSON.stringify(richNotif.metadata) }],
        rowCount: 1,
      });

      await storage.saveNotification(richNotif);
      const loaded = await storage.loadNotifications(USER_ID);
      expect(loaded[0].data).toEqual({ price: 2890, symbol: 'RELIANCE' });
      expect(loaded[0].metadata).toEqual({ source: 'test' });
    });

    it('should return empty array when not connected (loadNotifications)', async () => {
      const disconnected = createStorage();
      expect(await disconnected.loadNotifications(USER_ID)).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Community
  // ─────────────────────────────────────────────────────────────────────────

  describe('Community', () => {
    const post: CommunityPostData = {
      id: 'pg-post-1', userId: USER_ID, userName: 'TestUser',
      content: 'Hello world!', likes: 0, comments: 0,
      timestamp: '2025-01-01T00:00:00.000Z', tags: ['stocks'],
    };

    beforeEach(async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      mockPoolInstance.connect.mockResolvedValue({ release: vi.fn() });
      await storage.connect();
      mockPoolInstance.query.mockReset();
    });

    it('should save a community post', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await storage.saveCommunityPost(post);

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO community_posts'),
        expect.arrayContaining(['pg-post-1', USER_ID, 'TestUser']),
      );
    });

    it('should load all posts (most recent first)', async () => {
      mockPoolInstance.query.mockResolvedValue({
        rows: [
          { id: 'p2', user_id: USER_ID, user_name: 'User', user_avatar: null, content: 'Post 2', likes: 5, comments: 2, timestamp: '2025-01-02T00:00:00.000Z', tags: '["mutual-funds"]' },
          { id: 'p1', user_id: USER_ID, user_name: 'User', user_avatar: null, content: 'Post 1', likes: 0, comments: 0, timestamp: '2025-01-01T00:00:00.000Z', tags: '["stocks"]' },
        ],
        rowCount: 2,
      });

      const posts = await storage.loadCommunityPosts();
      expect(posts).toHaveLength(2);
      expect(posts[0].id).toBe('p2');
      expect(posts[1].id).toBe('p1');
    });

    it('should load a single post by id', async () => {
      mockPoolInstance.query.mockResolvedValue({
        rows: [{ id: 'pg-post-1', user_id: USER_ID, user_name: 'TestUser', user_avatar: 'https://avatar.example.com/1', content: 'Hello', likes: 3, comments: 1, timestamp: '2025-01-01T00:00:00.000Z', tags: '[]' }],
        rowCount: 1,
      });

      const loaded = await storage.loadCommunityPost('pg-post-1');
      expect(loaded).not.toBeNull();
      expect(loaded!.content).toBe('Hello');
      expect(loaded!.userAvatar).toBe('https://avatar.example.com/1');
    });

    it('should return null for non-existent post', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      expect(await storage.loadCommunityPost('nonexistent')).toBeNull();
    });

    it('should like a community post', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await storage.likeCommunityPost('pg-post-1');

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE community_posts SET likes = likes + 1'),
        ['pg-post-1'],
      );
    });

    it('should delete a community post', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await storage.deleteCommunityPost('pg-post-1');

      expect(mockPoolInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM community_posts'),
        ['pg-post-1'],
      );
    });

    it('should return empty array when not connected (loadCommunityPosts)', async () => {
      const disconnected = createStorage();
      expect(await disconnected.loadCommunityPosts()).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Subscriptions
  // ─────────────────────────────────────────────────────────────────────────

  describe('Subscriptions', () => {
    const sub: UserSubscriptionData = {
      userId: USER_ID, tier: 'pro', planId: 'plan_pro', status: 'active',
      startDate: '2025-01-01T00:00:00.000Z',
      endDate: '2025-02-01T00:00:00.000Z',
      autoRenew: true, paymentMethod: 'razorpay',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    beforeEach(async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      mockPoolInstance.connect.mockResolvedValue({ release: vi.fn() });
      await storage.connect();
      mockPoolInstance.query.mockReset();
    });

    it('should return null for users without a subscription', async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [], rowCount: 0 });
      expect(await storage.loadSubscription(USER_ID)).toBeNull();
    });

    it('should save and load a subscription', async () => {
      mockPoolInstance.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [{ user_id: USER_ID, tier: 'pro', plan_id: 'plan_pro', status: 'active', start_date: '2025-01-01T00:00:00.000Z', end_date: '2025-02-01T00:00:00.000Z', auto_renew: true, payment_method: 'razorpay', razorpay_order_id: null, last_payment_date: null, tenant_id: null, updated_at: '2025-01-01T00:00:00.000Z' }],
        rowCount: 1,
      });

      await storage.saveSubscription(USER_ID, sub);
      const loaded = await storage.loadSubscription(USER_ID);

      expect(loaded).not.toBeNull();
      expect(loaded!.tier).toBe('pro');
      expect(loaded!.autoRenew).toBe(true);
      expect(loaded!.paymentMethod).toBe('razorpay');
    });

    it('should handle subscription with tenantId', async () => {
      const tenantSub: UserSubscriptionData = {
        ...sub, tenantId: 'tenant-org-42',
      };

      mockPoolInstance.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      mockPoolInstance.query.mockResolvedValueOnce({
        rows: [{ user_id: USER_ID, tier: 'pro', plan_id: 'plan_pro', status: 'active', start_date: '2025-01-01T00:00:00.000Z', end_date: '2025-02-01T00:00:00.000Z', auto_renew: true, payment_method: null, razorpay_order_id: null, last_payment_date: null, tenant_id: 'tenant-org-42', updated_at: '2025-01-01T00:00:00.000Z' }],
        rowCount: 1,
      });

      await storage.saveSubscription(USER_ID, tenantSub);
      const loaded = await storage.loadSubscription(USER_ID);
      expect(loaded!.tenantId).toBe('tenant-org-42');
    });

    it('should return null when not connected (loadSubscription)', async () => {
      const disconnected = createStorage();
      expect(await disconnected.loadSubscription(USER_ID)).toBeNull();
    });
  });
});
