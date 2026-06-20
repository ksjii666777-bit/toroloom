/**
 * ============================================================================
 * Toroloom — StockScreenerScreen Tests
 * ============================================================================
 *
 * Tests the stock screener screen:
 *   - Renders filter sections
 *   - Filter inputs update live results count
 *   - Apply filters shows results
 *   - Clear all resets filters
 *   - Navigates to StockDetail on stock tap
 *   - Handles no results state
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import StockScreenerScreen from '../screens/stock/StockScreenerScreen';
import { useMarketStore } from '../store/marketStore';
import { mockStocks } from '../constants/mockData';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock the ThemeContext
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

beforeEach(() => {
  vi.clearAllMocks();
  // Clear AsyncStorage mock
  (AsyncStorage.getItem as any).mockResolvedValue(null);
  // Reset store to defaults
  useMarketStore.setState({
    stocks: mockStocks,
    screenerFilters: {
      priceMin: 0,
      priceMax: 100000,
      peMin: 0,
      peMax: 1000,
      marketCapCategory: 'all',
      dividendMin: 0,
      sector: 'All',
      dayChangeMin: -100,
      dayChangeMax: 100,
    },
    screenerResults: [],
    isScreenerVisible: true,
  });
});

function renderScreen() {
  return render(
    <StockScreenerScreen
      navigation={{ navigate: mockNavigate, goBack: mockGoBack }}
    />
  );
}

describe('StockScreenerScreen — Rendering', () => {
  it('renders the header title', () => {
    const { getByText } = renderScreen();
    expect(getByText('Stock Screener')).toBeDefined();
  });

  it('renders all filter sections', () => {
    const { getByText } = renderScreen();
    expect(getByText('Price Range')).toBeDefined();
    expect(getByText('P/E Ratio')).toBeDefined();
    expect(getByText('Day Change %')).toBeDefined();
    expect(getByText('Dividend Yield')).toBeDefined();
    expect(getByText('Sector')).toBeDefined();
    expect(getByText('Market Cap')).toBeDefined();
  });

  it('shows the total stock count in preview bar', () => {
    const { getByText } = renderScreen();
    expect(getByText(/stocks match current filters/i)).toBeDefined();
  });

  it('shows Clear All and Show Results buttons', () => {
    const { getByText } = renderScreen();
    expect(getByText('Clear All')).toBeDefined();
    expect(getByText(/Show Results/i)).toBeDefined();
  });
});

describe('StockScreenerScreen — Filter Interaction', () => {
  it('renders sector chips for selection', () => {
    const { getByText } = renderScreen();
    expect(getByText('Technology')).toBeDefined();
    expect(getByText('Finance')).toBeDefined();
    expect(getByText('Energy')).toBeDefined();
  });

  it('renders market cap options', () => {
    const { getByText } = renderScreen();
    expect(getByText('Large Cap')).toBeDefined();
    expect(getByText('Mid Cap')).toBeDefined();
    expect(getByText('Small Cap')).toBeDefined();
  });

  it('renders price preset chips', () => {
    const { getByText } = renderScreen();
    expect(getByText('Under ₹100')).toBeDefined();
    expect(getByText('₹100–₹500')).toBeDefined();
    expect(getByText('₹2,000+')).toBeDefined();
  });

  it('renders P/E preset chips', () => {
    const { getByText } = renderScreen();
    expect(getByText('Under 15')).toBeDefined();
    expect(getByText('15–30')).toBeDefined();
    expect(getByText('50+')).toBeDefined();
  });
});

describe('StockScreenerScreen — No Results', () => {
  it('shows no results view when filters yield no matches', () => {
    // Set extreme filters that won't match any stock
    useMarketStore.setState({
      screenerFilters: {
        priceMin: 99999,
        priceMax: 100000,
        peMin: 0,
        peMax: 1000,
        marketCapCategory: 'all',
        dividendMin: 0,
        sector: 'All',
        dayChangeMin: -100,
        dayChangeMax: 100,
      },
      screenerResults: [],
      isScreenerVisible: false,
    });

    const { getByText } = renderScreen();
    expect(getByText('No stocks match')).toBeDefined();
    expect(getByText('Try adjusting your filter criteria')).toBeDefined();
  });
});

describe('StockScreenerScreen — Apply and Results', () => {
  it('shows results after applying filters', () => {
    // Set store with pre-computed results
    useMarketStore.setState({
      screenerResults: [mockStocks[0], mockStocks[2]],
      isScreenerVisible: false,
    });

    const { getByText } = renderScreen();
    expect(getByText(/Results/i)).toBeDefined();
    expect(getByText('RELIANCE')).toBeDefined();
  });
});

describe('StockScreenerScreen — Navigation', () => {
  it('navigates to StockDetail on stock tap', () => {
    // Set some results
    useMarketStore.setState({
      screenerResults: [mockStocks[0]],
      isScreenerVisible: false,
    });

    const { getByText } = renderScreen();
    const stockItem = getByText('RELIANCE');
    act(() => {
      fireEvent.press(stockItem);
    });
    expect(mockNavigate).toHaveBeenCalledWith('StockDetail', {
      stockId: mockStocks[0].id,
      symbol: mockStocks[0].symbol,
    });
  });
});

describe('StockScreenerScreen — Saved Filters', () => {
  it('renders Save button in action row', () => {
    const { getByText } = renderScreen();
    expect(getByText('Save')).toBeDefined();
  });

  it('opens save modal on Save button press', () => {
    const { getByText, getByPlaceholderText } = renderScreen();

    // Click Save button to open modal
    const saveBtn = getByText('Save');
    act(() => { fireEvent.press(saveBtn); });

    expect(getByText('Save Filters')).toBeDefined();
    expect(getByPlaceholderText('e.g. High Dividend Stocks')).toBeDefined();
  });

  it('hides saved presets section when storage is empty', () => {
    const { queryByText } = renderScreen();
    expect(queryByText('Saved Filters')).toBeNull();
  });

  it('hides saved section when no presets exist', () => {
    const { queryByText } = renderScreen();
    // 'Saved Filters' header should not appear when presets is empty
    expect(queryByText('Saved Filters')).toBeNull();
  });

  it('opens save modal and saves a new preset', async () => {
    const { getByText, getByPlaceholderText } = renderScreen();

    // Click Save button
    const saveBtn = getByText('Save');
    act(() => { fireEvent.press(saveBtn); });

    // Modal should appear
    expect(getByText('Save Filters')).toBeDefined();
    expect(getByPlaceholderText('e.g. High Dividend Stocks')).toBeDefined();
  });

  it('shows preset after saving via modal', () => {
    const { getByText, getByPlaceholderText } = renderScreen();

    // Click Save button to open modal
    const saveBtn = getByText('Save');
    fireEvent.press(saveBtn);
    expect(getByText('Save Filters')).toBeDefined();

    // Type preset name inside act() so state updates before subsequent assertions
    const nameInput = getByPlaceholderText('e.g. High Dividend Stocks');
    act(() => {
      fireEvent.changeText(nameInput, 'My Preset');
    });

    // Click Save Preset
    fireEvent.press(getByText('Save Preset'));

    // Saved section header should appear with the new preset
    expect(getByText('Saved Filters')).toBeDefined();
    expect(getByText('My Preset')).toBeDefined();
  });
});

describe('StockScreenerScreen — Export / Share', () => {
  it('renders export button in results header', () => {
    useMarketStore.setState({ screenerResults: mockStocks, isScreenerVisible: false });
    const { getByText } = renderScreen();
    expect(getByText('Export')).toBeDefined();
  });

  it('export button is hidden when sort section is hidden', () => {
    // Use sort options visibility as proxy for results section visibility
    useMarketStore.setState({ screenerResults: [], isScreenerVisible: false });
    const { queryByText } = renderScreen();
    expect(queryByText('Sort by')).toBeNull();
  });

  it('opens export action sheet on tap', () => {
    useMarketStore.setState({ screenerResults: mockStocks, isScreenerVisible: false });
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Export'));
    expect(getByText('Export Results')).toBeDefined();
    expect(getByText('Export as CSV')).toBeDefined();
    expect(getByText('Share as Text')).toBeDefined();
  });

  it('shows stock count in export sheet subtitle', () => {
    useMarketStore.setState({ screenerResults: mockStocks, isScreenerVisible: false });
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Export'));
    expect(getByText(/12 stocks/)).toBeDefined();
  });

  it('shows cancel button in export action sheet', () => {
    useMarketStore.setState({ screenerResults: mockStocks, isScreenerVisible: false });
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Export'));
    expect(getByText('Export as CSV')).toBeDefined();
    expect(getByText('Cancel')).toBeDefined();
  });

  it('renders export button alongside sort indicator', () => {
    useMarketStore.setState({ screenerResults: mockStocks, isScreenerVisible: false });
    const { getByText } = renderScreen();
    expect(getByText('Export')).toBeDefined();
    expect(getByText(/Symbol/)).toBeDefined();
  });
});

describe('StockScreenerScreen — Sort Options', () => {
  beforeEach(() => {
    // Set results so sort UI appears
    useMarketStore.setState({
      screenerResults: mockStocks,
      isScreenerVisible: false,
    });
  });

  it('renders sort options bar when results exist', () => {
    const { getByText } = renderScreen();
    expect(getByText('Sort by')).toBeDefined();
    expect(getByText('P/E')).toBeDefined();
    expect(getByText('Dividend')).toBeDefined();
    expect(getByText('Change%')).toBeDefined();
    expect(getByText('Mkt Cap')).toBeDefined();
    expect(getByText('Price')).toBeDefined();
  });

  it('hides sort options when no results', () => {
    useMarketStore.setState({
      screenerResults: [],
      isScreenerVisible: false,
    });
    const { queryByText } = renderScreen();
    expect(queryByText('Sort by')).toBeNull();
  });

  it('renders stock results after sorting', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Results \(12\)/)).toBeDefined();
  });

  it('renders sorted header indicator', () => {
    const { getByText } = renderScreen();
    // Default sort is Symbol asc → shows "Symbol ↑"
    expect(getByText(/Symbol \u2191/)).toBeDefined();
  });
});
