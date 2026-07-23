/**
 * ============================================================================
 * Toroloom — Base Widget Container
 * ============================================================================
 *
 * Reusable card container for all dashboard widgets. Provides:
 *  - Card with theme-aware styling
 *  - Header with widget title, icon, and actions menu
 *  - Size quick-toggle (small/medium/large)
 *  - Remove / Hide actions
 *  - Long-press drag handle for reordering
 *
 * ============================================================================
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useWidgetStore } from '../../store/widgetStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { getWidgetMeta } from './WidgetRegistry';
import type { WidgetType, WidgetSize } from '../../types/widgets';
import type { SubscriptionTier } from '../../types';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants/theme';

// ──── Tier ranking for gating comparisons ────────────────────────────────
const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, elite: 2 };

function isWidgetAccessible(userTier: SubscriptionTier, minTier: SubscriptionTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[minTier];
}

// ──── Props ────────────────────────────────────────────────────────────────

interface BaseWidgetProps {
  widgetId: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  children: React.ReactNode;
  onLongPress?: () => void;
}

// ──── Size Options ────────────────────────────────────────────────────────

const SIZE_OPTIONS: { key: WidgetSize; icon: string; label: string }[] = [
  { key: 'small',  icon: 'remove',         label: 'Small' },
  { key: 'medium', icon: 'square-outline', label: 'Medium' },
  { key: 'large',  icon: 'expand',         label: 'Large' },
];

// ──── Component ────────────────────────────────────────────────────────────

export default function BaseWidget({
  widgetId, type, title, size, children, onLongPress,
}: BaseWidgetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [menuVisible, setMenuVisible] = useState(false);

  const meta = getWidgetMeta(type);
  const userTier = useSubscriptionStore(s => s.subscription.tier);
  const isGated = !isWidgetAccessible(userTier, meta.minTier);
  const removeWidget = useWidgetStore(s => s.removeWidget);
  const resizeWidget = useWidgetStore(s => s.resizeWidget);
  const toggleVisibility = useWidgetStore(s => s.toggleWidgetVisibility);

  const availableSizes = meta.sizes;

  const handleRemove = useCallback(() => {
    setMenuVisible(false);
    Alert.alert(
      'Remove Widget',
      `Remove "${title}" from the dashboard?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeWidget(widgetId) },
      ],
    );
  }, [widgetId, title, removeWidget]);

  const handleCloseMenu = useCallback(() => setMenuVisible(false), []);

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      layout={Layout.springify().damping(20).stiffness(200)}
      style={[
        styles.container,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={300}
          style={styles.headerLeft}
        >
          <View style={[styles.iconWrap, { backgroundColor: meta.color + '20' }]}>
            <Ionicons name={meta.icon as any} size={14} color={meta.color} />
          </View>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        </Pressable>

        {/* Actions Menu Button */}
        <Pressable
          style={[styles.menuBtn, { backgroundColor: colors.bgInput }]}
          onPress={() => setMenuVisible(true)}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-vertical" size={14} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Widget Content */}
      <View style={styles.content}>
        {children}
        {isGated && (
          <View style={styles.lockedOverlay}>
            <View style={[styles.lockedBackdrop, { backgroundColor: colors.bgCard + 'CC' }]}>
              <View style={[styles.lockedIconWrap, { backgroundColor: colors.textMuted + '20' }]}>
                <Ionicons name="lock-closed" size={20} color={colors.textMuted} />
              </View>
              <Text style={[styles.lockedLabel, { color: colors.textSecondary }]}>
                {meta.minTier === 'elite' ? 'Elite plan' : 'Pro plan'} required
              </Text>
              <Text style={[styles.lockedDesc, { color: colors.textMuted }]}>
                Upgrade to unlock this widget
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Size indicator dots (hidden when gated) */}
      {!isGated && (
      <View style={styles.sizeDots}>
        {availableSizes.map(s => (
          <View
            key={s}
            style={[
              styles.sizeDot,
              {
                backgroundColor: s === size ? meta.color : colors.border,
                width: s === size ? 8 : 6,
                height: s === size ? 8 : 6,
                borderRadius: s === size ? 4 : 3,
              },
            ]}
          />
        ))}
      </View>)}

      {/* ── Action Menu Modal ── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMenu}
      >
        <Pressable style={styles.menuOverlay} onPress={handleCloseMenu}>
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[styles.menuCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          >
            <Text style={[styles.menuTitle, { color: colors.text }]}>{title}</Text>

            {/* Size options */}
            <Text style={[styles.menuSection, { color: colors.textMuted }]}>Size</Text>
            <View style={styles.sizeRow}>
              {availableSizes.map(s => {
                const isActive = s === size;
                return (
                  <Pressable
                    key={s}
                    style={[
                      styles.sizeOption,
                      {
                        borderColor: isActive ? meta.color : colors.border,
                        backgroundColor: isActive ? meta.color + '15' : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      resizeWidget(widgetId, s);
                      handleCloseMenu();
                    }}
                  >
                    <Ionicons
                      name={SIZE_OPTIONS.find(o => o.key === s)?.icon as any}
                      size={16}
                      color={isActive ? meta.color : colors.textSecondary}
                    />
                    <Text style={[
                      styles.sizeLabel,
                      { color: isActive ? meta.color : colors.textSecondary },
                    ]}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Actions */}
            <Text style={[styles.menuSection, { color: colors.textMuted }]}>Actions</Text>
            <Pressable
              style={[styles.actionRow, { borderBottomColor: colors.divider }]}
              onPress={() => { toggleVisibility(widgetId); handleCloseMenu(); }}
            >
              <Ionicons name="eye-off" size={18} color={colors.textSecondary} />
              <Text style={[styles.actionText, { color: colors.text }]}>Hide Widget</Text>
            </Pressable>
            <Pressable style={styles.actionRow} onPress={handleRemove}>
              <Ionicons name="trash" size={18} color="#FF5252" />
              <Text style={[styles.actionText, { color: '#FF5252' }]}>Remove Widget</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 140,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    flex: 1,
  },
  menuBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    minHeight: 80,
    position: 'relative',
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedBackdrop: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: SPACING.md,
    width: '100%',
    height: '100%',
  },
  lockedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  lockedLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  lockedDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  sizeDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: 6,
  },
  sizeDot: {
    borderRadius: 3,
  },

  // ── Menu Modal ──
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  menuCard: {
    width: '85%',
    maxWidth: 320,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  menuTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    marginBottom: SPACING.xs,
  },
  menuSection: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  sizeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  sizeLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  actionText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
});
