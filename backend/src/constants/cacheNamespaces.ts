/**
 * ============================================================================
 * Toroloom — Cache Namespace Mapping (Shared)
 * ============================================================================
 *
 * Authoritative mapping from sync entity types to offline cache namespaces.
 *
 * **This is the single source of truth.** Both the backend and frontend
 * import this file — the mapping must NOT be duplicated elsewhere.
 *
 * Backend consumer:  src/services/syncInvalidationBridge.ts
 * Frontend consumer: src/hooks/useCacheInvalidation.ts (via ../../backend/src/constants/cacheNamespaces)
 *
 * When adding a new entity type, update ONLY this file and both sides
 * will automatically stay in sync.
 *
 * ============================================================================
 */

/**
 * Maps sync entity types to offline cache namespaces.
 * When an entity is mutated, the client clears the corresponding cache.
 */
export const ENTITY_TO_CACHE_NAMESPACE: Record<string, string> = {
  position: 'portfolio',
  order: 'openOrders',
  watchlist: 'watchlist',
  watchlist_stock: 'watchlist',
} as const;

/**
 * Get the cache namespace for a given entity type.
 * Falls back to the entity type itself if no mapping exists.
 */
export function getCacheNamespace(entityType: string): string {
  return ENTITY_TO_CACHE_NAMESPACE[entityType] ?? entityType;
}
