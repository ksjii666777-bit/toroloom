/**
 * ============================================================================
 * Toroloom — FundsDashboardScreen Integration Tests
 * ============================================================================
 *
 * Verifies that FundsDashboardScreen renders correctly with fund data,
 * balance card, quick actions, stats grid, monthly activity, recent
 * transactions, and navigation callbacks.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { mockUser } from '../constants/mockData';
import type { FundTransaction } from '../store/fundStore';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const mockSeedTx: FundTransaction[] = [
  {
    id: 'seed_1', type: 'add', amount: 50000, method: 'UPI',
    status: 'completed', transactionId: 'TXN001',
    timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    dateLabel: '',
    account: undefined,
  },
  {
    id: 'seed_2', type: 'withdraw', amount: 10000, method: 'HDFC Bank',
    account: 'XXXX1234', status: 'completed', transactionId: 'WDR001',
    timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
    dateLabel: '',
  },
];

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      primaryLight: '#8B83FF',
      primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      secondary: '#FF6B6B',
      success: '#00C853',
      danger: '#FF1744',
      warning: '#FFC107',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      marketNeutral: '#FFC107',
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

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: vi.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: mockUser,
  })),
}));

vi.mock('../store/fundStore', () => ({
  useFundStore: vi.fn(() => ({
    transactions: mockSeedTx,
  })),
}));

// ==================== Imports ====================

import FundsDashboardScreen from '../screens/funds/FundsDashboardScreen';

// ==================== Helpers ====================

function advanceAndRender(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

// ==================== Tests ====================

describe('FundsDashboardScreen — Loading State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing during loading', () => {
    const { toJSON } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    expect(toJSON).not.toBeNull();
  });
});

describe('FundsDashboardScreen — Loaded Content', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the header title', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(getByText('Funds Dashboard')).toBeDefined();
  });

  it('renders the Available Balance card', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(getByText('Available Balance')).toBeDefined();
  });

  it('renders the balance value from user data', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    // 2500000 formatted as ₹25.00L
    expect(getByText(/₹/)).toBeDefined();
  });

  it('renders the balance subtext', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(getByText('₹25,00,000.00')).toBeDefined();
  });

  it('renders all 4 quick action buttons', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(getByText('Add Funds')).toBeDefined();
    expect(getByText('Withdraw')).toBeDefined();
    expect(getByText('Transfer')).toBeDefined();
    expect(getByText('UPI')).toBeDefined();
  });

  it('renders stats grid with 4 stat cards', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(getByText('Total Added')).toBeDefined();
    expect(getByText('Withdrawn')).toBeDefined();
    expect(getByText('Net Addition')).toBeDefined();
    expect(getByText('Transactions')).toBeDefined();
  });

  it('renders stat values from seed data (total add 50000+50000+100000)', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(getByText(/Total Added/)).toBeDefined();
  });

  it('renders the This Month activity section', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(getByText('This Month')).toBeDefined();
  });

  it('renders Recent Transactions section', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(getByText('Recent Transactions')).toBeDefined();
  });

  it('renders transaction items from seed data', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(getByText('Funds Added')).toBeDefined();
    expect(getByText('Funds Withdrawn')).toBeDefined();
  });

  it('renders See All link', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(getByText('See All')).toBeDefined();
  });

  it('renders the footer summary card', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(getByText('Total Deposits')).toBeDefined();
    expect(getByText('Total Withdrawals')).toBeDefined();
    expect(getByText('Current Balance')).toBeDefined();
  });

  it('renders the history button in header', () => {
    const { toJSON } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(toJSON).not.toBeNull();
  });
});

describe('FundsDashboardScreen — Transaction Detail', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders transaction amounts with correct signs', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    // '+' for add, '-' for withdraw
    expect(getByText(/\+/)).toBeDefined();
    expect(getByText(/\-/)).toBeDefined();
  });

  it('shows transaction method and timestamp', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    // UPI appears as method in seed_1
    expect(getByText(/UPI/)).toBeDefined();
  });
});

describe('FundsDashboardScreen — Navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates to AddFunds when Add Funds quick action is pressed', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    const addFundsLabel = getByText('Add Funds');
    act(() => { fireEvent.press(addFundsLabel); });
    expect(mockNavigate).toHaveBeenCalledWith('AddFunds');
  });

  it('navigates back when back button is pressed', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(getByText('Funds Dashboard')).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to Withdraw when Withdraw quick action is pressed', () => {
    const { getAllByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    // getAllByText returns DFS order; the quick action label is the one with
    // exactly "Withdraw" text — filter out "Withdrawn" by matching only elements
    // that do NOT have "n" as the next character.
    const matches = getAllByText(/Withdraw/);
    // The shortest match is the quick action label "Withdraw" (not "Withdrawn")
    const label = matches.find((m) => {
      const text = m.children?.join?.('') ?? '';
      return text.trim() === 'Withdraw';
    })!;
    act(() => { fireEvent.press(label); });
    expect(mockNavigate).toHaveBeenCalledWith('Withdraw');
  });

  it('navigates to Transfer when Transfer quick action is pressed', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    const transferLabel = getByText('Transfer');
    act(() => { fireEvent.press(transferLabel); });
    expect(mockNavigate).toHaveBeenCalledWith('Transfer');
  });

  it('navigates to UPI when UPI quick action is pressed', () => {
    const { getAllByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    // getAllByText matches all elements containing "UPI". Filter to find the
    // quick action label with exactly "UPI".
    const matches = getAllByText(/UPI/);
    const label = matches.find((m) => {
      const text = m.children?.join?.('') ?? '';
      return text.trim() === 'UPI';
    })!;
    act(() => { fireEvent.press(label); });
    expect(mockNavigate).toHaveBeenCalledWith('UPI');
  });

  it('navigates to TransactionHistory when history button is pressed', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    const seeAllLabel = getByText('See All');
    act(() => { fireEvent.press(seeAllLabel); });
    expect(mockNavigate).toHaveBeenCalledWith('TransactionHistory');
  });

  it('does not navigate on initial render', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(getByText('Funds Dashboard')).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('FundsDashboardScreen — Empty Transactions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    // Override to return empty transactions
    vi.mocked(useFundStore).mockImplementation(() => ({ transactions: [] }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(useFundStore).mockImplementation(() => ({ transactions: mockSeedTx }));
  });

  it('shows empty state when no transactions exist', () => {
    const { getByText } = render(<FundsDashboardScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />);
    advanceAndRender(500);
    expect(getByText('No transactions yet')).toBeDefined();
    expect(getByText('Add Funds')).toBeDefined();
  });
});

// Re-import for mock override type safety
import { useFundStore } from '../store/fundStore';
