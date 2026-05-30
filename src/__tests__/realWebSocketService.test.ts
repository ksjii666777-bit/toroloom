/**
 * ============================================================================
 * Toroloom — Real WebSocket Service Tests
 * ============================================================================
 *
 * Tests the RealWebSocketService: WebSocket connection lifecycle, message
 * routing for each protocol message type, auth flow, subscription queuing,
 * auto-subscribe to portfolio, and reconnection logic.
 *
 * We mock the global WebSocket constructor to avoid actual network calls.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RealWebSocketService } from '../services/realWebSocketService';
import { useAuthStore } from '../store/authStore';
import { usePortfolioStore } from '../store/portfolioStore';
import { mockUser } from '../constants/mockData';
import { log } from '../utils/logger';

// ── Mock WebSocket ──────────────────────────────────────────────────────
//
// We replace the global WebSocket with a mock that tracks open/close/send
// and can simulate incoming messages.

type WSMessageHandler = (event: { data: string }) => void;
type WSEventHandler = () => void;

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readyState: number = MockWebSocket.CLOSED;
  onopen: WSEventHandler | null = null;
  onclose: WSEventHandler | null = null;
  onmessage: WSMessageHandler | null = null;
  onerror: WSEventHandler | null = null;
  sentMessages: string[] = [];
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError(): void {
    this.onerror?.();
  }

  static reset(): void {
    MockWebSocket.instances = [];
  }
}

// ── Module Mocks ────────────────────────────────────────────────────────

// Mock logger to track calls
vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('RealWebSocketService', () => {
  let ws: RealWebSocketService;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.reset();

    // Provide mock WebSocket globally BEFORE creating the service instance.
    // We assign via Object.defineProperty so that the constructor lookup
    // inside RealWebSocketService.connect() sees our mock class.
    Object.defineProperty(global, 'WebSocket', {
      value: MockWebSocket,
      writable: true,
      configurable: true,
    });

    ws = new RealWebSocketService();

    useAuthStore.setState({
      user: mockUser,
      token: 'test-jwt-token',
      isLoggedIn: true,
    });
    usePortfolioStore.setState({
      holdings: [],
      trades: [],
    });
  });

  afterEach(() => {
    ws.disconnect();
    vi.useRealTimers();
    delete (global as any).WebSocket;
  });

  // ── Initial State ────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts not authenticated', () => {
      expect(ws.getIsAuthenticated()).toBe(false);
    });

    it('returns fallback price of 1000', () => {
      expect(ws.getCurrentPrice('ANY')).toBe(1000);
    });

    it('returns empty cached candles', () => {
      expect(ws.getCachedCandles('ANY')).toEqual([]);
    });

    it('setLossLimit is a no-op', () => {
      expect(() => ws.setLossLimit(50000)).not.toThrow();
    });
  });

  // ── Connect / Disconnect ──────────────────────────────────────────────

  describe('connect', () => {
    it('creates a WebSocket connection', async () => {
      const connectPromise = ws.connect();
      expect(MockWebSocket.instances.length).toBe(1);

      // Simulate the server opening the connection
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      expect(MockWebSocket.instances[0].readyState).toBe(MockWebSocket.OPEN);
    });

    it('is idempotent when already connected', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      const count = MockWebSocket.instances.length;
      await ws.connect(); // second call should be no-op
      expect(MockWebSocket.instances.length).toBe(count);
    });

    it('sends auth message after receiving connected event', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      // Server sends { type: "connected" }
      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });

      // Verify auth message was sent
      const sent = MockWebSocket.instances[0].sentMessages;
      expect(sent.length).toBeGreaterThanOrEqual(1);

      const lastMsg = JSON.parse(sent[sent.length - 1]);
      expect(lastMsg.type).toBe('auth');
      expect(lastMsg.token).toBe('test-jwt-token');
    });

    it('rejects on connection timeout', async () => {
      const connectPromise = ws.connect();

      // Advance past the 10-second timeout
      vi.advanceTimersByTime(10000);

      await expect(connectPromise).rejects.toThrow('Connection timed out');
    });

    it('rejects on WebSocket error', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateError();

      await expect(connectPromise).rejects.toThrow('Connection error');
    });
  });

  describe('disconnect', () => {
    it('closes the WebSocket and resets state', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      ws.disconnect();

      // The WebSocket close handler fires, which sets isAuthenticated to false
      expect(ws.getIsAuthenticated()).toBe(false);
    });

    it('cancels pending reconnect timer', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      // Simulate close to trigger reconnect scheduling
      MockWebSocket.instances[0].close();

      ws.disconnect(); // Should cancel the reconnect timer

      // Advance time — no reconnect should happen
      vi.advanceTimersByTime(5000);
      // No new WebSocket connections should have been made
      expect(MockWebSocket.instances.length).toBe(1);
    });
  });

  // ── Message Routing ──────────────────────────────────────────────────

  describe('message handling', () => {
    const onPrice = vi.fn();
    const onCandle = vi.fn();

    beforeEach(async () => {
      onPrice.mockClear();
      onCandle.mockClear();

      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      // Complete the auth flow
      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });
      MockWebSocket.instances[0].simulateMessage({
        type: 'authenticated',
        userId: 'user_1',
        positionsCount: 0,
      });
    });

    it('handles pnl_update messages', () => {
      const onPnL = vi.fn();
      ws.onPnLUpdateCallback(onPnL);

      MockWebSocket.instances[0].simulateMessage({
        type: 'pnl_update',
        data: { realizedPnL: 1000, unrealizedPnL: 500, totalPnL: 1500 },
      });

      expect(onPnL).toHaveBeenCalledWith(
        expect.objectContaining({ totalPnL: 1500 })
      );
    });

    it('handles tick messages', () => {
      ws.subscribe('RELIANCE', onPrice, onCandle);

      MockWebSocket.instances[0].simulateMessage({
        type: 'tick',
        data: {
          symbol: 'RELIANCE',
          lastPrice: 2900.50,
          change: 10.00,
          changePercent: 0.35,
          timestamp: '2025-05-28T10:00:00Z',
        },
      });

      expect(onPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          stockId: 'RELIANCE',
          price: 2900.50,
          change: 10.00,
        })
      );
    });

    it('handles lockdown messages', () => {
      const onLockdown = vi.fn();
      ws.onLockdownCallback(onLockdown);

      MockWebSocket.instances[0].simulateMessage({
        type: 'lockdown',
        data: {
          status: 'active',
          triggeredAt: '2025-05-28T10:00:00Z',
          liftsAt: '2025-05-29T10:00:00Z',
          triggerLoss: 55000,
          breachedLimit: 'daily_loss',
        },
      });

      expect(onLockdown).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' })
      );
    });

    it('handles subscribed message without crashing', () => {
      expect(() => {
        MockWebSocket.instances[0].simulateMessage({
          type: 'subscribed',
          symbols: ['RELIANCE', 'TCS'],
          count: 2,
        });
      }).not.toThrow();
    });

    it('handles error message without crashing', () => {
      expect(() => {
        MockWebSocket.instances[0].simulateMessage({
          type: 'error',
          message: 'Rate limit exceeded',
        });
      }).not.toThrow();
    });

    it('handles pong (heartbeat) without crashing', () => {
      expect(() => {
        MockWebSocket.instances[0].simulateMessage({ type: 'pong' });
      }).not.toThrow();
    });

    it('warns on unknown message type', () => {
      MockWebSocket.instances[0].simulateMessage({ type: 'unknown_type' });

      expect(log.warn).toHaveBeenCalledWith(
        '[RealWS] Unknown message type:',
        'unknown_type'
      );
    });

    it('ignores non-JSON messages', () => {
      // Simulate raw non-JSON text
      MockWebSocket.instances[0].onmessage?.({ data: 'not json' });

      expect(log.warn).toHaveBeenCalledWith(
        '[RealWS] Ignoring non-JSON message:',
        'not json'
      );
    });
  });

  // ── Subscribe/Unsubscribe Edge Cases ──────────────────────────────────

  describe('subscribe edge cases', () => {
    const onPrice = vi.fn();
    const onCandle = vi.fn();

    beforeEach(() => {
      onPrice.mockClear();
      onCandle.mockClear();
    });

    it('does not send duplicate subscribe for auto-subscribed stock', async () => {
      usePortfolioStore.setState({
        holdings: [{
          id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE',
          name: 'Reliance Industries', quantity: 50, buyPrice: 2650,
          currentPrice: 2890, totalInvested: 132500, currentValue: 144500,
          pnl: 12000, pnlPercent: 9.06, dayChange: 0, dayChangePercent: 0,
        }],
      });

      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      // Auth triggers auto-subscribe
      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });
      MockWebSocket.instances[0].simulateMessage({
        type: 'authenticated', userId: 'user_1', positionsCount: 1,
      });

      // Clear sent messages
      MockWebSocket.instances[0].sentMessages = [];

      // Subscribe to the same stock already auto-subscribed — should NOT send
      ws.subscribe('RELIANCE', onPrice, onCandle);

      const sent = MockWebSocket.instances[0].sentMessages;
      const subscribeMsgs = sent.filter((m: string) => {
        try { return JSON.parse(m).type === 'subscribe'; }
        catch { return false; }
      });
      expect(subscribeMsgs).toHaveLength(0);
    });

    it('updates callbacks when subscribing to already subscribed stock', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });
      MockWebSocket.instances[0].simulateMessage({
        type: 'authenticated', userId: 'user_1', positionsCount: 0,
      });

      MockWebSocket.instances[0].sentMessages = [];

      // First subscribe sends a message
      ws.subscribe('RELIANCE', onPrice, onCandle);
      const sentAfterFirst = MockWebSocket.instances[0].sentMessages.length;

      // Second subscribe with new callbacks — should NOT send another subscribe
      const onPrice2 = vi.fn();
      const onCandle2 = vi.fn();
      ws.subscribe('RELIANCE', onPrice2, onCandle2);

      expect(MockWebSocket.instances[0].sentMessages.length).toBe(sentAfterFirst);

      // Tick should call the UPDATED callbacks, not the old ones
      MockWebSocket.instances[0].simulateMessage({
        type: 'tick',
        data: { symbol: 'RELIANCE', lastPrice: 3000, change: 10, changePercent: 0.5, timestamp: '2025-06-01T00:00:00Z' },
      });

      expect(onPrice2).toHaveBeenCalledWith(expect.objectContaining({ price: 3000 }));
      expect(onPrice).not.toHaveBeenCalled();
    });

    it('unsubscribe does not send to backend for auto-subscribed stock', async () => {
      usePortfolioStore.setState({
        holdings: [{
          id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE',
          name: 'Reliance Industries', quantity: 50, buyPrice: 2650,
          currentPrice: 2890, totalInvested: 132500, currentValue: 144500,
          pnl: 12000, pnlPercent: 9.06, dayChange: 0, dayChangePercent: 0,
        }],
      });

      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });
      MockWebSocket.instances[0].simulateMessage({
        type: 'authenticated', userId: 'user_1', positionsCount: 1,
      });

      MockWebSocket.instances[0].sentMessages = [];

      // Unsubscribe from auto-subscribed stock — should NOT send unsubscribe
      ws.unsubscribe('RELIANCE');

      const sent = MockWebSocket.instances[0].sentMessages;
      const unsubscribeMsgs = sent.filter((m: string) => {
        try { return JSON.parse(m).type === 'unsubscribe'; }
        catch { return false; }
      });
      expect(unsubscribeMsgs).toHaveLength(0);
    });

    it('sends unsubscribe message for non-auto-subscribed stock', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });
      MockWebSocket.instances[0].simulateMessage({
        type: 'authenticated', userId: 'user_1', positionsCount: 0,
      });

      // Subscribe to a stock (non-auto-subscribed)
      ws.subscribe('TCS', onPrice, onCandle);

      MockWebSocket.instances[0].sentMessages = [];

      // Unsubscribe — should send an unsubscribe message
      ws.unsubscribe('TCS');

      const sent = MockWebSocket.instances[0].sentMessages;
      const unsubscribeMsg = sent.find((m: string) => {
        try {
          const p = JSON.parse(m);
          return p.type === 'unsubscribe' && p.symbols.includes('TCS');
        }
        catch { return false; }
      });
      expect(unsubscribeMsg).toBeDefined();
    });

    it('caches price from tick and returns it via getCurrentPrice', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });
      MockWebSocket.instances[0].simulateMessage({
        type: 'authenticated', userId: 'user_1', positionsCount: 0,
      });

      ws.subscribe('RELIANCE', onPrice, onCandle);

      // Send multiple ticks
      MockWebSocket.instances[0].simulateMessage({
        type: 'tick',
        data: { symbol: 'RELIANCE', lastPrice: 2900, change: 10, changePercent: 0.35, timestamp: '2025-06-01T00:00:00Z' },
      });
      expect(ws.getCurrentPrice('RELIANCE')).toBe(2900);

      MockWebSocket.instances[0].simulateMessage({
        type: 'tick',
        data: { symbol: 'RELIANCE', lastPrice: 2950, change: 50, changePercent: 1.72, timestamp: '2025-06-01T00:01:00Z' },
      });
      expect(ws.getCurrentPrice('RELIANCE')).toBe(2950);

      // Unsubscribed stock still returns cached price
      MockWebSocket.instances[0].simulateMessage({
        type: 'tick',
        data: { symbol: 'TCS', lastPrice: 4200, change: 20, changePercent: 0.48, timestamp: '2025-06-01T00:00:00Z' },
      });
      expect(ws.getCurrentPrice('TCS')).toBe(4200);
      expect(ws.getCurrentPrice('UNKNOWN')).toBe(1000); // fallback
    });

    it('handles tick for stock with no subscriber without crashing', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });
      MockWebSocket.instances[0].simulateMessage({
        type: 'authenticated', userId: 'user_1', positionsCount: 0,
      });

      // Tick for stock nobody subscribed to — should not crash, but price IS cached
      expect(() => {
        MockWebSocket.instances[0].simulateMessage({
          type: 'tick',
          data: { symbol: 'NONSUB', lastPrice: 500, change: 0, changePercent: 0, timestamp: '2025-06-01T00:00:00Z' },
        });
      }).not.toThrow();

      expect(ws.getCurrentPrice('NONSUB')).toBe(500);
    });
  });

  describe('subscribe with pending queue', () => {
    const onPrice = vi.fn();
    const onCandle = vi.fn();

    beforeEach(() => {
      onPrice.mockClear();
      onCandle.mockClear();
    });

    it('queues subscribe before auth', async () => {
      // Connect but don't send authenticated message yet
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      // Subscribe before auth — should be queued
      ws.subscribe('RELIANCE', onPrice, onCandle);

      // Now authenticate
      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });
      MockWebSocket.instances[0].simulateMessage({
        type: 'authenticated',
        userId: 'user_1',
        positionsCount: 0,
      });

      // Should have sent a subscribe message for the queued symbol
      const sent = MockWebSocket.instances[0].sentMessages;
      const subscribeMsg = sent.find((m: string) => {
        try { return JSON.parse(m).type === 'subscribe'; }
        catch { return false; }
      });
      expect(subscribeMsg).toBeDefined();
      expect(JSON.parse(subscribeMsg!).symbols).toContain('RELIANCE');
    });

    it('sends subscribe immediately if already authenticated', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      // Authenticate first
      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });
      MockWebSocket.instances[0].simulateMessage({
        type: 'authenticated',
        userId: 'user_1',
        positionsCount: 0,
      });

      // Clear sent messages
      MockWebSocket.instances[0].sentMessages = [];

      // Subscribe after auth
      ws.subscribe('RELIANCE', onPrice, onCandle);

      const sent = MockWebSocket.instances[0].sentMessages;
      const subscribeMsg = sent.find((m: string) => {
        try { return JSON.parse(m).type === 'subscribe'; }
        catch { return false; }
      });
      expect(subscribeMsg).toBeDefined();
    });

    it('unsubscribe removes from pending queue', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      // Queue a subscribe
      ws.subscribe('RELIANCE', onPrice, onCandle);
      // Then unsubscribe before auth — should remove from pending queue
      ws.unsubscribe('RELIANCE');

      // Authenticate
      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });
      MockWebSocket.instances[0].simulateMessage({
        type: 'authenticated',
        userId: 'user_1',
        positionsCount: 0,
      });

      // Should not send subscribe for RELIANCE since it was removed from pending
      const sent = MockWebSocket.instances[0].sentMessages;
      const subscribeMsgs = sent.filter((m: string) => {
        try { return JSON.parse(m).type === 'subscribe'; }
        catch { return false; }
      });
      // Only the auto-subscribe from portfolio should be there (none if empty)
      expect(subscribeMsgs.length).toBe(0);
    });

    it('auto-subscribes to portfolio holdings after auth', async () => {
      usePortfolioStore.setState({
        holdings: [{
          id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE',
          name: 'Reliance Industries', quantity: 50, buyPrice: 2650,
          currentPrice: 2890, totalInvested: 132500, currentValue: 144500,
          pnl: 12000, pnlPercent: 9.06, dayChange: 0, dayChangePercent: 0,
        }],
      });

      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });
      MockWebSocket.instances[0].simulateMessage({
        type: 'authenticated',
        userId: 'user_1',
        positionsCount: 1,
      });

      const sent = MockWebSocket.instances[0].sentMessages;
      const subscribeMsg = sent.find((m: string) => {
        try {
          const p = JSON.parse(m);
          return p.type === 'subscribe' && p.symbols.includes('RELIANCE');
        }
        catch { return false; }
      });
      expect(subscribeMsg).toBeDefined();
    });
  });

  // ── Auth Edge Cases ────────────────────────────────────────────────────

  describe('auth edge cases', () => {
    it('warns and does not send auth when token is missing', async () => {
      useAuthStore.setState({ token: null });

      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      // Server sends connected — triggers sendAuth
      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });

      expect(log.warn).toHaveBeenCalledWith(
        '[RealWS] No auth token available — cannot authenticate',
      );

      // No auth message should have been sent
      const sent = MockWebSocket.instances[0].sentMessages;
      const authMsgs = sent.filter((m: string) => {
        try { return JSON.parse(m).type === 'auth'; }
        catch { return false; }
      });
      expect(authMsgs).toHaveLength(0);
    });
  });

  // ── Subscribe with no connection (defensive branch) ───────────────────

  describe('subscribe with no connection', () => {
    it('does nothing when isConnected is false even if authenticated', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });
      MockWebSocket.instances[0].simulateMessage({
        type: 'authenticated', userId: 'user_1', positionsCount: 0,
      });

      MockWebSocket.instances[0].sentMessages = [];

      // Force isConnected to false while keeping isAuthenticated true.
      // This can happen during the window between onclose firing and the
      // state being fully reset, or due to internal state inconsistency.
      (ws as any).isConnected = false;

      // Subscribe should reach the `if (this.isConnected)` check and
      // silently skip sending (no else clause).
      ws.subscribe('RELIANCE', vi.fn(), vi.fn());

      // No message should have been sent
      expect(MockWebSocket.instances[0].sentMessages).toHaveLength(0);
    });
  });

  // ── Send Helper ───────────────────────────────────────────────────────────

  describe('send helper', () => {
    it('warns when WebSocket is not open', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      MockWebSocket.instances[0].simulateMessage({ type: 'connected' });
      MockWebSocket.instances[0].simulateMessage({
        type: 'authenticated', userId: 'user_1', positionsCount: 0,
      });

      MockWebSocket.instances[0].sentMessages = [];

      // Set readyState to CLOSED without triggering onclose (so isConnected stays true)
      MockWebSocket.instances[0].readyState = MockWebSocket.CLOSED;

      // Subscribe should call send(), which finds readyState !== OPEN
      ws.subscribe('RELIANCE', vi.fn(), vi.fn());

      expect(log.warn).toHaveBeenCalledWith(
        '[RealWS] Cannot send — WebSocket not open',
      );
    });
  });

  // ── Reconnection ─────────────────────────────────────────────────────

  describe('reconnection', () => {
    it('auto-reconnects on unexpected close', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      const initialCount = MockWebSocket.instances.length;

      // Simulate unexpected close
      MockWebSocket.instances[0].close();

      // Advance time by 3 seconds to trigger reconnect
      vi.advanceTimersByTime(3000);

      // A new WebSocket instance should have been created
      expect(MockWebSocket.instances.length).toBeGreaterThan(initialCount);
    });

    it('does not reconnect after disconnect is called', async () => {
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      ws.disconnect();

      const initialCount = MockWebSocket.instances.length;

      // Advance time — no reconnection should happen
      vi.advanceTimersByTime(10000);
      expect(MockWebSocket.instances.length).toBe(initialCount);
    });
  });

  // ── onConnectionChangeCallback ────────────────────────────────────────

  describe('onConnectionChangeCallback', () => {
    it('fires when connection opens', async () => {
      const cb = vi.fn();
      ws.onConnectionChangeCallback(cb);
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      expect(cb).toHaveBeenCalledWith(true);
    });

    it('fires when connection closes', async () => {
      const cb = vi.fn();
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      ws.onConnectionChangeCallback(cb);

      // Manual close
      MockWebSocket.instances[0].close();
      expect(cb).toHaveBeenCalledWith(false);
    });

    it('fires on disconnect', async () => {
      const cb = vi.fn();
      const connectPromise = ws.connect();
      MockWebSocket.instances[0].simulateOpen();
      await connectPromise;

      ws.onConnectionChangeCallback(cb);
      ws.disconnect();
      expect(cb).toHaveBeenCalledWith(false);
    });
  });
});
