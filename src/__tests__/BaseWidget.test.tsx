/**
 * ============================================================================
 * Toroloom — BaseWidget Actions-Menu Tests
 * ============================================================================
 *
 * Covers the interactive container behavior of BaseWidget:
 *   • Menu open (Modal visible flips to true)
 *   • Size quick-toggle → resizeWidget
 *   • Hide action → toggleWidgetVisibility
 *   • Remove action → Alert confirmation → removeWidget (confirm + cancel)
 *   • Tier gating (pro/elite widgets locked on lower tiers)
 *   • Long-press drag handle → onLongPress
 *
 * Self-contained mocks (assertable widgetStore action spies + a controllable
 * subscription tier) because the shared widgetTestMocks helper doesn't expose
 * these. Note: the RN test mock renders Modal children unconditionally (real
 * RN renders nothing when visible=false), so menu contents are always in the
 * tree — menu state is asserted via the Modal's `visible` prop and the store
 * action calls rather than by element presence.
 *
 * ============================================================================
 */

import React from 'react';
import { Text, Alert } from 'react-native';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mock store actions + subscription tier ================
// Hoisted so the mock factories (which run before this module body) can
// reference the spies, and so tests can both configure and assert them.

const { mockRemoveWidget, mockResizeWidget, mockToggleVisibility, mockTier } = vi.hoisted(() => ({
  mockRemoveWidget: vi.fn(),
  mockResizeWidget: vi.fn(),
  mockToggleVisibility: vi.fn(),
  mockTier: { current: 'free' as 'free' | 'pro' | 'elite' },
}));

vi.mock('../store/widgetStore', () => ({
  useWidgetStore: (selector: any) => selector({
    removeWidget: mockRemoveWidget,
    resizeWidget: mockResizeWidget,
    toggleWidgetVisibility: mockToggleVisibility,
  }),
}));

vi.mock('../store/subscriptionStore', () => ({
  useSubscriptionStore: (selector: any) => selector({
    subscription: { tier: mockTier.current },
  }),
}));

// ==================== Mock ThemeContext ====================

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6',
      marketUp: '#00E676',
      marketDown: '#FF5252',
      warning: '#FFC107',
      text: '#E0E6ED',
      textSecondary: '#94A3B8',
      textMuted: '#475569',
      white: '#FFFFFF',
      bg: '#06080C',
      bgSecondary: '#0E1117',
      bgCard: '#1A1D28',
      bgCardLight: '#232734',
      bgInput: '#151821',
      border: 'rgba(255,255,255,0.07)',
      borderLight: 'rgba(255,255,255,0.04)',
      divider: 'rgba(255,255,255,0.04)',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

// ==================== Import widget under test ====================

import BaseWidget from '../components/widgets/BaseWidget';

// Alert.alert in the project's react-native mock is a plain no-op arrow fn
// (not a vi.fn), so spy on it to capture the confirmation dialog's buttons.
const alertSpy = vi.spyOn(Alert, 'alert');

// ==================== Helpers ====================

function renderWidget(props: Partial<React.ComponentProps<typeof BaseWidget>> = {}) {
  return render(
    <BaseWidget widgetId="bw-1" type="pnl" title="P&L Overview" size="medium" {...props}>
      <Text>Child content</Text>
    </BaseWidget>
  );
}

/** Read the `visible` prop of the first Modal host node (defaults to false). */
function modalVisible(result: ReturnType<typeof render>): boolean {
  const modals = result.root.findAll(n => String(n.type) === 'Modal');
  return modals.length > 0 ? Boolean(modals[0].props.visible) : false;
}

/** Press the ⋮ actions-menu button — the only Pressable with hitSlop={8}. */
function openMenu(result: ReturnType<typeof render>) {
  const menuBtn = result.root.findAll(n => n.props && n.props.hitSlop === 8)[0];
  expect(menuBtn).toBeDefined();
  fireEvent.press(menuBtn);
}

/** The buttons array from the most recent Alert.alert call. */
function lastAlertButtons(): any[] {
  const calls = alertSpy.mock.calls;
  return calls[calls.length - 1][2] as any[];
}

// ==================== Tests ====================

