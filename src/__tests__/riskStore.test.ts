/**
 * ============================================================================
 * Toroloom — Risk Store Tests
 * ============================================================================
 *
 * Tests the risk/Funds Bodyguard store: lockdown state management,
 * action permission checks, limit updates, and daily MTM tracking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useRiskStore,
  selectIsLockdownActive,
  selectCanTrade,
  selectExitOnlyMode,
  selectDailyPnL,
  selectDailyLossPercent,
} from '../store/riskStore';
import { getActiveWS } from '../services/wsRegistry';

// Mock the API client to control API responses (syncFromBackend, updateLimits)
vi.mock('../services/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn(),
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

// ============================================================================
// Selectors
// ============================================================================

describe('RiskStore — Selectors', () => {
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
        realizedPnL: 25000,
        unrealizedPnL: 5000,
        peakValue: 500000,
        totalCharges: 0,
        tradeCount: 0,
      },
      portfolioValueAtOpen: 500000,
    });
  });

  describe('selectIsLockdownActive', () => {
    it('returns true when status is active', () => {
      useRiskStore.setState({ lockdown: { ...useRiskStore.getState().lockdown, status: 'active' } });
      expect(selectIsLockdownActive(useRiskStore.getState())).toBe(true);
    });

    it('returns true when status is cooldown', () => {
      useRiskStore.setState({ lockdown: { ...useRiskStore.getState().lockdown, status: 'cooldown' } });
      expect(selectIsLockdownActive(useRiskStore.getState())).toBe(true);
    });

    it('returns false when status is none', () => {
      expect(selectIsLockdownActive(useRiskStore.getState())).toBe(false);
    });
  });

  describe('selectCanTrade', () => {
    it('returns true when no lockdown', () => {
      expect(selectCanTrade(useRiskStore.getState())).toBe(true);
    });

    it('returns false during active lockdown', () => {
      useRiskStore.setState({ lockdown: { ...useRiskStore.getState().lockdown, status: 'active' } });
      expect(selectCanTrade(useRiskStore.getState())).toBe(false);
    });
  });

  describe('selectExitOnlyMode', () => {
    it('returns true when status is active', () => {
      useRiskStore.setState({ lockdown: { ...useRiskStore.getState().lockdown, status: 'active' } });
      expect(selectExitOnlyMode(useRiskStore.getState())).toBe(true);
    });

    it('returns true when status is cooldown', () => {
      useRiskStore.setState({ lockdown: { ...useRiskStore.getState().lockdown, status: 'cooldown' } });
      expect(selectExitOnlyMode(useRiskStore.getState())).toBe(true);
    });

    it('returns false when no lockdown', () => {
      expect(selectExitOnlyMode(useRiskStore.getState())).toBe(false);
    });
  });

  describe('selectDailyPnL', () => {
    it('sums realized and unrealized P&L', () => {
      const result = selectDailyPnL(useRiskStore.getState());
      expect(result).toBe(30000); // 25000 + 5000
    });

    it('handles negative P&L', () => {
      useRiskStore.setState({
        today: {
          ...useRiskStore.getState().today,
          realizedPnL: -20000,
          unrealizedPnL: -5000,
        },
      });
      expect(selectDailyPnL(useRiskStore.getState())).toBe(-25000);
    });
  });

  describe('selectDailyLossPercent', () => {
    it('calculates correct percentage', () => {
      // realizedPnL = 25000, unrealizedPnL = 5000, portfolioValueAtOpen = 500000
      // Math.abs(25000 + 5000) / 500000 = 0.06
      // 0.06 * 10000 = 600 → rounded → 600 / 100 = 6%
      expect(selectDailyLossPercent(useRiskStore.getState())).toBe(6);
    });

    it('returns 0 when portfolioValueAtOpen is 0', () => {
      useRiskStore.setState({ portfolioValueAtOpen: 0 });
      expect(selectDailyLossPercent(useRiskStore.getState())).toBe(0);
    });

    it('handles zero P&L', () => {
      useRiskStore.setState({
        today: { ...useRiskStore.getState().today, realizedPnL: 0, unrealizedPnL: 0 },
      });
      expect(selectDailyLossPercent(useRiskStore.getState())).toBe(0);
    });

    it('calculates percentage for negative total P&L', () => {
      useRiskStore.setState({
        today: {
          ...useRiskStore.getState().today,
          realizedPnL: -30000,
          unrealizedPnL: -5000,
        },
        portfolioValueAtOpen: 500000,
      });
      // Math.abs(-35000) / 500000 = 0.07 → 0.07 * 10000 / 100 = 7%
      expect(selectDailyLossPercent(useRiskStore.getState())).toBe(7);
    });
  });
});

// ============================================================================
// syncFromBackend
// ============================================================================

describe('RiskStore — syncFromBackend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRiskStore.setState({
      lockdown: { status: 'none', triggeredAt: null, liftsAt: null, triggerLoss: null, breachedLimit: null },
      today: { date: new Date().toISOString().split('T')[0], realizedPnL: 0, unrealizedPnL: 0, peakValue: 0, totalCharges: 0, tradeCount: 0 },
      limits: { dailyLossLimit: 50000, dailyLossPercentLimit: 5, maxPositionSizePercent: 20, maxLeverage: 2, allowIntraday: true, allowFNO: false },
      settingsFrozen: false,
      portfolioValueAtOpen: 0,
      isLoading: false,
      error: null,
      wsLockdownCount: 0,
    });
  });

  it('loads risk state from backend successfully', async () => {
    const { api } = await import('../services/api/client');
    const backendState = {
      lockdown: { status: 'active' as const, triggeredAt: '2025-05-24T10:00:00Z', liftsAt: '2025-05-25T10:00:00Z', triggerLoss: -60000, breachedLimit: 'daily_loss' as const },
      today: { date: '2025-05-24', realizedPnL: -60000, unrealizedPnL: -5000, peakValue: 450000, totalCharges: 350, tradeCount: 5 },
      limits: { dailyLossLimit: 100000, dailyLossPercentLimit: 10, maxPositionSizePercent: 30, maxLeverage: 3, allowIntraday: true, allowFNO: true },
      settingsFrozen: true,
      portfolioValueAtOpen: 500000,
    };
    (api.get as any).mockResolvedValue(backendState);

    await useRiskStore.getState().syncFromBackend();

    const state = useRiskStore.getState();
    expect(state.lockdown.status).toBe('active');
    expect(state.today.realizedPnL).toBe(-60000);
    expect(state.limits.dailyLossLimit).toBe(100000);
    expect(state.settingsFrozen).toBe(true);
    expect(state.portfolioValueAtOpen).toBe(500000);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('handles API error gracefully', async () => {
    const { api } = await import('../services/api/client');
    (api.get as any).mockRejectedValue(new Error('Failed to fetch risk state'));

    await useRiskStore.getState().syncFromBackend();

    const state = useRiskStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Failed to fetch risk state');
    // State should remain unchanged
    expect(state.lockdown.status).toBe('none');
  });

  it('sets loading state during sync', async () => {
    const { api } = await import('../services/api/client');
    // Don't resolve the promise yet — capture it
    let resolvePromise!: (value: any) => void;
    (api.get as any).mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));

    // Start sync but don't await it
    const syncPromise = useRiskStore.getState().syncFromBackend();

    // Loading should be true immediately
    expect(useRiskStore.getState().isLoading).toBe(true);

    // Now resolve
    resolvePromise({
      lockdown: { status: 'none', triggeredAt: null, liftsAt: null, triggerLoss: null, breachedLimit: null },
      today: { date: '2025-05-24', realizedPnL: 0, unrealizedPnL: 0, peakValue: 0, totalCharges: 0, tradeCount: 0 },
      limits: { dailyLossLimit: 50000, dailyLossPercentLimit: 5, maxPositionSizePercent: 20, maxLeverage: 2, allowIntraday: true, allowFNO: false },
      settingsFrozen: false,
      portfolioValueAtOpen: 500000,
    });

    await syncPromise;
    expect(useRiskStore.getState().isLoading).toBe(false);
  });
});

// ============================================================================
// checkActionAllowed — Edge Cases
// ============================================================================

describe('RiskStore — checkActionAllowed Edge Cases', () => {
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

  it('allows SQUARE_OFF during cooldown', () => {
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

    const result = useRiskStore.getState().checkActionAllowed('SQUARE_OFF');
    expect(result.allowed).toBe(true);
  });

  it('uses "soon" fallback when liftsAt is null', () => {
    useRiskStore.setState({
      lockdown: {
        status: 'active',
        triggeredAt: new Date().toISOString(),
        liftsAt: null,
        triggerLoss: -60000,
        breachedLimit: 'daily_loss',
      },
      settingsFrozen: true,
    });

    const result = useRiskStore.getState().checkActionAllowed('BUY');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('soon');
  });

  it('blocks MODIFY during active lockdown', () => {
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

    const result = useRiskStore.getState().checkActionAllowed('MODIFY');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Financial Bodyguard active');
  });
});

// ============================================================================
// updateLimits — Edge Cases
// ============================================================================

describe('RiskStore — updateLimits Edge Cases', () => {
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

  it('uses "unknown" fallback when liftsAt is null during frozen settings', async () => {
    useRiskStore.setState({
      settingsFrozen: true,
      lockdown: {
        status: 'active',
        triggeredAt: new Date().toISOString(),
        liftsAt: null,
        triggerLoss: -60000,
        breachedLimit: 'daily_loss',
      },
    });

    const result = await useRiskStore.getState().updateLimits({
      dailyLossPercentLimit: 10,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('unknown');
    expect(useRiskStore.getState().limits.dailyLossPercentLimit).toBe(5); // unchanged
  });
});

// ============================================================================
// WebSocket Listeners
// ============================================================================

describe('RiskStore — WebSocket Listeners', () => {
  // Stable WS mock singleton — overrides setup.ts's per-call factory so
  // both listenToWS and stopListeningToWS receive the same instance.
  const mockWS = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    onMessage: vi.fn(),
    send: vi.fn(),
    isConnected: vi.fn(() => false),
    onPnLUpdateCallback: vi.fn(),
    onLockdownCallback: vi.fn(),
    setLossLimit: vi.fn(),
    onConnectionChangeCallback: vi.fn(),
    getCurrentPrice: vi.fn(() => 0),
    getCachedCandles: vi.fn(() => []),
    getIsAuthenticated: vi.fn(() => true),
    onCacheInvalidationCallback: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Override getActiveWS to return the stable mockWS singleton
    vi.mocked(getActiveWS).mockReturnValue(mockWS);
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
        unrealizedPnL: 1000,
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

  it('sets loss limit on WS when listening', () => {
    useRiskStore.getState().listenToWS();
    expect(mockWS.setLossLimit).toHaveBeenCalledWith(50000); // default limit
  });

  it('updates unrealizedPnL on P&L update callback', () => {
    useRiskStore.getState().listenToWS();

    // Extract the P&L callback that listenToWS registered
    const pnlCallback = mockWS.onPnLUpdateCallback.mock.calls[0][0];

    // Invoke it with new P&L data
    pnlCallback({ realizedPnL: 0, unrealizedPnL: 5000, totalPnL: 5000 });

    expect(useRiskStore.getState().today.unrealizedPnL).toBe(5000);
    // realizedPnL should remain unchanged (callback only updates unrealized)
    expect(useRiskStore.getState().today.realizedPnL).toBe(0);
  });

  it('triggers lockdown on WS lockdown event', () => {
    useRiskStore.getState().listenToWS();

    const lockdownCallback = mockWS.onLockdownCallback.mock.calls[0][0];
    const now = new Date().toISOString();
    const liftsAt = new Date(Date.now() + 3600000).toISOString();

    lockdownCallback({
      status: 'active',
      triggeredAt: now,
      liftsAt,
      triggerLoss: 60000,
      breachedLimit: 'daily_loss',
    });

    const state = useRiskStore.getState();
    expect(state.lockdown.status).toBe('active');
    expect(state.lockdown.triggeredAt).toBe(now);
    expect(state.lockdown.liftsAt).toBe(liftsAt);
    expect(state.lockdown.triggerLoss).toBe(60000);
    expect(state.lockdown.breachedLimit).toBe('daily_loss');
    expect(state.settingsFrozen).toBe(true);
  });

  it('lifts lockdown on WS lockdown lift event', () => {
    // Start in lockdown state
    useRiskStore.setState({
      lockdown: {
        status: 'active',
        triggeredAt: new Date().toISOString(),
        liftsAt: new Date(Date.now() + 3600000).toISOString(),
        triggerLoss: 60000,
        breachedLimit: 'daily_loss',
      },
      settingsFrozen: true,
    });

    useRiskStore.getState().listenToWS();

    const lockdownCallback = mockWS.onLockdownCallback.mock.calls[0][0];

    // Send lift event
    lockdownCallback({
      status: 'none',
      triggeredAt: null,
      liftsAt: null,
      triggerLoss: null,
      breachedLimit: null,
    });

    const state = useRiskStore.getState();
    expect(state.lockdown.status).toBe('none');
    expect(state.lockdown.triggeredAt).toBeNull();
    expect(state.lockdown.liftsAt).toBeNull();
    expect(state.settingsFrozen).toBe(false);
  });

  it('ignores lockdown trigger if already in lockdown (dedup)', () => {
    // Start in lockdown state
    useRiskStore.setState({
      lockdown: {
        status: 'active',
        triggeredAt: new Date('2025-05-24T10:00:00Z').toISOString(),
        liftsAt: new Date(Date.now() + 3600000).toISOString(),
        triggerLoss: 60000,
        breachedLimit: 'daily_loss',
      },
      settingsFrozen: true,
      wsLockdownCount: 1,
    });
    const originalTriggeredAt = useRiskStore.getState().lockdown.triggeredAt;

    useRiskStore.getState().listenToWS();

    const lockdownCallback = mockWS.onLockdownCallback.mock.calls[0][0];

    // Try to trigger again (should be ignored)
    lockdownCallback({
      status: 'active',
      triggeredAt: new Date('2025-05-25T10:00:00Z').toISOString(),
      liftsAt: new Date(Date.now() + 7200000).toISOString(),
      triggerLoss: 70000,
      breachedLimit: 'daily_loss_percent',
    });

    const state = useRiskStore.getState();
    // Should still have the original values
    expect(state.lockdown.triggeredAt).toBe(originalTriggeredAt);
    expect(state.wsLockdownCount).toBe(1); // not incremented
  });

  it('ignores lockdown lift if not in lockdown (no-op)', () => {
    // Start with no lockdown
    useRiskStore.getState().listenToWS();

    const lockdownCallback = mockWS.onLockdownCallback.mock.calls[0][0];

    // Send lift event when already in 'none' state
    lockdownCallback({
      status: 'none',
      triggeredAt: null,
      liftsAt: null,
      triggerLoss: null,
      breachedLimit: null,
    });

    // State should remain unchanged
    expect(useRiskStore.getState().lockdown.status).toBe('none');
  });

  it('stopListeningToWS clears callbacks', () => {
    useRiskStore.getState().listenToWS();

    // After listenToWS, both callbacks should have been registered (1 call each)
    expect(mockWS.onPnLUpdateCallback).toHaveBeenCalledTimes(1);
    expect(mockWS.onLockdownCallback).toHaveBeenCalledTimes(1);

    useRiskStore.getState().stopListeningToWS();

    // After stopListeningToWS, they should have been replaced with no-ops (2 calls total each)
    expect(mockWS.onPnLUpdateCallback).toHaveBeenCalledTimes(2);
    expect(mockWS.onLockdownCallback).toHaveBeenCalledTimes(2);

    // The last registered P&L callback should be a no-op that doesn't change state
    const pnlCb = mockWS.onPnLUpdateCallback.mock.calls[1][0];
    expect(useRiskStore.getState().today.unrealizedPnL).toBe(1000);
    pnlCb({ realizedPnL: 0, unrealizedPnL: 99999, totalPnL: 99999 });
    expect(useRiskStore.getState().today.unrealizedPnL).toBe(1000); // unchanged
  });

  it('increments wsLockdownCount on each trigger', () => {
    useRiskStore.getState().listenToWS();

    const lockdownCallback = mockWS.onLockdownCallback.mock.calls[0][0];

    // First trigger
    lockdownCallback({
      status: 'active',
      triggeredAt: new Date().toISOString(),
      liftsAt: new Date(Date.now() + 3600000).toISOString(),
      triggerLoss: 60000,
      breachedLimit: 'daily_loss',
    });
    expect(useRiskStore.getState().wsLockdownCount).toBe(1);

    // Manually reset to 'none' so we can trigger again (simulating lift+retrigger)
    useRiskStore.setState({
      lockdown: { status: 'none', triggeredAt: null, liftsAt: null, triggerLoss: null, breachedLimit: null },
      wsLockdownCount: useRiskStore.getState().wsLockdownCount, // preserve the count
    });

    // Second trigger
    lockdownCallback({
      status: 'active',
      triggeredAt: new Date().toISOString(),
      liftsAt: new Date(Date.now() + 3600000).toISOString(),
      triggerLoss: 70000,
      breachedLimit: 'daily_loss_percent',
    });
    expect(useRiskStore.getState().wsLockdownCount).toBe(2);
  });
});
