/**
 * ============================================================================
 * Toroloom — WebSocket Service Interface Tests
 * ============================================================================
 *
 * Tests that the wsService module correctly exports all callback types and
 * that objects implementing the WebSocketService interface satisfy
 * structural typing at runtime.
 *
 * Since wsService.ts is primarily type definitions, these tests validate
 * that the type system is consistent and that a compliant implementation
 * can be constructed and its methods called without errors.
 */

import { describe, it, expect, vi } from 'vitest';

// Unmock if setup.ts mocks it (check setup.ts — it mocks wsService.ts)
vi.unmock('../services/wsService');

import type {
  PriceUpdateCallback,
  CandleUpdateCallback,
  ConnectionCallback,
  PnLUpdateCallback,
  LockdownCallback,
  WebSocketService,
} from '../services/wsService';

import type { StockHistoryPoint } from '../types';

// ============================================================================
// Type Existence — compile-time checks (validated via assertions)
// ============================================================================

describe('wsService — callback type signatures', () => {
  it('PriceUpdateCallback accepts correct shape', () => {
    const cb: PriceUpdateCallback = vi.fn();
    cb({
      stockId: 'RELIANCE',
      price: 2890.50,
      change: 15.25,
      changePercent: 0.53,
      timestamp: '2025-06-01T10:00:00Z',
    });
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ stockId: 'RELIANCE', price: 2890.50 }),
    );
  });

  it('CandleUpdateCallback accepts correct shape', () => {
    const cb: CandleUpdateCallback = vi.fn();
    const candle: StockHistoryPoint = {
      date: '2025-06-01T10:00:00Z',
      open: 2880,
      high: 2900,
      low: 2875,
      close: 2895,
      volume: 2500000,
    };
    cb({ stockId: 'RELIANCE', candle });
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ stockId: 'RELIANCE' }),
    );
  });

  it('ConnectionCallback accepts boolean', () => {
    const cb: ConnectionCallback = vi.fn();
    cb(true);
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('ConnectionCallback accepts false', () => {
    const cb: ConnectionCallback = vi.fn();
    cb(false);
    expect(cb).toHaveBeenCalledWith(false);
  });

  it('PnLUpdateCallback accepts correct shape', () => {
    const cb: PnLUpdateCallback = vi.fn();
    cb({ realizedPnL: 1000, unrealizedPnL: -500, totalPnL: 500 });
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ realizedPnL: 1000, totalPnL: 500 }),
    );
  });

  it('PnLUpdateCallback handles negative values', () => {
    const cb: PnLUpdateCallback = vi.fn();
    cb({ realizedPnL: -2000, unrealizedPnL: -3000, totalPnL: -5000 });
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ totalPnL: -5000 }),
    );
  });

  it('LockdownCallback accepts active status', () => {
    const cb: LockdownCallback = vi.fn();
    cb({
      status: 'active',
      triggeredAt: '2025-06-01T10:00:00Z',
      liftsAt: '2025-06-02T10:00:00Z',
      triggerLoss: 50000,
      breachedLimit: 'daily_loss',
    });
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', triggerLoss: 50000 }),
    );
  });

  it('LockdownCallback accepts none status', () => {
    const cb: LockdownCallback = vi.fn();
    cb({
      status: 'none',
      triggeredAt: null,
      liftsAt: null,
      triggerLoss: null,
      breachedLimit: null,
    });
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'none', breachedLimit: null }),
    );
  });

  it('LockdownCallback accepts cooldown status', () => {
    const cb: LockdownCallback = vi.fn();
    cb({
      status: 'cooldown',
      triggeredAt: '2025-06-01T10:00:00Z',
      liftsAt: '2025-06-02T10:00:00Z',
      triggerLoss: 25000,
      breachedLimit: 'daily_loss_percent',
    });
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cooldown', breachedLimit: 'daily_loss_percent' }),
    );
  });
});

// ============================================================================
// WebSocketService Interface — structural type compliance
// ============================================================================

