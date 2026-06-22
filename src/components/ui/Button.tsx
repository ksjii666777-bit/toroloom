import React, { useMemo } from 'react';
import { Text, StyleSheet, ActivityIndicator, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from './AnimatedPressable';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  gradient?: readonly [string, string];
  testID?: string;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style,
  gradient,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const getGradient = (): readonly [string, string] | undefined => {
    if (gradient) return gradient;
    switch (variant) {
      case 'primary': return colors.primaryGradient;
      case 'secondary': return colors.secondaryGradient;
      case 'success': return ['#00C853', '#009624'];
      case 'danger': return ['#FF1744', '#D50000'];
      case 'outline':
      case 'ghost': return undefined;
      default: return colors.primaryGradient;
    }
  };

  const getSize = () => {
    switch (size) {
      case 'small': return { paddingVertical: 8, paddingHorizontal: 16, fontSize: FONTS.size.sm };
      case 'large': return { paddingVertical: 16, paddingHorizontal: 32, fontSize: FONTS.size.lg };
      default: return { paddingVertical: 12, paddingHorizontal: 24, fontSize: FONTS.size.md };
    }
  };

  const sizeStyle = getSize();
  const btnGradient = getGradient();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const content = (
    <View style={[styles.content, icon ? styles.contentWithIcon : null]}>
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.white} size="small" />
      ) : (
        <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[
            styles.text,
            { fontSize: sizeStyle.fontSize },
            variant === 'outline' && styles.outlineText,
            variant === 'ghost' && styles.ghostText,
          ]}>
            {title}
          </Text>
        </>
      )}
    </View>
  );

  const isOutline = variant === 'outline' || variant === 'ghost';
  const paddingStyle = { paddingVertical: sizeStyle.paddingVertical, paddingHorizontal: sizeStyle.paddingHorizontal };

  if (isOutline) {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={isDisabled}
        testID={testID}
        scaleTo={0.97}
        haptic="light"
        highlight
        highlightColor={colors.primary}
        borderRadius={BORDER_RADIUS.lg}
        style={[
          styles.base,
          variant === 'outline' && styles.outline,
          paddingStyle,
          isDisabled && styles.disabled,
          style,
        ]}
      >
        {content}
      </AnimatedPressable>
    );
  }

  if (btnGradient) {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={isDisabled}
        testID={testID}
        scaleTo={0.97}
        haptic="light"
        style={[isDisabled && styles.disabled, style]}
      >
        <LinearGradient
          colors={btnGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.base,
            styles.gradientBase,
            paddingStyle,
          ]}
        >
          {content}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      scaleTo={0.97}
      haptic="light"
      highlight
      highlightColor={colors.primary}
      borderRadius={BORDER_RADIUS.lg}
      style={[
        styles.base,
        styles.solid,
        paddingStyle,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {content}
    </AnimatedPressable>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  base: {
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gradientBase: {
    borderRadius: BORDER_RADIUS.lg,
  },
  solid: {
    backgroundColor: colors.primary,
  },
  outline: {
    backgroundColor: colors.transparent,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWithIcon: {
    gap: SPACING.sm,
  },
  iconContainer: {
    marginRight: SPACING.xs,
  },
  text: {
    color: colors.white,
    fontFamily: 'System',
    fontWeight: '600',
  },
  outlineText: {
    color: colors.primary,
  },
  ghostText: {
    color: colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
});
