import { useEffect, useCallback } from 'react';
import type { ViewStyle } from 'react-native';
import { useSharedValue, withTiming, withDelay, useAnimatedStyle, runOnJS } from 'react-native-reanimated';

interface StaggeredAnimationConfig {
  initialDelay?: number;
  staggerDelay?: number;
  duration?: number;
  fromOpacity?: number;
  fromTranslateY?: number;
}

export function useStaggeredAnimation(count: number, config: StaggeredAnimationConfig = {}) {
  const {
    initialDelay = 100,
    staggerDelay = 60,
    duration = 400,
    fromOpacity = 0,
    fromTranslateY = 20,
  } = config;

  // Create shared values for each item
  const progressValues = Array.from({ length: count }, () => useSharedValue(0));

  const startAnimation = useCallback(() => {
    progressValues.forEach((anim, index) => {
      const delay = initialDelay + index * staggerDelay;
      anim.value = withDelay(delay, withTiming(1, { duration }));
    });
  }, [count, initialDelay, staggerDelay, duration]);

  useEffect(() => {
    startAnimation();
  }, [startAnimation]);

  const getAnimatedStyle = useCallback(
    (index: number): ViewStyle =>
      useAnimatedStyle(() => {
        const progress = progressValues[index]?.value ?? 0;
        return {
          opacity: fromOpacity + (1 - fromOpacity) * progress,
          transform: [{ translateY: fromTranslateY * (1 - progress) }],
        };
      }) as unknown as ViewStyle,
    [fromOpacity, fromTranslateY]
  );

  const reset = useCallback(() => {
    progressValues.forEach(anim => { anim.value = 0; });
    startAnimation();
  }, [startAnimation]);

  return {
    getAnimatedStyle,
    reset,
    startAnimation,
  };
}
