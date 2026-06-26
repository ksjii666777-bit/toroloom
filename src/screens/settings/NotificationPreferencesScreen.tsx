import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useNotificationStore } from '../../store/notificationStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

Dimensions.get('window');

const PREFERENCE_SECTIONS = [
  {
    title: 'Notification Types',
    items: [
      { key: 'priceAlerts' as const, icon: 'trending-up', color: '#FFC107', label: 'Price Alerts', desc: 'Stock price movements & target alerts' },
      { key: 'tradeConfirmations' as const, icon: 'swap-horizontal', color: '#00C853', label: 'Trade Confirmations', desc: 'Buy/sell order execution updates' },
      { key: 'educationalReminders' as const, icon: 'school', color: '#6C63FF', label: 'Learning Reminders', desc: 'Course, lesson & quiz notifications' },
      { key: 'systemUpdates' as const, icon: 'settings', color: '#6E6E9A', label: 'System Updates', desc: 'KYC, account & app version updates' },
    ],
  },
  {
    title: 'Alert Behavior',
    items: [
      { key: 'soundEnabled' as const, icon: 'volume-high', color: '#00D2FF', label: 'Sound', desc: 'Play a sound for new notifications' },
      { key: 'vibrationEnabled' as const, icon: 'phone-portrait', color: '#FF6B6B', label: 'Vibration', desc: 'Vibrate on incoming notifications' },
    ],
  },
];

export default function NotificationPreferencesScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      'Reset Preferences',
      'This will reset all notification preferences to their default values.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetPreferences },
      ],
    );
  }, [resetPreferences]);

  const adjustThreshold = useCallback((delta: number) => {
    const newVal = Math.max(0.5, Math.min(10, preferences.priceAlertThreshold + delta));
    handleToggle('priceAlertThreshold', Math.round(newVal * 10) / 10);
  }, [preferences.priceAlertThreshold, handleToggle]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={[colors.bgSecondary, colors.bg]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>Notification Preferences</Text>
            <Text style={styles.subtitle}>Control how and when you get notified</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Preference Sections */}
        {PREFERENCE_SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, i) => (
                <React.Fragment key={item.key}>
                  <View style={styles.prefRow}>
                    <View style={[styles.prefIcon, { backgroundColor: item.color + '20' }]}>
                      <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={20} color={item.color} />
                    </View>
                    <View style={styles.prefInfo}>
                      <Text style={styles.prefLabel}>{item.label}</Text>
                      <Text style={styles.prefDesc}>{item.desc}</Text>
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
          <Text style={styles.sectionTitle}>Price Alert Threshold</Text>
          <View style={styles.card}>
            <View style={styles.thresholdRow}>
              <View style={[styles.prefIcon, { backgroundColor: '#FFC10720' }]}>
                <Ionicons name="speedometer" size={20} color="#FFC107" />
              </View>
              <View style={styles.thresholdInfo}>
                <Text style={styles.prefLabel}>Price Change Threshold</Text>
                <Text style={styles.prefDesc}>
                  Alert me when a stock moves by{' '}
                  <Text style={styles.prefDescBold}>{preferences.priceAlertThreshold}%</Text>
                </Text>
              </View>
            </View>
            <View style={styles.thresholdControls}>
              <TouchableOpacity
                style={styles.thresholdBtn}
                onPress={() => adjustThreshold(-0.5)}
                activeOpacity={0.6}
              >
                <Ionicons name="remove" size={22} color={colors.primary} />
              </TouchableOpacity>
              <View style={styles.thresholdValueWrap}>
                <Text style={styles.thresholdValue}>{preferences.priceAlertThreshold}%</Text>
              </View>
              <TouchableOpacity
                style={styles.thresholdBtn}
                onPress={() => adjustThreshold(0.5)}
                activeOpacity={0.6}
              >
                <Ionicons name="add" size={22} color={colors.primary} />
              </TouchableOpacity>
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
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
          <View style={styles.card}>
            <View style={styles.prefRow}>
              <View style={[styles.prefIcon, { backgroundColor: '#6C63FF20' }]}>
                <Ionicons name="moon" size={20} color="#6C63FF" />
              </View>
              <View style={styles.prefInfo}>
                <Text style={styles.prefLabel}>Quiet Hours</Text>
                <Text style={styles.prefDesc}>
                  {showQuietHours
                    ? `Silent from ${preferences.quietHoursStart || '10:00 PM'} to ${preferences.quietHoursEnd || '7:00 AM'}`
                    : 'Receive notifications at all times'}
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
                    <Text style={styles.quietTimeLabel}>From</Text>
                    <TouchableOpacity style={styles.quietTimePicker}>
                      <Text style={styles.quietTimeValue}>{preferences.quietHoursStart || '10:00 PM'}</Text>
                      <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.quietTimeArrow}>
                    <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
                  </View>
                  <View style={styles.quietTimeBlock}>
                    <Text style={styles.quietTimeLabel}>To</Text>
                    <TouchableOpacity style={styles.quietTimePicker}>
                      <Text style={styles.quietTimeValue}>{preferences.quietHoursEnd || '7:00 AM'}</Text>
                      <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Email Notifications Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email Notifications</Text>
          <View style={styles.card}>
            <View style={styles.emailRow}>
              <View style={[styles.prefIcon, { backgroundColor: '#00D2FF20' }]}>
                <Ionicons name="mail" size={20} color="#00D2FF" />
              </View>
              <View style={styles.prefInfo}>
                <Text style={styles.prefLabel}>Email Summary</Text>
                <Text style={styles.prefDesc}>
                  Receive a daily summary of your portfolio activity
                </Text>
              </View>
              <Text style={styles.emailBadge}>Coming Soon</Text>
            </View>
          </View>
        </View>

        {/* Reset Button */}
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
          <Ionicons name="refresh" size={18} color={colors.danger} />
          <Text style={styles.resetText}>Reset to Defaults</Text>
        </TouchableOpacity>

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
