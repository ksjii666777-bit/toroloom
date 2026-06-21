import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render} from './testUtils';

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

const defaultTransactions = [
  { id: 't1', type: 'add' as const, amount: 10000, method: 'UPI', status: 'completed' as const, dateLabel: 'Today', timestamp: Date.now() - 3600000, transactionId: 'TXN001' },
  { id: 't2', type: 'withdraw' as const, amount: 5000, method: 'HDFC Bank', status: 'completed' as const, dateLabel: 'Yesterday', timestamp: Date.now() - 86400000, transactionId: 'TXN002' },
  { id: 't3', type: 'add' as const, amount: 25000, method: 'Net Banking', status: 'pending' as const, dateLabel: 'Yesterday', timestamp: Date.now() - 86400000, transactionId: 'TXN003' },
];

let mockStoreState: any = {};

vi.mock('../store/fundStore', () => ({
  useFundStore: () => mockStoreState,
}));

import TransactionHistoryScreen from '../screens/funds/TransactionHistoryScreen';

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState = {
    transactions: defaultTransactions,
  };
});

describe('TransactionHistoryScreen', () => {
  it('renders the screen title', () => {
    const { getByText } = render(<TransactionHistoryScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Transaction History')).toBeDefined();
  });

  it('renders filter tabs', () => {
    const { getByText } = render(<TransactionHistoryScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('All')).toBeDefined();
    expect(getByText('Add Funds')).toBeDefined();
    expect(getByText('Withdrawals')).toBeDefined();
  });

  it('renders transaction type labels', () => {
    const { getByText } = render(<TransactionHistoryScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Funds Added')).toBeDefined();
    expect(getByText('Funds Withdrawn')).toBeDefined();
  });

  it('renders transaction methods', () => {
    const { getByText } = render(<TransactionHistoryScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('via UPI')).toBeDefined();
    expect(getByText('to HDFC Bank')).toBeDefined();
  });

  it('renders empty state when no transactions', () => {
    mockStoreState.transactions = [];
    const { getByText } = render(<TransactionHistoryScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('No Transactions')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<TransactionHistoryScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(toJSON()).toBeTruthy();
  });
});
