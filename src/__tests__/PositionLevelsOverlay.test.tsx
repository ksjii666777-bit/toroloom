/**
 * ============================================================================
 * Toroloom — PositionLevelsOverlay Tests
 * ============================================================================
 *
 * The hybrid-data "price lines" layer rendered over the TradingView chart on
 * the SnapTrade order screen. These tests cover:
 *
 *   1. Position rendering  — LIVE tag + qty, AVG BUY / STOP / TARGET chips
 *   2. View-only mode      — broker disconnected → read-only strip
 *   3. No position         — "no open position" strip
 *   4. Stale-response guard — a late response for a previous symbol is dropped
 *   5. Chip tap pre-fill   — tapping STOP/TARGET calls onApplyStop/onApplyTarget
 *      with the risk-derived price
 *   6. Iron Lock badge     — ironLockActive renders the lockdown tag
 *   7. Error fallback      — API failure degrades to "no position" state
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/PositionLevelsOverlay.test.tsx
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ──── Hoisted mocks (available inside vi.mock factories) ───────────────────

const { mockGetTickerLevels } = vi.hoisted(() => ({
  mockGetTickerLevels: vi.fn(),
}));

vi.mock('../services/api', () => ({
  snapTradeApi: {
    getTickerLevels: mockGetTickerLevels,
  },
}));

// Ticker Provider — controllable active ticker so we can test the
// provider-driven mode (no symbol prop → follow useTicker()).
const { mockTicker } = vi.hoisted(() => ({
  mockTicker: { value: null as { symbol: string } | null },
}));

vi.mock('../services/tickerProvider', () => ({
  useTicker: () => mockTicker.value,
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6',
      text: '#FFFFFF',
      textSecondary: '#9CA3AF',
      textMuted: '#6B7280',
      bgCard: '#111827',
      bg: '#0B0F19',
      bgCardLight: '#1A2235',
      border: '#1F2937',
      borderLight: '#374151',
      divider: '#1E293B',
    },
  }),
}));

// Resolve the overlay's i18n keys to the same human labels the en locale
// uses, so tests assert on real UI text (LIVE, AVG BUY, STOP, TARGET…).
const T_MAP: Record<string, string> = {
  'trading.positionLive': 'LIVE',
  'trading.positionAvgBuy': 'AVG BUY',
  'trading.positionStop': 'STOP',
  'trading.positionTarget': 'TARGET',
  'trading.positionNoPosition': 'No open position',
  'trading.positionViewOnly': 'View-only — connect a broker to trade',
  'trading.positionIronLock': 'IRON LOCK ACTIVE',
};

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => T_MAP[key] ?? key,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

import { render, fireEvent } from './testUtils';
import PositionLevelsOverlay from '../components/PositionLevelsOverlay';

// ──── Fixtures ─────────────────────────────────────────────────────────────

function makeLevels(overrides: Record<string, any> = {}) {
  return {
    success: true,
    connected: true,
    symbol: 'AAPL',
    position: {
      symbol: 'AAPL',
      quantity: 10,
      avgCost: 100,
      price: 105,
      pnl: 50,
      pnlPercent: 5,
    },
    levels: {
      dailyLossLimit: 50000,
      dailyLossPercentLimit: 5,
      maxPositionSizePercent: 20,
    },
    ironLockActive: false,
    lockdownStatus: 'none',
    ...overrides,
  };
}

/** A promise we can resolve on demand (for ordering async responses). */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('PositionLevelsOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTicker.value = null;
  });

  // ── 0. Provider-driven mode (from the ticker provider) ────────────────

  it('follows the Ticker Provider when no symbol prop is given', async () => {
    mockTicker.value = { symbol: 'AAPL' };
    mockGetTickerLevels.mockResolvedValue(makeLevels());

    const { getByText } = render(<PositionLevelsOverlay />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetTickerLevels).toHaveBeenCalledWith('AAPL');
    expect(getByText('LIVE')).toBeDefined();
  });

  it('explicit symbol prop takes precedence over the provider ticker', async () => {
    mockTicker.value = { symbol: 'TSLA' };
    mockGetTickerLevels.mockResolvedValue(makeLevels({ symbol: 'AAPL' }));

    render(<PositionLevelsOverlay symbol="AAPL" />);
    await act(async () => {
      await Promise.resolve();
    });

    // The prop wins — the provider ticker must not override it.
    expect(mockGetTickerLevels).toHaveBeenCalledWith('AAPL');
    expect(mockGetTickerLevels).not.toHaveBeenCalledWith('TSLA');
  });

  it('renders nothing when neither a symbol nor a provider ticker exists', async () => {
    const { queryByText } = render(<PositionLevelsOverlay />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetTickerLevels).not.toHaveBeenCalled();
    expect(queryByText('LIVE')).toBeNull();
    expect(queryByText('No open position')).toBeNull();
  });

  // ── 8. Direct-position mode (Indian PlaceOrder flow) ──────────────────

  it('renders a caller-supplied position WITHOUT hitting the SnapTrade API', async () => {
    const { getByText } = render(
      <PositionLevelsOverlay
        symbol="RELIANCE"
        position={{
          symbol: 'RELIANCE',
          quantity: 20,
          avgCost: 2500,
          price: 2650,
          pnl: 3000,
          pnlPercent: 6,
        }}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetTickerLevels).not.toHaveBeenCalled();
    expect(getByText('LIVE')).toBeDefined();
    expect(getByText('20')).toBeDefined();
    expect(getByText('AVG BUY')).toBeDefined();
    expect(getByText('$2,500.00')).toBeDefined();
  });

  it('formats direct-position prices in INR when currency="INR"', async () => {
    const { getByText } = render(
      <PositionLevelsOverlay
        symbol="RELIANCE"
        currency="INR"
        position={{
          symbol: 'RELIANCE',
          quantity: 10,
          avgCost: 2500,
          price: 2650,
          pnl: 1500,
          pnlPercent: 6,
        }}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    // avgCost 2500 → AVG BUY ₹2,500.00; stop 5% → ₹2,375.00; target 10% → ₹2,750.00
    expect(getByText('₹2,500.00')).toBeDefined();
    expect(getByText('₹2,375.00')).toBeDefined();
    expect(getByText('₹2,750.00')).toBeDefined();
    expect(getByText('+₹1,500.00')).toBeDefined();
  });

  it('shows the no-position strip for a null direct position (no fetch)', async () => {
    const { getByText, queryByText } = render(
      <PositionLevelsOverlay symbol="RELIANCE" position={null} />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetTickerLevels).not.toHaveBeenCalled();
    expect(getByText('No open position')).toBeDefined();
    expect(queryByText('LIVE')).toBeNull();
  });

  it('calls onApplyStop with the direct position stop in direct mode', async () => {
    const onApplyStop = vi.fn();
    const { getByText } = render(
      <PositionLevelsOverlay
        symbol="RELIANCE"
        position={{
          symbol: 'RELIANCE',
          quantity: 10,
          avgCost: 2500,
          price: 2650,
          pnl: 1500,
          pnlPercent: 6,
        }}
        onApplyStop={onApplyStop}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('STOP'));
    expect(onApplyStop.mock.calls[0][0]).toBeCloseTo(2375, 5);
  });

  // ── 1. Position rendering ────────────────────────────────────────────

  it('renders LIVE position tag with quantity when a position exists', async () => {
    // Distinctive quantity (42) so the assertion can't collide with the
    // substring '10' inside prices like $100.00.
    mockGetTickerLevels.mockResolvedValue(
      makeLevels({ position: { symbol: 'AAPL', quantity: 42, avgCost: 100, price: 105, pnl: 50, pnlPercent: 5 } }),
    );

    const { getByText } = render(<PositionLevelsOverlay symbol="AAPL" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('LIVE')).toBeDefined();
    expect(getByText('42')).toBeDefined();
    expect(mockGetTickerLevels).toHaveBeenCalledWith('AAPL');
  });

  it('renders AVG BUY / STOP / TARGET chips with risk-derived prices', async () => {
    // avgCost 100, dailyLossPercentLimit 5 → STOP 95.00, TARGET 110.00
    mockGetTickerLevels.mockResolvedValue(makeLevels());

    const { getByText } = render(<PositionLevelsOverlay symbol="AAPL" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('AVG BUY')).toBeDefined();
    expect(getByText('$100.00')).toBeDefined();
    expect(getByText('STOP')).toBeDefined();
    expect(getByText('$95.00')).toBeDefined();
    expect(getByText('TARGET')).toBeDefined();
    expect(getByText('$110.00')).toBeDefined();
  });

  it('caps the suggested stop at 20% even if the risk limit is higher', async () => {
    mockGetTickerLevels.mockResolvedValue(
      makeLevels({ levels: { dailyLossLimit: 50000, dailyLossPercentLimit: 50, maxPositionSizePercent: 20 } }),
    );

    const { getByText } = render(<PositionLevelsOverlay symbol="AAPL" />);
    await act(async () => {
      await Promise.resolve();
    });

    // avgCost 100, stopPct capped at 20 → STOP 80.00, TARGET 140.00
    expect(getByText('$80.00')).toBeDefined();
    expect(getByText('$140.00')).toBeDefined();
  });

  // ── 2. View-only mode (broker disconnected) ──────────────────────────

  it('shows the view-only strip when the broker is disconnected', async () => {
    mockGetTickerLevels.mockResolvedValue(
      makeLevels({ connected: false, position: null, levels: null }),
    );

    const { getByText, queryByText } = render(<PositionLevelsOverlay symbol="AAPL" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('View-only')).toBeDefined();
    expect(queryByText('LIVE')).toBeNull();
  });

  // ── 3. No position ───────────────────────────────────────────────────

  it('shows "no open position" when connected but no position is held', async () => {
    mockGetTickerLevels.mockResolvedValue(makeLevels({ position: null }));

    const { getByText, queryByText } = render(<PositionLevelsOverlay symbol="AAPL" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('No open position')).toBeDefined();
    expect(queryByText('LIVE')).toBeNull();
  });

  // ── 4. Stale-response guard ──────────────────────────────────────────

  it('discards a stale response when the symbol changes mid-fetch', async () => {
    const first = deferred<any>();
    const second = deferred<any>();
    mockGetTickerLevels
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const result = render(<PositionLevelsOverlay symbol="AAPL" />);

    // Symbol changes while the first fetch is still in flight.
    act(() => {
      result.update(<PositionLevelsOverlay symbol="TSLA" />);
    });

    // The stale AAPL response resolves AFTER the symbol already moved on.
    await act(async () => {
      first.resolve(makeLevels({ symbol: 'AAPL' }));
    });

    // Stale data must NOT render — the overlay stays in the no-data state.
    expect(result.queryByText('LIVE')).toBeNull();

    // The fresh TSLA response renders normally.
    await act(async () => {
      second.resolve(makeLevels({ symbol: 'TSLA', position: { symbol: 'TSLA', quantity: 5, avgCost: 200, price: 210, pnl: 50, pnlPercent: 5 } }));
    });
    expect(result.getByText('LIVE')).toBeDefined();
  });

  // ── 5. Chip tap pre-fill ─────────────────────────────────────────────

  it('calls onApplyStop with the suggested stop price when STOP is tapped', async () => {
    mockGetTickerLevels.mockResolvedValue(makeLevels());
    const onApplyStop = vi.fn();

    const { getByText } = render(
      <PositionLevelsOverlay symbol="AAPL" onApplyStop={onApplyStop} />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('STOP'));
    // avgCost 100 × (1 − 5%) — allow float representation noise
    expect(onApplyStop.mock.calls[0][0]).toBeCloseTo(95, 5);
  });

  it('calls onApplyTarget with the suggested target price when TARGET is tapped', async () => {
    mockGetTickerLevels.mockResolvedValue(makeLevels());
    const onApplyTarget = vi.fn();

    const { getByText } = render(
      <PositionLevelsOverlay symbol="AAPL" onApplyTarget={onApplyTarget} />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByText('TARGET'));
    // avgCost 100 × (1 + 10%) — allow float representation noise
    expect(onApplyTarget.mock.calls[0][0]).toBeCloseTo(110, 5);
  });

  // ── 6. Iron Lock badge ───────────────────────────────────────────────

  it('renders the IRON LOCK badge when ironLockActive is true', async () => {
    mockGetTickerLevels.mockResolvedValue(makeLevels({ ironLockActive: true, lockdownStatus: 'active' }));

    const { getByText } = render(<PositionLevelsOverlay symbol="AAPL" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('IRON LOCK ACTIVE')).toBeDefined();
  });

  it('omits the IRON LOCK badge when lockdown is not active', async () => {
    mockGetTickerLevels.mockResolvedValue(makeLevels());

    const { queryByText } = render(<PositionLevelsOverlay symbol="AAPL" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(queryByText('IRON LOCK ACTIVE')).toBeNull();
  });

  // ── 7. Error fallback ────────────────────────────────────────────────

  it('degrades to the no-position state when the API call fails', async () => {
    mockGetTickerLevels.mockRejectedValue(new Error('backend down'));

    const { getByText, queryByText } = render(<PositionLevelsOverlay symbol="AAPL" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText('No open position')).toBeDefined();
    expect(queryByText('LIVE')).toBeNull();
  });

  it('renders nothing (returns null) while the levels are loading', () => {
    const pending = deferred<any>();
    mockGetTickerLevels.mockReturnValue(pending.promise);

    const { queryByText } = render(<PositionLevelsOverlay symbol="AAPL" />);

    // No strip text while loading and no position data yet.
    expect(queryByText('No open position')).toBeNull();
    expect(queryByText('View-only')).toBeNull();
  });
});
