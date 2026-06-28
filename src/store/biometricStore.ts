/**
 * ============================================================================
 * Toroloom — Biometric Settings Store
 * ============================================================================
 *
 * Manages biometric authentication preferences:
 *   - enabled: Whether biometric unlock is required when app resumes
 *   - requireForTrades: Whether biometric confirmation is needed for orders
 *   - isUnlocked: Whether the app has been unlocked in this session
 *
 * Persisted to AsyncStorage via zustand persist middleware (same pattern
 * as themeStore.ts).
 *
 * Usage:
 *   import { useBiometricStore } from '../store/biometricStore';
 *
 *   const { enabled, toggleBiometric } = useBiometricStore();
 *   const { requireForTrades, toggleRequireForTrades } = useBiometricStore();
 *
 * ============================================================================
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BiometricState {
  /** Whether biometric app-unlock is enabled */
  enabled: boolean;
  /** Whether biometric confirmation is required before placing trades */
  requireForTrades: boolean;
  /** Whether the app has been biometrically unlocked in this session */
  isUnlocked: boolean;

  /** Toggle biometric app-unlock on/off */
  toggleBiometric: () => void;
  /** Set biometric app-unlock explicitly */
  setBiometric: (enabled: boolean) => void;

  /** Toggle biometric trade confirmation on/off */
  toggleRequireForTrades: () => void;
  /** Set biometric trade confirmation explicitly */
  setRequireForTrades: (require: boolean) => void;

  /** Mark the app as biometrically unlocked for this session */
  unlock: () => void;
  /** Lock the app (e.g. on background) */
  lock: () => void;
  /** Reset all settings to defaults */
  reset: () => void;
}

const STORAGE_KEY = 'toroloom-biometric';

export const useBiometricStore = create<BiometricState>()(
  persist(
    (set) => ({
      enabled: false,
      requireForTrades: true,
      isUnlocked: false,

      toggleBiometric: () => set((state) => ({ enabled: !state.enabled })),
      setBiometric: (enabled) => set({ enabled }),

      toggleRequireForTrades: () =>
        set((state) => ({ requireForTrades: !state.requireForTrades })),
      setRequireForTrades: (require) => set({ requireForTrades: require }),

      unlock: () => set({ isUnlocked: true }),
      lock: () => set({ isUnlocked: false }),
      reset: () => set({ enabled: false, requireForTrades: true, isUnlocked: false }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the settings, not the runtime isUnlocked state
      partialize: (state) => ({
        enabled: state.enabled,
        requireForTrades: state.requireForTrades,
      }),
    }
  )
);
