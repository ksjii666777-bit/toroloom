/**
 * ============================================================================
 * Toroloom Notification Service — Unit Tests
 * ============================================================================
 *
 * Tests the complete notification lifecycle with an InMemoryStorage backend:
 *   1. Configure persistence — wiring storage into the module
 *   2. Mock data migration — automatic migration when storage is configured
 *   3. Get notifications — with and without storage
 *   4. Mark single notification as read
 *   5. Mark all notifications as read for a user
 *   6. Save new notifications (create + update)
 *   7. Notifications are per-user isolated
 *   8. Notifications ordered most-recent-first
 *   9. Reset notification service (teardown for testing)
 *  10. Delete notification (via storage directly)
 *
 * IMPORTANT: resetNotificationService() permanently empties the module-level
 * mockNotifications array (const array mutated via length = 0). Therefore we
 * use TWO describe blocks:
 *   - 1st: "Initial Mock Data" — runs WITHOUT reset, uses pristine module state
 *   - 2nd: "Storage-backed Operations" — runs WITH reset via beforeEach
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/notifications.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorage } from '../services/storage/inMemory';
import {
  configureNotificationPersistence,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  saveNotification,
  resetNotificationService,
  getNotificationStorage,
} from '../services/notifications';
import type { NotificationData } from '../services/storage/types';

// ============================================================================
// Describe 1: Initial Mock Data (no reset — uses pristine module state)
// ============================================================================

describe('Notification Service — Initial Mock Data', () => {
  it('should start with no storage configured', () => {
    expect(getNotificationStorage()).toBeNull();
  });

  it('should return fallback mock notifications when no storage is configured', async () => {
    const notifs = await getNotifications('user_1');
    expect(notifs.length).toBeGreaterThan(0);
    expect(notifs.every((n) => n.userId === 'user_1')).toBe(true);
  });

  it('should return empty array for unknown user with no storage', async () => {
    const notifs = await getNotifications('non_existent_user');
    expect(notifs).toHaveLength(0);
  });

  it('should sort fallback notifications by timestamp descending', async () => {
    const notifs = await getNotifications('user_1');
    for (let i = 1; i < notifs.length; i++) {
      expect(notifs[i - 1].timestamp >= notifs[i].timestamp).toBe(true);
    }
  });
});

// ============================================================================
// Describe 2: Storage-backed Operations (reset in beforeEach for clean state)
// ============================================================================

describe('Notification Service — Storage-backed Operations', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    resetNotificationService();
  });

  // ==================== Configure Persistence ====================

  it('should configure storage and make it accessible', async () => {
    await configureNotificationPersistence(storage);
    expect(getNotificationStorage()).toBe(storage);
  });

  it('should not persist anything when no mock data exists after reset', async () => {
    // After resetNotificationService() in beforeEach, mock data is cleared.
    // Thus configureNotificationPersistence migrates nothing.
    await configureNotificationPersistence(storage);
    const notifs = await getNotifications('any_user');
    expect(notifs).toHaveLength(0);
  });

  it('should not migrate mock data again on repeated configuration', async () => {
    await configureNotificationPersistence(storage);
    // Storage is fresh — nothing migrated since mock data was cleared
    const countAfterFirst = (await storage.loadNotifications('user_1')).length;
    expect(countAfterFirst).toBe(0);

    // Re-configure with a new storage
    const storage2 = new InMemoryStorage();
    await configureNotificationPersistence(storage2);
    expect(await storage2.loadNotifications('user_1')).toHaveLength(0);
  });

  // ==================== Get Notifications (with storage) ====================

  it('should return empty array for user with no notifications', async () => {
    await configureNotificationPersistence(storage);
    const notifs = await getNotifications('unknown_user');
    expect(notifs).toHaveLength(0);
  });

  // ==================== Save Notification ====================

  it('should save a new notification and retrieve it', async () => {
    await configureNotificationPersistence(storage);

    const notif: NotificationData = {
      id: 'new-notif-001',
      userId: 'test_user',
      type: 'price_alert',
      title: 'Test Alert',
      message: 'Test message content',
      read: false,
      timestamp: new Date().toISOString(),
    };

    await saveNotification(notif);
    const retrieved = await getNotifications('test_user');
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].id).toBe('new-notif-001');
    expect(retrieved[0].title).toBe('Test Alert');
    expect(retrieved[0].read).toBe(false);
  });

  it('should update an existing notification on save with same id', async () => {
    await configureNotificationPersistence(storage);

    await saveNotification({
      id: 'update-test', userId: 'update_user', type: 'trade',
      title: 'Original', message: 'Original msg', read: false,
      timestamp: new Date().toISOString(),
    });

    await saveNotification({
      id: 'update-test', userId: 'update_user', type: 'trade',
      title: 'Updated', message: 'Updated msg', read: true,
      timestamp: new Date().toISOString(),
    });

    const notifs = await getNotifications('update_user');
    expect(notifs).toHaveLength(1);
    expect(notifs[0].title).toBe('Updated');
    expect(notifs[0].read).toBe(true);
  });

  // ==================== Mark Notification as Read ====================

  it('should mark a single notification as read', async () => {
    await configureNotificationPersistence(storage);

    await saveNotification({
      id: 'mark-read-1', userId: 'read_user', type: 'system',
      title: 'Read Test', message: 'Test', read: false,
      timestamp: new Date().toISOString(),
    });

    await markNotificationRead('mark-read-1');
    const notifs = await getNotifications('read_user');
    expect(notifs[0].read).toBe(true);
  });

  it('should not throw when marking non-existent notification as read', async () => {
    await configureNotificationPersistence(storage);
    await expect(markNotificationRead('non-existent-id')).resolves.not.toThrow();
  });

  // ==================== Mark All Notifications as Read ====================

  it('should mark all notifications for a user as read', async () => {
    await configureNotificationPersistence(storage);

    await saveNotification({ id: 'm-all-1', userId: 'mark_all_user', type: 'trade', title: 'T1', message: 'M1', read: false, timestamp: new Date().toISOString() });
    await saveNotification({ id: 'm-all-2', userId: 'mark_all_user', type: 'news', title: 'T2', message: 'M2', read: false, timestamp: new Date().toISOString() });
    await saveNotification({ id: 'm-all-3', userId: 'mark_all_user', type: 'system', title: 'T3', message: 'M3', read: false, timestamp: new Date().toISOString() });

    await markAllNotificationsRead('mark_all_user');
    const notifs = await getNotifications('mark_all_user');
    expect(notifs).toHaveLength(3);
    notifs.forEach((n) => expect(n.read).toBe(true));
  });

  it('should not mark other users notifications as read', async () => {
    await configureNotificationPersistence(storage);

    await saveNotification({ id: 'm-other-1', userId: 'user_a', type: 'trade', title: 'A', message: 'A', read: false, timestamp: new Date().toISOString() });
    await saveNotification({ id: 'm-other-2', userId: 'user_b', type: 'trade', title: 'B', message: 'B', read: false, timestamp: new Date().toISOString() });

    await markAllNotificationsRead('user_a');
    expect((await getNotifications('user_a'))[0].read).toBe(true);
    expect((await getNotifications('user_b'))[0].read).toBe(false);
  });

  it('should not throw when marking all for non-existent user', async () => {
    await configureNotificationPersistence(storage);
    await expect(markAllNotificationsRead('ghost_user')).resolves.not.toThrow();
  });

  // ==================== Per-User Isolation ====================

  it('should isolate notifications between different users', async () => {
    await configureNotificationPersistence(storage);

    await saveNotification({ id: 'iso-1', userId: 'alpha', type: 'trade', title: 'Alpha', message: 'Msg', read: false, timestamp: new Date().toISOString() });
    await saveNotification({ id: 'iso-2', userId: 'beta', type: 'news', title: 'Beta', message: 'Msg', read: false, timestamp: new Date().toISOString() });

    expect((await getNotifications('alpha'))).toHaveLength(1);
    expect((await getNotifications('alpha'))[0].id).toBe('iso-1');
    expect((await getNotifications('beta'))).toHaveLength(1);
    expect((await getNotifications('beta'))[0].id).toBe('iso-2');
  });

  // ==================== Ordering ====================

  it('should return notifications in reverse chronological order', async () => {
    await configureNotificationPersistence(storage);

    await saveNotification({ id: 'ord-1', userId: 'order_user', type: 'trade', title: 'Old', message: 'Oldest', read: false, timestamp: '2025-01-01T00:00:00.000Z' });
    await saveNotification({ id: 'ord-2', userId: 'order_user', type: 'news', title: 'Mid', message: 'Middle', read: false, timestamp: '2025-06-01T00:00:00.000Z' });
    await saveNotification({ id: 'ord-3', userId: 'order_user', type: 'system', title: 'New', message: 'Newest', read: false, timestamp: '2025-12-01T00:00:00.000Z' });

    const notifs = await getNotifications('order_user');
    expect(notifs).toHaveLength(3);
    expect(notifs[0].id).toBe('ord-3');
    expect(notifs[1].id).toBe('ord-2');
    expect(notifs[2].id).toBe('ord-1');
  });

  // ==================== Save Without Storage ====================

  it('should save notification in memory even without storage configured', async () => {
    const notif: NotificationData = {
      id: 'no-storage-1', userId: 'no_storage_user', type: 'system',
      title: 'No Storage', message: 'Should work in memory', read: false,
      timestamp: new Date().toISOString(),
    };

    await saveNotification(notif);
    const notifs = await getNotifications('no_storage_user');
    expect(notifs).toHaveLength(1);
    expect(notifs[0].id).toBe('no-storage-1');
  });

  // ==================== Reset ====================

  it('should reset the service to initial state', async () => {
    await configureNotificationPersistence(storage);
    expect(getNotificationStorage()).not.toBeNull();

    await saveNotification({ id: 'reset-1', userId: 'reset_user', type: 'trade', title: 'T', message: 'M', read: false, timestamp: new Date().toISOString() });
    expect((await getNotifications('reset_user')).length).toBeGreaterThan(0);

    resetNotificationService();
    expect(getNotificationStorage()).toBeNull();
    expect(await getNotifications('reset_user')).toHaveLength(0);
  });

  // ==================== Delete Notification (via storage) ====================

  it('should delete a notification from storage', async () => {
    await configureNotificationPersistence(storage);

    await saveNotification({ id: 'del-1', userId: 'del_user', type: 'trade', title: 'Delete', message: 'Me', read: false, timestamp: new Date().toISOString() });

    expect(await getNotifications('del_user')).toHaveLength(1);
    await storage.deleteNotification('del-1');
    expect(await getNotifications('del_user')).toHaveLength(0);
  });

  // ==================== Edge Cases ====================

  it('should handle concurrent mark read operations', async () => {
    await configureNotificationPersistence(storage);

    await saveNotification({ id: 'concurrent-1', userId: 'con_user', type: 'trade', title: 'Concurrent', message: 'Test', read: false, timestamp: new Date().toISOString() });
    await saveNotification({ id: 'concurrent-2', userId: 'con_user', type: 'news', title: 'Concurrent 2', message: 'Test 2', read: false, timestamp: new Date().toISOString() });

    await Promise.all([
      markNotificationRead('concurrent-1'),
      markNotificationRead('concurrent-2'),
    ]);

    const notifs = await getNotifications('con_user');
    expect(notifs).toHaveLength(2);
    notifs.forEach((n) => expect(n.read).toBe(true));
  });

  it('should support all notification types', async () => {
    await configureNotificationPersistence(storage);

    const types: Array<'price_alert' | 'trade' | 'news' | 'system' | 'educational'> = [
      'price_alert', 'trade', 'news', 'system', 'educational',
    ];

    for (let i = 0; i < types.length; i++) {
      await saveNotification({
        id: `type-test-${i}`, userId: 'type_user', type: types[i],
        title: `Type: ${types[i]}`, message: `Msg for ${types[i]}`,
        read: false, timestamp: new Date().toISOString(),
      });
    }

    const notifs = await getNotifications('type_user');
    expect(notifs).toHaveLength(types.length);

    const savedTypes = notifs.map((n) => n.type).sort();
    expect(savedTypes).toEqual([...types].sort());
  });
});
