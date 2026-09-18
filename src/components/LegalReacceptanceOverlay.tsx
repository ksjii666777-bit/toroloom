/**
 * ============================================================================
 * Toroloom — Legal Re-acceptance Overlay
 * ============================================================================
 *
 * Blocking modal shown when the user's stored ToS/Privacy acceptance predates
 * LEGAL_DOCUMENT_VERSION (legal content changed since they accepted).
 *
 * Behaviour:
 *   - Rendered app-wide (next to BiometricUnlockOverlay in AppContent); shows
 *     only while the consent store flags re-acceptance as needed AND visible.
 *   - "Review updated terms" opens the in-app Legal screen (via navigationRef,
 *     since this overlay sits outside the NavigationContainer).
 *   - "Accept" records the new version — overlay dismisses.
 *   - NOT dismissible by tapping outside or back: acceptance is mandatory
 *     before continued use.
 * ============================================================================
 */

import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';
import { useLegalConsentStore } from '../store/legalConsentStore';
import { navigateFromRef } from '../navigation/navigationRef';

export default function LegalReacceptanceOverlay() {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  const isVisible = useLegalConsentStore((s) => s.isReacceptanceVisible);
  const accept = useLegalConsentStore((s) => s.accept);

  if (!isVisible) return null;

  return (
    <Modal transparent animationType="fade" onRequestClose={() => {/* intentionally not dismissible */}}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityLiveRegion="polite">
          <View style={styles.iconWrap}>
            <Ionicons name="document-text" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>{t('legal.reacceptanceTitle')}</Text>
          <Text style={styles.body}>{t('legal.reacceptanceBody')}</Text>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => navigateFromRef('Legal', { section: 'terms' })}
            accessibilityRole="link"
            accessibilityLabel={t('legal.reacceptanceReview')}
            testID="legal-reacceptance-review"
          >
            <Ionicons name="open-outline" size={16} color={colors.primary} />
            <Text style={styles.secondaryBtnText}>{t('legal.reacceptanceReview')}</Text>
          </Pressable>

          <Pressable
            style={styles.primaryBtn}
            onPress={() => { void accept('reacceptance'); }}
            accessibilityRole="button"
            accessibilityLabel={t('legal.reacceptanceAccept')}
            testID="legal-reacceptance-accept"
          >
            <Text style={styles.primaryBtnText}>{t('legal.reacceptanceAccept')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.bgOverlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.lg,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      alignItems: 'center',
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: BORDER_RADIUS.pill,
      backgroundColor: colors.bgInput,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    title: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.lg,
      color: colors.text,
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    body: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: SPACING.lg,
    },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.md,
    },
    secondaryBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    primaryBtn: {
      width: '100%',
      backgroundColor: colors.primary,
      borderRadius: BORDER_RADIUS.md,
      paddingVertical: SPACING.md,
      alignItems: 'center',
    },
    primaryBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.white,
    },
  });
