/**
 * ============================================================================
 * Toroloom — AvatarWidget Tests
 * ============================================================================
 *
 * Tests the AI Companion AvatarWidget: idle state, alert/celebration/listening
 * triggers, banner display, tap interaction, and edge cases.
 *
 * CRITICAL NOTE ON TESTING STRATEGY:
 *
 * The AvatarWidget detects state transitions via useRef + useEffect:
 *
 *   const prevLockdownRef = useRef(lockdown.status);  // captures CURRENT store value
 *   useEffect(() => {
 *     const current = lockdown.status;
 *     const prev = prevLockdownRef.current;
 *     if (current === 'active' && prev === 'none') { ... }  // transition detected
 *     prevLockdownRef.current = current;
 *   }, [lockdown.status]);
 *
 * On first render, prevLockdownRef.current ALWAYS equals the current store value,
 * so NO transition is ever detected on initial mount.  To trigger a transition,
 * we must render TWICE: first with a base state, then update the mock and re-render.
 *
 * Similarly for profit target detection via prevPnLRef.
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (hoisted for TDZ safety) ──────────────────────────
const { mockUseRiskStore, mockSafeAreaInsets } = vi.hoisted(() => ({
  mockUseRiskStore: vi.fn(),
  mockSafeAreaInsets: vi.fn(() => ({ bottom: 0, top: 0, left: 0, right: 0 })),
}));

// ── Mock ThemeContext ───────────────────────────────────────
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      text: '#1A1A2E',
      textSecondary: '#5A5A7A',
      textMuted: '#9A9AB0',
      bgCard: '#FFFFFF',
      bg: '#F4F5FA',
      bgCardLight: '#F0F2F8',
      border: '#E0E0F0',
      divider: '#E8E8F0',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      marketNeutral: '#FFC107',
      secondary: '#FF6B6B',
      accent: '#00D2FF',
    },
  }),
}));

// ── Mock riskStore ──────────────────────────────────────────
vi.mock('../store/riskStore', () => ({
  useRiskStore: mockUseRiskStore,
  selectDailyPnL: (state: any) => (state.today?.realizedPnL ?? 0) + (state.today?.unrealizedPnL ?? 0),
}));

// ── Mock safe-area-context ──────────────────────────────────
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: mockSafeAreaInsets,
}));

// ── Mock expo-haptics ──────────────────────────────────────
vi.mock('expo-haptics', () => ({
  default: {
    impactAsync: vi.fn(() => Promise.resolve()),
    notificationAsync: vi.fn(() => Promise.resolve()),
  },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  impactAsync: vi.fn(() => Promise.resolve()),
  notificationAsync: vi.fn(() => Promise.resolve()),
}));

// ── Imports (after mocks) ──────────────────────────────────
import { render, fireEvent } from './testUtils';
import AvatarWidget from '../components/AvatarWidget';

// ── Helpers ─────────────────────────────────────────────────

const defaultLockdown = { status: 'none' as const, triggeredAt: null, liftsAt: null, triggerLoss: null, breachedLimit: null };
const defaultToday = { realizedPnL: 0, unrealizedPnL: 0, peakValue: 0, totalCharges: 0, tradeCount: 0, date: '2025-06-01' };

function createRiskState(overrides: Record<string, any> = {}) {
  return {
    lockdown: { ...defaultLockdown, ...overrides.lockdown },
    today: { ...defaultToday, ...overrides.today },
    ...overrides,
  };
}

/**
 * Set the mock store to return the given state for ALL selector calls.
 * Must be called BEFORE re-render so the component picks up the new values.
 */
function setStoreState(state: Record<string, any> = {}) {
  const riskState = createRiskState(state);
  mockUseRiskStore.mockImplementation((selector: any) => {
    if (typeof selector === 'function') return selector(riskState);
    return riskState;
  });
}

function advance(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

/**
 * Two-phase render:
 *   Phase 1 — set base store state and create component.
 *   Phase 2 — update the store mock to the target state and re-render,
 *              which triggers the ref-based transition detection in useEffect.
 */
function renderAndTransition(targetState: Record<string, any>, baseState?: Record<string, any>) {
  // Phase 1: render with base state (defaults to no lockdown, zero PnL)
  setStoreState(baseState);
  const result = render(<AvatarWidget />);

  // Phase 2: update store and re-render to trigger transition
  setStoreState(targetState);
  act(() => { result.update(<AvatarWidget />); });

  return result;
}

// ============================================================================
// Tests
// ============================================================================

describe('AvatarWidget — Idle State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('renders without crashing', () => {
    expect(() => {
      setStoreState();
      render(<AvatarWidget />);
    }).not.toThrow();
  });

  it('renders the TOROLOOM label', () => {
    setStoreState();
    const { getByText } = render(<AvatarWidget />);
    expect(getByText('TOROLOOM')).toBeDefined();
  });

  it('does not show banner in idle state', () => {
    setStoreState();
    const { queryByText } = render(<AvatarWidget />);
    expect(queryByText(/Stop-loss/)).toBeNull();
    expect(queryByText(/Target/)).toBeNull();
    expect(queryByText(/Trading limits/)).toBeNull();
  });
});

