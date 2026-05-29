/**
 * ============================================================================
 * Toroloom Notification Service
 * ============================================================================
 *
 * Manages notification persistence via a pluggable StorageEngine.
 * Follows the same pattern as the broker factory (configure → use → persist).
 *
 * Usage:
 *   import { configureNotificationPersistence, getNotifications } from './services/notifications';
 *   configureNotificationPersistence(storage);
 *   const notifs = await getNotifications('user_1');
 * ============================================================================
 */

import type { StorageEngine, NotificationData } from '../storage/types';

// ==================== Types ====================

export type NotificationType = 'price_alert' | 'trade' | 'news' | 'system' | 'educational';

// ==================== Internal State ====================

/** Optional StorageEngine for persisting notifications. */
let notificationStorage: StorageEngine | null = null;

// Fallback mock data for when no storage is configured
const mockNotifications: NotificationData[] = [
  { id: 'n1', userId: 'user_1', type: 'price_alert', title: 'Price Alert: RELIANCE', message: 'RELIANCE crossed ₹2,890. Target 1 achieved! 🎯', read: false, timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: 'n2', userId: 'user_1', type: 'trade', title: 'Trade Executed', message: 'Buy order for 50 RELIANCE @ ₹2,890 executed successfully.', read: false, timestamp: new Date(Date.now() - 7200000).toISOString() },
  { id: 'n3', userId: 'user_1', type: 'educational', title: 'New Lesson Available', message: 'Next lesson "Advanced Chart Patterns" is ready for you!', read: true, timestamp: new Date(Date.now() - 86400000).toISOString() },
  { id: 'n4', userId: 'user_1', type: 'news', title: 'Market News: RBI Policy', message: 'RBI keeps repo rate unchanged at 6.50%. Markets react positively.', read: true, timestamp: new Date(Date.now() - 172800000).toISOString() },
  { id: 'n5', userId: 'user_1', type: 'system', title: 'KYC Update', message: 'Your KYC documents have been verified successfully! ✅', read: true, timestamp: new Date(Date.now() - 259200000).toISOString() },
];

// Track if we've initialized mock into storage
let mockInitialized = false;

// ==================== Public API ====================

/**
 * Configure the notification service with a StorageEngine for persistence.
 * When called, any existing mock data is migrated to the storage backend.
 */
export async function configureNotificationPersistence(storage: StorageEngine): Promise<void> {
  notificationStorage = storage;

  // Migrate mock data on first configuration
  if (!mockInitialized) {
    for (const notif of mockNotifications) {
      await storage.saveNotification(notif);
    }
    mockInitialized = true;
  }
}

/**
 * Get the notifications for a user, most recent first.
 * Uses storage if configured, otherwise returns fallback mock data.
 */
export async function getNotifications(userId: string): Promise<NotificationData[]> {
  if (notificationStorage) {
    return notificationStorage.loadNotifications(userId);
  }
  return mockNotifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(id: string): Promise<void> {
  if (notificationStorage) {
    await notificationStorage.markNotificationRead(id);
  }
  const notif = mockNotifications.find((n) => n.id === id);
  if (notif) notif.read = true;
}

/**
 * Mark all notifications for a user as read.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (notificationStorage) {
    await notificationStorage.markAllNotificationsRead(userId);
  }
  mockNotifications
    .filter((n) => n.userId === userId)
    .forEach((n) => { n.read = true; });
}

/**
 * Save a new notification.
 */
export async function saveNotification(notification: NotificationData): Promise<void> {
  if (notificationStorage) {
    await notificationStorage.saveNotification(notification);
  }
  const idx = mockNotifications.findIndex((n) => n.id === notification.id);
  if (idx >= 0) {
    mockNotifications[idx] = notification;
  } else {
    mockNotifications.push(notification);
  }
}

/**
 * Reset the notification service (for testing).
 */
export function resetNotificationService(): void {
  notificationStorage = null;
  mockNotifications.length = 0;
  mockInitialized = false;
}

/**
 * Get the notification storage engine (for testing).
 */
export function getNotificationStorage(): StorageEngine | null {
  return notificationStorage;
}
