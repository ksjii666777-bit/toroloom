import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Dimensions,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useNotificationStore } from '../../store/notificationStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';


Dimensions.get('window');

const PREFERENCE_SECTIONS = [
  {
    titleKey: 'notificationPrefs.notifTypes',
    items: [
      { key: 'priceAlerts' as const, icon: 'trending-up', color: '#FFC107', labelKey: 'notificationPrefs.priceAlerts', descKey: 'notificationPrefs.priceAlertsScreenDesc' },
      { key: 'tradeConfirmations' as const, icon: 'swap-horizontal', color: '#00C853', labelKey: 'notificationPrefs.tradeConfirmations', descKey: 'notificationPrefs.tradeConfirmationsScreenDesc' },
      { key: 'educationalReminders' as const, icon: 'school', color: '#6C63FF', labelKey: 'notificationPrefs.learningReminders', descKey: 'notificationPrefs.learningRemindersDesc' },
      { key: 'systemUpdates' as const, icon: 'settings', color: '#6E6E9A', labelKey: 'notificationPrefs.systemUpdates', descKey: 'notificationPrefs.systemUpdatesDesc' },
    ],
  },
  {
    titleKey: 'notificationPrefs.alertBehavior',
    items: [
      { key: 'soundEnabled' as const, icon: 'volume-high', color: '#00D2FF', labelKey: 'notificationPrefs.soundLabel', descKey: 'notificationPrefs.soundDesc' },
      { key: 'vibrationEnabled' as const, icon: 'phone-portrait', color: '#FF6B6B', labelKey: 'notificationPrefs.vibrationLabel', descKey: 'notificationPrefs.vibrationDesc' },
    ],
  },
];

