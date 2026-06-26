/**
 * ============================================================================
 * Toroloom — OfflineBanner Component
 * ============================================================================
 *
 * A subtle, animated status bar that appears when the app is serving cached
 * data because the backend is unreachable. Dismissible by the user.
 *
 * Usage:
 *   import OfflineBanner from '../components/ui/OfflineBanner';
 *   // Place once at the top of the app (e.g., in App.tsx or MainTabs)
 *   <OfflineBanner />
 *
 * Behavior:
 *   - Shows "You're offline — viewing cached data" with a cloud-offline icon
 *   - Auto-dismisses when connectivity is restored
 *   - User can manually dismiss (snoozes for 30 min)
 *   - Animated slide-in/slide-out with spring physics
 *
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useConnectivityStore } from '../../store/connectivityStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useMarketStore } from '../../store/marketStore';
import { useEducationStore } from '../../store/educationStore';
import { offlineMutationQueue } from '../../services/offlineMutationQueue';
import { log } from '../../utils/logger';
import { analytics } from '../../services/analytics';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

// ──── Synchronised re-fetch across all offline-aware stores ────────────────
// Returns true if any store actually re-fetched fresh data (i.e. backend was reachable).
async function refreshAllStores(): Promise<boolean> {
  try {
    const results = await Promise.allSettled([
      usePortfolioStore.getState().refreshPortfolio(),
      useWatchlistStore.getState().fetchWatchlists(),
      useMarketStore.getState().refreshMarket(),
      useEducationStore.getState().fetchCourses(),
    ]);
    return results.some(r => r.status === 'fulfilled');
  } catch (err) {
    log.warn('[OfflineBanner] refreshAllStores error:', err);
    return false;
  }
}

const SNOOZE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const RECONNECT_DEBOUNCE_MS = 5_000; // 5 seconds

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { combinedOffline, refresh: checkConnectivity } = useConnectivity();

  const [dismissed, setDismissed] = useState(false);
  const dismissedAtRef = useRef<number>(0);
  const lastReconnectRunRef = useRef<number>(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toast helper ──────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  // Register auto-refresh when connectivity is restored
  useEffect(() => {
    const unsub = useConnectivityStore.getState().onReconnect(async () => {
      // Debounce: skip if we ran within the last 5 seconds (rapid online/offline flips)
      const now = Date.now();
      if (now - lastReconnectRunRef.current < RECONNECT_DEBOUNCE_MS) {
        log.info('[OfflineBanner] Reconnect debounced — skipping refresh');
        return;
      }
      lastReconnectRunRef.current = now;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        // 1. Process pending offline mutations first
        const syncResults = await offlineMutationQueue.processAll();
        const syncedCount = syncResults.filter(r => r.success).length;
        const remaining = await offlineMutationQueue.getCount();
        setPendingCount(remaining);

        // 2. Then refresh stores so they reflect the replayed mutations
        const refreshSuccess = await refreshAllStores();

        // 3. Compute offline duration
        const { reconnectedAt, wentOfflineAt } = useConnectivityStore.getState();
        const offlineDurationMs = wentOfflineAt
          ? reconnectedAt
            ? reconnectedAt.getTime() - wentOfflineAt.getTime()
            : Date.now() - wentOfflineAt.getTime()
          : 0;

        // 4. Log analytics event
        analytics.logEvent('connectivity_restored', {
          reconnectedAt: reconnectedAt?.toISOString() || new Date().toISOString(),
          offlineDurationMs,
          mutationsSynced: syncedCount,
          storesRefreshed: refreshSuccess,
        }).catch(() => {});

        // 5. Count failures
        const failedCount = syncResults.filter(r => !r.success).length;

        // 6. Console log for dev visibility
        log.info('[OfflineBanner] Connectivity restored', {
          reconnectedAt,
          offlineDurationMs,
          mutationsSynced: syncedCount,
          mutationsFailed: failedCount,
          storesRefreshed: refreshSuccess,
        });

        // 6. Toast messages (failures take precedence over successes)
        if (failedCount > 0 && syncedCount > 0) {
          showToast(`${syncedCount} synced \u2022 ${failedCount} failed`, 'error');
        } else if (failedCount > 0) {
          showToast(`${failedCount} mutation${failedCount !== 1 ? 's' : ''} failed to sync`, 'error');
        } else if (syncedCount > 0 && refreshSuccess) {
          showToast(`${syncedCount} mutation${syncedCount !== 1 ? 's' : ''} synced \u2022 Data refreshed`, 'success');
        } else if (syncedCount > 0) {
          showToast(`${syncedCount} mutation${syncedCount !== 1 ? 's' : ''} synced \u2713`, 'success');
        } else if (refreshSuccess) {
          showToast('Data refreshed \u2713', 'success');
        }
      } catch (err) {
        log.warn('[OfflineBanner] Auto-refresh on reconnect failed:', err);
      }
    });
    return unsub;
  }, [showToast]);

  // Poll pending mutation count
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      const count = await offlineMutationQueue.getCount();
      if (mounted) setPendingCount(count);
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Show banner if:
  // 1. combinedOffline (health check OR any store stale) OR
  // 2. There are pending mutations waiting to sync
  // 3. Not manually dismissed (or snooze expired)
  const isEffectivelyOffline = combinedOffline || pendingCount > 0;

  // Auto-dismiss snoozed state when we're back online
  useEffect(() => {
    if (!combinedOffline && pendingCount === 0 && dismissed) {
      setDismissed(false);
    }
  }, [combinedOffline, pendingCount]);

  // Check if snooze expired
  const isSnoozed = useCallback(() => {
    if (!dismissed) return false;
    return Date.now() - dismissedAtRef.current < SNOOZE_DURATION_MS;
  }, [dismissed]);

  const show = isEffectivelyOffline && !isSnoozed();

  // ── Animation ──
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (show) {
      translateY.value = withSpring(0, { stiffness: 120, damping: 14 });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withSpring(-80, { stiffness: 120, damping: 14 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [show]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const [refreshing, setRefreshing] = useState(false);

  // ── Sync Now (replay pending offline mutations) ──────────────────
  const handleSync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSyncing(true);
    try {
      await offlineMutationQueue.processAll();
      const remaining = await offlineMutationQueue.getCount();
      setPendingCount(remaining);
      if (remaining === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      // Sync failed — stay visible
    } finally {
      setSyncing(false);
    }
  };

  // ── Tap to Refresh — check connectivity & re-fetch stores ────────
  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    try {
      // First check if we're back online
      await checkConnectivity();

      // Then try to re-fetch all offline-aware stores
      const success = await refreshAllStores();
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        // Could not reach backend — error haptic
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      // Refresh failed
    } finally {
      setRefreshing(false);
    }
  };

  // ── Dismiss ──
  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dismissedAtRef.current = Date.now();
    setDismissed(true);
  };

  // ── Retry failed mutations (triggered by tapping error toast) ──
  const handleRetry = useCallback(async () => {
    if (toast?.type !== 'error') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Clear the current toast immediately to show fresh state
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
    try {
      const results = await offlineMutationQueue.processAll();
      const synced = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const remaining = await offlineMutationQueue.getCount();
      setPendingCount(remaining);

      // Refresh stores to reflect replayed mutations
      await refreshAllStores();

      // Show result toast
      if (failed > 0 && synced > 0) {
        showToast(`${synced} synced \u2022 ${failed} still failed`, 'error');
      } else if (failed > 0) {
        showToast(`${failed} mutation${failed !== 1 ? 's' : ''} still failed`, 'error');
      } else if (synced > 0) {
        showToast(`${synced} mutation${synced !== 1 ? 's' : ''} synced \u2713`, 'success');
      }
    } catch {
      showToast('Retry failed \u2014 network error', 'error');
    }
  }, [toast?.type, showToast]);

  // ── Toast dismiss ──
  const handleToastDismiss = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, []);

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  if (!show && !toast) return null;

  const subtitle = pendingCount > 0
    ? `${pendingCount} pending change${pendingCount !== 1 ? 's' : ''} waiting to sync`
    : 'Viewing cached data — some features may be limited';

  // Single return — banner and toast render independently
  return (
    <>
      {show && (
        <Animated.View
          style={[
            styles.container,
            animStyle,
            { top: insets.top + 4, left: SPACING.md, right: SPACING.md },
          ]}
        >
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="cloud-offline-outline" size={18} color="#FFAB40" />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.title}>
                {pendingCount > 0 ? 'Changes pending sync' : "You're offline"}
              </Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <View style={styles.actionsRow}>
              {!syncing && !refreshing && (
                <>
                  <TouchableOpacity
                    onPress={handleRefresh}
                    style={styles.refreshBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="refresh-outline" size={14} color="#0D0D0D" />
                    <Text style={styles.actionBtnText}>Refresh</Text>
                  </TouchableOpacity>
                  {pendingCount > 0 && (
                    <TouchableOpacity
                      onPress={handleSync}
                      style={styles.syncBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="sync-outline" size={14} color="#0D0D0D" />
                      <Text style={styles.actionBtnText}>Sync</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              {(syncing || refreshing) && (
                <View style={styles.syncBtn}>
                  <ActivityIndicator size="small" color="#0D0D0D" />
                </View>
              )}
              <TouchableOpacity
                onPress={handleDismiss}
                style={styles.dismissBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {/* ── Reconnect Toast — independent of the offline banner ── */}
      {toast && (
        <Animated.View
          style={[
            styles.toastOuter,
            { top: insets.top + 4, left: SPACING.md, right: SPACING.md },
          ]}
        >
          <View
            style={[
              styles.toastContainer,
              toast.type === 'success' && styles.toastSuccess,
              toast.type === 'error' && styles.toastError,
            ]}
          >
            <TouchableOpacity
              onPress={handleRetry}
              disabled={toast.type !== 'error'}
              style={styles.toastContent}
              activeOpacity={0.7}
            >
              <Ionicons
                name={toast.type === 'success' ? 'checkmark-circle' : toast.type === 'error' ? 'alert-circle' : 'information-circle'}
                size={16}
                color={toast.type === 'success' ? '#22C55E' : toast.type === 'error' ? '#EF4444' : '#60A5FA'}
              />
              <Text
                style={[
                  styles.toastText,
                  toast.type === 'success' && styles.toastTextSuccess,
                  toast.type === 'error' && styles.toastTextError,
                ]}
              >
                {toast.message}
              </Text>
              {toast.type === 'error' && (
                <Ionicons name="refresh-outline" size={12} color="#EF4444" style={{ marginLeft: 2 }} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleToastDismiss} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close" size={14} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 9999,
    backgroundColor: 'rgba(255, 171, 64, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 171, 64, 0.25)',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 171, 64, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: '#FFAB40',
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 171, 64, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 171, 64, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFAB40',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
  },
  toastOuter: {
    position: 'absolute',
    zIndex: 9998,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  toastSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  toastError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  toastContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toastText: {
    flex: 1,
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.8)',
  },
  toastTextSuccess: {
    color: '#22C55E',
  },
  toastTextError: {
    color: '#EF4444',
  },
  actionBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: '#0D0D0D',
  },
  dismissBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
