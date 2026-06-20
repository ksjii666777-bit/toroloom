import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const { mockUseRiskStore, mockUseVoiceStore, mockSafeAreaInsets } = vi.hoisted(() => ({
  mockUseRiskStore: vi.fn(),
  mockUseVoiceStore: vi.fn(function(selector) {
    const state = { speak: vi.fn(), enabled: true };
    return typeof selector === 'function' ? selector(state) : state;
  }),
  mockSafeAreaInsets: vi.fn(() => ({ bottom: 0, top: 0, left: 0, right: 0 })),
}));

// Override icon mock locally so icon names render as text children
vi.mock('@expo/vector-icons', () => {
  const React = require('react');
  const IconComponent = function(props: any) {
    return React.createElement('Text', null, props.name || '');
  };
  return {
    Ionicons: IconComponent,
  };
});

// Mock ThemeContext
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6', text: '#FFFFFF', textSecondary: '#9CA3AF',
      textMuted: '#6B7280', bgCard: '#111827', bg: '#0B0F19',
      bgCardLight: '#1A2235', border: '#1F2937', divider: '#1E293B',
    },
  }),
}));

// Mock riskStore
vi.mock('../store/riskStore', () => ({
  useRiskStore: mockUseRiskStore,
  selectIsLockdownActive: (state: any) => state.lockdown?.status === 'active' || state.lockdown?.status === 'cooldown',
}));

// Mock voiceStore
vi.mock('../store/voiceStore', () => ({
  useVoiceStore: mockUseVoiceStore,
  VOICE_MESSAGES: {
    stopLossBreached: { id: 'stop_loss_breached', text: 'Stop-loss triggered.', priority: 'high', category: 'alert' },
    profitTargetHit: { id: 'profit_target_hit', text: 'Target achieved!', priority: 'high', category: 'celebration' },
    lockdownLifted: { id: 'lockdown_lifted', text: 'Trading limits restored.', priority: 'high', category: 'info' },
    dailyLossWarning: { id: 'daily_loss_warning', text: 'Warning: Daily loss approaching limit.', priority: 'normal', category: 'warning' },
    imminentBreach: { id: 'imminent_breach', text: 'Alert: Approaching stop-loss threshold.', priority: 'high', category: 'warning' },
    marketVolatility: { id: 'market_volatility', text: 'High volatility detected.', priority: 'normal', category: 'warning' },
    portfolioAlert: { id: 'portfolio_alert', text: 'Portfolio alert.', priority: 'normal', category: 'info' },
    lockdownExpiring: { id: 'lockdown_expiring', text: 'Lockdown ending soon.', priority: 'normal', category: 'info' },
    goodMorning: { id: 'good_morning', text: 'Good morning!', priority: 'low', category: 'info' },
    sessionEnd: { id: 'session_end', text: 'Market closed.', priority: 'low', category: 'info' },
  },
}));

// Mock safe-area-context
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: mockSafeAreaInsets,
}));

// Mock expo-haptics
vi.mock('expo-haptics', () => ({
  default: { notificationAsync: vi.fn(() => Promise.resolve()), impactAsync: vi.fn(() => Promise.resolve()) },
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  notificationAsync: vi.fn(() => Promise.resolve()),
  impactAsync: vi.fn(() => Promise.resolve()),
}));

// Mock LinearGradient
vi.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));

import { render } from './testUtils';
import IronLockOverlay from '../components/IronLockOverlay';

const defaultLockdown = { status: 'none' as const, triggeredAt: null, liftsAt: null, triggerLoss: null, breachedLimit: null };

function createRiskState(overrides: Record<string, any> = {}) {
  return {
    lockdown: { ...defaultLockdown, ...overrides.lockdown },
    ...overrides,
  };
}

function setStoreState(state: Record<string, any> = {}) {
  const riskState = createRiskState(state);
  mockUseRiskStore.mockImplementation((selector: any) => {
    if (typeof selector === 'function') return selector(riskState);
    return riskState;
  });
}

/**
 * Two-phase render for IronLockOverlay tests.
 * Phase 1: render with base state (default: no lockdown)
 * Phase 2: update store and re-render to trigger transition
 */
function renderAndTransition(targetState: Record<string, any>, baseState?: Record<string, any>) {
  setStoreState(baseState);
  const result = render(<IronLockOverlay />);
  setStoreState(targetState);
  act(() => { result.update(<IronLockOverlay />); });
  return result;
}

describe('IronLockOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('renders nothing when no lockdown', () => {
    setStoreState();
    const { queryByText } = render(<IronLockOverlay />);
    expect(queryByText('LOCKDOWN')).toBeNull();
  });

  it('shows LOCKDOWN text when lockdown activates', () => {
    const { getByText } = renderAndTransition(
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    expect(getByText('LOCKDOWN')).toBeDefined();
  });

  it('shows COOLDOWN text when lockdown is cooldown', () => {
    const { getByText } = renderAndTransition(
      { lockdown: { status: 'cooldown', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    expect(getByText('COOLDOWN')).toBeDefined();
  });

  it('displays trigger loss amount', () => {
    const { getByText } = renderAndTransition(
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    expect(getByText(/55,000/)).toBeDefined();
  });

  it('displays breached limit type', () => {
    const { getByText } = renderAndTransition(
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 45000, breachedLimit: 'daily_loss_percent' } },
    );
    expect(getByText('% Limit')).toBeDefined();
  });

  it('displays lockdown status badge', () => {
    const { getByText } = renderAndTransition(
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    expect(getByText('Active')).toBeDefined();
  });

  it('shows Financial Bodyguard description', () => {
    const { getByText } = renderAndTransition(
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    expect(getByText('Financial Bodyguard engaged')).toBeDefined();
  });

  it('shows SQUARE OFF instruction message', () => {
    const { getByText } = renderAndTransition(
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    expect(getByText(/SQUARE OFF/)).toBeDefined();
  });

  it('renders with lock icon present', () => {
    const { root } = renderAndTransition(
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    // Icon mock renders name as text children
    const lockIcons = root.findAllByProps({ children: 'lock-closed' });
    const shieldIcons = root.findAllByProps({ children: 'shield-checkmark' });
    expect(lockIcons.length + shieldIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders cooldown description text for cooldown status', () => {
    const { getByText } = renderAndTransition(
      { lockdown: { status: 'cooldown', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    expect(getByText(/Exit-only mode continuing/)).toBeDefined();
  });

  it('renders with safe area insets without crashing', () => {
    mockSafeAreaInsets.mockReturnValueOnce({ bottom: 34, top: 47, left: 0, right: 0 });
    const { getByText } = renderAndTransition(
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    expect(getByText('LOCKDOWN')).toBeDefined();
  });

  it('does not show overlay when lockdown status is none', () => {
    // Phase 1: render with active lockdown
    // Phase 2: transition to none (lockdown lifted) — should hide
    const { getByText, queryByText } = renderAndTransition(
      { lockdown: defaultLockdown },
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    expect(queryByText(/LOCKDOWN/)).toBeNull();
    expect(queryByText(/Financial Bodyguard/)).toBeNull();
  });
});
