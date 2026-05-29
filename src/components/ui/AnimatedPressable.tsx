import React, { useRef, useMemo, useCallback } from 'react';
import { TouchableWithoutFeedback, View, Animated, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';

interface AnimatedPressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  disabled?: boolean;
  scaleTo?: number;
  haptic?: 'light' | 'medium' | 'heavy' | 'selection' | 'none' | 'success' | 'warning' | 'error';
  style?: ViewStyle;
  containerStyle?: ViewStyle;
  activeOpacity?: number;
}

export default function AnimatedPressable({
  children,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  disabled = false,
  scaleTo = 0.96,
  haptic = 'light',
  style,
  containerStyle,
  activeOpacity = 0.9,
}: AnimatedPressableProps) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const triggerHaptic = useCallback(() => {
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
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: scaleTo,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }),
      Animated.timing(opacityAnim, {
        toValue: activeOpacity,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, scaleTo, activeOpacity, onPressIn]);

  const handlePressOut = useCallback(() => {
    onPressOut?.();
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, onPressOut]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    triggerHaptic();
    onPress?.();
  }, [disabled, triggerHaptic, onPress]);

  const handleLongPress = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onLongPress?.();
  }, [disabled, onLongPress]);

  const animatedStyle = useMemo(() => ({
    transform: [{ scale: scaleAnim }],
    opacity: opacityAnim,
  }), [scaleAnim, opacityAnim]);

  return (
    <TouchableWithoutFeedback
      onPressIn={!disabled ? handlePressIn : undefined}
      onPressOut={!disabled ? handlePressOut : undefined}
      onPress={handlePress}
      onLongPress={!disabled ? handleLongPress : undefined}
      disabled={disabled}
    >
      <Animated.View style={[style, animatedStyle, containerStyle]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}
