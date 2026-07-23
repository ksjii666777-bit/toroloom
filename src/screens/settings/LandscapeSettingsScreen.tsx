import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, Platform, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useResponsiveLayout, BREAKPOINTS } from '../../hooks/useResponsiveLayout';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

// ─── Default landscape preferences (stored in-memory / AsyncStorage) ──────

interface LandscapePrefs {
  allowLandscape: boolean;
  autoRotateCharts: boolean;
  splitPaneEnabled: boolean;
  compactMode: boolean;
  showSideNav: boolean;
}

const DEFAULT_PREFS: LandscapePrefs = {
  allowLandscape: true,
  autoRotateCharts: true,
  splitPaneEnabled: true,
  compactMode: true,
  showSideNav: true,
};

export default function LandscapeSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isLandscape, isTablet, width, height, columns, fontSizeScale, spacingScale } = useResponsiveLayout();

  const [prefs, setPrefs] = useState<LandscapePrefs>(DEFAULT_PREFS);

  const togglePref = useCallback((key: keyof LandscapePrefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const resetDefaults = useCallback(() => {
    Alert.alert(
      t('landscapeSettings.resetTitle'),
      t('landscapeSettings.resetMsg'),
      [
        { text: t('app.cancel'), style: 'cancel' },
        { text: t('landscapeSettings.reset'), onPress: () => setPrefs(DEFAULT_PREFS) },
      ],
    );
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('landscapeSettings.title')}</Text>
          <Text style={styles.subtitle}>{t('landscapeSettings.subtitle')}</Text>
        </View>

        {/* ── Current Status Card ── */}
        <Animated.View entering={FadeInDown.springify()} style={[styles.statusCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>{t('landscapeSettings.orientation')}</Text>
              <View style={styles.statusValueRow}>
                <Ionicons
                  name={isLandscape ? 'phone-landscape' : 'phone-portrait'}
                  size={18}
                  color={isLandscape ? '#00C853' : colors.primary}
                />
                <Text style={[styles.statusValue, { color: isLandscape ? '#00C853' : colors.primary }]}>
                  {isLandscape ? t('landscapeSettings.landscape') : t('landscapeSettings.portrait')}
                </Text>
              </View>
            </View>
            <View style={styles.statusDivider} />
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>{t('landscapeSettings.device')}</Text>
              <View style={styles.statusValueRow}>
                <Ionicons
                  name={isTablet ? 'tablet-landscape' : 'phone-portrait'}
                  size={18}
                  color={isTablet ? '#8B5CF6' : colors.textMuted}
                />
                <Text style={[styles.statusValue, { color: isTablet ? '#8B5CF6' : colors.textMuted }]}>
                  {isTablet ? t('landscapeSettings.tablet') : t('landscapeSettings.phone')}
                </Text>
              </View>
            </View>
            <View style={styles.statusDivider} />
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>{t('landscapeSettings.screen')}</Text>
              <Text style={[styles.statusValue, { color: colors.text, fontSize: FONTS.size.sm }]}>
                {width < 600 ? `${Math.round(width)}×${Math.round(height)}` : `${Math.round(width)}×${Math.round(height)}`}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Breakpoint Info ── */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('landscapeSettings.layoutInfo')}</Text>
          <View style={styles.infoGrid}>
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard }]}>
              <Text style={styles.infoLabel}>{t('landscapeSettings.columns')}</Text>
              <Text style={styles.infoValue}>{columns}</Text>
              <Text style={styles.infoDesc}>{t('landscapeSettings.gridColumns')}</Text>
            </View>
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard }]}>
              <Text style={styles.infoLabel}>{t('landscapeSettings.spacing')}</Text>
              <Text style={styles.infoValue}>{(spacingScale * 100).toFixed(0)}%</Text>
              <Text style={styles.infoDesc}>{t('landscapeSettings.spacingScale')}</Text>
            </View>
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard }]}>
              <Text style={styles.infoLabel}>{t('landscapeSettings.font')}</Text>
              <Text style={styles.infoValue}>{(fontSizeScale * 100).toFixed(0)}%</Text>
              <Text style={styles.infoDesc}>{t('landscapeSettings.fontScale')}</Text>
            </View>
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard }]}>
              <Text style={styles.infoLabel}>{t('landscapeSettings.compact')}</Text>
              <Text style={styles.infoValue}>{prefs.compactMode ? t('status.on') : t('status.off')}</Text>
              <Text style={styles.infoDesc}>{t('landscapeSettings.headers')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Toggles ── */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('landscapeSettings.preferences')}</Text>

          {/* Allow Landscape */}
          <SettingRow
            icon="phone-landscape"
            label={t('landscapeSettings.allowLandscape')}
            description={t('landscapeSettings.allowLandscapeDesc')}
            value={prefs.allowLandscape}
            onToggle={() => togglePref('allowLandscape')}
            colors={colors}
            styles={styles}
          />

          {/* Auto-rotate Charts */}
          <SettingRow
            icon="pie-chart"
            label={t('landscapeSettings.autoRotateCharts')}
            description={t('landscapeSettings.autoRotateChartsDesc')}
            value={prefs.autoRotateCharts}
            onToggle={() => togglePref('autoRotateCharts')}
            colors={colors}
            styles={styles}
          />

          {/* Split Pane */}
          <SettingRow
            icon="grid"
            label={t('landscapeSettings.splitPane')}
            description={t('landscapeSettings.splitPaneDesc')}
            value={prefs.splitPaneEnabled}
            onToggle={() => togglePref('splitPaneEnabled')}
            disabled={!isTablet}
            colors={colors}
            styles={styles}
          />

          {/* Compact Mode */}
          <SettingRow
            icon="remove-circle"
            label={t('landscapeSettings.compactHeaders')}
            description={t('landscapeSettings.compactHeadersDesc')}
            value={prefs.compactMode}
            onToggle={() => togglePref('compactMode')}
            colors={colors}
            styles={styles}
          />

          {/* Side Navigation */}
          <SettingRow
            icon="menu"
            label={t('landscapeSettings.sideNav')}
            description={t('landscapeSettings.sideNavDesc')}
            value={prefs.showSideNav}
            onToggle={() => togglePref('showSideNav')}
            disabled={!isTablet}
            colors={colors}
            styles={styles}
          />
        </Animated.View>

        {/* ── Device Info ── */}
        <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('landscapeSettings.deviceInfo')}</Text>
          <View style={[styles.deviceInfoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <DeviceInfoRow label={t('landscapeSettings.screenWidth')} value={`${Math.round(width)}px`} color={colors.primary} styles={styles} />
            <DeviceInfoRow label={t('landscapeSettings.screenHeight')} value={`${Math.round(height)}px`} color={colors.primary} styles={styles} />
            <DeviceInfoRow label={t('landscapeSettings.orientation')} value={isLandscape ? t('landscapeSettings.landscape') : t('landscapeSettings.portrait')} color={isLandscape ? '#00C853' : colors.primary} styles={styles} />
            <DeviceInfoRow label={t('landscapeSettings.formFactor')} value={isTablet ? t('landscapeSettings.tablet') : t('landscapeSettings.phone')} color={isTablet ? '#8B5CF6' : colors.textMuted} styles={styles} />
            <DeviceInfoRow label={t('landscapeSettings.gridColumns')} value={`${columns}`} color={colors.primary} styles={styles} />
            <DeviceInfoRow label={t('landscapeSettings.font')} value={`${(fontSizeScale * 100).toFixed(0)}%`} color={colors.text} styles={styles} />
            <DeviceInfoRow label={t('landscapeSettings.spacing')} value={`${(spacingScale * 100).toFixed(0)}%`} color={colors.text} styles={styles} />
            <DeviceInfoRow label={t('landscapeSettings.breakpoint')} value={getBreakpointLabel(width)} color="#6C63FF" styles={styles} />
          </View>
        </Animated.View>

        {/* ── Reset Button ── */}
        <AnimatedPressable onPress={resetDefaults} haptic="medium" scaleTo={0.97}>
          <View style={styles.resetBtn}>
            <Ionicons name="refresh" size={18} color={colors.textMuted} />
            <Text style={styles.resetBtnText}>{t('landscapeSettings.resetDefaults')}</Text>
          </View>
        </AnimatedPressable>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Setting Row Component ────────────────────────────────────────────────

function SettingRow({
  icon, label, description, value, onToggle, disabled, colors, styles,
}: {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
  colors: any;
  styles: any;
}) {
  return (
    <View style={[styles.settingRow, disabled && { opacity: 0.5 }]}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name={icon as any} size={18} color={disabled ? colors.textMuted : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.settingLabel, disabled && { color: colors.textMuted }]}>{label}</Text>
          <Text style={styles.settingDesc}>{description}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: colors.bgCardLight, true: colors.primary + '60' }}
        thumbColor={value ? colors.primary : colors.textMuted}
        ios_backgroundColor={colors.bgCardLight}
      />
    </View>
  );
}

