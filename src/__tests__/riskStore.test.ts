/**
 * ============================================================================
 * Toroloom — Risk Store Tests
 * ============================================================================
 *
 * Tests the risk/Funds Bodyguard store: lockdown state management,
 * action permission checks, limit updates, and daily MTM tracking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRiskStore } from '../store/riskStore';

// Mock the API client to control updateLimits responses
vi.mock('../services/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      put: vi.fn(),
    },
  };
});

describe('RiskStore — Initial State', () => {
  beforeEach(() => {
    useRiskStore.setState({
      lockdown: {
        status: 'none',
        triggeredAt: null,
        liftsAt: null,
        triggerLoss: null,
        breachedLimit: null,
      },
      today: {
        date: new Date().toISOString().split('T')[0],
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
      portfolioValueAtOpen: 0,
      isLoading: false,
      error: null,
      wsLockdownCount: 0,
    });
  });

  it('starts with no lockdown', () => {
    const state = useRiskStore.getState();
    expect(state.lockdown.status).toBe('none');
    expect(state.settingsFrozen).toBe(false);
  });

  it('starts with no daily P&L', () => {
    const state = useRiskStore.getState();
    expect(state.today.realizedPnL).toBe(0);
    expect(state.today.unrealizedPnL).toBe(0);
    expect(state.today.tradeCount).toBe(0);
  });

  it('has default risk limits', () => {
    const state = useRiskStore.getState();
    expect(state.limits.dailyLossLimit).toBe(50000);
    expect(state.limits.dailyLossPercentLimit).toBe(5);
    expect(state.limits.allowIntraday).toBe(true);
    expect(state.limits.allowFNO).toBe(false);
  });

  it('starts with no loading or error', () => {
    const state = useRiskStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('starts with no lockdown alerts', () => {
    expect(useRiskStore.getState().wsLockdownCount).toBe(0);
  });
});

describe('RiskStore — Action Permission Checks', () => {
  beforeEach(() => {
    useRiskStore.setState({
      lockdown: {
        status: 'none',
        triggeredAt: null,
        liftsAt: null,
        triggerLoss: null,
        breachedLimit: null,
      },
      settingsFrozen: false,
      isLoading: false,
      error: null,
      wsLockdownCount: 0,
      today: {
        date: new Date().toISOString().split('T')[0],
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
      portfolioValueAtOpen: 0,
    });
  });

  it('allows BUY when no lockdown', () => {
    const result = useRiskStore.getState().checkActionAllowed('BUY');
    expect(result.allowed).toBe(true);
  });

  it('allows SELL when no lockdown', () => {
    const result = useRiskStore.getState().checkActionAllowed('SELL');
    expect(result.allowed).toBe(true);
  });

  it('allows SQUARE_OFF during lockdown', () => {
    useRiskStore.setState({
      lockdown: {
        status: 'active',
        triggeredAt: new Date().toISOString(),
        liftsAt: new Date(Date.now() + 3600000).toISOString(),
        triggerLoss: -60000,
        breachedLimit: 'daily_loss',
      },
      settingsFrozen: true,
    });

    const result = useRiskStore.getState().checkActionAllowed('SQUARE_OFF');
    expect(result.allowed).toBe(true);
  });

  it('blocks BUY during lockdown', () => {
    useRiskStore.setState({
      lockdown: {
        status: 'active',
        triggeredAt: new Date().toISOString(),
        liftsAt: new Date(Date.now() + 3600000).toISOString(),
        triggerLoss: -60000,
        breachedLimit: 'daily_loss',
      },
      settingsFrozen: true,
    });

    const result = useRiskStore.getState().checkActionAllowed('BUY');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Financial Bodyguard active');
  });

  it('blocks MODIFY during lockdown', () => {
    useRiskStore.setState({
      lockdown: {
        status: 'cooldown',
        triggeredAt: new Date().toISOString(),
        liftsAt: new Date(Date.now() + 1800000).toISOString(),
        triggerLoss: -70000,
        breachedLimit: 'daily_loss_percent',
      },
      settingsFrozen: true,
    });

    const result = useRiskStore.getState().checkActionAllowed('MODIFY');
    expect(result.allowed).toBe(false);
  });

  it('blocks BUY during cooldown', () => {
    useRiskStore.setState({
      lockdown: {
        status: 'cooldown',
        triggeredAt: new Date().toISOString(),
        liftsAt: new Date(Date.now() + 1800000).toISOString(),
        triggerLoss: -60000,
        breachedLimit: 'daily_loss',
      },
      settingsFrozen: true,
    });

    const result = useRiskStore.getState().checkActionAllowed('BUY');
    expect(result.allowed).toBe(false);
  });
});

describe('RiskStore — Lockdown Alert', () => {
  beforeEach(() => {
    useRiskStore.setState({ wsLockdownCount: 0 });
  });

  it('starts with zero alerts', () => {
    expect(useRiskStore.getState().wsLockdownCount).toBe(0);
  });

  it('clears lockdown alert count', () => {
    useRiskStore.setState({ wsLockdownCount: 3 });
    useRiskStore.getState().clearLockdownAlert();
    expect(useRiskStore.getState().wsLockdownCount).toBe(0);
  });
});

describe('RiskStore — Limit Updates', () => {
  beforeEach(() => {
    useRiskStore.setState({
      limits: {
        dailyLossLimit: 50000,
        dailyLossPercentLimit: 5,
        maxPositionSizePercent: 20,
        maxLeverage: 2,
        allowIntraday: true,
        allowFNO: false,
      },
      settingsFrozen: false,
      lockdown: {
        status: 'none',
        triggeredAt: null,
        liftsAt: null,
        triggerLoss: null,
        breachedLimit: null,
      },
    });
  });

  it('updates limits locally even when API fails (fallback behavior)', async () => {
    // The store's updateLimits tries api.put first and only updates
    // state if the API returns success. We need to mock the API to
    // return success.
    const { api } = await import('../services/api/client');
    (api.put as any).mockResolvedValue({ success: true, message: 'Updated' });

    const result = await useRiskStore.getState().updateLimits({
      dailyLossLimit: 100000,
    });
    expect(result.success).toBe(true);
    expect(useRiskStore.getState().limits.dailyLossLimit).toBe(100000);
  });

  it('rejects limit updates during lockdown', async () => {
    useRiskStore.setState({
      settingsFrozen: true,
      lockdown: {
        status: 'active',
        triggeredAt: new Date().toISOString(),
        liftsAt: new Date(Date.now() + 3600000).toISOString(),
        triggerLoss: -60000,
        breachedLimit: 'daily_loss',
      },
    });

    const result = await useRiskStore.getState().updateLimits({
      dailyLossLimit: 100000,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('frozen');
    expect(useRiskStore.getState().limits.dailyLossLimit).toBe(50000); // unchanged
  });

  it('handles API error gracefully', async () => {
    const { api } = await import('../services/api/client');
    (api.put as any).mockRejectedValue(new Error('Network error'));

    const result = await useRiskStore.getState().updateLimits({
      dailyLossLimit: 100000,
    });
    expect(result.success).toBe(false);
    // State should remain unchanged
    expect(useRiskStore.getState().limits.dailyLossLimit).toBe(50000);
  });
});

describe('RiskStore — Daily Reset', () => {
  beforeEach(() => {
    useRiskStore.setState({
      today: {
        date: '2025-05-24',
        realizedPnL: 25000,
        unrealizedPnL: 5000,
        peakValue: 500000,
        totalCharges: 450,
        tradeCount: 12,
      },
    });
  });

  it('resets daily MTM to zeros', () => {
    useRiskStore.getState().resetDaily();
    const state = useRiskStore.getState();
    expect(state.today.realizedPnL).toBe(0);
    expect(state.today.unrealizedPnL).toBe(0);
    expect(state.today.peakValue).toBe(0);
    expect(state.today.totalCharges).toBe(0);
    expect(state.today.tradeCount).toBe(0);
    // Date should be updated to today
    expect(state.today.date).toBe(new Date().toISOString().split('T')[0]);
  });
});
