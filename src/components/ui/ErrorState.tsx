/**
 * ============================================================================
 * Toroloom — ErrorState
 * ============================================================================
 *
 * Friendly, human-facing error state. NEVER renders technical details — the
 * `detail` prop is logged internally (see onRetry) but never displayed, so
 * users never see raw exceptions / Java errors / stack traces.
 *
 * Usage:
 *   <ErrorState
 *     icon="cloud-offline-outline"
 *     title={t('errors.brokerConnect.title')}
 *     message={t('errors.brokerConnect.message')}
 *     onRetry={retry}
 *     detail={technicalError}   // internal only — never rendered
 *   />
 * ============================================================================
 */

import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import Button from './Button';

type ErrorStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  /** Technical details — logged internally, never rendered to the user. */
  detail?: unknown;
  compact?: boolean;
};

export function ErrorState({
  icon = 'alert-circle-outline',
  title,
  message,
  retryLabel = 'Retry',
  onRetry,
  detail,
  compact,
}: ErrorStateProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Technical context is only ever surfaced to the internal log — and only
  // once per detail value, to avoid warn-spam on re-renders.
  const warnedRef = useRef<unknown>(null);
  if (detail != null && warnedRef.current !== detail) {
    warnedRef.current = detail;
    console.warn(`[ErrorState] ${title}:`, detail);
  }

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.iconBox, { backgroundColor: colors.dangerDim }]}>
        <Ionicons name={icon} size={compact ? 24 : 32} color={colors.danger} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      {onRetry ? (
        <View style={styles.retryWrap}>
          <Button title={retryLabel} variant="primary" size="medium" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (_colors: any) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      paddingVertical: SPACING.huge,
      paddingHorizontal: SPACING.xl,
      gap: SPACING.sm,
    },
    wrapCompact: {
      paddingVertical: SPACING.xl,
    },
    iconBox: {
      width: 64,
      height: 64,
      borderRadius: BORDER_RADIUS.xl,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.sm,
    },
    title: {
      ...FONTS.bodyStrong,
      textAlign: 'center',
    },
    message: {
      ...FONTS.caption,
      textAlign: 'center',
      lineHeight: 20,
    },
    retryWrap: {
      marginTop: SPACING.lg,
    },
  });
