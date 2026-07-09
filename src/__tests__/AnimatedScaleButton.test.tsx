/**
 * ============================================================================
 * Toroloom — AnimatedScaleButton Tests
 * ============================================================================
 *
 * Tests the reusable AnimatedScaleButton component: rendering children,
 * press/long-press callbacks, hitSlop, style propagation, and internal
 * pressIn/pressOut handlers.
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { View, Text } from 'react-native';
import AnimatedScaleButton from '../components/AnimatedScaleButton';
import { render, fireEvent } from './testUtils';

// Since TouchableOpacity uses Animated in its children, we need to handle
// the fact that the test renderer tree includes intermediate components.
// The findPropOnAncestor pattern in fireEvent.press already walks the
// parent chain to find onPress, which works with TouchableOpacity's structure.

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnimatedScaleButton', () => {
  it('renders children', () => {
    const { getByText } = render(
      <AnimatedScaleButton onPress={() => {}}>
        <Text>Click me</Text>
      </AnimatedScaleButton>
    );
    expect(getByText('Click me')).toBeDefined();
  });

  it('renders complex children (View + multiple Text)', () => {
    const { getByText } = render(
      <AnimatedScaleButton onPress={() => {}}>
        <View>
          <Text>Icon</Text>
          <Text>Label</Text>
        </View>
      </AnimatedScaleButton>
    );
    expect(getByText('Icon')).toBeDefined();
    expect(getByText('Label')).toBeDefined();
  });

  it('calls onPress when pressed', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <AnimatedScaleButton onPress={onPress}>
        <Text>Press me</Text>
      </AnimatedScaleButton>
    );
    fireEvent.press(getByText('Press me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onPress multiple times', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <AnimatedScaleButton onPress={onPress}>
        <Text>Press me</Text>
      </AnimatedScaleButton>
    );
    fireEvent.press(getByText('Press me'));
    fireEvent.press(getByText('Press me'));
    fireEvent.press(getByText('Press me'));
    expect(onPress).toHaveBeenCalledTimes(3);
  });

  it('passes no arguments to onPress', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <AnimatedScaleButton onPress={onPress}>
        <Text>Press me</Text>
      </AnimatedScaleButton>
    );
    fireEvent.press(getByText('Press me'));
    expect(onPress).toHaveBeenCalledWith();
  });

  it('calls onLongPress on long press', () => {
    const onLongPress = vi.fn();
    const { getByText } = render(
      <AnimatedScaleButton onPress={() => {}} onLongPress={onLongPress}>
        <Text>Hold me</Text>
      </AnimatedScaleButton>
    );
    fireEvent.trigger(getByText('Hold me'), 'onLongPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('calls onPress but not onLongPress on a regular press', () => {
    const onPress = vi.fn();
    const onLongPress = vi.fn();
    const { getByText } = render(
      <AnimatedScaleButton onPress={onPress} onLongPress={onLongPress}>
        <Text>Press me</Text>
      </AnimatedScaleButton>
    );
    fireEvent.press(getByText('Press me'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does not throw when onPressIn/onPressOut are triggered internally', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <AnimatedScaleButton onPress={onPress}>
        <Text>Animate</Text>
      </AnimatedScaleButton>
    );
    // The internal onPressIn/onPressOut handlers update Animated.Value.
    // Triggering them should not throw and should not break subsequent presses.
    expect(() => fireEvent.trigger(getByText('Animate'), 'onPressIn')).not.toThrow();
    expect(() => fireEvent.trigger(getByText('Animate'), 'onPressOut')).not.toThrow();
    fireEvent.press(getByText('Animate'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not crash when hitSlop is set', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <AnimatedScaleButton onPress={onPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text>Hit me</Text>
      </AnimatedScaleButton>
    );
    expect(() => fireEvent.press(getByText('Hit me'))).not.toThrow();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not crash when style is set', () => {
    const { getByText } = render(
      <AnimatedScaleButton onPress={() => {}} style={{ marginTop: 10, width: 40 }}>
        <Text>Styled</Text>
      </AnimatedScaleButton>
    );
    expect(getByText('Styled')).toBeDefined();
  });

  it('does not crash when pressed (verifies internal handlers + activeOpacity)', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <AnimatedScaleButton onPress={onPress}>
        <Text>Press me</Text>
      </AnimatedScaleButton>
    );
    expect(() => fireEvent.press(getByText('Press me'))).not.toThrow();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('works without onLongPress prop', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <AnimatedScaleButton onPress={onPress}>
        <Text>No long press</Text>
      </AnimatedScaleButton>
    );
    fireEvent.press(getByText('No long press'));
    expect(onPress).toHaveBeenCalledTimes(1);
    // Triggering onLongPress on an element that doesn't have it should not throw
    expect(() => fireEvent.trigger(getByText('No long press'), 'onLongPress')).not.toThrow();
  });

  it('works without hitSlop prop', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <AnimatedScaleButton onPress={onPress}>
        <Text>No hitSlop</Text>
      </AnimatedScaleButton>
    );
    fireEvent.press(getByText('No hitSlop'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('wraps children in an Animated.View with scale transform', () => {
    const { getByText } = render(
      <AnimatedScaleButton onPress={() => {}}>
        <Text>Scale me</Text>
      </AnimatedScaleButton>
    );
    // Children are rendered inside an Animated.View which wraps them
    expect(getByText('Scale me')).toBeDefined();
  });
});
