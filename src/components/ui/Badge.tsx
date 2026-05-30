import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
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
  const scaleAnim = useRef(new Animated.Value(animated ? 0 : 1)).current;

  useEffect(() => {
    if (animated) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        delay: animationDelay,
        speed: 14,
        bounciness: 8,
      }).start();
    }
  }, [animated, animationDelay, scaleAnim]);

  return (
    <Animated.View style={[
      styles.badge,
      { backgroundColor: colors.bg },
      size === 'medium' && styles.badgeMedium,
      { transform: [{ scale: scaleAnim }] },
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
