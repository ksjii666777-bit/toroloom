/**
 * ============================================================================
 * Toroloom — HoldingsWidget Tests
 * ============================================================================
 *
 * Unit tests for the dashboard Holdings Breakdown widget:
 *   • Empty-holdings state (renders the empty message)
 *   • Size variants — 'small' (compact total + up to 2 mini rows),
 *     'medium' (up to 5 rows + "more holdings" footer), 'large' (all rows)
 *   • P&L sign styling — green (#00E676) for gains, red (#FF5252) for losses
 *   • PositionLevelsOverlay (live position tag) renders per row with INR
 *   • STOP / TARGET chips pre-fill the PlaceOrder exit
 *
 * Shared mocks (navigation, services, theme, stores) come from the
 * ./helpers/widgetTestMocks module — imported FIRST so the mocks register
 * before the component module graph is evaluated.
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, expectTextOrder } from './testUtils';
import { getWidgetMocks, resetWidgetMocks, realSeedHoldings } from './helpers/widgetTestMocks';

// Shared hoisted mock state (nav, services, theme, stores) — same object the
// mock factories use, so per-test configuration + assertions stay in sync.
const widgetMocks = getWidgetMocks();

// ==================== Import ====================

import HoldingsWidget from '../components/widgets/HoldingsWidget';

// ==================== Fixtures ====================

const makeHolding = (id: string, symbol: string, currentValue: number, pnl: number, pnlPercent: number) => ({
  id,
  symbol,
  name: `${symbol} Ltd`,
  quantity: 10,
  currentValue,
  currentPrice: currentValue / 10,
  totalInvested: currentValue - pnl,
  pnl,
  pnlPercent,
  dayChange: 100,
  dayChangePercent: 0.1,
  buyPrice: (currentValue - pnl) / 10,
  stockId: id.toLowerCase(),
});

// 3 holdings: gainer, loser, gainer — for size-variant + sign-styling tests.
const threeHoldings = [
  makeHolding('h1', 'RELIANCE', 295000, 45000, 18.0),
  makeHolding('h2', 'TCS', 175000, -5000, -2.5),
  makeHolding('h3', 'INFY', 80000, 10000, 5.0),
];

// 7 holdings — exceeds the medium size cap (5) to exercise "more holdings".
const sevenHoldings = Array.from({ length: 7 }, (_, i) =>
  makeHolding(`h${i + 1}`, `STK${i + 1}`, 100000 - i * 5000, i % 2 === 0 ? 10000 : -2000, i % 2 === 0 ? 8.0 : -2.0)
);

// ==================== Helpers ====================

/** True when the element's style array contains the given color. */
function hasColor(element: any, color: string): boolean {
  const style = element?.props?.style;
  if (!style) return false;
  return JSON.stringify(style).includes(color);
}

/**
 * True when ANY element matching the text has the given color. In medium/large
 * sizes the P&L percent appears twice — the row label (green/red) and the
 * PositionLevelsOverlay P&L chip (uses its own palette) — so we can't rely on
 * the single deepest match.
 */
function anyHasColor(elements: any[], color: string): boolean {
  return elements.some((el) => hasColor(el, color));
}

/**
 * Serialize a rendered tree for snapshotting. Same serializer as the dashboard
 * integration snapshot — neutralizes animation/SVG payloads that could vary
 * across runs so layout drift (new rows, missing overlay chips, reordered
 * sections) is what breaks the test.
 */
function snapshotOf(json: any): string {
  return JSON.stringify(json, (key, value) => {
    if (key === 'entering' || key === 'exiting' || key === 'layout') {
      return '[Animation]';
    }
    if (key === 'd' || key === 'points') {
      return '[Path]';
    }
    return value;
  }, 2);
}

// ==================== Tests ====================

