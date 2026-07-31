/**
 * ============================================================================
 * Toroloom — Forex Quotes Tests
 * ============================================================================
 *
 * Verifies that the MockBroker generates realistic forex pair quotes for
 * both REST API (getQuote, getBulkQuotes) and WebSocket (subscribeTicks) paths.
 *
 * Covers:
 *   - INR pairs (USDINR, EURINR, GBPINR, JPYINR, SGDINR, CNYINR, HKDINR, THBINR)
 *   - Crosses (EURUSD, GBPUSD, USDJPY)
 *   - Sub-1 precision for JPYINR (4 decimal places)
 *   - Price in expected range (not wildly extreme)
 *   - All required MarketQuote fields present
 *   - Multiple pairs via bulk endpoint
 *   - WebSocket tick callback fires with forex data
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockBroker } from '../services/broker/mockBroker';

const FOREX_SYMBOLS = ['USDINR', 'EURINR', 'GBPINR', 'JPYINR', 'SGDINR', 'CNYINR', 'HKDINR', 'THBINR', 'EURUSD', 'GBPUSD', 'USDJPY'];
const BASE_PRICES: Record<string, number> = {
  USDINR: 83.45,
  EURINR: 90.78,
  GBPINR: 106.20,
  JPYINR: 0.54,
  SGDINR: 61.80,
  CNYINR: 11.52,
  HKDINR: 10.68,
  THBINR: 2.28,
  EURUSD: 1.0875,
  GBPUSD: 1.2730,
  USDJPY: 154.80,
};

describe('Forex Quotes — REST API', () => {
  let broker: MockBroker;

  beforeEach(() => {
    broker = new MockBroker();
  });

  it('getQuote returns a valid quote for USD/INR', async () => {
    const quote = await broker.getQuote('USDINR');

    expect(quote).toBeDefined();
    expect(quote.symbol).toBe('USDINR');
    expect(quote.lastPrice).toBeGreaterThan(75);
    expect(quote.lastPrice).toBeLessThan(95);
    expect(typeof quote.change).toBe('number');
    expect(typeof quote.changePercent).toBe('number');
    expect(quote.volume).toBeGreaterThan(0);
    expect(quote.timestamp).toBeTruthy();
    // Bid/ask should be near lastPrice
    expect(Math.abs(quote.bid - quote.lastPrice)).toBeLessThan(quote.lastPrice * 0.01);
    expect(Math.abs(quote.ask - quote.lastPrice)).toBeLessThan(quote.lastPrice * 0.01);
    // open/high/low present and consistent
    expect(quote.open).toBeGreaterThan(0);
    expect(quote.high).toBeGreaterThanOrEqual(quote.low);
  });

  it('getQuote returns a valid quote for EUR/INR', async () => {
    const quote = await broker.getQuote('EURINR');

    expect(quote.symbol).toBe('EURINR');
    expect(quote.lastPrice).toBeGreaterThan(80);
    expect(quote.lastPrice).toBeLessThan(105);
  });

  it('getQuote returns sub-1 precision for JPY/INR', async () => {
    const quote = await broker.getQuote('JPYINR');

    expect(quote.symbol).toBe('JPYINR');
    expect(quote.lastPrice).toBeGreaterThan(0.3);
    expect(quote.lastPrice).toBeLessThan(1.0);
    // 4-decimal precision for small rates — verify the value sits on a 4-decimal grid
    // (string-length checks are flaky: 0.54 stringifies as '54', not '5400')
    expect(Math.round(quote.lastPrice * 10000) / 10000).toBe(quote.lastPrice);
  });

  it('getQuote returns a valid quote for a cross pair (EUR/USD)', async () => {
    const quote = await broker.getQuote('EURUSD');

    expect(quote.symbol).toBe('EURUSD');
    expect(quote.lastPrice).toBeGreaterThan(0.9);
    expect(quote.lastPrice).toBeLessThan(1.3);
  });

  it('getBulkQuotes returns quotes for all forex symbols', async () => {
    const quotes = await broker.getBulkQuotes(FOREX_SYMBOLS);

    expect(quotes.size).toBe(FOREX_SYMBOLS.length);

    for (const symbol of FOREX_SYMBOLS) {
      const quote = quotes.get(symbol);
      expect(quote).toBeDefined();
      expect(quote!.symbol).toBe(symbol);
      expect(quote!.lastPrice).toBeGreaterThan(0);

      // Verify price is in realistic range (±10% of base)
      const basePrice = BASE_PRICES[symbol];
      expect(quote!.lastPrice).toBeGreaterThan(basePrice * 0.9);
      expect(quote!.lastPrice).toBeLessThan(basePrice * 1.1);
    }
  });
});

describe('Forex Quotes — WebSocket subscribeTicks', () => {
  let broker: MockBroker;

  beforeEach(() => {
    broker = new MockBroker();
  });

  it('subscribeTicks fires at least once for USD/INR with all MarketQuote fields', async () => {
    const symbols = ['USDINR'];

    const tick = await new Promise<import('../services/broker/interface').MarketQuote>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for forex tick')), 10000);
      const unsubscribe = broker.subscribeTicks(symbols, (quote) => {
        clearTimeout(timeout);
        unsubscribe();
        resolve(quote);
      });
    });

    expect(tick.symbol).toBe('USDINR');
    expect(tick.lastPrice).toBeGreaterThan(75);
    expect(tick.lastPrice).toBeLessThan(95);
    expect(tick.open).toBeGreaterThan(0);
    expect(tick.high).toBeGreaterThanOrEqual(tick.low);
    expect(tick.volume).toBeGreaterThan(0);
    expect(typeof tick.bid).toBe('number');
    expect(typeof tick.ask).toBe('number');
    expect(tick.timestamp).toBeTruthy();
  });

  it('subscribeTicks fires for multiple forex symbols', async () => {
    const symbols = ['USDINR', 'EURINR', 'GBPINR'];
    const receivedSymbols = new Set<string>();

    const tick = await new Promise<import('../services/broker/interface').MarketQuote>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for forex ticks')), 12000);
      const unsubscribe = broker.subscribeTicks(symbols, (quote) => {
        receivedSymbols.add(quote.symbol);
        if (receivedSymbols.size >= symbols.length) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(quote);
        }
      });
    });

    expect(tick).toBeDefined();
    expect(symbols).toContain(tick.symbol);
    expect(receivedSymbols.size).toBe(symbols.length);
    for (const sym of symbols) {
      expect(receivedSymbols.has(sym)).toBe(true);
    }
  });

  it('subscribeTicks generates different prices on subsequent calls (random walk)', async () => {
    const symbols = ['EURUSD'];
    const ticks: number[] = [];

    await new Promise<void>((resolve, reject) => {
      // 5 ticks × up to 3s per interval (1000 + rand*2000ms) — keep timeout well clear
      const timeout = setTimeout(() => reject(new Error('Timed out collecting forex ticks')), 25000);
      const unsubscribe = broker.subscribeTicks(symbols, (quote) => {
        ticks.push(quote.lastPrice);
        if (ticks.length >= 5) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });

    expect(ticks.length).toBe(5);
    // EURUSD is 4-decimal precision — compare on the 4-decimal grid
    const uniquePrices = new Set(ticks.map(t => Math.round(t * 10000)));
    expect(uniquePrices.size).toBeGreaterThanOrEqual(2);
  });

  it('subscribeTicks with mixed stock + commodity + forex symbols works', async () => {
    const symbols = ['RELIANCE', 'XAUUSD', 'USDINR', 'TCS', 'EURUSD'];

    const receivedSymbols = new Set<string>();

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for mixed ticks')), 15000);
      const unsubscribe = broker.subscribeTicks(symbols, (quote) => {
        receivedSymbols.add(quote.symbol);
        if (receivedSymbols.size >= symbols.length) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });

    expect(receivedSymbols.size).toBe(symbols.length);
    for (const sym of symbols) {
      expect(receivedSymbols.has(sym)).toBe(true);
    }
  });
});

describe('Forex Quotes — Price Realism', () => {
  let broker: MockBroker;

  beforeEach(() => {
    broker = new MockBroker();
  });

  it('USD/INR price remains within 10% of base over 50 sequential calls', async () => {
    const basePrice = BASE_PRICES.USDINR;
    const quotes: number[] = [];

    for (let i = 0; i < 50; i++) {
      const quote = await broker.getQuote('USDINR');
      quotes.push(quote.lastPrice);
    }

    const minPrice = Math.min(...quotes);
    const maxPrice = Math.max(...quotes);

    // Forex pairs are low-volatility — should stay in a tight band
    expect(minPrice).toBeGreaterThan(basePrice * 0.90);
    expect(maxPrice).toBeLessThan(basePrice * 1.10);
  });

  it('cross pairs (EURUSD) stay in realistic band', async () => {
    const basePrice = BASE_PRICES.EURUSD;

    for (let i = 0; i < 30; i++) {
      const quote = await broker.getQuote('EURUSD');
      expect(quote.lastPrice).toBeGreaterThan(basePrice * 0.90);
      expect(quote.lastPrice).toBeLessThan(basePrice * 1.10);
    }
  });
});
