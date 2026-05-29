/**
 * ============================================================================
 * Toroloom — HomeScreen Integration Tests
 * ============================================================================
 *
 * Verifies that HomeScreen renders properly with all store data, handles
 * greeting, portfolio card, market indices, top gainers/losers, level & XP,
 * watchlist preview, quick actions, and navigation callbacks.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { mockUser, mockIndices, mockStocks, mockUserLevel, mockBadges, mockNotifications } from '../constants/mockData';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      primaryLight: '#8B83FF',
      primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      success: '#00C853',
      danger: '#FF1744',
      warning: '#FFC107',
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
      bgOverlay: 'rgba(0,0,0,0.5)',
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({ user: mockUser })),
}));

vi.mock('../store/marketStore', () => ({
  useMarketStore: vi.fn(() => ({
    indices: mockIndices,
    stocks: mockStocks,
  })),
}));

vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: vi.fn(() => ({
    holdings: [],
  })),
}));

vi.mock('../store/gamificationStore', () => ({
  useGamificationStore: vi.fn(() => ({
    userLevel: mockUserLevel,
    badges: mockBadges,
  })),
}));

vi.mock('../store/notificationStore', () => ({
  useNotificationStore: vi.fn(() => ({
    notifications: mockNotifications,
  })),
}));

// ==================== Imports ====================

import HomeScreen from '../screens/tabs/HomeScreen';

// ==================== Helpers ====================

function advanceAndRender(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

// ==================== Tests ====================

describe('HomeScreen — Loading State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing during loading', () => {
    const { toJSON } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    expect(toJSON).not.toBeNull();
  });
});

describe('HomeScreen — Loaded Content', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the greeting message', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    expect(getByText('Good Morning,')).toBeDefined();
  });

  it('renders the user first name from authStore', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    expect(getByText(/Rahul/)).toBeDefined();
    expect(getByText(/👋/)).toBeDefined();
  });

  it('renders the notification badge with unread count', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    // mockNotifications has 3 unread items — badge shows the count
    expect(getByText('3')).toBeDefined();
  });

  it('renders the portfolio card with value label', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    expect(getByText('Portfolio Value')).toBeDefined();
  });

  it('renders portfolio action buttons', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    expect(getByText('Add Funds')).toBeDefined();
    expect(getByText('Transfer')).toBeDefined();
    expect(getByText('Balance')).toBeDefined();
  });

  it('renders quick action buttons', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    expect(getByText('Buy')).toBeDefined();
    expect(getByText('Sell')).toBeDefined();
    expect(getByText('SIP')).toBeDefined();
    expect(getByText('Learn')).toBeDefined();
  });

  it('renders the Market Indices section header', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    expect(getByText('Market Indices')).toBeDefined();
    expect(getByText('See All')).toBeDefined();
  });

  it('renders index cards (NIFTY, SENSEX, BANKNIFTY)', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    expect(getByText('NIFTY')).toBeDefined();
    expect(getByText('SENSEX')).toBeDefined();
    expect(getByText('BANKNIFTY')).toBeDefined();
  });

  it('renders the level & XP section', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    expect(getByText(/Lvl 12/)).toBeDefined();
    expect(getByText('Trading Pro')).toBeDefined();
  });

  it('renders the XP bar text', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    expect(getByText('4500 / 5000 XP')).toBeDefined();
  });

  it('renders Top Gainers section', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    expect(getByText(/Top Gainers/)).toBeDefined();
    expect(getByText('View All')).toBeDefined();
  });

  it('renders Top Losers section', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    expect(getByText(/Top Losers/)).toBeDefined();
  });

  it('renders top gainer stocks', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    expect(getByText('BHARTIARTL')).toBeDefined();
  });

  it('renders Watchlist Preview section', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    expect(getByText(/My Watchlist/)).toBeDefined();
    expect(getByText('Manage')).toBeDefined();
  });
});

describe('HomeScreen — Navigation Callbacks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates to Markets when See All is pressed', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    act(() => {
      fireEvent.press(getByText('See All'));
    });
    expect(mockNavigate).toHaveBeenCalledWith('Markets');
  });

  it('navigates to Markets when View All is pressed', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    act(() => {
      fireEvent.press(getByText('View All'));
    });
    expect(mockNavigate).toHaveBeenCalledWith('Markets');
  });

  it('navigates to Watchlist when Manage is pressed', () => {
    const { getByText } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    act(() => {
      fireEvent.press(getByText('Manage'));
    });
    expect(mockNavigate).toHaveBeenCalledWith('Watchlist');
  });

  it('does not navigate on initial render', () => {
    const { toJSON } = render(<HomeScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(700);
    expect(toJSON).not.toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
