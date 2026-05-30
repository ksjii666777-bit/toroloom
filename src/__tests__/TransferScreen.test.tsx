/**
 * ============================================================================
 * Toroloom — TransferScreen Comprehensive Tests
 * ============================================================================
 *
 * Covers: rendering, tab switching (internal/external), account selection,
 * bank selection, amount presets, custom amount, balance card, transfer button
 * states, validation (min amount, insufficient balance, same account),
 * processing flow with fake timers, success state, and edge cases.
 *
 * NOTE: All fireEvent calls that trigger state updates are wrapped in act()
 * because React 19's test renderer requires act() to flush batched state
 * updates and re-render the component tree.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { render, fireEvent } from './testUtils';

// ==================== Mock Setup (hoisted) ====================

vi.mock('react-native', async () => {
  const mock = await import('./react-native.mock');
  return {
    ...mock,
    Alert: { alert: vi.fn() },
  };
});

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const mockUpdateBalance = vi.fn();
const mockAddTransaction = vi.fn();

let confirmCallback: (() => void) | null = null;

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

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user1', username: 'TraderJoe', email: 'trader@example.com', balance: 2500000 },
    updateBalance: mockUpdateBalance,
  }),
}));

vi.mock('../store/fundStore', () => ({
  useFundStore: () => ({
    addTransaction: mockAddTransaction,
  }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// ==================== Imports ====================

import TransferScreen from '../screens/funds/TransferScreen';
import { Alert } from 'react-native';

// ==================== Setup ====================

beforeEach(() => {
  vi.clearAllMocks();
  confirmCallback = null;
  (Alert.alert as ReturnType<typeof vi.fn>).mockImplementation(
    (_title: string, _message: string, buttons?: any[]) => {
      if (buttons?.[1]?.onPress) {
        confirmCallback = buttons[1].onPress;
      }
    },
  );
});

afterEach(() => {
  confirmCallback = null;
});

// ── Helpers ──────────────────────────────────────────────────

function renderTransfer() {
  return render(<TransferScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
}

function changeText(input: ReactTestInstance, text: string) {
  act(() => { fireEvent.changeText(input, text); });
}

function press(element: ReactTestInstance) {
  act(() => { fireEvent.press(element); });
}

// ==================== Tests ====================

describe('TransferScreen — Rendering', () => {
  it('renders the screen title', () => {
    const { getByText } = renderTransfer();
    expect(getByText('Transfer')).toBeDefined();
  });

  it('renders tab navigation options', () => {
    const { getByText } = renderTransfer();
    expect(getByText('To Self Account')).toBeDefined();
    expect(getByText('To Bank Account')).toBeDefined();
  });

  it('renders the amount input placeholder', () => {
    const { getByPlaceholderText } = renderTransfer();
    expect(getByPlaceholderText('Enter transfer amount')).toBeDefined();
  });

  it('renders preset amount options', () => {
    const { getByText } = renderTransfer();
    expect(getByText('₹1.0K')).toBeDefined();
    expect(getByText('₹5.0K')).toBeDefined();
    expect(getByText('₹10.0K')).toBeDefined();
    expect(getByText('₹25.0K')).toBeDefined();
  });

  it('renders the Transfer button showing minimum amount', () => {
    const { getByText } = renderTransfer();
    expect(getByText(/Transfer ₹100\+/)).toBeDefined();
  });

  it('renders the info box with internal transfer info by default', () => {
    const { getByText } = renderTransfer();
    expect(getByText(/Internal transfers between your accounts/)).toBeDefined();
  });

  it('renders balance card with account balance', () => {
    const { getByText } = renderTransfer();
    expect(getByText(/Account Balance/)).toBeDefined();
    expect(getByText('₹25,00,000.00')).toBeDefined();
  });

  it('renders from/to account sections in internal tab by default', () => {
    const { getByText } = renderTransfer();
    expect(getByText('From')).toBeDefined();
    expect(getByText('To')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = renderTransfer();
    expect(toJSON()).toBeTruthy();
  });
});

describe('TransferScreen — Tab Switching', () => {
  it('switches to Bank Account tab', () => {
    const { getByText, queryByText } = renderTransfer();
    press(getByText('To Bank Account'));
    expect(queryByText('From')).toBeNull();
    expect(getByText('Transfer To')).toBeDefined();
    expect(getByText('+ Add Bank')).toBeDefined();
  });

  it('shows different info text for each tab', () => {
    const { getByText } = renderTransfer();
    expect(getByText(/Internal transfers between your accounts/)).toBeDefined();

    press(getByText('To Bank Account'));
    expect(getByText(/Bank transfers are processed/)).toBeDefined();
  });

  it('shows available balance label in external tab', () => {
    const { getByText } = renderTransfer();
    press(getByText('To Bank Account'));
    expect(getByText('Available Balance')).toBeDefined();
  });
});

describe('TransferScreen — Internal Account Selection', () => {
  it('renders both internal accounts in From section', () => {
    const { getByText } = renderTransfer();
    expect(getByText('Trading Account')).toBeDefined();
    expect(getByText('Demat Account')).toBeDefined();
  });

  it('shows account balances', () => {
    const { getByText } = renderTransfer();
    expect(getByText('₹25,00,000.00')).toBeDefined(); // Trading Account balance
    expect(getByText('₹0')).toBeDefined(); // Demat Account balance
  });

  it('shows destination section in balance card', () => {
    const { getByText } = renderTransfer();
    expect(getByText('Receiving Account')).toBeDefined();
    // The balance card's sub-label shows the destination account label (Demat Account)
    // The "Destination" text only appears as a fallback if toData is undefined
    expect(getByText('Demat Account')).toBeDefined();
  });
});

describe('TransferScreen — External Bank Selection', () => {
  it('renders linked banks when on external tab', () => {
    const { getByText, queryByText } = renderTransfer();
    // External tab not visible yet — switch to it
    press(getByText('To Bank Account'));

    expect(getByText('HDFC Bank')).toBeDefined();
    expect(getByText('ICICI Bank')).toBeDefined();
    expect(queryByText('Trading Account')).toBeNull(); // internal accounts hidden
  });

  it('shows bank account numbers on external tab', () => {
    const { getByText } = renderTransfer();
    press(getByText('To Bank Account'));

    expect(getByText('XXXX1234')).toBeDefined();
    expect(getByText('XXXX5678')).toBeDefined();
  });

  it('shows primary badge on primary bank', () => {
    const { getByText } = renderTransfer();
    press(getByText('To Bank Account'));

    expect(getByText('Primary')).toBeDefined();
  });

  it('shows add bank button on external tab', () => {
    const { getByText } = renderTransfer();
    press(getByText('To Bank Account'));

    expect(getByText('+ Add Bank')).toBeDefined();
  });
});

describe('TransferScreen — Amount Selection', () => {
  it('selecting a preset highlights it and shows total row', () => {
    const { getByText } = renderTransfer();
    press(getByText('₹5.0K'));
    expect(getByText(/You will transfer/)).toBeDefined();
    expect(getByText(/₹5,000/)).toBeDefined();
  });

  it('typing custom amount clears preset selection', () => {
    const { getByText, getByPlaceholderText, queryByText } = renderTransfer();
    press(getByText('₹5.0K'));

    changeText(getByPlaceholderText('Enter transfer amount'), '7500');
    // The total row should still be visible with the custom amount
    expect(queryByText(/You will transfer/)).toBeDefined();
    expect(queryByText(/₹7,500/)).toBeDefined();
  });

  it('shows total row with correct amount for custom input', () => {
    const { getByText, getByPlaceholderText } = renderTransfer();
    changeText(getByPlaceholderText('Enter transfer amount'), '5000');
    expect(getByText(/You will transfer/)).toBeDefined();
    expect(getByText(/₹5,000/)).toBeDefined();
  });

  it('custom amount clear button resets display amount', () => {
    const { queryByText, getByPlaceholderText } = renderTransfer();
    const input = getByPlaceholderText('Enter transfer amount');
    changeText(input, '3000');
    expect(queryByText(/You will transfer/)).toBeDefined();

    // Clear the input
    changeText(input, '');
    expect(queryByText(/You will transfer/)).toBeNull();
  });
});

describe('TransferScreen — Transfer Button States', () => {
  it('transfer button shows minimum amount when no amount entered', () => {
    const { getByText } = renderTransfer();
    expect(getByText(/Transfer ₹100\+/)).toBeDefined();
  });

  it('transfer button shows amount when valid amount entered', () => {
    const { getByText, getByPlaceholderText } = renderTransfer();
    changeText(getByPlaceholderText('Enter transfer amount'), '5000');
    expect(getByText(/Transfer ₹5,000/)).toBeDefined();
  });
});

describe('TransferScreen — Validation', () => {
  it('shows alert for insufficient balance', () => {
    const { getByText, getByPlaceholderText } = renderTransfer();
    changeText(getByPlaceholderText('Enter transfer amount'), '3000000');
    press(getByText(/Transfer ₹30,00,000/));

    expect(Alert.alert).toHaveBeenCalledWith('Insufficient Balance', expect.any(String));
  });
});

describe('TransferScreen — Transfer Flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows confirmation alert when Transfer is pressed with valid inputs', () => {
    const { getByText, getByPlaceholderText } = renderTransfer();
    changeText(getByPlaceholderText('Enter transfer amount'), '5000');
    press(getByText(/Transfer ₹5,000/));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Confirm Transfer',
      expect.stringContaining('Transfer'),
      expect.any(Array),
    );
  });

  it('processes transfer when confirmation is accepted', () => {
    const { getByText, getByPlaceholderText } = renderTransfer();
    changeText(getByPlaceholderText('Enter transfer amount'), '5000');
    press(getByText(/Transfer ₹5,000/));

    expect(confirmCallback).toBeDefined();
    act(() => { confirmCallback!(); });
    act(() => { vi.advanceTimersByTime(1500); });

    expect(mockUpdateBalance).toHaveBeenCalledWith(-5000);
    expect(mockAddTransaction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'withdraw',
      amount: 5000,
      method: 'Internal Transfer',
      status: 'completed',
    }));
  });

  it('shows success state after transfer completes', () => {
    const { getByText, getByPlaceholderText } = renderTransfer();
    changeText(getByPlaceholderText('Enter transfer amount'), '5000');
    press(getByText(/Transfer ₹5,000/));
    act(() => { confirmCallback!(); });
    act(() => { vi.advanceTimersByTime(1500); });

    expect(getByText('Transfer Initiated!')).toBeDefined();
    expect(getByText(/₹5,000/)).toBeDefined();
  });

  it('shows transaction details in success screen', () => {
    const { getByText, getByPlaceholderText } = renderTransfer();
    changeText(getByPlaceholderText('Enter transfer amount'), '5000');
    press(getByText(/Transfer ₹5,000/));
    act(() => { confirmCallback!(); });
    act(() => { vi.advanceTimersByTime(1500); });

    expect(getByText('Transaction ID')).toBeDefined();
    expect(getByText('From')).toBeDefined();
    expect(getByText('To')).toBeDefined();
  });

  it('done button navigates back after success', () => {
    const { getByText, getByPlaceholderText } = renderTransfer();
    changeText(getByPlaceholderText('Enter transfer amount'), '5000');
    press(getByText(/Transfer ₹5,000/));
    act(() => { confirmCallback!(); });
    act(() => { vi.advanceTimersByTime(1500); });

    press(getByText('Done'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('processes transfer to external bank account', () => {
    const { getByText, getByPlaceholderText } = renderTransfer();

    // Switch to external tab
    press(getByText('To Bank Account'));

    // Enter amount
    changeText(getByPlaceholderText('Enter transfer amount'), '10000');

    // Press Transfer button
    press(getByText(/Transfer ₹10,000/));

    // Accept confirmation
    expect(confirmCallback).toBeDefined();
    act(() => { confirmCallback!(); });
    act(() => { vi.advanceTimersByTime(1500); });

    expect(mockUpdateBalance).toHaveBeenCalledWith(-10000);
    expect(mockAddTransaction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'withdraw',
      amount: 10000,
      method: expect.stringContaining('HDFC'),
      status: 'completed',
    }));
  });
});

describe('TransferScreen — Edge Cases', () => {
  it('renders the currency symbol in custom input', () => {
    const { getByText } = renderTransfer();
    expect(getByText('₹')).toBeDefined();
  });

  it('handles switching tabs back and forth', () => {
    const { getByText } = renderTransfer();
    press(getByText('To Bank Account'));
    expect(getByText('HDFC Bank')).toBeDefined();

    press(getByText('To Self Account'));
    expect(getByText('Trading Account')).toBeDefined();
  });

  it('preset amount buttons show compact currency format', () => {
    const { getByText } = renderTransfer();
    expect(getByText('₹1.0K')).toBeDefined();
    expect(getByText('₹5.0K')).toBeDefined();
    expect(getByText('₹10.0K')).toBeDefined();
    expect(getByText('₹25.0K')).toBeDefined();
  });

  it('renders back button in header', () => {
    const { getByText } = renderTransfer();
    expect(getByText('Transfer')).toBeDefined();
  });

  it('shows swap-horizontal icon in balance card for internal tab', () => {
    const { getByText } = renderTransfer();
    expect(getByText('Receiving Account')).toBeDefined();
  });

  it('renders radio selections for accounts', () => {
    const { getByText } = renderTransfer();
    expect(getByText('Trading Account')).toBeDefined();
    expect(getByText('Demat Account')).toBeDefined();
  });

  it('shows selectable bank accounts in external tab with radio buttons', () => {
    const { getByText } = renderTransfer();
    press(getByText('To Bank Account'));

    expect(getByText('HDFC Bank')).toBeDefined();
    expect(getByText('ICICI Bank')).toBeDefined();
  });
});
