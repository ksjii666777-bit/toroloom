/**
 * ============================================================================
 * Toroloom — Security Settings Screen
 * ============================================================================
 *
 * Allows users to configure biometric authentication preferences:
 *   - Enable/disable biometric app-unlock
 *   - Enable/disable biometric trade confirmation
 *
 * Shows device biometric type (Face ID / Fingerprint) and availability status.
 *
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { triggerHaptic, ImpactFeedbackStyle } from '../../utils/haptics';
import { useTheme } from '../../context/ThemeContext';
import { useBiometricStore } from '../../store/biometricStore';
import { biometricAuth } from '../../services/biometricService';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';


export default function SecuritySettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const {
    enabled,
    requireForTrades,
    toggleBiometric,
    toggleRequireForTrades,
  } = useBiometricStore();

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric');
  const [biometricIcon, setBiometricIcon] = useState('finger-print');
  const [isChecking, setIsChecking] = useState(true);

  // Check biometric availability on mount
  useEffect(() => {
    (async () => {
      setIsChecking(true);
      const [available, label, icon] = await Promise.all([
        biometricAuth.isAvailable(),
        biometricAuth.getBiometricLabel(),
        biometricAuth.getBiometricIcon(),
      ]);
      setBiometricAvailable(available);
      setBiometricLabel(label);
      setBiometricIcon(icon);
      setIsChecking(false);
    })();
  }, []);

  const handleBiometricToggle = async () => {
    if (!enabled) {
      // Turning ON — first check if biometrics are available
      if (!biometricAvailable) {
        Alert.alert(
          'Biometrics Not Available',
          `${biometricLabel} is not set up on this device.\n\nTo enable:\n${biometricLabel === 'Face ID' ? 'Settings → Face ID & Passcode → Enroll Face' : 'Settings → Security → Fingerprint → Add fingerprint'}`,
          [{ text: 'OK' }],
        );
        return;
      }

      // Verify with biometric before enabling
      triggerHaptic(ImpactFeedbackStyle.Medium);
      const result = await biometricAuth.authenticate(
        `Enable ${biometricLabel} to unlock Toroloom`,
        true,
      );

      if (!result.success) {
        Alert.alert('Verification Failed', result.error || 'Could not verify your identity.');
        return;
      }
    }

    triggerHaptic();
    toggleBiometric();
  };

  const handleTradeToggle = () => {
    triggerHaptic();
    toggleRequireForTrades();
  };

  const handleTestBiometric = async () => {
    triggerHaptic(ImpactFeedbackStyle.Medium);
    const result = await biometricAuth.authenticate(
      `Verify your identity with ${biometricLabel}`,
      true,
    );

    if (result.success) {
      Alert.alert('✅ Verified', `${biometricLabel} authentication successful!`);
    } else if (result.error !== 'Authentication cancelled') {
      Alert.alert('❌ Failed', result.error || 'Authentication failed');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Security</Text>
            <Text style={styles.subtitle}>
              Biometric authentication settings
            </Text>
          </View>
        </View>

        {/* Device Status Card */}
        <Card
          title="Device Status"
          subtitle="Your device's biometric capabilities"
        >
          <View style={styles.statusRow}>
            <View style={[styles.statusIcon, {
              backgroundColor: biometricAvailable
                ? `${colors.marketUp}20`
                : `${colors.marketDown}15`,
            }]}>
              <Ionicons
                name={biometricAvailable ? 'checkmark-circle' : 'alert-circle'}
                size={24}
                color={biometricAvailable ? colors.marketUp : colors.marketDown}
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusLabel, { color: colors.text }]}>
                {isChecking
                  ? 'Checking...'
                  : biometricAvailable
                    ? `${biometricLabel} Available`
                    : `${biometricLabel} Not Available`}
              </Text>
              <Text style={[styles.statusDesc, { color: colors.textMuted }]}>
                {biometricAvailable
                  ? `Your device supports ${biometricLabel} authentication`
                  : `Set up ${biometricLabel} in your device settings to enable`}
              </Text>
            </View>
          </View>

          <View style={styles.biometricTypeRow}>
            <View style={[styles.biometricBadge, {
              backgroundColor: `${colors.primary}15`,
              borderColor: `${colors.primary}30`,
            }]}>
              <Ionicons
                name={biometricIcon as keyof typeof Ionicons.glyphMap}
                size={16}
                color={colors.primary}
              />
              <Text style={[styles.biometricBadgeText, { color: colors.primary }]}>
                {biometricLabel}
              </Text>
            </View>
            {biometricAvailable && (
              <TouchableOpacity
                style={[styles.testBtn, { borderColor: colors.border }]}
                onPress={handleTestBiometric}
              >
                <Ionicons name="play" size={14} color={colors.primary} />
                <Text style={[styles.testBtnText, { color: colors.primary }]}>
                  Test
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* App Unlock Setting */}
        <Card
          title="App Unlock"
          subtitle={`Require ${biometricLabel} to unlock the app`}
          style={{ marginTop: SPACING.md }}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons
                name={enabled ? 'lock-closed' : 'lock-open'}
                size={22}
                color={enabled ? colors.primary : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {enabled
                    ? `${biometricLabel} Lock is ON`
                    : `${biometricLabel} Lock is OFF`}
                </Text>
                <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                  {enabled
                    ? `App will require ${biometricLabel} when opened from background`
                    : 'App will open without authentication'}
                </Text>
              </View>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: colors.border, true: `${colors.primary}60` }}
              thumbColor={enabled ? colors.primary : colors.textMuted}
              disabled={!biometricAvailable || isChecking}
            />
          </View>
        </Card>

        {/* Trade Confirmation Setting */}
        <Card
          title="Trade Confirmation"
          subtitle={`Require ${biometricLabel} before placing orders`}
          style={{ marginTop: SPACING.md }}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons
                name={requireForTrades ? 'shield-checkmark' : 'shield-outline'}
                size={22}
                color={requireForTrades ? colors.primary : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {requireForTrades
                    ? 'Confirm Trades with Biometrics'
                    : 'No biometric confirmation for trades'}
                </Text>
                <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                  {requireForTrades
                    ? `Require ${biometricLabel} before executing buy/sell orders`
                    : 'Orders will be placed without biometric confirmation'}
                </Text>
              </View>
            </View>
            <Switch
              value={requireForTrades}
              onValueChange={handleTradeToggle}
              trackColor={{ false: colors.border, true: `${colors.primary}60` }}
              thumbColor={requireForTrades ? colors.primary : colors.textMuted}
              disabled={!enabled || !biometricAvailable}
            />
          </View>

          {enabled && !requireForTrades && (
            <View style={[styles.warningBox, {
              backgroundColor: `${colors.marketDown}10`,
              borderColor: `${colors.marketDown}20`,
            }]}>
              <Ionicons name="warning" size={16} color={colors.marketDown} />
              <Text style={[styles.warningText, { color: colors.marketDown }]}>
                Trade confirmation is disabled. Orders can be placed without biometric verification.
              </Text>
            </View>
          )}
        </Card>

        {/* Info Card */}
        <Card
          title="How It Works"
          subtitle="About biometric authentication"
          style={{ marginTop: SPACING.md }}
        >
          <View style={styles.infoRow}>
            <Ionicons name="phone-portrait" size={20} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Uses your device's built-in {biometricLabel.toLowerCase()} sensor.
              Biometric data never leaves your device.
            </Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={20} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              When enabled, the app locks when sent to background and requires
              authentication to resume.
            </Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.infoRow}>
            <Ionicons name="trending-up" size={20} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Trade confirmation adds an extra security layer before placing
              buy/sell orders.
            </Text>
          </View>
        </Card>

        {/* Audit Log Section */}
        <Card
          title="Audit Log"
          subtitle="Login history & session management"
          style={{ marginTop: SPACING.md }}
        >
          <AnimatedPressable
            onPress={() => navigation.navigate('SecurityAuditLog')}
            haptic="medium"
            scaleTo={0.97}
          >
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={[styles.manageIconBox, { backgroundColor: colors.warning + '20' }]}>
                  <Ionicons name="receipt" size={22} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Security Audit Log
                  </Text>
                  <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                    Review login history & manage active sessions
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </AnimatedPressable>
        </Card>

        {/* Two-Factor Authentication Section */}
        <Card
          title="Two-Factor Authentication"
          subtitle="Add an extra layer of security"
          style={{ marginTop: SPACING.md }}
        >
          <AnimatedPressable
            onPress={() => navigation.navigate('TwoFactorSetup')}
            haptic="medium"
            scaleTo={0.97}
          >
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={[styles.manageIconBox, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Two-Factor Authentication
                  </Text>
                  <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                    TOTP-based 2FA via authenticator app
                  </Text>
                </View>
              </View>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </AnimatedPressable>
        </Card>

        <View style={{ height: 100 }} />
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
    scrollContent: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 60,
      marginBottom: SPACING.xl,
      gap: SPACING.md,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.bgCard,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
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

    // Status
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    statusIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statusInfo: {
      flex: 1,
    },
    statusLabel: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
    },
    statusDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      marginTop: 2,
    },
    biometricTypeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    biometricBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
    },
    biometricBadgeText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      textTransform: 'capitalize',
    },
    testBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
    },
    testBtnText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
    },

    // Settings
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    settingInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      flex: 1,
    },
    settingLabel: {
      ...FONTS.medium,
      fontSize: FONTS.size.md,
    },
    settingDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      marginTop: 2,
    },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      marginTop: SPACING.md,
      borderWidth: 1,
    },
    warningText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      flex: 1,
    },

    // 2FA card styles
    manageIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },

    // Info
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
    },
    infoText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      flex: 1,
      lineHeight: 20,
    },
    infoDivider: {
      height: 1,
      marginLeft: 36,
    },
  });
