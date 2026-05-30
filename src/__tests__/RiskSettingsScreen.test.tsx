import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', marketUp: '#00C853', marketDown: '#FF1744',
      bgCard: '#1A1A2E', bgCardLight: '#25253D', bgInput: '#1E1E32', border: '#2A2A44',
      divider: '#2A2A44', bgSecondary: '#16162A', warning: '#FFC107', borderLight: '#3A3A54',
      white: '#FFFFFF', transparent: 'transparent', danger: '#FF1744',
    },
  }),
}));

const mockNavigate = vi.fn();
const mockSyncFromBackend = vi.fn();
const mockCheckActionAllowed = vi.fn(() => ({ allowed: true }));
const mockUpdateLimits = vi.fn(() => Promise.resolve({ success: true, message: '' }));
const mockResetDaily = vi.fn();

let mockStoreState: any = {};

vi.mock('../store/riskStore', () => ({
  useRiskStore: () => mockStoreState,
  selectIsLockdownActive: (state: any) =>
    state.lockdown.status === 'active' || state.lockdown.status === 'cooldown',
  selectCanTrade: (state: any) => state.lockdown.status === 'none',
  selectExitOnlyMode: (state: any) =>
    state.lockdown.status === 'active' || state.lockdown.status === 'cooldown',
  selectDailyPnL: (state: any) => state.today.realizedPnL + state.today.unrealizedPnL,
  selectDailyLossPercent: (state: any) =>
    state.portfolioValueAtOpen > 0
      ? Math.round(
          (Math.abs(state.today.realizedPnL + state.today.unrealizedPnL) /
            state.portfolioValueAtOpen) *
            10000,
        ) / 100
      : 0,
}));

import RiskSettingsScreen from '../screens/settings/RiskSettingsScreen';

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState = {
    lockdown: {
      status: 'none' as const,
      triggeredAt: null,
      liftsAt: null,
      triggerLoss: null,
      breachedLimit: null,
    },
    today: {
      date: '2026-01-15',
      realizedPnL: 0,
      unrealizedPnL: 0,
      peakValue: 0,
      totalCharges: 0,
      tradeCount: 0,
    },
    limits: {
      dailyLossLimit: 50000,
      dailyLossPercentLimit: 5,
      maxPositionSizePercent: 20,
      maxLeverage: 2,
      allowIntraday: true,
      allowFNO: false,
    },
    settingsFrozen: false,
    portfolioValueAtOpen: 1000000,
    syncFromBackend: mockSyncFromBackend,
    checkActionAllowed: mockCheckActionAllowed,
    updateLimits: mockUpdateLimits,
    resetDaily: mockResetDaily,
  };
});

describe('RiskSettingsScreen', () => {
  it('renders the screen title and subtitle', () => {
    const { getByText } = render(
      <RiskSettingsScreen navigation={{ navigate: mockNavigate } as any} />,
    );
    expect(getByText('Risk Settings')).toBeDefined();
    expect(getByText('Financial Bodyguard controls')).toBeDefined();
  });

  it('renders tab toggle buttons', () => {
    const { getByText } = render(
      <RiskSettingsScreen navigation={{ navigate: mockNavigate } as any} />,
    );
    expect(getByText('Limits')).toBeDefined();
    expect(getByText('Status')).toBeDefined();
  });

  it('renders the Risk Limits card with limit labels', () => {
    const { getByText } = render(
      <RiskSettingsScreen navigation={{ navigate: mockNavigate } as any} />,
    );
    expect(getByText('Risk Limits')).toBeDefined();
    expect(getByText('Daily Loss Limit')).toBeDefined();
    expect(getByText('Max Leverage')).toBeDefined();
  });

  it('renders Trade Action Check card', () => {
    const { getByText } = render(
      <RiskSettingsScreen navigation={{ navigate: mockNavigate } as any} />,
    );
    expect(getByText('Trade Action Check')).toBeDefined();
    expect(getByText('Buy Stocks')).toBeDefined();
    expect(getByText('Sell Stocks')).toBeDefined();
    expect(getByText('Square Off')).toBeDefined();
    expect(getByText('Modify Orders')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(
      <RiskSettingsScreen navigation={{ navigate: mockNavigate } as any} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
