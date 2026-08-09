/**
 * ============================================================================
 * Toroloom — RecentTradesWidget Tests
 * ============================================================================
 *
 * Unit tests for the Recent Trades dashboard widget:
 *   • Empty-trades state (renders the empty message)
 *   • Sort order — trades sorted by timestamp (newest first)
 *   • Size caps — 'small' (3), 'medium' (6), 'large' (10)
 *   • Buy/sell badge — 'B' green (#00E676) / 'S' red (#FF5252)
 *   • Row formatting — quantity × price, compact total
 *
 * The widget reads trades via usePortfolioStore(); the shared
 * ./helpers/widgetTestMocks portfolioStore mock serves widgetMocks.portfolioState,
 * so each test seeds trades on that state. Import the helper FIRST so the mocks
 * register before the component module graph is evaluated.
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, expectTextOrder } from './testUtils';
import { getWidgetMocks, resetWidgetMocks } from './helpers/widgetTestMocks';

// Shared hoisted mock state — same object the mock factories use.
const widgetMocks = getWidgetMocks();

// ==================== Import ====================

import RecentTradesWidget from '../components/widgets/RecentTradesWidget';

// ==================== Fixtures ====================

const makeTrade = (id: string, symbol: string, type: 'buy' | 'sell', quantity: number, price: number, ageMs: number) => ({
  id,
  stockId: symbol,
  symbol,
  name: `${symbol} Ltd`,
  type,
  quantity,
  price,
  total: quantity * price,
  // Relative to now so formatTimeAgo is deterministic ("x minutes ago").
  timestamp: new Date(Date.now() - ageMs).toISOString(),
});

// 3 trades, newest first — RELIANCE (now), HDFCBANK (1h ago), TCS (2h ago).
const threeTrades = [
  makeTrade('t1', 'RELIANCE', 'buy', 50, 2000, 60_000),
  makeTrade('t2', 'HDFCBANK', 'sell', 100, 1500, 3_600_000),
  makeTrade('t3', 'TCS', 'buy', 20, 3800, 7_200_000),
];

// 8 trades — exceeds every size cap to exercise slicing.
const eightTrades = Array.from({ length: 8 }, (_, i) =>
  makeTrade(`t${i + 1}`, `STK${i + 1}`, i % 2 === 0 ? 'buy' : 'sell', 10, 1000, i * 60_000)
);

// ==================== Helpers ====================

/** True when the element's style array contains the given color. */
function hasColor(element: any, color: string): boolean {
  const style = element?.props?.style;
  if (!style) return false;
  return JSON.stringify(style).includes(color);
}

/**
 * True when ANY match has the color. Needed for the 'B'/'S' badges: the single
 * letter also appears inside longer text (e.g. "2 hours ago"), and getByText
 * returns only the deepest match — which may not be the badge.
 */
function anyHasColor(elements: any[], color: string): boolean {
  return elements.some((el) => hasColor(el, color));
}

// ==================== Tests ====================

describe('RecentTradesWidget', () => {
  beforeEach(() => {
    resetWidgetMocks();
    widgetMocks.portfolioState = { holdings: [], trades: [] };
  });

  // ── Empty state ──────────────────────────────────────────────────

  it('renders the empty-trades message when there are no trades', () => {
    const { getByText } = render(<RecentTradesWidget size="medium" />);
    expect(getByText('No trades yet')).toBeDefined();
  });

  it('renders the empty message regardless of size', () => {
    const { getByText } = render(<RecentTradesWidget size="small" />);
    expect(getByText('No trades yet')).toBeDefined();
  });

  // ── Sort order ──────────────────────────────────────────────────

  it('sorts trades newest first', () => {
    widgetMocks.portfolioState = { holdings: [], trades: [...threeTrades] };
    expectTextOrder(
      render(<RecentTradesWidget size="large" />),
      ['RELIANCE', 'HDFCBANK', 'TCS'],
    );
  });

  // ── Size caps ───────────────────────────────────────────────────

  it('caps small size at 3 trades', () => {
    widgetMocks.portfolioState = { holdings: [], trades: [...eightTrades] };
    const { getByText, queryByText } = render(<RecentTradesWidget size="small" />);
    // Newest 3 (STK1..STK3, age ascending) render; STK4 is clipped.
    expect(getByText('STK1')).toBeDefined();
    expect(getByText('STK3')).toBeDefined();
    expect(queryByText('STK4')).toBeNull();
  });

  it('caps medium size at 6 trades', () => {
    widgetMocks.portfolioState = { holdings: [], trades: [...eightTrades] };
    const { getByText, queryByText } = render(<RecentTradesWidget size="medium" />);
    expect(getByText('STK1')).toBeDefined();
    expect(getByText('STK6')).toBeDefined();
    expect(queryByText('STK7')).toBeNull();
  });

  it('shows all trades for large size (up to 10)', () => {
    widgetMocks.portfolioState = { holdings: [], trades: [...eightTrades] };
    const { getByText, queryByText } = render(<RecentTradesWidget size="large" />);
    expect(getByText('STK1')).toBeDefined();
    expect(getByText('STK8')).toBeDefined();
    expect(queryByText('STK9')).toBeNull();
  });

  // ── Buy / sell badge styling ────────────────────────────────────

  it('renders B badge green for buys and S badge red for sells', () => {
    widgetMocks.portfolioState = { holdings: [], trades: [...threeTrades] };
    const { getAllByText } = render(<RecentTradesWidget size="large" />);
    // RELIANCE is a buy → B green; HDFCBANK is a sell → S red. The single
    // letters also appear inside other text (time labels), so scan all matches.
    expect(anyHasColor(getAllByText('B'), '#00E676')).toBe(true);
    expect(anyHasColor(getAllByText('S'), '#FF5252')).toBe(true);
  });

  // ── Row formatting ──────────────────────────────────────────────

  it('formats quantity × price and compact total per row', () => {
    widgetMocks.portfolioState = { holdings: [], trades: [threeTrades[0]] };
    const { getByText } = render(<RecentTradesWidget size="medium" />);
    // RELIANCE buy 50 × ₹2000.0, total 100000 → ₹1.00L
    expect(getByText('50 × ₹2000.0')).toBeDefined();
    expect(getByText('₹1.00L')).toBeDefined();
  });

  it('renders a relative time label per row', () => {
    widgetMocks.portfolioState = { holdings: [], trades: [threeTrades[0]] };
    const { getByText } = render(<RecentTradesWidget size="medium" />);
    // formatTimeAgo produces "<n> minutes ago" for a 1-minute-old trade.
    expect(getByText(/minute.*ago/)).toBeDefined();
  });
});
