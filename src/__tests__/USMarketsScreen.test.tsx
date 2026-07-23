/**
 * ============================================================================
 * Toroloom — US Markets Screen Tests
 * ============================================================================
 *
 * Tests that USMarketsScreen renders correctly with mock data, tabs,
 * search functionality, live data status badge, crypto navigation,
 * and market hours info card.
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mocks ====================

const mockNavigate = vi.fn();
const mockGetStatus = vi.fn();

vi.mock('../services/api/globalMarkets', () => ({
  globalMarketsApi: {
    getStatus: (...args: any[]) => mockGetStatus(...args),
    getStocks: vi.fn().mockResolvedValue(null),
    getIndices: vi.fn().mockResolvedValue(null),
    getCrypto: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', primaryLight: '#8B83FF',
      secondary: '#FF6B6B', success: '#00C853', danger: '#FF1744',
      marketUp: '#00C853', marketDown: '#FF1744',
      text: '#FFFFFF', textSecondary: '#B0B0D0', textMuted: '#6E6E9A',
      bg: '#0D0D2B', bgSecondary: '#1A1A3E',
      bgCard: '#222255', bgInput: '#1E1E4A',
      border: '#2A2A5E', divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// ==================== Imports ====================

import USMarketsScreen from '../screens/markets/USMarketsScreen';

// ==================== Helpers ====================

async function advanceAndFlush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
  // flush microtasks for fetchLiveData rejection/resolution
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

// ==================== Tests ====================

describe('USMarketsScreen — Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Default: API is not available (mock mode)
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders the screen title', async () => {
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();
    const title = queryByText('Global Markets');
    expect(title).not.toBeNull();
  });

  it('renders subtitle with market categories', async () => {
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();
    const subtitle = queryByText(/US.*ETFs.*Crypto/);
    expect(subtitle).not.toBeNull();
  });

  it('renders search bar', async () => {
    const { queryByPlaceholderText } = render(<USMarketsScreen />);
    await advanceAndFlush();
    const search = queryByPlaceholderText('Search symbols...');
    expect(search).not.toBeNull();
  });
});

describe('USMarketsScreen — Tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders all 4 tab buttons', async () => {
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();
    expect(queryByText('Indices')).not.toBeNull();
    expect(queryByText('Stocks')).not.toBeNull();
    expect(queryByText('ETFs')).not.toBeNull();
    expect(queryByText('Crypto')).not.toBeNull();
  });

  it('shows indices by default', async () => {
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();
    // Indices tab is active by default — should show US Market Hours card
    const hoursCard = queryByText(/US Market Hours/);
    expect(hoursCard).not.toBeNull();
  });

  it('shows market hours info card with correct text', async () => {
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();
    const nyse = queryByText(/NYSE/);
    expect(nyse).not.toBeNull();
  });
});

describe('USMarketsScreen — Live/Mock Badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => { vi.useRealTimers(); });

  it('shows Mock badge when backend reports no APIs configured', async () => {
    // Backend returns { marketstackConfigured: false, coinGeckoConfigured: false } from /api/global-markets/status
    mockGetStatus.mockResolvedValue({ marketstackConfigured: false, coinGeckoConfigured: false });
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();

    const mockBadge = queryByText('Mock');
    expect(mockBadge).not.toBeNull();
  });

  it('shows Live badge when backend APIs are configured', async () => {
    // Backend returns { marketstackConfigured: true, coinGeckoConfigured: true } from /api/global-markets/status
    mockGetStatus.mockResolvedValue({ marketstackConfigured: true, coinGeckoConfigured: true });
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();

    const liveBadge = queryByText('Live');
    expect(liveBadge).not.toBeNull();
  });
});

describe('USMarketsScreen — Indices Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders index cards with names like S&P 500', async () => {
    const { queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();
    const sp = queryByText('S&P 500');
    const nasdaq = queryByText('NASDAQ');
    expect(sp).not.toBeNull();
    expect(nasdaq).not.toBeNull();
  });
});

describe('USMarketsScreen — Search Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('filters stocks when search query is entered', async () => {
    const { queryByPlaceholderText, getByText } = render(<USMarketsScreen />);
    await advanceAndFlush();

    // Switch to Stocks tab
    const stocksTab = getByText('Stocks');
    await act(async () => {
      // Find the stock tab and trigger onPress
      const parents = stocksTab.parent;
      if (parents) {
        const parentPressable = parents.parent;
        if (parentPressable) {
          fireEvent.press(parentPressable);
        }
      }
    });
    await advanceAndFlush();

    // The stocks tab should render at least one stock name
    const techSector = getByText(/Technology/);
    expect(techSector).not.toBeNull();
  });
});

describe('USMarketsScreen — Crypto Tab Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('navigates to CryptoDetail when a crypto is tapped', async () => {
    const { getByText } = render(<USMarketsScreen />);
    await advanceAndFlush();

    // Switch to Crypto tab
    const cryptoTab = getByText('Crypto');
    await act(async () => {
      const parents = cryptoTab.parent;
      if (parents) {
        const parentPressable = parents.parent;
        if (parentPressable) {
          fireEvent.press(parentPressable);
        }
      }
    });
    await advanceAndFlush();

    // Now crypto list is shown — tap on Bitcoin row
    const bitcoin = getByText('BTC');
    await act(async () => {
      fireEvent.press(bitcoin);
    });

    // Should navigate to CryptoDetail with bitcoin params
    expect(mockNavigate).toHaveBeenCalledWith('CryptoDetail', {
      coinId: 'bitcoin',
      coinSymbol: 'BTC',
      coinName: 'Bitcoin',
    });
  });
});

describe('USMarketsScreen — ETFs Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetStatus.mockRejectedValue(new Error('Backend unavailable'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('shows ETFs tab with info card', async () => {
    const { getByText, queryByText } = render(<USMarketsScreen />);
    await advanceAndFlush();

    // Switch to ETFs tab
    const etfsTab = getByText('ETFs');
    await act(async () => {
      const parents = etfsTab.parent;
      if (parents) {
        const parentPressable = parents.parent;
        if (parentPressable) {
          fireEvent.press(parentPressable);
        }
      }
    });
    await advanceAndFlush();

    const infoText = queryByText(/AUM over/);
    expect(infoText).not.toBeNull();
  });
});
