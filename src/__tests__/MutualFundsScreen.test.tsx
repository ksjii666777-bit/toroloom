import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', marketUp: '#00C853', bgCard: '#1A1A2E',
      bgCardLight: '#25253D', bgInput: '#1E1E32', border: '#2A2A44', divider: '#2A2A44',
      bgSecondary: '#16162A', warning: '#FFC107', borderLight: '#3A3A54',
    },
  }),
}));

const mockNavigate = vi.fn();

const defaultFunds = [
  {
    id: 'f1', name: 'Axis Bluechip Fund', category: 'Equity', nav: 45.67,
    dayChange: 0.56, dayChangePercent: 1.24,
    oneYearReturn: 12.5, threeYearReturn: 15.2, fiveYearReturn: 18.0,
    riskLevel: 'Moderate' as const, minInvestment: 500, rating: 4, fundSize: '₹5,000 Cr',
  },
  {
    id: 'f2', name: 'SBI Debt Fund', category: 'Debt', nav: 120.34,
    dayChange: -0.23, dayChangePercent: -0.19,
    oneYearReturn: 7.8, threeYearReturn: 6.5, fiveYearReturn: 5.2,
    riskLevel: 'Low' as const, minInvestment: 1000, rating: 3, fundSize: '₹12,000 Cr',
  },
  {
    id: 'f3', name: 'HDFC Midcap Fund', category: 'Equity', nav: 89.12,
    dayChange: 2.45, dayChangePercent: 2.82,
    oneYearReturn: 18.3, threeYearReturn: 22.1, fiveYearReturn: 25.4,
    riskLevel: 'High' as const, minInvestment: 500, rating: 5, fundSize: '₹8,500 Cr',
  },
];

let mockStoreState: any = {};

vi.mock('../store/mutualFundStore', () => ({
  useMutualFundStore: () => mockStoreState,
}));

import MutualFundsScreen from '../screens/mutual-funds/MutualFundsScreen';

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState = {
    funds: defaultFunds,
    sipPlans: [],
    fetchFunds: vi.fn(),
    fetchSIPs: vi.fn(),
    investInFund: vi.fn(),
    startSIP: vi.fn(),
  };
});

describe('MutualFundsScreen', () => {
  it('renders the screen title', () => {
    const { getByText } = render(<MutualFundsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Mutual Funds')).toBeDefined();
  });

  it('renders category filter buttons', () => {
    const { getByText } = render(<MutualFundsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('All')).toBeDefined();
    expect(getByText('Equity')).toBeDefined();
    expect(getByText('Debt')).toBeDefined();
  });

  it('renders fund names', () => {
    const { getByText } = render(<MutualFundsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Axis Bluechip Fund')).toBeDefined();
    expect(getByText('SBI Debt Fund')).toBeDefined();
  });

  it('renders fund NAV values', () => {
    const { getByText } = render(<MutualFundsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('₹45.67')).toBeDefined();
    expect(getByText('₹120.34')).toBeDefined();
  });

  it('renders risk levels', () => {
    const { getByText } = render(<MutualFundsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Moderate')).toBeDefined();
    expect(getByText('Low')).toBeDefined();
    expect(getByText('High')).toBeDefined();
  });

  it('renders returns information', () => {
    const { getByText } = render(<MutualFundsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('+12.5%')).toBeDefined();
    expect(getByText('+7.8%')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<MutualFundsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(toJSON()).toBeTruthy();
  });
});
