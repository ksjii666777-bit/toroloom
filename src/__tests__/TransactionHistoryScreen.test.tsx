/**
 * ============================================================================
 * Toroloom — TransactionHistoryScreen Comprehensive Tests
 * ============================================================================
 *
 * Covers: rendering, summary card, stats row, filter tabs, expandable
 * transaction rows, toggling details, empty state, navigation.
 *
 * NOTE: All fireEvent calls that trigger state updates are wrapped in act()
 * because React 19's test renderer requires act() to flush batched state
 * updates and re-render the component tree.
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { render, fireEvent } from './testUtils';

// ==================== Mock Setup (hoisted) ====================

vi.mock('react-native', async () => {
  const mock = await import('./react-native.mock');
  return { ...mock };
});

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', marketUp: '#00C853', bgCard: '#1A1A2E',
      bgCardLight: '#25253D', bgInput: '#1E1E32', border: '#2A2A44', divider: '#2A2A44',
      bgSecondary: '#16162A', warning: '#FFC107', borderLight: '#3A3A54',
      danger: '#FF1744', success: '#00C853',
    },
    isDark: true,
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// ── Seed transactions ─────────────────────────────────────────

const yesterday = new Date(Date.now() - 86400000).toISOString();
const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();
const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString();

const seedTransactions = [
  {
    id: 'tx01', type: 'add', amount: 50000, method: 'UPI',
    status: 'completed', transactionId: 'TXN001',
    timestamp: yesterday, dateLabel: 'Yesterday',
  },
  {
    id: 'tx02', type: 'withdraw', amount: 10000, method: 'HDFC Bank',
    account: 'XXXX1234', status: 'completed', transactionId: 'WDR001',
    timestamp: yesterday, dateLabel: 'Yesterday',
  },
  {
    id: 'tx03', type: 'add', amount: 25000, method: 'Net Banking',
    status: 'pending', transactionId: 'TXN003',
    timestamp: lastWeek, dateLabel: 'Last Week',
  },
  {
    id: 'tx04', type: 'withdraw', amount: 5000, method: 'ICICI Bank',
    account: 'XXXX5678', status: 'completed', transactionId: 'WDR002',
    timestamp: lastWeek, dateLabel: 'Last Week',
  },
  {
    id: 'tx05', type: 'add', amount: 100000, method: 'Razorpay',
    status: 'completed', transactionId: 'TXN005',
    timestamp: lastMonth, dateLabel: 'Last Month',
  },
];

let mockStoreState: { transactions: typeof seedTransactions };

vi.mock('../store/fundStore', () => ({
  useFundStore: () => mockStoreState,
}));

// ==================== Imports ====================

import TestRenderer from 'react-test-renderer';
import TransactionHistoryScreen from '../screens/funds/TransactionHistoryScreen';

// ==================== Setup ====================

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState = { transactions: seedTransactions };
});

// ── Helpers ──────────────────────────────────────────────────

function renderTxHistory() {
  return render(
    <TransactionHistoryScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
  );
}

function pressTab(getByText: (m: string | RegExp) => ReactTestInstance, label: string) {
  act(() => { fireEvent.press(getByText(label)); });
}

/**
 * Walk the full render tree (depth-first) to find an element that has
 * onPress AND whose accumulated text matches the given pattern.
 */
