/**
 * Toroloom — Ticker Provider Tests
 *
 * Covers the hybrid TradingView ⇄ SnapTrade bridge:
 *  - Synced ticker (chart + order panel update together)
 *  - Symbol mapping (TV ↔ SnapTrade)
 *  - Single execution price (never taken from the chart)
 *  - Real-time feed with simulated fallback
 *
 * Run: npx vitest run src/__tests__/tickerProvider.test.ts
 */

import { act } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render } from './testUtils';

const { mockGetActiveWS, mockMapToTv } = vi.hoisted(() => ({
  mockGetActiveWS: vi.fn(() => null),
  mockMapToTv: vi.fn((sym: string, exchange?: string) =>
    exchange ? `${exchange}:${sym}` : `NSE:${sym}`,
  ),
}));

vi.mock('../services/wsRegistry', () => ({
  getActiveWS: mockGetActiveWS,
}));

vi.mock('../utils/tradingView', () => ({
  toTradingViewSymbol: mockMapToTv,
}));

import { tickerProvider, useTicker, useExecutionPrice } from '../services/tickerProvider';

describe('tickerProvider — synced ticker', () => {
  beforeEach(() => {
    tickerProvider.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('selects a symbol and maps it to both SnapTrade and TradingView forms', () => {
    const sel = tickerProvider.selectSymbol({ symbol: 'aapl', exchange: 'NASDAQ', price: 180.5 });
    expect(sel).toMatchObject({
      symbol: 'AAPL',
      tvSymbol: 'NASDAQ:AAPL',
      price: 180.5,
    });
  });

  it('emits to subscribers only on an actual symbol change', () => {
    const listener = vi.fn();
    const unsub = tickerProvider.subscribeTicker(listener);

    tickerProvider.selectSymbol({ symbol: 'AAPL', exchange: 'NASDAQ' });
    expect(listener).toHaveBeenCalledTimes(1);

    // Same symbol again → no-op, no re-emit.
    tickerProvider.selectSymbol({ symbol: 'aapl', exchange: 'NASDAQ' });
    expect(listener).toHaveBeenCalledTimes(1);

    tickerProvider.selectSymbol({ symbol: 'TSLA', exchange: 'NASDAQ' });
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
  });

  it('rejects empty symbols and keeps the previous ticker', () => {
    tickerProvider.selectSymbol({ symbol: 'AAPL' });
    const prev = tickerProvider.getTicker();
    expect(tickerProvider.selectSymbol({ symbol: '  ' })).toBe(prev);
    expect(tickerProvider.selectSymbol({ symbol: '' })).toBe(prev);
  });

  it('setTicker replaces the ticker wholesale', () => {
    const listener = vi.fn();
    tickerProvider.subscribeTicker(listener);
    tickerProvider.setTicker({ symbol: 'BTC', tvSymbol: 'BINANCE:BTCUSDT' });
    expect(tickerProvider.getTicker()?.symbol).toBe('BTC');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('tickerProvider — symbol mapping', () => {
  beforeEach(() => tickerProvider.reset());

  it('strips the exchange prefix from TradingView symbols', () => {
    expect(tickerProvider.toSnapTradeSymbol('NASDAQ:AAPL')).toBe('AAPL');
    expect(tickerProvider.toSnapTradeSymbol('NSE:RELIANCE')).toBe('RELIANCE');
    expect(tickerProvider.toSnapTradeSymbol('BINANCE:BTCUSDT')).toBe('BTCUSDT');
    expect(tickerProvider.toSnapTradeSymbol('AAPL')).toBe('AAPL');
  });

  it('passes already-qualified symbols through in toTradingViewSymbol', () => {
    expect(tickerProvider.toTradingViewSymbol('NASDAQ:AAPL')).toBe('NASDAQ:AAPL');
    expect(tickerProvider.toTradingViewSymbol('NSE:RELIANCE')).toBe('NSE:RELIANCE');
    expect(tickerProvider.toTradingViewSymbol('')).toBe('');
  });

  it('uses the provided exchange when mapping bare symbols', () => {
    expect(tickerProvider.toTradingViewSymbol('AAPL', 'NASDAQ')).toBe('NASDAQ:AAPL');
    expect(tickerProvider.toTradingViewSymbol('RELIANCE')).toBe('NSE:RELIANCE');
  });
});

describe('tickerProvider — single execution price', () => {
  beforeEach(() => {
    tickerProvider.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('publishes a price and replays it to late subscribers', () => {
    tickerProvider.publishPrice(181.25, 'AAPL', 'manual');
    expect(tickerProvider.getExecutionPrice()).toBe(181.25);

    const listener = vi.fn();
    tickerProvider.subscribeExecutionPrice(listener);
    // Late subscriber immediately receives the latest quote.
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].price).toBe(181.25);
  });

  it('ignores invalid prices (0, negative, NaN)', () => {
    tickerProvider.publishPrice(0, 'AAPL');
    tickerProvider.publishPrice(-5, 'AAPL');
    tickerProvider.publishPrice(NaN, 'AAPL');
    expect(tickerProvider.getExecutionPrice()).toBeNull();
  });

  it('publishPrice normalizes the symbol to SnapTrade form', () => {
    tickerProvider.publishPrice(10, 'NASDAQ:MSFT');
    expect(tickerProvider.getExecutionQuote()?.symbol).toBe('MSFT');
  });

  it('returns the single price used for execution, not the chart price', () => {
    // Simulate the widget emitting a display price — must NOT become the
    // execution price (only publishPrice can set it).
    const chartDisplayPrice = 9999;
    expect(tickerProvider.getExecutionPrice()).not.toBe(chartDisplayPrice);

    tickerProvider.publishPrice(182.0, 'AAPL');
    expect(tickerProvider.getExecutionPrice()).toBe(182.0);
  });
});

describe('tickerProvider — real-time feed', () => {
  beforeEach(() => {
    tickerProvider.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('falls back to simulated ticks when no WebSocket is available', () => {
    mockGetActiveWS.mockReturnValue(null);
    const onQuote = vi.fn();

    // Seed a base price first so the simulator has something to drift from.
    tickerProvider.publishPrice(100, 'AAPL', 'manual');
    const unsub = tickerProvider.startExecutionPriceFeed('AAPL', onQuote);

    act(() => {
      vi.advanceTimersByTime(3001);
    });

    expect(onQuote).toHaveBeenCalled();
    expect(onQuote.mock.calls[0][0].source).toBe('simulated');
    expect(onQuote.mock.calls[0][0].symbol).toBe('AAPL');
    expect(onQuote.mock.calls[0][0].price).toBeGreaterThan(0);

    unsub();
    const calls = onQuote.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(onQuote.mock.calls.length).toBe(calls); // unsubscribed → no more ticks
  });

  it('uses the WebSocket as the primary price source when available', () => {
    let priceCb: ((d: any) => void) | null = null;
    const fakeWs = {
      connect: vi.fn(() => Promise.resolve()),
      subscribe: vi.fn((sym: string, cb: (d: any) => void) => {
        priceCb = cb;
      }),
      unsubscribe: vi.fn(),
      disconnect: vi.fn(),
    };
    mockGetActiveWS.mockReturnValue(fakeWs as any);

    const onQuote = vi.fn();
    const unsub = tickerProvider.startExecutionPriceFeed('AAPL', onQuote);

    expect(fakeWs.subscribe).toHaveBeenCalledWith('AAPL', expect.any(Function), expect.any(Function));

    // Simulate a WS tick arriving.
    act(() => {
      priceCb?.({ price: 185.4, timestamp: '2026-01-01T00:00:00.000Z' });
    });

    expect(onQuote).toHaveBeenCalledWith(
      expect.objectContaining({ price: 185.4, source: 'ws', symbol: 'AAPL' }),
    );
    expect(tickerProvider.getExecutionPrice()).toBe(185.4);

    unsub();
    // Cleanup unsubscribes the symbol but never disconnects the shared WS.
    expect(fakeWs.unsubscribe).toHaveBeenCalledWith('AAPL');
    expect(fakeWs.disconnect).not.toHaveBeenCalled();
  });

  it('never starts the simulated feed while a WebSocket is available', () => {
    const fakeWs = {
      connect: vi.fn(() => Promise.resolve()),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      disconnect: vi.fn(),
    };
    mockGetActiveWS.mockReturnValue(fakeWs as any);

    const onQuote = vi.fn();
    tickerProvider.publishPrice(100, 'AAPL', 'manual');
    const unsub = tickerProvider.startExecutionPriceFeed('AAPL', onQuote);

    // No simulated ticks while the WS is available — single price stream only.
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(onQuote).not.toHaveBeenCalled();

    unsub();
  });

  it('ignores malformed WS ticks', () => {
    let priceCb: ((d: any) => void) | null = null;
    const fakeWs = {
      connect: vi.fn(() => Promise.resolve()),
      subscribe: vi.fn((_sym: string, cb: (d: any) => void) => {
        priceCb = cb;
      }),
      unsubscribe: vi.fn(),
      disconnect: vi.fn(),
    };
    mockGetActiveWS.mockReturnValue(fakeWs as any);

    const onQuote = vi.fn();
    tickerProvider.startExecutionPriceFeed('AAPL', onQuote);

    act(() => {
      priceCb?.(null as any);
      priceCb?.({ price: 0 });
      priceCb?.({ price: -3 });
    });
    expect(onQuote).not.toHaveBeenCalled();
  });
});

describe('tickerProvider — React hooks', () => {
  beforeEach(() => {
    tickerProvider.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('useTicker returns the current ticker and updates on selectSymbol', () => {
    const box: { current: ReturnType<typeof useTicker> } = { current: null };
    function Harness() {
      box.current = useTicker();
      return null;
    }
    act(() => {
      render(<Harness />);
    });
    expect(box.current).toBeNull();

    act(() => {
      tickerProvider.selectSymbol({ symbol: 'MSFT', exchange: 'NASDAQ' });
    });

    expect(box.current?.symbol).toBe('MSFT');
    expect(box.current?.tvSymbol).toBe('NASDAQ:MSFT');
  });

  it('useExecutionPrice returns the latest quote', () => {
    const box: { current: ReturnType<typeof useExecutionPrice> } = { current: null };
    function Harness() {
      box.current = useExecutionPrice();
      return null;
    }
    act(() => {
      render(<Harness />);
    });
    expect(box.current).toBeNull();

    act(() => {
      tickerProvider.publishPrice(250.1, 'MSFT', 'manual');
    });

    expect(box.current?.price).toBe(250.1);
    expect(box.current?.source).toBe('manual');
  });
});
