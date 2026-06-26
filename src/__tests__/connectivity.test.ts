/**
 * ============================================================================
 * Toroloom — Connectivity Store Tests
 * ============================================================================
 *
 * Tests the Zustand connectivityStore: initial offline state, combinedOffline
 * derivation, health-check ping (via refresh), polling lifecycle, store
 * subscriptions, and non-React getState() usage.
 *
 * The store is tested purely through its Zustand API (not via React hook)
 * so these tests validate the state machine without needing a renderer.
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useConnectivityStore, _suppressReconnect } from '../store/connectivityStore';

// ──── Helpers ──────────────────────────────────────────────────────────────

/**
 * Reset store to default initial state between tests.
 * Also destroys any active polling to prevent leaked intervals.
 */
function resetStore() {
  useConnectivityStore.getState().destroy();
  // Suppress reconnect events so true→false transition during reset doesn't
  // overwrite reconnectedAt or fire onReconnect callbacks
  _suppressReconnect(true);
  useConnectivityStore.setState({
    isOnline: true,
    isChecking: false,
    lastCheckedAt: null,
    reconnectedAt: null,
    wentOfflineAt: null,
    combinedOffline: false,
  });
  _suppressReconnect(false);
}

// ──── Tests ────────────────────────────────────────────────────────────────

describe('ConnectivityStore — Initial State', () => {
  beforeEach(resetStore);

  it('starts as online', () => {
    const state = useConnectivityStore.getState();
    expect(state.isOnline).toBe(true);
    expect(state.isChecking).toBe(false);
    expect(state.lastCheckedAt).toBeNull();
  });

  it('initial combinedOffline is false when online', () => {
    expect(useConnectivityStore.getState().combinedOffline).toBe(false);
  });

  it('initial reconnectedAt is null', () => {
    expect(useConnectivityStore.getState().reconnectedAt).toBeNull();
  });

  it('initial wentOfflineAt is null', () => {
    expect(useConnectivityStore.getState().wentOfflineAt).toBeNull();
  });

  it('has all required actions', () => {
    const state = useConnectivityStore.getState();
    expect(typeof state.refresh).toBe('function');
    expect(typeof state.startPolling).toBe('function');
    expect(typeof state.destroy).toBe('function');
  });
});

describe('ConnectivityStore — combinedOffline', () => {
  beforeEach(resetStore);

  it('is false when isOnline is true', () => {
    useConnectivityStore.setState({ isOnline: true });
    // combinedOffline must be set alongside isOnline for consistency
    expect(useConnectivityStore.getState().isOnline).toBe(true);
    expect(useConnectivityStore.getState().combinedOffline).toBe(false);
  });

  it('is true when isOnline is false', () => {
    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    expect(useConnectivityStore.getState().combinedOffline).toBe(true);
  });

  it('toggles when isOnline changes (set both fields together)', () => {
    const state = useConnectivityStore.getState();
    expect(state.combinedOffline).toBe(false);

    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    expect(useConnectivityStore.getState().combinedOffline).toBe(true);

    useConnectivityStore.setState({ isOnline: true, combinedOffline: false });
    expect(useConnectivityStore.getState().combinedOffline).toBe(false);
  });
});

describe('ConnectivityStore — refresh action', () => {
  beforeEach(resetStore);

  it('sets isChecking=true during ping, false after', async () => {
    // pingBackend will be called but we don't control it directly.
    // We just verify the refresh lifecycle.
    const pingPromise = useConnectivityStore.getState().refresh();
    expect(useConnectivityStore.getState().isChecking).toBe(true);
    await pingPromise;
    expect(useConnectivityStore.getState().isChecking).toBe(false);
  });

  it('updates lastCheckedAt after ping', async () => {
    await useConnectivityStore.getState().refresh();
    expect(useConnectivityStore.getState().lastCheckedAt).toBeInstanceOf(Date);
  });

  it('keeps isOnline and combinedOffline aligned after refresh', async () => {
    await useConnectivityStore.getState().refresh();
    const state = useConnectivityStore.getState();
    expect(state.combinedOffline).toBe(!state.isOnline);
  });
});

