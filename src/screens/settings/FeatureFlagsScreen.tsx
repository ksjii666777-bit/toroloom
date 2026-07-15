/**
 * ============================================================================
 * Toroloom — Feature Flags Screen
 * ============================================================================
 *
 * Development / admin screen for managing feature flags and A/B experiments.
 *
 * Features:
 *   - All feature flags listed by category with toggle switches
 *   - Rollout percentage badges for gradual-rollout flags
 *   - Override state indicator (green dot / "Default" label)
 *   - A/B experiments section with variant assignment display
 *   - "Reset All Overrides" button with confirmation
 *   - Count of active flags in header
 *   - Pull-to-refresh to reset view
 * ============================================================================
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Alert,
  RefreshControl,
  Animated as RNAnimated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeatureFlagStore } from '../../store/featureFlagStore';
import {
  FeatureFlagKey,
  FeatureFlagMeta,
  ExperimentId,
  ExperimentVariant,
  ExperimentAssignment,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_EXPERIMENTS,
} from '../../types/featureFlags';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

// ──── Category Config ──────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  ui: { icon: 'grid', label: 'UI & Layout' },
  trading: { icon: 'trending-up', label: 'Trading' },
  ai: { icon: 'bulb', label: 'AI & Insights' },
  social: { icon: 'people', label: 'Social' },
  onboarding: { icon: 'rocket', label: 'Onboarding' },
  experimental: { icon: 'flask', label: 'Experimental' },
};

const CATEGORY_ORDER = ['ui', 'trading', 'ai', 'social', 'onboarding', 'experimental'];

// ──── Experiment Labels ────────────────────────────────────────────────────

const EXPERIMENT_LABELS: Record<ExperimentVariant, string> = {
  control: 'Control',
  variant_a: 'Variant A',
  variant_b: 'Variant B',
  variant_c: 'Variant C',
};

const EXPERIMENT_COLORS: Record<ExperimentVariant, string> = {
  control: '#64748B',
  variant_a: '#3B82F6',
  variant_b: '#22C55E',
  variant_c: '#8B5CF6',
};

// ──── Component ────────────────────────────────────────────────────────────

export default function FeatureFlagsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const overrideFlag = useFeatureFlagStore((s) => s.overrideFlag);
  const overrideExperiment = useFeatureFlagStore((s) => s.overrideExperiment);
  const resetOverrides = useFeatureFlagStore((s) => s.resetOverrides);
  const getAllFlags = useFeatureFlagStore((s) => s.getAllFlags);
  const getAllExperiments = useFeatureFlagStore((s) => s.getAllExperiments);
  const hydrated = useFeatureFlagStore((s) => s.hydrated);

  // Subscribe to reactive state so component re-renders when toggles change
  const overrides = useFeatureFlagStore((s) => s.overrides);
  const experimentAssignments = useFeatureFlagStore((s) => s.experimentAssignments);

  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Derived Data ──
  const flagsData = useMemo(() => {
    if (!hydrated) return { grouped: new Map<string, Array<{ key: FeatureFlagKey; meta: FeatureFlagMeta; enabled: boolean; overridden: boolean }>>(), overriddenCount: 0, activeCount: 0, totalCount: 0 };
    const allFlags = getAllFlags();
    const grouped = new Map<string, typeof allFlags>();
    let overriddenCount = 0;
    let activeCount = 0;

    for (const flag of allFlags) {
      const cat = flag.meta.category;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(flag);
      if (flag.overridden) overriddenCount++;
      if (flag.enabled) activeCount++;
    }

    return { grouped, overriddenCount, activeCount, totalCount: allFlags.length };
  }, [hydrated, overrides, getAllFlags]);

  const experimentsData = useMemo(() => {
    if (!hydrated) return [];
    return getAllExperiments();
  }, [hydrated, experimentAssignments, getAllExperiments]);

  // ── Handlers ──

  const handleToggleFlag = useCallback(
    async (key: FeatureFlagKey, currentEnabled: boolean) => {
      setTogglingId(key);
      // Simulate brief loading for visual feedback
      await new Promise((r) => setTimeout(r, 200));
      await overrideFlag(key, !currentEnabled);
      setTogglingId(null);
    },
    [overrideFlag],
  );

  const handleToggleExperiment = useCallback(
    async (experimentId: ExperimentId, currentVariant: ExperimentVariant) => {
      // Cycle through variants: control → variant_a → variant_b → variant_c → control
      const cycle: ExperimentVariant[] = ['control', 'variant_a', 'variant_b', 'variant_c'];
      const idx = cycle.indexOf(currentVariant);
      const next = cycle[(idx + 1) % cycle.length];
      await overrideExperiment(experimentId, next);
    },
    [overrideExperiment],
  );

  const handleResetOverrides = useCallback(() => {
    Alert.alert(
      'Reset All Overrides',
      'This will clear all flag and experiment overrides and revert to default behaviour.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => resetOverrides(),
        },
      ],
    );
  }, [resetOverrides]);

  const handleActivateExperiment = useCallback(
    (experimentId: ExperimentId) => {
      Alert.alert(
        'Override Experiment',
        `Override "${DEFAULT_EXPERIMENTS[experimentId]?.name || experimentId}" variant?\nTap again to cycle: Control → Variant A → Variant B → Variant C`,
        [{ text: 'OK' }],
      );
    },
    [],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Re-read from store
    await new Promise((r) => setTimeout(r, 500));
    setRefreshing(false);
  }, []);

  // ── Loading State ──
  if (!hydrated) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.loadingPulse}>
          <Ionicons name="flask" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Initializing feature flags...
        </Text>
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
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Feature Flags</Text>
          <Text style={styles.headerSubtitle}>
            {flagsData.activeCount} active · {flagsData.overriddenCount} overridden
          </Text>
        </View>
        <Pressable
          onPress={handleResetOverrides}
          style={({ pressed }) => [
            styles.resetBtn,
            { opacity: flagsData.overriddenCount > 0 ? (pressed ? 0.7 : 1) : 0.3 },
          ]}
          disabled={flagsData.overriddenCount === 0}
        >
          <Ionicons name="refresh-outline" size={14} color="#EF4444" />
          <Text style={styles.resetBtnText}>Reset</Text>
        </Pressable>
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
        {/* ── Info Banner ── */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={16} color="#3B82F6" />
          <Text style={styles.infoBannerText}>
            Feature flags let you gradually roll out features. Overrides apply only on this device.
          </Text>
        </View>

        {/* ── Feature Flags by Category ── */}
        {CATEGORY_ORDER.map((cat) => {
          const flags = flagsData.grouped.get(cat);
          if (!flags || flags.length === 0) return null;
          const catConfig = CATEGORY_CONFIG[cat];

          return (
            <View key={cat} style={styles.categorySection}>
              {/* Category Header */}
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryIconContainer, { backgroundColor: getCategoryColor(cat, 0.1) }]}>
                  <Ionicons
                    name={catConfig?.icon || 'flask'}
                    size={14}
                    color={getCategoryColor(cat, 1)}
                  />
                </View>
                <Text style={styles.categoryLabel}>{catConfig?.label || cat}</Text>
                <View style={styles.categoryCount}>
                  <Text style={styles.categoryCountText}>
                    {flags.filter((f) => f.enabled).length}/{flags.length}
                  </Text>
                </View>
              </View>

              {/* Flag Items */}
              <View style={styles.flagsContainer}>
                {flags.map((flag, idx) => (
                  <View
                    key={flag.key}
                    style={[
                      styles.flagItem,
                      idx < flags.length - 1 && styles.flagItemBorder,
                    ]}
                  >
                    <View style={styles.flagInfo}>
                      <View style={styles.flagHeader}>
                        <Text style={styles.flagLabel}>{flag.meta.label}</Text>
                        {flag.overridden && (
                          <View style={styles.overriddenBadge}>
                            <Ionicons name="pencil" size={8} color="#FFAB40" />
                            <Text style={styles.overriddenText}>Override</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.flagDesc}>{flag.meta.description}</Text>
                      <View style={styles.flagMeta}>
                        {flag.meta.rolloutPercent !== undefined && !flag.overridden && (
                          <View style={styles.rolloutBadge}>
                            <Ionicons name="people" size={9} color="#3B82F6" />
                            <Text style={styles.rolloutText}>
                              {flag.meta.rolloutPercent}% rollout
                            </Text>
                          </View>
                        )}
                        {flag.meta.requiresBackend && (
                          <View style={styles.backendBadge}>
                            <Ionicons name="server" size={9} color="#8B5CF6" />
                            <Text style={styles.backendBadgeText}>Backend</Text>
                          </View>
                        )}
                        {!flag.overridden && (
                          <Text style={styles.defaultLabel}>
                            Default: {flag.meta.defaultValue ? 'ON' : 'OFF'}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.flagToggle}>
                      <Switch
                        value={flag.enabled}
                        onValueChange={() => handleToggleFlag(flag.key, flag.enabled)}
                        trackColor={{
                          false: 'rgba(255,255,255,0.12)',
                          true: flag.meta.category === 'experimental'
                            ? 'rgba(139, 92, 246, 0.4)'
                            : 'rgba(34, 197, 94, 0.4)',
                        }}
                        thumbColor={
                          flag.enabled
                            ? flag.meta.category === 'experimental'
                              ? '#8B5CF6'
                              : '#22C55E'
                            : 'rgba(255,255,255,0.5)'
                        }
                        disabled={togglingId === flag.key}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        {/* ── A/B Experiments Section ── */}
        {experimentsData.length > 0 && (
          <View style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <View style={[styles.categoryIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                <Ionicons name="flask" size={14} color="#8B5CF6" />
              </View>
              <Text style={styles.categoryLabel}>A/B Experiments</Text>
              <View style={styles.categoryCount}>
                <Text style={styles.categoryCountText}>
                  {experimentsData.filter((e) => e.isEnrolled).length}/{experimentsData.length} active
                </Text>
              </View>
            </View>

            <View style={styles.flagsContainer}>
              {experimentsData.map((exp, idx) => (
                <Pressable
                  key={exp.config.id}
                  onPress={() => handleToggleExperiment(exp.config.id as ExperimentId, exp.assignedVariant)}
                  style={({ pressed }) => [
                    styles.experimentItem,
                    idx < experimentsData.length - 1 && styles.flagItemBorder,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View style={styles.flagInfo}>
                    <Text style={styles.flagLabel}>{exp.config.name}</Text>
                    <Text style={styles.flagDesc}>{exp.config.description}</Text>
                    <View style={styles.flagMeta}>
                      <View
                        style={[
                          styles.variantBadge,
                          { backgroundColor: EXPERIMENT_COLORS[exp.assignedVariant] + '20' },
                        ]}
                      >
                        <View
                          style={[
                            styles.variantDot,
                            { backgroundColor: EXPERIMENT_COLORS[exp.assignedVariant] },
                          ]}
                        />
                        <Text
                          style={[
                            styles.variantText,
                            { color: EXPERIMENT_COLORS[exp.assignedVariant] },
                          ]}
                        >
                          {EXPERIMENT_LABELS[exp.assignedVariant]}
                        </Text>
                      </View>
                      {exp.config.targetSegment && (
                        <Text style={styles.defaultLabel}>
                          {exp.config.targetSegment.replace('_', ' ')}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.experimentRight}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: exp.config.isActive ? '#22C55E' : 'rgba(255,255,255,0.2)',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusLabel,
                        {
                          color: exp.config.isActive ? '#22C55E' : 'rgba(255,255,255,0.3)',
                        },
                      ]}
                    >
                      {exp.config.isActive ? 'Live' : 'Paused'}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color="rgba(255,255,255,0.2)"
                    />
                  </View>
                </Pressable>
              ))}
            </View>

            {/* Experiment Footnote */}
            <Text style={styles.footnote}>
              Tap an experiment to cycle its variant. Enrolment is deterministic per user ID.
            </Text>
          </View>
        )}

        {/* ── Flag Count Summary ── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Flags</Text>
            <Text style={styles.summaryValue}>{flagsData.totalCount}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Enabled</Text>
            <Text style={[styles.summaryValue, { color: '#22C55E' }]}>{flagsData.activeCount}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Disabled</Text>
            <Text style={[styles.summaryValue, { color: 'rgba(255,255,255,0.5)' }]}>
              {flagsData.totalCount - flagsData.activeCount}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Overridden</Text>
            <Text style={[styles.summaryValue, { color: '#FFAB40' }]}>
              {flagsData.overriddenCount}
            </Text>
          </View>
        </View>

        {/* ── Add New Flag Note ── */}
        <View style={styles.noteCard}>
          <Ionicons name="code-slash" size={16} color="#3B82F6" />
          <Text style={styles.noteText}>
            To add a new flag, update{' '}
            <Text style={{ fontFamily: 'monospace' }}>src/types/featureFlags.ts</Text> and add the
            key to the{' '}
            <Text style={{ fontFamily: 'monospace' }}>FeatureFlagKey</Text> type and{' '}
            <Text style={{ fontFamily: 'monospace' }}>DEFAULT_FEATURE_FLAGS</Text> object.
          </Text>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ──── Helper ───────────────────────────────────────────────────────────────

function getCategoryColor(category: string, alpha: number): string {
  const colorMap: Record<string, string> = {
    ui: '#3B82F6',
    trading: '#22C55E',
    ai: '#8B5CF6',
    social: '#F97316',
    onboarding: '#06B6D4',
    experimental: '#8B5CF6',
  };
  const hex = colorMap[category] || '#64748B';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
      marginRight: SPACING.sm,
    },
    headerTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.lg,
      color: colors.text,
    },
    headerSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    resetBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.xs,
      color: '#EF4444',
    },
    scrollContent: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.lg,
    },

    // ── Loading ──
    loadingPulse: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    loadingText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
    },

    // ── Info Banner ──
    infoBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      backgroundColor: 'rgba(59, 130, 246, 0.06)',
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: 'rgba(59, 130, 246, 0.15)',
      padding: SPACING.md,
      marginBottom: SPACING.lg,
    },
    infoBannerText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: '#60A5FA',
      flex: 1,
      lineHeight: 16,
    },

    // ── Category ──
    categorySection: {
      marginBottom: SPACING.lg,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    categoryIconContainer: {
      width: 26,
      height: 26,
      borderRadius: 7,
      justifyContent: 'center',
      alignItems: 'center',
    },
    categoryLabel: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.text,
      flex: 1,
    },
    categoryCount: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.full,
    },
    categoryCountText: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.5)',
    },

    // ── Flag Items Container ──
    flagsContainer: {
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      overflow: 'hidden',
    },
    flagItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
    },
    flagItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.04)',
    },

    // ── Flag Info ──
    flagInfo: {
      flex: 1,
      marginRight: SPACING.md,
    },
    flagHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    flagLabel: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      color: colors.text,
    },
    overriddenBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(255, 171, 64, 0.1)',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: BORDER_RADIUS.xs,
    },
    overriddenText: {
      ...FONTS.semiBold,
      fontSize: 8,
      color: '#FFAB40',
      letterSpacing: 0.5,
    },
    flagDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.5)',
      lineHeight: 14,
    },
    flagMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
      flexWrap: 'wrap',
    },
    rolloutBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(59, 130, 246, 0.08)',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: BORDER_RADIUS.xs,
    },
    rolloutText: {
      ...FONTS.regular,
      fontSize: 8,
      color: '#3B82F6',
    },
    backendBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(139, 92, 246, 0.08)',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: BORDER_RADIUS.xs,
    },
    backendBadgeText: {
      ...FONTS.regular,
      fontSize: 8,
      color: '#8B5CF6',
    },
    defaultLabel: {
      ...FONTS.regular,
      fontSize: 8,
      color: 'rgba(255,255,255,0.3)',
    },

    // ── Flag Toggle ──
    flagToggle: {
      marginLeft: 'auto',
    },

    // ── Experiment Items ──
    experimentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
    },
    experimentRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusLabel: {
      ...FONTS.semiBold,
      fontSize: 9,
      marginRight: 2,
    },
    variantBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.xs,
    },
    variantDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    variantText: {
      ...FONTS.semiBold,
      fontSize: 8,
    },
    footnote: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.3)',
      marginTop: SPACING.sm,
      paddingHorizontal: SPACING.xs,
      lineHeight: 14,
    },

    // ── Summary Card ──
    summaryCard: {
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    summaryDivider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.04)',
      marginVertical: 2,
    },
    summaryLabel: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.6)',
    },
    summaryValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
      color: colors.text,
    },

    // ── Note ──
    noteCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      backgroundColor: 'rgba(59, 130, 246, 0.04)',
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: 'rgba(59, 130, 246, 0.1)',
      padding: SPACING.md,
    },
    noteText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.4)',
      flex: 1,
      lineHeight: 16,
    },
  });
