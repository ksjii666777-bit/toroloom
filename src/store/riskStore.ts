/**
 * ============================================================================
 * Toroloom Risk Store — Frontend Financial Bodyguard Bridge
 * ============================================================================
 *
 * This Zustand store mirrors the backend RiskEngine state on the client side.
 * It is the UI's gateway to the Financial Bodyguard protocol.
 *
 * LOCKDOWN UI RULES:
 *   - isLockdownActive → Freeze Buy/Add/Modify buttons
 *   - isLockdownActive → Only Show "SQUARE OFF" / "Exit" actions
 *   - Lockdown banner shows at screen top with countdown timer
 *   - Settings/limits page shows frozen state with lock icon
 *
 * USAGE:
 *   const lockdown = useRiskStore(s => s.lockdown);
 *   const canTrade = useRiskStore(s => s.lockdown.status === 'none');
 *   const exitOnly = useRiskStore(s => s.exitOnly);
 */

import { create } from 'zustand';
import { api } from '../services/api';
import { getActiveWS } from '../services/wsRegistry';

// ==================== Types ====================

export interface LockdownState {
  status: 'none' | 'active' | 'cooldown';
  triggeredAt: string | null;
  liftsAt: string | null;
  triggerLoss: number | null;
  breachedLimit: 'daily_loss' | 'daily_loss_percent' | null;
}

export interface DailyMTM {
  date: string;
  realizedPnL: number;
  unrealizedPnL: number;
  peakValue: number;
  totalCharges: number;
  tradeCount: number;
}

export interface RiskLimits {
  dailyLossLimit: number;
  dailyLossPercentLimit: number;
  maxPositionSizePercent: number;
  maxLeverage: number;
  allowIntraday: boolean;
  allowFNO: boolean;
}

export interface RiskStoreState {
  lockdown: LockdownState;
  today: DailyMTM;
  limits: RiskLimits;
  settingsFrozen: boolean;
  portfolioValueAtOpen: number;
  isLoading: boolean;
  error: string | null;

  /**
   * Running count of lockdown-trigger events received via WebSocket.
   * Used by the tab badge to alert the user that lockdown events occurred.
   * Call `clearLockdownAlert()` to reset to 0.
   */
  wsLockdownCount: number;

  syncFromBackend: () => Promise<void>;
  /**
   * Start listening for real-time risk events pushed via WebSocket.
   * Registers P&L update and lockdown callbacks on the mock WebSocket
   * service.  Safe to call multiple times — callbacks are idempotent.
   */
  listenToWS: () => void;
  /** Stop listening to WebSocket risk events and clean up callbacks. */
  stopListeningToWS: () => void;
  /** Reset wsLockdownCount to 0 (user has acknowledged the alert). */
  clearLockdownAlert: () => void;
  checkActionAllowed: (actionType: 'BUY' | 'SELL' | 'SQUARE_OFF' | 'MODIFY') => {
    allowed: boolean;
    reason?: string;
  };
  updateLimits: (newLimits: Partial<RiskLimits>) => Promise<{ success: boolean; message: string }>;
  resetDaily: () => void;
}

// ==================== Selectors ====================

export const selectIsLockdownActive = (state: RiskStoreState) =>
  state.lockdown.status === 'active' || state.lockdown.status === 'cooldown';

export const selectCanTrade = (state: RiskStoreState) =>
  state.lockdown.status === 'none';

export const selectExitOnlyMode = (state: RiskStoreState) =>
  state.lockdown.status === 'active' || state.lockdown.status === 'cooldown';

export const selectDailyPnL = (state: RiskStoreState) =>
  state.today.realizedPnL + state.today.unrealizedPnL;

export const selectDailyLossPercent = (state: RiskStoreState) =>
  state.portfolioValueAtOpen > 0
    ? Math.round((Math.abs(state.today.realizedPnL + state.today.unrealizedPnL) / state.portfolioValueAtOpen) * 10000) / 100
    : 0;

// ==================== Store ====================

const initialLockdown: LockdownState = {
  status: 'none',
  triggeredAt: null,
  liftsAt: null,
  triggerLoss: null,
  breachedLimit: null,
};

const initialMTM: DailyMTM = {
  date: new Date().toISOString().split('T')[0],
  realizedPnL: 0,
  unrealizedPnL: 0,
  peakValue: 0,
  totalCharges: 0,
  tradeCount: 0,
};

const initialLimits: RiskLimits = {
  dailyLossLimit: 50000,
  dailyLossPercentLimit: 5,
  maxPositionSizePercent: 20,
  maxLeverage: 2,
  allowIntraday: true,
  allowFNO: false,
};

