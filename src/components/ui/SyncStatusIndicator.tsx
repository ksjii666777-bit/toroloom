/**
 * ============================================================================
 * Toroloom — SyncStatusIndicator
 * ============================================================================
 *
 * Persistent pill-like indicator at the top of the screen that shows the
 * current sync/offline status at a glance. Smaller than the full OfflineBanner,
 * it provides always-visible awareness of connectivity and data freshness.
 *
 * Status colors:
 *   - Green  → Online, all synced
 *   - Yellow → Pending mutations waiting to sync
 *   - Red    → Offline — viewing cached data
 *   - Blue   → Syncing in progress
 *   - Orange → Conflicts detected — needs user action
 *
 * Usage:
 *   import SyncStatusIndicator from '../components/ui/SyncStatusIndicator';
 *   <SyncStatusIndicator />
 *
 * ============================================================================
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated as RNAnimated,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineStore, type CacheNamespace } from '../../store/offlineStore';

import { runSyncCycle } from '../../hooks/useBackgroundSync';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

// ──── Config ────────────────────────────────────────────────────────────────

type StatusConfig = {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  pulse: boolean;
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  online: {
    color: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.2)',
    icon: 'checkmark-circle',
    label: 'All synced',
    pulse: false,
  },
  pending: {
    color: '#FFAB40',
    bgColor: 'rgba(255, 171, 64, 0.1)',
    borderColor: 'rgba(255, 171, 64, 0.2)',
    icon: 'sync-outline',
    label: 'Pending',
    pulse: false,
  },
  syncing: {
    color: '#60A5FA',
    bgColor: 'rgba(96, 165, 250, 0.1)',
    borderColor: 'rgba(96, 165, 250, 0.2)',
    icon: 'sync',
    label: 'Syncing...',
    pulse: true,
  },
  offline: {
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    icon: 'cloud-offline',
    label: 'Offline',
    pulse: false,
  },
  conflict: {
    color: '#F97316',
    bgColor: 'rgba(249, 115, 22, 0.1)',
    borderColor: 'rgba(249, 115, 22, 0.2)',
    icon: 'warning',
    label: 'Conflicts',
    pulse: false,
  },
};

const FRESHNESS_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  portfolio: { icon: 'pie-chart', label: 'Portfolio' },
  market: { icon: 'trending-up', label: 'Market' },
  watchlist: { icon: 'heart', label: 'Watchlist' },
  education: { icon: 'school', label: 'Courses' },
  openOrders: { icon: 'document-text', label: 'Orders' },
  fno: { icon: 'git-network', label: 'F&O' },
  community: { icon: 'people', label: 'Community' },
  aiInsights: { icon: 'bulb', label: 'AI' },
};

// ──── Component ────────────────────────────────────────────────────────────

export default function SyncStatusIndicator() {
  const insets = useSafeAreaInsets();
  const syncStatus = useOfflineStore((s) => s.syncStatus);
  const pendingTotal = useOfflineStore((s) => s.pendingTotal);
  const conflicts = useOfflineStore((s) => s.conflicts);
  const freshness = useOfflineStore((s) => s.freshness);
  const isSyncing = useOfflineStore((s) => s.isSyncing);
  const computeSyncStatus = useOfflineStore((s) => s.computeSyncStatus);
  const refreshFreshness = useOfflineStore((s) => s.refreshFreshness);

  const [expanded, setExpanded] = useState(false);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const rotateAnim = useRef(new RNAnimated.Value(0)).current;

  const config = STATUS_CONFIG[syncStatus] || STATUS_CONFIG.online;
  const pendingConflicts = conflicts.filter((c) => c.status === 'pending').length;

  // Pulse animation for syncing state
  useEffect(() => {
    if (config.pulse) {
      const loop = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
          RNAnimated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [config.pulse, pulseAnim]);

  // Spin animation for syncing icon
  useEffect(() => {
    if (syncStatus === 'syncing') {
      const loop = RNAnimated.loop(
        RNAnimated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    } else {
      rotateAnim.setValue(0);
    }
  }, [syncStatus, rotateAnim]);

  const spinInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Compute data info for mini display
  const [staleCount, setStaleCount] = useState(0);
  const [_oldestLabel, setOldestLabel] = useState<string | null>(null);

  useEffect(() => {
    const fresh = Object.values(freshness);
    const stale = fresh.filter((f) => f.isStale).length;
    setStaleCount(stale);

    // Find the worst freshness
    const ages = fresh
      .map((f) => f.ageLabel)
      .filter((a) => a !== 'never' && a !== 'just now');
    const worst = ages.sort((a, b) => {
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      return numB - numA;
    })[0] || null;
    setOldestLabel(worst);
  }, [freshness]);

  // Tap to toggle expanded with freshness refresh
  const handlePress = useCallback(() => {
    if (!expanded) {
      refreshFreshness();
      computeSyncStatus();
    }
    setExpanded((prev) => !prev);
  }, [expanded, refreshFreshness, computeSyncStatus]);

  // Manual sync trigger
  const handleSyncNow = useCallback(async () => {
    setExpanded(false);
    await runSyncCycle('manual');
    await refreshFreshness();
    computeSyncStatus();
  }, [refreshFreshness, computeSyncStatus]);

  // Count what to show on the pill
  const statusLabel =
    syncStatus === 'offline'
      ? 'Offline'
      : syncStatus === 'conflict'
        ? `${pendingConflicts} conflict${pendingConflicts !== 1 ? 's' : ''}`
        : syncStatus === 'syncing'
          ? 'Syncing'
          : pendingTotal > 0
            ? `${pendingTotal} pending`
            : 'All synced';

  return (
    <View
      style={[
        styles.container,
        {
          top: insets.top + 4,
          zIndex: expanded ? 9999 : 9990,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* ── Pill Button ── */}
      <Pressable
        onPress={handlePress}
        style={({pressed}) => [[
          styles.pill,
          {
            backgroundColor: config.bgColor,
            borderColor: config.borderColor,
          },
        ], {opacity: pressed ? 0.7 : 1}]}
      >
        <RNAnimated.View
          style={[
            styles.iconContainer,
            { opacity: pulseAnim },
            syncStatus === 'syncing' && { transform: [{ rotate: spinInterpolation }] },
          ]}
        >
          <Ionicons name={config.icon} size={12} color={config.color} />
        </RNAnimated.View>
        <Text style={[styles.label, { color: config.color }]}>{statusLabel}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={10}
          color={config.color}
          style={{ opacity: 0.6 }}
        />
      </Pressable>

      {/* ── Expanded Dropdown ── */}
      {expanded && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              borderColor: 'rgba(255,255,255,0.08)',
            },
          ]}
        >
          {/* Sync Summary */}
          <View style={styles.syncSummaryRow}>
            <View style={styles.summaryLeft}>
              <Ionicons
                name={syncStatus === 'offline' ? 'cloud-offline' : 'cloud-done'}
                size={14}
                color={config.color}
              />
              <Text style={[styles.summaryText, { color: config.color }]}>
                {syncStatus === 'offline'
                  ? 'You\'re offline — viewing cached data'
                  : pendingTotal > 0
                    ? `${pendingTotal} mutation${pendingTotal !== 1 ? 's' : ''} pending`
                    : 'All data synced'}
              </Text>
            </View>
            {pendingTotal > 0 && !isSyncing && (
              <Pressable onPress={handleSyncNow} style={styles.syncNowBtn}>
                <Ionicons name="sync-outline" size={11} color="#0D0D0D" />
                <Text style={styles.syncNowText}>Sync</Text>
              </Pressable>
            )}
          </View>

          {/* Data Freshness Mini Grid */}
          <View style={styles.freshnessMiniGrid}>
            {(Object.entries(FRESHNESS_ICONS) as [string, typeof FRESHNESS_ICONS[string]][]).map(
              ([ns, info]) => {
                const f = freshness[ns as CacheNamespace];
                if (!f) return null;
                const dotColor = f.ageLabel === 'never'
                  ? '#EF4444'
                  : f.isStale
                    ? '#FFAB40'
                    : '#22C55E';
                return (
                  <View key={ns} style={styles.freshnessRow}>
                    <Ionicons name={info.icon} size={10} color={dotColor} />
                    <Text style={[styles.freshnessLabel, { color: dotColor }]}>
                      {info.label}
                    </Text>
                    <Text style={[styles.freshnessTime, { color: dotColor }]}>
                      {f.ageLabel}
                    </Text>
                  </View>
                );
              },
            )}
          </View>

          {/* Stale / Conflict warnings */}
          {staleCount > 0 && (
            <View style={styles.warningRow}>
              <Ionicons name="information-circle" size={10} color="#FFAB40" />
              <Text style={styles.warningText}>
                {staleCount} stale
              </Text>
            </View>
          )}
          {pendingConflicts > 0 && (
            <View style={[styles.warningRow, { borderColor: 'rgba(249, 115, 22, 0.3)' }]}>
              <Ionicons name="warning" size={10} color="#F97316" />
              <Text style={[styles.warningText, { color: '#F97316' }]}>
                {pendingConflicts} conflict{pendingConflicts !== 1 ? 's' : ''} — tap banner to resolve
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ──── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  iconContainer: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    ...FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },

  // ── Dropdown ──
  dropdown: {
    marginTop: 6,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    width: 240,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  syncSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  summaryText: {
    ...FONTS.regular,
    fontSize: 10,
    flex: 1,
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#60A5FA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  syncNowText: {
    ...FONTS.semiBold,
    fontSize: 9,
    color: '#0D0D0D',
  },

  // ── Freshness Grid ──
  freshnessMiniGrid: {
    gap: 3,
    marginBottom: SPACING.xs,
  },
  freshnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  freshnessLabel: {
    ...FONTS.regular,
    fontSize: 9,
    width: 55,
  },
  freshnessTime: {
    ...FONTS.semiBold,
    fontSize: 9,
  },

  // ── Warnings ──
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  warningText: {
    ...FONTS.regular,
    fontSize: 9,
    color: '#FFAB40',
    flex: 1,
  },
});
