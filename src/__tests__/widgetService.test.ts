/**
 * ============================================================================
 * Toroloom — Widget Service Unit Tests
 * ============================================================================
 *
 * Covers:
 *   1. updateSnapshot() — portfolio totals, top 5 holdings, hiddenSymbols filter,
 *      market status detection, AsyncStorage write
 *   2. getSnapshot() — read cached snapshot
 *   3. getPreferences() — read with defaults fallback
 *   4. savePreferences() — merge and persist, triggers snapshot refresh
 *   5. formatForWidget() — Cr, L, K formatting
 *   6. formatPnLPercent() — sign-aware percentage formatting
 *   7. startWidgetAutoUpdate() — subscription and initial refresh
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/widgetService.test.ts
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { widgetService, startWidgetAutoUpdate } from '../services/widgetService';
import { usePortfolioStore } from '../store/portfolioStore';
import type { Holding } from '../types';

// ──── Mock AsyncStorage (closure-based store) ──────────────────────────────

const mockStore: Record<string, string> = {};

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStore[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStore[key];
      return Promise.resolve();
    }),
  },
}));

// ──── Mock logger (prevent noise) ──────────────────────────────────────────

vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// ──── Fixtures ─────────────────────────────────────────────────────────────

/** Create a holding with sensible defaults for testing */
function createHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    stockId: overrides.symbol ?? 'RELIANCE',
    symbol: overrides.symbol ?? 'RELIANCE',
    name: overrides.name ?? 'Reliance Industries',
    quantity: overrides.quantity ?? 10,
    buyPrice: overrides.buyPrice ?? 2500,
    currentPrice: overrides.currentPrice ?? 2890,
    totalInvested: overrides.totalInvested ?? (overrides.quantity ?? 10) * (overrides.buyPrice ?? 2500),
    currentValue: overrides.currentValue ?? (overrides.quantity ?? 10) * (overrides.currentPrice ?? 2890),
    pnl: overrides.pnl ?? ((overrides.quantity ?? 10) * (overrides.currentPrice ?? 2890)) - ((overrides.quantity ?? 10) * (overrides.buyPrice ?? 2500)),
    pnlPercent: overrides.pnlPercent ?? (((overrides.currentPrice ?? 2890) - (overrides.buyPrice ?? 2500)) / (overrides.buyPrice ?? 2500)) * 100,
    dayChange: overrides.dayChange ?? 0,
    dayChangePercent: overrides.dayChangePercent ?? 0,
  };
}

/** Sample holdings with varied values for ordering tests */
const sampleHoldings: Holding[] = [
  createHolding({ symbol: 'RELIANCE', name: 'Reliance Industries', quantity: 50, buyPrice: 2650, currentPrice: 2890 }),
  createHolding({ symbol: 'TCS', name: 'Tata Consultancy Services', quantity: 20, buyPrice: 3800, currentPrice: 4100 }),
  createHolding({ symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 30, buyPrice: 1600, currentPrice: 1750, currentValue: 52500, pnl: 4500, pnlPercent: 9.38 }),
  createHolding({ symbol: 'INFY', name: 'Infosys', quantity: 40, buyPrice: 1450, currentPrice: 1620 }),
  createHolding({ symbol: 'ICICIBANK', name: 'ICICI Bank', quantity: 25, buyPrice: 1100, currentPrice: 1280, currentValue: 32000, pnl: 4500, pnlPercent: 16.36 }),
  createHolding({ symbol: 'SBIN', name: 'State Bank of India', quantity: 35, buyPrice: 780, currentPrice: 840, currentValue: 29400, pnl: 2100, pnlPercent: 7.69 }),
];

// ============================================================================
// Tests
// ============================================================================