describe('AvatarWidget — Alert State (Stop-Loss Breach)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('transitions to LOCKDOWN label when lockdown activates', () => {
    const { getByText } = renderAndTransition(
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: '2025-06-02T10:00:00Z', triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    expect(getByText('LOCKDOWN')).toBeDefined();
  });

  it('shows stop-loss banner text after lockdown trigger', () => {
    const { getByText } = renderAndTransition(
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: '2025-06-02T10:00:00Z', triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    expect(getByText(/Stop-loss triggered/)).toBeDefined();
  });

  it('remains in alert state until auto-dismiss', () => {
    const { getByText } = renderAndTransition(
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: '2025-06-02T10:00:00Z', triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    // 1 second in — banner still visible
    advance(1000);
    expect(getByText('LOCKDOWN')).toBeDefined();
    expect(getByText(/Stop-loss triggered/)).toBeDefined();
  });

  it('auto-dismisses banner after 6 seconds', () => {
    const { getByText, queryByText } = renderAndTransition(
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: '2025-06-02T10:00:00Z', triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    // Advance past auto-dismiss timer
    advance(6000);
    expect(getByText('TOROLOOM')).toBeDefined();
    expect(queryByText(/Stop-loss triggered/)).toBeNull();
  });
});

describe('AvatarWidget — Listening State (Lockdown Lifted)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('transitions to LISTENING label when lockdown lifts', () => {
    // Phase 1: render with active lockdown
    // Phase 2: transition to none (lockdown lifted)
    const { getByText } = renderAndTransition(
      { lockdown: defaultLockdown },
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: '2025-06-02T10:00:00Z', triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    // The transition 'active' → 'none' triggers the listening state
    expect(getByText('LISTENING')).toBeDefined();
  });

  it('shows lockdown-lifted banner text', () => {
    const { getByText } = renderAndTransition(
      { lockdown: defaultLockdown },
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: '2025-06-02T10:00:00Z', triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    expect(getByText(/Trading limits restored/)).toBeDefined();
  });
});

describe('AvatarWidget — Celebration State (Profit Target)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('transitions to PROFIT! label on large profit swing', () => {
    // The component checks: prevPnL < 0 && dailyPnL > 0 && abs(dailyPnL - prevPnL) > 10000
    // Phase 1: render with negative PnL (-5000)
    // Phase 2: update to positive PnL +15000 (swing of 20000 > 10000)
    const { getByText } = renderAndTransition(
      { today: { ...defaultToday, realizedPnL: 15000, unrealizedPnL: 0 } },
      { today: { ...defaultToday, realizedPnL: -5000, unrealizedPnL: 0 } },
    );
    expect(getByText('PROFIT!')).toBeDefined();
  });

  it('shows profit-target banner text', () => {
    const { getByText } = renderAndTransition(
      { today: { ...defaultToday, realizedPnL: 15000, unrealizedPnL: 0 } },
      { today: { ...defaultToday, realizedPnL: -5000, unrealizedPnL: 0 } },
    );
    expect(getByText(/Target achieved/)).toBeDefined();
  });

  it('does not trigger celebration for small PnL swing', () => {
    // Phase 1: negative PnL
    // Phase 2: positive PnL but swing = 2000 (< 10000 threshold)
    const { getByText } = renderAndTransition(
      { today: { ...defaultToday, realizedPnL: 1000, unrealizedPnL: 0 } },
      { today: { ...defaultToday, realizedPnL: -1000, unrealizedPnL: 0 } },
    );
    // Should stay idle since swing of 2000 < 10000 threshold
    expect(getByText('TOROLOOM')).toBeDefined();
  });
});

describe('AvatarWidget — Tap Interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('tapping idle avatar does not throw', () => {
    setStoreState();
    const { getByText } = render(<AvatarWidget />);
    expect(() => {
      fireEvent.press(getByText('TOROLOOM'));
    }).not.toThrow();
  });

  it('tapping dismisses an active alert banner', () => {
    const { getByText, queryByText } = renderAndTransition(
      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: '2025-06-02T10:00:00Z', triggerLoss: 55000, breachedLimit: 'daily_loss' } },
    );
    expect(getByText('LOCKDOWN')).toBeDefined();
    expect(getByText(/Stop-loss triggered/)).toBeDefined();

    // Tap to dismiss
    fireEvent.press(getByText('LOCKDOWN'));

    expect(queryByText(/Stop-loss triggered/)).toBeNull();
    expect(getByText('TOROLOOM')).toBeDefined();
  });
});

describe('AvatarWidget — Safe Area Insets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('renders with default safe area insets', () => {
    setStoreState();
    expect(() => render(<AvatarWidget />)).not.toThrow();
  });

  it('renders with iPhone X+ safe area insets', () => {
    mockSafeAreaInsets.mockReturnValueOnce({ bottom: 34, top: 47, left: 0, right: 0 });
    setStoreState();
    expect(() => render(<AvatarWidget />)).not.toThrow();
  });
});

describe('AvatarWidget — Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('handles missing expo-speech gracefully', () => {
    setStoreState();
    expect(() => render(<AvatarWidget />)).not.toThrow();
  });

  it('handles multiple re-renders without error', () => {
    setStoreState();
    const { update } = render(<AvatarWidget />);
    expect(() => {
      act(() => { update(<AvatarWidget />); });
      act(() => { update(<AvatarWidget />); });
      act(() => { update(<AvatarWidget />); });
    }).not.toThrow();
  });

  it('renders with cooldown lockdown status', () => {
    setStoreState({ lockdown: { status: 'cooldown', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: '2025-06-02T10:00:00Z', triggerLoss: 55000, breachedLimit: 'daily_loss' } });
    const { getByText } = render(<AvatarWidget />);
    // cooldown doesn't match alert pattern — stays idle
    expect(getByText('TOROLOOM')).toBeDefined();
  });

  it('renders with negative daily PnL under threshold', () => {
    setStoreState({ today: { ...defaultToday, realizedPnL: -5000, unrealizedPnL: 0 } });
    const { getByText } = render(<AvatarWidget />);
    expect(getByText('TOROLOOM')).toBeDefined();
  });
});
