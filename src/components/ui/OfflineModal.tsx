/**
 * ============================================================================
 * Toroloom — OfflineModal
 * ============================================================================
 *
 * Clean, production-ready offline presentation. Replaces the old floating
 * popup with a proper modal: dark scrim backdrop + bottom sheet that says
 * "You're offline", explains we're showing the latest cached data, and offers
 * Retry + Close. No raw errors are ever shown — connectivity failures are
 * logged internally only.
 *
 * Mounted once in AppNavigator:
 *   <OfflineModal />
 *
 * ============================================================================
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useConnectivityStore } from '../../store/connectivityStore';
import { refreshAllStores } from '../../services/offlineRefresh';
import { useT } from '../../hooks/useT';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

export default function OfflineModal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const combinedOffline = useConnectivityStore(s => s.combinedOffline);
  const isChecking = useConnectivityStore(s => s.isChecking);
  const refresh = useConnectivityStore(s => s.refresh);

  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Re-arm the modal each time the app actually drops offline again.
  useEffect(() => {
    if (!combinedOffline) setDismissed(false);
  }, [combinedOffline]);

  const visible = combinedOffline && !dismissed;

  const handleRetry = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRetrying(true);
    try {
      await refresh(); // health check
      await refreshAllStores(); // pull latest cached-fresh data
      if (!useConnectivityStore.getState().combinedOffline) {
        setDismissed(true);
      }
    } catch {
      // Still offline — keep the modal open; never surface raw errors.
    } finally {
      setRetrying(false);
    }
  }, [refresh]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDismissed(true);
  }, []);

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={handleClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, SPACING.lg),
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={[styles.iconBox, { backgroundColor: colors.warningDim }]}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.warning} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{t('components.offlineBanner.youReOffline')}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {t('components.offlineBanner.viewingCached')}
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={handleRetry}
              disabled={retrying}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.retryBtn,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
              ]}
            >
              {retrying || isChecking ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.retryText}>{t('app.retry')}</Text>
              )}
            </Pressable>
            <Pressable
              onPress={handleClose}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.closeBtn,
                { borderColor: colors.borderLight },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.closeText, { color: colors.textSecondary }]}>{t('app.close')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: SPACING.lg,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...FONTS.title,
    textAlign: 'center',
  },
  message: {
    ...FONTS.body,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  actions: {
    alignSelf: 'stretch',
    gap: SPACING.sm,
  },
  retryBtn: {
    minHeight: 48,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#FFFFFF',
  },
  closeBtn: {
    minHeight: 48,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  closeText: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
