/**
 * ============================================================================
 * Toroloom — Widget Gallery Screen
 * ============================================================================
 *
 * Browse available dashboard widgets by category. Tap to add a widget
 * to the analytics dashboard. Shows preview, description, and size options.
 *
 * ============================================================================
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useWidgetStore } from '../../store/widgetStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { WIDGET_REGISTRY, getWidgetsByCategory } from '../../components/widgets/WidgetRegistry';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants/theme';
import type { WidgetType, WidgetMeta, WidgetSize } from '../../types/widgets';
import type { SubscriptionTier } from '../../types';

// ──── Tier ranking for gating comparisons ────────────────────────────────
const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, elite: 2 };

function isWidgetAccessible(userTier: SubscriptionTier, minTier: SubscriptionTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[minTier];
}

function getUpgradeLabel(minTier: SubscriptionTier): string {
  return minTier === 'elite' ? 'Elite' : 'Pro';
}

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  performance: { label: 'Performance', icon: 'trending-up' },
  holdings:    { label: 'Holdings',    icon: 'pie-chart' },
  risk:        { label: 'Risk',        icon: 'shield' },
  market:      { label: 'Market',      icon: 'stats-chart' },
};

export default function WidgetGalleryScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { addWidget, layout } = useWidgetStore();
  const userTier = useSubscriptionStore(s => s.subscription.tier);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, WidgetSize>>({});

  const grouped = getWidgetsByCategory();
  const existingTypes = new Set(layout.widgets.map(w => w.type));

  const handleAddWidget = (type: WidgetType, meta: WidgetMeta) => {
    const size = selectedSizes[type] || meta.defaultSize;
    addWidget(type, meta.name, size);
    Alert.alert(
      '✅ Widget Added',
      `"${meta.name}" has been added to your dashboard.`,
    );
  };

  const handleSizeSelect = (type: WidgetType, size: WidgetSize) => {
    setSelectedSizes(prev => ({ ...prev, [type]: size }));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={[styles.title, { color: colors.text }]}>Widget Gallery</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Add widgets to customize your dashboard
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
      >
        {Object.entries(grouped).map(([category, metas]) => {
          const catMeta = CATEGORY_META[category] || { label: category, icon: 'grid' };
          const addedCount = metas.filter(m => existingTypes.has(m.type)).length;

          return (
            <Animated.View
              key={category}
              entering={FadeInDown.duration(300).delay(100)}
              layout={Layout.springify()}
              style={styles.categorySection}
            >
              {/* Category Header */}
              <View style={styles.categoryHeader}>
                <View style={styles.categoryLeft}>
                  <Ionicons name={catMeta.icon as any} size={16} color={colors.primary} />
                  <Text style={[styles.categoryTitle, { color: colors.text }]}>{catMeta.label}</Text>
                </View>
                <Text style={[styles.categoryCount, { color: colors.textMuted }]}>
                  {addedCount}/{metas.length} added
                </Text>
              </View>

              {/* Widget Cards */}
              <View style={styles.widgetGrid}>
                {metas.map(meta => {
                  const isAdded = existingTypes.has(meta.type);
                  const isGated = !isWidgetAccessible(userTier, meta.minTier);
                  const selectedSize = selectedSizes[meta.type] || meta.defaultSize;
                  const upgradeTo = getUpgradeLabel(meta.minTier);

                  return (
                    <Animated.View
                      key={meta.type}
                      entering={FadeInDown.duration(250)}
                      style={[
                        styles.widgetCard,
                        {
                          backgroundColor: colors.bgCard,
                          borderColor: isAdded ? meta.color + '50' : isGated ? colors.textMuted + '30' : colors.border,
                          opacity: isAdded ? 0.7 : isGated ? 0.85 : 1,
                        },
                      ]}
                    >
                      {/* Widget Icon & Info */}
                      <View style={[styles.widgetIconWrap, { backgroundColor: meta.color + '20' }]}>
                        <Ionicons name={meta.icon as any} size={24} color={isGated ? colors.textMuted : meta.color} />
                      </View>
                      <Text style={[styles.widgetName, { color: isGated ? colors.textMuted : colors.text }]}>
                        {meta.name}
                      </Text>
                      <Text style={[styles.widgetDesc, { color: isGated ? colors.textMuted : colors.textMuted }]} numberOfLines={2}>
                        {meta.description}
                      </Text>

                      {/* Size Selector (hidden when gated) */}
                      {!isAdded && !isGated && (
                        <View style={styles.sizeSelector}>
                          {meta.sizes.map(s => (
                            <Pressable
                              key={s}
                              style={[
                                styles.sizeChip,
                                {
                                  borderColor: selectedSize === s ? meta.color : colors.border,
                                  backgroundColor: selectedSize === s ? meta.color + '15' : 'transparent',
                                },
                              ]}
                              onPress={() => handleSizeSelect(meta.type, s)}
                            >
                              <Ionicons
                                name={s === 'small' ? 'remove' : s === 'medium' ? 'square-outline' : 'expand'}
                                size={12}
                                color={selectedSize === s ? meta.color : colors.textMuted}
                              />
                              <Text style={[
                                styles.sizeChipText,
                                { color: selectedSize === s ? meta.color : colors.textMuted },
                              ]}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}

                      {/* Add Button — gated version shows upgrade CTA */}
                      {isGated ? (
                        <View style={styles.gatedOverlay}>
                          <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
                          <Text style={[styles.gatedText, { color: colors.textMuted }]}>
                            {upgradeTo === 'Elite' ? 'Elite plan' : 'Pro plan'} required
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.addBtn,
                            {
                              backgroundColor: isAdded ? colors.bgInput : meta.color,
                              opacity: isAdded ? 0.5 : 1,
                            },
                          ]}
                          disabled={isAdded}
                          onPress={() => handleAddWidget(meta.type, meta)}
                        >
                          <Ionicons
                            name={isAdded ? 'checkmark' : 'add'}
                            size={18}
                            color={isAdded ? colors.textMuted : '#FFF'}
                          />
                          <Text style={[
                            styles.addBtnText,
                            { color: isAdded ? colors.textMuted : '#FFF' },
                          ]}>
                            {isAdded ? 'Added' : 'Add to Dashboard'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Subscription Badge */}
                      {meta.isPro && (
                        <View style={[
                          styles.proBadge,
                          {
                            backgroundColor: isGated ? colors.textMuted + '20' : '#FFC10730',
                          },
                        ]}>
                          <Ionicons
                            name={isGated ? 'lock-closed' : 'crown' as any}
                            size={10}
                            color={isGated ? colors.textMuted : '#FFC107'}
                          />
                          <Text style={[
                            styles.proBadgeText,
                            { color: isGated ? colors.textMuted : '#FFC107' },
                          ]}>
                            {upgradeTo}
                          </Text>
                        </View>
                      )}
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>
          );
        })}

        {/* Tips */}
        <View style={[styles.tipCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={18} color={colors.primary} />
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>
            Long-press any widget on the dashboard to reorder. Tap the ⋮ menu to resize or remove widgets.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  title: { ...FONTS.bold, fontSize: FONTS.size.title },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 2 },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 40 },
  categorySection: { marginBottom: SPACING.xl },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  categoryTitle: { ...FONTS.bold, fontSize: FONTS.size.md },
  categoryCount: { ...FONTS.regular, fontSize: FONTS.size.xs },
  widgetGrid: { gap: SPACING.md },
  widgetCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.sm,
    position: 'relative',
  },
  widgetIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  widgetName: { ...FONTS.semiBold, fontSize: FONTS.size.lg },
  widgetDesc: { ...FONTS.regular, fontSize: FONTS.size.sm, lineHeight: 18 },
  sizeSelector: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  sizeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  sizeChipText: { ...FONTS.medium, fontSize: FONTS.size.xs },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xs,
  },
  addBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  proBadge: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  proBadgeText: { ...FONTS.bold, fontSize: 9, color: '#FFC107' },
  gatedOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
    marginTop: SPACING.xs,
  },
  gatedText: { ...FONTS.medium, fontSize: FONTS.size.xs, fontStyle: 'italic' },
  tipCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  tipText: { ...FONTS.regular, fontSize: FONTS.size.sm, flex: 1, lineHeight: 18 },
});
