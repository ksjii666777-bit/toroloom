/**
 * Animated step card with staggered entrance animation.
 * Used in OnboardingScreen to animate each step's content.
 */
import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

interface AnimatedStepCardProps {
  index: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function AnimatedStepCard({ index, style, children }: AnimatedStepCardProps) {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    const delay = index * 150;
    const id = setTimeout(() => {
      scale.value = withSpring(1, { stiffness: 100, damping: 12 });
      opacity.value = withTiming(1, { duration: 300 });
    }, delay);
    return () => clearTimeout(id);
  }, [index, scale, opacity]);

  return (
    <Animated.View style={[style, animStyle]}>
      {children}
    </Animated.View>
  );
}