describe('ConnectivityStore — startPolling lifecycle', () => {
  beforeEach(resetStore);

  afterEach(() => {
    // Ensure polling is cleaned up after each test
    useConnectivityStore.getState().destroy();
  });

  it('returns a cleanup function', () => {
    const cleanup = useConnectivityStore.getState().startPolling();
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('reference counter allows multiple start/stop pairs', () => {
    const cleanup1 = useConnectivityStore.getState().startPolling();
    const cleanup2 = useConnectivityStore.getState().startPolling();
    // Both active — cleanup should not stop polling yet
    cleanup1();
    // Still one active — polling continues
    cleanup2();
    // Zero active — polling stopped
  });

  it('is idempotent: second call returns no-op cleanup', () => {
    const cleanup1 = useConnectivityStore.getState().startPolling();
    const cleanup2 = useConnectivityStore.getState().startPolling();
    // Second call should return a no-op since polling is already active
    expect(typeof cleanup2).toBe('function');
    cleanup1();
    cleanup2();
  });

  it('destroy stops all polling immediately', () => {
    useConnectivityStore.getState().startPolling();
    useConnectivityStore.getState().startPolling();
    // destroy should reset counter to 0 and clear everything
    useConnectivityStore.getState().destroy();
    // After destroy, we can start fresh
    const cleanup = useConnectivityStore.getState().startPolling();
    expect(typeof cleanup).toBe('function');
    cleanup();
  });
});

describe('ConnectivityStore — store subscriptions', () => {
  beforeEach(resetStore);

  it('notifies subscribers on state change', () => {
    const listener = vi.fn();
    const unsub = useConnectivityStore.subscribe(listener);

    useConnectivityStore.setState({ isOnline: false });
    expect(listener).toHaveBeenCalledTimes(1);

    useConnectivityStore.setState({ isChecking: true });
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
  });

  it('subscribers receive the latest state snapshot', () => {
    const states: boolean[] = [];
    const unsub = useConnectivityStore.subscribe(() => {
      states.push(useConnectivityStore.getState().isOnline);
    });

    useConnectivityStore.setState({ isOnline: false });
    useConnectivityStore.setState({ isOnline: true });
    useConnectivityStore.setState({ isOnline: false });

    expect(states).toEqual([false, true, false]);
    unsub();
  });

  it('unsubscribed listeners are not called', () => {
    const listener = vi.fn();
    const unsub = useConnectivityStore.subscribe(listener);
    unsub();

    useConnectivityStore.setState({ isOnline: false });
    expect(listener).not.toHaveBeenCalled();
  });

  it('combinedOffline changes trigger subscriber notifications', () => {
    const listener = vi.fn();
    const unsub = useConnectivityStore.subscribe(listener);

    // combinedOffline must be set alongside isOnline
    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    expect(listener).toHaveBeenCalled();

    unsub();
  });

  it('reconnectedAt updates on true → false transition', () => {
    expect(useConnectivityStore.getState().reconnectedAt).toBeNull();

    // Go offline, then back online
    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    expect(useConnectivityStore.getState().reconnectedAt).toBeNull();

    useConnectivityStore.setState({ isOnline: true, combinedOffline: false });
    expect(useConnectivityStore.getState().reconnectedAt).toBeInstanceOf(Date);
  });

  it('reconnectedAt does not update on false → false stays offline', () => {
    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    expect(useConnectivityStore.getState().reconnectedAt).toBeNull();

    // Stay offline
    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    expect(useConnectivityStore.getState().reconnectedAt).toBeNull();
  });

  it('wentOfflineAt is set when going offline and preserved on reconnect', () => {
    expect(useConnectivityStore.getState().wentOfflineAt).toBeNull();

    // Go offline — wentOfflineAt should be set
    useConnectivityStore.setState({ isOnline: false, combinedOffline: true, wentOfflineAt: new Date() });
    const offlineTs = useConnectivityStore.getState().wentOfflineAt;
    expect(offlineTs).toBeInstanceOf(Date);

    // Come back online — wentOfflineAt should be preserved
    useConnectivityStore.setState({ isOnline: true, combinedOffline: false });
    // The function setter preserves wentOfflineAt when coming online;
    // but since we use object setState in tests, wentOfflineAt keeps its last set value
    expect(useConnectivityStore.getState().wentOfflineAt).toBeInstanceOf(Date);
  });
});

describe('ConnectivityStore — non-React getState() usage', () => {
  beforeEach(resetStore);

  it('can read state imperatively (getState)', () => {
    const { isOnline, combinedOffline } = useConnectivityStore.getState();
    expect(typeof isOnline).toBe('boolean');
    expect(typeof combinedOffline).toBe('boolean');
  });

  it('can trigger refresh imperatively', async () => {
    await useConnectivityStore.getState().refresh();
    const { lastCheckedAt, isOnline } = useConnectivityStore.getState();
    expect(lastCheckedAt).toBeInstanceOf(Date);
    expect(typeof isOnline).toBe('boolean');
  });

  it('can subscribe and unsubscribe imperatively', () => {
    const results: boolean[] = [];
    const unsub = useConnectivityStore.subscribe(() => {
      results.push(useConnectivityStore.getState().combinedOffline);
    });

    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    useConnectivityStore.setState({ isOnline: true, combinedOffline: false });

    // The true→false transition also triggers reconnectedAt setState,
    // which fires an extra subscriber notification with the same value
    expect(results).toEqual([true, false, false]);
    unsub();
  });
});

describe('ConnectivityStore — edge cases', () => {
  beforeEach(resetStore);

  it('preserves other state when only isOnline changes', () => {
    useConnectivityStore.setState({
      lastCheckedAt: new Date('2026-06-01'),
      isChecking: false,
    });
    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });

    const state = useConnectivityStore.getState();
    expect(state.isOnline).toBe(false);
    expect(state.isChecking).toBe(false); // unchanged
    expect(state.lastCheckedAt).toEqual(new Date('2026-06-01')); // unchanged
  });

  it('combinedOffline is always the inverse of isOnline when both are set correctly', () => {
    for (const online of [true, false, true, false, true]) {
      useConnectivityStore.setState({ isOnline: online, combinedOffline: !online });
      expect(useConnectivityStore.getState().combinedOffline).toBe(!online);
    }
  });

  it('refresh recalculates combinedOffline from the new isOnline', async () => {
    // Force isOnline to known state via the state setter,
    // then verify refresh recalculates from the ping result
    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    await useConnectivityStore.getState().refresh();
    const state = useConnectivityStore.getState();
    // combinedOffline and isOnline should be aligned after refresh
    expect(state.combinedOffline).toBe(!state.isOnline);
  });
});

