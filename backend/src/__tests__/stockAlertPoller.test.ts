/**
 * ============================================================================
 * Toroloom — Stock Alert Poller Tests
 * ============================================================================
 *
 * Tests the stock alert poller's start/stop lifecycle, timer interval,
 * overlap prevention, alert triggering logic, health metrics, and error
 * handling.
 *
 * IMPORTANT: doPoll() is ASYNC, so we use vi.advanceTimersByTimeAsync()
 * (not the sync version) to let microtasks settle between timer ticks.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/stockAlertPoller.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { StockAlert } from '../services/stockAlertService';
import type { MarketQuote } from '../services/broker/interface';

// ──── Hoisted Mocks ──────────────────────────────────────────────────────

const mockGetActiveAlerts = vi.hoisted(() => vi.fn());
const mockTriggerAlert = vi.hoisted(() => vi.fn());
const mockGetBroker = vi.hoisted(() => vi.fn());
const mockSaveNotification = vi.hoisted(() => vi.fn());
const mockDispatchWebhook = vi.hoisted(() => vi.fn());

vi.mock('../services/stockAlertService', () => ({
  getActiveAlertsBySymbols: mockGetActiveAlerts,
  triggerAlert: mockTriggerAlert,
}));

vi.mock('../services/broker', () => ({
  getBroker: mockGetBroker,
}));

vi.mock('../services/notifications', () => ({
  saveNotification: mockSaveNotification,
}));

vi.mock('../services/webhookService', () => ({
  dispatchWebhookEvent: mockDispatchWebhook,
}));

// ──── Import poller AFTER mocks ─────────────────────────────────────────

import {
  startStockAlertPoller,
  stopStockAlertPoller,
  getStockAlertPollerHealth,
  _resetStockAlertPollerMetrics,
} from '../services/queue/stockAlertPoller';
import type { StockAlertPollerHealth } from '../services/queue/stockAlertPoller';

// ──── Test Data Helpers ──────────────────────────────────────────────────

const USER_A = 'user_a';

function makeAlert(overrides: Partial<StockAlert> = {}): StockAlert {
  const now = new Date().toISOString();
  return {
    id: `sa_test_${Math.random().toString(36).slice(2, 8)}`,
    userId: USER_A,
    symbol: 'RELIANCE',
    targetPrice: 2890,
    direction: 'above',
    status: 'active',
    triggeredAt: null,
    triggeredPrice: null,
    note: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeQuote(symbol: string, lastPrice: number): MarketQuote {
  return {
    symbol,
    lastPrice,
    change: 0,
    changePercent: 0,
    open: lastPrice,
    high: lastPrice,
    low: lastPrice,
    close: lastPrice,
    volume: 1000000,
    bid: lastPrice,
    ask: lastPrice,
    timestamp: new Date().toISOString(),
  };
}

function buildAlertMap(alerts: StockAlert[]): Map<string, StockAlert[]> {
  const map = new Map<string, StockAlert[]>();
  for (const a of alerts) {
    const existing = map.get(a.symbol) || [];
    existing.push(a);
    map.set(a.symbol, existing);
  }
  return map;
}

function buildQuoteMap(quotes: MarketQuote[]): Map<string, MarketQuote> {
  const map = new Map<string, MarketQuote>();
  for (const q of quotes) {
    map.set(q.symbol, q);
  }
  return map;
}

/** Create a mock broker that returns the given quotes via getBulkQuotes */
function mockBrokerWithQuotes(quotes: MarketQuote[]) {
  return {
    getBulkQuotes: vi.fn().mockResolvedValue(buildQuoteMap(quotes)),
  };
}

/** Create a mock broker whose getBulkQuotes rejects with an error */
function mockBrokerThatThrows(errorMsg: string) {
  return {
    getBulkQuotes: vi.fn().mockRejectedValue(new Error(errorMsg)),
  };
}

// ──── Tests ─────────────────────────────────────────────────────────────

