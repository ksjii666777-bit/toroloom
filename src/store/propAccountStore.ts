/**
 * ============================================================================
 * Toroloom — Prop-Firm Challenge Account Store
 * ============================================================================
 *
 * Tracks ONE active prop-firm challenge at a time (like real life: a trader
 * runs one evaluation). Holds the frozen rule config, the current phase and
 * the outcome. All maths stays in drawdownEngine.ts — this store only owns
 * identity + lifecycle + persistence.
 *
 * Persisted in AsyncStorage under 'toroloom_prop_account'.
 * GDPR: clearAccount() wipes both memory and storage.
 * ============================================================================
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChallengeConfig } from '../services/propFirm/challengePresets';

export type ChallengeOutcome = 'active' | 'passed' | 'failed' | 'abandoned';

export interface ActiveChallenge {
  config: ChallengeConfig;
  /** ISO instant the challenge started — drawdown engine filters trades by this */
  startDate: string;
  /** Current phase (1-based index into config.phases) */
  phase: number;
  outcome: ChallengeOutcome;
  /** When outcome != active — why it ended (set alongside outcome) */
  endedPhase: number | null;
}

interface PropAccountState {
  challenge: ActiveChallenge | null;
  initialized: boolean;

  loadAccount: () => Promise<void>;
  startChallenge: (config: ChallengeConfig) => Promise<void>;
  /** Advance to the next phase after a pass (keeps startDate → compound gains) */
  advancePhase: () => Promise<void>;
  markFailed: () => Promise<void>;
  abandonChallenge: () => Promise<void>;
  /** GDPR erasure */
  clearAccount: () => Promise<void>;
}

const STORAGE_KEY = 'toroloom_prop_account';

export const usePropAccountStore = create<PropAccountState>((set, get) => ({
  challenge: null,
  initialized: false,

  loadAccount: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ActiveChallenge | null;
        if (parsed && parsed.config && typeof parsed.phase === 'number') {
          set({ challenge: parsed, initialized: true });
          return;
        }
      }
      set({ initialized: true });
    } catch {
      set({ initialized: true });
    }
  },

  startChallenge: async (config) => {
    const challenge: ActiveChallenge = {
      config,
      startDate: new Date().toISOString(),
      phase: 1,
      outcome: 'active',
      endedPhase: null,
    };
    set({ challenge });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(challenge));
    } catch {
      // non-fatal — memory already updated
    }
  },

  advancePhase: async () => {
    const current = get().challenge;
    if (!current || current.outcome !== 'active') return;
    const next = Math.min(current.phase + 1, current.config.phases.length);
    const updated: ActiveChallenge = { ...current, phase: next };
    set({ challenge: updated });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch { /* non-fatal */ }
  },

  markFailed: async () => {
    const current = get().challenge;
    if (!current) return;
    const updated: ActiveChallenge = { ...current, outcome: 'failed', endedPhase: current.phase };
    set({ challenge: updated });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch { /* non-fatal */ }
  },

  abandonChallenge: async () => {
    const current = get().challenge;
    if (!current) return;
    const updated: ActiveChallenge = { ...current, outcome: 'abandoned', endedPhase: current.phase };
    set({ challenge: updated });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch { /* non-fatal */ }
  },

  clearAccount: async () => {
    set({ challenge: null, initialized: true });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch { /* non-fatal */ }
  },
}));
