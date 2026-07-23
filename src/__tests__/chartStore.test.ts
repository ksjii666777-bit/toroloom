/**
 * ============================================================================
 * Toroloom — Chart Store Unit Tests
 * ============================================================================
 *
 * Tests the zustand chart store for persistent drawing annotations and
 * chart settings via AsyncStorage:
 *   - loadDrawings / saveDrawings / clearDrawings (per symbol+timeframe)
 *   - loadSettings / saveSettings (per symbol)
 *   - Error handling (corrupted storage, AsyncStorage failures)
 *   - Edge cases (empty arrays, special symbols, large data sets)
 *
 * Framework: vitest
 * Pattern: follows kycStore.test.ts + subscriptionStore.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChartStore } from '../store/chartStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DrawingAnnotation, DrawingPoint } from '../components/chart/DrawingTools';
import type { IndicatorType } from '../components/TechnicalIndicators';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockPoints: DrawingPoint[] = [
  { dataIndex: 10, x: 240, y: 400, price: 2650 },
  { dataIndex: 20, x: 480, y: 380, price: 2890.50 },
];

const mockFibLevels = [
  { level: 0, price: 2650 },
  { level: 0.236, price: 2706.73 },
  { level: 0.382, price: 2741.79 },
  { level: 0.5, price: 2770.25 },
  { level: 0.618, price: 2798.71 },
  { level: 0.786, price: 2839.14 },
  { level: 1, price: 2890.50 },
];

function createTrendline(id: string, color = '#3B82F6'): DrawingAnnotation {
  return {
    id,
    type: 'trendline',
    points: mockPoints,
    color,
    createdAt: Date.now(),
  };
}

function createHorizontalLine(id: string, color = '#FF5252'): DrawingAnnotation {
  return {
    id,
    type: 'horizontal_line',
    points: [{ dataIndex: 0, x: 0, y: 400, price: 2780 }],
    color,
    createdAt: Date.now(),
  };
}

function createFibonacci(id: string, color = '#00E676'): DrawingAnnotation {
  return {
    id,
    type: 'fibonacci',
    points: mockPoints,
    color,
    fibLevels: mockFibLevels,
    createdAt: Date.now(),
  };
}

function createAnnotation(id: string, color = '#FFAB40'): DrawingAnnotation {
  return {
    id,
    type: 'annotation',
    points: [{ dataIndex: 15, x: 360, y: 390, price: 2800 }],
    color,
    label: 'Resistance',
    createdAt: Date.now(),
  };
}

/** Create a ray/vertical drawing for test variety */
function createVerticalRays(id: string, color = '#06B6D4'): DrawingAnnotation {
  return {
    id,
    type: 'ray',
    points: [
      { dataIndex: 5, x: 120, y: 350, price: 2850 },
      { dataIndex: 25, x: 600, y: 320, price: 2920 },
    ],
    color,
    createdAt: Date.now(),
  };
}

/** Default drawing set for a stock */
const defaultDrawings: DrawingAnnotation[] = [
  createTrendline('d1'),
  createHorizontalLine('d2'),
  createFibonacci('d3'),
  createAnnotation('d4'),
];

