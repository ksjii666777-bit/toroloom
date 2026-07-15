/**
 * ============================================================================
 * Toroloom — Telegram Persistence Module
 * ============================================================================
 *
 * Wraps the StorageEngine interface for Telegram user link persistence.
 * Follows the same pattern as SnapTrade persistence (configureSnapTradePersistence).
 *
 * Usage:
 *   import { configureTelegramPersistence, loadLink, saveLink, deleteLink }
 *     from '../services/telegramPersistence';
 *
 *   configureTelegramPersistence(storage);
 *   const link = await loadLink('user_123');
 *   await saveLink('user_123', { ... });
 *
 * ============================================================================
 */

import type { StorageEngine, TelegramLinkData } from './storage/types';

let storage: StorageEngine | null = null;

/**
 * Configure the Telegram persistence layer with a StorageEngine.
 * Call this during server startup AFTER storage is initialized.
 */
export function configureTelegramPersistence(s: StorageEngine): void {
  storage = s;
}

/**
 * Load a Telegram link for a user.
 * Returns null if no link exists.
 */
export async function loadLink(userId: string): Promise<TelegramLinkData | null> {
  if (!storage) return null;
  return storage.loadTelegramLink(userId);
}

/**
 * Save (insert or overwrite) a Telegram link for a user.
 */
export async function saveLink(
  userId: string,
  link: TelegramLinkData,
): Promise<void> {
  if (!storage) return;
  await storage.saveTelegramLink(userId, link);
}

/**
 * Delete a Telegram link for a user.
 */
export async function deleteLink(userId: string): Promise<void> {
  if (!storage) return;
  await storage.deleteTelegramLink(userId);
}

/**
 * Load ALL Telegram links from storage (used to hydrate the bot's
 * in-memory cache after a server restart so previously-linked users
 * don't have to re-link).
 */
export async function loadAllLinks(): Promise<TelegramLinkData[]> {
  if (!storage) return [];
  return storage.loadAllTelegramLinks();
}


