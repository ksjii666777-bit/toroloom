import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  forexSeeds,
  isForexSymbol,
  generateForexQuote,
  startForexTickStream,
} from '../services/broker/forexQuotes';

// ──────────────── Shared Forex Quote Module (backend/src/services/broker/forexQuotes.ts) ────────────────
// Focused unit tests for the shared simulated-forex generator used by MockBroker,
// ZerodhaBroker, UpstoxBroker and AngelBroker. (MockBroker-level REST/WS behavior
// is covered separately in forexQuotes.test.ts.)

describe('forexQuotes — shared forex quote module', () => {
  describe('isForexSymbol', () => {
    it('returns true for known INR pairs and crosses', () => {
      expect(isForexSymbol('USDINR')).toBe(true);
      expect(isForexSymbol('EURINR')).toBe(true);
      expect(isForexSymbol('EURUSD')).toBe(true);
      expect(isForexSymbol('USDJPY')).toBe(true);
    });

    it('returns false for stock, commodity and unknown symbols', () => {
      expect(isForexSymbol('RELIANCE')).toBe(false);
      expect(isForexSymbol('XAUUSD')).toBe(false);
      expect(isForexSymbol('TOTALLY_UNKNOWN')).toBe(false);
      expect(isForexSymbol('')).toBe(false);
    });

    it('covers every seed symbol', () => {
      for (const seed of forexSeeds) {
        expect(isForexSymbol(seed.symbol)).toBe(true);
      }
    });
  });

  describe('generateForexQuote', () => {
    it('returns null for unknown symbols', () => {
      expect(generateForexQuote('RELIANCE')).toBeNull();
      expect(generateForexQuote('XYZ123')).toBeNull();
      expect(generateForexQuote('')).toBeNull();
    });

    it('returns a well-formed MarketQuote for a known pair', () => {
      const quote = generateForexQuote('USDINR');
      expect(quote).not.toBeNull();
      if (!quote) return;

      expect(quote.symbol).toBe('USDINR');
      expect(typeof quote.lastPrice).toBe('number');
      expect(quote.lastPrice).toBeGreaterThan(0);
      expect(Number.isNaN(quote.lastPrice)).toBe(false);

      for (const key of ['change', 'changePercent', 'open', 'high', 'low', 'close', 'volume', 'bid', 'ask'] as const) {
        expect(typeof quote[key]).toBe('number');
        expect(Number.isNaN(quote[key])).toBe(false);
      }

      // timestamp is a valid ISO date string
      expect(new Date(quote.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('adapts precision to rate magnitude (2 dp for rates >= 10, 4 dp below)', () => {
      const usdinr = generateForexQuote('USDINR');
      const jpyinr = generateForexQuote('JPYINR');
      const eurusd = generateForexQuote('EURUSD');
      expect(usdinr).not.toBeNull();
      expect(jpyinr).not.toBeNull();
      expect(eurusd).not.toBeNull();

      if (!usdinr || !jpyinr || !eurusd) return;
      // INR pairs (rate >= 10) round to 2 decimals
      expect(usdinr.lastPrice * 100).toBeCloseTo(Math.round(usdinr.lastPrice * 100), 6);
      // Sub-1 rates (JPYINR) round to 4 decimals
      expect(jpyinr.lastPrice * 10000).toBeCloseTo(Math.round(jpyinr.lastPrice * 10000), 6);
      // Crosses (EURUSD < 10) round to 4 decimals
      expect(eurusd.lastPrice * 10000).toBeCloseTo(Math.round(eurusd.lastPrice * 10000), 6);
    });

    it('keeps the price within a sane clamped range over repeated ticks', () => {
      for (let i = 0; i < 100; i++) {
        const quote = generateForexQuote('EURUSD');
        expect(quote).not.toBeNull();
        if (!quote) return;
        expect(quote.lastPrice).toBeGreaterThan(0);
        expect(quote.lastPrice).toBeLessThan(1.0875 * 1.5); // ±1% per tick + base drift guard
      }
    });

    it('generates a quote for every seed symbol', () => {
      for (const seed of forexSeeds) {
        expect(generateForexQuote(seed.symbol)).not.toBeNull();
      }
    });
  });

  describe('startForexTickStream', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('emits ticks for forex symbols and stops on unsubscribe', () => {
      const onTick = vi.fn();
      const unsubscribe = startForexTickStream(['USDINR', 'EURUSD'], onTick);

      vi.advanceTimersByTime(5000);
      expect(onTick).toHaveBeenCalled();
      const calls = onTick.mock.calls.map((c: any[]) => c[0]);
      const symbols = calls.map((q: any) => q.symbol);
      expect(symbols).toContain('USDINR');
      expect(symbols).toContain('EURUSD');

      // Streamed ticks are well-formed MarketQuotes
      expect(typeof calls[0].lastPrice).toBe('number');
      expect(Number.isNaN(calls[0].lastPrice)).toBe(false);

      // Stop the stream — no further ticks may arrive
      const callsBeforeStop = onTick.mock.calls.length;
      unsubscribe();
      vi.advanceTimersByTime(10000);
      expect(onTick.mock.calls.length).toBe(callsBeforeStop);
    });

    it('ignores non-forex symbols', () => {
      const onTick = vi.fn();
      const unsubscribe = startForexTickStream(['RELIANCE'], onTick);

      vi.advanceTimersByTime(10000);
      expect(onTick).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('returns a no-op for an empty symbol list', () => {
      const onTick = vi.fn();
      const unsubscribe = startForexTickStream([], onTick);

      expect(typeof unsubscribe).toBe('function');
      vi.advanceTimersByTime(10000);
      expect(onTick).not.toHaveBeenCalled();
      unsubscribe();
    });
  });
});
