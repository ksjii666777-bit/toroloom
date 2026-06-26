/**
 * ============================================================================
 * Toroloom — Connectivity Store (Zustand)
 * ============================================================================
 *
 * Single source of truth for app connectivity — accessible from both React
 * components (via useConnectivityStore hook or selectors) and non-React code
 * (via useConnectivityStore.getState()).
 *
 * Features:
 *   - Backend health-check polling (60s interval)
 *   - Combined offline state (!isOnline)
 *   - Immediate check on app foreground
 *   - Manual refresh trigger
 *   - On-reconnect callback registration (fires when combinedOffline → false)
 *
 * Usage (React):
 *   const isOnline = useConnectivityStore(s => s.isOnline);
 *   const { combinedOffline, refresh } = useConnectivityStore();
 *
 * Usage (non-React):
 *   import { useConnectivityStore } from '../store/connectivityStore';
 *   const { isOnline } = useConnectivityStore.getState();
 *   useConnectivityStore.getState().refresh();
 *   const unsub = useConnectivityStore.getState().onReconnect(myCallback);
 * ============================================================================
 */

import { create } from 'zustand';
import { AppState, AppStateStatus } from 'react-native';
import { getBaseUrl } from '../services/api/client';

// ──── Constants ────────────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 60_000; // 60 seconds
const TIMEOUT_MS = 5_000; // 5 seconds

// ──── State & Actions ──────────────────────────────────────────────────────

interface ConnectivityState {
  /** Backend health-check succeeded */
  isOnline: boolean;
  /** True when health-check is in progress */
  isChecking: boolean;
  /** Timestamp of last health-check */
  lastCheckedAt: Date | null;
  /** Timestamp of the most recent offline→online transition (for analytics). */
  reconnectedAt: Date | null;
  /** Timestamp when combinedOffline was last set to true (for duration tracking). */
  wentOfflineAt: Date | null;
  /**
   * Combined offline state: true when the backend is unreachable
   * (health check failed). Use this instead of per-store isOffline flags.
   */
  combinedOffline: boolean;

  /** Manually trigger a connectivity check */
  refresh: () => Promise<void>;
  /** Start the periodic health-check polling (called once at app init) */
  startPolling: () => () => void;
  /** Cleanup: stop polling and remove app state listener */
  destroy: () => void;
  /**
   * Register a callback that fires when combinedOffline transitions
   * from true → false (i.e. backend just came back online).
   * Returns an unsubscribe function.
   */
  onReconnect: (cb: () => void) => () => void;
}

let _intervalRef: ReturnType<typeof setInterval> | null = null;
let _appStateRef: AppStateStatus = 'active';
let _subscription: { remove: () => void } | null = null;
let _activePollingCount = 0;

// ──── Reconnect callbacks (module-level Set) ───────────────────────────────
// Fired whenever combinedOffline transitions true → false, regardless of
// what triggered the change (health-check, foreground, or manual setState).
const _reconnectCallbacks = new Set<() => void>();
let _suppressReconnectEvents = false; // Set to true during test resetStore()

async function pingBackend(): Promise<boolean> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return true; // Assume online if not configured (dev mode)

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${baseUrl.replace(/\/api$/, '')}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  isOnline: true,
  isChecking: false,
  lastCheckedAt: null,
  reconnectedAt: null,
  wentOfflineAt: null,
  combinedOffline: false, // Assume online until a health check proves otherwise

  refresh: async () => {
    set({ isChecking: true });
    const online = await pingBackend();
    set((state) => ({
      isOnline: online,
      isChecking: false,
      lastCheckedAt: new Date(),
      combinedOffline: !online,
      wentOfflineAt: !online ? new Date() : state.wentOfflineAt,
    }));
  },

  startPolling: () => {
    _activePollingCount++;

    // If polling is already active, just return a no-op cleanup
    if (_activePollingCount > 1) {
      return () => {
        _activePollingCount--;
      };
    }

    // Initial check
    set({ isChecking: true });
    pingBackend().then((online) => {
      set((state) => ({
        isOnline: online,
        isChecking: false,
        lastCheckedAt: new Date(),
        combinedOffline: !online,
        wentOfflineAt: !online ? new Date() : state.wentOfflineAt,
      }));
    });

    // Periodic check
    _intervalRef = setInterval(() => {
      pingBackend().then((online) => {
        set((state) => ({
          isOnline: online,
          lastCheckedAt: new Date(),
          combinedOffline: !online,
          wentOfflineAt: !online ? new Date() : state.wentOfflineAt,
        }));
      });
    }, CHECK_INTERVAL_MS);

    // Listen for app foreground events
    _subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (_appStateRef.match(/inactive|background/) && nextState === 'active') {
        pingBackend().then((online) => {
          set((state) => ({
            isOnline: online,
            lastCheckedAt: new Date(),
            combinedOffline: !online,
            wentOfflineAt: !online ? new Date() : state.wentOfflineAt,
          }));
        });
      }
      _appStateRef = nextState;
    });

    // Return cleanup function
    return () => {
      _activePollingCount--;
      if (_activePollingCount > 0) return; // another consumer still needs it
      if (_intervalRef) clearInterval(_intervalRef);
      if (_subscription) _subscription.remove();
      _intervalRef = null;
      _subscription = null;
    };
  },

  destroy: () => {
    _activePollingCount = 0;
    _reconnectCallbacks.clear();
    if (_intervalRef) clearInterval(_intervalRef);
    if (_subscription) _subscription.remove();
    _intervalRef = null;
    _subscription = null;
  },

  onReconnect: (cb: () => void) => {
    _reconnectCallbacks.add(cb);
    return () => {
      _reconnectCallbacks.delete(cb);
    };
  },
}));

// ──── Internal subscription: fire reconnect callbacks on true→false ────────
// Must be registered after create() since it references the store.
useConnectivityStore.subscribe((state, prev) => {
  if (!_suppressReconnectEvents && prev.combinedOffline && !state.combinedOffline) {
    // Record analytics timestamp
    useConnectivityStore.setState({ reconnectedAt: new Date() });
    // Fire registered callbacks
    if (_reconnectCallbacks.size > 0) {
      _reconnectCallbacks.forEach(cb => {
        try { cb(); } catch { /* don't let one bad callback break others */ }
      });
    }
  }
});

// ──── Internal-only: suppress reconnect events during reset ────────────────
export function _suppressReconnect(active: boolean) {
  _suppressReconnectEvents = active;
}
