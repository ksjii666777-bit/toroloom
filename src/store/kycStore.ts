/**
 * ============================================================================
 * Toroloom — KYC State Store (Persisted to AsyncStorage)
 * ============================================================================
 *
 * Tracks KYC step completion progress across the app session.
 * Persists to AsyncStorage so that:
 *   - PAN verification done → stays done after app restart
 *   - Aadhaar eKYC completed → progress saved
 *   - DigiLocker linked → remembered
 *
 * Pattern: Manual AsyncStorage getItem/setItem (same as onboardingStore)
 * instead of zustand persist middleware, for explicit control over
 * hydration timing (loadKycState is called on app init).
 * ============================================================================
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'toroloom_kyc';

// ─── Types ──────────────────────────────────────────────────────────────────

export type KycStepKey = 'pan' | 'aadhaar' | 'digilocker' | 'bank';

export interface LinkedBankStoreAccount {
  id: string;
  bankName: string;
  accountNumber: string;  // Masked: XXXX1234
  ifsc: string;
  accountHolderName: string;
  accountType: 'savings' | 'current' | 'salary' | 'other';
  isPrimary: boolean;
  linkedAt: string;
  verified: boolean;
}

export interface KycPersistedState {
  /** Which KYC steps have been completed (key = step key, value = true) */
  completedSteps: Record<KycStepKey, boolean>;
  /** Verified PAN number (masked storage) */
  panNumber?: string;
  /** Last 4 digits of Aadhaar (only masked data stored) */
  aadhaarLastFour?: string;
  /** Whether DigiLocker has been linked/fetched */
  digiLockerLinked: boolean;
  /** Linked bank accounts */
  linkedBanks: LinkedBankStoreAccount[];
  /** Timestamp of last KYC update */
  lastUpdated: string | null;
}

// ─── Default State ─────────────────────────────────────────────────────────

const DEFAULT_COMPLETED: Record<KycStepKey, boolean> = {
  pan: false,
  aadhaar: false,
  digilocker: false,
  bank: false,
};



// ─── Store Interface ────────────────────────────────────────────────────────

interface KycStoreState {
  /** Whether the store has been hydrated from AsyncStorage */
  initialized: boolean;
  /** Completed steps map */
  completedSteps: Record<KycStepKey, boolean>;
  /** Verified PAN number */
  panNumber?: string;
  /** Last 4 digits of Aadhaar */
  aadhaarLastFour?: string;
  /** DigiLocker linked status */
  digiLockerLinked: boolean;
  /** Linked bank accounts */
  linkedBanks: LinkedBankStoreAccount[];
  /** Last update timestamp */
  lastUpdated: string | null;

  // Actions
  /** Load persisted KYC state from AsyncStorage (call on app init) */
  loadKycState: () => Promise<void>;
  /** Mark a single step as completed and persist */
  markStepCompleted: (stepKey: KycStepKey) => Promise<void>;
  /** Mark a step as incomplete (for retry scenarios) */
  markStepIncomplete: (stepKey: KycStepKey) => Promise<void>;
  /** Store verified PAN number */
  setPanNumber: (pan: string) => Promise<void>;
  /** Store masked Aadhaar info */
  setAadhaarLastFour: (lastFour: string) => Promise<void>;
  /** Set DigiLocker linked status */
  setDigiLockerLinked: (linked: boolean) => Promise<void>;
  /** Add a linked bank account */
  addLinkedBank: (account: LinkedBankStoreAccount) => Promise<void>;
  /** Remove a linked bank account */
  removeLinkedBank: (accountId: string) => Promise<void>;
  /** Set a bank account as primary */
  setPrimaryBank: (accountId: string) => Promise<void>;
  /** Reset all KYC progress */
  resetKyc: () => Promise<void>;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useKycStore = create<KycStoreState>((set, get) => ({
  initialized: false,
  completedSteps: { ...DEFAULT_COMPLETED },
  panNumber: undefined,
  aadhaarLastFour: undefined,
  digiLockerLinked: false,
  linkedBanks: [],
  lastUpdated: null,

  // ── Persistence ──────────────────────────────────────────────────

  loadKycState: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: KycPersistedState = JSON.parse(stored);
        set({
          completedSteps: {
            ...DEFAULT_COMPLETED,
            ...(parsed.completedSteps || {}),
          },
          panNumber: parsed.panNumber || undefined,
          aadhaarLastFour: parsed.aadhaarLastFour || undefined,
          digiLockerLinked: parsed.digiLockerLinked || false,
          linkedBanks: parsed.linkedBanks || [],
          lastUpdated: parsed.lastUpdated || null,
          initialized: true,
        });
      } else {
        set({ initialized: true });
      }
    } catch {
      // AsyncStorage error — start fresh
      set({ initialized: true });
    }
  },

  markStepCompleted: async (stepKey: KycStepKey) => {
    const now = new Date().toISOString();
    set(s => ({
      completedSteps: { ...s.completedSteps, [stepKey]: true },
      lastUpdated: now,
    }));
    await persistState(get());
  },

  markStepIncomplete: async (stepKey: KycStepKey) => {
    set(s => ({
      completedSteps: { ...s.completedSteps, [stepKey]: false },
      lastUpdated: new Date().toISOString(),
    }));
    await persistState(get());
  },

  setPanNumber: async (pan: string) => {
    // Only store last 4 chars + mask for privacy (e.g., "ABCDE1234F" → "XXXXX1234F")
    const masked = pan.length >= 10
      ? 'XXXXX' + pan.slice(-5)
      : pan;
    set({ panNumber: masked, lastUpdated: new Date().toISOString() });
    await persistState(get());
  },

  setAadhaarLastFour: async (lastFour: string) => {
    set({ aadhaarLastFour: lastFour, lastUpdated: new Date().toISOString() });
    await persistState(get());
  },

  setDigiLockerLinked: async (linked: boolean) => {
    set({ digiLockerLinked: linked, lastUpdated: new Date().toISOString() });
    await persistState(get());
  },

  addLinkedBank: async (account: LinkedBankStoreAccount) => {
    set(s => ({
      linkedBanks: account.isPrimary
        ? [...s.linkedBanks.map(b => ({ ...b, isPrimary: false })), account]
        : [...s.linkedBanks, account],
      lastUpdated: new Date().toISOString(),
    }));
    await persistState(get());
  },

  removeLinkedBank: async (accountId: string) => {
    set(s => ({
      linkedBanks: s.linkedBanks.filter(b => b.id !== accountId),
      lastUpdated: new Date().toISOString(),
    }));
    await persistState(get());
  },

  setPrimaryBank: async (accountId: string) => {
    set(s => ({
      linkedBanks: s.linkedBanks.map(b => ({
        ...b,
        isPrimary: b.id === accountId,
      })),
      lastUpdated: new Date().toISOString(),
    }));
    await persistState(get());
  },

  resetKyc: async () => {
    set({
      completedSteps: { ...DEFAULT_COMPLETED },
      panNumber: undefined,
      aadhaarLastFour: undefined,
      digiLockerLinked: false,
      linkedBanks: [],
      lastUpdated: null,
    });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
}));

// ─── Persistence Helper ─────────────────────────────────────────────────────

async function persistState(state: KycStoreState): Promise<void> {
  const persistable: KycPersistedState = {
    completedSteps: state.completedSteps,
    panNumber: state.panNumber,
    aadhaarLastFour: state.aadhaarLastFour,
    digiLockerLinked: state.digiLockerLinked,
    linkedBanks: state.linkedBanks,
    lastUpdated: state.lastUpdated,
  };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch {
    // Silently fail — in-memory state is still correct
  }
}
