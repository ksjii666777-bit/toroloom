/**
 * ============================================================================
 * Toroloom — Currency Markets Screen Tests
 * ============================================================================
 *
 * Tests the full CurrencyMarketsScreen:
 *   - Header (back button, title, subtitle, converter button)
 *   - Tabs (INR Pairs, Crosses, Summary)
 *   - Search bar and region filters
 *   - Currency cards (rendering, expansion, data display)
 *   - Summary tab (stats grid, INR overview, market info)
 *   - Converter modal toggle
 *   - Empty state
 *
 * Uses the same mocking pattern as IPODashboardScreen.test.tsx.
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import CurrencyMarketsScreen from '../screens/markets/CurrencyMarketsScreen';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@expo/vector-icons', () => {
  const React = require('react');
  const IconComponent = function(props: any) {
    return React.createElement('Text', null, props.name);
  };
  return {
    Ionicons: IconComponent,
    MaterialIcons: IconComponent,
    MaterialCommunityIcons: IconComponent,
  };
});

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0B0F19',
      bgSecondary: '#0E121D',
      bgCard: '#111827',
      bgCardLight: '#1A2235',
      bgInput: '#0F131E',
      border: '#1F2937',
      primary: '#3B82F6',
      primaryLight: '#60A5FA',
      text: '#FFFFFF',
      textSecondary: '#9CA3AF',
      textMuted: '#6B7280',
      marketUp: '#10B981',
      marketDown: '#EF4444',
      warning: '#F59E0B',
      accent: '#10B981',
      danger: '#EF4444',
      divider: '#1E293B',
      bgOverlay: 'rgba(7, 10, 17, 0.85)',
      white: '#FFFFFF',
    },
    isDark: true,
  }),
}));

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

function renderScreen() {
  return render(
    <CurrencyMarketsScreen
      navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Header
// ═══════════════════════════════════════════════════════════════════════════════

describe('CurrencyMarketsScreen — Header', () => {
  it('renders the header title', () => {
    const { getByText } = renderScreen();
    expect(getByText('Currency Markets')).toBeDefined();
  });

  it('renders the subtitle', () => {
    const { getByText } = renderScreen();
    expect(getByText('Forex Rates & Analysis')).toBeDefined();
  });

  it('renders the back button', () => {
    const { getByText } = renderScreen();
    expect(getByText('arrow-back')).toBeDefined();
  });

  it('goes back when back button is pressed', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('arrow-back')); });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders the calculator converter button in the header', () => {
    const { getByText } = renderScreen();
    // Ionicons mock renders icon name as text
    expect(getByText('calculator')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tabs
// ═══════════════════════════════════════════════════════════════════════════════

describe('CurrencyMarketsScreen — Tabs', () => {
  it('renders the INR Pairs tab (default active)', () => {
    const { getByText } = renderScreen();
    expect(getByText('INR Pairs')).toBeDefined();
  });

  it('renders the Crosses tab', () => {
    const { getByText } = renderScreen();
    expect(getByText('Crosses')).toBeDefined();
  });

  it('renders the Summary tab', () => {
    const { getByText } = renderScreen();
    expect(getByText('Summary')).toBeDefined();
  });

  it('shows INR pairs count by default', () => {
    const { getByText } = renderScreen();
    // 8 INR pairs in the mock data
    expect(getByText(/8 pairs/)).toBeDefined();
  });

  it('switches to Crosses tab and shows cross-currency pairs', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Crosses')); });
    // 3 non-INR pairs (EUR/USD, GBP/USD, USD/JPY)
    expect(getByText(/3 pairs/)).toBeDefined();
  });

  it('switches to Summary tab and shows summary content', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Summary')); });
    expect(getByText('Total Pairs')).toBeDefined();
    expect(getByText('INR Pairs')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Search Bar
// ═══════════════════════════════════════════════════════════════════════════════

describe('CurrencyMarketsScreen — Search Bar', () => {
  it('renders the search input on non-Summary tabs', () => {
    const { getByText } = renderScreen();
    // Default tab is INR Pairs → search shows
    expect(getByText('search')).toBeDefined(); // search icon
  });

  it('hides search bar on the Summary tab', () => {
    const { getByText, queryByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Summary')); });
    // Search icon should not be present
    expect(queryByText('search')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Region Filters
// ═══════════════════════════════════════════════════════════════════════════════

describe('CurrencyMarketsScreen — Region Filters', () => {
  it('renders filter chips on non-Summary tabs', () => {
    const { getByText } = renderScreen();
    expect(getByText('All')).toBeDefined();
    expect(getByText('Major')).toBeDefined();
    expect(getByText('Asian')).toBeDefined();
    expect(getByText('Other')).toBeDefined();
  });

  it('hides filters on Summary tab', () => {
    const { getByText, queryByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Summary')); });
    expect(queryByText('Major')).toBeNull();
  });

  it('filters pairs by region when Asian is selected', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Asian')); });
    // Asian pairs: SGD, CNY, HKD, THB = 4
    expect(getByText(/4 pairs/)).toBeDefined();
  });

  it('filters pairs by region when Major is selected', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Major')); });
    // Major INR pairs: USD, EUR, GBP, JPY = 4
    expect(getByText(/4 pairs/)).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Currency Cards (INR Pairs Tab)
// ═══════════════════════════════════════════════════════════════════════════════

describe('CurrencyMarketsScreen — Currency Cards', () => {
  it('renders USD/INR card with pair name', () => {
    const { getByText } = renderScreen();
    expect(getByText('USD/INR')).toBeDefined();
  });

  it('renders EUR/INR card with pair name', () => {
    const { getByText } = renderScreen();
    expect(getByText('EUR/INR')).toBeDefined();
  });

  it('renders GBP/INR card with pair name', () => {
    const { getByText } = renderScreen();
    expect(getByText('GBP/INR')).toBeDefined();
  });

  it('renders JPY/INR card with rate in 4 decimal format', () => {
    const { getByText } = renderScreen();
    // JPY rate is 0.54 which gets 4 decimal places
    expect(getByText('0.5400')).toBeDefined();
  });

  it('renders USD rate of 83.45', () => {
    const { getByText } = renderScreen();
    expect(getByText('83.45')).toBeDefined();
  });

  it('shows RBI Reference Rate badge on USD, EUR, GBP cards', () => {
    const { getAllByText } = renderScreen();
    const rbiBadges = getAllByText('RBI Reference Rate');
    expect(rbiBadges.length).toBeGreaterThanOrEqual(3);
  });

  it('shows 52W Range label on cards', () => {
    const { getByText } = renderScreen();
    expect(getByText('52W Range')).toBeDefined();
  });

  it('shows day high/low labels', () => {
    const { getByText } = renderScreen();
    expect(getByText('H:')).toBeDefined();
    expect(getByText('L:')).toBeDefined();
  });

  it('shows change percentage badges', () => {
    const { getByText } = renderScreen();
    // Some pair has changePercent displayed
    expect(getByText(/%/)).toBeDefined();
  });

  it('shows currency pair names', () => {
    const { getByText } = renderScreen();
    expect(getByText('US Dollar / Indian Rupee')).toBeDefined();
    expect(getByText('Euro / Indian Rupee')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Card Expansion
// ═══════════════════════════════════════════════════════════════════════════════

describe('CurrencyMarketsScreen — Card Expansion', () => {
  it('toggles expanded details when card header is pressed', () => {
    const { getByText, queryByText } = renderScreen();

    // Expanded details should not be visible initially
    expect(queryByText('Trend')).toBeNull();

    // Press the card header text
    act(() => { fireEvent.press(getByText('USD/INR')); });

    // Expanded details should now show
    expect(getByText('Open')).toBeDefined();
    expect(getByText('Change')).toBeDefined();
  });

  it('shows volatility in expanded view', () => {
    const { getByText } = renderScreen();

    act(() => { fireEvent.press(getByText('USD/INR')); });

    expect(getByText(/Volatility/)).toBeDefined();
  });

  it('collapses card when pressed again', () => {
    const { getByText, queryByText } = renderScreen();

    // Expand first
    act(() => { fireEvent.press(getByText('USD/INR')); });
    expect(getByText('Open')).toBeDefined();

    // Collapse
    act(() => { fireEvent.press(getByText('USD/INR')); });

    // Expanded details should be gone
    expect(queryByText('Open')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Summary Tab
// ═══════════════════════════════════════════════════════════════════════════════

describe('CurrencyMarketsScreen — Summary Tab', () => {
  it('shows summary overview cards', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Summary')); });

    expect(getByText('Total Pairs')).toBeDefined();
    expect(getByText('INR Pairs')).toBeDefined();
    expect(getByText('Avg INR Chg')).toBeDefined();
    expect(getByText('Avg Volatility')).toBeDefined();
  });

  it('shows total count of 11 in summary', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Summary')); });

    expect(getByText('11')).toBeDefined();
  });

  it('shows INR count of 8 in summary', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Summary')); });

    expect(getByText('8')).toBeDefined();
  });

  it('shows INR Pairs Overview section', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Summary')); });

    expect(getByText('INR Pairs Overview')).toBeDefined();
  });

  it('shows INR pair rows in the overview', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Summary')); });

    // INR pairs should be listed
    expect(getByText('USD/INR')).toBeDefined();
    expect(getByText('EUR/INR')).toBeDefined();
  });

  it('shows Indian Forex Market info card', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Summary')); });

    expect(getByText('Indian Forex Market')).toBeDefined();
    expect(getByText(/RBI publishes reference rates/)).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Converter Modal Toggle
// ═══════════════════════════════════════════════════════════════════════════════

describe('CurrencyMarketsScreen — Converter Modal Toggle', () => {
  it('opens the converter modal when calculator button is pressed', () => {
    const { getByText, queryByText } = renderScreen();

    // Modal should be hidden initially
    expect(queryByText('Currency Converter')).toBeNull();

    // Press the calculator button
    act(() => { fireEvent.press(getByText('calculator')); });

    // Modal should now be visible
    expect(getByText('Currency Converter')).toBeDefined();
    expect(getByText('Real-time cross rates')).toBeDefined();
  });

  it('closes the modal when close button is pressed', () => {
    const { getByText, queryByText } = renderScreen();

    // Open modal
    act(() => { fireEvent.press(getByText('calculator')); });
    expect(getByText('Currency Converter')).toBeDefined();

    // Close modal via close button
    act(() => { fireEvent.press(getByText('close')); });

    // Modal should be hidden again
    expect(queryByText('Currency Converter')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════════════════════════════

describe('CurrencyMarketsScreen — Empty State', () => {
  it('shows empty state when search yields no results', () => {
    const { getByText, getByPlaceholderText } = renderScreen();

    // Type a search that matches nothing
    const searchInput = getByPlaceholderText('Search pairs...');
    act(() => { fireEvent.changeText(searchInput, 'XYZ_NONEXISTENT'); });

    // Empty state should appear
    expect(getByText('No pairs found')).toBeDefined();
    expect(getByText('Try adjusting search')).toBeDefined();
  });
});
