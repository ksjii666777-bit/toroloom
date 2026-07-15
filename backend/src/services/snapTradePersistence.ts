/**
 * ============================================================================
 * Toroloom — SnapTrade Persistence Module
 * ============================================================================
 *
 * Wraps the StorageEngine interface for SnapTrade connection persistence.
 * Follows the same pattern as broker persistence (configureBrokerPersistence).
 *
 * Usage:
 *   import { configureSnapTradePersistence, loadConnection, saveConnection }
 *     from '../services/snapTradePersistence';
 *
 *   configureSnapTradePersistence(storage);
 *   const conn = await loadConnection('user_123');
 *   await saveConnection('user_123', { ... });
 *
 * ============================================================================
 */

import type { StorageEngine, SnapTradeConnectionData } from './storage/types';

let storage: StorageEngine | null = null;

/**
 * Configure the SnapTrade persistence layer with a StorageEngine.
 * Call this during server startup AFTER storage is initialized.
 */
export function configureSnapTradePersistence(s: StorageEngine): void {
  storage = s;
}

/**
 * Load a SnapTrade connection for a user.
 * Returns null if no connection exists.
 */
export async function loadConnection(userId: string): Promise<SnapTradeConnectionData | null> {
  if (!storage) return null;
  return storage.loadSnapTradeConnection(userId);
}

/**
 * Save (insert or overwrite) a SnapTrade connection for a user.
 */
export async function saveConnection(
  userId: string,
  connection: SnapTradeConnectionData,
): Promise<void> {
  if (!storage) return;
  await storage.saveSnapTradeConnection(userId, connection);
}

/**
 * Delete a SnapTrade connection for a user.
 */
export async function deleteConnection(userId: string): Promise<void> {
  if (!storage) return;
  await storage.deleteSnapTradeConnection(userId);
}
