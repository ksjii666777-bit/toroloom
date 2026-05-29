import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';
  size?: 'small' | 'medium';
}

const badgeColors = {
  primary: { bg: '#6C63FF20', text: '#6C63FF' },
  success: { bg: '#00C85320', text: '#00C853' },
  danger: { bg: '#FF174420', text: '#FF1744' },
  warning: { bg: '#FFC10720', text: '#FFC107' },
  info: { bg: '#00D2FF20', text: '#00D2FF' },
  neutral: { bg: '#6E6E9A20', text: '#6E6E9A' },
};

export default function Badge({ label, variant = 'primary', size = 'small' }: BadgeProps) {
  const colors = badgeColors[variant];
  
  return (
    <View style={[
      styles.badge,
      { backgroundColor: colors.bg },
      size === 'medium' && styles.badgeMedium,
    ]}>
      <View style={[styles.dot, { backgroundColor: colors.text }]} />
      <Text style={[
        styles.label,
        { color: colors.text },
        size === 'medium' && styles.labelMedium,
      ]}>
        {label}
      </Text>
    </View>
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
