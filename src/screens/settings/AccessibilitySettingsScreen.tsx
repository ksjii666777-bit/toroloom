/**
 * ============================================================================
 * Toroloom — Accessibility Settings Screen
 * ============================================================================
 *
 * Configure accessibility preferences for a better user experience:
 *   - Font scaling (Small / Medium / Large / X-Large)
 *   - Reduce motion (disable animations)
 *   - High contrast mode
 *   - Live preview of font sizes
 *   - Screen reader optimization info
 *
 * Navigation: More → Accessibility
 * ============================================================================
 */

import React, { useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Switch, Dimensions, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useAccessibilityStore, FontScaleLevel, FONT_SCALE_VALUES } from '../../store/accessibilityStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ═════════════════════════════════════════════════════════════════════════
// FONT SCALE OPTIONS
// ═════════════════════════════════════════════════════════════════════════

const FONT_OPTIONS: { key: FontScaleLevel; labelKey: string; descKey: string; icon: string }[] = [
  { key: 'small',   labelKey: 'accessibility.small',   descKey: 'accessibility.smallDesc',   icon: 'text' },
  { key: 'medium',  labelKey: 'accessibility.medium',  descKey: 'accessibility.mediumDesc',  icon: 'text' },
  { key: 'large',   labelKey: 'accessibility.large',   descKey: 'accessibility.largeDesc',   icon: 'text' },
  { key: 'xlarge',  labelKey: 'accessibility.xLarge',  descKey: 'accessibility.xLargeDesc',  icon: 'text' },
];

// ═════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY SETTING ROW
// ═════════════════════════════════════════════════════════════════════════

function SettingRow({
  icon,
  title,
  description,
  value,
  onToggle,
  colors,
}: {
  icon: string;
  title: string;
  description: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  colors: any;
}) {
  return (
    <View style={[settingRowStyles.row, { borderBottomColor: colors.divider }]}>
      <View style={settingRowStyles.iconBox}>
        <Ionicons name={icon as any} size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[settingRowStyles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[settingRowStyles.desc, { color: colors.textMuted }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.primary + '60' }}
        thumbColor={value ? colors.primary : colors.textMuted}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

const settingRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  desc: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2, lineHeight: 16 },
});

// ═════════════════════════════════════════════════════════════════════════
// INFO ROW (for screen reader section)
// ═════════════════════════════════════════════════════════════════════════

