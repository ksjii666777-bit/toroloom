/**
 * ============================================================================
 * Toroloom — Custom Indicator Manager Screen
 * ============================================================================
 *
 * Lists all user-created custom indicators with toggle switches, edit/delete
 * buttons, and a quick-add "New" button that goes to the editor.
 * ============================================================================
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import {
  useCustomIndicatorStore,
  PRESET_INDICATORS,
  type CustomIndicator,
} from '../../store/customIndicatorStore';
import { useNavigation } from '@react-navigation/native';
import { validateFormula } from '../../utils/indicatorFormulaEngine';

// ============================================================================
// Indicator Card
// ============================================================================

function IndicatorCard({
  indicator,
  onToggle,
  onEdit,
  onDelete,
  colors,
}: {
  indicator: CustomIndicator;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  colors: any;
}) {
  return (
    <View style={[cardStyles.card, {
      backgroundColor: colors.bgCard,
      borderColor: colors.border,
      opacity: indicator.active ? 1 : 0.6,
    }]}>
      <View style={cardStyles.header}>
        {/* Color dot */}
        <View style={[cardStyles.colorDot, { backgroundColor: indicator.color }]} />

        {/* Label + formula */}
        <View style={cardStyles.info}>
          <Text style={[cardStyles.label, { color: colors.text }]}>{indicator.label}</Text>
          <Text style={[cardStyles.formula, { color: colors.textMuted }]} numberOfLines={1}>
            {indicator.formula}
          </Text>
        </View>

        {/* Panel badge */}
        <View style={[cardStyles.badge, {
          backgroundColor: indicator.panel === 'overlay'
            ? colors.primary + '20'
            : '#4ECDC4' + '20',
        }]}>
          <Text style={[cardStyles.badgeText, {
            color: indicator.panel === 'overlay' ? colors.primary : '#4ECDC4',
          }]}>
            {indicator.panel === 'overlay' ? 'Overlay' : 'Separate'}
          </Text>
        </View>

        {/* Toggle */}
        <Switch
          value={indicator.active}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary + '60' }}
          thumbColor={indicator.active ? colors.primary : colors.textMuted}
        />
      </View>

      {/* Actions row */}
      <View style={cardStyles.actions}>
        <Pressable style={[cardStyles.actionBtn, { borderColor: colors.border }]} onPress={onEdit}>
          <Ionicons name="pencil-outline" size={14} color={colors.primary} />
          <Text style={[cardStyles.actionText, { color: colors.primary }]}>Edit</Text>
        </Pressable>
        <Pressable
          style={[cardStyles.actionBtn, { borderColor: '#FF6B6B' + '40' }]}
          onPress={onDelete}
        >
          <Ionicons name="trash-outline" size={14} color="#FF6B6B" />
          <Text style={[cardStyles.actionText, { color: '#FF6B6B' }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  info: {
    flex: 1,
  },
  label: {
    fontFamily: 'System',
    fontSize: FONTS.size.sm,
    fontWeight: '700',
  },
  formula: {
    fontFamily: 'monospace',
    fontSize: FONTS.size.xs,
    fontWeight: '400',
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  badgeText: {
    fontFamily: 'System',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  actionText: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '600',
  },
});

// ============================================================================
// Preset Quick-Add Section
// ============================================================================

function PresetQuickAdd({ colors }: { colors: any }) {
  const navigation = useNavigation<any>();
  const importPreset = useCustomIndicatorStore((s) => s.importPreset);

  const handleAdd = useCallback(
    (preset: (typeof PRESET_INDICATORS)[0]) => {
      const id = importPreset(preset.label, preset.formula, preset.color);
      if (id) {
        navigation.navigate('CustomIndicatorEditor', {
          indicator: {
            id,
            label: preset.label,
            formula: preset.formula,
            color: preset.color,
            panel: preset.formula.startsWith('RSI') || preset.formula.startsWith('MACD')
              ? 'separate' : 'overlay',
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      }
    },
    [importPreset, navigation],
  );

  return (
    <View style={presetSectionStyles.container}>
      <Text style={[presetSectionStyles.title, { color: colors.text }]}>Quick-Add Presets</Text>
      <View style={presetSectionStyles.grid}>
        {PRESET_INDICATORS.slice(0, 8).map((preset) => (
          <Pressable
            key={preset.label}
            style={[presetSectionStyles.item, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
            onPress={() => handleAdd(preset)}
          >
            <View style={[presetSectionStyles.dot, { backgroundColor: preset.color }]} />
            <Text style={[presetSectionStyles.itemLabel, { color: colors.text }]}>{preset.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const presetSectionStyles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontFamily: 'System',
    fontSize: FONTS.size.sm,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemLabel: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '600',
  },
});

// ============================================================================
// Main Screen
// ============================================================================

export default function CustomIndicatorManagerScreen() {
  const { colors } = useTheme();
  const t = useT();
  const navigation = useNavigation<any>();
  const indicators = useCustomIndicatorStore((s) => s.indicators);
  const toggleActive = useCustomIndicatorStore((s) => s.toggleActive);
  const deleteIndicator = useCustomIndicatorStore((s) => s.deleteIndicator);

  const activeCount = indicators.filter((i) => i.active).length;

  const handleEdit = useCallback(
    (indicator: CustomIndicator) => {
      navigation.navigate('CustomIndicatorEditor', { indicator });
    },
    [navigation],
  );

  const handleDelete = useCallback(
    (indicator: CustomIndicator) => {
      Alert.alert('Delete', `Delete "${indicator.label}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteIndicator(indicator.id),
        },
      ]);
    },
    [deleteIndicator],
  );

  const handleNew = useCallback(() => {
    navigation.navigate('CustomIndicatorEditor', {});
  }, [navigation]);

  return (
    <View style={[containerStyles.screen, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[containerStyles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={containerStyles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={containerStyles.headerInfo}>
          <Text style={[containerStyles.headerTitle, { color: colors.text }]}>
            Custom Indicators
          </Text>
          <Text style={[containerStyles.headerSubtitle, { color: colors.textMuted }]}>
            {indicators.length} total &middot; {activeCount} active
          </Text>
        </View>
        <Pressable style={[containerStyles.newBtn, { backgroundColor: colors.primary }]} onPress={handleNew}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        style={containerStyles.scroll}
        contentContainerStyle={containerStyles.scrollContent}
      >
        {/* Presets (always visible) */}
        <PresetQuickAdd colors={colors} />

        {/* My Custom Indicators */}
        {indicators.length === 0 ? (
          <View style={[containerStyles.empty, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="code-slash-outline" size={48} color={colors.textMuted} />
            <Text style={[containerStyles.emptyTitle, { color: colors.text }]}>
              No Custom Indicators Yet
            </Text>
            <Text style={[containerStyles.emptyDesc, { color: colors.textMuted }]}>
              Create your own technical indicators using formulas like{'\n'}
              SMA(close, 14), RSI(close, 14), or MACD(close)
            </Text>
            <Pressable
              style={[containerStyles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={handleNew}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={containerStyles.emptyBtnText}>Create Indicator</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Section: Overlay */}
            {indicators.filter((i) => i.panel === 'overlay').length > 0 && (
              <View style={containerStyles.section}>
                <Text style={[containerStyles.sectionTitle, { color: colors.textSecondary }]}>
                  On Chart Overlay
                </Text>
                {indicators
                  .filter((i) => i.panel === 'overlay')
                  .map((ind) => (
                    <IndicatorCard
                      key={ind.id}
                      indicator={ind}
                      colors={colors}
                      onToggle={() => toggleActive(ind.id)}
                      onEdit={() => handleEdit(ind)}
                      onDelete={() => handleDelete(ind)}
                    />
                  ))}
              </View>
            )}

            {/* Section: Separate */}
            {indicators.filter((i) => i.panel === 'separate').length > 0 && (
              <View style={containerStyles.section}>
                <Text style={[containerStyles.sectionTitle, { color: colors.textSecondary }]}>
                  Separate Panel
                </Text>
                {indicators
                  .filter((i) => i.panel === 'separate')
                  .map((ind) => (
                    <IndicatorCard
                      key={ind.id}
                      indicator={ind}
                      colors={colors}
                      onToggle={() => toggleActive(ind.id)}
                      onEdit={() => handleEdit(ind)}
                      onDelete={() => handleDelete(ind)}
                    />
                  ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: SPACING.xs,
    marginRight: SPACING.sm,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'System',
    fontSize: FONTS.size.lg,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '500',
    marginTop: 1,
  },
  newBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  section: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  empty: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontFamily: 'System',
    fontSize: FONTS.size.md,
    fontWeight: '700',
  },
  emptyDesc: {
    fontFamily: 'System',
    fontSize: FONTS.size.sm,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.sm,
  },
  emptyBtnText: {
    fontFamily: 'System',
    fontSize: FONTS.size.sm,
    fontWeight: '700',
    color: '#fff',
  },
});
