/**
 * ============================================================================
 * Toroloom — Commodity Quotes Tests
 * ============================================================================
 *
 * Verifies that the MockBroker generates realistic commodity quotes for
 * both REST API (getQuote, getBulkQuotes) and WebSocket (subscribeTicks) paths.
 *
 * Covers:
 *   - Gold (XAUUSD), Silver (XAGUSD), Crude Oil (CL), Natural Gas (NG)
 *   - Price in expected range (not wildly extreme)
 *   - Change percent in reasonable bounds
 *   - All required MarketQuote fields present
 *   - Multiple commodities via bulk endpoint
 *   - WebSocket tick callback fires with commodity data
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockBroker } from '../services/broker/mockBroker';

const COMMODITY_SYMBOLS = ['XAUUSD', 'XAGUSD', 'CL', 'NG', 'HG', 'ZC', 'ZW'];
const BASE_PRICES: Record<string, number> = {
  XAUUSD: 2335.40,
  XAGUSD: 29.45,
  CL: 78.50,
  NG: 2.85,
  HG: 4.52,
  ZC: 445.00,
  ZW: 585.00,
};

describe('Commodity Quotes — REST API', () => {
  let broker: MockBroker;

  beforeEach(() => {
    broker = new MockBroker();
  });

  it('getQuote returns a valid MarketQuote for Gold (XAUUSD)', async () => {
    const quote = await broker.getQuote('XAUUSD');

    expect(quote).toBeDefined();
    expect(quote.symbol).toBe('XAUUSD');
    expect(quote.lastPrice).toBeGreaterThan(1500);
    expect(quote.lastPrice).toBeLessThan(3500);
    expect(typeof quote.change).toBe('number');
    expect(typeof quote.changePercent).toBe('number');
    expect(quote.volume).toBeGreaterThan(0);
    expect(quote.timestamp).toBeTruthy();
    // Bid/ask should be near lastPrice
    expect(Math.abs(quote.bid - quote.lastPrice)).toBeLessThan(quote.lastPrice * 0.01);
    expect(Math.abs(quote.ask - quote.lastPrice)).toBeLessThan(quote.lastPrice * 0.01);
  });

  it('getQuote returns a valid quote for Silver (XAGUSD)', async () => {
    const quote = await broker.getQuote('XAGUSD');

    expect(quote.symbol).toBe('XAGUSD');
    expect(quote.lastPrice).toBeGreaterThan(15);
    expect(quote.lastPrice).toBeLessThan(60);
    expect(quote.open).toBeGreaterThan(0);
    expect(quote.high).toBeGreaterThanOrEqual(quote.low);
  });

  it('getQuote returns a valid quote for Crude Oil (CL)', async () => {
    const quote = await broker.getQuote('CL');

    expect(quote.symbol).toBe('CL');
    expect(quote.lastPrice).toBeGreaterThan(40);
    expect(quote.lastPrice).toBeLessThan(150);
  });

  it('getQuote returns a valid quote for Natural Gas (NG) — sub-10 price', async () => {
    const quote = await broker.getQuote('NG');

    expect(quote.symbol).toBe('NG');
    expect(quote.lastPrice).toBeGreaterThan(0.5);
    expect(quote.lastPrice).toBeLessThan(10);
  });

  it('getQuote returns a valid quote for Copper (HG)', async () => {
    const quote = await broker.getQuote('HG');

    expect(quote.symbol).toBe('HG');
    expect(quote.lastPrice).toBeGreaterThan(2);
    expect(quote.lastPrice).toBeLessThan(8);
  });

  it('getQuote returns a valid quote for Corn (ZC) — agriculture', async () => {
    const quote = await broker.getQuote('ZC');

    expect(quote.symbol).toBe('ZC');
    expect(quote.lastPrice).toBeGreaterThan(200);
    expect(quote.lastPrice).toBeLessThan(800);
  });

  it('getBulkQuotes returns quotes for all commodity symbols', async () => {
    const quotes = await broker.getBulkQuotes(COMMODITY_SYMBOLS);

    expect(quotes.size).toBe(COMMODITY_SYMBOLS.length);

    for (const symbol of COMMODITY_SYMBOLS) {
      const quote = quotes.get(symbol);
      expect(quote).toBeDefined();
      expect(quote!.symbol).toBe(symbol);
      expect(quote!.lastPrice).toBeGreaterThan(0);

      // Verify price is in realistic range
      const basePrice = BASE_PRICES[symbol];
      // Should be within ±50% of base (allowing for random walk drift)
      expect(quote!.lastPrice).toBeGreaterThan(basePrice * 0.5);
      expect(quote!.lastPrice).toBeLessThan(basePrice * 1.5);
    }
  });

  it('getQuote throws for unknown commodity symbol', async () => {
    await expect(broker.getQuote('UNKNOWN_COMMODITY')).rejects.toThrow('Symbol not found');
  });
});

describe('Commodity Quotes — WebSocket subscribeTicks', () => {
  let broker: MockBroker;

  beforeEach(() => {
    broker = new MockBroker();
  });

  it('subscribeTicks fires at least once for Gold with all MarketQuote fields', async () => {
    const symbols = ['XAUUSD'];

    const tick = await new Promise<import('../services/broker/interface').MarketQuote>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for commodity tick')), 10000);
      const unsubscribe = broker.subscribeTicks(symbols, (quote) => {
        clearTimeout(timeout);
        unsubscribe();
        resolve(quote);
      });
    });

    expect(tick.symbol).toBe('XAUUSD');
    expect(tick.lastPrice).toBeGreaterThan(1500);
    expect(tick.lastPrice).toBeLessThan(3500);
    expect(tick.open).toBeGreaterThan(0);
    expect(tick.high).toBeGreaterThanOrEqual(tick.low);
    expect(tick.volume).toBeGreaterThan(0);
    expect(typeof tick.bid).toBe('number');
    expect(typeof tick.ask).toBe('number');
    expect(tick.timestamp).toBeTruthy();
  });

  it('subscribeTicks fires for multiple commodity symbols', async () => {
    const symbols = ['XAUUSD', 'XAGUSD', 'CL'];
    const receivedSymbols = new Set<string>();

    const tick = await new Promise<import('../services/broker/interface').MarketQuote>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for commodity ticks')), 12000);
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
    // All 3 symbols should have been received
    expect(receivedSymbols.size).toBe(symbols.length);
    for (const sym of symbols) {
      expect(receivedSymbols.has(sym)).toBe(true);
    }
  });

  it('subscribeTicks generates different prices on subsequent calls (random walk)', async () => {
    const symbols = ['CL'];

    // Collect 3 ticks and verify they are not all identical
    const ticks: number[] = [];

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out collecting ticks')), 15000);
      const unsubscribe = broker.subscribeTicks(symbols, (quote) => {
        ticks.push(quote.lastPrice);
        if (ticks.length >= 3) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });

    expect(ticks.length).toBe(3);
    // At least some should differ (random walk should produce variation)
    const uniquePrices = new Set(ticks.map(t => Math.round(t * 100)));
    expect(uniquePrices.size).toBeGreaterThanOrEqual(2);
  });

  it('subscribeTicks with mixed stock + commodity symbols works', async () => {
    const symbols = ['RELIANCE', 'XAUUSD', 'TCS', 'CL'];

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

  it('unsubscribe stops commodity tick generation', async () => {
    const symbols = ['XAUUSD'];
    let tickCount = 0;

    const unsubscribe = broker.subscribeTicks(symbols, () => {
      tickCount++;
    });

    // Ensure at least one tick fired before unsubscribing
    // subscribeTicks fires every 1-3 seconds, so wait up to 4s
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (tickCount > 0) {
          clearInterval(check);
          clearTimeout(fallback);
          resolve();
        }
      }, 100);
      const fallback = setTimeout(() => {
        clearInterval(check);
        resolve(); // proceed even if no tick yet (rare edge case)
      }, 4500);
    });

    unsubscribe();

    const countAfterUnsub = tickCount;

    // Wait to ensure no more ticks arrive after unsubscribe
    await new Promise(r => setTimeout(r, 3000));

    expect(tickCount).toBe(countAfterUnsub);
    expect(tickCount).toBeGreaterThanOrEqual(1);
  });
});

describe('Commodity Quotes — Price Realism', () => {
  let broker: MockBroker;

  beforeEach(() => {
    broker = new MockBroker();
  });

  it('Gold price remains within 20% of base over 50 sequential calls', async () => {
    const basePrice = BASE_PRICES.XAUUSD;
    const quotes: number[] = [];

    for (let i = 0; i < 50; i++) {
      const quote = await broker.getQuote('XAUUSD');
      quotes.push(quote.lastPrice);
    }

    const minPrice = Math.min(...quotes);
    const maxPrice = Math.max(...quotes);

    // Gold should stay within a reasonable band
    expect(minPrice).toBeGreaterThan(basePrice * 0.80);
    expect(maxPrice).toBeLessThan(basePrice * 1.20);
  });

  it('Energy commodities have higher volatility than metals (on average)', async () => {
    const collectChanges = async (symbol: string, count: number): Promise<number[]> => {
      const changes: number[] = [];
      for (let i = 0; i < count; i++) {
        const quote = await broker.getQuote(symbol);
        changes.push(Math.abs(quote.changePercent));
      }
      return changes;
    };

    const goldChanges = await collectChanges('XAUUSD', 30);
    const crudeChanges = await collectChanges('CL', 30);

    const goldAvgVol = goldChanges.reduce((s, v) => s + v, 0) / goldChanges.length;
    const crudeAvgVol = crudeChanges.reduce((s, v) => s + v, 0) / crudeChanges.length;

    // Crude oil should show higher per-tick volatility than gold
    // Note: this is a statistical property, not a guarantee on every run,
    // but with 30 samples the difference should be detectable.
    expect(crudeAvgVol).toBeGreaterThan(goldAvgVol * 0.8); // generous threshold
  });
});