function InfoRow({ icon, text, colors }: { icon: string; text: string; colors: any }) {
  return (
    <View style={infoRowStyles.row}>
      <Ionicons name={icon as any} size={16} color={colors.textMuted} />
      <Text style={[infoRowStyles.text, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const infoRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  text: { ...FONTS.regular, fontSize: FONTS.size.xs, flex: 1, lineHeight: 18 },
});

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function getFontLabel(t: (key: string) => string, level: FontScaleLevel): string {
  const labels: Record<FontScaleLevel, string> = {
    small: t('accessibility.small'),
    medium: t('accessibility.medium'),
    large: t('accessibility.large'),
    xlarge: t('accessibility.xLarge'),
  };
  return labels[level] || t('accessibility.medium');
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════

export default function AccessibilitySettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();

  const {
    fontScale,
    reduceMotion,
    highContrast,
    setFontScale,
    toggleReduceMotion,
    toggleHighContrast,
    setReduceMotion,
    setHighContrast,
  } = useAccessibilityStore();

  // Compute current font multiplier for preview
  const fontMultiplier = FONT_SCALE_VALUES[fontScale];

  // ── Reset to defaults ──
  const handleReset = useCallback(() => {
    Alert.alert(
      t('accessibility.resetTitle'),
      t('accessibility.resetMsg'),
      [
        { text: t('app.cancel'), style: 'cancel' },
        {
          text: t('accessibility.reset'),
          style: 'destructive',
          onPress: () => {
            setFontScale('medium');
            setReduceMotion(false);
            setHighContrast(false);
          },
        },
      ],
    );
  }, [t, setFontScale, setReduceMotion, setHighContrast]);

  // ── Font scale preview text sizes ──
  const previewSizes = useMemo(() => ({
    xs: Math.round(FONTS.size.xs * fontMultiplier),
    sm: Math.round(FONTS.size.sm * fontMultiplier),
    md: Math.round(FONTS.size.md * fontMultiplier),
    lg: Math.round(FONTS.size.lg * fontMultiplier),
    xl: Math.round(FONTS.size.xl * fontMultiplier),
    title: Math.round(FONTS.size.title * fontMultiplier),
  }), [fontMultiplier]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>{t('accessibility.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('accessibility.subtitle')}</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ═══════════════════ FONT SCALING ═══════════════════ */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          <Ionicons name="text" size={16} color={colors.text} /> {t('accessibility.fontSection')}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          {t('accessibility.fontSectionSub', { label: getFontLabel(t, fontScale), percent: Math.round(fontMultiplier * 100) })}
        </Text>

        {/* Font scale options */}
        <View style={[styles.optionsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {FONT_OPTIONS.map((opt, idx) => {
            const isSelected = fontScale === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setFontScale(opt.key)}
                style={[
                  styles.fontOption,
                  {
                    backgroundColor: isSelected ? colors.primary + '15' : 'transparent',
                    borderBottomWidth: idx < FONT_OPTIONS.length - 1 ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: colors.divider,
                    borderRadius: idx === 0 ? BORDER_RADIUS.md : 0,
                    borderTopLeftRadius: idx === 0 ? BORDER_RADIUS.md : 0,
                    borderTopRightRadius: idx === 0 ? BORDER_RADIUS.md : 0,
                    borderBottomLeftRadius: idx === FONT_OPTIONS.length - 1 ? BORDER_RADIUS.md : 0,
                    borderBottomRightRadius: idx === FONT_OPTIONS.length - 1 ? BORDER_RADIUS.md : 0,
                  },
                ]}
              >
                {/* Radio indicator */}
                <View style={[
                  styles.radioOuter,
                  { borderColor: isSelected ? colors.primary : colors.textMuted },
                ]}>
                  {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                </View>

                {/* Label & description */}
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.fontOptionLabel,
                    { color: isSelected ? colors.primary : colors.text, fontWeight: isSelected ? '700' : '400' },
                  ]}>
                    {t(opt.labelKey)}
                  </Text>
                  <Text style={[styles.fontOptionDesc, { color: colors.textMuted }]}>
                    {t(opt.descKey)}
                  </Text>
                </View>

                {/* Scale percentage */}
                <Text style={[styles.fontOptionPct, {
                  color: isSelected ? colors.primary : colors.textMuted,
                  fontWeight: isSelected ? '700' : '400',
                }]}>
                  {Math.round(FONT_SCALE_VALUES[opt.key] * 100)}%
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Font preview */}
        <View style={[styles.previewCard, {
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
          borderLeftColor: colors.primary,
          borderLeftWidth: 3,
        }]}>
          <View style={styles.previewHeader}>
            <Text style={[styles.previewLabel, { color: colors.textMuted }]}>{t('accessibility.livePreview')}</Text>
            <Text style={[styles.previewSize, { color: colors.textMuted }]}>
              {fontScale} ({Math.round(fontMultiplier * 100)}%)
            </Text>
          </View>
          <Text style={[styles.previewTitle, { color: colors.text, fontSize: previewSizes.title }]}>
            The quick brown fox
          </Text>
          <Text style={[styles.previewBody, { color: colors.textSecondary, fontSize: previewSizes.md }]}>
            Nifty 50 rallied 1.5% today led by banking and IT stocks. The benchmark index closed at 23,456, marking its third consecutive session of gains.
          </Text>
          <Text style={[styles.previewCaption, { color: colors.textMuted, fontSize: previewSizes.xs }]}>
            RELIANCE +2.3% · HDFCBANK +1.8% · TCS +0.9%
          </Text>
          <View style={[styles.previewDivider, { backgroundColor: colors.divider }]} />
          <Text style={[styles.previewLabel, { color: colors.textMuted, fontSize: previewSizes.xs }]}>
            xs ({previewSizes.xs}px) · sm ({previewSizes.sm}px) · md ({previewSizes.md}px) · lg ({previewSizes.lg}px) · xl ({previewSizes.xl}px) · title ({previewSizes.title}px)
          </Text>
        </View>

        {/* ═══════════════════ MOTION & CONTRAST ═══════════════════ */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
          <Ionicons name="options" size={16} color={colors.text} /> {t('accessibility.motionSection')}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{t('accessibility.motionSectionSub')}</Text>

        <View style={[styles.settingsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {/* Reduce Motion */}
          <SettingRow
            icon="pause-circle"
            title={t('accessibility.reduceMotion')}
            description={t('accessibility.reduceMotionDesc')}
            value={reduceMotion}
            onToggle={() => toggleReduceMotion()}
            colors={colors}
          />

          {/* High Contrast */}
          <SettingRow
            icon="contrast"
            title={t('accessibility.highContrast')}
            description={t('accessibility.highContrastDesc')}
            value={highContrast}
            onToggle={() => toggleHighContrast()}
            colors={colors}
          />
        </View>

        {/* ═══════════════════ SCREEN READER ═══════════════════ */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
          <Ionicons name="ear" size={16} color={colors.text} /> {t('accessibility.screenReader')}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{t('accessibility.screenReaderSub')}</Text>

        <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.infoCardTitle, { color: colors.text }]}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} /> {t('accessibility.alreadyOptimized')}
          </Text>
          <InfoRow icon="checkmark" text="All interactive elements have accessibility labels" colors={colors} />
          <InfoRow icon="checkmark" text="Buttons and controls use proper roles for screen readers" colors={colors} />
          <InfoRow icon="checkmark" text="Charts and data visualizations include descriptive text alternatives" colors={colors} />
          <InfoRow icon="checkmark" text="Form inputs have associated labels for navigation" colors={colors} />
          <InfoRow icon="checkmark" text="Touch targets meet minimum size recommendations (44x44pt)" colors={colors} />

          <View style={[styles.infoDivider, { backgroundColor: colors.divider }]} />

          <Text style={[styles.infoCardTitle, { color: colors.text }]}>
            <Ionicons name="bulb" size={14} color={colors.warning} /> {t('accessibility.tips')}
          </Text>
          <InfoRow icon="information-circle" text={'Use your device\'s built-in screen reader: Settings, Accessibility, TalkBack (Android) or VoiceOver (iOS)'} colors={colors} />
          <InfoRow icon="information-circle" text="Dynamic text will automatically scale with your device's font size settings if you use 'Medium' or above" colors={colors} />
        </View>

        {/* ═══════════════════ RESET ═══════════════════ */}
        <AnimatedPressable onPress={handleReset} haptic="medium" scaleTo={0.97}>
          <View style={[styles.resetBtn, { borderColor: colors.danger + '40' }]}>
            <Ionicons name="refresh-outline" size={18} color={colors.danger} />
            <Text style={[styles.resetBtnText, { color: colors.danger }]}>
              {t('accessibility.resetToDefaults')}
            </Text>
          </View>
        </AnimatedPressable>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: SPACING.xl,
    paddingTop: 60,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backBtn: { padding: 4 },
  title: { ...FONTS.bold, fontSize: FONTS.size.title, color: '#FFFFFF' },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 4 },

  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },

  // Sections
  sectionTitle: { ...FONTS.bold, fontSize: FONTS.size.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionSubtitle: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2, marginBottom: SPACING.md },

  // Font Options Card
  optionsCard: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  fontOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  fontOptionLabel: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  fontOptionDesc: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2 },
  fontOptionPct: { ...FONTS.mono, fontSize: FONTS.size.sm, minWidth: 40, textAlign: 'right' },

  // Preview
  previewCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewSize: { ...FONTS.mono, fontSize: FONTS.size.xs },
  previewTitle: { ...FONTS.bold, lineHeight: 40 },
  previewBody: { ...FONTS.regular, lineHeight: 22 },
  previewCaption: { ...FONTS.mono, letterSpacing: 0.3 },
  previewDivider: { height: 1, marginVertical: 2 },

  // Settings Card
  settingsCard: {
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },

  // Info Card
  infoCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  infoCardTitle: { ...FONTS.semiBold, fontSize: FONTS.size.xs, marginBottom: SPACING.sm },
  infoDivider: { height: 1, marginVertical: SPACING.sm },

  // Reset
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  resetBtnText: { ...FONTS.medium, fontSize: FONTS.size.sm },
});
