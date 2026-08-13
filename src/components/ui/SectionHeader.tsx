/**
 * ============================================================================
 * Toroloom — SectionHeader
 * ============================================================================
 *
 * Clean section heading with an optional trailing action ("See All").
 * Replaces ad-hoc title/seeAll rows so every screen uses the same rhythm:
 *   16px section title · 24px bottom gap · 4px accent rule for hierarchy.
 *
 * Usage:
 *   <SectionHeader
 *     title={t('home.marketIndices')}
 *     actionLabel={t('app.seeAll')}
 *     onAction={() => navigation.navigate('Markets')}
 *     testID="home-section-market-indices"
 *   />
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS } from '../../constants/theme';

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

export function SectionHeader({ title, actionLabel, onAction, testID }: SectionHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <View style={[styles.accentRule, { backgroundColor: colors.primary }]} />
        <Text style={styles.title} testID={testID}>
          {title}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.lg,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      flexShrink: 1,
    },
    accentRule: {
      width: 3,
      height: 16,
      borderRadius: 2,
    },
    title: {
      ...FONTS.section,
      color: colors.text,
      flexShrink: 1,
    },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingLeft: SPACING.md,
    },
    actionPressed: {
      opacity: 0.6,
    },
    actionText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
    },
  });
