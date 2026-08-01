/**
 * ============================================================================
 * Toroloom — useCommodityPrices Hook Tests (WS-unavailable regression)
 * ============================================================================
 *
 * Regression tests for the null-WebSocket guard added to useCommodityPrices.
 * When getActiveWS() returns null (no active WS service — e.g. AppNavigator
 * test mocks or a future refactor), the hook must:
 *   1. NOT crash on mount
 *   2. Skip connect / subscribe / callback registration
 *   3. Stay safe across the 5s reconnection poll
 *   4. Unmount cleanly without leaking cleanup
 *
 * Previously (pre-guard) the hook called ws.connect(), ws.onConnectionChangeCallback(),
 * and ws.getIsAuthenticated() unguarded → TypeError whenever WS was unavailable.
 */

import { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from './testUtils';
import { useCommodityPrices } from '../hooks/useCommodityPrices';

// ── Hoisted: null-returning WS mock ──────────────────────────
// getActiveWS always resolves to null — the exact "WS unavailable" state
// that used to crash the hook.
const { mockGetActiveWS, mockSetWSMode, mockGetWSMode } = vi.hoisted(() => ({
  mockGetActiveWS: vi.fn(() => null),
  mockSetWSMode: vi.fn(),
  mockGetWSMode: vi.fn(() => 'real'),
}));

vi.mock('../services/wsRegistry', () => ({
  getActiveWS: mockGetActiveWS,
  setWSMode: mockSetWSMode,
  getWSMode: mockGetWSMode,
}));

// No API base URL → detectBackend() short-circuits to false (no real fetch).
vi.mock('../services/api/client', () => ({
  getBaseUrl: vi.fn(() => ''),
}));

// ── Test Harness ─────────────────────────────────────────────
let harnessResult: ReturnType<typeof useCommodityPrices>;

function Harness() {
  harnessResult = useCommodityPrices();
  return null;
}

describe('useCommodityPrices — WS Unavailable (getActiveWS → null)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not crash when getActiveWS returns null', async () => {
    await act(async () => {
      render(<Harness />);
    });
    // The hook survived mount + async backend detection.
    expect(harnessResult).toBeDefined();
  });

  it('skips WS subscriptions while WS is unavailable', async () => {
    await act(async () => {
      render(<Harness />);
    });

    // getActiveWS was consulted (backend detection ran)…
    expect(mockGetActiveWS).toHaveBeenCalled();
    // …but no mockWS object exists to receive connect/subscribe calls, so the
    // hook simply stays in its initial offline-ish state.
    expect(harnessResult.prices).toEqual({});
    expect(harnessResult.connected).toBe(false);
  });

  it('settles into a safe source state without crashing', async () => {
    await act(async () => {
      render(<Harness />);
    });

    expect(harnessResult.isDetecting).toBe(false);
    // No backend + no WS → mock fallback source (never throws).
    expect(['mock', 'offline']).toContain(harnessResult.source);
  });

  it('survives the 5s reconnection poll with a null WS', async () => {
    await act(async () => {
      render(<Harness />);
    });

    // The poll effect calls getActiveWS() every 5s — null must be a no-op.
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    }).not.toThrow();
    expect(harnessResult.connected).toBe(false);
  });

  it('unmounts cleanly without a WS (no cleanup leak)', async () => {
    let unmount: () => void = () => {};
    await act(async () => {
      const result = render(<Harness />);
      unmount = result.unmount;
    });

    expect(() => {
      act(() => unmount());
    }).not.toThrow();
  });
});
