/**
 * ============================================================================
 * Toroloom — Trading Preferences Store Tests
 * ============================================================================
 *
 * Tests the persisted trading-preferences store:
 *   - Initial state (no R:R chosen, not initialized)
 *   - loadPrefs: restores a persisted ratio, handles empty + corrupt storage
 *   - setRewardRiskRatio: updates state immediately and persists
 *   - Persistence failures are non-fatal (in-memory value stays set)
 *   - REWARD_RISK_OPTIONS exposes the 1:2 / 1:3 / 1:5 choices
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}));

import { useTradingPrefsStore, REWARD_RISK_OPTIONS } from '../store/tradingPrefsStore';

const STORAGE_KEY = 'toroloom_trading_prefs';

// ==================== Initial State ====================

describe('TradingPrefsStore — Initial State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTradingPrefsStore.setState({ rewardRiskRatio: null, initialized: false });
  });

  it('starts with no R:R chosen and uninitialized', () => {
    const state = useTradingPrefsStore.getState();
    expect(state.rewardRiskRatio).toBeNull();
    expect(state.initialized).toBe(false);
  });

  it('offers the 1:2, 1:3 and 1:5 reward-risk options', () => {
    expect([...REWARD_RISK_OPTIONS]).toEqual([2, 3, 5]);
  });
});

// ==================== loadPrefs ====================

describe('TradingPrefsStore — loadPrefs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTradingPrefsStore.setState({ rewardRiskRatio: null, initialized: false });
  });

  it('restores a persisted ratio and marks initialized', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(
      JSON.stringify({ rewardRiskRatio: 3 }),
    );

    await useTradingPrefsStore.getState().loadPrefs();

    expect(AsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBe(3);
    expect(useTradingPrefsStore.getState().initialized).toBe(true);
  });

  it('stays null with initialized=true when nothing is persisted', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);

    await useTradingPrefsStore.getState().loadPrefs();

    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBeNull();
    expect(useTradingPrefsStore.getState().initialized).toBe(true);
  });

  it('marks initialized even when storage throws (corrupt/unavailable)', async () => {
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('Storage corrupted'));

    await useTradingPrefsStore.getState().loadPrefs();

    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBeNull();
    expect(useTradingPrefsStore.getState().initialized).toBe(true);
  });

  it('treats a stored null ratio as not-yet-chosen', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(
      JSON.stringify({ rewardRiskRatio: null }),
    );

    await useTradingPrefsStore.getState().loadPrefs();

    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBeNull();
    expect(useTradingPrefsStore.getState().initialized).toBe(true);
  });
});

// ==================== setRewardRiskRatio ====================

describe('TradingPrefsStore — setRewardRiskRatio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTradingPrefsStore.setState({ rewardRiskRatio: null, initialized: true });
  });

  it('updates state immediately and persists the choice', async () => {
    await useTradingPrefsStore.getState().setRewardRiskRatio(5);

    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBe(5);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify({ rewardRiskRatio: 5 }),
    );
  });

  it('keeps the in-memory value when persistence fails', async () => {
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Disk full'));

    await useTradingPrefsStore.getState().setRewardRiskRatio(2);

    // Non-fatal: user's session continues with the chosen ratio
    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBe(2);
  });

  it('allows changing the ratio later (re-committing)', async () => {
    await useTradingPrefsStore.getState().setRewardRiskRatio(3);
    await useTradingPrefsStore.getState().setRewardRiskRatio(5);

    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBe(5);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
  });
});

// ==================== clearPrefs (GDPR erasure) ====================

describe('TradingPrefsStore — clearPrefs (GDPR erasure)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTradingPrefsStore.setState({ rewardRiskRatio: 3, initialized: true });
  });

  it('clears the in-memory ratio and removes the persisted key', async () => {
    await useTradingPrefsStore.getState().clearPrefs();

    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('succeeds even when storage removal fails (in-memory already cleared)', async () => {
    vi.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('Disk error'));

    await useTradingPrefsStore.getState().clearPrefs();

    // Non-fatal: the commitment is gone from the session regardless
    expect(useTradingPrefsStore.getState().rewardRiskRatio).toBeNull();
  });
});
