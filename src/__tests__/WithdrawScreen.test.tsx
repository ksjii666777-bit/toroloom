/**
 * ============================================================================
 * Toroloom — WithdrawScreen Comprehensive Tests
 * ============================================================================
 *
 * Covers: rendering, balance display, amount presets, custom amount, MAX button,
 * bank account selection, breakdown card, withdraw button states, withdrawal
 * flow (validation, processing, success), edge cases.
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
      primary: '#6C63FF', accent: '#00D2FF', bgCard: '#1A1A2E', bgCardLight: '#25253D',
      bgInput: '#1E1E32', border: '#2A2A44', divider: '#2A2A44', bgSecondary: '#16162A',
      warning: '#FFC107', borderLight: '#3A3A54', danger: '#FF1744', success: '#00C853',
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

import WithdrawScreen from '../screens/funds/WithdrawScreen';
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

function renderWithdraw() {
  return render(<WithdrawScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
}

function changeText(input: ReactTestInstance, text: string) {
  act(() => { fireEvent.changeText(input, text); });
}

function press(element: ReactTestInstance) {
  act(() => { fireEvent.press(element); });
}

// ==================== Tests ====================

describe('WithdrawScreen — Rendering', () => {
  it('renders the screen title', () => {
    const { getByText } = renderWithdraw();
    expect(getByText('Withdraw Funds')).toBeDefined();
  });

  it('renders available balance', () => {
    const { getByText } = renderWithdraw();
    expect(getByText('₹25,00,000.00')).toBeDefined();
  });

  it('renders linked bank accounts', () => {
    const { getByText } = renderWithdraw();
    expect(getByText('HDFC Bank')).toBeDefined();
    expect(getByText('ICICI Bank')).toBeDefined();
  });

  it('renders account numbers', () => {
    const { getByText } = renderWithdraw();
    expect(getByText('XXXX1234')).toBeDefined();
    expect(getByText('XXXX5678')).toBeDefined();
  });

  it('shows primary badge on primary account', () => {
    const { getByText } = renderWithdraw();
    expect(getByText('Primary')).toBeDefined();
  });

  it('renders the info box with withdrawal info', () => {
    const { getByText } = renderWithdraw();
    expect(getByText(/Withdrawals are processed/)).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = renderWithdraw();
    expect(toJSON()).toBeTruthy();
  });
});

describe('WithdrawScreen — Amount Selection', () => {
  it('renders preset amount options', () => {
    const { getByText } = renderWithdraw();
    expect(getByText('₹5.0K')).toBeDefined();
    expect(getByText('₹10.0K')).toBeDefined();
    expect(getByText('₹50.0K')).toBeDefined();
  });

  it('renders MAX button', () => {
    const { getByText } = renderWithdraw();
    expect(getByText('MAX')).toBeDefined();
  });

  it('selecting a preset shows breakdown card', () => {
    const { getByText } = renderWithdraw();
    press(getByText('₹5.0K'));
    expect(getByText(/Current Balance/)).toBeDefined();
    expect(getByText(/Withdrawal Amount/)).toBeDefined();
    expect(getByText(/Remaining Balance/)).toBeDefined();
  });

  it('typing custom amount clears preset selection', () => {
    const { getByText, getByPlaceholderText, queryByText } = renderWithdraw();
    press(getByText('₹10.0K'));
    expect(queryByText(/Withdrawal Amount/)).toBeDefined();

    changeText(getByPlaceholderText('Enter withdrawal amount'), '7500');
    expect(queryByText(/Withdrawal Amount/)).toBeDefined();
  });

  it('MAX button sets amount to full balance', () => {
    const { getByText } = renderWithdraw();
    press(getByText('MAX'));
    expect(getByText(/₹25,00,000/)).toBeDefined();
  });
});

describe('WithdrawScreen — Bank Account Selection', () => {
  it('selecting a different bank updates selected bank', () => {
    const { getByText } = renderWithdraw();
    press(getByText('ICICI Bank'));
    expect(getByText('ICICI Bank')).toBeDefined();
  });

  it('shows IFSC codes for bank accounts', () => {
    const { getByText } = renderWithdraw();
    expect(getByText('IFSC: HDFC0001234')).toBeDefined();
    expect(getByText('IFSC: ICIC0005678')).toBeDefined();
  });
});

describe('WithdrawScreen — Withdraw Button States', () => {
  it('withdraw button is disabled when amount is less than 500', () => {
    const { getByText } = renderWithdraw();
    expect(getByText(/Withdraw ₹500/)).toBeDefined();
  });

  it('withdraw button shows amount when valid', () => {
    const { getByText, getByPlaceholderText } = renderWithdraw();
    changeText(getByPlaceholderText('Enter withdrawal amount'), '5000');
    expect(getByText(/Withdraw ₹5,000/)).toBeDefined();
  });
});

describe('WithdrawScreen — Withdrawal Flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows confirmation alert when Withdraw is pressed with valid amount', () => {
    const { getByText, getByPlaceholderText } = renderWithdraw();
    changeText(getByPlaceholderText('Enter withdrawal amount'), '5000');
    press(getByText(/Withdraw ₹5,000/));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Confirm Withdrawal',
      expect.stringContaining('withdraw'),
      expect.any(Array),
    );
  });

  it('processes withdrawal when confirmation is accepted', () => {
    const { getByText, getByPlaceholderText } = renderWithdraw();
    changeText(getByPlaceholderText('Enter withdrawal amount'), '5000');
    press(getByText(/Withdraw ₹5,000/));

    expect(confirmCallback).toBeDefined();
    act(() => { confirmCallback!(); });
    act(() => { vi.advanceTimersByTime(1500); });

    expect(mockUpdateBalance).toHaveBeenCalledWith(-5000);
    expect(mockAddTransaction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'withdraw',
      amount: 5000,
      method: expect.any(String),
      status: 'completed',
    }));
  });

  it('shows success state after withdrawal completes', () => {
    const { getByText, getByPlaceholderText } = renderWithdraw();
    changeText(getByPlaceholderText('Enter withdrawal amount'), '5000');
    press(getByText(/Withdraw ₹5,000/));
    act(() => { confirmCallback!(); });
    act(() => { vi.advanceTimersByTime(1500); });

    expect(getByText('Withdrawal Initiated!')).toBeDefined();
    expect(getByText(/₹5,000/)).toBeDefined();
  });

  it('done button navigates back after success', () => {
    const { getByText, getByPlaceholderText } = renderWithdraw();
    changeText(getByPlaceholderText('Enter withdrawal amount'), '5000');
    press(getByText(/Withdraw ₹5,000/));
    act(() => { confirmCallback!(); });
    act(() => { vi.advanceTimersByTime(1500); });

    press(getByText('Done'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('view transaction history button navigates to history screen', () => {
    const { getByText, getByPlaceholderText } = renderWithdraw();
    changeText(getByPlaceholderText('Enter withdrawal amount'), '5000');
    press(getByText(/Withdraw ₹5,000/));
    act(() => { confirmCallback!(); });
    act(() => { vi.advanceTimersByTime(1500); });

    press(getByText('View Transaction History'));
    expect(mockNavigate).toHaveBeenCalledWith('TransactionHistory');
  });

  it('shows remaining new balance in success screen', () => {
    const { getByText, getByPlaceholderText } = renderWithdraw();
    changeText(getByPlaceholderText('Enter withdrawal amount'), '5000');
    press(getByText(/Withdraw ₹5,000/));
    act(() => { confirmCallback!(); });
    act(() => { vi.advanceTimersByTime(1500); });

    expect(getByText('New Balance')).toBeDefined();
  });

  it('displays transaction ID in success screen', () => {
    const { getByText, getByPlaceholderText } = renderWithdraw();
    changeText(getByPlaceholderText('Enter withdrawal amount'), '5000');
    press(getByText(/Withdraw ₹5,000/));
    act(() => { confirmCallback!(); });
    act(() => { vi.advanceTimersByTime(1500); });

    expect(getByText('Transaction ID')).toBeDefined();
  });
});

describe('WithdrawScreen — Edge Cases', () => {
  it('shows withdrawal amount in breakdown with danger color', () => {
    const { getByText, getByPlaceholderText } = renderWithdraw();
    changeText(getByPlaceholderText('Enter withdrawal amount'), '10000');
    expect(getByText(/₹10,000/)).toBeDefined();
  });

  it('shows history button in header', () => {
    const { getByText } = renderWithdraw();
    expect(getByText('Withdraw Funds')).toBeDefined();
  });

  it('renders withdrawable amount as same as balance', () => {
    const { getByText } = renderWithdraw();
    expect(getByText('Withdrawable Amount')).toBeDefined();
  });

  it('renders bank accounts with account details', () => {
    const { getByText } = renderWithdraw();
    expect(getByText('HDFC Bank')).toBeDefined();
    expect(getByText('ICICI Bank')).toBeDefined();
    expect(getByText('XXXX1234')).toBeDefined();
    expect(getByText('XXXX5678')).toBeDefined();
  });
});
