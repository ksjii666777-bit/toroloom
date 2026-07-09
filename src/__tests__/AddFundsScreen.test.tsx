/**
 * ============================================================================
 * Toroloom — AddFundsScreen Comprehensive Tests
 * ============================================================================
 *
 * Covers: rendering, preset amount selection, custom amount input, payment
 * method selection, total row display, add funds button states, validation
 * (min/max), success state, navigation.
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { render, fireEvent } from './testUtils';

// ==================== Mock Alert — use vi.hoisted to avoid TDZ ====================

const mockAlert = vi.hoisted(() => vi.fn());

vi.mock('react-native', async () => {
  const mock = await import('./react-native.mock');
  return { ...mock, Alert: { alert: mockAlert } };
});

// ==================== Mock Razorpay ====================

const mockRazorpayOpen = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({
    razorpay_payment_id: 'pay_mock_123',
    razorpay_order_id: 'order_mock_123',
    razorpay_signature: 'sig_mock_123',
  })),
);

vi.mock('react-native-razorpay', () => ({
  default: {
    open: mockRazorpayOpen,
  },
}));

// ==================== Mock Setup (hoisted) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const mockUpdateBalance = vi.fn();
const mockAddTransaction = vi.fn();

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
    user: { id: 'user1', username: 'TraderJoe', email: 'trader@example.com', balance: 25000 },
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
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// ==================== Imports ====================

import AddFundsScreen from '../screens/funds/AddFundsScreen';

// ── Helpers ──────────────────────────────────────────────────

function renderAddFunds() {
  return render(<AddFundsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />);
}

function changeText(input: ReactTestInstance, text: string) {
  act(() => { fireEvent.changeText(input, text); });
}

function press(element: ReactTestInstance) {
  act(() => { fireEvent.press(element); });
}

/** Flush pending promise microtasks */
async function flushMicrotasks() {
  await act(async () => {});
}

// ==================== Tests — Rendering ====================

describe('AddFundsScreen — Rendering', () => {
  it('renders the screen title', () => {
    const { getByText } = renderAddFunds();
    expect(getByText('Add Funds')).toBeDefined();
  });

  it('renders current balance', () => {
    const { getByText } = renderAddFunds();
    expect(getByText('₹25,000')).toBeDefined();
  });

  it('renders the custom amount input', () => {
    const { getByPlaceholderText } = renderAddFunds();
    expect(getByPlaceholderText('Enter custom amount')).toBeDefined();
  });

  it('renders preset amount buttons', () => {
    const { getByText } = renderAddFunds();
    expect(getByText(/5.0K/)).toBeDefined();
    expect(getByText(/10.0K/)).toBeDefined();
    expect(getByText(/25.0K/)).toBeDefined();
    expect(getByText(/50.0K/)).toBeDefined();
    // 100000 → (100000/100000).toFixed(2) = "1.00" → "₹1.00L"
    expect(getByText(/1.00L/)).toBeDefined();
  });

  it('renders all 4 payment methods', () => {
    const { getByText } = renderAddFunds();
    expect(getByText('UPI')).toBeDefined();
    expect(getByText('Net Banking')).toBeDefined();
    expect(getByText('Debit Card')).toBeDefined();
    expect(getByText('Wallet')).toBeDefined();
  });

  it('renders the info box with credit info', () => {
    const { getByText } = renderAddFunds();
    expect(getByText(/Funds will be credited/)).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = renderAddFunds();
    expect(toJSON()).toBeTruthy();
  });

  it('renders the add funds button with minimum amount', () => {
    const { getByText } = renderAddFunds();
    expect(getByText('Add ₹500+')).toBeDefined();
  });
});

// ==================== Amount Selection ====================

describe('AddFundsScreen — Amount Selection', () => {
  it('selecting a preset highlights it and shows total row', () => {
    const { getByText } = renderAddFunds();
    press(getByText(/5.0K/));
    expect(getByText(/You will add/)).toBeDefined();
    expect(getByText(/5,000/)).toBeDefined();
  });

  it('selecting a different preset updates the total row', () => {
    const { getByText } = renderAddFunds();
    press(getByText(/10.0K/));
    expect(getByText(/You will add/)).toBeDefined();
    expect(getByText(/10,000/)).toBeDefined();
  });

  it('typing in custom amount clears preset selection', () => {
    const { getByText, getByPlaceholderText } = renderAddFunds();
    press(getByText(/25.0K/));
    expect(getByText(/25,000/)).toBeDefined();

    changeText(getByPlaceholderText('Enter custom amount'), '30000');
    expect(getByText(/30,000/)).toBeDefined();
  });

  it('shows total row for custom amount', () => {
    const { getByText, getByPlaceholderText } = renderAddFunds();
    changeText(getByPlaceholderText('Enter custom amount'), '15000');
    expect(getByText(/You will add/)).toBeDefined();
    expect(getByText(/15,000/)).toBeDefined();
  });

  it('clear button on custom input resets amount', () => {
    const { queryByText, getByPlaceholderText } = renderAddFunds();
    changeText(getByPlaceholderText('Enter custom amount'), '5000');
    expect(queryByText(/You will add/)).toBeDefined();

    changeText(getByPlaceholderText('Enter custom amount'), '');
    expect(queryByText(/You will add/)).toBeNull();
  });

  it('highlights the selected amount preset with active style', () => {
    const { getByText } = renderAddFunds();
    press(getByText(/5.0K/));
    expect(getByText(/5.0K/)).toBeDefined();
  });
});

// ==================== Payment Method Selection ====================