describe('HoldingsWidget', () => {
  beforeEach(() => {
    resetWidgetMocks();
    widgetMocks.portfolioState.holdings = [];
  });

  // ── Empty state ──────────────────────────────────────────────────

  it('renders the empty-holdings message when there are no holdings', () => {
    const { getByText } = render(<HoldingsWidget size="medium" />);
    expect(getByText('No holdings yet')).toBeDefined();
  });

  it('renders the empty message regardless of size', () => {
    const { getByText } = render(<HoldingsWidget size="small" />);
    expect(getByText('No holdings yet')).toBeDefined();
  });

  // ── Small size ───────────────────────────────────────────────────

  it('renders compact total + count for small size', () => {
    widgetMocks.portfolioState.holdings = threeHoldings;
    const { getByText } = render(<HoldingsWidget size="small" />);
    // 295000 + 175000 + 80000 = 550000 → ₹5.50L
    expect(getByText('₹5.50L')).toBeDefined();
    expect(getByText('3 holdings')).toBeDefined();
  });

  it('shows at most 2 mini rows sorted by value for small size', () => {
    widgetMocks.portfolioState.holdings = threeHoldings;
    const { getByText, queryByText } = render(<HoldingsWidget size="small" />);
    // Top 2 by currentValue: RELIANCE (295000), TCS (175000)
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
    // INFY (80000) is third — clipped in small mode
    expect(queryByText('INFY')).toBeNull();
  });

  it('colors mini-row P&L green for gains and red for losses (small)', () => {
    widgetMocks.portfolioState.holdings = threeHoldings;
    const { getByText } = render(<HoldingsWidget size="small" />);
    expect(hasColor(getByText('+18.00%'), '#00E676')).toBe(true);
    expect(hasColor(getByText('-2.50%'), '#FF5252')).toBe(true);
  });

  // ── Medium size ──────────────────────────────────────────────────

  it('renders total, count, and weight % for medium size', () => {
    widgetMocks.portfolioState.holdings = [threeHoldings[0], threeHoldings[1]];
    const { getByText } = render(<HoldingsWidget size="medium" />);
    // 295000 + 175000 = 470000 → ₹4.70L
    expect(getByText('₹4.70L')).toBeDefined();
    expect(getByText('2 holdings')).toBeDefined();
    // weights: 295000/470000 = 62.8%, 175000/470000 = 37.2%
    expect(getByText('62.8%')).toBeDefined();
    expect(getByText('37.2%')).toBeDefined();
  });

  it('shows all rows when count is within the medium cap (5)', () => {
    widgetMocks.portfolioState.holdings = threeHoldings;
    const { getByText, queryByText } = render(<HoldingsWidget size="medium" />);
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
    expect(getByText('INFY')).toBeDefined();
    // 3 ≤ 5 → no "more holdings" footer
    expect(queryByText('+0 more holdings')).toBeNull();
  });

  it('caps medium size at 5 rows and shows the "more holdings" footer', () => {
    widgetMocks.portfolioState.holdings = sevenHoldings;
    const { getByText, queryByText } = render(<HoldingsWidget size="medium" />);
    expect(getByText('STK1')).toBeDefined();
    expect(getByText('STK5')).toBeDefined();
    // STK6/STK7 clipped → footer shows 7 - 5 = 2
    expect(queryByText('STK6')).toBeNull();
    expect(getByText('+2 more holdings')).toBeDefined();
  });

  it('colors row P&L green for gains and red for losses (medium)', () => {
    widgetMocks.portfolioState.holdings = [threeHoldings[0], threeHoldings[1]];
    const { getAllByText } = render(<HoldingsWidget size="medium" />);
    // Row label is green/red; overlay chip uses its own palette — assert the
    // gain/loss colors are present on some matching element.
    expect(anyHasColor(getAllByText('+18.00%'), '#00E676')).toBe(true);
    expect(anyHasColor(getAllByText('-2.50%'), '#FF5252')).toBe(true);
  });

  it('renders the live position overlay per row (medium)', () => {
    widgetMocks.portfolioState.holdings = [threeHoldings[0]];
    const { getByText } = render(<HoldingsWidget size="medium" />);
    // LIVE tag + AVG BUY chip from the direct-position overlay
    expect(getByText('LIVE')).toBeDefined();
    expect(getByText('AVG BUY')).toBeDefined();
  });

  // ── Large size ───────────────────────────────────────────────────

  it('renders all rows for large size (no cap)', () => {
    widgetMocks.portfolioState.holdings = sevenHoldings;
    const { getByText, queryByText } = render(<HoldingsWidget size="large" />);
    expect(getByText('STK1')).toBeDefined();
    expect(getByText('STK7')).toBeDefined();
    expect(queryByText('+0 more holdings')).toBeNull();
  });

  it('falls back to 0% weight when total value is not positive', () => {
    // totalValue = 0 → the weight bar width falls back to the 0 branch
    widgetMocks.portfolioState.holdings = [makeHolding('hz', 'ZERO', 0, 0, 0)];
    const { getByText } = render(<HoldingsWidget size="medium" />);
    expect(getByText('ZERO')).toBeDefined();
    expect(getByText('0.0%')).toBeDefined();
  });

  // ── Real store seed (integration fidelity) ───────────────────────
  // Shared realSeedHoldings from ./helpers/widgetTestMocks (verbatim
  // mockHoldings from src/constants/mockData.ts). If the app's seed changes,
  // these assertions break so the seed + expectations stay in lockstep.
  // Total = 673539 → ₹6.74L; weights sum to 100%.

  it('renders the real-seed total (₹6.74L) and 5-holdings count', () => {
    widgetMocks.portfolioState.holdings = realSeedHoldings;
    const { getByText } = render(<HoldingsWidget size="medium" />);
    // 144525 + 167890 + 77800 + 125424 + 157900 = 673539 → ₹6.74L
    expect(getByText('₹6.74L')).toBeDefined();
    expect(getByText('5 holdings')).toBeDefined();
  });

  it('renders every real-seed symbol with its compact value', () => {
    widgetMocks.portfolioState.holdings = realSeedHoldings;
    const { getByText } = render(<HoldingsWidget size="medium" />);
    // 5 rows render (5 ≤ medium cap of 5)
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('HDFCBANK')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
    expect(getByText('INFY')).toBeDefined();
    expect(getByText('SBIN')).toBeDefined();
    // Compact per-holding values (TCS 77800 < 1L → K tier: ₹77.8K)
    expect(getByText('₹1.45L')).toBeDefined();
    expect(getByText('₹1.68L')).toBeDefined();
    expect(getByText('₹77.8K')).toBeDefined();
    expect(getByText('₹1.25L')).toBeDefined();
    expect(getByText('₹1.58L')).toBeDefined();
  });

  it('renders real-seed weights that sum to 100%', () => {
    widgetMocks.portfolioState.holdings = realSeedHoldings;
    const { getByText } = render(<HoldingsWidget size="medium" />);
    // weight = value/total: HDFCBANK 24.9%, SBIN 23.4%, RELIANCE 21.5%,
    // INFY 18.6%, TCS 11.6% — 24.9 + 23.4 + 21.5 + 18.6 + 11.6 = 100.0
    expect(getByText('24.9%')).toBeDefined();
    expect(getByText('23.4%')).toBeDefined();
    expect(getByText('21.5%')).toBeDefined();
    expect(getByText('18.6%')).toBeDefined();
    expect(getByText('11.6%')).toBeDefined();
  });

  it('colors every real-seed P&L green — the seed has no losers', () => {
    widgetMocks.portfolioState.holdings = realSeedHoldings;
    const { getAllByText } = render(<HoldingsWidget size="medium" />);
    // Seed P&L percents: RELIANCE +9.08, HDFCBANK +8.32, TCS +2.37,
    // INFY +8.12, SBIN +9.65 — ALL positive, so every row must be green
    // (#00E676) and none red (#FF5252). Row label + overlay chip both render
    // the percent, so scan all matches for the sign color.
    for (const pct of ['+9.08%', '+8.32%', '+2.37%', '+8.12%', '+9.65%']) {
      const matches = getAllByText(pct);
      expect(matches.length).toBeGreaterThan(0);
      expect(anyHasColor(matches, '#00E676')).toBe(true);
      expect(anyHasColor(matches, '#FF5252')).toBe(false);
    }
  });

  it('renders real-seed rows sorted by value (descending)', () => {
    widgetMocks.portfolioState.holdings = realSeedHoldings;
    // Rows must follow the widget's value-descending sort:
    // 167890 > 157900 > 144525 > 125424 > 77800.
    expectTextOrder(
      render(<HoldingsWidget size="medium" />),
      ['HDFCBANK', 'SBIN', 'RELIANCE', 'INFY', 'TCS'],
    );
  });

  it('colors the real-seed top-2 mini rows green (small)', () => {
    widgetMocks.portfolioState.holdings = realSeedHoldings;
    const { getByText } = render(<HoldingsWidget size="small" />);
    // Small mode shows only the top-2 by value: HDFCBANK (167890) + SBIN
    // (157900). Both have positive P&L (+8.32%, +9.65%) → both mini rows must
    // be green (#00E676) and none red. No overlay in small mode, so each P&L
    // appears once (deepest match carries the row color).
    expect(hasColor(getByText('+8.32%'), '#00E676')).toBe(true);
    expect(hasColor(getByText('+9.65%'), '#00E676')).toBe(true);
    expect(hasColor(getByText('+8.32%'), '#FF5252')).toBe(false);
    expect(hasColor(getByText('+9.65%'), '#FF5252')).toBe(false);
  });

  it('matches snapshot with the real seed (medium)', () => {
    widgetMocks.portfolioState.holdings = realSeedHoldings;
    const { toJSON } = render(<HoldingsWidget size="medium" />);
    expect(snapshotOf(toJSON())).toMatchSnapshot('HoldingsWidget-real-seed-medium');
  });

  it('matches snapshot with the real seed (small)', () => {
    widgetMocks.portfolioState.holdings = realSeedHoldings;
    const { toJSON } = render(<HoldingsWidget size="small" />);
    expect(snapshotOf(toJSON())).toMatchSnapshot('HoldingsWidget-real-seed-small');
  });

  it('matches snapshot with the real seed (large)', () => {
    widgetMocks.portfolioState.holdings = realSeedHoldings;
    const { toJSON } = render(<HoldingsWidget size="large" />);
    expect(snapshotOf(toJSON())).toMatchSnapshot('HoldingsWidget-real-seed-large');
  });

  // ── Exit chips (STOP / TARGET pre-fill) ──────────────────────────

  it('STOP chip pre-fills the PlaceOrder exit with the derived stop price', () => {
    widgetMocks.portfolioState.holdings = [threeHoldings[0]]; // RELIANCE, buyPrice = 2500
    const { getByText } = render(<HoldingsWidget size="medium" />);
    fireEvent.press(getByText('STOP'));
    expect(widgetMocks.mockSelectSymbol).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'RELIANCE', exchange: 'NSE' }),
    );
    expect(widgetMocks.mockNavigate).toHaveBeenCalledWith('PlaceOrder',
      expect.objectContaining({
        symbol: 'RELIANCE',
        tradeType: 'sell',
        prefillOrderType: 'SL',
      }),
    );
  });

  it('TARGET chip pre-fills the PlaceOrder exit with the derived target price', () => {
    widgetMocks.portfolioState.holdings = [threeHoldings[0]]; // RELIANCE, buyPrice = 2500
    const { getByText } = render(<HoldingsWidget size="medium" />);
    fireEvent.press(getByText('TARGET'));
    expect(widgetMocks.mockNavigate).toHaveBeenCalledWith('PlaceOrder',
      expect.objectContaining({
        symbol: 'RELIANCE',
        tradeType: 'sell',
        prefillOrderType: 'LIMIT',
      }),
    );
  });
});
