import { useRef, useEffect, useCallback } from 'react';
import { Animated } from 'react-native';

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

  const animations = useRef<Animated.Value[]>([]);

  // Initialize or update animation values
  useEffect(() => {
    while (animations.current.length < count) {
      animations.current.push(new Animated.Value(0));
    }
    if (animations.current.length > count) {
      animations.current = animations.current.slice(0, count);
    }
  }, [count]);

  const startAnimation = useCallback(() => {
    const anims = animations.current.slice(0, count).map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration,
        delay: initialDelay + index * staggerDelay,
        useNativeDriver: true,
      })
    );
    Animated.stagger(staggerDelay, anims).start();
  }, [count, initialDelay, staggerDelay, duration]);

  useEffect(() => {
    startAnimation();
  }, [startAnimation]);

  const getAnimatedStyle = useCallback((index: number) => ({
    opacity: animations.current[index]?.interpolate({
      inputRange: [0, 1],
      outputRange: [fromOpacity, 1],
    }) || 0,
    transform: [{
      translateY: animations.current[index]?.interpolate({
        inputRange: [0, 1],
        outputRange: [fromTranslateY, 0],
      }) || fromTranslateY,
    }],
  }), [fromOpacity, fromTranslateY]);

  const reset = useCallback(() => {
    animations.current.forEach(anim => anim.setValue(0));
    startAnimation();
  }, [startAnimation]);

  return {
    getAnimatedStyle,
    reset,
    startAnimation,
  };
}