export const useRiskStore = create<RiskStoreState>((set, get) => ({
  lockdown: { ...initialLockdown },
  today: { ...initialMTM },
  limits: { ...initialLimits },
  settingsFrozen: false,
  portfolioValueAtOpen: 0,
  isLoading: false,
  error: null,
  wsLockdownCount: 0,

  syncFromBackend: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get<{
        lockdown: LockdownState;
        today: DailyMTM;
        limits: RiskLimits;
        settingsFrozen: boolean;
        portfolioValueAtOpen: number;
      }>('/risk/state');

      set({
        lockdown: data.lockdown,
        today: data.today,
        limits: data.limits,
        settingsFrozen: data.settingsFrozen,
        portfolioValueAtOpen: data.portfolioValueAtOpen || 0,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  // ── WebSocket Risk Event Listeners ────────────────────────────────────
  //
  // These methods connect the Zustand store to the WebSocket risk bridge.
  // When the backend triggers a lockdown (or the mock simulates one), the
  // WS handler pushes `pnl_update` / `lockdown` messages which flow through
  // mockWebSocket → these callbacks → Zustand re-render.

  listenToWS: () => {
    const state = get();
    const ws = getActiveWS();

    // Pass the store's loss limit to the WS service so it can simulate
    // lockdown detection (only relevant for mock — real WS delegates to backend).
    ws.setLossLimit(state.limits.dailyLossLimit);

    // Listen for P&L updates pushed by the WS risk bridge on every tick.
    // This keeps the frontend's today.unrealizedPnL in sync with market
    // movement without polling /risk/state.
    ws.onPnLUpdateCallback((pnlData) => {
      const current = get();
      set({
        today: {
          ...current.today,
          unrealizedPnL: pnlData.unrealizedPnL,
        },
      });
    });

    // Listen for lockdown events pushed by the server when the Financial
    // Bodyguard triggers (or lifts).  The riskEngine already handles the
    // actual enforcement; this just keeps the UI in sync.
    ws.onLockdownCallback((lockdownData) => {
      const current = get();

      if (lockdownData.status === 'none') {
        // ── Lockdown lifted (P&L recovered above limit) ───────
        // Only reset if we were actually in lockdown.
        if (current.lockdown.status === 'none') return;

        set({
          lockdown: {
            status: 'none',
            triggeredAt: null,
            liftsAt: null,
            triggerLoss: null,
            breachedLimit: null,
          },
          settingsFrozen: false,
        });

        console.log('[RiskStore] Lockdown LIFTED via WebSocket — P&L recovered above limit');
      } else {
        // ── Lockdown triggered ────────────────────────────────
        if (current.lockdown.status !== 'none') return;

        set({
          lockdown: {
            status: lockdownData.status,
            triggeredAt: lockdownData.triggeredAt,
            liftsAt: lockdownData.liftsAt,
            triggerLoss: lockdownData.triggerLoss,
            breachedLimit: lockdownData.breachedLimit,
          },
          settingsFrozen: true,
          wsLockdownCount: current.wsLockdownCount + 1,
        });

        console.log(
          '[RiskStore] Lockdown received via WebSocket — ' +
          `loss ₹${(lockdownData.triggerLoss ?? 0).toLocaleString()}, ` +
          `limit: ${lockdownData.breachedLimit}` +
          ` (count: ${current.wsLockdownCount + 1})`,
        );
      }
    });
  },

  stopListeningToWS: () => {
    const ws = getActiveWS();
    // Clear callbacks by setting no-op handlers.  This is safe because
    // the WS services are singletons; we don't want to null the references
    // since other parts of the app might call listenToWS again.
    ws.onPnLUpdateCallback(() => {});
    ws.onLockdownCallback(() => {});
  },

  clearLockdownAlert: () => {
    set({ wsLockdownCount: 0 });
  },

  checkActionAllowed: (actionType) => {
    const state = get();

    if (actionType === 'SQUARE_OFF') {
      return { allowed: true };
    }

    if (state.lockdown.status === 'active' || state.lockdown.status === 'cooldown') {
      const liftsAt = state.lockdown.liftsAt
        ? new Date(state.lockdown.liftsAt).toLocaleTimeString()
        : 'soon';
      return {
        allowed: false,
        reason: `🔒 Financial Bodyguard active. Only SQUARE OFF orders permitted. Lockdown lifts at ${liftsAt}.`,
      };
    }

    return { allowed: true };
  },

  updateLimits: async (newLimits) => {
    const state = get();
    if (state.settingsFrozen) {
      const liftsAt = state.lockdown.liftsAt
        ? new Date(state.lockdown.liftsAt).toLocaleString()
        : 'unknown';
      return {
        success: false,
        message: `⚠️ Risk settings are frozen due to an active Financial Bodyguard lockdown. Settings will unlock at ${liftsAt}.`,
      };
    }

    try {
      const data = await api.put<{ success: boolean; message: string }>('/risk/limits', newLimits);
      if (data.success) {
        set({ limits: { ...state.limits, ...newLimits } });
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  resetDaily: () => {
    set({
      today: {
        date: new Date().toISOString().split('T')[0],
        realizedPnL: 0,
        unrealizedPnL: 0,
        peakValue: 0,
        totalCharges: 0,
        tradeCount: 0,
      },
    });
  },
}));
