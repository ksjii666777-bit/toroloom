/**
 * ============================================================================
 * Toroloom — Dark Mode Settings Screen
 * ============================================================================
 *
 * Allows users to manually override the system dark mode and choose between
 * System Default, Dark, or Light. Preference is persisted via themeStore.
 *
 * Features:
 *   - Three options: System (follow OS), Dark, Light
 *   - Visual preview cards showing how each mode looks
 *   - Current mode indicator with animated transition
 *   - Smooth theme-switching with the existing overlay animation
 * ============================================================================
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useThemeStore, type ThemeOverride } from '../../store/themeStore';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

// ──── Options ──────────────────────────────────────────────────────────────

interface OptionConfig {
  key: ThemeOverride;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  descKey: string;
  previewDark: string;   // Background color for preview
  previewLight: string;  // Text color for preview
}

const OPTIONS: OptionConfig[] = [
  {
    key: 'system',
    icon: 'phone-portrait',
    labelKey: 'darkMode.systemDefault',
    descKey: 'darkMode.systemDefaultDesc',
    previewDark: '#1E293B',
    previewLight: '#F8FAFC',
  },
  {
    key: 'dark',
    icon: 'moon',
    labelKey: 'darkMode.dark',
    descKey: 'darkMode.darkDesc',
    previewDark: '#0A0D14',
    previewLight: '#E0E6ED',
  },
  {
    key: 'light',
    icon: 'sunny',
    labelKey: 'darkMode.light',
    descKey: 'darkMode.lightDesc',
    previewDark: '#F8FAFC',
    previewLight: '#0F172A',
  },
];

// ──── Component ────────────────────────────────────────────────────────────

export default function DarkModeSettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors, toggleTheme, setOverride, isDark, mode } = useTheme();
  const override = useThemeStore((s) => s.override);
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('darkMode.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Mode Preview Card ── */}
        <View style={[styles.previewCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: colors.border }]}>
          <View style={[styles.previewBar, { backgroundColor: isDark ? '#0A0D14' : '#FFFFFF', borderColor: colors.border }]}>
            <View style={styles.previewBarContent}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={16} color={colors.text} />
              <Text style={[styles.previewBarText, { color: colors.text }]}>
                {(isDark ? t('darkMode.dark') : t('darkMode.light'))} — {t('darkMode.active')}
              </Text>
            </View>
            <View style={[styles.modeDot, { backgroundColor: isDark ? '#3B82F6' : '#3B82F6' }]} />
          </View>
          <View style={styles.previewBody}>
            <View style={[styles.previewRow, { backgroundColor: colors.bgCard }]}>
              <View style={[styles.previewAvatar, { backgroundColor: colors.primary }]} />
              <View style={{ flex: 1 }}>
                <View style={[styles.previewLine, { backgroundColor: colors.text, width: '60%' }]} />
                <View style={[styles.previewLine, { backgroundColor: colors.textMuted, width: '40%', marginTop: 4 }]} />
              </View>
            </View>
            <View style={[styles.previewChart, { backgroundColor: colors.bgCardLight }]}>
              <View style={[styles.chartBar, { backgroundColor: colors.marketUp, height: 24 }]} />
              <View style={[styles.chartBar, { backgroundColor: colors.primary, height: 32 }]} />
              <View style={[styles.chartBar, { backgroundColor: colors.marketUp, height: 20 }]} />
              <View style={[styles.chartBar, { backgroundColor: colors.warning, height: 28 }]} />
              <View style={[styles.chartBar, { backgroundColor: colors.marketDown, height: 16 }]} />
            </View>
          </View>
        </View>

        {/* ── Option Cards ── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('darkMode.chooseTheme')}</Text>

        {OPTIONS.map((opt) => {
          const isSelected = override === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                setOverride(opt.key);
              }}
              style={({ pressed }) => [
                styles.optionCard,
                {
                  backgroundColor: isSelected
                    ? colors.primary + '12'
                    : 'rgba(255,255,255,0.03)',
                  borderColor: isSelected
                    ? colors.primary + '40'
                    : 'rgba(255,255,255,0.06)',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {/* Preview mini card */}
              <View style={[styles.optionPreview, { backgroundColor: opt.previewDark }]}>
                <Ionicons name={opt.icon} size={20} color={opt.previewLight} />
              </View>

              {/* Info */}
              <View style={styles.optionInfo}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>
                  {t(opt.labelKey)}
                </Text>
                <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
                  {t(opt.descKey)}
                </Text>
              </View>

              {/* Selection indicator */}
              <View style={[
                styles.radioOuter,
                {
                  borderColor: isSelected ? colors.primary : 'rgba(255,255,255,0.2)',
                },
              ]}>
                {isSelected && (
                  <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                )}
              </View>
            </Pressable>
          );
        })}

        {/* ── Quick Tips ── */}
        <View style={[styles.tipCard, { backgroundColor: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.15)' }]}>
          <Ionicons name="bulb" size={16} color="#60A5FA" />
          <Text style={styles.tipText}>
            {t('darkMode.tip')}
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

    // ── Preview Card ──
    previewCard: {
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.md,
      marginBottom: SPACING.lg,
    },
    previewBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: 1,
      marginBottom: SPACING.sm,
    },
    previewBarContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    previewBarText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
    },
    modeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    previewBody: {
      gap: SPACING.sm,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      padding: SPACING.sm,
      borderRadius: BORDER_RADIUS.sm,
    },
    previewAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    previewLine: {
      height: 6,
      borderRadius: 3,
    },
    previewChart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.sm,
    },
    chartBar: {
      flex: 1,
      borderRadius: 3,
    },

    // ── Section Label ──
    sectionLabel: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.xs,
      letterSpacing: 1,
      marginBottom: SPACING.md,
    },

    // ── Option Card ──
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.lg,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      marginBottom: SPACING.md,
    },
    optionPreview: {
      width: 44,
      height: 44,
      borderRadius: BORDER_RADIUS.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    optionInfo: {
      flex: 1,
    },
    optionLabel: {
      ...FONTS.medium,
      fontSize: FONTS.size.md,
    },
    optionDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      marginTop: 2,
      lineHeight: 14,
    },

    // ── Radio ──
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: SPACING.sm,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },

    // ── Tip ──
    tipCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: SPACING.md,
      marginTop: SPACING.sm,
    },
    tipText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: '#60A5FA',
      flex: 1,
      lineHeight: 16,
    },
  });
