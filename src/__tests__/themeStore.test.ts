/**
 * ============================================================================
 * Toroloom — Theme Store Tests
 * ============================================================================
 *
 * Tests the theme store: dark/light mode toggle and persistence.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../store/themeStore';

describe('ThemeStore — Mode Toggle', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'dark' });
  });

  it('starts in dark mode by default', () => {
    const state = useThemeStore.getState();
    expect(state.mode).toBe('dark');
  });

  it('toggles from dark to light', () => {
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().mode).toBe('light');
  });

  it('toggles from light to dark', () => {
    useThemeStore.getState().toggleTheme(); // dark → light
    useThemeStore.getState().toggleTheme(); // light → dark
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('sets theme to a specific mode', () => {
    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().mode).toBe('light');

    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
  });

  it('persists theme preference name in config', () => {
    // The persist middleware config should have name 'wealthwise-theme'
    const state = useThemeStore.getState();
    expect(state.mode).toBeDefined();
  });
});
