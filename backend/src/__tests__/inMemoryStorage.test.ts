/**
 * ============================================================================
 * Toroloom — InMemoryStorage Unit Tests
 * ============================================================================
 *
 * Covers ALL methods of the InMemoryStorage engine without any external
 * database dependencies. These tests run in any environment, unlike the
 * integration tests (*.int.test.ts) that require PostgreSQL / MongoDB.
 *
 * Domains tested:
 *   1. Audit Trail    — append, query, get, count, clear
 *   2. Risk Profiles  — load, save, delete
 *   3. Badge Counts   — load, save
 *   4. Broker State   — load, save
 *   5. Notifications  — save, load, mark read, delete
 *   6. Community      — save post, load, like, delete
 *   7. Subscriptions  — load, save
 *   8. Lifecycle      — connect, disconnect, isHealthy
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/inMemoryStorage.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorage } from '../services/storage/inMemory';

describe('InMemoryStorage', () => {
  let storage: InMemoryStorage;

  const USER_ID = 'user-test-001';
  const USER_EMAIL = 'test@toroloom.app';

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Audit Trail
  // ─────────────────────────────────────────────────────────────────────────

  describe('Audit Trail', () => {
    it('should start with zero events', async () => {
      const count = await storage.getEventCount();
      expect(count).toBe(0);
    });

    it('should append and return an event', async () => {
      const event = await storage.appendEvent({
        id: 'evt-001',
        userId: USER_ID,
        eventType: 'LOGIN',
        timestamp: new Date().toISOString(),
        data: { email: USER_EMAIL },
        previousHash: '',
        hash: 'abc123',
      });
      expect(event.id).toBe('evt-001');
      expect(event.userId).toBe(USER_ID);
      expect(event.eventType).toBe('LOGIN');
    });

    it('should get the latest event', async () => {
      await storage.appendEvent({
        id: 'evt-001', userId: USER_ID, eventType: 'LOGIN',
        timestamp: '2025-01-01T00:00:00.000Z', data: {},
        previousHash: '', hash: 'a',
      });
      await storage.appendEvent({
        id: 'evt-002', userId: USER_ID, eventType: 'LOGOUT',
        timestamp: '2025-01-01T01:00:00.000Z', data: {},
        previousHash: 'a', hash: 'b',
      });

      const latest = await storage.getLatestEvent();
      expect(latest?.id).toBe('evt-002');
      expect(latest?.eventType).toBe('LOGOUT');
    });

    it('should return null for latest event when empty', async () => {
      const latest = await storage.getLatestEvent();
      expect(latest).toBeNull();
    });

    it('should count events correctly', async () => {
      await storage.appendEvent({ id: '1', userId: USER_ID, eventType: 'LOGIN', timestamp: '2025-01-01T00:00:00.000Z', data: {}, previousHash: '', hash: 'a' });
      await storage.appendEvent({ id: '2', userId: USER_ID, eventType: 'LOGIN', timestamp: '2025-01-01T00:01:00.000Z', data: {}, previousHash: 'a', hash: 'b' });
      await storage.appendEvent({ id: '3', userId: USER_ID, eventType: 'LOGOUT', timestamp: '2025-01-01T01:00:00.000Z', data: {}, previousHash: 'b', hash: 'c' });

      expect(await storage.getEventCount()).toBe(3);
    });

    it('should query events by userId', async () => {
      await storage.appendEvent({ id: '1', userId: USER_ID, eventType: 'LOGIN', timestamp: '2025-01-01T00:00:00.000Z', data: {}, previousHash: '', hash: 'a' });
      await storage.appendEvent({ id: '2', userId: 'other-user', eventType: 'LOGIN', timestamp: '2025-01-01T00:00:00.000Z', data: {}, previousHash: '', hash: 'b' });

      const results = await storage.queryEvents({ userId: USER_ID });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('should query events by eventType', async () => {
      await storage.appendEvent({ id: '1', userId: USER_ID, eventType: 'LOGIN', timestamp: '2025-01-01T00:00:00.000Z', data: {}, previousHash: '', hash: 'a' });
      await storage.appendEvent({ id: '2', userId: USER_ID, eventType: 'ORDER_EXECUTION', timestamp: '2025-01-01T00:01:00.000Z', data: {}, previousHash: 'a', hash: 'b' });
      await storage.appendEvent({ id: '3', userId: USER_ID, eventType: 'LOGOUT', timestamp: '2025-01-01T01:00:00.000Z', data: {}, previousHash: 'b', hash: 'c' });

      const results = await storage.queryEvents({ eventType: 'LOGIN' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('should query events with startTime and endTime', async () => {
      await storage.appendEvent({ id: '1', userId: USER_ID, eventType: 'LOGIN', timestamp: '2025-01-01T00:00:00.000Z', data: {}, previousHash: '', hash: 'a' });
      await storage.appendEvent({ id: '2', userId: USER_ID, eventType: 'ORDER_EXECUTION', timestamp: '2025-01-01T12:00:00.000Z', data: {}, previousHash: 'a', hash: 'b' });
      await storage.appendEvent({ id: '3', userId: USER_ID, eventType: 'LOGOUT', timestamp: '2025-01-02T00:00:00.000Z', data: {}, previousHash: 'b', hash: 'c' });

      const results = await storage.queryEvents({
        startTime: '2025-01-01T06:00:00.000Z',
        endTime: '2025-01-01T18:00:00.000Z',
      });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2');
    });

    it('should query events with pagination (offset + limit)', async () => {
      for (let i = 0; i < 10; i++) {
        await storage.appendEvent({ id: `evt-${i}`, userId: USER_ID, eventType: 'LOGIN', timestamp: `2025-01-01T00:0${i}:00.000Z`, data: {}, previousHash: `${i}`, hash: `${i}h` });
      }

      const results = await storage.queryEvents({ offset: 2, limit: 3 });
      expect(results).toHaveLength(3);
      // Results are reverse chronological, so offset 2 skips the 2 most recent
      expect(results[0].id).toBe('evt-7');
      expect(results[2].id).toBe('evt-5');
    });

    it('should query events with array eventType filter', async () => {
      await storage.appendEvent({ id: '1', userId: USER_ID, eventType: 'LOGIN', timestamp: '2025-01-01T00:00:00.000Z', data: {}, previousHash: '', hash: 'a' });
      await storage.appendEvent({ id: '2', userId: USER_ID, eventType: 'ORDER_EXECUTION', timestamp: '2025-01-01T00:01:00.000Z', data: {}, previousHash: 'a', hash: 'b' });
      await storage.appendEvent({ id: '3', userId: USER_ID, eventType: 'LOGOUT', timestamp: '2025-01-01T01:00:00.000Z', data: {}, previousHash: 'b', hash: 'c' });

      const results = await storage.queryEvents({ eventType: ['LOGIN', 'LOGOUT'] });
      expect(results).toHaveLength(2);
    });

    it('should get a single event by id', async () => {
      await storage.appendEvent({ id: 'evt-001', userId: USER_ID, eventType: 'LOGIN', timestamp: '2025-01-01T00:00:00.000Z', data: {}, previousHash: '', hash: 'a' });

      const found = await storage.getEvent('evt-001');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('evt-001');

      const notFound = await storage.getEvent('non-existent');
      expect(notFound).toBeNull();
    });

    it('should return all events in insertion order', async () => {
      await storage.appendEvent({ id: '1', userId: USER_ID, eventType: 'LOGIN', timestamp: '2025-01-01T00:00:00.000Z', data: {}, previousHash: '', hash: 'a' });
      await storage.appendEvent({ id: '2', userId: USER_ID, eventType: 'LOGOUT', timestamp: '2025-01-02T00:00:00.000Z', data: {}, previousHash: 'a', hash: 'b' });

      const all = await storage.getAllEvents();
      expect(all).toHaveLength(2);
      expect(all[0].id).toBe('1');
      expect(all[1].id).toBe('2');
    });

    it('should clear all events for testing', async () => {
      await storage.appendEvent({ id: '1', userId: USER_ID, eventType: 'LOGIN', timestamp: '2025-01-01T00:00:00.000Z', data: {}, previousHash: '', hash: 'a' });
      await storage.clearForTesting();

      expect(await storage.getEventCount()).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Risk Profiles
  // ─────────────────────────────────────────────────────────────────────────

  describe('Risk Profiles', () => {
    const riskProfile = {
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
      updatedAt: new Date().toISOString(),
    };

    it('should return null for non-existent profile', async () => {
      const profile = await storage.loadRiskProfile('unknown-user');
      expect(profile).toBeNull();
    });

    it('should save and load a risk profile', async () => {
      await storage.saveRiskProfile(riskProfile);

      const loaded = await storage.loadRiskProfile(USER_ID);
      expect(loaded).not.toBeNull();
      expect(loaded!.userId).toBe(USER_ID);
      expect(loaded!.dailyLossLimit).toBe(50000);
      expect(loaded!.lockdown.status).toBe('none');
    });

    it('should overwrite existing profile on save', async () => {
      await storage.saveRiskProfile(riskProfile);
      await storage.saveRiskProfile({ ...riskProfile, dailyLossLimit: 100000 });

      const loaded = await storage.loadRiskProfile(USER_ID);
      expect(loaded!.dailyLossLimit).toBe(100000);
    });

    it('should delete a risk profile', async () => {
      await storage.saveRiskProfile(riskProfile);
      await storage.deleteRiskProfile(USER_ID);

      const loaded = await storage.loadRiskProfile(USER_ID);
      expect(loaded).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Badge Counts
  // ─────────────────────────────────────────────────────────────────────────

  describe('Badge Counts', () => {
    it('should return 0 for users without a saved count', async () => {
      const count = await storage.loadBadgeCount(USER_ID);
      expect(count).toBe(0);
    });

    it('should save and load a badge count', async () => {
      await storage.saveBadgeCount(USER_ID, 5);
      expect(await storage.loadBadgeCount(USER_ID)).toBe(5);
    });

    it('should overwrite badge count on repeated save', async () => {
      await storage.saveBadgeCount(USER_ID, 3);
      await storage.saveBadgeCount(USER_ID, 7);
      expect(await storage.loadBadgeCount(USER_ID)).toBe(7);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Broker State
  // ─────────────────────────────────────────────────────────────────────────

  describe('Broker State', () => {
    it('should return empty state by default', async () => {
      const state = await storage.loadBrokerState();
      expect(state.currentBrokerType).toBeNull();
      expect(state.dedupCache).toEqual({});
    });

    it('should save and load broker state', async () => {
      await storage.saveBrokerState({
        currentBrokerType: 'zerodha',
        dedupCache: { zerodha: { lastEvent: 'BROKER_CONNECTED', timestamp: Date.now() } },
      });

      const loaded = await storage.loadBrokerState();
      expect(loaded.currentBrokerType).toBe('zerodha');
      expect(loaded.dedupCache.zerodha.lastEvent).toBe('BROKER_CONNECTED');
    });

    it('should overwrite broker state on repeated save', async () => {
      await storage.saveBrokerState({ currentBrokerType: 'zerodha', dedupCache: {} });
      await storage.saveBrokerState({ currentBrokerType: 'angel', dedupCache: {} });

      const loaded = await storage.loadBrokerState();
      expect(loaded.currentBrokerType).toBe('angel');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Notifications
  // ─────────────────────────────────────────────────────────────────────────

  describe('Notifications', () => {
    it('should return empty array for users with no notifications', async () => {
      const notifications = await storage.loadNotifications(USER_ID);
      expect(notifications).toEqual([]);
    });

    it('should save and load notifications (most recent first)', async () => {
      await storage.saveNotification({
        id: 'n1', userId: USER_ID, type: 'price_alert', title: 'Alert 1', message: 'Message 1',
        read: false, timestamp: '2025-01-02T00:00:00.000Z',
      });
      await storage.saveNotification({
        id: 'n2', userId: USER_ID, type: 'trade', title: 'Alert 2', message: 'Message 2',
        read: true, timestamp: '2025-01-03T00:00:00.000Z',
      });

      const notifications = await storage.loadNotifications(USER_ID);
      expect(notifications).toHaveLength(2);
      expect(notifications[0].id).toBe('n2'); // Most recent first
      expect(notifications[1].id).toBe('n1');
    });

    it('should not load other users notifications', async () => {
      await storage.saveNotification({
        id: 'n1', userId: 'other-user', type: 'price_alert', title: 'Other', message: 'Other msg',
        read: false, timestamp: '2025-01-01T00:00:00.000Z',
      });

      const notifications = await storage.loadNotifications(USER_ID);
      expect(notifications).toEqual([]);
    });

    it('should mark a single notification as read', async () => {
      await storage.saveNotification({
        id: 'n1', userId: USER_ID, type: 'price_alert', title: 'Alert', message: 'Msg',
        read: false, timestamp: '2025-01-01T00:00:00.000Z',
      });

      await storage.markNotificationRead('n1');

      const notifications = await storage.loadNotifications(USER_ID);
      expect(notifications[0].read).toBe(true);
    });

    it('should mark all notifications as read for a user', async () => {
      await storage.saveNotification({
        id: 'n1', userId: USER_ID, type: 'price_alert', title: 'A1', message: 'M1',
        read: false, timestamp: '2025-01-01T00:00:00.000Z',
      });
      await storage.saveNotification({
        id: 'n2', userId: USER_ID, type: 'trade', title: 'A2', message: 'M2',
        read: false, timestamp: '2025-01-02T00:00:00.000Z',
      });

      await storage.markAllNotificationsRead(USER_ID);

      const notifications = await storage.loadNotifications(USER_ID);
      expect(notifications.every(n => n.read)).toBe(true);
    });

    it('should delete a notification by id', async () => {
      await storage.saveNotification({
        id: 'n1', userId: USER_ID, type: 'price_alert', title: 'A1', message: 'M1',
        read: false, timestamp: '2025-01-01T00:00:00.000Z',
      });

      await storage.deleteNotification('n1');

      const notifications = await storage.loadNotifications(USER_ID);
      expect(notifications).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Community
  // ─────────────────────────────────────────────────────────────────────────

  describe('Community', () => {
    it('should return empty array when no posts exist', async () => {
      const posts = await storage.loadCommunityPosts();
      expect(posts).toEqual([]);
    });

    it('should save and load community posts (most recent first)', async () => {
      await storage.saveCommunityPost({
        id: 'p1', userId: USER_ID, userName: 'Test User', content: 'Post 1',
        likes: 0, comments: 0, timestamp: '2025-01-01T00:00:00.000Z', tags: ['stocks'],
      });
      await storage.saveCommunityPost({
        id: 'p2', userId: USER_ID, userName: 'Test User', content: 'Post 2',
        likes: 5, comments: 2, timestamp: '2025-01-02T00:00:00.000Z', tags: ['mutual-funds'],
      });

      const posts = await storage.loadCommunityPosts();
      expect(posts).toHaveLength(2);
      expect(posts[0].id).toBe('p2'); // Most recent first
      expect(posts[0].likes).toBe(5);
    });

    it('should load a single post by id', async () => {
      await storage.saveCommunityPost({
        id: 'p1', userId: USER_ID, userName: 'Test User', content: 'Hello',
        likes: 0, comments: 0, timestamp: '2025-01-01T00:00:00.000Z', tags: [],
      });

      const found = await storage.loadCommunityPost('p1');
      expect(found).not.toBeNull();
      expect(found!.content).toBe('Hello');

      const notFound = await storage.loadCommunityPost('nonexistent');
      expect(notFound).toBeNull();
    });

    it('should increment likes on a post', async () => {
      await storage.saveCommunityPost({
        id: 'p1', userId: USER_ID, userName: 'Test User', content: 'Post',
        likes: 3, comments: 1, timestamp: '2025-01-01T00:00:00.000Z', tags: [],
      });
      await storage.likeCommunityPost('p1');

      const post = await storage.loadCommunityPost('p1');
      expect(post!.likes).toBe(4);
    });

    it('should delete a community post', async () => {
      await storage.saveCommunityPost({
        id: 'p1', userId: USER_ID, userName: 'Test User', content: 'Post',
        likes: 0, comments: 0, timestamp: '2025-01-01T00:00:00.000Z', tags: [],
      });
      await storage.deleteCommunityPost('p1');

      const posts = await storage.loadCommunityPosts();
      expect(posts).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Subscriptions
  // ─────────────────────────────────────────────────────────────────────────

  describe('Subscriptions', () => {
    it('should return null for users without a subscription', async () => {
      const sub = await storage.loadSubscription(USER_ID);
      expect(sub).toBeNull();
    });

    it('should save and load a subscription', async () => {
      await storage.saveSubscription(USER_ID, {
        userId: USER_ID, tier: 'pro', planId: 'plan_pro', status: 'active',
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-02-01T00:00:00.000Z',
        autoRenew: true, paymentMethod: 'razorpay', updatedAt: '2025-01-01T00:00:00.000Z',
      });

      const loaded = await storage.loadSubscription(USER_ID);
      expect(loaded).not.toBeNull();
      expect(loaded!.tier).toBe('pro');
      expect(loaded!.autoRenew).toBe(true);
    });

    it('should overwrite existing subscription on save', async () => {
      await storage.saveSubscription(USER_ID, {
        userId: USER_ID, tier: 'pro', planId: 'plan_pro', status: 'active',
        startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-02-01T00:00:00.000Z',
        autoRenew: true, updatedAt: '2025-01-01T00:00:00.000Z',
      });
      await storage.saveSubscription(USER_ID, {
        userId: USER_ID, tier: 'elite', planId: 'plan_elite', status: 'active',
        startDate: '2025-02-01T00:00:00.000Z', endDate: '2026-02-01T00:00:00.000Z',
        autoRenew: true, paymentMethod: 'razorpay', updatedAt: '2025-02-01T00:00:00.000Z',
      });

      const loaded = await storage.loadSubscription(USER_ID);
      expect(loaded!.tier).toBe('elite');
    });

    it('should handle subscriptions with tenantId', async () => {
      await storage.saveSubscription(USER_ID, {
        userId: USER_ID, tier: 'elite', planId: 'plan_elite', status: 'active',
        startDate: '2025-01-01T00:00:00.000Z', endDate: '2026-01-01T00:00:00.000Z',
        autoRenew: true, tenantId: 'tenant-org-42', updatedAt: '2025-01-01T00:00:00.000Z',
      });

      const loaded = await storage.loadSubscription(USER_ID);
      expect(loaded!.tenantId).toBe('tenant-org-42');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  describe('Lifecycle', () => {
    it('should connect without errors', async () => {
      await expect(storage.connect()).resolves.toBeUndefined();
    });

    it('should report healthy status', async () => {
      const healthy = await storage.isHealthy();
      expect(healthy).toBe(true);
    });

    it('should clear all data on disconnect', async () => {
      // Add some data
      await storage.saveBadgeCount(USER_ID, 5);
      await storage.appendEvent({ id: '1', userId: USER_ID, eventType: 'LOGIN', timestamp: '2025-01-01T00:00:00.000Z', data: {}, previousHash: '', hash: 'a' });

      await storage.disconnect();

      expect(await storage.loadBadgeCount(USER_ID)).toBe(0);
      expect(await storage.getEventCount()).toBe(0);
    });
  });
});
