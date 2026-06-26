/**
 * ============================================================================
 * Toroloom — useConnectivity Hook
 * ============================================================================
 *
 * Thin React wrapper around the connectivity Zustand store.
 * Enables convenient selector-based usage in React components.
 *
 * For non-React code, use the store directly:
 *   import { useConnectivityStore } from '../store/connectivityStore';
 *   const { isOnline } = useConnectivityStore.getState();
 *   useConnectivityStore.getState().refresh();
 *
 * Usage (React):
 *   const isOnline = useConnectivity().isOnline;
 *   const { combinedOffline, refresh } = useConnectivity();
 *
 * ============================================================================
 */

import { useEffect } from 'react';
import { useConnectivityStore } from '../store/connectivityStore';

/**
 * React hook that subscribes to the connectivity store.
 * The store's health-check polling is started once on mount and
 * cleaned up on unmount.
 */
export function useConnectivity() {
  // Subscribe to all store fields so the component re-renders on any change
  const isOnline = useConnectivityStore(s => s.isOnline);
  const isChecking = useConnectivityStore(s => s.isChecking);
  const lastCheckedAt = useConnectivityStore(s => s.lastCheckedAt);
  const refresh = useConnectivityStore(s => s.refresh);
  const combinedOffline = useConnectivityStore(s => s.combinedOffline);

  // Start polling once on mount, stop on unmount
  useEffect(() => {
    const cleanup = useConnectivityStore.getState().startPolling();
    return cleanup;
  }, []);

  return { isOnline, isChecking, lastCheckedAt, combinedOffline, refresh };
}
