/**
 * ============================================================================
 * Toroloom — useCacheInvalidation Hook
 * ============================================================================
 *
 * Listens for `cache_invalidate` messages pushed by the backend via WebSocket
 * when mutations are applied through the sync API. On receiving a push
 * invalidation, the hook clears the relevant offline cache entries, ensuring
 * the next read fetches fresh data from the server.
 *
 * This is the client-side half of the push-based invalidation system:
 *   Server (POST /api/sync) → broadcastInvalidation() → WebSocket
 *   Client (this hook)     → onCacheInvalidationCallback  → offlineCache.remove()
 *
 * Usage:
 *   // At app root (single call)
 *   useCacheInvalidation();
 *
 * ============================================================================
 */

import { useEffect, useRef } from 'react';
import { getActiveWS } from '../services/wsRegistry';
import { offlineCache } from '../services/offlineCache';
import { getCacheNamespace } from '../../backend/src/constants/cacheNamespaces';
import { log } from '../utils/logger';

// ──── Hook ─────────────────────────────────────────────────────────────────

export function useCacheInvalidation(): void {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (registeredRef.current) return;
    registeredRef.current = true;

    const ws = getActiveWS();

    ws.onCacheInvalidationCallback(async (data) => {
      const { entities, namespaces } = data;

      // Clear cache for each affected namespace
      const namespacesToClear = namespaces ?? [
        ...new Set(entities.map((e) => getCacheNamespace(e.entityType))),
      ];

      if (namespacesToClear.length === 0) return;

      log.info('[CacheInvalidation] Received push invalidation:', {
        entities: entities.length,
        namespaces: namespacesToClear,
      });

      // Fire-and-forget: clear all affected cache namespaces in parallel
      await Promise.allSettled(
        namespacesToClear.map((ns) => offlineCache.remove(ns)),
      );

      // Log per-entity details for debugging
      for (const entity of entities) {
        log.info(
          `[CacheInvalidation] Entity changed: ${entity.entityType}:${entity.entityId}`,
        );
      }
    });
  }, []);
}