function pressTxByText(root: TestRenderer.ReactTestInstance, textMatch: string | RegExp) {
  function collectText(inst: TestRenderer.ReactTestInstance): string {
    let result = '';
    if (typeof inst.children === 'string') result += inst.children;
    else if (Array.isArray(inst.children)) {
      for (const child of inst.children) {
        if (typeof child === 'string') result += child;
        else if (child && typeof child === 'object' && 'children' in child) {
          result += collectText(child as TestRenderer.ReactTestInstance);
        }
      }
    }
    return result;
  }

  function search(inst: TestRenderer.ReactTestInstance): boolean {
    const text = collectText(inst);
    const matches =
      typeof textMatch === 'string' ? text.includes(textMatch) : textMatch.test(text);

    if (matches) {
      const onPress = (inst.props as Record<string, any>)?.onPress;
      if (typeof onPress === 'function') {
        act(() => { onPress(); });
        return true;
      }
    }

    if (typeof inst.children !== 'string' && Array.isArray(inst.children)) {
      for (const child of inst.children) {
        if (child && typeof child === 'object' && 'type' in child) {
          if (search(child as TestRenderer.ReactTestInstance)) return true;
        }
      }
    }
    return false;
  }

  const rootChildren = root.children as TestRenderer.ReactTestInstance[];
  for (const child of rootChildren) {
    if (child && typeof child === 'object' && 'type' in child) {
      if (search(child as TestRenderer.ReactTestInstance)) return true;
    }
  }
}

// ==================== Tests — Rendering ====================

