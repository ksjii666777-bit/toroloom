import React, { useCallback } from 'react';
import { Pressable, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { BORDER_RADIUS } from '../../constants/theme';

interface AnimatedPressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  scaleTo?: number;
  haptic?: 'light' | 'medium' | 'heavy' | 'selection' | 'none' | 'success' | 'warning' | 'error';
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  activeOpacity?: number;
  /** Show a background highlight overlay on press-in */
  highlight?: boolean;
  /** Color of the highlight overlay (default: primary color at low opacity) */
  highlightColor?: string;
  borderRadius?: number;
}

export default function AnimatedPressable({
  children,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  disabled = false,
  testID,
  accessibilityLabel,
  scaleTo = 0.96,
  haptic = 'light',
  style,
  containerStyle,
  activeOpacity = 0.9,
  highlight = false,
  highlightColor,
  borderRadius = BORDER_RADIUS.md,
}: AnimatedPressableProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const highlightProgress = useSharedValue(0);

  const triggerHaptic = useCallback(() => {
    if (Platform.OS === 'web') return;
    switch (haptic) {
      case 'light': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
      case 'medium': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
      case 'heavy': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); break;
      case 'selection': Haptics.selectionAsync(); break;
      case 'success': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
      case 'warning': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); break;
      case 'error': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); break;
      case 'none': break;
    }
  }, [haptic]);

  const handlePressIn = useCallback(() => {
    onPressIn?.();
    scale.value = withSpring(scaleTo, { stiffness: 200, damping: 15 });
    opacity.value = withTiming(activeOpacity, { duration: 80 });
    if (highlight) {
      highlightProgress.value = withTiming(1, { duration: 100 });
    }
  }, [scale, opacity, highlightProgress, scaleTo, activeOpacity, highlight, onPressIn]);

  const handlePressOut = useCallback(() => {
    onPressOut?.();
    scale.value = withSpring(1, { stiffness: 100, damping: 12 });
    opacity.value = withTiming(1, { duration: 120 });
    if (highlight) {
      highlightProgress.value = withTiming(0, { duration: 200 });
    }
  }, [scale, opacity, highlightProgress, highlight, onPressOut]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    triggerHaptic();
    onPress?.();
  }, [disabled, triggerHaptic, onPress]);

  const handleLongPress = useCallback(() => {
    if (disabled) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    onLongPress?.();
  }, [disabled, onLongPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const hColor = highlightColor || colors.primary;

  const highlightStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFill,
    borderRadius,
    opacity: interpolate(highlightProgress.value, [0, 1], [0, 0.12]),
    pointerEvents: 'none' as const,
  }));

  return (
    <Pressable
      onPressIn={!disabled ? handlePressIn : undefined}
      onPressOut={!disabled ? handlePressOut : undefined}
      onPress={handlePress}
      onLongPress={!disabled ? handleLongPress : undefined}
      disabled={disabled}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[style, animatedStyle, containerStyle]}>
        {highlight && (
          <Animated.View style={[highlightStyle, { backgroundColor: hColor }]} />
        )}
        {children}
      </Animated.View>
    </Pressable>
  );
}
