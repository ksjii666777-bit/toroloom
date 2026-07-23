/**
 * Mock for react-native-reanimated — used by Storybook (web Vite) so that
 * components importing reanimated don't crash trying to load React Native
 * Fabric bindings that don't exist in react-native-web.
 *
 * All animations are no-ops in Storybook. The visual result is the final
 * (end-of-animation) state shown immediately.
 */

import React from 'react';
import { Text, View, ScrollView, ViewProps } from 'react-native';

// ── Animated.View (passthrough) ────────────────────────────────────────────
const AnimatedView = React.forwardRef<typeof View, ViewProps>(
  (props, ref) => React.createElement(View, { ...props, ref }),
);
AnimatedView.displayName = 'Animated.View';

// ── Shared Values ──────────────────────────────────────────────────────────
function useSharedValue<T>(initial: T) {
  const ref = React.useRef<T>(initial);
  return {
    get value(): T {
      return ref.current;
    },
    set value(v: T) {
      ref.current = v;
    },
    modify: (fn: (v: T) => T) => {
      ref.current = fn(ref.current);
    },
  };
}

// ── Animated Style (passthrough) ───────────────────────────────────────────
function useAnimatedStyle(updater: () => Record<string, unknown>) {
  return updater();
}

// ── Animation functions ────────────────────────────────────────────────────
function withSpring(toValue: number, _config?: Record<string, unknown>) {
  return toValue;
}

function withTiming(toValue: number, _config?: Record<string, unknown>) {
  return toValue;
}

function withDelay(_delayMs: number, value: number) {
  return value;
}

function withRepeat(
  value: number,
  _count?: number,
  _reverse?: boolean,
) {
  return value;
}

function withSequence(...values: number[]) {
  return values[values.length - 1] ?? 0;
}

function interpolate(
  value: number,
  inputRange: number[],
  outputRange: number[],
  _opts?: Record<string, unknown>,
) {
  const i = inputRange.indexOf(value);
  if (i !== -1 && outputRange[i] !== undefined) return outputRange[i];
  return outputRange[0] ?? 0;
}

function runOnJS(fn: (...args: unknown[]) => void) {
  return fn;
}

const Easing = {
  in: (_easing: unknown) => (t: number) => t,
  out: (_easing: unknown) => (t: number) => t,
  inOut: (_easing: unknown) => (t: number) => t,
  linear: (t: number) => t,
  ease: (t: number) => t,
  sin: (t: number) => t,
  exp: (t: number) => t,
  circle: (t: number) => t,
  bezier: () => (t: number) => t,
};

const Animated = Object.assign(AnimatedView, {
  View: AnimatedView,
  Text: (props: ViewProps & { children?: React.ReactNode }) =>
    React.createElement(Text, props as any, (props as any).children),
  ScrollView: (props: ViewProps) => React.createElement(ScrollView, props),
  FlatList: (props: ViewProps) => React.createElement(View, props),
});

export default Animated;
export {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  runOnJS,
  Easing,
};
