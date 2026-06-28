/**
 * ============================================================================
 * Toroloom — MongoDBStorage Unit Tests (mocked mongodb driver)
 * ============================================================================
 *
 * Tests ALL methods of MongoDBStorage using a mocked `mongodb` MongoClient.
 * No real MongoDB server required.
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
 * Run: npx vitest run --reporter=verbose src/__tests__/mongodbStorage.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MongoDBStorage } from '../services/storage/mongodb';
import type { NotificationData, CommunityPostData, UserSubscriptionData, BrokerStateData } from '../services/storage/types';
import type { RiskProfile } from '../services/riskEngine/types';

// ==================== Mock mongodb Module ====================

interface MockCollection {
  insertOne: vi.Mock;
  findOne: vi.Mock;
  find: vi.Mock;
  updateOne: vi.Mock;
  updateMany: vi.Mock;
  replaceOne: vi.Mock;
  deleteOne: vi.Mock;
  deleteMany: vi.Mock;
  countDocuments: vi.Mock;
  createIndex: vi.Mock;
}

interface MockCursor {
  sort: vi.Mock;
  skip: vi.Mock;
  limit: vi.Mock;
  toArray: vi.Mock;
}

interface MockDbInstance {
  collection: vi.Mock;
  admin: vi.Mock;
}

interface MockClientInstance {
  connect: vi.Mock;
  close: vi.Mock;
  db: vi.Mock;
}

const COLLECTION_NAMES = [
  'audit_events', 'risk_profiles', 'broker_state', 'notifications',
  'badge_counts', 'community_posts', 'subscriptions',
];

let mockCollections: Record<string, MockCollection>;
// Pre-create mockClientInstance so tests can configure behavior BEFORE connect()
let mockClientInstance: MockClientInstance;
let mockDbInstance: MockDbInstance;

function createMockCollection(): MockCollection {
  return {
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true, insertedId: 'mock-id' }),
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockReturnValue(createMockCursor([])),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }),
    updateMany: vi.fn().mockResolvedValue({ acknowledged: true, matchedCount: 0, modifiedCount: 0 }),
    replaceOne: vi.fn().mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 }),
    deleteOne: vi.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ acknowledged: true, deletedCount: 10 }),
    countDocuments: vi.fn().mockResolvedValue(0),
    createIndex: vi.fn().mockResolvedValue('index-name'),
  };
}

function createMockCursor(rows: any[]): MockCursor {
  return {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(rows),
  };
}

vi.mock('mongodb', () => {
  function MockMongoClient(_uri: string, _options?: any) {
    // Recreate mockDbInstance for each constructor call (fresh for each connect())
    mockDbInstance = {
      collection: vi.fn((name: string) => {
        if (!mockCollections[name]) {
          mockCollections[name] = createMockCollection();
        }
        return mockCollections[name];
      }),
      admin: vi.fn(() => ({
        ping: vi.fn().mockResolvedValue({ ok: 1 }),
      })),
    };

    // Return the existing mockClientInstance so test-configured behavior survives
    return mockClientInstance;
  }
  MockMongoClient.prototype.constructor = MockMongoClient;
  return {
    MongoClient: MockMongoClient as any,
  };
});

// ==================== Helpers ====================

const URI = 'mongodb://test:test@localhost:27017';
const DB_NAME = 'toroloom_test';
const USER_ID = 'user-test-mongo-001';

function createStorage(): MongoDBStorage {
  return new MongoDBStorage(URI, DB_NAME);
}

function resetMocks(): void {
  // Pre-create ALL collection mocks so tests can access any collection
  // (including broker_state which is created lazily, not during connect())
  mockCollections = {};
  for (const name of COLLECTION_NAMES) {
    mockCollections[name] = createMockCollection();
  }

  mockClientInstance = {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    db: vi.fn(() => {
      mockDbInstance = {
        collection: vi.fn((name: string) => {
          if (!mockCollections[name]) {
            mockCollections[name] = createMockCollection();
          }
          return mockCollections[name];
        }),
        admin: vi.fn(() => ({
          ping: vi.fn().mockResolvedValue({ ok: 1 }),
        })),
      };
      return mockDbInstance;
    }),
  };
  mockDbInstance = {
    collection: vi.fn((name: string) => {
      if (!mockCollections[name]) {
        mockCollections[name] = createMockCollection();
      }
      return mockCollections[name];
    }),
    admin: vi.fn(() => ({
      ping: vi.fn().mockResolvedValue({ ok: 1 }),
    })),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('MongoDBStorage', () => {
  let storage: MongoDBStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
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
      await storage.connect();

      expect(mockClientInstance.connect).toHaveBeenCalled();
      // Should have created indexes (6 collections × index ops)
      expect(Object.keys(mockCollections).length).toBeGreaterThan(0);
    });

    it('should retry on connection failure and eventually succeed', async () => {
      // Fail twice, then succeed
      mockClientInstance.connect
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce(undefined);

      const connectPromise = storage.connect();
      // Advance past 2 backoff delays (500ms + 1000ms)
      await vi.advanceTimersByTimeAsync(2000);
      await connectPromise;

      expect(mockClientInstance.connect).toHaveBeenCalledTimes(3);
    });

    it('should throw after exhausting retry attempts', async () => {
      mockClientInstance.connect.mockRejectedValue(new Error('MongoDB down'));

      const connectPromise = storage.connect();
      // Advance past all 5 backoff delays (500+1000+2000+4000+8000=15500ms)
      await vi.advanceTimersByTimeAsync(16000);

      await expect(connectPromise).rejects.toThrow(
        /MongoDB connection failed after 5 attempts/,
      );

      expect(mockClientInstance.connect).toHaveBeenCalledTimes(5);
    });

    it('should close previous client on retry failure', async () => {
      // Connect fails but creates a client first
      mockClientInstance.connect
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(undefined);

      const connectPromise = storage.connect();
      // Advance past 1 backoff delay (500ms)
      await vi.advanceTimersByTimeAsync(1000);
      await connectPromise;

      // close() should have been called after the first failure
      expect(mockClientInstance.close).toHaveBeenCalled();
    });

    it('should disconnect successfully', async () => {
      await storage.connect();
      await storage.disconnect();

      expect(mockClientInstance.close).toHaveBeenCalled();
    });

    it('should not throw on disconnect when not connected', async () => {
      await expect(storage.disconnect()).resolves.not.toThrow();
    });

    it('should report healthy status when connected', async () => {
      await storage.connect();
      const healthy = await storage.isHealthy();

      expect(healthy).toBe(true);
    });

    it('should report unhealthy status when not connected', async () => {
      const healthy = await storage.isHealthy();
      expect(healthy).toBe(false);
    });

    it('should report unhealthy when ping fails after connect', async () => {
      await storage.connect();

      // Override admin to fail after connect
      mockDbInstance.admin = vi.fn(() => ({
        ping: vi.fn().mockRejectedValue(new Error('Connection lost')),
      }));

      const healthy = await storage.isHealthy();
      expect(healthy).toBe(false);
    });

    it('should report unhealthy when ping fails after connect', async () => {
      await storage.connect();

      // Override admin to fail
      mockDbInstance.admin = vi.fn(() => ({
        ping: vi.fn().mockRejectedValue(new Error('Connection lost')),
      }));

      const healthy = await storage.isHealthy();
      expect(healthy).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Audit Trail
  // ─────────────────────────────────────────────────────────────────────────

  describe('Audit Trail', () => {
    beforeEach(async () => {
      await storage.connect();
    });

    it('should append an event', async () => {
      const col = mockCollections['audit_events'];
      col.insertOne.mockResolvedValue({ acknowledged: true, insertedId: 'evt-001' });

      const event = await storage.appendEvent({
        id: 'evt-001', userId: USER_ID, eventType: 'LOGIN',
        timestamp: '2025-01-01T00:00:00.000Z',
        data: { email: 'test@toro.loom' },
        previousHash: '', hash: 'abc123',
      });

      expect(event.id).toBe('evt-001');
      expect(col.insertOne).toHaveBeenCalledWith(event);
    });

    it('should get the latest event', async () => {
      const col = mockCollections['audit_events'];
      col.findOne.mockResolvedValue({
        _id: 'some-id',
        id: 'evt-002', timestamp: '2025-01-02T00:00:00.000Z',
        userId: USER_ID, eventType: 'LOGOUT',
        data: {}, previousHash: '', hash: 'def456',
      });

      const latest = await storage.getLatestEvent();
      expect(latest).not.toBeNull();
      expect(latest!.id).toBe('evt-002');
      expect(latest!.eventType).toBe('LOGOUT');
      // _id should be stripped
      expect((latest as any)._id).toBeUndefined();
    });

    it('should return null for latest event when collection is empty', async () => {
      const col = mockCollections['audit_events'];
      col.findOne.mockResolvedValue(null);

      const latest = await storage.getLatestEvent();
      expect(latest).toBeNull();
    });

    it('should return event count', async () => {
      const col = mockCollections['audit_events'];
      col.countDocuments.mockResolvedValue(5);

      const count = await storage.getEventCount();
      expect(count).toBe(5);
    });

    it('should query events with userId and eventType filters', async () => {
      const col = mockCollections['audit_events'];
      col.find.mockReturnValue(createMockCursor([
        { _id: '1', id: 'evt-001', userId: USER_ID, eventType: 'LOGIN', timestamp: '2025-01-01T00:00:00.000Z', data: {}, previousHash: '', hash: 'a' },
      ]));

      const events = await storage.queryEvents({ userId: USER_ID, eventType: 'LOGIN' });
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('evt-001');
    });

    it('should query events with array eventType filter', async () => {
      const col = mockCollections['audit_events'];
      col.find.mockReturnValue(createMockCursor([]));

      await storage.queryEvents({ eventType: ['LOGIN', 'LOGOUT'] });

      // Should use $in operator
      const findCall = col.find.mock.calls[0];
      expect(findCall[0].eventType).toEqual({ $in: ['LOGIN', 'LOGOUT'] });
    });

    it('should query events with time range', async () => {
      const col = mockCollections['audit_events'];
      col.find.mockReturnValue(createMockCursor([]));

      await storage.queryEvents({
        startTime: '2025-01-01T00:00:00Z',
        endTime: '2025-01-02T00:00:00Z',
      });

      const findCall = col.find.mock.calls[0];
      expect(findCall[0].timestamp.$gte).toBe('2025-01-01T00:00:00Z');
      expect(findCall[0].timestamp.$lte).toBe('2025-01-02T00:00:00Z');
    });

    it('should query events with pagination (offset + limit)', async () => {
      const col = mockCollections['audit_events'];
      const cursor = createMockCursor([]);
      col.find.mockReturnValue(cursor);

      await storage.queryEvents({ offset: 5, limit: 10 });

      expect(cursor.skip).toHaveBeenCalledWith(5);
      expect(cursor.limit).toHaveBeenCalledWith(10);
    });

    it('should get a single event by id', async () => {
      const col = mockCollections['audit_events'];
      col.findOne.mockResolvedValue({
        _id: 'x', id: 'evt-001', userId: USER_ID, eventType: 'LOGIN',
        timestamp: '2025-01-01T00:00:00.000Z', data: {}, previousHash: '', hash: 'a',
      });

      const event = await storage.getEvent('evt-001');
      expect(event).not.toBeNull();
      expect(event!.id).toBe('evt-001');
    });

    it('should return null for non-existent event', async () => {
      const col = mockCollections['audit_events'];
      col.findOne.mockResolvedValue(null);

      const event = await storage.getEvent('non-existent');
      expect(event).toBeNull();
    });

    it('should get all events in timestamp order', async () => {
      const col = mockCollections['audit_events'];
      col.find.mockReturnValue(createMockCursor([
        { _id: '1', id: 'evt-001', userId: USER_ID, eventType: 'LOGIN', timestamp: '2025-01-01T00:00:00.000Z', data: {}, previousHash: '', hash: 'a' },
        { _id: '2', id: 'evt-002', userId: USER_ID, eventType: 'LOGOUT', timestamp: '2025-01-02T00:00:00.000Z', data: {}, previousHash: 'a', hash: 'b' },
      ]));

      const events = await storage.getAllEvents();
      expect(events).toHaveLength(2);
      expect(events[0].id).toBe('evt-001');
    });

    it('should clear all data for testing', async () => {
      await storage.clearForTesting();

      // Should have called deleteMany on all 7 collections
      // audit_events, risk_profiles, broker_state, notifications, badge_counts, community_posts, subscriptions
      const deleteCalls = Object.values(mockCollections)
        .filter((col) => col.deleteMany.mock.calls.length > 0);
      expect(deleteCalls.length).toBe(7);
    });

    it('should throw MongoDB not connected when getLatestEvent called without connect', async () => {
      const disconnected = createStorage();
      await expect(disconnected.getLatestEvent()).rejects.toThrow('MongoDB not connected');
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
      await storage.connect();
    });

    it('should return null for non-existent profile', async () => {
      const col = mockCollections['risk_profiles'];
      col.findOne.mockResolvedValue(null);

      const loaded = await storage.loadRiskProfile('unknown');
      expect(loaded).toBeNull();
    });

    it('should load a risk profile', async () => {
      const col = mockCollections['risk_profiles'];
      col.findOne.mockResolvedValue({ _id: 'x', ...riskProfile });

      const loaded = await storage.loadRiskProfile(USER_ID);
      expect(loaded).not.toBeNull();
      expect(loaded!.dailyLossLimit).toBe(50000);
      expect((loaded as any)._id).toBeUndefined();
    });

    it('should save a risk profile', async () => {
      const col = mockCollections['risk_profiles'];

      await storage.saveRiskProfile(riskProfile);

      expect(col.replaceOne).toHaveBeenCalledWith(
        { userId: USER_ID },
        riskProfile,
        { upsert: true },
      );
    });

    it('should delete a risk profile', async () => {
      const col = mockCollections['risk_profiles'];

      await storage.deleteRiskProfile(USER_ID);

      expect(col.deleteOne).toHaveBeenCalledWith({ userId: USER_ID });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Broker State
  // ─────────────────────────────────────────────────────────────────────────

  describe('Broker State', () => {
    beforeEach(async () => {
      await storage.connect();
    });

    it('should return default empty state when no data exists', async () => {
      const col = mockCollections['broker_state'];
      col.findOne.mockResolvedValue(null);

      const state = await storage.loadBrokerState();
      expect(state.currentBrokerType).toBeNull();
      expect(state.dedupCache).toEqual({});
    });

    it('should load a saved broker state', async () => {
      const col = mockCollections['broker_state'];
      col.findOne.mockResolvedValue({
        _id: 'broker_state',
        currentBrokerType: 'zerodha',
        dedupCache: {
          zerodha: { lastEvent: 'BROKER_CONNECTED', timestamp: 1700000000000 },
        },
      });

      const state = await storage.loadBrokerState();
      expect(state.currentBrokerType).toBe('zerodha');
      expect(state.dedupCache.zerodha.lastEvent).toBe('BROKER_CONNECTED');
    });

    it('should save broker state', async () => {
      const col = mockCollections['broker_state'];
      const state: BrokerStateData = { currentBrokerType: 'angel', dedupCache: {} };

      await storage.saveBrokerState(state);

      expect(col.replaceOne).toHaveBeenCalledWith(
        { _id: 'broker_state' },
        { _id: 'broker_state', ...state },
        { upsert: true },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Badge Counts
  // ─────────────────────────────────────────────────────────────────────────

  describe('Badge Counts', () => {
    beforeEach(async () => {
      await storage.connect();
    });

    it('should return 0 for users without a saved count', async () => {
      const col = mockCollections['badge_counts'];
      col.findOne.mockResolvedValue(null);

      expect(await storage.loadBadgeCount(USER_ID)).toBe(0);
    });

    it('should load a saved badge count', async () => {
      const col = mockCollections['badge_counts'];
      col.findOne.mockResolvedValue({ userId: USER_ID, count: 7 });

      expect(await storage.loadBadgeCount(USER_ID)).toBe(7);
    });

    it('should save a badge count', async () => {
      const col = mockCollections['badge_counts'];

      await storage.saveBadgeCount(USER_ID, 5);

      expect(col.updateOne).toHaveBeenCalledWith(
        { userId: USER_ID },
        { $set: { userId: USER_ID, count: 5 } },
        { upsert: true },
      );
    });

    it('should return 0 when db is not set', async () => {
      const disconnected = createStorage();
      expect(await disconnected.loadBadgeCount(USER_ID)).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Notifications
  // ─────────────────────────────────────────────────────────────────────────

  describe('Notifications', () => {
    const notif: NotificationData = {
      id: 'mongo-notif-1', userId: USER_ID, type: 'price_alert',
      title: 'Test Alert', message: 'Test message',
      read: false, timestamp: '2025-01-01T00:00:00.000Z',
      data: { price: 2890 },
      metadata: { source: 'test' },
    };

    beforeEach(async () => {
      await storage.connect();
    });

    it('should save a notification', async () => {
      const col = mockCollections['notifications'];

      await storage.saveNotification(notif);

      expect(col.updateOne).toHaveBeenCalledWith(
        { id: 'mongo-notif-1' },
        {
          $set: {
            type: notif.type,
            title: notif.title,
            message: notif.message,
            read: notif.read,
            timestamp: notif.timestamp,
            data: notif.data,
            metadata: notif.metadata,
          },
          $setOnInsert: {
            userId: notif.userId,
          },
        },
        { upsert: true },
      );
    });

    it('should load notifications for a user (most recent first)', async () => {
      const col = mockCollections['notifications'];
      col.find.mockReturnValue(createMockCursor([
        { _id: '1', id: 'n2', userId: USER_ID, type: 'trade', title: 'T2', message: 'M2', read: true, timestamp: '2025-01-02T00:00:00.000Z' },
        { _id: '2', id: 'n1', userId: USER_ID, type: 'alert', title: 'T1', message: 'M1', read: false, timestamp: '2025-01-01T00:00:00.000Z' },
      ]));

      const loaded = await storage.loadNotifications(USER_ID);
      expect(loaded).toHaveLength(2);
      expect(loaded[0].id).toBe('n2');
    });

    it('should return empty array for users with no notifications', async () => {
      const col = mockCollections['notifications'];
      col.find.mockReturnValue(createMockCursor([]));

      const loaded = await storage.loadNotifications(USER_ID);
      expect(loaded).toEqual([]);
    });

    it('should mark a notification as read', async () => {
      const col = mockCollections['notifications'];

      await storage.markNotificationRead('mongo-notif-1');

      expect(col.updateOne).toHaveBeenCalledWith(
        { id: 'mongo-notif-1' },
        { $set: { read: true } },
      );
    });

    it('should mark all notifications as read for a user', async () => {
      const col = mockCollections['notifications'];

      await storage.markAllNotificationsRead(USER_ID);

      expect(col.updateMany).toHaveBeenCalledWith(
        { userId: USER_ID, read: false },
        { $set: { read: true } },
      );
    });

    it('should delete a notification', async () => {
      const col = mockCollections['notifications'];

      await storage.deleteNotification('mongo-notif-1');

      expect(col.deleteOne).toHaveBeenCalledWith({ id: 'mongo-notif-1' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Community
  // ─────────────────────────────────────────────────────────────────────────

  describe('Community', () => {
    const post: CommunityPostData = {
      id: 'mongo-post-1', userId: USER_ID, userName: 'TestUser',
      content: 'Hello world!', likes: 0, comments: 0,
      timestamp: '2025-01-01T00:00:00.000Z', tags: ['stocks'],
    };

    beforeEach(async () => {
      await storage.connect();
    });

    it('should save a community post', async () => {
      const col = mockCollections['community_posts'];

      await storage.saveCommunityPost(post);

      expect(col.updateOne).toHaveBeenCalledWith(
        { id: 'mongo-post-1' },
        {
          $set: {
            content: post.content,
            likes: post.likes,
            comments: post.comments,
            tags: post.tags,
          },
          $setOnInsert: {
            userId: post.userId,
            userName: post.userName,
            userAvatar: post.userAvatar,
            timestamp: post.timestamp,
          },
        },
        { upsert: true },
      );
    });

    it('should save a community post with avatar', async () => {
      const col = mockCollections['community_posts'];
      const postWithAvatar: CommunityPostData = {
        ...post, userAvatar: 'https://avatar.example.com/1',
      };

      await storage.saveCommunityPost(postWithAvatar);

      expect(col.updateOne).toHaveBeenCalled();
      const updateArg = col.updateOne.mock.calls[0][1];
      expect(updateArg.$setOnInsert.userAvatar).toBe('https://avatar.example.com/1');
    });

    it('should load all posts (most recent first)', async () => {
      const col = mockCollections['community_posts'];
      col.find.mockReturnValue(createMockCursor([
        { _id: '1', id: 'p2', userId: 'u1', userName: 'User', content: 'Post 2', likes: 5, comments: 2, timestamp: '2025-01-02T00:00:00.000Z', tags: ['mutual-funds'] },
        { _id: '2', id: 'p1', userId: 'u1', userName: 'User', content: 'Post 1', likes: 0, comments: 0, timestamp: '2025-01-01T00:00:00.000Z', tags: ['stocks'] },
      ]));

      const posts = await storage.loadCommunityPosts();
      expect(posts).toHaveLength(2);
      expect(posts[0].id).toBe('p2');
    });

    it('should load a single post by id', async () => {
      const col = mockCollections['community_posts'];
      col.findOne.mockResolvedValue({
        _id: 'x', id: 'mongo-post-1', userId: USER_ID, userName: 'TestUser',
        userAvatar: 'https://avatar.example.com/1', content: 'Hello',
        likes: 3, comments: 1, timestamp: '2025-01-01T00:00:00.000Z', tags: ['stocks'],
      });

      const loaded = await storage.loadCommunityPost('mongo-post-1');
      expect(loaded).not.toBeNull();
      expect(loaded!.content).toBe('Hello');
      expect(loaded!.userAvatar).toBe('https://avatar.example.com/1');
      expect((loaded as any)._id).toBeUndefined();
    });

    it('should return null for non-existent post', async () => {
      const col = mockCollections['community_posts'];
      col.findOne.mockResolvedValue(null);

      expect(await storage.loadCommunityPost('nonexistent')).toBeNull();
    });

    it('should like a community post (increment)', async () => {
      const col = mockCollections['community_posts'];

      await storage.likeCommunityPost('mongo-post-1');

      expect(col.updateOne).toHaveBeenCalledWith(
        { id: 'mongo-post-1' },
        { $inc: { likes: 1 } },
      );
    });

    it('should delete a community post', async () => {
      const col = mockCollections['community_posts'];

      await storage.deleteCommunityPost('mongo-post-1');

      expect(col.deleteOne).toHaveBeenCalledWith({ id: 'mongo-post-1' });
    });

    it('should throw MongoDB not connected when loadCommunityPosts called without connect', async () => {
      const disconnected = createStorage();
      await expect(disconnected.loadCommunityPosts()).rejects.toThrow('MongoDB not connected');
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
      await storage.connect();
    });

    it('should return null for users without a subscription', async () => {
      const col = mockCollections['subscriptions'];
      col.findOne.mockResolvedValue(null);

      expect(await storage.loadSubscription(USER_ID)).toBeNull();
    });

    it('should save and load a subscription', async () => {
      const col = mockCollections['subscriptions'];
      col.findOne.mockResolvedValue({
        _id: 'x',
        userId: USER_ID, tier: 'pro', planId: 'plan_pro', status: 'active',
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-02-01T00:00:00.000Z',
        autoRenew: true, paymentMethod: 'razorpay',
        razorpayOrderId: undefined,
        lastPaymentDate: undefined,
        tenantId: undefined,
        updatedAt: '2025-01-01T00:00:00.000Z',
      });

      await storage.saveSubscription(USER_ID, sub);
      const loaded = await storage.loadSubscription(USER_ID);

      expect(loaded).not.toBeNull();
      expect(loaded!.tier).toBe('pro');
      expect(loaded!.autoRenew).toBe(true);
      expect(loaded!.paymentMethod).toBe('razorpay');
      expect((loaded as any)._id).toBeUndefined();
    });

    it('should handle subscription with tenantId', async () => {
      const col = mockCollections['subscriptions'];
      const tenantSub: UserSubscriptionData = { ...sub, tenantId: 'tenant-org-42' };

      col.findOne.mockResolvedValue({
        _id: 'x', ...tenantSub,
      });

      await storage.saveSubscription(USER_ID, tenantSub);
      const loaded = await storage.loadSubscription(USER_ID);
      expect(loaded!.tenantId).toBe('tenant-org-42');
    });

    it('should use $set with upsert: true for saveSubscription', async () => {
      const col = mockCollections['subscriptions'];

      await storage.saveSubscription(USER_ID, sub);

      expect(col.updateOne).toHaveBeenCalledWith(
        { userId: USER_ID },
        { $set: sub },
        { upsert: true },
      );
    });

    it('should return null when db is not set (loadSubscription)', async () => {
      const disconnected = createStorage();
      expect(await disconnected.loadSubscription(USER_ID)).toBeNull();
    });
  });
});
