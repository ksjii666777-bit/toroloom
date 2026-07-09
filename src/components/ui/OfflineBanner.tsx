/**
 * ============================================================================
 * Toroloom — OfflineBanner Component
 * ============================================================================
 *
 * A subtle, animated status bar that appears when the app is serving cached
 * data because the backend is unreachable. Shows data freshness per store,
 * pending mutation count, and allows manual sync.
 *
 * Usage:
 *   import OfflineBanner from '../components/ui/OfflineBanner';
 *   <OfflineBanner />
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
import { useOfflineStore, type CacheNamespace } from '../../store/offlineStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useMarketStore } from '../../store/marketStore';
import { useEducationStore } from '../../store/educationStore';
import { useFnoStore } from '../../store/fnoStore';
import { useCommunityStore } from '../../store/communityStore';
import { useAIStore } from '../../store/aiStore';
import { offlineMutationQueue } from '../../services/offlineMutationQueue';
import { offlineCache } from '../../services/offlineCache';
import { log } from '../../utils/logger';
import { analytics } from '../../services/analytics';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

// ──── Synchronised re-fetch across all offline-aware stores ────────────────
async function refreshAllStores(): Promise<boolean> {
  try {
    const results = await Promise.allSettled([
      usePortfolioStore.getState().refreshPortfolio(),
      useWatchlistStore.getState().fetchWatchlists(),
      useMarketStore.getState().refreshMarket(),
      useEducationStore.getState().fetchCourses(),
      useFnoStore.getState().fetchPositions(),
      useFnoStore.getState().fetchSpotPrices(),
      useCommunityStore.getState().fetchPosts(),
      useAIStore.getState().fetchInsights(),
    ]);
    return results.some(r => r.status === 'fulfilled');
  } catch (err) {
    log.warn('[OfflineBanner] refreshAllStores error:', err);
    return false;
  }
}

const SNOOZE_DURATION_MS = 30 * 60 * 1000;
const RECONNECT_DEBOUNCE_MS = 5_000;

// ──── Freshness helpers ──────────────────────────────────────────────────

const FRESHNESS_ICONS: Record<CacheNamespace, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  portfolio: { icon: 'pie-chart', label: 'Portfolio' },
  market: { icon: 'trending-up', label: 'Market' },
  watchlist: { icon: 'heart', label: 'Watchlist' },
  education: { icon: 'school', label: 'Courses' },
  openOrders: { icon: 'document-text', label: 'Orders' },
  fno: { icon: 'git-network', label: 'F&O' },
  community: { icon: 'people', label: 'Community' },
  aiInsights: { icon: 'bulb', label: 'AI Insights' },
};

function getFreshnessColor(isStale: boolean, ageLabel: string): string {
  if (ageLabel === 'just now') return '#22C55E';
  if (ageLabel === 'never') return '#EF4444';
  if (isStale) return '#FFAB40';
  return '#60A5FA';
}

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { combinedOffline, refresh: checkConnectivity } = useConnectivity();

  const [dismissed, setDismissed] = useState(false);
  const dismissedAtRef = useRef<number>(0);
  const lastReconnectRunRef = useRef<number>(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Offline store state
  const freshness = useOfflineStore(s => s.freshness);
  const refreshFreshness = useOfflineStore(s => s.refreshFreshness);
  const markSynced = useOfflineStore(s => s.markSynced);
  const setPendingGroups = useOfflineStore(s => s.setPendingGroups);

  // Stale count
  const staleCount = Object.values(freshness).filter(f => f.isStale).length;

  // ── Toast helper ──────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  // Initialize freshness on mount
  useEffect(() => {
    refreshFreshness();
  }, []);

  // Register auto-refresh when connectivity is restored
  useEffect(() => {
    const unsub = useConnectivityStore.getState().onReconnect(async () => {
      const now = Date.now();
      if (now - lastReconnectRunRef.current < RECONNECT_DEBOUNCE_MS) {
        log.info('[OfflineBanner] Reconnect debounced — skipping refresh');
        return;
      }
      lastReconnectRunRef.current = now;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        // 1. Process pending offline mutations first
        useOfflineStore.getState().setSyncing(true);
        const syncResults = await offlineMutationQueue.processAll();
        const syncedCount = syncResults.filter(r => r.success).length;
        const remaining = await offlineMutationQueue.getCount();
        setPendingCount(remaining);

        // 2. Mark freshness for synced stores
        if (syncedCount > 0) {
          markSynced('portfolio');
          markSynced('watchlist');
        }

        // 3. Then refresh stores
        const refreshSuccess = await refreshAllStores();

        // 4. Refresh freshness display
        await refreshFreshness();

        // 5. Compute offline duration
        const { reconnectedAt, wentOfflineAt } = useConnectivityStore.getState();
        const offlineDurationMs = wentOfflineAt
          ? reconnectedAt
            ? reconnectedAt.getTime() - wentOfflineAt.getTime()
            : Date.now() - wentOfflineAt.getTime()
          : 0;

        // 6. Log analytics
        analytics.logEvent('connectivity_restored', {
          reconnectedAt: reconnectedAt?.toISOString() || new Date().toISOString(),
          offlineDurationMs,
          mutationsSynced: syncedCount,
          storesRefreshed: refreshSuccess,
        }).catch(() => {});

        const failedCount = syncResults.filter(r => !r.success).length;

        log.info('[OfflineBanner] Connectivity restored', {
          reconnectedAt,
          offlineDurationMs,
          mutationsSynced: syncedCount,
          mutationsFailed: failedCount,
          storesRefreshed: refreshSuccess,
        });

        useOfflineStore.getState().setSyncing(false);

        // Toast messages
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
        useOfflineStore.getState().setSyncing(false);
      }
    });
    return unsub;
  }, [showToast, markSynced, refreshFreshness]);

  // Poll pending mutation count and freshness
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      if (!mounted) return;

      // Get pending mutations
      const mutations = await offlineMutationQueue.getAll();
      const total = mutations.length;
      if (mounted) setPendingCount(total);

      // Group by type
      const typeCount = new Map<string, { count: number; oldest: string | null }>();
      for (const m of mutations) {
        const group = typeCount.get(m.type) || { count: 0, oldest: null };
        group.count++;
        if (!group.oldest || m.enqueuedAt < group.oldest) {
          group.oldest = m.enqueuedAt;
        }
        typeCount.set(m.type, group);
      }

      const groups = Array.from(typeCount.entries()).map(([type, info]) => ({
        type,
        count: info.count,
        oldestAt: info.oldest,
      }));

      if (mounted) {
        setPendingGroups(groups, total);
        await refreshFreshness();
      }
    };

    poll();
    const interval = setInterval(poll, 8000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setPendingGroups, refreshFreshness]);

  // Show banner if offline or pending mutations
  const isEffectivelyOffline = combinedOffline || pendingCount > 0;

  // Auto-dismiss snoozed state when back online
  useEffect(() => {
    if (!combinedOffline && pendingCount === 0 && dismissed) {
      setDismissed(false);
    }
  }, [combinedOffline, pendingCount]);

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
    useOfflineStore.getState().setSyncing(true);
    try {
      const results = await offlineMutationQueue.processAll();
      const remaining = await offlineMutationQueue.getCount();
      setPendingCount(remaining);

      const synced = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      if (synced > 0) {
        markSynced('portfolio');
        markSynced('watchlist');
        await refreshFreshness();
      }

      useOfflineStore.getState().setSyncResult(failed > 0 ? 'partial' : 'success');

      if (remaining === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(`${synced} mutation${synced !== 1 ? 's' : ''} synced \u2713`, 'success');
      } else if (failed > 0) {
        showToast(`${failed} still pending`, 'error');
      }
    } catch {
      useOfflineStore.getState().setSyncResult('failed');
    } finally {
      setSyncing(false);
      useOfflineStore.getState().setSyncing(false);
    }
  };

  // ── Tap to Refresh ─────────────────────────────────────────────
  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefreshing(true);
    try {
      await checkConnectivity();
      const success = await refreshAllStores();

      // Mark stores as refreshed
      if (success) {
        markSynced('market');
        markSynced('portfolio');
        markSynced('watchlist');
        markSynced('education');
        markSynced('fno');
        markSynced('community');
        markSynced('aiInsights');
        await refreshFreshness();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
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

  // ── Retry failed mutations ──
  const handleRetry = useCallback(async () => {
    if (toast?.type !== 'error') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
    try {
      const results = await offlineMutationQueue.processAll();
      const synced = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const remaining = await offlineMutationQueue.getCount();
      setPendingCount(remaining);

      await refreshAllStores();
      await refreshFreshness();

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
  }, [toast?.type, showToast, refreshFreshness]);

  const handleToastDismiss = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  if (!show && !toast) return null;

  // Compute status color
  const statusColor = combinedOffline ? '#FFAB40' : pendingCount > 0 ? '#60A5FA' : '#22C55E';

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
          {/* ── Main Banner Row ── */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setExpanded(prev => !prev)}
            style={styles.mainRow}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <View style={styles.textContainer}>
              <Text style={styles.title}>
                {combinedOffline
                  ? "You're offline"
                  : pendingCount > 0
                    ? `${pendingCount} change${pendingCount !== 1 ? 's' : ''} pending`
                    : 'All synced'}
              </Text>
              <Text style={styles.subtitle}>
                {combinedOffline
                  ? 'Viewing cached data'
                  : pendingCount > 0
                    ? 'Waiting for network to sync'
                    : 'All data is up to date'}
              </Text>
            </View>
            <View style={styles.actionsRow}>
              {!syncing && !refreshing && (
                <>
                  {pendingCount > 0 && (
                    <TouchableOpacity onPress={handleSync} style={styles.syncBtn} hitSlop={8}>
                      <Ionicons name="sync-outline" size={13} color="#0D0D0D" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn} hitSlop={8}>
                    <Ionicons name="refresh-outline" size={13} color="#0D0D0D" />
                  </TouchableOpacity>
                </>
              )}
              {(syncing || refreshing) && (
                <View style={styles.syncBtn}>
                  <ActivityIndicator size="small" color="#0D0D0D" />
                </View>
              )}
              <TouchableOpacity onPress={handleDismiss} style={styles.dismissBtn} hitSlop={8}>
                <Ionicons name="close" size={14} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* ── Data Freshness Section (expanded) ── */}
          {expanded && (
            <View style={styles.freshnessSection}>
              <View style={styles.freshnessDivider} />
              <Text style={styles.freshnessTitle}>Data Freshness</Text>
              <View style={styles.freshnessGrid}>
                {(Object.entries(FRESHNESS_ICONS) as [CacheNamespace, typeof FRESHNESS_ICONS[CacheNamespace]][]).map(([ns, info]) => {
                  const f = freshness[ns];
                  const dotColor = getFreshnessColor(f.isStale, f.ageLabel);
                  return (
                    <View key={ns} style={styles.freshnessItem}>
                      <Ionicons name={info.icon} size={12} color={dotColor} style={{ marginRight: 4 }} />
                      <View style={styles.freshnessTextCol}>
                        <Text style={styles.freshnessLabel}>{info.label}</Text>
                        <Text style={[styles.freshnessAge, { color: dotColor }]}>{f.ageLabel}</Text>
                      </View>
                      <View style={[styles.freshnessDot, { backgroundColor: dotColor }]} />
                    </View>
                  );
                })}
              </View>

              {/* Stale count warning */}
              {staleCount > 0 && (
                <View style={styles.staleWarning}>
                  <Ionicons name="information-circle" size={12} color="#FFAB40" />
                  <Text style={styles.staleWarningText}>
                    {staleCount} data set{staleCount !== 1 ? 's' : ''} stale — pull to refresh
                  </Text>
                </View>
              )}

              {/* Pending mutations detail */}
              {pendingCount > 0 && (
                <View style={styles.pendingSection}>
                  <View style={styles.freshnessDivider} />
                  <Text style={styles.freshnessTitle}>Pending Sync</Text>
                  <TouchableOpacity
                    style={styles.syncAllBtn}
                    onPress={handleSync}
                    disabled={syncing}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="sync-outline" size={14} color="#0D0D0D" />
                    <Text style={styles.syncAllText}>
                      {syncing ? 'Syncing...' : `Sync ${pendingCount} pending`}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Cache management */}
              <View style={styles.freshnessDivider} />
              <TouchableOpacity
                style={styles.cacheRow}
                onPress={async () => {
                  await offlineCache.clearAll();
                  await refreshFreshness();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  showToast('Cache cleared', 'info');
                }}
                activeOpacity={0.6}
              >
                <Ionicons name="trash-outline" size={13} color="#EF4444" />
                <Text style={styles.cacheClearText}>Clear offline cache</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      )}

      {/* ── Reconnect Toast ── */}
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
                size={14}
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
                <Ionicons name="refresh-outline" size={11} color="#EF4444" style={{ marginLeft: 2 }} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleToastDismiss} hitSlop={6}>
              <Ionicons name="close" size={12} color="rgba(255,255,255,0.4)" />
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
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 171, 64, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 171, 64, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFAB40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Freshness Section ──
  freshnessSection: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  freshnessDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: SPACING.sm,
  },
  freshnessTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  freshnessGrid: {
    gap: 6,
  },
  freshnessItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  freshnessTextCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  freshnessLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.8)',
  },
  freshnessAge: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  freshnessDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  staleWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.sm,
  },
  staleWarningText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: '#FFAB40',
    flex: 1,
  },
  // ── Pending Section ──
  pendingSection: {
    marginTop: SPACING.xs,
  },
  syncAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFAB40',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  syncAllText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: '#0D0D0D',
  },
  // ── Cache Row ──
  cacheRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.xs,
  },
  cacheClearText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: '#EF4444',
  },
  // ── Toast ──
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
});
