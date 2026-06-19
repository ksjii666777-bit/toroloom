import React, { createContext, useContext, useMemo, useCallback, useState } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing } from 'react-native-reanimated';
import { useThemeStore } from '../store/themeStore';
import { COLORS, LIGHT_COLORS, GRADIENTS, SHADOWS as BASE_SHADOWS, ThemeColors } from '../constants/theme';

interface ThemeContextValue {
  isDark: boolean;
  mode: 'dark' | 'light';
  colors: ThemeColors;
  gradients: typeof GRADIENTS;
  shadows: typeof BASE_SHADOWS;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>(null!);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode, toggleTheme: storeToggleTheme } = useThemeStore();

  const isDark = mode === 'dark';
  const colors = isDark ? COLORS : LIGHT_COLORS;

  // Reanimated shared value for overlay opacity — drives the animation on the UI thread
  const overlayOpacity = useSharedValue(0);
  // Shared value for the OUTGOING background color (UI-thread safe)
  const oldBgSV = useSharedValue(colors.bg);
  // JS state controls pointerEvents prop to prevent touch blocking when overlay is invisible
  const [overlayBlocking, setOverlayBlocking] = useState(false);

  const toggleTheme = useCallback(() => {
    // 1. Block touches and capture current background before any state change
    setOverlayBlocking(true);
    oldBgSV.value = colors.bg;

    // 2. Two-phase transition on the UI thread:
    //    Phase 1 — fade overlay IN to mask the abrupt color switch
    overlayOpacity.value = withTiming(0.85, {
      duration: 120,
      easing: Easing.in(Easing.ease),
    }, (finished1) => {
      if (finished1) {
        // 3. Switch the actual theme (runs on JS thread via runOnJS)
        runOnJS(storeToggleTheme)();

        // 4. Phase 2 — fade overlay OUT to reveal the new theme underneath
        overlayOpacity.value = withTiming(0, {
          duration: 350,
          easing: Easing.out(Easing.ease),
        }, (finished2) => {
          // 5. Re-enable touches only after the overlay is completely gone
          if (finished2) runOnJS(setOverlayBlocking)(false);
        });
      }
    });
  }, [colors.bg, storeToggleTheme, overlayOpacity]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: oldBgSV.value,
    opacity: overlayOpacity.value,
  }));

  const value = useMemo<ThemeContextValue>(() => ({
    isDark,
    mode,
    colors,
    gradients: GRADIENTS,
    shadows: BASE_SHADOWS,
    toggleTheme,
  }), [isDark, mode, colors, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
      <Animated.View style={overlayAnimatedStyle} pointerEvents={overlayBlocking ? 'auto' : 'none'} />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
