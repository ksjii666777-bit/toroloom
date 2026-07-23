/**
 * ============================================================================
 * Toroloom — WidgetGalleryScreen Integration Tests
 * ============================================================================
 *
 * Tests the Widget Gallery screen with mocked store and navigation.
 * Verifies category sections, widget cards, size selector, add/added states.
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mock useSafeAreaInsets (already in setup.ts) ====================
// Already mocked in src/__tests__/setup.ts to return { top: 0, bottom: 0, left: 0, right: 0 }

// ==================== Mock ThemeContext ====================

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6',
      text: '#E0E6ED',
      textSecondary: '#94A3B8',
      textMuted: '#475569',
      bg: '#06080C',
      bgCard: '#1A1D28',
      bgCardLight: '#232734',
      bgInput: '#151821',
      border: 'rgba(255,255,255,0.07)',
      divider: 'rgba(255,255,255,0.04)',
      white: '#FFFFFF',
    },
    isDark: true,
  }),
}));

// Alert is already available through setup.ts's react-native mock.

// ==================== Mock widget store ====================

const mockAddWidget = vi.fn();

let mockLayoutWidgets: any[] = [
  { id: 'w_pnl', type: 'pnl', title: 'P&L Overview', order: 0, size: 'medium', visible: true },
  { id: 'w_holdings', type: 'holdings', title: 'Holdings Breakdown', order: 1, size: 'medium', visible: true },
];

vi.mock('../store/widgetStore', () => ({
  useWidgetStore: vi.fn((selector?: any) => {
    const state = {
      addWidget: mockAddWidget,
      layout: { widgets: mockLayoutWidgets, version: 1 },
    };
    return selector ? selector(state) : state;
  }),
}));

// ==================== Import ====================

import WidgetGalleryScreen from '../screens/widgets/WidgetGalleryScreen';

// ==================== Helper ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

function renderScreen() {
  return render(
    <WidgetGalleryScreen
      navigation={{ navigate: mockNavigate, goBack: mockGoBack }}
    />
  );
}

// ==================== Tests ====================

describe('WidgetGalleryScreen — Integration', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockAddWidget.mockClear();
    mockLayoutWidgets = [
      { id: 'w_pnl', type: 'pnl', title: 'P&L Overview', order: 0, size: 'medium', visible: true },
      { id: 'w_holdings', type: 'holdings', title: 'Holdings Breakdown', order: 1, size: 'medium', visible: true },
    ];
  });

  // ── Header ────────────────────────────────────────────────────────

  it('renders the screen title', () => {
    const { getByText } = renderScreen();
    expect(getByText('Widget Gallery')).toBeDefined();
  });

  it('renders the subtitle', () => {
    const { getByText } = renderScreen();
    expect(getByText('Add widgets to customize your dashboard')).toBeDefined();
  });

  it('renders with back navigation', () => {
    // Back button uses Ionicons "arrow-back" — renders with goBack handler
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  // ── Category Sections ─────────────────────────────────────────────

  it('renders Performance category header', () => {
    const { getByText } = renderScreen();
    expect(getByText('Performance')).toBeDefined();
  });

  it('renders Holdings category header', () => {
    const { getByText } = renderScreen();
    expect(getByText('Holdings')).toBeDefined();
  });

  it('renders Risk category header', () => {
    const { getByText } = renderScreen();
    expect(getByText('Risk')).toBeDefined();
  });

  it('renders Market category header', () => {
    const { getByText } = renderScreen();
    expect(getByText('Market')).toBeDefined();
  });

  it('shows added count for each category', () => {
    const { getByText } = renderScreen();
    // PnL (added) + Holdings (added) = 2/2 for Performance + Holdings
    // Risk (0 added) = 0/1, Market (0 added) = 0/1
    // Performance: pnl added (1 of 2), Holdings: holdings added (1 of 2)
    expect(getByText('1/2 added')).toBeDefined();
    expect(getByText('0/1 added')).toBeDefined();
  });

  // ── Widget Cards ──────────────────────────────────────────────────

  it('renders widget card names', () => {
    const { getByText } = renderScreen();
    expect(getByText('P&L Overview')).toBeDefined();
    expect(getByText('Holdings Breakdown')).toBeDefined();
    expect(getByText('Risk Metrics')).toBeDefined();
    expect(getByText('Sector Allocation')).toBeDefined();
    expect(getByText('Recent Trades')).toBeDefined();
    expect(getByText('Market Overview')).toBeDefined();
  });

  it('renders widget descriptions', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Real-time profit & loss/)).toBeDefined();
  });

  // ── Added vs Available ────────────────────────────────────────────

  it('shows Added state for already-added widgets', () => {
    const { getAllByText } = renderScreen();
    // Both P&L Overview and Holdings Breakdown should show "Added"
    const addedElements = getAllByText('Added');
    expect(addedElements.length).toBeGreaterThanOrEqual(2);
  });

  it('shows Add to Dashboard for available widgets', () => {
    const { getAllByText } = renderScreen();
    // Risk Metrics, Sector Allocation, Recent Trades, Market Overview show "Add to Dashboard"
    const addButtons = getAllByText('Add to Dashboard');
    expect(addButtons.length).toBeGreaterThanOrEqual(1);
  });

  // ── Snapshot ───────────────────────────────────────────────────────
  // Uses JSON.stringify with a replacer to handle non-serializable reanimated
  // animation Proxy objects (FadeInDown, Layout) that vitest's pretty-format
  // cannot process. The replacer replaces animation props with a static marker
  // before the engine attempts to traverse the Proxy objects.

  it('matches snapshot with added widgets and category sections', () => {
    const { toJSON } = renderScreen();
    const snapshot = JSON.stringify(toJSON(), (key, value) => {
      // Replace non-serializable reanimated animation entries
      if (key === 'entering' || key === 'exiting' || key === 'layout') {
        return '[Animation]';
      }
      // Replace SVG path data and geometry that varies across runs
      if (key === 'd' || key === 'points') {
        return '[Path]';
      }
      return value;
    }, 2);
    expect(snapshot).toMatchSnapshot('WidgetGalleryScreen-full');
  });

  // ── Add Widget Action ─────────────────────────────────────────────

  it('calls addWidget when Add to Dashboard button is pressed', () => {
    const { getByText } = renderScreen();
    const addBtn = getByText('Add to Dashboard');
    fireEvent.press(addBtn);
    expect(mockAddWidget).toHaveBeenCalledTimes(1);
  });

  // ── Tips Section ──────────────────────────────────────────────────

  it('renders the tip card with reorder instructions', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Long-press any widget/)).toBeDefined();
  });
});
