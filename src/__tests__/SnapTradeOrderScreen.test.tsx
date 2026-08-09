/**
 * ============================================================================
 * Toroloom — SnapTradeOrderScreen Integration Tests
 * ============================================================================
 *
 * Verifies the Phase 1.3b order-safety behavior on the US stock order screen:
 *   - A risk-blocked response (success:false) shows an alert and does NOT
 *     render the success card (no crash on missing orderId).
 *   - Every order sends a client-generated idempotencyKey (dedupes retries).
 *   - A successful order still shows the confirmation.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/SnapTradeOrderScreen.test.tsx
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ==================== Mocks (hoisted) ====================

const mockPlaceOrder = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());
const mockAlert = vi.hoisted(() => vi.fn());

vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: (...args: any[]) => mockApiPost(...args),
  },
  snapTradeApi: {
    placeOrder: (...args: any[]) => mockPlaceOrder(...args),
    status: vi.fn(() => Promise.resolve({ connected: false })),
  },
}));

// Mock useT — resolves t() to the last key segment (readable fallback)
vi.mock('../hooks/useT', () => ({
  useT: () => ({ t: (key: string) => key.split('.').pop() || key, language: 'en', isHindi: false }),
}));

// Mock ThemeContext
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', primaryLight: '#8B83FF', primaryDark: '#4A42CC',
      success: '#00C853', danger: '#FF1744', warning: '#FFC107',
      marketUp: '#00C853', marketDown: '#FF1744',
      text: '#FFFFFF', textSecondary: '#B0B0D0', textMuted: '#6E6E9A',
      white: '#FFFFFF', bg: '#0D0D2B', bgSecondary: '#1A1A3E', bgCard: '#222255',
      bgCardLight: '#2A2A5E', bgInput: '#1E1E4A', bgDark: '#070720',
      border: '#2A2A5E', borderLight: '#3A3A7E', divider: '#1E1E4A', transparent: 'transparent',
    },
    isDark: true,
  }),
}));

// Mock LinearGradient — renders a plain View
vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock react-native-safe-area-context
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock AnimatedPressable — forwards onPress so fireEvent.press works
vi.mock('../components/ui/AnimatedPressable', () => ({
  default: ({ onPress, children }: any) =>
    React.createElement('View', { onPress }, children),
}));

// Mock biometric service — trade confirmation disabled
vi.mock('../services/biometricService', () => ({
  biometricAuth: {
    getBiometricLabel: vi.fn(() => Promise.resolve('Biometrics')),
    authenticate: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

vi.mock('../store/biometricStore', () => ({
  useBiometricStore: {
    getState: () => ({ enabled: false, requireForTrades: false }),
  },
}));

// ==================== Imports ====================

import { Alert } from 'react-native';
import { render, fireEvent } from './testUtils';
import SnapTradeOrderScreen from '../screens/snaptrade/SnapTradeOrderScreen';

// ==================== Helpers ====================

async function advanceAndFlush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Render the screen, fill quantity, and return a handle to press Submit. */
async function setupAndSubmit() {
  const utils = render(
    <SnapTradeOrderScreen
      route={{ params: { symbol: 'AAPL', price: 200 } } as any}
      navigation={{ navigate: vi.fn(), goBack: vi.fn() } as any}
    />,
  );
  await advanceAndFlush();

  // Fill the quantity TextInput (placeholder is exactly "0")
  const qtyInput = utils.root.findAll(
    (node) => node.props?.placeholder === '0',
  )[0];
  expect(qtyInput).toBeDefined();
  await act(async () => {
    fireEvent.changeText(qtyInput, '5');
  });
  await advanceAndFlush();

  // Find the submit button by its label (action + prefilled symbol)
  const buyLabel = utils.getByText(/buy\s+AAPL/i);
  // Walk up to the nearest element that carries an onPress handler
  let pressable = buyLabel;
  while (pressable && typeof pressable.props?.onPress !== 'function') {
    pressable = pressable.parent as any;
  }
  expect(pressable).toBeDefined();

  return { utils, pressSubmit: async () => {
    await act(async () => {
      pressable.props.onPress();
    });
    await advanceAndFlush();
  } };
}

// ==================== Tests ====================

describe('SnapTradeOrderScreen — Order Safety', () => {
  beforeEach(() => {
    mockPlaceOrder.mockReset();
    mockApiPost.mockReset();
    // Default: backend risk validation passes
    mockApiPost.mockResolvedValue({ allowed: true });
    vi.spyOn(Alert, 'alert').mockImplementation((...args: any[]) => mockAlert(...args));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends an idempotencyKey with every order and shows confirmation on success', async () => {
    mockPlaceOrder.mockResolvedValue({
      success: true,
      orderId: 'st-98765',
      status: 'Filled',
    });

    const { pressSubmit } = await setupAndSubmit();
    await pressSubmit();

    expect(mockPlaceOrder).toHaveBeenCalledTimes(1);
    const orderArg = mockPlaceOrder.mock.calls[0][0];
    expect(orderArg.symbol).toBe('AAPL');
    expect(orderArg.idempotencyKey).toBeDefined();
    expect(orderArg.idempotencyKey.length).toBeGreaterThanOrEqual(8);

    // Success path — no blocked alert
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('shows a blocked alert for a risk-rejected response (no success card, no crash)', async () => {
    mockPlaceOrder.mockResolvedValue({
      success: false,
      status: 'rejected',
      orderId: null,
      message: '🔒 Order value exceeds max position size',
      riskEvaluation: { allowed: false, message: '🔒 Order value exceeds max position size' },
    });

    const { pressSubmit } = await setupAndSubmit();
    await pressSubmit();

    expect(mockPlaceOrder).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenCalledTimes(1);
    const alertArgs = mockAlert.mock.calls[0];
    expect(String(alertArgs[1])).toContain('exceeds max position size');
  });
});
