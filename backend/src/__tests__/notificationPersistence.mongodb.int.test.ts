/**
 * ============================================================================
 * Toroloom Notification Persistence — MongoDB Integration
 * ============================================================================
 *
 * Validates the full notification lifecycle against a real MongoDB
 * database, following the brokerFactoryFlow pattern:
 *
 *   1. configureNotificationPersistence() — wire storage into the module
 *   2. saveNotification() / getNotifications() — business logic persists to DB
 *   3. Direct storage read — verify data was persisted
 *
 * Environment:
 *   MONGODB_URI      — defaults to Docker Compose connection string
 *   MONGODB_DB_NAME  — defaults to 'toroloom_test'
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/notificationPersistence.mongodb.int.test.ts
 *
 * Skip:
 *   Tests skip automatically if MongoDB is unreachable.
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoDBStorage } from '../services/storage/mongodb';
import { CONNECT_TIMEOUT } from './testUtils';
import {
  configureNotificationPersistence,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  saveNotification,
  resetNotificationService,
} from '../services/notifications';
import type { NotificationData } from '../services/storage/types';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://toroloom:toroloom_dev@localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'toroloom_test';

describe('Notification Persistence — MongoDB', () => {
  let storage: MongoDBStorage;
  let available = true;

  beforeAll(async () => {
    storage = new MongoDBStorage(MONGODB_URI, MONGODB_DB_NAME);
    try {
      await Promise.race([
        storage.connect(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error(`connect timeout (${CONNECT_TIMEOUT}ms)`)), CONNECT_TIMEOUT),
        ),
      ]);
    } catch (err: any) {
      console.warn(
        `⚠ MongoDB not available (${err.message}) — skipping Notification Persistence + Mongo tests`,
      );
      available = false;
    }
  }, 30_000);

  afterAll(async () => {
    if (available && storage) {
      await storage.clearForTesting();
      await storage.disconnect();
    }
  });

  beforeEach(async () => {
    if (!available) return;
    await storage.clearForTesting();
    resetNotificationService();
  });

  // ──────────────── 1. Configure + Notifications Empty ────────────────

  it('should return empty notifications for a user with no persisted data', async () => {
    if (!available) return;

    await configureNotificationPersistence(storage);
    const notifs = await getNotifications('test_user_empty');
    expect(notifs).toHaveLength(0);
  });

  // ──────────────── 2. Save + Load Notification ────────────────

  it('should persist a notification and retrieve it for the correct user', async () => {
    if (!available) return;

    await configureNotificationPersistence(storage);

    const notif: NotificationData = {
      id: 'notif-test-001',
      userId: 'test_user_a',
      type: 'price_alert',
      title: 'Test Alert',
      message: 'RELIANCE crossed ₹3,000',
      read: false,
      timestamp: new Date().toISOString(),
    };

    await saveNotification(notif);

    // Verify via business logic (service layer)
    const userNotifs = await getNotifications('test_user_a');
    expect(userNotifs).toHaveLength(1);
    expect(userNotifs[0].id).toBe('notif-test-001');
    expect(userNotifs[0].title).toBe('Test Alert');
    expect(userNotifs[0].read).toBe(false);

    // Verify directly in the database
    const directNotifs = await storage.loadNotifications('test_user_a');
    expect(directNotifs).toHaveLength(1);
    expect(directNotifs[0].id).toBe('notif-test-001');
  });

  // ──────────────── 3. Notifications Are Per-User ────────────────

  it('should isolate notifications between different users', async () => {
    if (!available) return;

    await configureNotificationPersistence(storage);

    await saveNotification({
      id: 'notif-u1-001', userId: 'user_one', type: 'trade', title: 'Trade 1', message: 'Msg 1',
      read: false, timestamp: new Date().toISOString(),
    });
    await saveNotification({
      id: 'notif-u2-001', userId: 'user_two', type: 'news', title: 'News 1', message: 'Msg 2',
      read: false, timestamp: new Date().toISOString(),
    });

    const userOneNotifs = await getNotifications('user_one');
    expect(userOneNotifs).toHaveLength(1);
    expect(userOneNotifs[0].id).toBe('notif-u1-001');

    const userTwoNotifs = await getNotifications('user_two');
    expect(userTwoNotifs).toHaveLength(1);
    expect(userTwoNotifs[0].id).toBe('notif-u2-001');
  });

  // ──────────────── 4. Mark Single Notification as Read ────────────────

  it('should mark a single notification as read and persist the change', async () => {
    if (!available) return;

    await configureNotificationPersistence(storage);

    await saveNotification({
      id: 'notif-read-001', userId: 'user_read', type: 'system', title: 'Test', message: 'Read test',
      read: false, timestamp: new Date().toISOString(),
    });

    // Mark as read
    await markNotificationRead('notif-read-001');

    // Verify via service
    const notifs = await getNotifications('user_read');
    expect(notifs[0].read).toBe(true);

    // Verify directly in DB
    const direct = await storage.loadNotifications('user_read');
    expect(direct[0].read).toBe(true);
  });

  // ──────────────── 5. Mark All Notifications as Read ────────────────

  it('should mark all notifications for a user as read', async () => {
    if (!available) return;

    await configureNotificationPersistence(storage);

    await saveNotification({ id: 'n-mar-1', userId: 'user_mark_all', type: 'trade', title: 'T1', message: 'M1', read: false, timestamp: new Date().toISOString() });
    await saveNotification({ id: 'n-mar-2', userId: 'user_mark_all', type: 'news', title: 'T2', message: 'M2', read: false, timestamp: new Date().toISOString() });
    await saveNotification({ id: 'n-mar-3', userId: 'user_mark_all', type: 'system', title: 'T3', message: 'M3', read: false, timestamp: new Date().toISOString() });

    await markAllNotificationsRead('user_mark_all');

    const notifs = await getNotifications('user_mark_all');
    expect(notifs).toHaveLength(3);
    notifs.forEach((n) => expect(n.read).toBe(true));
  });

  // ──────────────── 6. Notifications Ordered Most Recent First ────────────────

  it('should return notifications in reverse chronological order', async () => {
    if (!available) return;

    await configureNotificationPersistence(storage);

    // Timestamps: oldest first, newest last
    await saveNotification({ id: 'n-ord-1', userId: 'user_order', type: 'trade', title: 'Old', message: 'Oldest', read: false, timestamp: '2025-01-01T00:00:00.000Z' });
    await saveNotification({ id: 'n-ord-2', userId: 'user_order', type: 'news', title: 'Mid', message: 'Middle', read: false, timestamp: '2025-06-01T00:00:00.000Z' });
    await saveNotification({ id: 'n-ord-3', userId: 'user_order', type: 'system', title: 'New', message: 'Newest', read: false, timestamp: '2025-12-01T00:00:00.000Z' });

    const notifs = await getNotifications('user_order');
    expect(notifs).toHaveLength(3);
    expect(notifs[0].id).toBe('n-ord-3'); // Newest first
    expect(notifs[1].id).toBe('n-ord-2');
    expect(notifs[2].id).toBe('n-ord-1'); // Oldest last
  });

  // ──────────────── 7. Delete Notification ────────────────

  it('should delete a notification and no longer return it', async () => {
    if (!available) return;

    await configureNotificationPersistence(storage);

    await saveNotification({ id: 'n-del-1', userId: 'user_del', type: 'trade', title: 'Delete Me', message: 'Gone', read: false, timestamp: new Date().toISOString() });

    // Confirm it exists
    expect(await getNotifications('user_del')).toHaveLength(1);

    await storage.deleteNotification('n-del-1');

    // Verify gone
    expect(await getNotifications('user_del')).toHaveLength(0);
  });
});
