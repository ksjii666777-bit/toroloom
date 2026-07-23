/**
 * ============================================================================
 * Toroloom — CommodityMarketsScreen Tests
 * ============================================================================
 *
 * Tests for the Commodity Markets screen covering:
 *   - Header (title, subtitle, back, calculator, connection badge)
 *   - Tabs (All, Metals, Energy, Agri, Summary)
 *   - Search bar
 *   - Commodity cards (icons, prices, categories, expansion)
 *   - Summary tab (stats, category performance, all commodities list, info)
 *   - Price Calculator modal (open, close, commodity selector)
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import CommodityMarketsScreen from '../screens/markets/CommodityMarketsScreen';

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
      bg: '#0D0F14',
      bgSecondary: '#161922',
      bgCard: '#1A1D28',
      bgInput: '#1E2130',
      bgCardLight: '#222639',
      text: '#FFFFFF',
      textSecondary: '#B0B0B0',
      textMuted: '#808080',
      primary: '#6C63FF',
      border: '#2A2D3A',
      divider: '#2A2D3A',
      danger: '#FF5252',
      accent: '#00C853',
      white: '#FFFFFF',
      transparent: 'transparent',
    },
  }),
}));

vi.mock('../hooks/useCommodityPrices', () => ({
  useCommodityPrices: () => ({
    prices: {},
    connected: false,
    source: 'mock' as const,
    isDetecting: false,
  }),
}));

vi.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    default: {
      View: 'View',
      createAnimatedComponent: (comp: any) => comp,
    },
    FadeInUp: { duration: () => ({ delay: () => ({}) }) },
  };
});

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Polyline: 'Polyline',
  Circle: 'Circle',
  Rect: 'Rect',
  Line: 'Line',
  Path: 'Path',
  G: 'G',
  Text: 'Text',
}));

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

function renderScreen() {
  return render(
    <CommodityMarketsScreen
      navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════

describe('CommodityMarketsScreen — Header', () => {
  it('renders title and subtitle', () => {
    const { getByText } = renderScreen();
    expect(getByText('Commodities')).toBeDefined();
    expect(getByText('Global Markets Dashboard')).toBeDefined();
  });

  it('renders back button and calculator button', () => {
    const { getByText } = renderScreen();
    expect(getByText('arrow-back')).toBeDefined();
    expect(getByText('calculator')).toBeDefined();
  });

  it('renders connection source badge (Mock)', () => {
    const { getByText } = renderScreen();
    expect(getByText('Mock')).toBeDefined();
  });

  it('calls goBack when back button is pressed', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('arrow-back')); });
    expect(mockGoBack).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════

describe('CommodityMarketsScreen — Tabs', () => {
  it('shows all 5 tab labels', () => {
    const { getByText } = renderScreen();
    expect(getByText('All')).toBeDefined();
    expect(getByText('Metals')).toBeDefined();
    expect(getByText('Energy')).toBeDefined();
    expect(getByText('Agri')).toBeDefined();
    expect(getByText('Summary')).toBeDefined();
  });

  it('shows all commodities on All tab by default (Gold visible)', () => {
    const { getByText } = renderScreen();
    expect(getByText(/XAUUSD/)).toBeDefined();
    expect(getByText(/XAGUSD/)).toBeDefined();
    expect(getByText(/CL/)).toBeDefined();
  });

  it('filters to metals when Metals tab is pressed (Gold shown, Crude Oil hidden)', () => {
    const { getByText, queryByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Metals')); });
    // Gold (metal) should be visible
    expect(getByText(/XAUUSD/)).toBeDefined();
    // Crude Oil (energy) should be filtered out
    expect(queryByText(/CL/)).toBeNull();
  });

  it('filters to energy when Energy tab is pressed (Crude shown, Gold hidden)', () => {
    const { getByText, queryByText } = renderScreen();
    act(() => { fireEvent.press(getByText('flame'))});
    // Crude Oil (energy) should be visible
    expect(getByText(/CL/)).toBeDefined();
    // Gold (metal) should be filtered out
    expect(queryByText(/XAUUSD/)).toBeNull();
  });

  it('filters to agriculture when Agri tab is pressed (all 3 agri symbols visible)', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Agri')); });
    // Agriculture symbols should be visible
    expect(getByText(/ZC/)).toBeDefined();  // Corn
    expect(getByText(/ZW/)).toBeDefined();  // Wheat
    expect(getByText(/ZS/)).toBeDefined();  // Soybeans
  });

  it('switches to Summary tab showing overview stats', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Summary')); });
    expect(getByText('Total')).toBeDefined();
    expect(getByText('Gainers')).toBeDefined();
    expect(getByText('Losers')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════

describe('CommodityMarketsScreen — Search', () => {
  it('shows search bar on non-Summary tabs', () => {
    const { getByPlaceholderText } = renderScreen();
    expect(getByPlaceholderText('Search commodities...')).toBeDefined();
  });

  it('hides search bar on Summary tab', () => {
    const { getByText, queryByPlaceholderText } = renderScreen();
    act(() => { fireEvent.press(getByText('Summary')); });
    expect(queryByPlaceholderText('Search commodities...')).toBeNull();
  });

  it('filters to 1 result when searching Gold', () => {
    const { getByPlaceholderText, getByText } = renderScreen();
    const searchInput = getByPlaceholderText('Search commodities...');
    act(() => { fireEvent.changeText(searchInput, 'Gold'); });
    expect(getByText(/1 commodity/)).toBeDefined();
  });

  it('shows empty state when no commodities match search', () => {
    const { getByPlaceholderText, getByText } = renderScreen();
    const searchInput = getByPlaceholderText('Search commodities...');
    act(() => { fireEvent.changeText(searchInput, 'NONEXISTENT'); });
    expect(getByText('No commodities found')).toBeDefined();
    expect(getByText('Try adjusting search')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// COMMODITY CARDS
// ═══════════════════════════════════════════════════════════════

describe('CommodityMarketsScreen — Cards', () => {
  it('shows Gold with symbol', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Gold/)).toBeDefined();
    expect(getByText(/XAUUSD/)).toBeDefined();
  });

  it('shows Crude Oil name', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Crude Oil/)).toBeDefined();
  });

  it('shows category badge (Energy) on energy commodities', () => {
    const { getByText } = renderScreen();
    expect(getByText('Energy')).toBeDefined();
  });

  it('shows MCX price on cards with inrPrice', () => {
    const { getByText } = renderScreen();
    expect(getByText(/MCX:/)).toBeDefined();
  });

  it('shows 52W Range label', () => {
    const { getAllByText } = renderScreen();
    const rangeLabels = getAllByText('52W Range');
    expect(rangeLabels.length).toBeGreaterThan(0);
  });

  it('toggles expanded details when card is pressed', () => {
    const { getByText, queryByText } = renderScreen();
    expect(queryByText(/Change %/)).toBeNull();
    act(() => { fireEvent.press(getByText(/Gold/)); });
    expect(getByText(/Change %/)).toBeDefined();
    expect(getByText(/Volatility/)).toBeDefined();
    expect(getByText(/Day Range/)).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY TAB
// ═══════════════════════════════════════════════════════════════

describe('CommodityMarketsScreen — Summary Tab', () => {
  it('shows overview stat cards and category performance', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Summary')); });
    expect(getByText('Category Performance')).toBeDefined();
  });

  it('shows All Commodities list', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Summary')); });
    expect(getByText('All Commodities')).toBeDefined();
  });

  it('shows Commodity Trading in India info card', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Summary')); });
    expect(getByText('Commodity Trading in India')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// PRICE CALCULATOR MODAL
// ═══════════════════════════════════════════════════════════════

describe('CommodityMarketsScreen — Price Calculator Modal', () => {
  it('opens when calculator button is pressed', () => {
    const { getByText, queryByText } = renderScreen();
    expect(queryByText('Price Calculator')).toBeNull();
    act(() => { fireEvent.press(getByText('calculator')); });
    expect(getByText('Price Calculator')).toBeDefined();
    expect(getByText('Commodity value in INR')).toBeDefined();
  });

  it('shows commodity chips with symbols', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('calculator')); });
    expect(getByText('XAUUSD')).toBeDefined();
    expect(getByText('CL')).toBeDefined();
    expect(getByText('ZW')).toBeDefined();
  });

  it('shows USD Value and INR Value result cards', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('calculator')); });
    expect(getByText('USD Value')).toBeDefined();
    expect(getByText('INR Value (approx)')).toBeDefined();
  });

  it('shows MCX India card for commodities with inrPrice (Gold ~ ₹73,210)', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('calculator')); });
    expect(getByText('MCX India (1 unit)')).toBeDefined();
  });

  it('closes when close button is pressed', () => {
    const { getByText, queryByText } = renderScreen();
    act(() => { fireEvent.press(getByText('calculator')); });
    expect(getByText('Price Calculator')).toBeDefined();
    act(() => { fireEvent.press(getByText('close')); });
    expect(queryByText('Price Calculator')).toBeNull();
  });
});