describe('Stock Alert Poller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetStockAlertPollerMetrics();
    vi.useFakeTimers();

    // Default: no active alerts
    mockGetActiveAlerts.mockResolvedValue(new Map());
    mockTriggerAlert.mockResolvedValue(null);
    mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([]));
    mockSaveNotification.mockResolvedValue(undefined);
    mockDispatchWebhook.mockResolvedValue(undefined);
  });

  afterEach(() => {
    stopStockAlertPoller();
    vi.useRealTimers();
  });

  // ── Start ──────────────────────────────────────────────────────────────

  describe('startStockAlertPoller()', () => {
    it('should call getActiveAlertsBySymbols immediately on start', async () => {
      startStockAlertPoller();
      // Let the initial async doPoll settle
      await vi.advanceTimersByTimeAsync(0);

      expect(mockGetActiveAlerts).toHaveBeenCalledTimes(1);
    });

    it('should poll on each timer tick', async () => {
      // Give non-empty alerts so poll doesn't early-return
      const alert = makeAlert();
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([makeQuote('RELIANCE', 2800)]));

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      // Advance by 60 seconds — should fire once more
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockGetActiveAlerts).toHaveBeenCalledTimes(2);

      // Advance by another 60 seconds
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockGetActiveAlerts).toHaveBeenCalledTimes(3);
    });

    it('should be idempotent — calling start twice does not create two intervals', async () => {
      const alert = makeAlert();
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([makeQuote('RELIANCE', 2800)]));

      startStockAlertPoller();
      startStockAlertPoller(); // Second call — no-op
      await vi.advanceTimersByTimeAsync(0);

      // Advance past an interval
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockGetActiveAlerts).toHaveBeenCalledTimes(2); // Only one interval
    });

    it('should not fire the timer before the first interval elapses', async () => {
      const alert = makeAlert();
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([makeQuote('RELIANCE', 2800)]));

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      // 59 seconds — timer should NOT fire yet
      await vi.advanceTimersByTimeAsync(59_000);
      expect(mockGetActiveAlerts).toHaveBeenCalledTimes(1); // Only initial

      // 1 more second = 60s total — timer fires
      await vi.advanceTimersByTimeAsync(1_000);
      expect(mockGetActiveAlerts).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully (broker failure)', async () => {
      const alert = makeAlert();
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerThatThrows('Broker unavailable'));

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      const health = getStockAlertPollerHealth();
      expect(health.totalErrors).toBe(1);
    });
  });

  // ── Stop ────────────────────────────────────────────────────────────────

  describe('stopStockAlertPoller()', () => {
    it('should stop the timer so poll is no longer called', async () => {
      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);
      expect(mockGetActiveAlerts).toHaveBeenCalledTimes(1);

      stopStockAlertPoller();

      // Advance by 180 seconds — should NOT fire
      await vi.advanceTimersByTimeAsync(180_000);
      expect(mockGetActiveAlerts).toHaveBeenCalledTimes(1);
    });

    it('should be idempotent — calling stop when not running does not throw', () => {
      expect(() => stopStockAlertPoller()).not.toThrow();
      expect(() => stopStockAlertPoller()).not.toThrow();
    });

    it('should allow restart after stop', async () => {
      const alert = makeAlert();
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([makeQuote('RELIANCE', 2800)]));

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);
      expect(mockGetActiveAlerts).toHaveBeenCalledTimes(1);

      stopStockAlertPoller();

      // Start again
      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);
      expect(mockGetActiveAlerts).toHaveBeenCalledTimes(2);

      // Advance — should fire on the new interval
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockGetActiveAlerts).toHaveBeenCalledTimes(3);
    });
  });

  // ── Health Metrics ─────────────────────────────────────────────────────

  describe('getStockAlertPollerHealth()', () => {
    it('should return not running when worker has never been started', () => {
      const health = getStockAlertPollerHealth();

      expect(health.isRunning).toBe(false);
      expect(health.startedAt).toBeNull();
      expect(health.lastPollTimestamp).toBeNull();
      expect(health.totalPolls).toBe(0);
      expect(health.totalErrors).toBe(0);
      expect(health.totalTriggered).toBe(0);
      expect(health.pollIntervalMs).toBe(60_000);
      expect(health.uptimeSeconds).toBeNull();
    });

    it('should reflect running state after start', async () => {
      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      const health = getStockAlertPollerHealth();
      expect(health.isRunning).toBe(true);
      expect(health.startedAt).not.toBeNull();
      expect(health.totalPolls).toBe(1);
      expect(health.totalErrors).toBe(0);
      expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('should reflect stopped state after stop', async () => {
      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);
      stopStockAlertPoller();

      const health = getStockAlertPollerHealth();
      expect(health.isRunning).toBe(false);
      expect(health.startedAt).not.toBeNull();
    });

    it('should increment totalPolls on each tick', async () => {
      const alert = makeAlert();
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([makeQuote('RELIANCE', 2800)]));

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);
      expect(getStockAlertPollerHealth().totalPolls).toBe(1);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(getStockAlertPollerHealth().totalPolls).toBe(2);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(getStockAlertPollerHealth().totalPolls).toBe(3);
    });

    it('should return correct interface shape', () => {
      const health: StockAlertPollerHealth = getStockAlertPollerHealth();

      expect(health).toHaveProperty('isRunning');
      expect(health).toHaveProperty('startedAt');
      expect(health).toHaveProperty('lastPollTimestamp');
      expect(health).toHaveProperty('totalPolls');
      expect(health).toHaveProperty('totalErrors');
      expect(health).toHaveProperty('totalTriggered');
      expect(health).toHaveProperty('lastCheckedCount');
      expect(health).toHaveProperty('pollIntervalMs');
      expect(health).toHaveProperty('uptimeSeconds');

      expect(typeof health.isRunning).toBe('boolean');
      expect(typeof health.totalPolls).toBe('number');
      expect(typeof health.totalErrors).toBe('number');
      expect(typeof health.totalTriggered).toBe('number');
    });
  });

  // ── Alert Triggering Logic ─────────────────────────────────────────────

  describe('alert triggering', () => {
    it('does nothing when there are no active alerts', async () => {
      mockGetActiveAlerts.mockResolvedValue(new Map());
      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockGetBroker).not.toHaveBeenCalled();
      expect(mockSaveNotification).not.toHaveBeenCalled();
      expect(mockDispatchWebhook).not.toHaveBeenCalled();
      // lastCheckedCount should be 0 when no alerts
      expect(getStockAlertPollerHealth().lastCheckedCount).toBe(0);
    });

    it('triggers "above" alert when price >= target', async () => {
      const alert = makeAlert({ symbol: 'RELIANCE', targetPrice: 2890, direction: 'above' });
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([makeQuote('RELIANCE', 2910)]));
      mockTriggerAlert.mockResolvedValue({ ...alert, status: 'triggered' });

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockTriggerAlert).toHaveBeenCalledWith(alert.id, alert.userId, 2910);
      expect(mockSaveNotification).toHaveBeenCalledTimes(1);
      expect(mockSaveNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: alert.userId,
          type: 'price_alert',
          data: expect.objectContaining({
            alertId: alert.id,
            symbol: 'RELIANCE',
            triggeredPrice: 2910,
          }),
        }),
      );
      expect(mockDispatchWebhook).toHaveBeenCalledWith(
        'price:alert_triggered',
        expect.objectContaining({ symbol: 'RELIANCE', triggeredPrice: 2910 }),
        alert.userId,
      );
    });

    it('triggers "below" alert when price <= target', async () => {
      const alert = makeAlert({ symbol: 'TCS', targetPrice: 4000, direction: 'below' });
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([makeQuote('TCS', 3950)]));
      mockTriggerAlert.mockResolvedValue({ ...alert, status: 'triggered' });

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockTriggerAlert).toHaveBeenCalledWith(alert.id, alert.userId, 3950);
    });

    it('does not trigger "above" alert when price is below target', async () => {
      const alert = makeAlert({ symbol: 'RELIANCE', targetPrice: 2890, direction: 'above' });
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([makeQuote('RELIANCE', 2850)]));

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockTriggerAlert).not.toHaveBeenCalled();
      expect(mockSaveNotification).not.toHaveBeenCalled();
    });

    it('does not trigger "below" alert when price is above target', async () => {
      const alert = makeAlert({ symbol: 'TCS', targetPrice: 4000, direction: 'below' });
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([makeQuote('TCS', 4050)]));

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockTriggerAlert).not.toHaveBeenCalled();
    });

    it('handles multiple alerts for the same symbol — only matching ones trigger', async () => {
      const a1 = makeAlert({ symbol: 'RELIANCE', targetPrice: 2890, direction: 'above' });
      const a2 = makeAlert({ symbol: 'RELIANCE', targetPrice: 2950, direction: 'above' });
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([a1, a2]));
      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([makeQuote('RELIANCE', 2910)]));
      mockTriggerAlert.mockImplementation(
        (id: string) => Promise.resolve({ id, status: 'triggered' } as StockAlert),
      );

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      // Only a1 should trigger (price 2910 >= 2890 but < 2950)
      expect(mockTriggerAlert).toHaveBeenCalledTimes(1);
      expect(mockTriggerAlert).toHaveBeenCalledWith(a1.id, expect.any(String), 2910);
    });

    it('skips symbols that have no quote data', async () => {
      const alert = makeAlert({ symbol: 'UNKNOWN', targetPrice: 100, direction: 'above' });
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([])); // No quotes at all

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockTriggerAlert).not.toHaveBeenCalled();
    });
  });

  // ── Overlap Prevention ─────────────────────────────────────────────────

  describe('overlap prevention', () => {
    it('skips a poll cycle if the previous one is still in progress', async () => {
      // Make getActiveAlerts take longer than the 60s interval
      let resolvePromise!: () => void;
      const slowPromise = new Promise<Map<string, StockAlert[]>>((resolve) => {
        resolvePromise = () => resolve(buildAlertMap([makeAlert()]));
      });
      mockGetActiveAlerts.mockReturnValue(slowPromise);

      startStockAlertPoller();

      // Advance past multiple intervals — ticks fire but find _pollingInProgress=true
      vi.advanceTimersByTime(60_000); // tick 1 (skipped — still in progress)
      vi.advanceTimersByTime(60_000); // tick 2 (skipped)
      vi.advanceTimersByTime(60_000); // tick 3 (skipped)

      // getActiveAlerts was only called once (first call), rest were skipped
      expect(mockGetActiveAlerts).toHaveBeenCalledTimes(1);

      // Now resolve the slow promise
      resolvePromise();
      await vi.advanceTimersByTimeAsync(0);

      // totalPolls should be 1 (only first cycle counted)
      expect(getStockAlertPollerHealth().totalPolls).toBe(1);

      // After next interval, the guard is clear and a new cycle should run
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockGetActiveAlerts).toHaveBeenCalledTimes(2);
      expect(getStockAlertPollerHealth().totalPolls).toBe(2);
    });
  });

  // ── Notification & Webhook ─────────────────────────────────────────────

  describe('notification and webhook dispatch', () => {
    it('saves notification with correct format when alert triggers', async () => {
      const alert = makeAlert({
        symbol: 'INFY', targetPrice: 1800, direction: 'above', note: 'Breakout',
      });
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([makeQuote('INFY', 1825)]));
      mockTriggerAlert.mockResolvedValue({ ...alert, status: 'triggered' });

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockSaveNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'price_alert',
          userId: alert.userId,
          title: expect.stringContaining('INFY'),
          message: expect.stringContaining('1825'),
          read: false,
          data: {
            alertId: alert.id,
            symbol: 'INFY',
            targetPrice: 1800,
            triggeredPrice: 1825,
            direction: 'above',
          },
        }),
      );
    });

    it('dispatches webhook event when alert triggers', async () => {
      const alert = makeAlert({ symbol: 'HDFC', targetPrice: 1600, direction: 'above' });
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([makeQuote('HDFC', 1650)]));
      mockTriggerAlert.mockResolvedValue({ ...alert, status: 'triggered' });

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockDispatchWebhook).toHaveBeenCalledWith(
        'price:alert_triggered',
        {
          alertId: alert.id,
          symbol: 'HDFC',
          targetPrice: 1600,
          triggeredPrice: 1650,
          direction: 'above',
        },
        alert.userId,
      );
    });
  });

  // ── Metrics Tracking ───────────────────────────────────────────────────

  describe('metrics tracking', () => {
    it('updates lastCheckedCount with number of symbols checked', async () => {
      const alerts = [
        makeAlert({ symbol: 'RELIANCE', targetPrice: 2000, direction: 'above' }),
        makeAlert({ symbol: 'TCS', targetPrice: 3000, direction: 'above' }),
      ];
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap(alerts));
      mockGetBroker.mockResolvedValue(
        mockBrokerWithQuotes([makeQuote('RELIANCE', 1500), makeQuote('TCS', 2500)]),
      );

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      expect(getStockAlertPollerHealth().lastCheckedCount).toBe(2);
    });

    it('updates totalTriggered when alerts fire', async () => {
      const alert = makeAlert({ symbol: 'WIPRO', targetPrice: 500, direction: 'above' });
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([makeQuote('WIPRO', 550)]));
      mockTriggerAlert.mockResolvedValue({ ...alert, status: 'triggered' });

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      expect(getStockAlertPollerHealth().totalTriggered).toBe(1);
    });

    it('resets metrics via _resetStockAlertPollerMetrics', async () => {
      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);
      expect(getStockAlertPollerHealth().totalPolls).toBe(1);

      _resetStockAlertPollerMetrics();
      const after = getStockAlertPollerHealth();
      expect(after.totalPolls).toBe(0);
      expect(after.totalErrors).toBe(0);
      expect(after.totalTriggered).toBe(0);
    });
  });

  // ── Error Handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('increments totalErrors when getBulkQuotes throws', async () => {
      const alert = makeAlert();
      mockGetActiveAlerts.mockResolvedValue(buildAlertMap([alert]));
      mockGetBroker.mockResolvedValue(mockBrokerThatThrows('API rate limit'));

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      expect(getStockAlertPollerHealth().totalErrors).toBe(1);
      expect(mockTriggerAlert).not.toHaveBeenCalled();
    });

    it('increments totalErrors when getActiveAlerts throws', async () => {
      mockGetActiveAlerts.mockRejectedValue(new Error('DB connection failed'));

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);

      expect(getStockAlertPollerHealth().totalErrors).toBe(1);
    });

    it('continues polling after an error (recovery)', async () => {
      const alert = makeAlert({ symbol: 'RELIANCE', targetPrice: 2890, direction: 'above' });

      // Use counter-based implementation (chained Once mocks can be unreliable with async)
      let callCount = 0;
      mockGetActiveAlerts.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error('DB down'));
        return Promise.resolve(buildAlertMap([alert]));
      });

      mockGetBroker.mockResolvedValue(mockBrokerWithQuotes([makeQuote('RELIANCE', 3000)]));
      mockTriggerAlert.mockResolvedValue({ ...alert, status: 'triggered' });

      startStockAlertPoller();
      await vi.advanceTimersByTimeAsync(0);
      expect(getStockAlertPollerHealth().totalErrors).toBe(1);

      // Next tick should succeed
      await vi.advanceTimersByTimeAsync(60_000);
      expect(getStockAlertPollerHealth().totalErrors).toBe(1); // Still 1 (second succeeded)
      expect(getStockAlertPollerHealth().totalPolls).toBe(2);
    });
  });
});
