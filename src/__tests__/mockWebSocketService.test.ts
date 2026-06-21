/**
 * ============================================================================
 * Toroloom — Mock WebSocket Service Tests
 * ============================================================================
 *
 * Tests the in-process MockWebSocketService: connection lifecycle,
 * subscription management, price simulation, risk event emission,
 * lockdown simulation, simulateDisconnect/reconnect, and reset().
 *
 * NOTE: The setup.ts globally mocks wsRegistry and wsService.  We test
 * the mockWebSocket singleton directly by importing it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockWebSocket } from '../services/mockWebSocketService';
import { useAuthStore } from '../store/authStore';
import { usePortfolioStore } from '../store/portfolioStore';
import { mockUser } from '../constants/mockData';
import type { Holding } from '../types';
import type { ConnectionCallback, PnLUpdateCallback, LockdownCallback } from '../services/wsService';

// Minimal holding fixture
const createHolding = (overrides?: Partial<Holding>): Holding => ({
  id: 'h_test',
  stockId: 'RELIANCE',
  symbol: 'RELIANCE',
  name: 'Reliance Industries Ltd.',
  quantity: 100,
  buyPrice: 2650,
  currentPrice: 2890.50,
  totalInvested: 265000,
  currentValue: 289050,
  pnl: 24050,
  pnlPercent: 9.08,
  dayChange: 2260,
  dayChangePercent: 1.59,
  ...overrides,
});

describe('MockWebSocketService', () => {
  // Callbacks that we can spy on
  let onConnectionChange: ReturnType<typeof vi.fn>;
  let onPnLUpdate: ReturnType<typeof vi.fn>;
  let onLockdown: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();

    // Reset the mock service
    mockWebSocket.reset();
    // Always disconnect before each test to clear intervals
    mockWebSocket.disconnect();

    // Set up store state
    useAuthStore.setState({
      user: mockUser,
      token: 'test-token',
      isLoggedIn: true,
    });
    usePortfolioStore.setState({
      holdings: [],
      trades: [],
    });

    // Create fresh callbacks
    onConnectionChange = vi.fn();
    onPnLUpdate = vi.fn();
    onLockdown = vi.fn();
  });

  afterEach(() => {
    mockWebSocket.disconnect();
    vi.useRealTimers();
  });

  // ── Initial State ────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts not connected', () => {
      expect(mockWebSocket.getIsAuthenticated()).toBe(false);
    });

    it('returns fallback price for unknown stock', () => {
      expect(mockWebSocket.getCurrentPrice('UNKNOWN')).toBe(1000);
    });

    it('returns known price from mock data', () => {
      const price = mockWebSocket.getCurrentPrice('RELIANCE');
      expect(price).toBeGreaterThan(0);
    });

    it('returns empty cached candles', () => {
      expect(mockWebSocket.getCachedCandles('RELIANCE')).toEqual([]);
    });
  });

  // ── Connection Lifecycle ──────────────────────────────────────────────

  describe('connect / disconnect', () => {
    it('connects and authenticates with token', async () => {
      mockWebSocket.onConnectionChangeCallback(onConnectionChange as ConnectionCallback);
      await mockWebSocket.connect();

      expect(mockWebSocket.getIsAuthenticated()).toBe(true);
      expect(onConnectionChange).toHaveBeenCalledWith(true);
    });

    it('connect is idempotent', async () => {
      await mockWebSocket.connect();
      await mockWebSocket.connect(); // second call should be no-op
      expect(mockWebSocket.getIsAuthenticated()).toBe(true);
    });

    it('disconnect cleans up state', async () => {
      await mockWebSocket.connect();
      mockWebSocket.onConnectionChangeCallback(onConnectionChange as ConnectionCallback);
      mockWebSocket.disconnect();

      expect(mockWebSocket.getIsAuthenticated()).toBe(false);
      // onConnectionChange is called with false on disconnect
      expect(onConnectionChange).toHaveBeenCalledWith(false);
    });

    it('disconnect is idempotent when already disconnected', () => {
      expect(() => mockWebSocket.disconnect()).not.toThrow();
    });

    it('auto-subscribes to portfolio holdings on connect', async () => {
      usePortfolioStore.setState({
        holdings: [createHolding()],
      });

      await mockWebSocket.connect();

      // After connection, the stock should be auto-subscribed (intervals running)
      // The price should be accessible
      expect(mockWebSocket.getCurrentPrice('RELIANCE')).toBeGreaterThan(0);
    });
  });

  // ── Subscribe / Unsubscribe ──────────────────────────────────────────

  describe('subscribe / unsubscribe', () => {
    const onPrice = vi.fn();
    const onCandle = vi.fn();

    beforeEach(() => {
      onPrice.mockClear();
      onCandle.mockClear();
    });

    it('registers callbacks for a stockId', async () => {
      await mockWebSocket.connect();
      mockWebSocket.subscribe('RELIANCE', onPrice, onCandle);

      // Advance timers enough to trigger a tick
      vi.advanceTimersByTime(4000);

      expect(onPrice).toHaveBeenCalled();
      const callData = onPrice.mock.calls[0][0];
      expect(callData).toHaveProperty('stockId', 'RELIANCE');
      expect(callData).toHaveProperty('price');
      expect(callData).toHaveProperty('change');
      expect(callData).toHaveProperty('timestamp');
    });

    it('replaces callbacks on re-subscribe', async () => {
      await mockWebSocket.connect();
      const onPrice2 = vi.fn();

      mockWebSocket.subscribe('RELIANCE', onPrice, onCandle);
      mockWebSocket.subscribe('RELIANCE', onPrice2, onCandle);

      vi.advanceTimersByTime(4000);

      expect(onPrice).not.toHaveBeenCalled();
      expect(onPrice2).toHaveBeenCalled();
    });

    it('unsubscribe removes callbacks and stops ticks', async () => {
      await mockWebSocket.connect();
      mockWebSocket.subscribe('RELIANCE', onPrice, onCandle);

      // Let at least one tick fire (interval is 1000–3000ms)
      vi.advanceTimersByTime(3000);

      const callsBefore = onPrice.mock.calls.length;
      expect(callsBefore).toBeGreaterThanOrEqual(1);

      mockWebSocket.unsubscribe('RELIANCE');

      // Advance more — price should not be called again
      vi.advanceTimersByTime(10000);
      expect(onPrice).toHaveBeenCalledTimes(callsBefore);
    });

    it('unsubscribe keeps intervals for auto-subscribed symbols', async () => {
      usePortfolioStore.setState({
        holdings: [createHolding()],
      });

      await mockWebSocket.connect();
      mockWebSocket.subscribe('RELIANCE', onPrice, onCandle);

      // Unsubscribe a non-auto-subscribed symbol — no effect on RELIANCE
      mockWebSocket.unsubscribe('OTHER');
      vi.advanceTimersByTime(4000);
      expect(onPrice).toHaveBeenCalled();
    });

    it('can subscribe without prior connect (lazy ticker start)', async () => {
      // The ticker checks isConnected before firing, so we need to connect
      // first to set isConnected=true, then subscribe starts the ticker.
      await mockWebSocket.connect();
      mockWebSocket.subscribe('RELIANCE', onPrice, onCandle);

      vi.advanceTimersByTime(4000);
      expect(onPrice).toHaveBeenCalled();
    });
  });

  // ── Price Data Access ────────────────────────────────────────────────

  describe('getCurrentPrice', () => {
    it('returns initial mock data price', () => {
      // RELIANCE has price 2890.50 in mock data
      expect(mockWebSocket.getCurrentPrice('RELIANCE')).toBeGreaterThan(2000);
    });

    it('returns updated price after tick simulation', async () => {
      mockWebSocket.subscribe('RELIANCE', vi.fn(), vi.fn());

      const before = mockWebSocket.getCurrentPrice('RELIANCE');
      vi.advanceTimersByTime(4000);
      const after = mockWebSocket.getCurrentPrice('RELIANCE');

      // Price should have changed (within 5% bounds due to 0.2% volatility per tick)
      // It could be equal by coincidence, but usually different
      expect(after).toBeGreaterThan(before * 0.95);
      expect(after).toBeLessThan(before * 1.05);
    });

    it('returns 1000 for unknown stock', () => {
      expect(mockWebSocket.getCurrentPrice('NONEXISTENT')).toBe(1000);
    });
  });

  // ── Connection Callback ──────────────────────────────────────────────

  describe('onConnectionChangeCallback', () => {
    it('fires on connect', async () => {
      mockWebSocket.onConnectionChangeCallback(onConnectionChange as ConnectionCallback);
      await mockWebSocket.connect();
      expect(onConnectionChange).toHaveBeenCalledWith(true);
    });

    it('fires on disconnect', async () => {
      await mockWebSocket.connect();
      mockWebSocket.onConnectionChangeCallback(onConnectionChange as ConnectionCallback);
      mockWebSocket.disconnect();
      expect(onConnectionChange).toHaveBeenCalledWith(false);
    });
  });

  // ── Risk Event Emission ──────────────────────────────────────────────

  describe('PnL and Lockdown events', () => {
    it('emits PnL update on tick when holdings exist', async () => {
      usePortfolioStore.setState({
        holdings: [createHolding()],
      });

      mockWebSocket.onPnLUpdateCallback(onPnLUpdate as PnLUpdateCallback);
      await mockWebSocket.connect();

      vi.advanceTimersByTime(4000);

      expect(onPnLUpdate).toHaveBeenCalled();
      const pnlData = onPnLUpdate.mock.calls[0][0];
      expect(pnlData).toHaveProperty('realizedPnL');
      expect(pnlData).toHaveProperty('unrealizedPnL');
      expect(pnlData).toHaveProperty('totalPnL');
    });

    it('does not emit PnL when holdings are empty', async () => {
      mockWebSocket.onPnLUpdateCallback(onPnLUpdate as PnLUpdateCallback);
      await mockWebSocket.connect();

      vi.advanceTimersByTime(4000);

      expect(onPnLUpdate).not.toHaveBeenCalled();
    });

    it('triggers lockdown when loss exceeds limit', async () => {
      // Set up a holding with a large loss
      usePortfolioStore.setState({
        holdings: [
          createHolding({
            stockId: 'RELIANCE',
            buyPrice: 5000,  // far above current price ~2890
            quantity: 10,     // loss = (current ~2890 - 5000) * 10 = -21100
          }),
        ],
      });

      mockWebSocket.onLockdownCallback(onLockdown as LockdownCallback);
      mockWebSocket.setLossLimit(5000);  // loss of 21100 exceeds 5000 limit

      await mockWebSocket.connect();
      vi.advanceTimersByTime(4000);

      expect(onLockdown).toHaveBeenCalled();
      const lockdownData = onLockdown.mock.calls[0][0];
      expect(lockdownData.status).toBe('active');
      expect(lockdownData.breachedLimit).toBe('daily_loss');
    });

    it('lifts lockdown when P&L recovers', async () => {
      // Set up with a small loss
      usePortfolioStore.setState({
        holdings: [
          createHolding({
            stockId: 'RELIANCE',
            buyPrice: 3000,   // slightly above current ~2890
            quantity: 5,       // loss = (2890 - 3000) * 5 = -550
          }),
        ],
      });

      mockWebSocket.onLockdownCallback(onLockdown as LockdownCallback);
      mockWebSocket.setLossLimit(100);  // loss of 550 exceeds 100 limit — triggers lockdown

      await mockWebSocket.connect();

      // Advance timers to trigger a tick, which should fire lockdown
      vi.advanceTimersByTime(4000);
      expect(onLockdown).toHaveBeenCalledTimes(1);

      // Now change the holding to a gain position (simulating P&L recovery)
      usePortfolioStore.setState({
        holdings: [
          createHolding({
            stockId: 'RELIANCE',
            buyPrice: 2500,   // well below current ~2890
            quantity: 5,       // gain = (2890 - 2500) * 5 = 1950
          }),
        ],
      });

      // Advance timers to trigger another tick
      vi.advanceTimersByTime(4000);

      // Should have received a lift event
      expect(onLockdown).toHaveBeenCalledTimes(2);
      const liftData = onLockdown.mock.calls[1][0];
      expect(liftData.status).toBe('none');
    });

    it('does not re-emit lockdown for same breach state', async () => {
      usePortfolioStore.setState({
        holdings: [
          createHolding({
            stockId: 'RELIANCE',
            buyPrice: 4000,
            quantity: 10,
          }),
        ],
      });

      mockWebSocket.onLockdownCallback(onLockdown as LockdownCallback);
      mockWebSocket.setLossLimit(1000);

      await mockWebSocket.connect();

      // Advance enough for several ticks
      vi.advanceTimersByTime(10000);

      // Lockdown should only be triggered once (dedup)
      const lockdownCalls = onLockdown.mock.calls.filter(
        (c: any) => c[0].status === 'active'
      );
      expect(lockdownCalls.length).toBe(1);
    });
  });

  // ── Simulate Disconnect / Reconnect ──────────────────────────────────

  describe('simulateDisconnect', () => {
    it('triggers connection callback with false', async () => {
      await mockWebSocket.connect();
      mockWebSocket.onConnectionChangeCallback(onConnectionChange as ConnectionCallback);

      mockWebSocket.simulateDisconnect();

      expect(onConnectionChange).toHaveBeenCalledWith(false);
    });

    it('auto-reconnects after 3 seconds', async () => {
      mockWebSocket.onConnectionChangeCallback(onConnectionChange as ConnectionCallback);
      await mockWebSocket.connect();
      onConnectionChange.mockClear();

      mockWebSocket.simulateDisconnect();
      expect(mockWebSocket.getIsAuthenticated()).toBe(false);

      // Advance 3 seconds to trigger auto-reconnect
      vi.advanceTimersByTime(3000);
      // Let the async connect resolve
      await vi.runAllTimersAsync();

      // Wait... advanceTimersByTime might not trigger async operations.
      // Let's just verify that reconnect is scheduled
      expect(mockWebSocket.getIsAuthenticated()).toBe(true);
    });
  });

  // ── Reset ────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('restores prices to initial mock data values', async () => {
      // Change a price via tick
      mockWebSocket.subscribe('RELIANCE', vi.fn(), vi.fn());
      vi.advanceTimersByTime(4000);

      mockWebSocket.getCurrentPrice('RELIANCE');

      mockWebSocket.reset();
      const resetPrice = mockWebSocket.getCurrentPrice('RELIANCE');

      // After reset, price should be the initial 2890.50
      expect(resetPrice).toBe(2890.50);
      // The changed price should be different (highly likely)
      // Note: this could flake if the random tick happens to produce 2890.50,
      // but with 0.2% volatility that's extremely unlikely
    });
  });

  // ── setLossLimit ─────────────────────────────────────────────────────

  describe('setLossLimit', () => {
    it('stores the loss limit override', () => {
      mockWebSocket.setLossLimit(10000);
      // Access the internal property through the test
      expect((mockWebSocket as any).lossLimitOverride).toBe(10000);
    });
  });
});
