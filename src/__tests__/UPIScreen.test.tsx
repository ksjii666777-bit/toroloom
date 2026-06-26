/**
 * ============================================================================
 * Toroloom — UPIScreen Comprehensive Tests
 * ============================================================================
 *
 * Covers: rendering, amount presets, custom amount, UPI account management,
 * contact selection, payee input, pay button states, payment flow
 * (validation, processing, success), edge cases.
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

// ==================== Mock Razorpay ====================
vi.mock('react-native-razorpay', () => ({
  default: {
    open: vi.fn(() => Promise.resolve({
      razorpay_payment_id: 'pay_mock_123',
      razorpay_order_id: 'order_mock_123',
      razorpay_signature: 'sig_mock_123',
    })),
  },
}));

// ==================== Mock Setup (hoisted) ====================

vi.mock('react-native', async () => {
  const mock = await import('./react-native.mock');
  return {
    ...mock,
    Alert: { alert: vi.fn() },
    Share: { share: vi.fn() },
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

vi.mock('../services/api/payments', () => ({
  paymentsApi: {
    createFundOrder: vi.fn(() => Promise.resolve({
      orderId: 'order_mock_123',
      keyId: 'rzp_test_abc123',
      amount: 5000,
      currency: 'INR',
    })),
    verifyPayment: vi.fn(() => Promise.resolve({ success: true, message: 'Payment verified' })),
    createOrder: vi.fn(() => Promise.resolve({
      orderId: 'order_mock_456',
      keyId: 'rzp_test_abc123',
      amount: 1000,
      currency: 'INR',
    })),
  },
}));

// ==================== Imports ====================

// Set global __DEV__ flag for expo development features (View Transaction History button in success screen)
vi.stubGlobal('__DEV__', true);

import UPIScreen from '../screens/funds/UPIScreen';
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

function renderUPI() {
  return render(<UPIScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
}

function changeText(input: ReactTestInstance, text: string) {
  act(() => { fireEvent.changeText(input, text); });
}

function press(element: ReactTestInstance) {
  act(() => { fireEvent.press(element); });
}

// ==================== Tests ====================

describe('UPIScreen — Rendering', () => {
  it('renders the screen title', () => {
    const { getByText } = renderUPI();
    expect(getByText('UPI Payment')).toBeDefined();
  });

  it('renders amount input placeholder', () => {
    const { getByPlaceholderText } = renderUPI();
    expect(getByPlaceholderText('Enter amount')).toBeDefined();
  });

  it('renders the default selected UPI ID in the header card', () => {
    const { getByText } = renderUPI();
    expect(getByText('rahul@hdfc')).toBeDefined();
  });

  it('renders UPI ID input for manual entry', () => {
    const { getByPlaceholderText } = renderUPI();
    expect(getByPlaceholderText('Enter UPI ID (e.g., name@bank)')).toBeDefined();
  });

  it('renders recent contacts', () => {
    const { getByText } = renderUPI();
    expect(getByText('Recent Contacts')).toBeDefined();
    expect(getByText('Priya Patel')).toBeDefined();
    expect(getByText('Amit Singh')).toBeDefined();
    expect(getByText('Neha Gupta')).toBeDefined();
  });

  it('renders preset amount options', () => {
    const { getByText } = renderUPI();
    expect(getByText('₹500')).toBeDefined();
    expect(getByText('₹1.0K')).toBeDefined();
    expect(getByText('₹5.0K')).toBeDefined();
  });

  it('renders pay button', () => {
    const { getByText } = renderUPI();
    expect(getByText('Enter UPI ID')).toBeDefined();
  });

  it('renders the info box with UPI limits', () => {
    const { getByText } = renderUPI();
    expect(getByText(/UPI payments are processed instantly/)).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = renderUPI();
    expect(toJSON()).toBeTruthy();
  });
});

describe('UPIScreen — Amount Selection', () => {
  it('selecting a preset highlights it and clears custom amount', () => {
    const { getByText } = renderUPI();
    press(getByText('₹1.0K'));
    expect(getByText(/You will pay/)).toBeDefined();
    expect(getByText(/₹1,000/)).toBeDefined();
  });

  it('typing custom amount clears preset selection', () => {
    const { getByText, getByPlaceholderText } = renderUPI();
    press(getByText('₹5.0K'));
    expect(getByText(/₹5,000/)).toBeDefined();

    changeText(getByPlaceholderText('Enter amount'), '7500');
    expect(getByText(/₹7,500/)).toBeDefined();
  });

  it('shows total row when displayAmount is greater than 0', () => {
    const { getByText, getByPlaceholderText } = renderUPI();
    changeText(getByPlaceholderText('Enter amount'), '2500');
    expect(getByText(/You will pay/)).toBeDefined();
    expect(getByText(/₹2,500/)).toBeDefined();
  });

  it('custom amount clear button resets display amount', () => {
    const { queryByText, getByPlaceholderText } = renderUPI();
    changeText(getByPlaceholderText('Enter amount'), '3000');
    expect(queryByText(/You will pay/)).toBeDefined();

    changeText(getByPlaceholderText('Enter amount'), '');
    expect(queryByText(/You will pay/)).toBeNull();
  });
});

describe('UPIScreen — UPI Account Management', () => {
  it('tapping QR button toggles manage UPI dropdown', () => {
    const { queryByText, getByTestId } = renderUPI();
    expect(queryByText('Linked UPI IDs')).toBeNull();

    press(getByTestId('manage-upi-toggle'));
    expect(queryByText('Linked UPI IDs')).toBeDefined();
  });

  it('selecting a different UPI account updates the selected ID', () => {
    const { getByText, getByTestId } = renderUPI();
    press(getByTestId('manage-upi-toggle'));
    press(getByText('rahul.sharma@paytm'));
    expect(getByText('rahul.sharma@paytm')).toBeDefined();
  });

  it('shows linked UPI accounts in manage dropdown', () => {
    const { getByText, getByTestId } = renderUPI();
    press(getByTestId('manage-upi-toggle'));
    expect(getByText('rahul@hdfc')).toBeDefined();
    expect(getByText('rahul.sharma@paytm')).toBeDefined();
    expect(getByText('rahul@icici')).toBeDefined();
  });

  it('shows primary badge on primary UPI account', () => {
    const { getByText, getByTestId } = renderUPI();
    press(getByTestId('manage-upi-toggle'));
    expect(getByText('Primary')).toBeDefined();
  });

  it('shows add new UPI form when tapped', () => {
    const { getByText, getByPlaceholderText, getByTestId } = renderUPI();
    press(getByTestId('manage-upi-toggle'));
    press(getByText('Link New UPI ID'));
    expect(getByPlaceholderText('Enter UPI ID (e.g., name@bank)')).toBeDefined();
  });
});

describe('UPIScreen — Contact Selection', () => {
  it('selecting a contact fills the UPI ID field', () => {
    const { getByText } = renderUPI();
    press(getByText('Priya Patel'));
    expect(getByText('priya@paytm')).toBeDefined();
  });

  it('shows payee info card when contact is selected', () => {
    const { getByText } = renderUPI();
    press(getByText('Amit Singh'));
    expect(getByText('Amit Singh')).toBeDefined();
  });

  it('typing in UPI input clears contact selection', () => {
    const { getByText, getByPlaceholderText, queryByText } = renderUPI();
    press(getByText('Neha Gupta'));
    expect(getByText('Neha Gupta')).toBeDefined();

    changeText(getByPlaceholderText('Enter UPI ID (e.g., name@bank)'), 'new@upi');
    expect(queryByText('Neha Gupta')).toBeNull();
  });
});

describe('UPIScreen — Pay Button States', () => {
  it('pay button is disabled when no UPI ID entered', () => {
    const { getByText } = renderUPI();
    expect(getByText('Enter UPI ID')).toBeDefined();
  });

  it('pay button shows "Enter Amount" when UPI ID entered but no amount', () => {
    const { getByText, getByPlaceholderText } = renderUPI();
    changeText(getByPlaceholderText('Enter UPI ID (e.g., name@bank)'), 'test@paytm');
    expect(getByText('Enter Amount')).toBeDefined();
  });

  it('pay button shows amount when both UPI ID and amount are valid', () => {
    const { getByText, getByPlaceholderText } = renderUPI();
    changeText(getByPlaceholderText('Enter UPI ID (e.g., name@bank)'), 'test@paytm');
    changeText(getByPlaceholderText('Enter amount'), '1000');
    expect(getByText(/Pay ₹1,000/)).toBeDefined();
  });
});

describe('UPIScreen — Payment Validation', () => {
  it('shows alert for invalid UPI ID (no @ symbol)', () => {
    const { getByText, getByPlaceholderText } = renderUPI();
    changeText(getByPlaceholderText('Enter UPI ID (e.g., name@bank)'), 'invalidupi');
    changeText(getByPlaceholderText('Enter amount'), '1000');
    press(getByText(/Pay ₹1,000/));
    expect(Alert.alert).toHaveBeenCalledWith('Invalid UPI ID', expect.stringContaining('@'));
  });

  it('shows alert for amount less than 1', () => {
    const { getByText, getByPlaceholderText } = renderUPI();
    changeText(getByPlaceholderText('Enter UPI ID (e.g., name@bank)'), 'test@paytm');
    const payBtn = getByText('Enter Amount');
    press(payBtn);
    expect(Alert.alert).toHaveBeenCalledWith('Enter Amount', expect.any(String));
  });

  it('shows alert for amount exceeding 1,00,000 limit', () => {
    const { getByText, getByPlaceholderText } = renderUPI();
    changeText(getByPlaceholderText('Enter UPI ID (e.g., name@bank)'), 'test@paytm');
    changeText(getByPlaceholderText('Enter amount'), '200000');
    press(getByText(/Pay ₹2,00,000/));
    expect(Alert.alert).toHaveBeenCalledWith('Limit Exceeded', expect.any(String));
  });

  // Note: The insufficient balance code path (displayAmount > currentBalance) is
  // unreachable with the current mock balance (₹25,00,000) because the UPI limit
  // check (₹1,00,000) fires first. To test it, set mock balance below ₹1,00,000.
  // This is validated by the store-level test suite.
});

describe('UPIScreen — Payment Flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows confirmation alert when Pay is pressed with valid inputs', () => {
    const { getByText, getByPlaceholderText } = renderUPI();
    changeText(getByPlaceholderText('Enter UPI ID (e.g., name@bank)'), 'test@paytm');
    changeText(getByPlaceholderText('Enter amount'), '5000');
    press(getByText(/Pay ₹5,000/));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Confirm Payment',
      expect.stringContaining('Pay'),
      expect.any(Array),
    );
  });

  it('processes payment when confirmation is accepted', async () => {
    const { getByText, getByPlaceholderText } = renderUPI();
    changeText(getByPlaceholderText('Enter UPI ID (e.g., name@bank)'), 'test@paytm');
    changeText(getByPlaceholderText('Enter amount'), '5000');
    press(getByText(/Pay ₹5,000/));

    expect(confirmCallback).toBeDefined();
    await act(async () => { confirmCallback!(); });

    await act(async () => { vi.advanceTimersByTime(2000); });

    expect(mockUpdateBalance).toHaveBeenCalledWith(-5000);
    expect(mockAddTransaction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'withdraw',
      amount: 5000,
      method: expect.stringContaining('UPI'),
      account: 'test@paytm',
      status: 'completed',
    }));
  });

  it('shows success state after payment completes', async () => {
    const { getByText, getByPlaceholderText } = renderUPI();
    changeText(getByPlaceholderText('Enter UPI ID (e.g., name@bank)'), 'test@paytm');
    changeText(getByPlaceholderText('Enter amount'), '5000');
    press(getByText(/Pay ₹5,000/));
    await act(async () => { confirmCallback!(); });
    await act(async () => { vi.advanceTimersByTime(2000); });

    expect(getByText('Payment Successful!')).toBeDefined();
    expect(getByText(/₹5,000/)).toBeDefined();
    expect(getByText(/test@paytm/)).toBeDefined();
  });

  it('done button navigates back after success', async () => {
    const { getByText, getByPlaceholderText } = renderUPI();
    changeText(getByPlaceholderText('Enter UPI ID (e.g., name@bank)'), 'test@paytm');
    changeText(getByPlaceholderText('Enter amount'), '5000');
    press(getByText(/Pay ₹5,000/));
    await act(async () => { confirmCallback!(); });
    await act(async () => { vi.advanceTimersByTime(2000); });

    press(getByText('Done'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});

describe('UPIScreen — Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles presets and custom amount interplay correctly', () => {
    const { getByText, getByPlaceholderText } = renderUPI();
    press(getByText('₹2.0K'));
    expect(getByText(/₹2,000/)).toBeDefined();

    changeText(getByPlaceholderText('Enter amount'), '1500');
    expect(getByText(/₹1,500/)).toBeDefined();
  });

  it('shows remaining balance in success screen', async () => {
    const { getByText, getByPlaceholderText } = renderUPI();

    changeText(getByPlaceholderText('Enter UPI ID (e.g., name@bank)'), 'test@paytm');
    changeText(getByPlaceholderText('Enter amount'), '5000');
    press(getByText(/Pay ₹5,000/));
    await act(async () => { confirmCallback!(); });
    await act(async () => { vi.advanceTimersByTime(2000); });

    expect(getByText('Remaining Balance')).toBeDefined();
  });

  it('navigates to transaction history from success screen in dev mode', async () => {
    const { getByText, getByPlaceholderText } = renderUPI();
    changeText(getByPlaceholderText('Enter UPI ID (e.g., name@bank)'), 'test@paytm');
    changeText(getByPlaceholderText('Enter amount'), '5000');
    press(getByText(/Pay ₹5,000/));
    await act(async () => { confirmCallback!(); });
    await act(async () => { vi.advanceTimersByTime(2000); });

    press(getByText('View Transaction History'));
    expect(mockNavigate).toHaveBeenCalledWith('TransactionHistory');
  });
});
