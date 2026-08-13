/**
 * ============================================================================
 * Toroloom — Offline Refresh Service
 * ============================================================================
 *
 * Shared helper that re-fetches all offline-aware stores after connectivity is
 * restored. Lives in services/ so both OfflineModal and OfflineBanner (and any
 * future consumer) can use it without importing each other.
 *
 * Usage:
 *   import { refreshAllStores } from '../services/offlineRefresh';
 *   const ok = await refreshAllStores();
 * ============================================================================
 */

import { usePortfolioStore } from '../store/portfolioStore';
import { useWatchlistStore } from '../store/watchlistStore';
import { useMarketStore } from '../store/marketStore';
import { useEducationStore } from '../store/educationStore';
import { useFnoStore } from '../store/fnoStore';
import { useCommunityStore } from '../store/communityStore';
import { useAIStore } from '../store/aiStore';
import { log } from '../utils/logger';

/**
 * Synchronised re-fetch across all offline-aware stores.
 * Resolves true when at least one store refreshed successfully.
 */
export async function refreshAllStores(): Promise<boolean> {
  try {
    const results = await Promise.allSettled([
      usePortfolioStore.getState().refreshPortfolio(),
      useWatchlistStore.getState().fetchWatchlists(),
      useMarketStore.getState().refreshMarket(),
      useEducationStore.getState().fetchCourses(),
      useFnoStore.getState().fetchPositions(),
      useFnoStore.getState().fetchSpotPrices(),
      useCommunityStore.getState().fetchPosts(),
      useAIStore.getState().fetchInsights(),
    ]);
    return results.some(r => r.status === 'fulfilled');
  } catch (err) {
    log.warn('[offlineRefresh] refreshAllStores error:', err);
    return false;
  }
}