export default function NotificationPreferencesScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'NotificationPreferences'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const {
    preferences,
    updatePreference,
    resetPreferences,
  } = useNotificationStore();

  const [showQuietHours, setShowQuietHours] = useState(
    preferences.quietHoursStart !== null,
  );

  const handleToggle = useCallback(<K extends keyof typeof preferences>(
    key: K,
    value: (typeof preferences)[K],
  ) => {
    updatePreference(key, value);
  }, [updatePreference]);

  const handleReset = useCallback(() => {
    Alert.alert(
      t('notificationPrefs.resetTitle'),
      t('notificationPrefs.resetMsg'),
      [
        { text: t('notificationPrefs.cancel'), style: 'cancel' },
        { text: t('notificationPrefs.reset'), style: 'destructive', onPress: resetPreferences },
      ],
    );
  }, [resetPreferences, t]);

  const _adjustThreshold = useCallback((delta: number) => {
    const newVal = Math.max(0.5, Math.min(10, preferences.priceAlertThreshold + delta));
    handleToggle('priceAlertThreshold', Math.round(newVal * 10) / 10);
  }, [preferences.priceAlertThreshold, handleToggle]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={[colors.bgSecondary, colors.bg]} style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{t('notificationPrefs.title')}</Text>
            <Text style={styles.subtitle}>{t('notificationPrefs.subtitle')}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Preference Sections */}
        {PREFERENCE_SECTIONS.map(section => (
          <View key={section.titleKey} style={styles.section}>
            <Text style={styles.sectionTitle}>{t(section.titleKey)}</Text>
            <View style={styles.card}>
              {section.items.map((item, i) => (
                <React.Fragment key={item.key}>
                  <View style={styles.prefRow}>
                    <View style={[styles.prefIcon, { backgroundColor: item.color + '20' }]}>
                      <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={20} color={item.color} />
                    </View>
                    <View style={styles.prefInfo}>
                      <Text style={styles.prefLabel}>{t(item.labelKey)}</Text>
                      <Text style={styles.prefDesc}>{t(item.descKey)}</Text>
                    </View>
                    <Switch
                      value={preferences[item.key] as boolean}
                      onValueChange={val => handleToggle(item.key, val)}
                      trackColor={{ false: colors.bgInput, true: colors.primary + '60' }}
                      thumbColor={preferences[item.key] ? colors.primary : colors.textMuted}
                      ios_backgroundColor={colors.bgInput}
                    />
                  </View>
                  {i < section.items.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* Alert Threshold */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notificationPrefs.priceAlertThreshold')}</Text>
          <View style={styles.card}>
            <View style={styles.thresholdRow}>
              <View style={[styles.prefIcon, { backgroundColor: '#FFC10720' }]}>
                <Ionicons name="speedometer" size={20} color="#FFC107" />
              </View>
              <View style={styles.thresholdInfo}>
                <Text style={styles.prefLabel}>{t('notificationPrefs.priceChangeThreshold')}</Text>
                <Text style={styles.prefDesc}>
                  {t('notificationPrefs.alertWhenMoves', { value: preferences.priceAlertThreshold })}
                </Text>
              </View>
            </View>
            <View style={styles.thresholdControls}>
              <Pressable style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}>
                <Ionicons name="remove" size={22} color={colors.primary} />
              </Pressable>
              <View style={styles.thresholdValueWrap}>
                <Text style={styles.thresholdValue}>{preferences.priceAlertThreshold}%</Text>
              </View>
              <Pressable style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}>
                <Ionicons name="add" size={22} color={colors.primary} />
              </Pressable>
            </View>
            <View style={styles.thresholdRange}>
              <Text style={styles.thresholdRangeText}>0.5%</Text>
              <View style={styles.thresholdBarBg}>
                <View
                  style={[
                    styles.thresholdBarFill,
                    { width: `${((preferences.priceAlertThreshold - 0.5) / 9.5) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.thresholdRangeText}>10%</Text>
            </View>
          </View>
        </View>

        {/* Quiet Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notificationPrefs.quietHours')}</Text>
          <View style={styles.card}>
            <View style={styles.prefRow}>
              <View style={[styles.prefIcon, { backgroundColor: '#6C63FF20' }]}>
                <Ionicons name="moon" size={20} color="#6C63FF" />
              </View>
              <View style={styles.prefInfo}>
                <Text style={styles.prefLabel}>{t('notificationPrefs.quietHours')}</Text>
                <Text style={styles.prefDesc}>
                  {showQuietHours
                    ? t('notificationPrefs.quietHoursDescOn', { start: preferences.quietHoursStart || '10:00 PM', end: preferences.quietHoursEnd || '7:00 AM' })
                    : t('notificationPrefs.quietHoursDescOff')}
                </Text>
              </View>
              <Switch
                value={showQuietHours}
                onValueChange={val => {
                  setShowQuietHours(val);
                  handleToggle('quietHoursStart', val ? '10:00 PM' : null);
                  handleToggle('quietHoursEnd', val ? '7:00 AM' : null);
                }}
                trackColor={{ false: colors.bgInput, true: colors.primary + '60' }}
                thumbColor={showQuietHours ? colors.primary : colors.textMuted}
                ios_backgroundColor={colors.bgInput}
              />
            </View>

            {showQuietHours && (
              <>
                <View style={styles.divider} />
                <View style={styles.quietTimeRow}>
                  <View style={styles.quietTimeBlock}>
                    <Text style={styles.quietTimeLabel}>{t('notificationPrefs.from')}</Text>
                    <Pressable style={styles.quietTimePicker}>
                      <Text style={styles.quietTimeValue}>{preferences.quietHoursStart || '10:00 PM'}</Text>
                      <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <View style={styles.quietTimeArrow}>
                    <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
                  </View>
                  <View style={styles.quietTimeBlock}>
                    <Text style={styles.quietTimeLabel}>{t('notificationPrefs.to')}</Text>
                    <Pressable style={styles.quietTimePicker}>
                      <Text style={styles.quietTimeValue}>{preferences.quietHoursEnd || '7:00 AM'}</Text>
                      <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Email Notifications Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notificationPrefs.emailNotifications')}</Text>
          <View style={styles.card}>
            <View style={styles.emailRow}>
              <View style={[styles.prefIcon, { backgroundColor: '#00D2FF20' }]}>
                <Ionicons name="mail" size={20} color="#00D2FF" />
              </View>
              <View style={styles.prefInfo}>
                <Text style={styles.prefLabel}>{t('notificationPrefs.emailSummary')}</Text>
                <Text style={styles.prefDesc}>
                  {t('notificationPrefs.emailSummaryDesc')}
                </Text>
              </View>
              <Text style={styles.emailBadge}>{t('notificationPrefs.comingSoon')}</Text>
            </View>
          </View>
        </View>

        {/* Reset Button */}
        <Pressable style={({pressed}) => [styles.resetBtn, {opacity: pressed ? 0.7 : 1}]} onPress={handleReset}>
          <Ionicons name="refresh" size={18} color={colors.danger} />
          <Text style={styles.resetText}>{t('notificationPrefs.resetToDefaults')}</Text>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      paddingTop: 60,
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.lg,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.bgCard,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerInfo: {
      flex: 1,
    },
    title: {
      ...FONTS.bold,
      fontSize: FONTS.size.title,
      color: colors.text,
    },
    subtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    scrollContent: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: 20,
    },
    section: {
      marginBottom: SPACING.xxl,
    },
    sectionTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: SPACING.md,
    },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
    },
    prefRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.sm,
    },
    prefIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    prefInfo: {
      flex: 1,
      marginRight: SPACING.md,
    },
    prefLabel: {
      ...FONTS.medium,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    prefDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 2,
      lineHeight: 16,
    },
    prefDescBold: {
      ...FONTS.semiBold,
      color: colors.text,
    },
    divider: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: 2,
    },
    thresholdRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    thresholdInfo: {
      flex: 1,
      marginRight: SPACING.md,
    },
    thresholdControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.lg,
      marginBottom: SPACING.md,
    },
    thresholdBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    thresholdValueWrap: {
      backgroundColor: colors.bgInput,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    thresholdValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.xxl,
      color: colors.primary,
    },
    thresholdRange: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    thresholdRangeText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      width: 32,
      textAlign: 'center',
    },
    thresholdBarBg: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.bgInput,
      overflow: 'hidden',
    },
    thresholdBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    quietTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: SPACING.md,
      gap: SPACING.md,
    },
    quietTimeBlock: {
      flex: 1,
    },
    quietTimeLabel: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginBottom: SPACING.sm,
    },
    quietTimePicker: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bgInput,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quietTimeValue: {
      ...FONTS.medium,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    quietTimeArrow: {
      paddingTop: SPACING.xl,
    },
    emailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.sm,
    },
    emailBadge: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      backgroundColor: colors.bgInput,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderRadius: BORDER_RADIUS.full,
      overflow: 'hidden',
    },
    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.lg,
      marginTop: SPACING.sm,
    },
    resetText: {
      ...FONTS.medium,
      fontSize: FONTS.size.md,
      color: colors.danger,
    },
  });