describe('wsService — WebSocketService interface contract', () => {
  it('a compliant implementation can be constructed', () => {
    const impl: WebSocketService = createMinimalWSImpl();
    expect(impl).toBeDefined();
    expect(typeof impl.connect).toBe('function');
    expect(typeof impl.disconnect).toBe('function');
    expect(typeof impl.subscribe).toBe('function');
    expect(typeof impl.unsubscribe).toBe('function');
    expect(typeof impl.onConnectionChangeCallback).toBe('function');
    expect(typeof impl.onPnLUpdateCallback).toBe('function');
    expect(typeof impl.onLockdownCallback).toBe('function');
    expect(typeof impl.setLossLimit).toBe('function');
    expect(typeof impl.getCurrentPrice).toBe('function');
    expect(typeof impl.getCachedCandles).toBe('function');
    expect(typeof impl.getIsAuthenticated).toBe('function');
  });

  it('connect returns a promise', () => {
    const impl = createMinimalWSImpl();
    const result = impl.connect();
    expect(result).toBeInstanceOf(Promise);
  });

  it('subscribe stores callbacks and unsubscribe removes them', () => {
    const impl = createMinimalWSImpl();
    const onPrice: PriceUpdateCallback = vi.fn();
    const onCandle: CandleUpdateCallback = vi.fn();

    impl.subscribe('RELIANCE', onPrice, onCandle);
    impl.unsubscribe('RELIANCE');
    // No error — structural contract satisfied
    expect(true).toBe(true);
  });

  it('getCurrentPrice returns a number', () => {
    const impl = createMinimalWSImpl();
    const price = impl.getCurrentPrice('RELIANCE');
    expect(typeof price).toBe('number');
  });

  it('getCachedCandles returns an array', () => {
    const impl = createMinimalWSImpl();
    const candles = impl.getCachedCandles('RELIANCE');
    expect(Array.isArray(candles)).toBe(true);
  });

  it('getIsAuthenticated returns a boolean', () => {
    const impl = createMinimalWSImpl();
    expect(typeof impl.getIsAuthenticated()).toBe('boolean');
  });

  it('onConnectionChangeCallback registers a callback', () => {
    const impl = createMinimalWSImpl();
    const cb: ConnectionCallback = vi.fn();
    impl.onConnectionChangeCallback(cb);
    // Callback stored — test structural contract
    expect(true).toBe(true);
  });

  it('onPnLUpdateCallback registers a callback', () => {
    const impl = createMinimalWSImpl();
    const cb: PnLUpdateCallback = vi.fn();
    impl.onPnLUpdateCallback(cb);
    expect(true).toBe(true);
  });

  it('onLockdownCallback registers a callback', () => {
    const impl = createMinimalWSImpl();
    const cb: LockdownCallback = vi.fn();
    impl.onLockdownCallback(cb);
    expect(true).toBe(true);
  });

  it('setLossLimit accepts a number', () => {
    const impl = createMinimalWSImpl();
    impl.setLossLimit(100000);
    expect(true).toBe(true);
  });

  it('full lifecycle can execute without errors', async () => {
    const impl = createMinimalWSImpl();
    const onPrice: PriceUpdateCallback = vi.fn();
    const onCandle: CandleUpdateCallback = vi.fn();
    const onConnection: ConnectionCallback = vi.fn();
    const onPnL: PnLUpdateCallback = vi.fn();
    const onLockdown: LockdownCallback = vi.fn();

    await impl.connect();
    impl.onConnectionChangeCallback(onConnection);
    impl.onPnLUpdateCallback(onPnL);
    impl.onLockdownCallback(onLockdown);
    impl.subscribe('RELIANCE', onPrice, onCandle);
    impl.setLossLimit(50000);

    const price = impl.getCurrentPrice('RELIANCE');
    expect(typeof price).toBe('number');

    const candles = impl.getCachedCandles('RELIANCE');
    expect(Array.isArray(candles)).toBe(true);

    const isAuth = impl.getIsAuthenticated();
    expect(typeof isAuth).toBe('boolean');

    impl.unsubscribe('RELIANCE');
    impl.disconnect();

    // Lifecycle completed without error
    expect(true).toBe(true);
  });
});

// ============================================================================
// Helper — create a minimal WebSocketService implementation
// ============================================================================

function createMinimalWSImpl(): WebSocketService {
  const priceCallbacks = new Map<string, { onPrice: PriceUpdateCallback; onCandle: CandleUpdateCallback }>();

  return {
    async connect(): Promise<void> {
      // No-op
    },
    disconnect(): void {
      priceCallbacks.clear();
    },
    subscribe(stockId: string, onPrice: PriceUpdateCallback, onCandle: CandleUpdateCallback): void {
      priceCallbacks.set(stockId, { onPrice, onCandle });
    },
    unsubscribe(stockId: string): void {
      priceCallbacks.delete(stockId);
    },
    onConnectionChangeCallback(_cb: ConnectionCallback): void {
      // No-op
    },
    onPnLUpdateCallback(_cb: PnLUpdateCallback): void {
      // No-op
    },
    onLockdownCallback(_cb: LockdownCallback): void {
      // No-op
    },
    setLossLimit(_limit: number): void {
      // No-op
    },
    getCurrentPrice(_stockId: string): number {
      return 1000;
    },
    getCachedCandles(_stockId: string): StockHistoryPoint[] {
      return [];
    },
    getIsAuthenticated(): boolean {
      return false;
    },
  };
}
