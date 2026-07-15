/**
 * ============================================================================
 * Toroloom — Accessibility Settings Store
 * ============================================================================
 *
 * Manages accessibility preferences: font scaling, reduced motion, high
 * contrast mode. Preferences are persisted to AsyncStorage.
 *
 * Usage:
 *   import { useAccessibilityStore } from '../store/accessibilityStore';
 *
 *   const fontScale = useAccessibilityStore(s => s.fontScale);
 *   const reduceMotion = useAccessibilityStore(s => s.reduceMotion);
 *   const highContrast = useAccessibilityStore(s => s.highContrast);
 *
 *   const { setFontScale, toggleReduceMotion, toggleHighContrast } = useAccessibilityStore.getState();
 * ============================================================================
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Font scale presets */
export type FontScaleLevel = 'small' | 'medium' | 'large' | 'xlarge';

/** Multiplier for each font scale level relative to default */
export const FONT_SCALE_VALUES: Record<FontScaleLevel, number> = {
  small: 0.85,
  medium: 1.0,
  large: 1.15,
  xlarge: 1.35,
};

interface AccessibilityState {
  /** Current font scale level */
  fontScale: FontScaleLevel;
  /** Whether to disable/reduce animations */
  reduceMotion: boolean;
  /** Whether to use high contrast colors */
  highContrast: boolean;

  /** Set font scale level */
  setFontScale: (level: FontScaleLevel) => void;
  /** Toggle reduce motion preference */
  toggleReduceMotion: () => void;
  /** Set reduce motion explicitly */
  setReduceMotion: (value: boolean) => void;
  /** Toggle high contrast mode */
  toggleHighContrast: () => void;
  /** Set high contrast explicitly */
  setHighContrast: (value: boolean) => void;
}

export const useAccessibilityStore = create<AccessibilityState>()(
  persist(
    (set, _get) => ({
      fontScale: 'medium',
      reduceMotion: false,
      highContrast: false,

      setFontScale: (level) => set({ fontScale: level }),
      toggleReduceMotion: () => set((state) => ({ reduceMotion: !state.reduceMotion })),
      setReduceMotion: (value) => set({ reduceMotion: value }),
      toggleHighContrast: () => set((state) => ({ highContrast: !state.highContrast })),
      setHighContrast: (value) => set({ highContrast: value }),
    }),
    {
      name: 'toroloom-accessibility',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        fontScale: state.fontScale,
        reduceMotion: state.reduceMotion,
        highContrast: state.highContrast,
      }),
    }
  )
);
