/**
 * ============================================================================
 * Toroloom — BackgroundSyncSettingsScreen
 * ============================================================================
 *
 * Settings screen for configuring periodic background data sync.
 * Users can enable/disable, choose interval (15min–4hr), see last sync time,
 * and trigger an immediate manual sync.
 *
 * Features:
 *   - Toggle: enable/disable background sync
 *   - Interval selector: 15min, 30min, 1hr, 2hr, 4hr
 *   - Last sync timestamp + status indicator
 *   - "Sync Now" button for immediate manual sync
 *   - Battery optimization note
 *   - Pull-to-refresh for latest sync status
 * ============================================================================
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Animated as RNAnimated,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getBackgroundSyncEnabled,
  getBackgroundSyncIntervalMinutes,
  getLastSyncTimestamp,
  setBackgroundSyncEnabled,
  setBackgroundSyncInterval,
  syncNow,
  SYNC_INTERVAL_OPTIONS,
} from '../../services/backgroundSyncService';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

// ──── Helpers ──────────────────────────────────────────────────────────────

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Never';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60_000) return 'Just now';
    if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m ago`;
    if (diffMs < 86_400_000) return `${Math.round(diffMs / 3_600_000)}h ago`;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown';
  }
}

function getIntervalLabel(minutes: number): string {
  const opt = SYNC_INTERVAL_OPTIONS.find((o) => o.value === minutes);
  return opt?.label ?? `${minutes} minutes`;
}

// ──── Component ────────────────────────────────────────────────────────────

export default function BackgroundSyncSettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [enabled, setEnabledState] = useState<boolean>(true);
  const [intervalMinutes, setIntervalState] = useState<number>(30);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showIntervalPicker, setShowIntervalPicker] = useState(false);

  const spinAnim = useRef(new RNAnimated.Value(0)).current;

  // ── Load preferences on mount ──
  const loadPreferences = useCallback(async () => {
    const [e, i, l] = await Promise.all([
      getBackgroundSyncEnabled(),
      getBackgroundSyncIntervalMinutes(),
      getLastSyncTimestamp(),
    ]);
    setEnabledState(e);
    setIntervalState(i);
    setLastSync(l);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // ── Spin animation for sync icon ──
  useEffect(() => {
    if (isSyncingNow) {
      const loop = RNAnimated.loop(
        RNAnimated.timing(spinAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [isSyncingNow, spinAnim]);

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── Toggle handler ──
  const handleToggle = useCallback(
    async (value: boolean) => {
      setEnabledState(value);
      await setBackgroundSyncEnabled(value);
    },
    [],
  );

  // ── Interval change handler ──
  const handleIntervalChange = useCallback(
    async (minutes: number) => {
      setIntervalState(minutes);
      setShowIntervalPicker(false);
      await setBackgroundSyncInterval(minutes);
    },
    [],
  );

  // ── Sync Now handler ──
  const handleSyncNow = useCallback(async () => {
    setIsSyncingNow(true);
    try {
      await syncNow();
      const ts = await getLastSyncTimestamp();
      setLastSync(ts);
    } catch {
      // Error already logged
    } finally {
      setIsSyncingNow(false);
    }
  }, []);

  // ── Pull-to-refresh ──
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPreferences();
    setRefreshing(false);
  }, [loadPreferences]);

  // ── Loading state ──
  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Background Sync</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.bgSecondary}
          />
        }
      >
        {/* ── Hero Card ── */}
        <View style={styles.heroCard}>
          <RNAnimated.View
            style={[
              styles.heroIconContainer,
              isSyncingNow && { transform: [{ rotate: spinInterpolation }] },
            ]}
          >
            <Ionicons
              name={isSyncingNow ? 'sync' : 'cloud-done'}
              size={28}
              color={isSyncingNow ? '#60A5FA' : '#22C55E'}
            />
          </RNAnimated.View>
          <Text style={styles.heroTitle}>
            {enabled
              ? isSyncingNow
                ? 'Syncing...'
                : 'Background Sync Active'
              : 'Background Sync Disabled'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {enabled
              ? `Refreshes every ${getIntervalLabel(intervalMinutes).toLowerCase()}`
              : 'Enable to keep portfolio & watchlist up to date'}
          </Text>
          <View style={styles.lastSyncRow}>
            <Ionicons
              name="time-outline"
              size={12}
              color={lastSync ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)'}
            />
            <Text style={styles.lastSyncText}>
              Last sync: {formatSyncTime(lastSync)}
            </Text>
          </View>
        </View>

        {/* ── Toggle Card ── */}
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                <Ionicons name="sync" size={18} color="#22C55E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Enable Background Sync</Text>
                <Text style={styles.settingDesc}>
                  Periodically refresh portfolio, watchlist & orders
                </Text>
              </View>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(34, 197, 94, 0.4)' }}
              thumbColor={enabled ? '#22C55E' : 'rgba(255,255,255,0.5)'}
            />
          </View>
        </View>

        {/* ── Interval Card ── */}
        <View style={styles.settingsCard}>
          <Pressable
            onPress={() => setShowIntervalPicker(!showIntervalPicker)}
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: enabled ? (pressed ? 0.7 : 1) : 0.5 },
            ]}
            disabled={!enabled}
          >
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="timer-outline" size={18} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Sync Interval</Text>
                <Text style={styles.settingDesc}>
                  {getIntervalLabel(intervalMinutes)}
                </Text>
              </View>
            </View>
            <Ionicons
              name={showIntervalPicker ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={enabled ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
            />
          </Pressable>

          {/* Interval Picker Dropdown */}
          {showIntervalPicker && enabled && (
            <View style={styles.intervalPicker}>
              {SYNC_INTERVAL_OPTIONS.map((opt, idx) => (
                <Pressable
                  key={opt.value}
                  onPress={() => handleIntervalChange(opt.value)}
                  style={({ pressed }) => [
                    styles.intervalOption,
                    idx < SYNC_INTERVAL_OPTIONS.length - 1 && styles.intervalOptionBorder,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View style={styles.intervalOptionLeft}>
                    <Ionicons
                      name={
                        opt.value <= 30
                          ? 'speedometer'
                          : opt.value <= 60
                            ? 'time'
                            : 'time-outline'
                      }
                      size={14}
                      color={intervalMinutes === opt.value ? '#3B82F6' : 'rgba(255,255,255,0.4)'}
                    />
                    <Text
                      style={[
                        styles.intervalOptionText,
                        intervalMinutes === opt.value && styles.intervalOptionActiveText,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </View>
                  {intervalMinutes === opt.value && (
                    <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── Sync Now Card ── */}
        <Pressable
          onPress={handleSyncNow}
          disabled={isSyncingNow || !enabled}
          style={({ pressed }) => [
            styles.syncNowCard,
            {
              opacity: !enabled ? 0.5 : isSyncingNow ? 0.7 : pressed ? 0.9 : 1,
            },
          ]}
        >
          <View style={styles.syncNowRow}>
            <RNAnimated.View
              style={[
                styles.syncNowIcon,
                isSyncingNow && { transform: [{ rotate: spinInterpolation }] },
              ]}
            >
              <Ionicons
                name={isSyncingNow ? 'sync' : 'refresh'}
                size={20}
                color={isSyncingNow ? '#60A5FA' : '#0D0D0D'}
              />
            </RNAnimated.View>
            <View style={{ flex: 1 }}>
              <Text style={styles.syncNowLabel}>
                {isSyncingNow ? 'Syncing...' : 'Sync Now'}
              </Text>
              <Text style={styles.syncNowDesc}>
                {isSyncingNow
                  ? 'Refreshing portfolio, watchlist & orders'
                  : 'Manually trigger a full data refresh'}
              </Text>
            </View>
            {isSyncingNow && (
              <ActivityIndicator size="small" color="#60A5FA" />
            )}
          </View>
        </Pressable>

        {/* ── What Gets Synced ── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📦 What Gets Synced</Text>
          <View style={styles.infoItem}>
            <Ionicons name="pie-chart" size={14} color="#22C55E" />
            <Text style={styles.infoText}>Portfolio holdings & trades</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="heart" size={14} color="#FF6B6B" />
            <Text style={styles.infoText}>Watchlist stocks</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="document-text" size={14} color="#FFC107" />
            <Text style={styles.infoText}>Open orders status</Text>
          </View>
        </View>

        {/* ── Battery Note ── */}
        <View style={styles.noteCard}>
          <Ionicons name="battery-charging" size={16} color="#FFAB40" />
          <Text style={styles.noteText}>
            Background sync uses minimal battery. iOS may delay background tasks
            based on usage patterns. Shorter intervals increase data freshness
            with negligible battery impact.
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ──── Styles ──────────────────────────────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.md,
      backgroundColor: colors.bgSecondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.lg,
      color: colors.text,
    },
    scrollContent: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.lg,
    },

    // ── Hero Card ──
    heroCard: {
      alignItems: 'center',
      paddingVertical: SPACING.xl,
      marginBottom: SPACING.lg,
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: BORDER_RADIUS.xl,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
    },
    heroIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    heroTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.lg,
      color: colors.text,
      marginBottom: 4,
    },
    heroSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    lastSyncRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    lastSyncText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.4)',
    },

    // ── Settings Card ──
    settingsCard: {
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      marginBottom: SPACING.md,
      overflow: 'hidden',
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SPACING.lg,
    },
    settingInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      flex: 1,
    },
    settingIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingLabel: {
      ...FONTS.medium,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    settingDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 2,
    },

    // ── Interval Picker ──
    intervalPicker: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.06)',
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.sm,
    },
    intervalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.sm + 2,
    },
    intervalOptionBorder: {
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.04)',
    },
    intervalOptionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    intervalOptionText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.6)',
    },
    intervalOptionActiveText: {
      ...FONTS.semiBold,
      color: '#3B82F6',
    },

    // ── Sync Now Card ──
    syncNowCard: {
      backgroundColor: '#22C55E',
      borderRadius: BORDER_RADIUS.lg,
      marginBottom: SPACING.lg,
    },
    syncNowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      padding: SPACING.lg,
    },
    syncNowIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    syncNowLabel: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
      color: '#0D0D0D',
    },
    syncNowDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(0,0,0,0.6)',
      marginTop: 2,
    },

    // ── Info Card ──
    infoCard: {
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    infoTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.text,
      marginBottom: SPACING.md,
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: SPACING.sm,
    },
    infoText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.7)',
    },

    // ── Note Card ──
    noteCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      backgroundColor: 'rgba(255, 171, 64, 0.06)',
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: 'rgba(255, 171, 64, 0.15)',
      padding: SPACING.md,
    },
    noteText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: '#FFAB40',
      flex: 1,
      lineHeight: 16,
    },
  });