const defaultSettings = {
  showMA: true,
  showVolume: true,
  activeIndicators: ['rsi', 'bollinger'] as IndicatorType[],
  tickMode: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Get raw stored value for a chart drawings key */
async function getStoredDrawings(symbol: string, timeframe: string): Promise<DrawingAnnotation[] | null> {
  const json = await AsyncStorage.getItem(`@toroloom/chart/${symbol}::${timeframe}`);
  return json ? JSON.parse(json) : null;
}

/** Get raw stored value for a chart settings key */
async function getStoredSettings(symbol: string): Promise<Record<string, any> | null> {
  const json = await AsyncStorage.getItem(`@toroloom/chart/settings/${symbol}`);
  return json ? JSON.parse(json) : null;
}



// ═════════════════════════════════════════════════════════════════════════════
// Drawings — Basic CRUD
// ═════════════════════════════════════════════════════════════════════════════

describe('ChartStore — Drawings CRUD', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  // ── loadDrawings (empty / no data) ──

  describe('loadDrawings', () => {
    it('returns empty array when no drawings exist for symbol+timeframe', async () => {
      const result = await useChartStore.getState().loadDrawings('RELIANCE', '1D');
      expect(result).toEqual([]);
    });

    it('returns empty array for unknown symbol (different key)', async () => {
      // Save for one symbol, load for another
      await useChartStore.getState().saveDrawings('TCS', '1W', defaultDrawings);
      const result = await useChartStore.getState().loadDrawings('TCS', '1D');
      expect(result).toEqual([]);
    });

    it('loads previously saved drawings', async () => {
      await useChartStore.getState().saveDrawings('RELIANCE', '1D', defaultDrawings);

      const result = await useChartStore.getState().loadDrawings('RELIANCE', '1D');
      expect(result).toHaveLength(4);
      expect(result[0].id).toBe('d1');
      expect(result[0].type).toBe('trendline');
      expect(result[1].type).toBe('horizontal_line');
      expect(result[2].type).toBe('fibonacci');
      expect(result[2].fibLevels).toHaveLength(7);
      expect(result[3].type).toBe('annotation');
      expect(result[3].label).toBe('Resistance');
    });

    it('preserves all DrawingAnnotation fields on save+load cycle', async () => {
      await useChartStore.getState().saveDrawings('RELIANCE', '1D', defaultDrawings);
      const result = await useChartStore.getState().loadDrawings('RELIANCE', '1D');

      for (let i = 0; i < defaultDrawings.length; i++) {
        expect(result[i].id).toBe(defaultDrawings[i].id);
        expect(result[i].type).toBe(defaultDrawings[i].type);
        expect(result[i].color).toBe(defaultDrawings[i].color);
        expect(result[i].createdAt).toBe(defaultDrawings[i].createdAt);
        expect(result[i].points).toEqual(defaultDrawings[i].points);
        if (defaultDrawings[i].label) {
          expect(result[i].label).toBe(defaultDrawings[i].label);
        }
        if (defaultDrawings[i].fibLevels) {
          expect(result[i].fibLevels).toEqual(defaultDrawings[i].fibLevels);
        }
      }
    });

    it('supports multiple drawing types on the same symbol+timeframe', async () => {
      const mixed = [
        createTrendline('mix_tl'),
        createVerticalRays('mix_hl'),
        createAnnotation('mix_ann'),
      ];
      await useChartStore.getState().saveDrawings('HDFCBANK', '1W', mixed);
      const result = await useChartStore.getState().loadDrawings('HDFCBANK', '1W');

      expect(result).toHaveLength(3);
      expect(result.find(d => d.type === 'trendline')).toBeDefined();
      expect(result.find(d => d.type === 'ray')).toBeDefined();
      expect(result.find(d => d.type === 'annotation')).toBeDefined();
    });

    // ── Error handling ──

    it('returns empty array on corrupted JSON', async () => {
      // Manually store corrupted JSON
      await AsyncStorage.setItem('@toroloom/chart/RELIANCE::1D', 'not-valid-json');
      const result = await useChartStore.getState().loadDrawings('RELIANCE', '1D');
      expect(result).toEqual([]);
    });

    it('returns empty array when AsyncStorage.getItem throws', async () => {
      vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Storage read failure'));
      const result = await useChartStore.getState().loadDrawings('RELIANCE', '1D');
      expect(result).toEqual([]);
    });
  });

  // ── saveDrawings ──

  describe('saveDrawings', () => {
    it('persists drawings to AsyncStorage', async () => {
      await useChartStore.getState().saveDrawings('RELIANCE', '1D', defaultDrawings);

      const stored = await getStoredDrawings('RELIANCE', '1D');
      expect(stored).toHaveLength(4);
      expect(stored![0].id).toBe('d1');
    });

    it('overwrites existing drawings for same key', async () => {
      await useChartStore.getState().saveDrawings('RELIANCE', '1D', defaultDrawings);
      // Save a smaller set
      await useChartStore.getState().saveDrawings('RELIANCE', '1D', [createTrendline('new_d1')]);

      const stored = await getStoredDrawings('RELIANCE', '1D');
      expect(stored).toHaveLength(1);
      expect(stored![0].id).toBe('new_d1');
    });

    it('does not affect other symbol+timeframe keys', async () => {
      await useChartStore.getState().saveDrawings('RELIANCE', '1D', defaultDrawings);
      await useChartStore.getState().saveDrawings('TCS', '1D', [createTrendline('tcs_d1')]);
      await useChartStore.getState().saveDrawings('RELIANCE', '1W', [createHorizontalLine('wl_d1')]);

      const reliance1D = await getStoredDrawings('RELIANCE', '1D');
      const tcs1D = await getStoredDrawings('TCS', '1D');
      const reliance1W = await getStoredDrawings('RELIANCE', '1W');

      expect(reliance1D).toHaveLength(4);
      expect(tcs1D).toHaveLength(1);
      expect(tcs1D![0].id).toBe('tcs_d1');
      expect(reliance1W).toHaveLength(1);
      expect(reliance1W![0].id).toBe('wl_d1');
    });

    it('persists empty drawings array', async () => {
      await useChartStore.getState().saveDrawings('RELIANCE', '1D', []);
      const stored = await getStoredDrawings('RELIANCE', '1D');
      expect(stored).toEqual([]);
    });

    it('does not throw on AsyncStorage.setItem failure', async () => {
      vi.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('Storage write failure'));
      // Should not throw — store catches the error internally
      await expect(
        useChartStore.getState().saveDrawings('RELIANCE', '1D', defaultDrawings)
      ).resolves.toBeUndefined();
    });
  });

  // ── clearDrawings ──

  describe('clearDrawings', () => {
    it('removes drawings for the specified symbol+timeframe', async () => {
      await useChartStore.getState().saveDrawings('RELIANCE', '1D', defaultDrawings);
      await useChartStore.getState().clearDrawings('RELIANCE', '1D');

      const stored = await getStoredDrawings('RELIANCE', '1D');
      expect(stored).toBeNull();
    });

    it('does not affect other symbol+timeframe keys', async () => {
      await useChartStore.getState().saveDrawings('RELIANCE', '1D', defaultDrawings);
      await useChartStore.getState().saveDrawings('TCS', '1D', [createTrendline('tcs_d1')]);

      await useChartStore.getState().clearDrawings('RELIANCE', '1D');

      const tcsStored = await getStoredDrawings('TCS', '1D');
      expect(tcsStored).toHaveLength(1); // TCS should still exist
      expect(tcsStored![0].id).toBe('tcs_d1');
    });

    it('is idempotent — calling on non-existent key does not throw', async () => {
      await expect(
        useChartStore.getState().clearDrawings('FAKE', '1M')
      ).resolves.toBeUndefined();
    });

    it('shows loadDrawings returns [] after clear', async () => {
      await useChartStore.getState().saveDrawings('RELIANCE', '1D', defaultDrawings);
      await useChartStore.getState().clearDrawings('RELIANCE', '1D');

      const result = await useChartStore.getState().loadDrawings('RELIANCE', '1D');
      expect(result).toEqual([]);
    });

    it('does not throw on AsyncStorage.removeItem failure', async () => {
      vi.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('Storage removal failure'));
      // Should not throw — store catches the error internally
      await expect(
        useChartStore.getState().clearDrawings('RELIANCE', '1D')
      ).resolves.toBeUndefined();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Drawings — Timeframe Scoping
// ═════════════════════════════════════════════════════════════════════════════

describe('ChartStore — Drawings Timeframe Scoping', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('stores drawings per timeframe for the same symbol', async () => {
    await useChartStore.getState().saveDrawings('RELIANCE', '1D', [createTrendline('d_1d')]);
    await useChartStore.getState().saveDrawings('RELIANCE', '1W', [createHorizontalLine('d_1w')]);
    await useChartStore.getState().saveDrawings('RELIANCE', '1M', [createFibonacci('d_1m')]);

    const result1D = await useChartStore.getState().loadDrawings('RELIANCE', '1D');
    const result1W = await useChartStore.getState().loadDrawings('RELIANCE', '1W');
    const result1M = await useChartStore.getState().loadDrawings('RELIANCE', '1M');

    expect(result1D).toHaveLength(1);
    expect(result1D[0].type).toBe('trendline');
    expect(result1W).toHaveLength(1);
    expect(result1W[0].type).toBe('horizontal_line');
    expect(result1M).toHaveLength(1);
    expect(result1M[0].type).toBe('fibonacci');
  });

  it('supports all common timeframes', async () => {
    const timeframes = ['1D', '1W', '1M', '3M', '1Y'];
    for (const tf of timeframes) {
      await useChartStore.getState().saveDrawings('RELIANCE', tf, [createTrendline(`d_${tf}`)]);
    }

    for (const tf of timeframes) {
      const result = await useChartStore.getState().loadDrawings('RELIANCE', tf);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(`d_${tf}`);
    }
  });

  it('clearing one timeframe does not affect others', async () => {
    await useChartStore.getState().saveDrawings('RELIANCE', '1D', [createTrendline('d_1d')]);
    await useChartStore.getState().saveDrawings('RELIANCE', '1W', [createHorizontalLine('d_1w')]);

    await useChartStore.getState().clearDrawings('RELIANCE', '1D');

    const result1D = await useChartStore.getState().loadDrawings('RELIANCE', '1D');
    const result1W = await useChartStore.getState().loadDrawings('RELIANCE', '1W');

    expect(result1D).toEqual([]);
    expect(result1W).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Drawings — Symbol Scoping (different symbols don't interfere)
// ═════════════════════════════════════════════════════════════════════════════

describe('ChartStore — Drawings Symbol Scoping', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('drawings are scoped per symbol (same timeframe)', async () => {
    await useChartStore.getState().saveDrawings('RELIANCE', '1D', [createTrendline('rel_d1')]);
    await useChartStore.getState().saveDrawings('TCS', '1D', [createHorizontalLine('tcs_d1')]);
    await useChartStore.getState().saveDrawings('HDFCBANK', '1D', [createFibonacci('hdfc_d1')]);

    const rel = await useChartStore.getState().loadDrawings('RELIANCE', '1D');
    const tcs = await useChartStore.getState().loadDrawings('TCS', '1D');
    const hdfc = await useChartStore.getState().loadDrawings('HDFCBANK', '1D');

    expect(rel[0].id).toBe('rel_d1');
    expect(tcs[0].id).toBe('tcs_d1');
    expect(hdfc[0].id).toBe('hdfc_d1');
  });

  it('supports symbols with special characters', async () => {
    const specialSymbols = [
      'BANKNIFTY24JUN45000CE',
      'NIFTY24JUL24700PE',
      'SENSEX25DEC85000CE',
      'BTC-INR',
    ];
    for (const sym of specialSymbols) {
      await useChartStore.getState().saveDrawings(sym, '1D', [createTrendline(`d_${sym}`)]);
    }

    for (const sym of specialSymbols) {
      const result = await useChartStore.getState().loadDrawings(sym, '1D');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(`d_${sym}`);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Drawings — Large Data Sets
// ═════════════════════════════════════════════════════════════════════════════

describe('ChartStore — Drawings Large Data Sets', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('handles a large number of drawings (50 annotations)', async () => {
    const manyDrawings: DrawingAnnotation[] = Array.from({ length: 50 }, (_, i) =>
      createAnnotation(`bulk_${i}`)
    );

    await useChartStore.getState().saveDrawings('RELIANCE', '1D', manyDrawings);
    const result = await useChartStore.getState().loadDrawings('RELIANCE', '1D');

    expect(result).toHaveLength(50);
    expect(result[0].id).toBe('bulk_0');
    expect(result[49].id).toBe('bulk_49');
  });

  it('handles large points arrays in a single drawing', async () => {
    const manyPoints: DrawingPoint[] = Array.from({ length: 100 }, (_, i) => ({
      dataIndex: i,
      x: i * 10,
      y: 400 - i * 2,
      price: 2800 + i * 5,
    }));

    const bigDrawing: DrawingAnnotation = {
      id: 'big_drawing',
      type: 'trendline',
      points: manyPoints,
      color: '#8B5CF6',
      createdAt: Date.now(),
    };

    await useChartStore.getState().saveDrawings('RELIANCE', '1D', [bigDrawing]);
    const result = await useChartStore.getState().loadDrawings('RELIANCE', '1D');

    expect(result).toHaveLength(1);
    expect(result[0].points).toHaveLength(100);
    expect(result[0].points[99].price).toBe(2800 + 99 * 5);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Settings — Basic CRUD
// ═════════════════════════════════════════════════════════════════════════════

describe('ChartStore — Settings CRUD', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe('loadSettings', () => {
    it('returns null when no settings exist for symbol', async () => {
      const result = await useChartStore.getState().loadSettings('RELIANCE');
      expect(result).toBeNull();
    });

    it('loads previously saved settings', async () => {
      await useChartStore.getState().saveSettings('RELIANCE', defaultSettings);

      const result = await useChartStore.getState().loadSettings('RELIANCE');
      expect(result).not.toBeNull();
      expect(result!.showMA).toBe(true);
      expect(result!.showVolume).toBe(true);
      expect(result!.activeIndicators).toEqual(['rsi', 'bollinger']);
      expect(result!.tickMode).toBe(false);
    });

    it('returns null on corrupted JSON', async () => {
      await AsyncStorage.setItem('@toroloom/chart/settings/RELIANCE', 'corrupted-json');
      const result = await useChartStore.getState().loadSettings('RELIANCE');
      expect(result).toBeNull();
    });

    it('returns null when AsyncStorage.getItem throws', async () => {
      vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Storage error'));
      const result = await useChartStore.getState().loadSettings('RELIANCE');
      expect(result).toBeNull();
    });

    it('merges partial settings with defaults', async () => {
      // Store only partial settings
      await AsyncStorage.setItem(
        '@toroloom/chart/settings/RELIANCE',
        JSON.stringify({ tickMode: true })
      );
      const result = await useChartStore.getState().loadSettings('RELIANCE');
      expect(result).not.toBeNull();
      expect(result!.tickMode).toBe(true);
      // Default values for missing fields
      expect(result!.activeTimeframe).toBe('1M');
      expect(result!.showMA).toBe(false);
      expect(result!.showVolume).toBe(true);
      expect(result!.activeIndicators).toEqual([]);
    });
  });

  describe('saveSettings', () => {
    it('persists settings to AsyncStorage', async () => {
      await useChartStore.getState().saveSettings('RELIANCE', defaultSettings);

      const stored = await getStoredSettings('RELIANCE');
      expect(stored).not.toBeNull();
      expect(stored!.showMA).toBe(true);
      expect(stored!.showVolume).toBe(true);
      expect(stored!.activeIndicators).toEqual(['rsi', 'bollinger']);
    });

    it('merges partial settings with existing values', async () => {
      // First save full settings
      await useChartStore.getState().saveSettings('RELIANCE', defaultSettings);
      // Then save just a partial update
      await useChartStore.getState().saveSettings('RELIANCE', { tickMode: true });

      const stored = await getStoredSettings('RELIANCE');
      expect(stored!.showMA).toBe(true); // preserved from first save
      expect(stored!.showVolume).toBe(true); // preserved from first save
      expect(stored!.tickMode).toBe(true); // updated
      expect(stored!.activeIndicators).toEqual(['rsi', 'bollinger']); // preserved
    });

    it('partial save without prior settings merges with defaults', async () => {
      await useChartStore.getState().saveSettings('TCS', { activeTimeframe: '1W' });

      const stored = await getStoredSettings('TCS');
      expect(stored!.activeTimeframe).toBe('1W');
      // Defaults filled in
      expect(stored!.showVolume).toBe(true);
      expect(stored!.showMA).toBe(false);
      expect(stored!.tickMode).toBe(false);
      expect(stored!.activeIndicators).toEqual([]);
    });

    it('does not affect settings for other symbols', async () => {
      await useChartStore.getState().saveSettings('RELIANCE', { showMA: true });
      await useChartStore.getState().saveSettings('TCS', { showMA: false });

      const rel = await getStoredSettings('RELIANCE');
      const tcs = await getStoredSettings('TCS');
      expect(rel!.showMA).toBe(true);
      expect(tcs!.showMA).toBe(false);
    });

    it('does not throw on AsyncStorage.setItem failure', async () => {
      vi.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('Storage write failure'));
      await expect(
        useChartStore.getState().saveSettings('RELIANCE', defaultSettings)
      ).resolves.toBeUndefined();
    });
  });

  describe('saveSettings — indicator edge cases', () => {
    beforeEach(async () => {
      await AsyncStorage.clear();
    });

    it('saves empty indicators array', async () => {
      await useChartStore.getState().saveSettings('RELIANCE', { activeIndicators: [] });
      const result = await useChartStore.getState().loadSettings('RELIANCE');
      expect(result!.activeIndicators).toEqual([]);
    });

    it('saves all three indicators', async () => {
      await useChartStore.getState().saveSettings('RELIANCE', {
        activeIndicators: ['rsi', 'macd', 'bollinger'],
      });
      const result = await useChartStore.getState().loadSettings('RELIANCE');
      expect(result!.activeIndicators).toEqual(['rsi', 'macd', 'bollinger']);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Settings — Full Round-Trip (save → load → verify)
// ═════════════════════════════════════════════════════════════════════════════

describe('ChartStore — Settings Full Round-Trip', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('preserves all ChartSettings fields through save+load cycle', async () => {
    const settings = {
      activeTimeframe: '1W',
      showMA: true,
      showVolume: false,
      activeIndicators: ['rsi', 'macd'] as IndicatorType[],
      tickMode: true,
    };

    await useChartStore.getState().saveSettings('RELIANCE', settings);
    const result = await useChartStore.getState().loadSettings('RELIANCE');

    expect(result).not.toBeNull();
    expect(result!.activeTimeframe).toBe('1W');
    expect(result!.showMA).toBe(true);
    expect(result!.showVolume).toBe(false);
    expect(result!.activeIndicators).toEqual(['rsi', 'macd']);
    expect(result!.tickMode).toBe(true);
  });

  it('multiple updates preserve latest values', async () => {
    await useChartStore.getState().saveSettings('RELIANCE', { showMA: true });
    await useChartStore.getState().saveSettings('RELIANCE', { showMA: false });
    await useChartStore.getState().saveSettings('RELIANCE', { showMA: true });

    const result = await useChartStore.getState().loadSettings('RELIANCE');
    expect(result!.showMA).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Concurrency — No data races between drawings and settings
// ═════════════════════════════════════════════════════════════════════════════

describe('ChartStore — Drawings & Settings Isolation', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('saving drawings does not affect settings for the same symbol', async () => {
    await useChartStore.getState().saveSettings('RELIANCE', { showMA: true });
    await useChartStore.getState().saveDrawings('RELIANCE', '1D', defaultDrawings);

    const settings = await useChartStore.getState().loadSettings('RELIANCE');
    expect(settings!.showMA).toBe(true);
  });

  it('saving settings does not affect drawings for the same symbol', async () => {
    await useChartStore.getState().saveDrawings('RELIANCE', '1D', defaultDrawings);
    await useChartStore.getState().saveSettings('RELIANCE', { showMA: true });

    const drawings = await useChartStore.getState().loadDrawings('RELIANCE', '1D');
    expect(drawings).toHaveLength(4);
  });
});


