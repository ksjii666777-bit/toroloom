import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';
export type ThemeOverride = 'system' | 'dark' | 'light';

interface ThemeState {
  /** The actual effective mode (computed — dark or light) */
  mode: ThemeMode;
  /** User's preference: 'system' (follow OS), 'dark', or 'light' */
  override: ThemeOverride;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  /** Set the override: 'system' follows OS, 'dark'/'light' force the mode */
  setOverride: (override: ThemeOverride) => void;
  /** Apply a system color scheme (called by Appearance listener) */
  applySystemScheme: (systemMode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      override: 'dark',

      toggleTheme: () => {
        const current = get().mode;
        const next = current === 'dark' ? 'light' : 'dark';
        set({ mode: next, override: next });
      },

      setTheme: (mode) => {
        set({ mode, override: mode });
      },

      setOverride: (override) => {
        if (override === 'system') {
          // Keep current mode until applySystemScheme is called by Appearance listener
          set({ override });
        } else {
          set({ mode: override, override });
        }
      },

      applySystemScheme: (systemMode) => {
        const { override } = get();
        if (override === 'system') {
          set({ mode: systemMode });
        }
      },
    }),
    {
      name: 'toroloom-theme',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