describe('BaseWidget', () => {
  beforeEach(() => {
    mockRemoveWidget.mockClear();
    mockResizeWidget.mockClear();
    mockToggleVisibility.mockClear();
    mockTier.current = 'free';
    alertSpy.mockClear();
  });

  it('renders title and children', () => {
    const { getByText } = renderWidget();
    expect(getByText('P&L Overview')).toBeDefined();
    expect(getByText('Child content')).toBeDefined();
  });

  it('opens the actions menu when the ⋮ button is pressed', () => {
    const result = renderWidget();
    expect(modalVisible(result)).toBe(false);
    openMenu(result);
    expect(modalVisible(result)).toBe(true);
    // Menu actions are available once the menu is open. (Note: the RN test
    // mock renders Modal children unconditionally, so menu contents are in the
    // tree even when closed — the visible flip above is the real gate.)
    expect(result.getByText('Hide Widget')).toBeDefined();
    expect(result.getByText('Remove Widget')).toBeDefined();
  });

  it('resizes to the pressed size option and closes the menu', () => {
    const result = renderWidget({ size: 'small' });
    openMenu(result);
    fireEvent.press(result.getByText('Large'));
    expect(mockResizeWidget).toHaveBeenCalledWith('bw-1', 'large');
    expect(modalVisible(result)).toBe(false);
  });

  it('hides the widget when Hide Widget is pressed', () => {
    const result = renderWidget();
    openMenu(result);
    fireEvent.press(result.getByText('Hide Widget'));
    expect(mockToggleVisibility).toHaveBeenCalledWith('bw-1');
    expect(modalVisible(result)).toBe(false);
  });

  it('confirms removal via Alert before calling removeWidget', () => {
    const result = renderWidget();
    openMenu(result);
    fireEvent.press(result.getByText('Remove Widget'));

    expect(alertSpy).toHaveBeenCalled();
    const [title, msg] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    expect(title).toBe('Remove Widget');
    expect(msg).toContain('P&L Overview');

    const destructive = lastAlertButtons().find(b => b.style === 'destructive');
    expect(destructive).toBeDefined();
    // Removal only happens after the user confirms in the Alert.
    expect(mockRemoveWidget).not.toHaveBeenCalled();

    destructive.onPress();
    expect(mockRemoveWidget).toHaveBeenCalledWith('bw-1');
  });

  it('does not remove the widget when the Alert cancel button is pressed', () => {
    const result = renderWidget();
    openMenu(result);
    fireEvent.press(result.getByText('Remove Widget'));

    const cancel = lastAlertButtons().find(b => b.style === 'cancel');
    expect(cancel).toBeDefined();
    // The cancel button carries no onPress — it just dismisses the dialog,
    // so removal never fires.
    expect(cancel.onPress).toBeUndefined();
    expect(mockRemoveWidget).not.toHaveBeenCalled();
  });

  it('locks pro widgets on the free tier with a Pro overlay', () => {
    mockTier.current = 'free';
    const { getByText } = renderWidget({ type: 'risk_metrics', title: 'Risk Metrics' });
    expect(getByText('Pro plan required')).toBeDefined();
    expect(getByText('Upgrade to unlock this widget')).toBeDefined();
  });

  it('locks elite widgets on the free tier with an Elite overlay', () => {
    mockTier.current = 'free';
    const { getByText } = renderWidget({ type: 'market_overview', title: 'Market Overview' });
    expect(getByText('Elite plan required')).toBeDefined();
  });

  it('unlocks pro widgets when the user is on the pro tier', () => {
    mockTier.current = 'pro';
    const { queryByText } = renderWidget({ type: 'risk_metrics', title: 'Risk Metrics' });
    expect(queryByText('Pro plan required')).toBeNull();
    expect(queryByText('Upgrade to unlock this widget')).toBeNull();
  });

  it('unlocks elite widgets when the user is on the elite tier', () => {
    mockTier.current = 'elite';
    const { queryByText } = renderWidget({ type: 'market_overview', title: 'Market Overview' });
    expect(queryByText('Elite plan required')).toBeNull();
  });

  it('fires onLongPress when the header drag handle is long-pressed', () => {
    const onLongPress = vi.fn();
    const { getByText } = renderWidget({ onLongPress });
    fireEvent.trigger(getByText('P&L Overview'), 'onLongPress');
    expect(onLongPress).toHaveBeenCalled();
  });
});
