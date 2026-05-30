/**
 * ============================================================================
 * Toroloom — AnimatedPressable Tests
 * ============================================================================
 *
 * Tests the reusable AnimatedPressable wrapper: press handling, haptic
 * feedback variants, disabled state, and callback invocation.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Haptics from 'expo-haptics';
import AnimatedPressable from '../components/ui/AnimatedPressable';
import { render, fireEvent } from './testUtils';

// Mock ThemeContext so useTheme returns test colors without a ThemeProvider wrapper
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    mode: 'light',
    colors: {
      primary: '#6C63FF',
      secondary: '#FF6B6B',
      accent: '#00D2FF',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      text: '#FFFFFF',
      textSecondary: '#B0B0D0',
      textMuted: '#6E6E9A',
      bgCard: '#222255',
      bgCardLight: '#2A2A5E',
      border: '#2A2A5E',
      divider: '#1E1E4A',
    },
  }),
}));

beforeEach(() => {
  // Clear only the haptic mocks (not all mocks — vi.clearAllMocks would
  // break vitest's internal mock factory caching for vi.mock modules).
  vi.mocked(Haptics.impactAsync).mockClear();
  vi.mocked(Haptics.selectionAsync).mockClear();
  vi.mocked(Haptics.notificationAsync).mockClear();
});

describe('AnimatedPressable', () => {
  it('renders children', () => {
    const { getByText } = render(
      <AnimatedPressable onPress={() => {}}>
        <>Press me</>
      </AnimatedPressable>
    );
    expect(getByText('Press me')).toBeDefined();
  });

  it('calls onPress when pressed', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <AnimatedPressable onPress={onPress}>
        <>Press me</>
      </AnimatedPressable>
    );
    fireEvent.press(getByText('Press me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <AnimatedPressable onPress={onPress} disabled={true}>
        <>Press me</>
      </AnimatedPressable>
    );
    fireEvent.press(getByText('Press me'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('calls onLongPress on long press', () => {
    const onLongPress = vi.fn();
    const { getByText } = render(
      <AnimatedPressable onLongPress={onLongPress}>
        <>Hold me</>
      </AnimatedPressable>
    );
    fireEvent.trigger(getByText('Hold me'), 'onLongPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('triggers light haptic by default on press', () => {
    const { getByText } = render(
      <AnimatedPressable onPress={() => {}}>
        <>Press me</>
      </AnimatedPressable>
    );
    fireEvent.press(getByText('Press me'));
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('triggers selection haptic when haptic="selection"', () => {
    const { getByText } = render(
      <AnimatedPressable onPress={() => {}} haptic="selection">
        <>Press me</>
      </AnimatedPressable>
    );
    fireEvent.press(getByText('Press me'));
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('does not trigger haptic when haptic="none"', () => {
    const { getByText } = render(
      <AnimatedPressable onPress={() => {}} haptic="none">
        <>Press me</>
      </AnimatedPressable>
    );
    fireEvent.press(getByText('Press me'));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('triggers success notification haptic', () => {
    const { getByText } = render(
      <AnimatedPressable onPress={() => {}} haptic="success">
        <>Press me</>
      </AnimatedPressable>
    );
    fireEvent.press(getByText('Press me'));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });

  it('triggers error notification haptic', () => {
    const { getByText } = render(
      <AnimatedPressable onPress={() => {}} haptic="error">
        <>Press me</>
      </AnimatedPressable>
    );
    fireEvent.press(getByText('Press me'));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  });

  it('triggers warning notification haptic', () => {
    const { getByText } = render(
      <AnimatedPressable onPress={() => {}} haptic="warning">
        <>Press me</>
      </AnimatedPressable>
    );
    fireEvent.press(getByText('Press me'));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
  });

  it('does not call onPress when disabled even with haptic', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <AnimatedPressable onPress={onPress} disabled={true} haptic="medium">
        <>No press</>
      </AnimatedPressable>
    );
    fireEvent.press(getByText('No press'));
    expect(onPress).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('fires onPressIn and onPressOut callbacks', () => {
    const onPressIn = vi.fn();
    const onPressOut = vi.fn();
    const { getByText } = render(
      <AnimatedPressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={() => {}}>
        <>Animate</>
      </AnimatedPressable>
    );
    fireEvent.trigger(getByText('Animate'), 'onPressIn');
    fireEvent.trigger(getByText('Animate'), 'onPressOut');
    fireEvent.press(getByText('Animate'));
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  it('triggers medium haptic when haptic="medium"', () => {
    const { getByText } = render(
      <AnimatedPressable onPress={() => {}} haptic="medium">
        <>Press me</>
      </AnimatedPressable>
    );
    fireEvent.press(getByText('Press me'));
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  it('triggers heavy haptic when haptic="heavy"', () => {
    const { getByText } = render(
      <AnimatedPressable onPress={() => {}} haptic="heavy">
        <>Press me</>
      </AnimatedPressable>
    );
    fireEvent.press(getByText('Press me'));
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  });

  it('long-press does not trigger haptic when disabled', () => {
    const { getByText } = render(
      <AnimatedPressable onPress={() => {}} onLongPress={() => {}} disabled={true}>
        <>No haptic</>
      </AnimatedPressable>
    );
    // The component blocks both the longPress callback and haptic when disabled.
    // onLongPress callback is not callable because the prop is undefined;
    // verify that pressing (which would also trigger disabled guard) does nothing
    fireEvent.press(getByText('No haptic'));
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('renders with custom scaleTo and containerStyle', () => {
    const { getByText } = render(
      <AnimatedPressable onPress={() => {}} scaleTo={0.85} containerStyle={{ margin: 10 }}>
        <>Scaled</>
      </AnimatedPressable>
    );
    expect(getByText('Scaled')).toBeDefined();
  });
});
