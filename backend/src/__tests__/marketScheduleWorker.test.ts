/**
 * ============================================================================
 * Toroloom — Market Schedule Worker Tests
 * ============================================================================
 *
 * Tests the market schedule worker's start/stop lifecycle, timer interval,
 * idempotency, and error handling.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/marketScheduleWorker.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ──── Mock isMarketHours (wrapped in vi.hoisted for vi.mock factory) ────

const mockIsMarketHours = vi.hoisted(() => vi.fn());

vi.mock('../routes/ironLock', () => ({
  isMarketHours: mockIsMarketHours,
}));

// ──── Import worker AFTER mocks ─────────────────────────────────────────

import { startMarketScheduleWorker, stopMarketScheduleWorker, getMarketScheduleHealth, _resetMarketScheduleMetrics } from '../services/queue/marketScheduleWorker';
import type { MarketScheduleHealth } from '../services/queue/marketScheduleWorker';

// ──── Tests ─────────────────────────────────────────────────────────────

describe('Market Schedule Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetMarketScheduleMetrics();
    vi.useFakeTimers();
    // Default: no error thrown
    mockIsMarketHours.mockReturnValue(false);
  });

  afterEach(() => {
    // Ensure worker is stopped after each test
    stopMarketScheduleWorker();
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Start
  // ─────────────────────────────────────────────────────────────────────────

  describe('startMarketScheduleWorker()', () => {
    it('should call isMarketHours immediately on start', () => {
      startMarketScheduleWorker();

      expect(mockIsMarketHours).toHaveBeenCalledTimes(1);
    });

    it('should call isMarketHours on each timer tick', () => {
      startMarketScheduleWorker();

      // Advance by 30 seconds — should fire once
      vi.advanceTimersByTime(30_000);
      expect(mockIsMarketHours).toHaveBeenCalledTimes(2); // 1 (immediate) + 1 (tick)

      // Advance by another 30 seconds — should fire again
      vi.advanceTimersByTime(30_000);
      expect(mockIsMarketHours).toHaveBeenCalledTimes(3); // +1 more tick

      // Advance by 60 seconds (2 ticks)
      vi.advanceTimersByTime(60_000);
      expect(mockIsMarketHours).toHaveBeenCalledTimes(5); // +2 more ticks
    });

    it('should be idempotent — calling start twice does not create two intervals', () => {
      startMarketScheduleWorker();
      startMarketScheduleWorker(); // Second call — no-op

      // Clear the initial call — should have been called once
      expect(mockIsMarketHours).toHaveBeenCalledTimes(1);

      // Advance by 30 seconds — should fire only once (one interval)
      vi.advanceTimersByTime(30_000);
      expect(mockIsMarketHours).toHaveBeenCalledTimes(2);
    });

    it('should not fire the timer before the first interval elapses', () => {
      startMarketScheduleWorker();

      // Advance by 29 seconds — timer should NOT fire yet
      vi.advanceTimersByTime(29_000);
      expect(mockIsMarketHours).toHaveBeenCalledTimes(1); // Only the initial call

      // Advance 1 more second — timer fires
      vi.advanceTimersByTime(1_000);
      expect(mockIsMarketHours).toHaveBeenCalledTimes(2);
    });

    it('should handle errors from isMarketHours gracefully', () => {
      // isMarketHours throws on the initial call
      mockIsMarketHours.mockImplementation(() => {
        throw new Error('Market hours check failed');
      });

      // Should not throw
      expect(() => startMarketScheduleWorker()).not.toThrow();

      // isMarketHours still called once
      expect(mockIsMarketHours).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from isMarketHours during interval ticks', () => {
      // First call succeeds, subsequent ticks throw
      mockIsMarketHours
        .mockReturnValueOnce(false)
        .mockImplementation(() => { throw new Error('Tick failed'); });

      startMarketScheduleWorker(); // Initial call — first mockReturnValueOnce

      // Advance by 30 seconds — tick fires and throws
      expect(() => {
        vi.advanceTimersByTime(30_000);
      }).not.toThrow(); // Worker catches errors internally
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Stop
  // ─────────────────────────────────────────────────────────────────────────

  describe('stopMarketScheduleWorker()', () => {
    it('should stop the timer so isMarketHours is no longer called', () => {
      startMarketScheduleWorker();
      expect(mockIsMarketHours).toHaveBeenCalledTimes(1);

      stopMarketScheduleWorker();

      // Advance by 60 seconds — should NOT fire
      vi.advanceTimersByTime(60_000);
      expect(mockIsMarketHours).toHaveBeenCalledTimes(1); // Still only initial call
    });

    it('should be idempotent — calling stop when not running does not throw', () => {
      expect(() => stopMarketScheduleWorker()).not.toThrow();
      expect(() => stopMarketScheduleWorker()).not.toThrow();
    });

    it('should allow restart after stop', () => {
      startMarketScheduleWorker();
      stopMarketScheduleWorker();
      expect(mockIsMarketHours).toHaveBeenCalledTimes(1); // Initial call

      // Start again
      startMarketScheduleWorker();
      expect(mockIsMarketHours).toHaveBeenCalledTimes(2); // Another immediate call

      // Advance by 30 seconds — should fire again on the new interval
      vi.advanceTimersByTime(30_000);
      expect(mockIsMarketHours).toHaveBeenCalledTimes(3);
    });

    it('should prevent tick from firing on stopped timer (race condition safety)', () => {
      startMarketScheduleWorker();
      expect(mockIsMarketHours).toHaveBeenCalledTimes(1);

      // Stop just before the 30s tick
      vi.advanceTimersByTime(29_000);
      stopMarketScheduleWorker();

      // Advance past the 30s mark — should not fire since stopped
      vi.advanceTimersByTime(2_000);
      expect(mockIsMarketHours).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Health / Metrics
  // ─────────────────────────────────────────────────────────────────────────

  describe('getMarketScheduleHealth()', () => {
    it('should return not running when worker has never been started', () => {
      const health = getMarketScheduleHealth();

      expect(health.isRunning).toBe(false);
      expect(health.startedAt).toBeNull();
      expect(health.lastPollTimestamp).toBeNull();
      expect(health.totalPolls).toBe(0);
      expect(health.totalErrors).toBe(0);
      expect(health.marketOpenCount).toBe(0);
      expect(health.marketCloseCount).toBe(0);
      expect(health.pollIntervalMs).toBe(30_000);
      expect(health.uptimeSeconds).toBeNull();
    });

    it('should reflect running state after start', () => {
      startMarketScheduleWorker();

      const health = getMarketScheduleHealth();

      expect(health.isRunning).toBe(true);
      expect(health.startedAt).not.toBeNull();
      expect(health.totalPolls).toBe(1); // Initial call
      expect(health.totalErrors).toBe(0);
      expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('should reflect stopped state after stop', () => {
      startMarketScheduleWorker();
      stopMarketScheduleWorker();

      const health = getMarketScheduleHealth();

      expect(health.isRunning).toBe(false);
      expect(health.startedAt).not.toBeNull(); // Preserves start time
      expect(health.totalPolls).toBe(1);
    });

    it('should increment totalPolls on each interval tick', () => {
      startMarketScheduleWorker();
      expect(getMarketScheduleHealth().totalPolls).toBe(1);

      vi.advanceTimersByTime(30_000);
      expect(getMarketScheduleHealth().totalPolls).toBe(2);

      vi.advanceTimersByTime(30_000);
      expect(getMarketScheduleHealth().totalPolls).toBe(3);
    });

    it('should increment totalErrors when isMarketHours throws', () => {
      mockIsMarketHours.mockImplementation(() => {
        throw new Error('Poll failed');
      });

      startMarketScheduleWorker();

      const health = getMarketScheduleHealth();
      expect(health.totalPolls).toBe(1);
      expect(health.totalErrors).toBe(1);
      expect(health.lastPollTimestamp).toBeNull(); // No successful poll

      // Advance by 30 seconds — another error
      vi.advanceTimersByTime(30_000);
      const health2 = getMarketScheduleHealth();
      expect(health2.totalPolls).toBe(2);
      expect(health2.totalErrors).toBe(2);
    });

    it('should update lastPollTimestamp on successful poll', () => {
      mockIsMarketHours.mockReturnValue(true);

      startMarketScheduleWorker();

      const health = getMarketScheduleHealth();
      expect(health.lastPollTimestamp).not.toBeNull();
      expect(health.totalErrors).toBe(0);

      // Advance and verify timestamp updates
      vi.advanceTimersByTime(30_000);
      const health2 = getMarketScheduleHealth();
      expect(health2.totalPolls).toBe(2);
      expect(health2.totalErrors).toBe(0);
      expect(health2.lastPollTimestamp).not.toBe(health.lastPollTimestamp); // Updated
    });

    it('should continue accumulating polls across restart cycles', () => {
      startMarketScheduleWorker();
      vi.advanceTimersByTime(30_000);
      expect(getMarketScheduleHealth().totalPolls).toBe(2);
      stopMarketScheduleWorker();

      // Restart — metrics continue accumulating
      startMarketScheduleWorker();
      const health = getMarketScheduleHealth();
      expect(health.isRunning).toBe(true);
      expect(health.totalPolls).toBe(3); // 2 from previous + 1 initial poll
      expect(health.totalErrors).toBe(0);
    });

    it('should return correct interface shape', () => {
      const health: MarketScheduleHealth = getMarketScheduleHealth();

      expect(health).toHaveProperty('isRunning');
      expect(health).toHaveProperty('startedAt');
      expect(health).toHaveProperty('lastPollTimestamp');
      expect(health).toHaveProperty('totalPolls');
      expect(health).toHaveProperty('totalErrors');
      expect(health).toHaveProperty('marketOpenCount');
      expect(health).toHaveProperty('marketCloseCount');
      expect(health).toHaveProperty('pollIntervalMs');
      expect(health).toHaveProperty('uptimeSeconds');

      // Type checks
      expect(typeof health.isRunning).toBe('boolean');
      expect(typeof health.pollIntervalMs).toBe('number');
      expect(typeof health.totalPolls).toBe('number');
      expect(typeof health.totalErrors).toBe('number');
      expect(typeof health.marketOpenCount).toBe('number');
      expect(typeof health.marketCloseCount).toBe('number');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Transition Tracking
  // ─────────────────────────────────────────────────────────────────────────

  describe('transition tracking', () => {
    it('should detect market:open transition (closed → open)', () => {
      // Start with market closed
      mockIsMarketHours.mockReturnValue(false);
      startMarketScheduleWorker();

      expect(getMarketScheduleHealth().marketOpenCount).toBe(0);
      expect(getMarketScheduleHealth().marketCloseCount).toBe(0);

      // Next poll: market opens
      mockIsMarketHours.mockReturnValue(true);
      vi.advanceTimersByTime(30_000);

      const health = getMarketScheduleHealth();
      expect(health.marketOpenCount).toBe(1);
      expect(health.marketCloseCount).toBe(0);
    });

    it('should detect market:close transition (open → closed)', () => {
      // Start with market open
      mockIsMarketHours.mockReturnValue(true);
      startMarketScheduleWorker();

      expect(getMarketScheduleHealth().marketOpenCount).toBe(0);
      expect(getMarketScheduleHealth().marketCloseCount).toBe(0);

      // Next poll: market closes
      mockIsMarketHours.mockReturnValue(false);
      vi.advanceTimersByTime(30_000);

      const health = getMarketScheduleHealth();
      expect(health.marketCloseCount).toBe(1);
      expect(health.marketOpenCount).toBe(0);
    });

    it('should count multiple transitions over time', () => {
      // Start closed
      mockIsMarketHours.mockReturnValue(false);
      startMarketScheduleWorker();

      // Open → Close → Open → Close
      mockIsMarketHours.mockReturnValue(true);
      vi.advanceTimersByTime(30_000); // open

      mockIsMarketHours.mockReturnValue(false);
      vi.advanceTimersByTime(30_000); // close

      mockIsMarketHours.mockReturnValue(true);
      vi.advanceTimersByTime(30_000); // open

      mockIsMarketHours.mockReturnValue(false);
      vi.advanceTimersByTime(30_000); // close

      const health = getMarketScheduleHealth();
      expect(health.marketOpenCount).toBe(2);
      expect(health.marketCloseCount).toBe(2);
      expect(health.totalPolls).toBe(5); // initial + 4 ticks
    });

    it('should not count transition when state does not change', () => {
      mockIsMarketHours.mockReturnValue(false); // Always closed
      startMarketScheduleWorker();

      vi.advanceTimersByTime(120_000); // 4 ticks, all closed

      const health = getMarketScheduleHealth();
      expect(health.marketOpenCount).toBe(0);
      expect(health.marketCloseCount).toBe(0);
      expect(health.totalPolls).toBe(5);
    });

    it('should not count initial poll as a transition', () => {
      // First call: closed initially
      mockIsMarketHours.mockReturnValue(false);
      startMarketScheduleWorker();

      // No transition on initial poll
      const health = getMarketScheduleHealth();
      expect(health.marketOpenCount).toBe(0);
      expect(health.marketCloseCount).toBe(0);
      expect(health.totalPolls).toBe(1);
    });

    it('should reset transition counts via _resetMarketScheduleMetrics', () => {
      mockIsMarketHours.mockReturnValue(false);
      startMarketScheduleWorker();

      mockIsMarketHours.mockReturnValue(true);
      vi.advanceTimersByTime(30_000);
      expect(getMarketScheduleHealth().marketOpenCount).toBe(1);

      _resetMarketScheduleMetrics();
      const health = getMarketScheduleHealth();
      expect(health.marketOpenCount).toBe(0);
      expect(health.marketCloseCount).toBe(0);
      expect(health.totalPolls).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Combined Start/Stop Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  describe('start → stop → start lifecycle', () => {
    it('should survive multiple start/stop cycles', () => {
      for (let cycle = 0; cycle < 5; cycle++) {
        startMarketScheduleWorker();
        expect(mockIsMarketHours).toHaveBeenCalledTimes(cycle + 1); // +1 per start
        stopMarketScheduleWorker();
      }
    });

    it('should correctly track timer ticks across start/stop/start', () => {
      startMarketScheduleWorker();
      vi.advanceTimersByTime(30_000);
      expect(mockIsMarketHours).toHaveBeenCalledTimes(2); // Initial + 1 tick
      stopMarketScheduleWorker();

      // Restart and verify ticks
      startMarketScheduleWorker();
      expect(mockIsMarketHours).toHaveBeenCalledTimes(3); // +1 for restart init

      vi.advanceTimersByTime(30_000);
      expect(mockIsMarketHours).toHaveBeenCalledTimes(4); // +1 tick on new interval
    });
  });
});
