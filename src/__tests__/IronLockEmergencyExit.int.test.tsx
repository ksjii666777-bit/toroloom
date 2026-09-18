/**
 * ============================================================================
 * Toroloom — Iron Lock Emergency Exit Integration Test
 * ============================================================================
 *
 * End-to-end flow through the real component + real emergencyExitService,
 * with only the broker API layer (snaptradeApi) mocked:
 *
 *   1. Overlay renders nothing without lockdown
 *   2. Lockdown activates → overlay shows the EMERGENCY EXIT ALL button
 *   3. Press → confirmation Alert with MARKET SELL warning
 *   4. Confirm → real service fetches positions & places market SELL orders
 *      through the mocked broker API → result Alert summarises the exit
 *   5. Partial failure → 'Partial Exit' alert listing the failed symbol
 *   6. Broker unreachable → 'Partial Exit' alert with retry guidance
 *   7. Already flat → 'already flat' alert, no orders placed
 *   8. Cancel → no orders placed, no result alert
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Alert } from 'react-native';

// ── Hoisted store mocks ────────────────────────────────────────────────────
const { mockUseRiskStore, mockUseVoiceStore } = vi.hoisted(() => ({
  mockUseRiskStore: vi.fn(),
  mockUseVoiceStore: vi.fn(function (selector: any) {
    const state = { speak: vi.fn(), enabled: true };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

// Icon mock renders the icon name as text so we can assert on it
vi.mock('@expo/vector-icons', () => {
  const React = require('react');
  const IconComponent = function (props: any) {
    return React.createElement('Text', null, props.name || '');
  };
  return { Ionicons: IconComponent };
});

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6', text: '#FFFFFF', textSecondary: '#9CA3AF',
      textMuted: '#6B7280', bgCard: '#111827', bg: '#0B0F19',
      bgCardLight: '#1A2235', border: '#1F2937', divider: '#1E293B',
    },
  }),
}));

vi.mock('../store/riskStore', () => ({
  useRiskStore: mockUseRiskStore,
  selectIsLockdownActive: (state: any) =>
    state.lockdown?.status === 'active' || state.lockdown?.status === 'cooldown',
}));

vi.mock('../store/voiceStore', () => ({
  useVoiceStore: mockUseVoiceStore,
  VOICE_MESSAGES: {
    stopLossBreached: { id: 'stop_loss_breached', text: 'Stop-loss triggered.', priority: 'high', category: 'alert' },
    lockdownLifted: { id: 'lockdown_lifted', text: 'Trading limits restored.', priority: 'high', category: 'info' },
    lockdownExpiring: { id: 'lockdown_expiring', text: 'Lockdown ending soon.', priority: 'normal', category: 'info' },
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

vi.mock('expo-haptics', () => ({
  default: {
    notificationAsync: vi.fn(() => Promise.resolve()),
    impactAsync: vi.fn(() => Promise.resolve()),
  },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  notificationAsync: vi.fn(() => Promise.resolve()),
  impactAsync: vi.fn(() => Promise.resolve()),
}));

// i18n keys resolve to the same human labels the en locale uses
const T_MAP: Record<string, string> = {
  'components.ironLock.lockdown': 'LOCKDOWN',
  'components.ironLock.cooldown': 'COOLDOWN',
  'components.ironLock.engagedDesc': 'Financial Bodyguard engaged',
  'components.ironLock.cooldownDesc': 'Exit-only mode continuing in cooldown',
  'components.ironLock.liftsIn': 'Lockdown lifts in',
  'components.ironLock.calculating': 'Calculating...',
  'components.ironLock.liftingSoon': 'Lifting soon...',
  'components.ironLock.triggerLoss': 'Trigger Loss',
  'components.ironLock.limitBreached': 'Limit Breached',
  'components.ironLock.status': 'Status',
  'components.ironLock.active': 'Active',
  'components.ironLock.cooldownStatus': 'Cooldown',
  'components.ironLock.rupeeLimit': '₹ Limit',
  'components.ironLock.percentLimit': '% Limit',
  'components.ironLock.instructions': 'Only SQUARE OFF orders are permitted. All other actions are blocked until the lockdown period ends.',
  'components.ironLock.emergencyNote': 'Panic situation? You can always get out:',
  'components.ironLock.emergencyButton': 'EMERGENCY EXIT ALL',
  'components.ironLock.emergencyWorking': 'EXITING POSITIONS…',
  'components.ironLock.emergencyTitle': 'Emergency Exit',
  'components.ironLock.emergencyConfirm': 'This will place MARKET SELL orders for ALL open positions at the best available price. Losses may be locked in. Continue?',
  'components.ironLock.emergencyGo': 'Exit Everything',
  'components.ironLock.emergencyCancel': 'Cancel',
  'components.ironLock.emergencyPartial': 'Partial Exit',
  'components.ironLock.emergencyFailed': 'Exit Failed',
  'components.ironLock.emergencyFailedMsg': 'Something went wrong while exiting positions. Please retry — your positions remain open.',
};

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => T_MAP[key] ?? key,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

// ── Broker API mock — the ONLY layer faked; the real emergencyExitService ──
// ── runs between this mock and the UI.                                    ──
vi.mock('../services/api/snaptrade', () => ({
  snapTradeApi: {
    getPositions: vi.fn(),
    placeOrder: vi.fn(),
  },
}));

import { render, fireEvent } from './testUtils';
import IronLockOverlay from '../components/IronLockOverlay';
import { snapTradeApi } from '../services/api/snaptrade';

const mockGetPositions = vi.mocked(snapTradeApi.getPositions);
const mockPlaceOrder = vi.mocked(snapTradeApi.placeOrder);

// ──── Fixtures ─────────────────────────────────────────────────────────────

const defaultLockdown = { status: 'none' as const, triggeredAt: null, liftsAt: null, triggerLoss: null, breachedLimit: null };

const activeLockdown = {
  status: 'active' as const,
  triggeredAt: '2025-06-01T10:00:00Z',
  liftsAt: new Date(Date.now() + 3600000).toISOString(),
  triggerLoss: 55000,
  breachedLimit: 'daily_loss' as const,
};

function makePosition(overrides: Record<string, any> = {}) {
  return {
    symbol: 'RELIANCE',
    name: 'Reliance Industries',
    quantity: 10,
    price: 2500,
    avgCost: 2400,
    pnl: 1000,
    pnlPercent: 4.17,
    ...overrides,
  };
}

// ──── Store harness (same two-phase pattern as IronLockOverlay.test.tsx) ────

let currentState: Record<string, any> = {};

function setStoreState(lockdown: Record<string, any>) {
  currentState = { lockdown };
  mockUseRiskStore.mockImplementation((selector: any) =>
    typeof selector === 'function' ? selector(currentState) : currentState,
  );
}

function renderAndActivateLockdown() {
  setStoreState(defaultLockdown);
  const result = render(<IronLockOverlay />);
  setStoreState(activeLockdown);
  act(() => { result.update(<IronLockOverlay />); });
  return result;
}

/** Alert spy — assigned in beforeEach, read by the flush helper below. */
let alertSpy: ReturnType<typeof vi.spyOn>;

