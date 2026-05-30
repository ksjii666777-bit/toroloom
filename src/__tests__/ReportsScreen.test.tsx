import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', marketUp: '#00C853', marketDown: '#FF1744',
      bgCard: '#1A1A2E', bgCardLight: '#25253D', bgInput: '#1E1E32', border: '#2A2A44',
      divider: '#2A2A44', bgSecondary: '#16162A', warning: '#FFC107', borderLight: '#3A3A54',
      white: '#FFFFFF', transparent: 'transparent', danger: '#FF1744',
      finance: '#6C63FF', tech: '#00D2FF', energy: '#FFC107',
    },
  }),
}));

const mockNavigate = vi.fn();

const mockHoldings = [
  { id: 'h1', stockId: 's1', symbol: 'RELIANCE', name: 'Reliance Industries', quantity: 10, buyPrice: 2450, currentValue: 45000, pnl: 5000, pnlPercent: 12.5, totalInvested: 40000 },
  { id: 'h2', stockId: 's2', symbol: 'TCS', name: 'Tata Consultancy', quantity: 5, buyPrice: 3800, currentValue: 40000, pnl: 10000, pnlPercent: 33.33, totalInvested: 30000 },
  { id: 'h3', stockId: 's3', symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 20, buyPrice: 1650, currentValue: 40000, pnl: 10000, pnlPercent: 33.33, totalInvested: 30000 },
];

const mockTrades = [
  { id: 't1', symbol: 'RELIANCE', type: 'buy' as const, price: 2450, quantity: 10, total: 24500, timestamp: new Date().toISOString() },
  { id: 't2', symbol: 'TCS', type: 'sell' as const, price: 3900, quantity: 2, total: 7800, timestamp: new Date(Date.now() - 86400000).toISOString() },
];

let mockPortfolioState: any = {};

vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: () => mockPortfolioState,
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user1', name: 'TraderJoe' },
  }),
}));

import ReportsScreen from '../screens/reports/ReportsScreen';

beforeEach(() => {
  vi.clearAllMocks();
  mockPortfolioState = {
    holdings: mockHoldings,
    trades: mockTrades,
  };
});

describe('ReportsScreen', () => {
  it('renders the screen title', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Reports')).toBeDefined();
  });

  it('renders portfolio summary', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Portfolio Summary')).toBeDefined();
    expect(getByText('Portfolio performance overview')).toBeDefined();
  });

  it('renders portfolio value from holdings', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate } as any} />);
    // currentValue = 45000 + 40000 + 40000 = 125000
    expect(getByText('₹1,25,000')).toBeDefined();
  });

  it('renders available reports', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Available Reports')).toBeDefined();
    expect(getByText('P&L Statement')).toBeDefined();
    expect(getByText('Holdings Report')).toBeDefined();
  });

  it('renders recent activity from trades', () => {
    const { getByText } = render(<ReportsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Recent Activity')).toBeDefined();
    expect(getByText('RELIANCE')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<ReportsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(toJSON()).toBeTruthy();
  });
});
