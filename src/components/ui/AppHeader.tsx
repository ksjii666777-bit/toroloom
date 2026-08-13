/**
 * ============================================================================
 * Toroloom — AppHeader
 * ============================================================================
 *
 * Compact, reusable screen header. Renders a primary title (optionally with a
 * subtitle) plus optional leading (back button, avatar) and trailing (actions)
 * slots. Safe-area inset is handled by AppScreen; this component only owns the
 * content row.
 *
 * Usage:
 *   <AppHeader
 *     title={t('journal.title')}
 *     subtitle={t('journal.subtitle')}
 *     left={<BackButton onPress={() => navigation.goBack()} />}
 *     right={<SyncStatusIndicator variant="inline" />}
 *   />
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS } from '../../constants/theme';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
};

export function AppHeader({ title, subtitle, left, right }: AppHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      {left ? <View style={styles.side}>{left}</View> : null}
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={[styles.side, styles.right]}>{right}</View> : null}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    side: {
      minWidth: 40,
      alignItems: 'flex-start',
    },
    right: {
      alignItems: 'flex-end',
      flex: 1,
    },
    center: {
      flex: 1,
    },
    title: {
      ...FONTS.title,
      color: colors.text,
    },
    subtitle: {
      ...FONTS.caption,
      color: colors.textMuted,
      marginTop: 2,
    },
  });
