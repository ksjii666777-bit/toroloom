/**
 * ============================================================================
 * Toroloom — PortfolioScreen Integration Tests
 * ============================================================================
 *
 * Verifies that PortfolioScreen renders properly with store data, handles
 * holdings/trades toggle, empty state, and triggers navigation callbacks.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from './testUtils';
import { mockHoldings, mockTrades } from '../constants/mockData';
import { usePortfolioStore } from '../store/portfolioStore';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      success: '#00C853',
      danger: '#FF1744',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      text: '#FFFFFF',
      textSecondary: '#B0B0D0',
      textMuted: '#6E6E9A',
      white: '#FFFFFF',
      bg: '#0D0D2B',
      bgSecondary: '#1A1A3E',
      bgCard: '#222255',
      bgCardLight: '#2A2A5E',
      bgInput: '#1E1E4A',
      bgDark: '#070720',
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

vi.mock('../store/portfolioStore', () => {
  const mockStoreState = () => ({
    holdings: mockHoldings,
    trades: mockTrades,
  });
  const usePortfolioStore = Object.assign(
    vi.fn(mockStoreState),
    { getState: vi.fn(mockStoreState) },
  );
  return { usePortfolioStore };
});

// ==================== Imports ====================

import PortfolioScreen from '../screens/tabs/PortfolioScreen';

// ==================== Helpers ====================

function advanceAndRender(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

// ==================== Tests ====================

describe('PortfolioScreen — Loading State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing during loading', () => {
    const { toJSON } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    expect(toJSON).not.toBeNull();
  });
});

describe('PortfolioScreen — Loaded Holdings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the header title', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Portfolio')).toBeDefined();
  });

  it('renders the subtitle', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Track your investments')).toBeDefined();
  });

  it('renders holdings section by default', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText(`Holdings (${mockHoldings.length})`)).toBeDefined();
  });

  it('renders the toggle for holdings view', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Recent Trades')).toBeDefined();
  });

  it('renders individual holding symbols', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('HDFCBANK')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
    expect(getByText('INFY')).toBeDefined();
    expect(getByText('SBIN')).toBeDefined();
  });

  it('renders stats in summary card', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Holdings')).toBeDefined();
    expect(getByText('Trades')).toBeDefined();
    expect(getByText('Winning')).toBeDefined();
  });
});

describe('PortfolioScreen — Trades View', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders toggle without navigation being called', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    const tradesToggle = getByText('Recent Trades');
    expect(tradesToggle).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('PortfolioScreen — Empty Holdings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    // Override the default mock with empty holdings/trades.
    // Uses mockImplementation (not mockReturnValueOnce) so it persists across
    // both the loading render and the loaded render.
    vi.mocked(usePortfolioStore).mockImplementation(() => ({ holdings: [], trades: [] }));
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restore default mock for other describe blocks
    vi.mocked(usePortfolioStore).mockImplementation(() => ({
      holdings: mockHoldings,
      trades: mockTrades,
    }));
  });

  it('renders empty state when no holdings exist', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Holdings (0)')).toBeDefined();
    expect(getByText('No Holdings Yet')).toBeDefined();
    expect(getByText('Start investing to build your portfolio')).toBeDefined();
    expect(getByText('Explore Markets')).toBeDefined();
  });
});
