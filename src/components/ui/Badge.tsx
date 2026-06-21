import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay } from 'react-native-reanimated';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';
  size?: 'small' | 'medium';
  /** Enable pop-in entrance animation */
  animated?: boolean;
  /** Delay before animation starts (ms) */
  animationDelay?: number;
}

const badgeColors = {
  primary: { bg: '#6C63FF20', text: '#6C63FF' },
  success: { bg: '#00C85320', text: '#00C853' },
  danger: { bg: '#FF174420', text: '#FF1744' },
  warning: { bg: '#FFC10720', text: '#FFC107' },
  info: { bg: '#00D2FF20', text: '#00D2FF' },
  neutral: { bg: '#6E6E9A20', text: '#6E6E9A' },
};

export default function Badge({ label, variant = 'primary', size = 'small', animated = false, animationDelay = 0 }: BadgeProps) {
  const colors = badgeColors[variant];
  const scaleAnim = useSharedValue(animated ? 0 : 1);
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  useEffect(() => {
    if (animated) {
      scaleAnim.value = withDelay(animationDelay, withSpring(1, { stiffness: 120, damping: 14 }));
    }
  }, [animated, animationDelay]);

  return (
    <Animated.View style={[
      styles.badge,
      { backgroundColor: colors.bg },
      size === 'medium' && styles.badgeMedium,
      badgeStyle,
    ]}>
      <View style={[styles.dot, { backgroundColor: colors.text }]} />
      <Text style={[
        styles.label,
        { color: colors.text },
        size === 'medium' && styles.labelMedium,
      ]}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  badgeMedium: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  label: {
    fontSize: FONTS.size.xs,
    fontWeight: '600',
    fontFamily: 'System',
  },
  labelMedium: {
    fontSize: FONTS.size.sm,
  },
});
