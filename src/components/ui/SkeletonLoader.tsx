import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { BORDER_RADIUS, SPACING } from '../../constants/theme';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  variant?: 'rect' | 'circle' | 'text';
}

export function SkeletonBlock({ width = '100%', height = 20, borderRadius = BORDER_RADIUS.sm, style, variant = 'rect' }: SkeletonLoaderProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.3);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 }),
      ),
      -1, // infinite repeat
      true // yoyo (reverse each cycle)
    );
    return () => { opacity.value = 0.3; }; // cleanup
  }, []);

  const finalBorderRadius = variant === 'circle' ? 999 : borderRadius;

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: finalBorderRadius,
          backgroundColor: colors.bgCardLight,
        },
        shimmerStyle,
        style,
      ]}
    />
  );
}

interface SkeletonCardProps {
  lines?: number;
  hasAvatar?: boolean;
  hasAction?: boolean;
  style?: ViewStyle;
}

export function SkeletonCard({ lines = 3, hasAvatar = true, hasAction = false, style }: SkeletonCardProps) {
  return (
    <View style={[skeletonStyles.card, style]}>
      <View style={skeletonStyles.row}>
        {hasAvatar && <SkeletonBlock width={40} height={40} borderRadius={BORDER_RADIUS.md} />}
        <View style={skeletonStyles.content}>
          <SkeletonBlock width="60%" height={14} />
          <View style={{ height: SPACING.sm }} />
          <SkeletonBlock width="40%" height={12} />
          {lines > 2 && (
            <>
              <View style={{ height: SPACING.xs }} />
              <SkeletonBlock width="80%" height={10} />
            </>
          )}
        </View>
        {hasAction && <SkeletonBlock width={60} height={32} borderRadius={BORDER_RADIUS.full} />}
      </View>
    </View>
  );
}

interface SkeletonListProps {
  count?: number;
  cardProps?: Partial<SkeletonCardProps>;
  style?: ViewStyle;
}

export function SkeletonList({ count = 5, cardProps, style }: SkeletonListProps) {
  return (
    <View style={style}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} {...cardProps} />
      ))}
    </View>
  );
}

export function PortfolioSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[skeletonStyles.portfolioCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <SkeletonBlock width={80} height={12} />
      <View style={{ height: SPACING.sm }} />
      <SkeletonBlock width="50%" height={32} />
      <View style={{ height: SPACING.md }} />
      <View style={skeletonStyles.statsRow}>
        {[1, 2, 3].map(i => (
          <View key={i} style={skeletonStyles.statItem}>
            <SkeletonBlock width={60} height={24} />
            <View style={{ height: 4 }} />
            <SkeletonBlock width={40} height={10} />
          </View>
        ))}
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  portfolioCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  statItem: {
    alignItems: 'center',
  },
});