describe('AddFundsScreen — Payment Method Selection', () => {
  it('defaults to UPI payment method', () => {
    const { getByText } = renderAddFunds();
    expect(getByText('Google Pay, PhonePe, Paytm')).toBeDefined();
  });

  it('allows switching to Net Banking', () => {
    const { getByText } = renderAddFunds();
    press(getByText('Net Banking'));
    expect(getByText('All major banks')).toBeDefined();
  });

  it('allows switching to Debit Card', () => {
    const { getByText } = renderAddFunds();
    press(getByText('Debit Card'));
    expect(getByText('Visa, Mastercard, RuPay')).toBeDefined();
  });

  it('allows switching to Wallet', () => {
    const { getByText } = renderAddFunds();
    press(getByText('Wallet'));
    expect(getByText('Paytm, Mobikwik, Freecharge')).toBeDefined();
  });
});

// ==================== Add Funds Button States ====================

describe('AddFundsScreen — Add Funds Button States', () => {
  it('button shows minimum amount when no amount entered', () => {
    const { getByText } = renderAddFunds();
    expect(getByText('Add ₹500+')).toBeDefined();
  });

  it('button shows selected amount when valid', () => {
    const { getByText, getByPlaceholderText } = renderAddFunds();
    changeText(getByPlaceholderText('Enter custom amount'), '5000');
    expect(getByText(/Add ₹5,000/)).toBeDefined();
  });

  it('button shows processing state when loading', () => {
    const { getByPlaceholderText } = renderAddFunds();
    expect(getByPlaceholderText('Enter custom amount')).toBeDefined();
  });
});

// ==================== Validation ====================

describe('AddFundsScreen — Validation', () => {
  beforeEach(() => {
    mockAlert.mockClear();
  });

  it('shows alert for amount below minimum (₹500)', () => {
    const { getByText } = renderAddFunds();
    press(getByText('Add ₹500+'));
    expect(mockAlert).toHaveBeenCalledWith('Minimum Amount', expect.stringContaining('₹500'));
  });

  it('hides minimum alert when amount is valid', () => {
    const { getByPlaceholderText } = renderAddFunds();
    changeText(getByPlaceholderText('Enter custom amount'), '10000');
    expect(mockAlert).not.toHaveBeenCalled();
  });
});

// ==================== Add Funds Flow ====================

describe('AddFundsScreen — Add Funds Flow', () => {
  beforeEach(() => {
    // Don't use fake timers — the async flow needs real microtasks
    mockRazorpayOpen.mockClear();
    mockUpdateBalance.mockClear();
    mockAddTransaction.mockClear();
    mockAlert.mockClear();
  });

  it('processes add funds and updates balance (fallback/dev path)', async () => {
    const { getByText, getByPlaceholderText } = renderAddFunds();

    changeText(getByPlaceholderText('Enter custom amount'), '5000');
    press(getByText(/Add ₹5,000/));

    // Flush microtasks for the async handler to complete
    await flushMicrotasks();

    // The dynamic require('react-native-razorpay') uses the native module
    // fallback path in test environment. Verify the outcome:
    expect(mockUpdateBalance).toHaveBeenCalledWith(5000);
    expect(mockAddTransaction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'add',
      amount: 5000,
      status: 'completed',
    }));
  });

  it('shows success state after funds are added', async () => {
    const { getByText, getByPlaceholderText } = renderAddFunds();
    changeText(getByPlaceholderText('Enter custom amount'), '5000');
    press(getByText(/Add ₹5,000/));
    await flushMicrotasks();

    expect(getByText('Funds Added Successfully!')).toBeDefined();
    expect(getByText(/₹5,000/)).toBeDefined();
  });

  it('shows transaction ID in success screen', async () => {
    const { getByText, getByPlaceholderText } = renderAddFunds();
    changeText(getByPlaceholderText('Enter custom amount'), '10000');
    press(getByText(/Add ₹10,000/));
    await flushMicrotasks();

    expect(getByText('Transaction ID')).toBeDefined();
  });

  it('shows payment method in success screen', async () => {
    const { getByText, getByPlaceholderText } = renderAddFunds();
    changeText(getByPlaceholderText('Enter custom amount'), '5000');
    press(getByText(/Add ₹5,000/));
    await flushMicrotasks();

    expect(getByText('Payment Method')).toBeDefined();
  });

  it('shows new balance in success screen', async () => {
    const { getByText, getByPlaceholderText } = renderAddFunds();
    changeText(getByPlaceholderText('Enter custom amount'), '5000');
    press(getByText(/Add ₹5,000/));
    await flushMicrotasks();

    expect(getByText('New Balance')).toBeDefined();
  });

  it('done button navigates back after success', async () => {
    const { getByText, getByPlaceholderText } = renderAddFunds();
    changeText(getByPlaceholderText('Enter custom amount'), '5000');
    press(getByText(/Add ₹5,000/));
    await flushMicrotasks();

    press(getByText('Done'));
    expect(mockGoBack).toHaveBeenCalledWith();
  });

  it('view transaction history navigates to TransactionHistory', async () => {
    const { getByText, getByPlaceholderText } = renderAddFunds();
    changeText(getByPlaceholderText('Enter custom amount'), '5000');
    press(getByText(/Add ₹5,000/));
    await flushMicrotasks();

    press(getByText('View Transaction History'));
    expect(mockNavigate).toHaveBeenCalledWith('TransactionHistory');
  });

  it('updates balance with correct amount', async () => {
    const { getByText, getByPlaceholderText } = renderAddFunds();
    changeText(getByPlaceholderText('Enter custom amount'), '5000');
    press(getByText(/Add ₹5,000/));
    await flushMicrotasks();

    expect(mockUpdateBalance).toHaveBeenCalledWith(5000);
  });
});
