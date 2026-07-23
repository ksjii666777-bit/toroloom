/**
 * ============================================================================
 * Toroloom — Crypto Detail Screen Tests
 * ============================================================================
 *
 * Tests that CryptoDetailScreen renders correctly with crypto data from the
 * globalMarketsApi: loading state, error state with retry, price display,
 * change pill matrix, key stats, about section, and action buttons.
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import type { CryptoDetailData } from '../services/api/globalMarkets';

// ==================== Mocks ====================

const mockNavigate = vi.fn();
const mockGetCryptoDetail = vi.fn();

// Mock the globalMarketsApi module
vi.mock('../services/api/globalMarkets', () => ({
  globalMarketsApi: {
    getCryptoDetail: (...args: any[]) => mockGetCryptoDetail(...args),
  },
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      secondary: '#FF6B6B',
      success: '#00C853', danger: '#FF1744', warning: '#FFC107',
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

const mockCryptoDetailData: CryptoDetailData = {
  id: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
  image: '',
  price: 67845.20,
  change: 1234.50,
  changePercent: 1.85,
  change1h: 0.25,
  change7d: 8.50,
  change30d: 15.20,
  change1y: 145.0,
  marketCap: 1340000000000,
  volume24h: 28500000000,
  high24h: 68500.00,
  low24h: 67200.00,
  circulatingSupply: 19750000,
  totalSupply: 21000000,
  maxSupply: 21000000,
  ath: 73750.00,
  athDate: '2024-03-14T00:00:00.000Z',
  description: 'Bitcoin is the first decentralized cryptocurrency. Created in 2009 by Satoshi Nakamoto.',
  homepage: 'https://bitcoin.org',
  priceHistory: Array.from({ length: 100 }, (_, i) => ({
    timestamp: Date.now() - (100 - i) * 3600000,
    price: 67000 + Math.random() * 2000,
  })),
  color: '#F7931A',
};

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

// ==================== Imports ====================

import CryptoDetailScreen from '../screens/stock/CryptoDetailScreen';

// ==================== Tests ====================

describe('CryptoDetailScreen — Loading State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetCryptoDetail.mockImplementation(() => new Promise(() => {})); // Never resolves
  });

  afterEach(() => { vi.useRealTimers(); });

  it('shows loading text for crypto name from params', () => {
    const route = { params: { coinId: 'bitcoin', coinSymbol: 'BTC', coinName: 'Bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    // While loading, the screen shows the coinName from route params
    const loadingText = queryByText(/Loading/);
    expect(loadingText).not.toBeNull();
  });
});

describe('CryptoDetailScreen — Data Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetCryptoDetail.mockResolvedValue(mockCryptoDetailData);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders crypto symbol after data loads', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const sym = queryByText('BTC');
    expect(sym).not.toBeNull();
  });

  it('renders crypto name after data loads', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const name = queryByText('Bitcoin');
    expect(name).not.toBeNull();
  });

  it('renders price in USD format', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const priceEl = queryByText(/\$67,845\.20/);
    expect(priceEl).not.toBeNull();
  });

  it('renders positive change percentage', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const changeEl = queryByText(/1\.85/);
    expect(changeEl).not.toBeNull();
  });

  it('renders Key Statistics section', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const label = queryByText('Key Statistics');
    expect(label).not.toBeNull();
  });

  it('renders Market Cap stat', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const label = queryByText('Market Cap');
    expect(label).not.toBeNull();
  });

  it('renders 24h Volume stat', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const label = queryByText('24h Volume');
    expect(label).not.toBeNull();
  });

  it('renders All-Time High stat', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const label = queryByText('All-Time High');
    expect(label).not.toBeNull();
  });

  it('renders Price Change section', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const label = queryByText('Price Change');
    expect(label).not.toBeNull();
  });

  it('renders 1H change pill', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const label = queryByText('1H');
    expect(label).not.toBeNull();
  });

  it('renders 24H change pill', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const label = queryByText('24H');
    expect(label).not.toBeNull();
  });

  it('renders About section with crypto name', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const label = queryByText(/About Bitcoin/);
    expect(label).not.toBeNull();
  });

  it('renders Buy and Sell action buttons', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const buy = queryByText(/Buy BTC/);
    const sell = queryByText(/Sell BTC/);
    expect(buy).not.toBeNull();
    expect(sell).not.toBeNull();
  });

  it('renders chart timeframe buttons', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const tfEl = queryByText('7d');
    expect(tfEl).not.toBeNull();
  });

  it('fetches crypto data with coinId from route params', async () => {
    const route = { params: { coinId: 'ethereum' } };
    render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    expect(mockGetCryptoDetail).toHaveBeenCalledWith('ethereum');
  });

  it('falls back to lowercase coinSymbol when no coinId', async () => {
    const route = { params: { coinSymbol: 'BTC' } };
    render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    expect(mockGetCryptoDetail).toHaveBeenCalledWith('btc');
  });
});

describe('CryptoDetailScreen — Error State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetCryptoDetail.mockRejectedValue(new Error('API rate limit exceeded'));
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders error message when API call fails', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    // Component renders {error} which is err.message from the rejected promise
    const errorEl = queryByText(/API rate limit exceeded/);
    expect(errorEl).not.toBeNull();
  });

  it('renders Retry button on error', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const retryBtn = queryByText('Retry');
    expect(retryBtn).not.toBeNull();
  });
});

describe('CryptoDetailScreen — Disclaimer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetCryptoDetail.mockResolvedValue(mockCryptoDetailData);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders cryptocurrency disclaimer', async () => {
    const route = { params: { coinId: 'bitcoin' } };
    const { queryByText } = render(
      <CryptoDetailScreen route={route} navigation={{ navigate: mockNavigate, goBack: mockNavigate }} />
    );
    await flushMicrotasks();

    const disclaimer = queryByText(/Cryptocurrency prices are volatile/);
    expect(disclaimer).not.toBeNull();
  });
});
