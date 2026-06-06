import React, { useRef, useMemo, useCallback } from 'react';
import { Pressable, View, Animated, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
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
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const highlightAnim = useRef(new Animated.Value(0)).current;

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
    const anims: Animated.CompositeAnimation[] = [
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
    ];
    if (highlight) {
      anims.push(
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: false,
        })
      );
    }
    Animated.parallel(anims).start();
  }, [scaleAnim, opacityAnim, highlightAnim, scaleTo, activeOpacity, highlight, onPressIn]);

  const handlePressOut = useCallback(() => {
    onPressOut?.();
    const anims: Animated.CompositeAnimation[] = [
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
    ];
    if (highlight) {
      anims.push(
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        })
      );
    }
    Animated.parallel(anims).start();
  }, [scaleAnim, opacityAnim, highlightAnim, highlight, onPressOut]);

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

  const animatedStyle = useMemo(() => ({
    transform: [{ scale: scaleAnim }],
    opacity: opacityAnim,
  }), [scaleAnim, opacityAnim]);

  const hColor = highlightColor || colors.primary;
  const hOpacity = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.12],
  });

  return (
    <Pressable
      onPressIn={!disabled ? handlePressIn : undefined}
      onPressOut={!disabled ? handlePressOut : undefined}
      onPress={handlePress}
      onLongPress={!disabled ? handleLongPress : undefined}
      disabled={disabled}
    >
      <Animated.View testID={testID} style={[style, animatedStyle, containerStyle]}>
        {highlight && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius,
                backgroundColor: hColor,
                opacity: hOpacity,
                pointerEvents: 'none',
              },
            ]}
          />
        )}
        {children}
      </Animated.View>
    </Pressable>
  );
}