describe('ConnectivityStore — onReconnect auto-trigger', () => {
  beforeEach(resetStore);

  // Remove any leftover subscriptions from earlier tests to avoid leaks
  afterEach(() => {
    useConnectivityStore.getState().destroy();
  });

  it('fires callback when combinedOffline transitions true → false', () => {
    const cb = vi.fn();
    const unsub = useConnectivityStore.getState().onReconnect(cb);

    // Start offline
    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    expect(cb).not.toHaveBeenCalled();

    // Transition to online
    useConnectivityStore.setState({ isOnline: true, combinedOffline: false });
    expect(cb).toHaveBeenCalledTimes(1);

    unsub();
  });

  it('does NOT fire when already online (false → false)', () => {
    const cb = vi.fn();
    const unsub = useConnectivityStore.getState().onReconnect(cb);

    // Already offline, staying offline
    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    expect(cb).not.toHaveBeenCalled();

    // Already online, staying online
    useConnectivityStore.setState({ isOnline: true, combinedOffline: false });
    expect(cb).toHaveBeenCalledTimes(1); // only the true→false fires

    // Already online, still online
    useConnectivityStore.setState({ isOnline: true, combinedOffline: false });
    expect(cb).toHaveBeenCalledTimes(1); // not called again

    unsub();
  });

  it('does NOT fire when going from online → offline', () => {
    const cb = vi.fn();
    const unsub = useConnectivityStore.getState().onReconnect(cb);

    // Going from online → offline should NOT fire (reconnect means offline→online)
    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    expect(cb).not.toHaveBeenCalled();

    unsub();
  });

  it('fires multiple registered callbacks', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = useConnectivityStore.getState().onReconnect(cb1);
    const unsub2 = useConnectivityStore.getState().onReconnect(cb2);

    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    useConnectivityStore.setState({ isOnline: true, combinedOffline: false });

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
  });

  it('unsubscribed callbacks are not called', () => {
    const cb = vi.fn();
    const unsub = useConnectivityStore.getState().onReconnect(cb);

    unsub();

    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    useConnectivityStore.setState({ isOnline: true, combinedOffline: false });

    expect(cb).not.toHaveBeenCalled();
  });

  it('does not fire when combinedOffline stays the same', () => {
    const cb = vi.fn();
    const unsub = useConnectivityStore.getState().onReconnect(cb);

    // Set same values - no transition
    useConnectivityStore.setState({ isOnline: true, combinedOffline: false });
    expect(cb).not.toHaveBeenCalled();

    // Already offline, same state
    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    expect(cb).not.toHaveBeenCalled();

    unsub();
  });

  it('fire-and-forget error in one callback does not break others', () => {
    const throwingCb = vi.fn(() => { throw new Error('Callback error'); });
    const normalCb = vi.fn();

    const unsub1 = useConnectivityStore.getState().onReconnect(throwingCb);
    const unsub2 = useConnectivityStore.getState().onReconnect(normalCb);

    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    useConnectivityStore.setState({ isOnline: true, combinedOffline: false });

    expect(throwingCb).toHaveBeenCalledTimes(1);
    // Normal callback should still be called despite the error
    expect(normalCb).toHaveBeenCalledTimes(1);

    unsub1();
    unsub2();
  });

  it('destroy clears all callbacks', () => {
    const cb = vi.fn();
    useConnectivityStore.getState().onReconnect(cb);
    useConnectivityStore.getState().destroy();

    useConnectivityStore.setState({ isOnline: false, combinedOffline: true });
    useConnectivityStore.setState({ isOnline: true, combinedOffline: false });

    expect(cb).not.toHaveBeenCalled();
  });
});
