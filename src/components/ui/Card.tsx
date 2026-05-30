import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  gradient?: readonly [string, string];
  style?: ViewStyle;
  noPadding?: boolean;
  /** Enable entry animation (fade-in + slide-up) */
  animated?: boolean;
  /** Delay before entry animation starts (ms) */
  animationDelay?: number;
}

export default function Card({
  children,
  title,
  subtitle,
  rightAction,
  gradient,
  style,
  noPadding = false,
  animated = false,
  animationDelay = 0,
}: CardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Entry animation
  const entryAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (animated) {
      Animated.spring(entryAnim, {
        toValue: 1,
        useNativeDriver: true,
        delay: animationDelay,
        speed: 12,
        bounciness: 6,
      }).start();
    }
  }, [animated, animationDelay, entryAnim]);

  const animatedEntryStyle = animated ? {
    opacity: entryAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    transform: [{
      translateY: entryAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0],
      }),
    }],
  } : {};

  return (
    <Animated.View
      style={[
        styles.container,
        gradient && styles.gradientContainer,
        animatedEntryStyle,
        style,
      ]}
    >
      {gradient && (
        <View style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: BORDER_RADIUS.lg }]}
          />
        </View>
      )}
      {(title || subtitle || rightAction) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {rightAction && <View>{rightAction}</View>}
        </View>
      )}
      <View style={[!noPadding && styles.content]}>
        {children}
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  gradientContainer: {
    borderWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  content: {
    padding: SPACING.lg,
    paddingTop: 0,
  },
});
