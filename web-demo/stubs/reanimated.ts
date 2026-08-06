/**
 * Web-compatible stubs for `react-native-reanimated`.
 *
 * The demo only needs components to RENDER (no actual animation work), so every
 * hook/function returns a static, deterministic value. Shared values become
 * plain objects, style builders are invoked synchronously, and timing
 * functions just return their target value.
 */

import React from 'react';
import { View, Text, Image, ScrollView, FlatList, ActivityIndicator } from 'react-native';

type SharedValue<T> = { value: T };

export const useSharedValue = <T,>(initial: T): SharedValue<T> => ({ value: initial });

export const useAnimatedStyle = (builder: () => unknown): unknown => builder();

export const useDerivedValue = <T,>(fn: () => T): SharedValue<T> => ({ value: fn() });

export const useAnimatedReaction = (): void => undefined;

export const useAnimatedRef = <T,>(): { current: T | null } => ({ current: null });

export const useScrollViewOffset = (): SharedValue<number> => ({ value: 0 });

export const useFrameCallback = (): void => undefined;

export const cancelAnimation = (): void => undefined;

export const withTiming = (to: unknown, _cfg?: unknown, cb?: (finished: boolean) => void): unknown => {
  cb?.(true);
  return to;
};

export const withSpring = (to: unknown, _cfg?: unknown, cb?: (finished: boolean) => void): unknown => {
  cb?.(true);
  return to;
};

export const withDelay = (_delayMs: number, to: unknown): unknown => to;

export const withRepeat = (to: unknown): unknown => to;

export const withSequence = (_first: unknown, ...rest: unknown[]): unknown => rest[rest.length - 1] ?? _first;

export const interpolate = (
  _value: unknown,
  _input: readonly number[],
  output: readonly number[]
): number => output[output.length - 1] ?? 0;

export const interpolateColor = (
  _value: unknown,
  _input: readonly number[],
  output: readonly string[]
): string => output[output.length - 1] ?? '#000000';

export const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' } as const;

export const runOnJS = (fn: (...args: unknown[]) => unknown): typeof fn => fn;
export const runOnUI = (fn: (...args: unknown[]) => unknown): typeof fn => fn;

const id = (x: number): number => x;
export const Easing = {
  linear: id,
  ease: id,
  in: id,
  out: id,
  inOut: id,
  cubic: id,
  quad: id,
  sin: id,
  exp: id,
  circle: id,
  back: id,
  bounce: id,
  elastic: id,
  bezier: () => id,
  poly: () => id,
  steps: () => id,
};

/**
 * Chainable no-op entry/exit animation descriptors. Components render these via
 * the `entering`/`exiting` props, but the stub Animated.View is a plain View so
 * the descriptors are never evaluated — they just need to exist and chain.
 */
const entry: Record<string, unknown> = {
  duration: () => entry,
  delay: () => entry,
  springify: () => entry,
  damping: () => entry,
  stiffness: () => entry,
  mass: () => entry,
  easing: () => entry,
  withInitialValues: () => entry,
  build: () => undefined,
};

const layout: Record<string, unknown> = {
  duration: () => layout,
  delay: () => layout,
  springify: () => layout,
  easing: () => layout,
  build: () => undefined,
};

const Animated = {
  View,
  Text,
  Image,
  ScrollView,
  FlatList,
  ActivityIndicator,
  createAnimatedComponent: (Component: unknown) => Component,
};

export const FadeIn = entry;
export const FadeInUp = entry;
export const FadeInDown = entry;
export const FadeInLeft = entry;
export const FadeInRight = entry;
export const FadeOut = entry;
export const FadeOutUp = entry;
export const FadeOutDown = entry;
export const SlideInUp = entry;
export const SlideInDown = entry;
export const SlideInLeft = entry;
export const SlideInRight = entry;
export const ZoomIn = entry;
export const ZoomOut = entry;
export const BounceIn = entry;
export const BounceOut = entry;
export const LightSpeedIn = entry;
export const LightSpeedOut = entry;
export const Layout = layout;
export const LinearTransition = layout;
export const FadingTransition = layout;
export const JumpingTransition = layout;
export const CurvedTransition = layout;
export const SequencedTransition = layout;

export default Animated;