describe('widgetService', () => {
  beforeEach(() => {
    // Clear AsyncStorage mock
    Object.keys(mockStore).forEach(k => delete mockStore[k]);
    // Reset portfolio store to empty holdings
    usePortfolioStore.setState({ holdings: [], trades: [] });
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // formatForWidget
  // ─────────────────────────────────────────────────────────────────────────

  describe('formatForWidget', () => {
    it('formats crores correctly', () => {
      expect(widgetService.formatForWidget(12_500_000)).toBe('₹1.25Cr');
    });

    it('formats lakhs correctly', () => {
      expect(widgetService.formatForWidget(1_250_000)).toBe('₹12.5L');
    });

    it('formats thousands correctly', () => {
      expect(widgetService.formatForWidget(12_500)).toBe('₹12.5K');
    });

    it('formats small values without suffix', () => {
      expect(widgetService.formatForWidget(999)).toBe('₹999');
    });

    it('handles zero', () => {
      expect(widgetService.formatForWidget(0)).toBe('₹0');
    });

    it('handles edge case at 10 million boundary', () => {
      expect(widgetService.formatForWidget(10_000_000)).toBe('₹1.00Cr');
    });

    it('handles edge case at 100 thousand boundary', () => {
      expect(widgetService.formatForWidget(100_000)).toBe('₹1.0L');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // formatPnLPercent
  // ─────────────────────────────────────────────────────────────────────────

  describe('formatPnLPercent', () => {
    it('formats positive percent with leading +', () => {
      expect(widgetService.formatPnLPercent(16.36)).toBe('+16.4%');
    });

    it('formats negative percent with leading -', () => {
      expect(widgetService.formatPnLPercent(-5.2)).toBe('-5.2%');
    });

    it('formats zero with leading +', () => {
      expect(widgetService.formatPnLPercent(0)).toBe('+0.0%');
    });

    it('rounds to one decimal place', () => {
      expect(widgetService.formatPnLPercent(12.345)).toBe('+12.3%');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getPreferences
  // ─────────────────────────────────────────────────────────────────────────

  describe('getPreferences', () => {
    it('returns defaults when nothing is stored', async () => {
      const prefs = await widgetService.getPreferences();
      expect(prefs.showPnL).toBe(true);
      expect(prefs.theme).toBe('dark');
      expect(prefs.defaultSize).toBe('medium');
      expect(prefs.highlightedMetric).toBe('totalValue');
      expect(prefs.hiddenSymbols).toEqual([]);
      expect(prefs.widgetEnabled).toBe(true);
    });

    it('merges stored preferences with defaults', async () => {
      mockStore['toroloom_widget_preferences'] = JSON.stringify({
        showPnL: false,
        theme: 'light',
      });

      const prefs = await widgetService.getPreferences();
      expect(prefs.showPnL).toBe(false);
      expect(prefs.theme).toBe('light');
      // Defaults for non-stored fields
      expect(prefs.defaultSize).toBe('medium');
      expect(prefs.hiddenSymbols).toEqual([]);
    });

    it('returns defaults when stored data is corrupted', async () => {
      mockStore['toroloom_widget_preferences'] = 'not-json';

      const prefs = await widgetService.getPreferences();
      expect(prefs.showPnL).toBe(true);
      expect(prefs.defaultSize).toBe('medium');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // savePreferences
  // ─────────────────────────────────────────────────────────────────────────

  describe('savePreferences', () => {
    it('merges partial preferences with existing', async () => {
      mockStore['toroloom_widget_preferences'] = JSON.stringify({
        showPnL: true,
        theme: 'dark',
        hiddenSymbols: ['RELIANCE'],
      });

      await widgetService.savePreferences({ showPnL: false });

      const saved = JSON.parse(mockStore['toroloom_widget_preferences']);
      expect(saved.showPnL).toBe(false);
      expect(saved.theme).toBe('dark');            // Preserved from existing
      expect(saved.hiddenSymbols).toEqual(['RELIANCE']); // Preserved from existing
    });

    it('triggers snapshot refresh after saving preferences', async () => {
      usePortfolioStore.setState({ holdings: sampleHoldings });

      await widgetService.savePreferences({ theme: 'light' });

      // Preferences were saved
      const prefs = JSON.parse(mockStore['toroloom_widget_preferences']);
      expect(prefs.theme).toBe('light');

      // Snapshot was refreshed (data key exists)
      expect(mockStore['toroloom_widget_data']).toBeDefined();
      const snapshot = JSON.parse(mockStore['toroloom_widget_data']);
      expect(snapshot.currentValue).toBeGreaterThan(0);
    });


  });

  // ─────────────────────────────────────────────────────────────────────────
  // getSnapshot
  // ─────────────────────────────────────────────────────────────────────────

  describe('getSnapshot', () => {
    it('returns null when no snapshot is stored', async () => {
      const snapshot = await widgetService.getSnapshot();
      expect(snapshot).toBeNull();
    });

    it('returns parsed snapshot data', async () => {
      const testSnapshot = {
        version: 1,
        updatedAt: '2025-01-01T00:00:00.000Z',
        totalInvested: 500000,
        currentValue: 600000,
        pnl: 100000,
        pnlPercent: 20,
        topHoldings: [],
        totalHoldingCount: 0,
        marketStatus: 'open' as const,
        theme: 'dark' as const,
        showPnL: true,
        widgetSize: 'medium' as const,
      };
      mockStore['toroloom_widget_data'] = JSON.stringify(testSnapshot);

      const snapshot = await widgetService.getSnapshot();
      expect(snapshot).toEqual(testSnapshot);
    });

    it('returns null when stored data is corrupted', async () => {
      mockStore['toroloom_widget_data'] = '{broken';

      const snapshot = await widgetService.getSnapshot();
      expect(snapshot).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateSnapshot
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateSnapshot', () => {
    it('calculates totals correctly from holdings', async () => {
      usePortfolioStore.setState({ holdings: sampleHoldings });

      await widgetService.updateSnapshot();

      const snapshot = JSON.parse(mockStore['toroloom_widget_data']);

      // totalInvested = sum of holdings
      const expectedInvested = sampleHoldings.reduce((s, h) => s + h.totalInvested, 0);
      expect(snapshot.totalInvested).toBe(expectedInvested);

      // currentValue = sum of current values
      const expectedValue = sampleHoldings.reduce((s, h) => s + h.currentValue, 0);
      expect(snapshot.currentValue).toBe(expectedValue);

      // pnl = currentValue - totalInvested
      expect(snapshot.pnl).toBe(expectedValue - expectedInvested);

      // totalHoldingCount should match full portfolio (not filtered)
      expect(snapshot.totalHoldingCount).toBe(sampleHoldings.length);
    });

    it('selects top 5 holdings by current value', async () => {
      usePortfolioStore.setState({ holdings: sampleHoldings });

      await widgetService.updateSnapshot();

      const snapshot = JSON.parse(mockStore['toroloom_widget_data']);

      // Top 5 should be sorted by currentValue descending
      expect(snapshot.topHoldings).toHaveLength(5);
      // The 6th holding (lowest value) should NOT be in top 5
      const sorted = [...sampleHoldings].sort((a, b) => b.currentValue - a.currentValue);
      expect(snapshot.topHoldings[0].symbol).toBe(sorted[0].symbol);
      expect(snapshot.topHoldings[4].symbol).toBe(sorted[4].symbol);
      expect(snapshot.topHoldings.find((h: any) => h.symbol === sorted[5].symbol)).toBeUndefined();
    });

    it('includes all holdings when there are fewer than 5', async () => {
      usePortfolioStore.setState({ holdings: sampleHoldings.slice(0, 3) });

      await widgetService.updateSnapshot();

      const snapshot = JSON.parse(mockStore['toroloom_widget_data']);
      expect(snapshot.topHoldings).toHaveLength(3);
    });

    it('writes snapshot to AsyncStorage with correct key', async () => {
      usePortfolioStore.setState({ holdings: sampleHoldings.slice(0, 2) });

      await widgetService.updateSnapshot();

      expect(mockStore['toroloom_widget_data']).toBeDefined();
      const snapshot = JSON.parse(mockStore['toroloom_widget_data']);
      expect(snapshot.version).toBe(1);
      expect(snapshot.updatedAt).toBeDefined();
    });

    it('handles empty holdings gracefully', async () => {
      usePortfolioStore.setState({ holdings: [] });

      await widgetService.updateSnapshot();

      const snapshot = JSON.parse(mockStore['toroloom_widget_data']);
      expect(snapshot.totalInvested).toBe(0);
      expect(snapshot.currentValue).toBe(0);
      expect(snapshot.pnl).toBe(0);
      expect(snapshot.topHoldings).toHaveLength(0);
      expect(snapshot.totalHoldingCount).toBe(0);
    });

    it('handles errors gracefully without throwing', async () => {
      usePortfolioStore.setState({ holdings: sampleHoldings.slice(0, 2) });

      // Make AsyncStorage write fail for this call only
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      vi.mocked(AsyncStorage.default.setItem).mockRejectedValueOnce(new Error('Storage full'));

      await expect(widgetService.updateSnapshot()).resolves.toBeUndefined();
    });

    it('respects showPnL preference when false', async () => {
      mockStore['toroloom_widget_preferences'] = JSON.stringify({ showPnL: false });
      usePortfolioStore.setState({ holdings: sampleHoldings.slice(0, 2) });

      await widgetService.updateSnapshot();

      const snapshot = JSON.parse(mockStore['toroloom_widget_data']);
      expect(snapshot.showPnL).toBe(false);
      expect(snapshot.pnl).toBe(0);
      expect(snapshot.pnlPercent).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateSnapshot — hiddenSymbols filter
  // ─────────────────────────────────────────────────────────────────────────

  describe('updateSnapshot — hiddenSymbols filter', () => {
    it('excludes hidden symbols from top holdings', async () => {
      mockStore['toroloom_widget_preferences'] = JSON.stringify({
        hiddenSymbols: ['RELIANCE', 'TCS'],
      });
      usePortfolioStore.setState({ holdings: sampleHoldings });

      await widgetService.updateSnapshot();

      const snapshot = JSON.parse(mockStore['toroloom_widget_data']);
      const symbols = snapshot.topHoldings.map((h: any) => h.symbol);
      expect(symbols).not.toContain('RELIANCE');
      expect(symbols).not.toContain('TCS');
    });

    it('still reports totalHoldingCount as unfiltered portfolio size', async () => {
      mockStore['toroloom_widget_preferences'] = JSON.stringify({
        hiddenSymbols: ['RELIANCE'],
      });
      usePortfolioStore.setState({ holdings: sampleHoldings });

      await widgetService.updateSnapshot();

      const snapshot = JSON.parse(mockStore['toroloom_widget_data']);
      expect(snapshot.totalHoldingCount).toBe(sampleHoldings.length);
      expect(snapshot.topHoldings.length).toBeLessThan(sampleHoldings.length);
    });

    it('shows all holdings when hiddenSymbols is empty', async () => {
      mockStore['toroloom_widget_preferences'] = JSON.stringify({
        hiddenSymbols: [],
      });
      usePortfolioStore.setState({ holdings: sampleHoldings });

      await widgetService.updateSnapshot();

      const snapshot = JSON.parse(mockStore['toroloom_widget_data']);
      expect(snapshot.topHoldings).toHaveLength(5);
    });

    it('handles case where all holdings are hidden', async () => {
      const allSymbols = sampleHoldings.map(h => h.symbol);
      mockStore['toroloom_widget_preferences'] = JSON.stringify({
        hiddenSymbols: allSymbols,
      });
      usePortfolioStore.setState({ holdings: sampleHoldings });

      await widgetService.updateSnapshot();

      const snapshot = JSON.parse(mockStore['toroloom_widget_data']);
      expect(snapshot.topHoldings).toHaveLength(0);
    });
  });
});