// ─── Device Info Row ──────────────────────────────────────────────────────

function DeviceInfoRow({ label, value, color, styles }: { label: string; value: string; color: string; styles: any }) {
  return (
    <View style={styles.deviceInfoRow}>
      <Text style={styles.deviceInfoLabel}>{label}</Text>
      <Text style={[styles.deviceInfoValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────

function getBreakpointLabel(width: number): string {
  if (width < BREAKPOINTS.SMALL) return 'Small Phone (<375px)';
  if (width < BREAKPOINTS.MEDIUM) return 'Phone (375-768px)';
  if (width < BREAKPOINTS.TABLET) return 'Small Tablet (768-1024px)';
  return 'Tablet / Desktop (>1024px)';
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  header: {
    paddingTop: 60,
    marginBottom: SPACING.lg,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  statusCard: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statusDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.divider,
  },
  statusLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  statusValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
    marginBottom: SPACING.md,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  infoCard: {
    width: '47%',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    gap: 2,
  },
  infoLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  infoValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  infoDesc: {
    ...FONTS.regular,
    fontSize: 9,
    color: colors.textMuted,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
    marginRight: SPACING.md,
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
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  settingDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  deviceInfoCard: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  deviceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  deviceInfoLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  deviceInfoValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: SPACING.xl,
  },
  resetBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
});