/** Flush the whole promise chain (service → broker API → result alert). */
async function confirmEmergencyExit(result: ReturnType<typeof render>) {
  const button = result.getByTestId('emergency-exit-button');
  fireEvent.press(button);

  // First alert = the confirmation dialog
  expect(alertSpy).toHaveBeenCalledTimes(1);
  const [title, message, buttons] = alertSpy.mock.calls[0];
  expect(title).toBe('Emergency Exit');
  expect(message).toContain('MARKET SELL');

  const confirmButton = (buttons as any[]).find(b => b.style === 'destructive');
  expect(confirmButton?.onPress).toBeDefined();

  // setImmediate is a macrotask: every pending microtask (the full async
  // order chain) settles before it fires. Fake timers don't fake it because
  // beforeEach excludes setImmediate from toFake.
  await act(async () => {
    confirmButton.onPress();
    await new Promise(resolve => setImmediate(resolve));
  });
}

// ──── Tests ────────────────────────────────────────────────────────────────

describe('Iron Lock — Emergency Exit integration', () => {
  let rendered: ReturnType<typeof render> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    // Overlay starts intervals on lockdown; fake those but keep setImmediate
    // real so the async-flush helper above works.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    alertSpy = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockGetPositions.mockResolvedValue({ success: true, data: [], count: 0 });
    mockPlaceOrder.mockResolvedValue({ success: true, orderId: 'ord_x', status: 'FILLED' });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = null;
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders no emergency button when there is no lockdown', () => {
    setStoreState(defaultLockdown);
    rendered = render(<IronLockOverlay />);
    expect(rendered.queryByTestId('emergency-exit-button')).toBeNull();
  });

  it('shows the EMERGENCY EXIT ALL button during lockdown', () => {
    rendered = renderAndActivateLockdown();
    expect(rendered.getByTestId('emergency-exit-button')).toBeDefined();
    expect(rendered.getByText('EMERGENCY EXIT ALL')).toBeDefined();
    expect(rendered.getByText('Panic situation? You can always get out:')).toBeDefined();
  });

  it('exits all positions with market SELL orders and reports success', async () => {
    mockGetPositions.mockResolvedValue({
      success: true,
      data: [makePosition({ symbol: 'RELIANCE', quantity: 10, price: 2500 }), makePosition({ symbol: 'TCS', quantity: 5, price: 4000 })],
      count: 2,
    });
    mockPlaceOrder.mockResolvedValue({ success: true, orderId: 'ord_1', status: 'FILLED' });

    rendered = renderAndActivateLockdown();
    await confirmEmergencyExit(rendered!);

    // Real service ran: one market SELL per long position
    expect(mockPlaceOrder).toHaveBeenCalledTimes(2);
    expect(mockPlaceOrder).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'RELIANCE', action: 'SELL', orderType: 'Market', quantity: 10, estimatedPrice: 2500,
    }));
    expect(mockPlaceOrder).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'TCS', action: 'SELL', orderType: 'Market', quantity: 5,
    }));

    // Second alert = the success summary from the real summarizeEmergencyExit
    expect(Alert.alert).toHaveBeenCalledTimes(2);
    const [resultTitle, resultMessage] = alertSpy.mock.calls[1];
    expect(resultTitle).toBe('Emergency Exit');
    expect(resultMessage).toBe('All 2 positions exited successfully.');
  });

  it('reports a partial exit when one position fails', async () => {
    mockGetPositions.mockResolvedValue({
      success: true,
      data: [makePosition({ symbol: 'AAA' }), makePosition({ symbol: 'BBB' })],
      count: 2,
    });
    mockPlaceOrder
      .mockResolvedValueOnce({ success: true, orderId: 'o1', status: 'FILLED' })
      .mockRejectedValueOnce(new Error('Order rejected by broker'));

    rendered = renderAndActivateLockdown();
    await confirmEmergencyExit(rendered!);

    // Failure isolation: the second order was still attempted
    expect(mockPlaceOrder).toHaveBeenCalledTimes(2);

    expect(Alert.alert).toHaveBeenCalledTimes(2);
    const [resultTitle, resultMessage] = alertSpy.mock.calls[1];
    expect(resultTitle).toBe('Partial Exit');
    expect(resultMessage).toContain('1 of 2 positions exited');
    expect(resultMessage).toContain('BBB');
    expect(resultMessage).toContain('Retry Emergency Exit');
  });

  it('shows retry guidance when the broker cannot be reached', async () => {
    mockGetPositions.mockRejectedValue(new Error('Network unreachable'));

    rendered = renderAndActivateLockdown();
    await confirmEmergencyExit(rendered!);

    expect(mockPlaceOrder).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(2);
    const [resultTitle, resultMessage] = alertSpy.mock.calls[1];
    expect(resultTitle).toBe('Partial Exit');
    expect(resultMessage).toContain('Could not reach your broker');
    expect(resultMessage).toContain('open positions remain');
  });

  it('reports already-flat when there are no open positions', async () => {
    mockGetPositions.mockResolvedValue({ success: true, data: [], count: 0 });

    rendered = renderAndActivateLockdown();
    await confirmEmergencyExit(rendered!);

    expect(mockPlaceOrder).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(2);
    const [resultTitle, resultMessage] = alertSpy.mock.calls[1];
    expect(resultTitle).toBe('Emergency Exit');
    expect(resultMessage).toContain('already flat');
  });

  it('closes short positions with BUY orders through the same flow', async () => {
    mockGetPositions.mockResolvedValue({
      success: true,
      data: [makePosition({ symbol: 'INFY', quantity: -20, price: 1500 })],
      count: 1,
    });

    rendered = renderAndActivateLockdown();
    await confirmEmergencyExit(rendered!);

    expect(mockPlaceOrder).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'INFY', action: 'BUY', orderType: 'Market', quantity: 20, estimatedPrice: 1500,
    }));
    expect(Alert.alert).toHaveBeenCalledTimes(2);
    expect(alertSpy.mock.calls[1][1]).toBe('All 1 position exited successfully.');
  });

  it('places no orders and shows no result when the user cancels', async () => {
    mockGetPositions.mockResolvedValue({
      success: true,
      data: [makePosition({ symbol: 'RELIANCE' })],
      count: 1,
    });

    rendered = renderAndActivateLockdown();
    fireEvent.press(rendered!.getByTestId('emergency-exit-button'));

    const [, , buttons] = alertSpy.mock.calls[0];
    const cancelButton = (buttons as any[]).find(b => b.style === 'cancel');
    expect(cancelButton).toBeDefined();

    await act(async () => {
      cancelButton.onPress?.();
      await new Promise(resolve => setImmediate(resolve));
    });

    expect(mockGetPositions).not.toHaveBeenCalled();
    expect(mockPlaceOrder).not.toHaveBeenCalled();
    // Still only the confirmation alert — no result alert followed
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });
});
