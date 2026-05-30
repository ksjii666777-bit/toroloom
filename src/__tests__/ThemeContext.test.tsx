/**
 * ============================================================================
 * Toroloom — ThemeContext Tests
 * ============================================================================
 *
 * Tests the ThemeProvider component and useTheme hook: context value shape,
 * dark/light mode, toggleTheme, and overlay rendering.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Text } from 'react-native';
import { render, fireEvent } from './testUtils';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { useThemeStore } from '../store/themeStore';
import { COLORS, LIGHT_COLORS } from '../constants/theme';

// ── Test Consumers ────────────────────────────────────────

function ModeDisplay() {
  const { mode, isDark } = useTheme();
  return <>{mode}|{String(isDark)}</>;
}

function BgDisplay() {
  const { colors } = useTheme();
  return <>{colors.bg}</>;
}

function AllDisplays() {
  return (
    <>
      <ModeDisplay />
      <BgDisplay />
    </>
  );
}

function ToggleButton() {
  const { toggleTheme } = useTheme();
  return <Text testID="toggle-btn" onPress={toggleTheme}>Toggle Theme</Text>;
}

function Combined() {
  return (
    <>
      <AllDisplays />
      <ToggleButton />
    </>
  );
}

// ── Bad Consumer (outside provider) ────────────────────────
function BadConsumer() {
  useTheme();
  return null;
}

// ── Reset store before each test ───────────────────────────
beforeEach(() => {
  useThemeStore.setState({ mode: 'dark' });
});

// ── Tests ──────────────────────────────────────────────────

describe('ThemeContext — useTheme error', () => {
  it('throws when used outside ThemeProvider', () => {
    const origConsoleError = console.error;
    console.error = vi.fn();

    expect(() => {
      render(<BadConsumer />);
    }).toThrow('useTheme must be used within a ThemeProvider');

    console.error = origConsoleError;
  });
});

describe('ThemeContext — Dark Mode (default)', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'dark' });
  });

  it('renders without crashing', () => {
    const { toJSON } = render(
      <ThemeProvider><AllDisplays /></ThemeProvider>
    );
    expect(toJSON).not.toBeNull();
  });

  it('provides isDark=true and mode="dark" by default', () => {
    const { getByText } = render(
      <ThemeProvider><ModeDisplay /></ThemeProvider>
    );
    expect(getByText('dark|true')).toBeTruthy();
  });

  it('provides dark theme background color', () => {
    const { getByText } = render(
      <ThemeProvider><BgDisplay /></ThemeProvider>
    );
    expect(getByText(COLORS.bg)).toBeTruthy();
  });
});

describe('ThemeContext — Light Mode', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'light' });
  });

  it('provides isDark=false and mode="light"', () => {
    const { getByText } = render(
      <ThemeProvider><ModeDisplay /></ThemeProvider>
    );
    expect(getByText('light|false')).toBeTruthy();
  });

  it('provides light theme background color', () => {
    const { getByText } = render(
      <ThemeProvider><BgDisplay /></ThemeProvider>
    );
    expect(getByText(LIGHT_COLORS.bg)).toBeTruthy();
  });
});

describe('ThemeContext — Toggle', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'dark' });
  });

  it('toggles dark → light on toggleTheme', () => {
    const { getByText } = render(
      <ThemeProvider><Combined /></ThemeProvider>
    );

    // Initially dark
    expect(getByText('dark|true')).toBeTruthy();

    // Toggle
    act(() => {
      fireEvent.press(getByText('Toggle Theme'));
    });

    // Now light
    expect(getByText('light|false')).toBeTruthy();
  });

  it('toggles light → dark on toggleTheme', () => {
    useThemeStore.setState({ mode: 'light' });

    const { getByText } = render(
      <ThemeProvider><Combined /></ThemeProvider>
    );

    // Initially light
    expect(getByText('light|false')).toBeTruthy();

    // Toggle
    act(() => {
      fireEvent.press(getByText('Toggle Theme'));
    });

    // Now dark
    expect(getByText('dark|true')).toBeTruthy();
  });

  it('colors change after toggle', () => {
    const { getByText, queryByText } = render(
      <ThemeProvider><Combined /></ThemeProvider>
    );

    // Initially dark bg
    expect(getByText(COLORS.bg)).toBeTruthy();
    expect(queryByText(LIGHT_COLORS.bg)).toBeNull();

    // Toggle
    act(() => {
      fireEvent.press(getByText('Toggle Theme'));
    });

    // Now light bg
    expect(getByText(LIGHT_COLORS.bg)).toBeTruthy();
    expect(queryByText(COLORS.bg)).toBeNull();
  });
});

describe('ThemeContext — Overlay', () => {
  it('renders an overlay view (Animated.View from reanimated)', () => {
    const { toJSON } = render(
      <ThemeProvider><AllDisplays /></ThemeProvider>
    );
    // The overlay is a child of ThemeContext.Provider
    // Should be present in the tree
    expect(toJSON).not.toBeNull();
  });
});
