/**
 * ============================================================================
 * Toroloom — AnimatedScaleButton
 * ============================================================================
 *
 * A small animated button that scales down on press and springs back.
 * Supports onLongPress and hitSlop. Uses React Native's built-in Animated
 * API (not react-native-reanimated) for lightweight scale animations.
 *
 * Usage:
 *   <AnimatedScaleButton onPress={handlePress} style={btnStyle}>
 *     <Text>Click me</Text>
 *   </AnimatedScaleButton>
 *
 *   <AnimatedScaleButton
 *     onPress={handlePress}
 *     onLongPress={handleLongPress}
 *     hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
 *     style={shareBtn}
 *   >
 *     <Ionicons name="share-outline" size={14} color="#999" />
 *   </AnimatedScaleButton>
 * ============================================================================
 */

import React, { useRef } from 'react';
import { TouchableOpacity, Animated } from 'react-native';

interface AnimatedScaleButtonProps {
  children: React.ReactNode;
  style?: any;
  onPress: () => void;
  onLongPress?: () => void;
  hitSlop?: { top: number; bottom: number; left: number; right: number };
}

export default function AnimatedScaleButton({
  children, style, onPress, onLongPress, hitSlop,
}: AnimatedScaleButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={hitSlop}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}