describe('TransactionHistoryScreen — Rendering', () => {
  it('renders the screen title', () => {
    const { getByText } = renderTxHistory();
    expect(getByText('Transaction History')).toBeDefined();
  });

  it('renders the summary card with total added (compact format)', () => {
    const { getByText } = renderTxHistory();
    expect(getByText('Total Added')).toBeDefined();
    // formatCurrency with compact=true: 175000 → "₹1.75L"
    expect(getByText(/1.75L/)).toBeDefined();
  });

  it('renders total withdrawn in summary card (compact format)', () => {
    const { getByText } = renderTxHistory();
    expect(getByText('Total Withdrawn')).toBeDefined();
    // formatCurrency with compact=true: 15000 → "₹15.0K"
    expect(getByText(/15.0K/)).toBeDefined();
  });

  it('renders net addition in summary card (compact format)', () => {
    const { getByText } = renderTxHistory();
    expect(getByText('Net Addition')).toBeDefined();
    // formatCurrency with compact=true: 160000 → "₹1.60L"
    expect(getByText(/1.60L/)).toBeDefined();
  });

  it('renders all 3 filter tabs', () => {
    const { getByText } = renderTxHistory();
    expect(getByText('All')).toBeDefined();
    expect(getByText('Add Funds')).toBeDefined();
    expect(getByText('Withdrawals')).toBeDefined();
  });

  it('renders stats row with transaction counts', () => {
    const { getByText } = renderTxHistory();
    expect(getByText('Transactions')).toBeDefined();
    expect(getByText('Adds')).toBeDefined();
    expect(getByText('Withdrawals')).toBeDefined();
    expect(getByText('5')).toBeDefined();
    expect(getByText('3')).toBeDefined();
    expect(getByText('2')).toBeDefined();
  });

  it('renders date group labels', () => {
    const { getByText } = renderTxHistory();
    expect(getByText('Yesterday')).toBeDefined();
    expect(getByText('Last Week')).toBeDefined();
    expect(getByText('Last Month')).toBeDefined();
  });

  it('renders transaction type labels', () => {
    const { getByText } = renderTxHistory();
    expect(getByText('Funds Added')).toBeDefined();
    expect(getByText('Funds Withdrawn')).toBeDefined();
  });

  it('renders transaction methods', () => {
    const { getByText } = renderTxHistory();
    expect(getByText('via UPI')).toBeDefined();
    expect(getByText('to HDFC Bank')).toBeDefined();
    expect(getByText('to ICICI Bank')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = renderTxHistory();
    expect(toJSON()).toBeTruthy();
  });
});

// ==================== Filter Tabs ====================

describe('TransactionHistoryScreen — Filter Tabs', () => {
  it('shows all transactions by default', () => {
    const { getByText } = renderTxHistory();
    expect(getByText('Yesterday')).toBeDefined();
    expect(getByText('Last Month')).toBeDefined();
  });

  it('filters to show only Add Funds transactions', () => {
    const { getByText, queryByText } = renderTxHistory();
    pressTab(getByText, 'Add Funds');

    expect(getByText('Funds Added')).toBeDefined();
    expect(queryByText(/Funds Withdrawn/)).toBeNull();
  });

  it('filters to show only Withdrawals', () => {
    const { getByText, queryByText } = renderTxHistory();
    pressTab(getByText, 'Withdrawals');

    expect(getByText('Funds Withdrawn')).toBeDefined();
    expect(queryByText(/Funds Added/)).toBeNull();
  });

  it('resets filter to All shows all transactions again', () => {
    const { getByText, queryByText } = renderTxHistory();
    pressTab(getByText, 'Withdrawals');
    expect(queryByText(/Funds Added/)).toBeNull();

    pressTab(getByText, 'All');
    expect(getByText('Yesterday')).toBeDefined();
    expect(getByText('Last Month')).toBeDefined();
  });

  it('updates stats row when filtered', () => {
    const { getByText } = renderTxHistory();
    pressTab(getByText, 'Add Funds');
    expect(getByText('3')).toBeDefined();
  });
});

// ==================== Expand/Collapse ====================

describe('TransactionHistoryScreen — Expandable Details', () => {
  it('shows transaction ID when a row is expanded', () => {
    const { getByText, queryByText, root } = renderTxHistory();

    expect(queryByText('TXN001')).toBeNull();

    // Expand first "Funds Added" row by pressing on it
    pressTxByText(root, /Funds Added/);

    expect(getByText('Transaction ID')).toBeDefined();
    expect(getByText('TXN001')).toBeDefined();
  });

  it('shows amount in expanded details', () => {
    const { getByText, root } = renderTxHistory();
    pressTxByText(root, /Funds Added/);

    expect(getByText('Amount')).toBeDefined();
    expect(getByText(/₹50,000/)).toBeDefined();
  });

  it('shows method and status in expanded details', () => {
    const { getByText, root } = renderTxHistory();
    pressTxByText(root, /Funds Added/);

    expect(getByText('Method')).toBeDefined();
    expect(getByText('UPI')).toBeDefined();
    expect(getByText('Status')).toBeDefined();
    expect(getByText('Completed')).toBeDefined();
  });

  it('shows account info for withdraw transactions', () => {
    const { getByText, root } = renderTxHistory();

    // Filter to withdrawals first to isolate
    pressTab(getByText, 'Withdrawals');
    pressTxByText(root, /Funds Withdrawn/);

    expect(getByText('Account')).toBeDefined();
    expect(getByText('XXXX1234')).toBeDefined();
  });

  it('shows date and time in expanded details', () => {
    const { getByText, root } = renderTxHistory();
    pressTxByText(root, /Funds Added/);

    expect(getByText('Date & Time')).toBeDefined();
  });

  it('toggles expanded state on re-press', () => {
    const { getByText, queryByText, root } = renderTxHistory();

    // Expand
    pressTxByText(root, /Funds Added/);
    expect(getByText('Transaction ID')).toBeDefined();

    // Collapse
    pressTxByText(root, /Funds Added/);
    expect(queryByText('Transaction ID')).toBeNull();
  });
});

// ==================== Empty State ====================

describe('TransactionHistoryScreen — Empty State', () => {
  it('shows empty state when no transactions exist', () => {
    mockStoreState = { transactions: [] };
    const { getByText } = renderTxHistory();
    expect(getByText('No Transactions')).toBeDefined();
    expect(getByText(/add\/withdraw history/)).toBeDefined();
  });

  it('shows filter-specific empty state', () => {
    mockStoreState = {
      transactions: [{
        id: 'tx01', type: 'add', amount: 50000, method: 'UPI',
        status: 'completed', transactionId: 'TXN001',
        timestamp: new Date().toISOString(), dateLabel: 'Today',
      }],
    };
    const { getByText } = renderTxHistory();
    pressTab(getByText, 'Withdrawals');
    expect(getByText(/No withdraw transactions yet/)).toBeDefined();
  });
});

// ==================== Navigation ====================

describe('TransactionHistoryScreen — Navigation', () => {
  it('does not navigate on initial render', () => {
    renderTxHistory();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders the screen', () => {
    const { getByText } = renderTxHistory();
    expect(getByText('Transaction History')).toBeDefined();
  });
});
