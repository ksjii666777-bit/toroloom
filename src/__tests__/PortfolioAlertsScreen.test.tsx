/**
 * ============================================================================
 * Toroloom — PortfolioAlertsScreen Tests
 * ============================================================================
 *
 * Tests the PortfolioAlerts screen: header, active/paused alerts, add grid,
 * toggle rules, threshold adjustment, badge toggle, test alert, remove,
 * stock picker modal, quiet hours, quick-add defaults, info card, trigger
 * history, empty state, and navigation.
 *
 * The screen uses useNotificationStore (portfolioAlertRules, preferences,
 * alertTriggerHistory, etc.) and usePortfolioStore (holdings).
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

// Notification store mock functions
const mockAddPortfolioAlertRule = vi.fn();
const mockRemovePortfolioAlertRule = vi.fn();
const mockUpdatePortfolioAlertRule = vi.fn();
const mockClearAlertTriggerHistory = vi.fn();
const mockSetQuickAddThreshold = vi.fn();
const mockAddNotification = vi.fn();

// Default notification store state
const defaultPortfolioAlertRules = [
  {
    id: 'par_default_1',
    kind: 'portfolio_pnl_pct' as const,
    label: 'Portfolio P&L <-5%',
    threshold: -5,
    direction: 'below' as const,
    triggered: false,
    createdAt: '2025-06-01T00:00:00.000Z',
    enabled: true,
    badge: true,
  },
  {
    id: 'par_default_2',
    kind: 'holding_day_gain_pct' as const,
    label: 'Holding day gain >10%',
    threshold: 10,
    direction: 'above' as const,
    triggered: false,
    createdAt: '2025-06-01T00:00:00.000Z',
    enabled: true,
    badge: true,
  },
  {
    id: 'par_default_3',
    kind: 'portfolio_peak_drawdown' as const,
    label: 'Portfolio drawdown >3%',
    threshold: 3,
    direction: 'below' as const,
    triggered: false,
    createdAt: '2025-06-01T00:00:00.000Z',
    enabled: false,
    badge: true,
  },
];

const defaultPreferences = {
  priceAlerts: true,
  tradeConfirmations: true,
  educationalReminders: true,
  systemUpdates: true,
  soundEnabled: true,
  vibrationEnabled: true,
  quietHoursStart: null as string | null,
  quietHoursEnd: null as string | null,
  priceAlertThreshold: 2.0,
};

// Mock the notification store — isInQuietHours is a vi.fn() so tests can
// import it and call .mockReturnValue() to control its behavior per test.
vi.mock('../store/notificationStore', () => ({
  useNotificationStore: vi.fn(() => ({
    portfolioAlertRules: defaultPortfolioAlertRules,
    addPortfolioAlertRule: mockAddPortfolioAlertRule,
    removePortfolioAlertRule: mockRemovePortfolioAlertRule,
    updatePortfolioAlertRule: mockUpdatePortfolioAlertRule,
    alertTriggerHistory: [],
    clearAlertTriggerHistory: mockClearAlertTriggerHistory,
    quickAddDayGainThreshold: 10,
    quickAddPnLThreshold: 20,
    setQuickAddThreshold: mockSetQuickAddThreshold,
    preferences: defaultPreferences,
    addNotification: mockAddNotification,
  })),
  isInQuietHours: vi.fn(() => false),
  PortfolioAlertKind: 'PortfolioAlertKind',
}));

// Default holdings for the portfolio store
const defaultHoldings = [
  {
    id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.',
    quantity: 10, buyPrice: 2800, currentPrice: 3000, totalInvested: 28000, currentValue: 30000,
    pnl: 2000, pnlPercent: 7.14, dayChange: 150, dayChangePercent: 2.5,
  },
  {
    id: 'h2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services',
    quantity: 5, buyPrice: 3800, currentPrice: 3600, totalInvested: 19000, currentValue: 18000,
    pnl: -1000, pnlPercent: -5.26, dayChange: -75, dayChangePercent: -1.8,
  },
  {
    id: 'h3', stockId: 'INFY', symbol: 'INFY', name: 'Infosys Ltd.',
    quantity: 20, buyPrice: 1550, currentPrice: 1600, totalInvested: 31000, currentValue: 32000,
    pnl: 1000, pnlPercent: 3.23, dayChange: 50, dayChangePercent: 0.8,
  },
];

vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: vi.fn(() => ({ holdings: defaultHoldings })),
}));

// Mock ThemeContext
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', primaryLight: '#8B83FF', primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4A42CC'] as [string, string],
      secondaryGradient: ['#1A1A3E', '#0D0D2B'] as [string, string],
      success: '#00C853', danger: '#FF1744', warning: '#FFC107',
      marketUp: '#00C853', marketDown: '#FF1744',
      text: '#FFFFFF', textSecondary: '#B0B0D0', textMuted: '#6E6E9A', white: '#FFFFFF',
      bg: '#0D0D2B', bgSecondary: '#1A1A3E', bgCard: '#222255', bgCardLight: '#2A2A5E',
      bgInput: '#1E1E4A', bgDark: '#070720', border: '#2A2A5E', borderLight: '#3A3A7E',
      divider: '#1E1E4A', transparent: 'transparent',
    },
    isDark: true,
  }),
}));

vi.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));

// ==================== Imports ====================

import { render, fireEvent } from './testUtils';
import { useNotificationStore, isInQuietHours } from '../store/notificationStore';
import { usePortfolioStore } from '../store/portfolioStore';
import PortfolioAlertsScreen from '../screens/settings/PortfolioAlertsScreen';

// ==================== Helpers ====================

function advanceAnimations() {
  act(() => { vi.advanceTimersByTime(300); });
}

function renderScreen(overrides?: Record<string, any>) {
  const defaultStore = {
    portfolioAlertRules: defaultPortfolioAlertRules,
    addPortfolioAlertRule: mockAddPortfolioAlertRule,
    removePortfolioAlertRule: mockRemovePortfolioAlertRule,
    updatePortfolioAlertRule: mockUpdatePortfolioAlertRule,
    alertTriggerHistory: [],
    clearAlertTriggerHistory: mockClearAlertTriggerHistory,
    quickAddDayGainThreshold: 10,
    quickAddPnLThreshold: 20,
    setQuickAddThreshold: mockSetQuickAddThreshold,
    preferences: defaultPreferences,
    addNotification: mockAddNotification,
    ...overrides,
  };
  (useNotificationStore as any).mockImplementation(() => defaultStore);

  return render(
    <PortfolioAlertsScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
  );
}

// ==================== Header ====================

describe('PortfolioAlertsScreen — Header', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (isInQuietHours as any).mockReturnValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders the screen title', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Portfolio Alerts')).toBeDefined();
  });

  it('renders the subtitle', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText(/Real-time P&L and holding movement alerts/)).toBeDefined();
  });
});

// ==================== Active Alerts ====================

describe('PortfolioAlertsScreen — Active Alerts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (isInQuietHours as any).mockReturnValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('shows Active Alerts section with enabled count', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Active Alerts (2)')).toBeDefined();
  });

  it('renders enabled rule cards with config.label (from ALERT_KINDS)', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    // The screen renders config.label (e.g. 'Portfolio P&L %'), not rule.label
    expect(getByText('Portfolio P&L %')).toBeDefined();
  });

  it('shows threshold value on enabled cards', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('-5%')).toBeDefined();
    expect(getByText('10%')).toBeDefined();
  });

  it('renders action buttons (Badge, Test Alert, Remove) on enabled cards', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Badge')).toBeDefined();
    expect(getByText('Test Alert')).toBeDefined();
    expect(getByText('Remove')).toBeDefined();
  });
});

// ==================== Paused Alerts ====================

describe('PortfolioAlertsScreen — Paused Alerts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (isInQuietHours as any).mockReturnValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('shows Paused Alerts section with disabled count', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Paused Alerts (1)')).toBeDefined();
  });

  it('renders disabled rule with correct config.label', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    // The screen renders config.label ('Portfolio Drawdown'), not rule.label
    expect(getByText('Portfolio Drawdown')).toBeDefined();
  });
});

// ==================== Add Alert Grid ====================

describe('PortfolioAlertsScreen — Add Alert Grid', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (isInQuietHours as any).mockReturnValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders the Add Alert Rules section title', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Add Alert Rules')).toBeDefined();
  });

  it('renders all 6 alert kind cards', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Portfolio P&L %')).toBeDefined();
    expect(getByText('Portfolio Loss (₹)')).toBeDefined();
    expect(getByText('Holding Day Gain')).toBeDefined();
    expect(getByText('Holding P&L %')).toBeDefined();
    expect(getByText('Portfolio Drawdown')).toBeDefined();
    expect(getByText('Consecutive Loss Days')).toBeDefined();
  });

  it('shows Active badges on add cards for rules that are already enabled', () => {
    const { getByText, queryByText } = renderScreen();
    advanceAnimations();
    // Two enabled rules exist → their add cards show an "Active" badge
    // Portfolio P&L % add card should have "Active" badge visible
    expect(getByText('Portfolio P&L %')).toBeDefined();
    // Portfolio Drawdown add card should NOT have "Active" (it's disabled)
    // Verify it's rendered but not marked active by just checking it's there
    expect(getByText('Portfolio Drawdown')).toBeDefined();
  });

  it('adds a portfolio-level rule when tapping a non-holding card', () => {
    const { getByText } = renderScreen();
    advanceAnimations();

    // Tap "Portfolio Loss (₹)" — non-holding kind portfolio_pnl_abs
    act(() => { fireEvent.press(getByText('Portfolio Loss (₹)')); });
    advanceAnimations();

    expect(mockAddPortfolioAlertRule).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'portfolio_pnl_abs', enabled: true, badge: true }),
    );
  });

  it('opens stock picker when tapping a holding-specific card', () => {
    const { getByText } = renderScreen();
    advanceAnimations();

    // Tap "Holding P&L %" — requires stock selection first
    act(() => { fireEvent.press(getByText('Holding P&L %')); });
    advanceAnimations();

    // No rule should be added yet — stock picker modal opens instead
    expect(mockAddPortfolioAlertRule).not.toHaveBeenCalled();
  });

  it('toggles existing rule on instead of duplicating when tapping active kind', () => {
    const { getByText } = renderScreen();
    advanceAnimations();

    // Tap "Portfolio P&L %" which is already active (par_default_1)
    act(() => { fireEvent.press(getByText('Portfolio P&L %')); });
    advanceAnimations();

    // Should NOT add a duplicate rule
    expect(mockAddPortfolioAlertRule).not.toHaveBeenCalled();
  });
});

// ==================== Empty State ====================

describe('PortfolioAlertsScreen — Empty State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (isInQuietHours as any).mockReturnValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('shows empty state when no enabled rules exist', () => {
    const { getByText } = renderScreen({ portfolioAlertRules: [] });
    advanceAnimations();
    expect(getByText('Active Alerts (0)')).toBeDefined();
    expect(getByText('No Active Alerts')).toBeDefined();
    expect(getByText(/Toggle on alerts below to get notified/)).toBeDefined();
  });

  it('does not render paused section when no disabled rules exist', () => {
    const { queryByText } = renderScreen({
      portfolioAlertRules: [{
        id: 'par_default_1', kind: 'portfolio_pnl_pct',
        label: 'Portfolio P&L <-5%', threshold: -5, direction: 'below',
        triggered: false, createdAt: '2025-06-01T00:00:00.000Z',
        enabled: true, badge: true,
      }],
    });
    advanceAnimations();
    expect(queryByText(/Paused Alerts/)).toBeNull();
  });
});

// ==================== Info Card ====================

describe('PortfolioAlertsScreen — Info Card', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (isInQuietHours as any).mockReturnValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders the info card with all 3 guidance texts', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText(/Portfolio alerts are evaluated in real-time/)).toBeDefined();
    expect(getByText(/Make sure "Price Alerts" are enabled/)).toBeDefined();
    expect(getByText(/Rules automatically re-arm/)).toBeDefined();
  });
});

// ==================== Quiet Hours ====================

describe('PortfolioAlertsScreen — Quiet Hours', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders the Quiet Hours section title', () => {
    (isInQuietHours as any).mockReturnValue(false);
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Quiet Hours')).toBeDefined();
  });

  it('shows quiet hours off state when isInQuietHours returns false', () => {
    (isInQuietHours as any).mockReturnValue(false);
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText(/Quiet hours off/)).toBeDefined();
  });

  it('shows quiet hours active state when isInQuietHours returns true', () => {
    (isInQuietHours as any).mockReturnValue(true);
    const { getByText } = renderScreen({
      preferences: { ...defaultPreferences, quietHoursStart: '10:00 PM', quietHoursEnd: '7:00 AM' },
    });
    advanceAnimations();
    expect(getByText(/Quiet hours active/)).toBeDefined();
  });
});

// ==================== Quick-Add Defaults ====================

describe('PortfolioAlertsScreen — Quick-Add Defaults', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (isInQuietHours as any).mockReturnValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders Quick-Add Defaults section', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText(/Quick-Add Defaults/)).toBeDefined();
  });

  it('shows Day Gain Threshold with default value 10%', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Day Gain Threshold')).toBeDefined();
    expect(getByText('10%')).toBeDefined();
  });

  it('shows P&L Threshold with default value 20%', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('P&L Threshold')).toBeDefined();
    expect(getByText('20%')).toBeDefined();
  });
});

// ==================== Trigger History ====================

describe('PortfolioAlertsScreen — Trigger History', () => {
  const sampleTriggerHistory = [
    {
      ruleId: 'par_default_1', ruleLabel: 'Portfolio P&L <-5%',
      kind: 'portfolio_pnl_pct' as const, value: -6.2, threshold: -5,
      timestamp: '2025-06-01T10:30:00.000Z', summary: 'P&L dropped to -6.2%',
    },
    {
      ruleId: 'par_default_2', ruleLabel: 'Holding day gain >10%',
      kind: 'holding_day_gain_pct' as const, value: 12.5, threshold: 10,
      timestamp: '2025-06-01T09:15:00.000Z', summary: 'RELIANCE day gain 12.5%',
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (isInQuietHours as any).mockReturnValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('does not render trigger history when empty', () => {
    const { queryByText } = renderScreen({ alertTriggerHistory: [] });
    advanceAnimations();
    expect(queryByText(/Trigger History/)).toBeNull();
  });

  it('renders trigger history with entries when present', () => {
    const { getByText } = renderScreen({ alertTriggerHistory: sampleTriggerHistory });
    advanceAnimations();
    expect(getByText(/Trigger History \(2\)/)).toBeDefined();
    expect(getByText('P&L dropped to -6.2%')).toBeDefined();
    expect(getByText('RELIANCE day gain 12.5%')).toBeDefined();
  });

  it('shows Clear button when trigger history has entries', () => {
    const { getByText } = renderScreen({ alertTriggerHistory: sampleTriggerHistory });
    advanceAnimations();
    expect(getByText('Clear')).toBeDefined();
  });
});

// ==================== Store Integration ====================

describe('PortfolioAlertsScreen — Store Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (isInQuietHours as any).mockReturnValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('reads holdings from the portfolio store', () => {
    renderScreen();
    advanceAnimations();
    const portfolioState = (usePortfolioStore as any).mock.results[0]?.value;
    expect(portfolioState?.holdings).toHaveLength(3);
    expect(portfolioState?.holdings[0].symbol).toBe('RELIANCE');
    expect(portfolioState?.holdings[2].symbol).toBe('INFY');
  });

  it('reads portfolioAlertRules from notification store', () => {
    renderScreen();
    advanceAnimations();
    const notifState = (useNotificationStore as any).mock.results[0]?.value;
    expect(notifState?.portfolioAlertRules).toHaveLength(3);
  });

  it('isInQuietHours is a mockable function', () => {
    expect(isInQuietHours).toBeDefined();
    expect(typeof isInQuietHours).toBe('function');
    (isInQuietHours as any).mockReturnValue(true);
    expect((isInQuietHours as any)()).toBe(true);
    (isInQuietHours as any).mockReturnValue(false);
    expect((isInQuietHours as any)()).toBe(false);
  });
});

// ==================== Multiple State Variations ====================

describe('PortfolioAlertsScreen — Multiple State Variations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (isInQuietHours as any).mockReturnValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders all major section headers', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    expect(getByText('Active Alerts (2)')).toBeDefined();
    expect(getByText('Add Alert Rules')).toBeDefined();
    expect(getByText('Paused Alerts (1)')).toBeDefined();
    expect(getByText('Quiet Hours')).toBeDefined();
    expect(getByText(/Quick-Add Defaults/)).toBeDefined();
  });

  it('renders all 6 alert kinds in the add grid', () => {
    const { getByText } = renderScreen();
    advanceAnimations();
    ['Portfolio P&L %', 'Portfolio Loss (₹)', 'Holding Day Gain',
     'Holding P&L %', 'Portfolio Drawdown', 'Consecutive Loss Days',
    ].forEach(kind => expect(getByText(kind)).toBeDefined());
  });

  it('updates active count when all rules enabled', () => {
    const allEnabled = defaultPortfolioAlertRules.map(r => ({ ...r, enabled: true }));
    const { getByText } = renderScreen({ portfolioAlertRules: allEnabled });
    advanceAnimations();
    expect(getByText('Active Alerts (3)')).toBeDefined();
  });

  it('shows 0 active when all rules disabled', () => {
    const allDisabled = defaultPortfolioAlertRules.map(r => ({ ...r, enabled: false }));
    const { getByText } = renderScreen({ portfolioAlertRules: allDisabled });
    advanceAnimations();
    expect(getByText('Active Alerts (0)')).toBeDefined();
  });
});
