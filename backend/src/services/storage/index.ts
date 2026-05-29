/**
 * ============================================================================
 * Toroloom Storage Engine Factory
 * ============================================================================
 *
 * Creates the active StorageEngine based on the STORAGE_BACKEND env var:
 *   'memory'   → InMemoryStorage (default, no deps)
 *   'postgres' → PostgreSQLStorage (requires pg package + DATABASE_URL)
 *   'mongodb'  → MongoDBStorage  (requires mongodb package + MONGODB_URI)
 *
 * Usage:
 *   import { storage } from '../services/storage';
 *   await storage.appendEvent({ ... });
 *   const profile = await storage.loadRiskProfile('user_123');
 * ============================================================================
 */

import { env } from '../../config/env';
import { InMemoryStorage } from './inMemory';
import type { StorageEngine } from './types';

let storageInstance: StorageEngine | null = null;

/**
 * Get (or create) the active storage engine.
 * Lazy-initialized on first call so the server can start without
 * a database connection for non-storage operations.
 */
export async function getStorage(): Promise<StorageEngine> {
  if (storageInstance) return storageInstance;

  const backend = env.storageBackend;

  switch (backend) {
    case 'postgres': {
      const { PostgreSQLStorage } = await import('./postgres');
      storageInstance = new PostgreSQLStorage(env.databaseUrl);
      break;
    }
    case 'mongodb': {
      const { MongoDBStorage } = await import('./mongodb');
      storageInstance = new MongoDBStorage(env.mongodbUri, env.mongodbDbName);
      break;
    }
    case 'memory':
    default: {
      storageInstance = new InMemoryStorage();
      break;
    }
  }

  await storageInstance.connect();
  return storageInstance;
}

/**
 * Get the active storage engine without initializing.
 * Returns null if not yet initialized.
 */
export function getStorageIfInitialized(): StorageEngine | null {
  return storageInstance;
}

/**
 * Reset the storage engine (for testing).
 */
export function resetStorage(): void {
  storageInstance = null;
}

/**
 * Get the active backend type name (for observability).
 */
export function getStorageBackend(): string {
  return env.storageBackend;
}
