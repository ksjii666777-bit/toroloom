/**
 * ============================================================================
 * Toroloom — Two-Factor Authentication (TOTP) Setup Screen
 * ============================================================================
 *
 * Complete 2FA setup flow:
 *   1. Setup step — displays QR code + secret key for authenticator app
 *   2. Verify step — input 6-digit code from authenticator app
 *   3. Backup codes step — display recovery codes with copy option
 *   4. Manage step — disable 2FA with confirmation, regenerate backup codes
 *
 * Uses react-native-qrcode-svg for QR code rendering.
 * ============================================================================
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Modal,
  Dimensions, Alert, KeyboardAvoidingView, Platform, ScrollView,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../../context/ThemeContext';
import { authApi } from '../../services/api';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';
import type { TwoFactorSetupData, TwoFactorStatus } from '../../types';

const { width } = Dimensions.get('window');
const QR_SIZE = Math.min(width - SPACING.xl * 4, 220);

type FlowStep = 'loading' | 'setup' | 'verify' | 'backup_codes' | 'manage';

export default function TwoFactorSetupScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [flowStep, setFlowStep] = useState<FlowStep>('loading');
  const [setupData, setSetupData] = useState<TwoFactorSetupData | null>(null);
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupCodesSaved, setBackupCodesSaved] = useState(false);
  const [, setCodesCopied] = useState(false);
  const [disableCodeModal, setDisableCodeModal] = useState(false);
  const [disableCodeInput, setDisableCodeInput] = useState('');

  // ── Load Status on Mount ────────────────────────────────────────
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await authApi.get2FAStatus();
      setStatus(s);
      setFlowStep(s.enabled ? 'manage' : 'setup');
    } catch {
      // Backend unavailable — use default
      setStatus({ enabled: false, verified: false });
      setFlowStep('setup');
    }
  }, []);

  // ── Generate Setup ──────────────────────────────────────────────
  const handleStartSetup = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setError(null);

    try {
      const data = await authApi.generate2FASetup();
      setSetupData(data);
      setFlowStep('setup');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Failed to generate 2FA setup');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Verify Code ─────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    const code = verificationCode.trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Code', 'Please enter the full 6-digit code from your authenticator app.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setError(null);

    try {
      const result = await authApi.verify2FAToken(code);
      if (result.verified) {
        setStatus({ enabled: true, verified: true, setupAt: new Date().toISOString() });
        setFlowStep('backup_codes');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError(result.message || 'Invalid code. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Verification failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [verificationCode]);

  // ── Disable 2FA ─────────────────────────────────────────────────
  const handleDisable = useCallback(() => {
    setDisableCodeInput('');
    setError(null);
    setDisableCodeModal(true);
  }, []);

  const handleConfirmDisable = useCallback(async () => {
    const code = disableCodeInput.trim();
    if (!code) {
      setError('Please enter a verification code.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await authApi.disable2FA(code);
      if (result.success) {
        setDisableCodeModal(false);
        setDisableCodeInput('');
        setStatus({ enabled: false, verified: false });
        setFlowStep('setup');
        setSetupData(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('2FA Disabled', 'Two-factor authentication has been disabled for your account.');
      }
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Failed to disable 2FA');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [disableCodeInput]);

  // ── Regenerate Backup Codes ─────────────────────────────────────
  const handleRegenerateCodes = useCallback(async () => {
    Alert.alert(
      'Regenerate Backup Codes',
      'This will invalidate all your current backup codes. New codes will be generated. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const result = await authApi.regenerateBackupCodes();
              if (result.codes?.length > 0) {
                setSetupData(prev => prev ? { ...prev, backupCodes: result.codes } : null);
                setFlowStep('backup_codes');
                setBackupCodesSaved(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (err: any) {
              setError(err?.body?.error || err?.message || 'Failed to regenerate codes');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  }, []);

  // ── Copy / Share Backup Codes ───────────────────────────────────
  const handleCopyCodes = useCallback(async () => {
    if (!setupData) return;

    const codesText = setupData.backupCodes.join('\n');
    try {
      await Share.share({
        message: `Toroloom — Backup Codes\n\nSave these codes in a secure place. Each code can only be used once.\n\n${codesText}\n\nKeep this safe!`,
        title: 'Toroloom Backup Codes',
      });
      setCodesCopied(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // User cancelled share
    }
  }, [setupData]);

  const handleConfirmSaved = useCallback(() => {
    setBackupCodesSaved(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ── Code Input ──────────────────────────────────────────────────
  const CODE_LENGTH = 6;
  const codeDigits = verificationCode.padEnd(CODE_LENGTH, ' ').split('').slice(0, CODE_LENGTH);

  const renderLoadingStep = () => (
    <View style={styles.loadingContainer}>
      <Ionicons name="shield-checkmark" size={48} color={colors.primary} />
      <Text style={styles.loadingText}>Loading 2FA status...</Text>
    </View>
  );

  const renderSetupStep = () => (
    <>
      {/* Info */}
      <Card style={styles.infoCard}>
        <View style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Two-Factor Authentication</Text>
          <Text style={styles.heroDesc}>
            Add an extra layer of security to your account. Every time you log in,
            you'll need your password and a 6-digit code from your authenticator app.
          </Text>
        </View>

        <View style={styles.benefitsSection}>
          {[
            'Protects against unauthorized access',
            'Works with Google Authenticator, Authy, or similar',
            'Backup codes provided for emergency access',
          ].map((benefit, i) => (
            <View key={i} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Start Setup Button */}
      {!setupData && (
        <AnimatedPressable
          onPress={handleStartSetup}
          disabled={isLoading}
          haptic="medium"
          scaleTo={0.97}
        >
          <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
            <Ionicons name="shield-checkmark" size={22} color={colors.white} />
            <Text style={styles.actionBtnText}>{isLoading ? 'Generating...' : 'Set Up Two-Factor Auth'}</Text>
          </LinearGradient>
        </AnimatedPressable>
      )}

      {/* QR Code + Secret */}
      {setupData && (
        <>
          <Card style={styles.qrCard}>
            <Text style={styles.qrTitle}>Scan with Authenticator App</Text>
            <Text style={styles.qrSubtitle}>
              Open Google Authenticator, Authy, or any TOTP app and scan this QR code.
            </Text>

            <View style={styles.qrContainer}>
              <View style={[styles.qrBorder, { borderColor: colors.primary + '30' }]}>
                <QRCode
                  value={setupData.otpauthUrl}
                  size={QR_SIZE}
                  backgroundColor="white"
                  color="#1a1a2e"
                />
              </View>
            </View>

            {/* Manual Entry */}
            <TouchableOpacity
              style={styles.manualToggle}
              onPress={() => Alert.alert(
                'Manual Setup Key',
                `If you can't scan the QR code, enter this key manually in your authenticator app:\n\n${setupData.secret}\n\nAccount: Toroloom\nType: Time-based (TOTP)`,
              )}
            >
              <Ionicons name="key-outline" size={16} color={colors.primary} />
              <Text style={styles.manualToggleText}>Can't scan? Enter key manually</Text>
            </TouchableOpacity>
          </Card>

          {/* Code Input */}
          <Text style={[styles.inputLabel, { marginBottom: SPACING.sm }]}>
            Enter the 6-digit code from your authenticator app:
          </Text>
          <View style={styles.otpRow}>
            {codeDigits.map((digit, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.otpBox,
                  { borderColor: verificationCode.length > index ? colors.primary : colors.border },
                  verificationCode.length > index && { backgroundColor: colors.primary + '10', borderColor: colors.primary },
                ]}
                onPress={() => {
                  // Focus the hidden input
                  if (codeInputRef.current) codeInputRef.current.focus();
                }}
              >
                <Text style={[
                  styles.otpDigit,
                  { color: verificationCode.length > index ? colors.primary : colors.textMuted },
                ]}>
                  {digit.trim() || ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Hidden input for capturing keyboard */}
          <TextInput
            ref={codeInputRef}
            testID="otp-input"
            style={styles.hiddenInput}
            value={verificationCode}
            onChangeText={(t) => {
              const cleaned = t.replace(/\D/g, '').slice(0, 6);
              setVerificationCode(cleaned);
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />

          <Text style={styles.otpHint}>
            {verificationCode.length === 0
              ? 'Enter the 6-digit code shown in your authenticator app'
              : `${verificationCode.length}/6 digits entered`}
          </Text>

          {/* Verify Button */}
          <AnimatedPressable
            onPress={handleVerify}
            disabled={verificationCode.length !== 6 || isLoading}
            haptic="medium"
            scaleTo={0.97}
            style={{ opacity: verificationCode.length === 6 && !isLoading ? 1 : 0.5, marginTop: SPACING.lg }}
          >
            <LinearGradient colors={GRADIENTS.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
              <Ionicons name="shield-checkmark" size={22} color={colors.white} />
              <Text style={styles.actionBtnText}>{isLoading ? 'Verifying...' : 'Verify & Enable 2FA'}</Text>
            </LinearGradient>
          </AnimatedPressable>
        </>
      )}
    </>
  );

  const codeInputRef = useRef<TextInput>(null);

  const renderBackupCodesStep = () => (
    <>
      {/* Success Message */}
      <Card style={styles.successCard}>
        <View style={styles.successHeader}>
          <View style={[styles.successIcon, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="shield-checkmark" size={48} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>2FA Enabled ✓</Text>
          <Text style={styles.successSubtitle}>
            Two-factor authentication is now active for your account.
          </Text>
        </View>
      </Card>

      {/* Backup Codes */}
      <Card
        title="Backup Codes"
        subtitle="Save these one-time recovery codes in a secure place"
        style={{ marginTop: SPACING.md }}
      >
        <View style={[styles.warningBox, { backgroundColor: '#FFC10715', borderColor: '#FFC10730' }]}>
          <Ionicons name="warning" size={18} color="#FFC107" />
          <Text style={styles.warningText}>
            Each code can only be used once. Store them safely — if you lose access to
            your authenticator app, these are the only way to regain access to your account.
          </Text>
        </View>

        <View style={[styles.codesGrid, { backgroundColor: colors.bgInput }]}>
          {setupData?.backupCodes.map((code, i) => (
            <View key={i} style={styles.codeRow}>
              <Ionicons name="key-outline" size={14} color={colors.textMuted} />
              <Text style={styles.codeText}>{code}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.codesActions}>
          <TouchableOpacity style={styles.codeActionBtn} onPress={handleCopyCodes}>
            <Ionicons name="share-outline" size={18} color={colors.primary} />
            <Text style={styles.codeActionText}>Share / Copy</Text>
          </TouchableOpacity>
        </View>

        {/* Confirm Saved */}
        <AnimatedPressable
          onPress={handleConfirmSaved}
          haptic="medium"
          scaleTo={0.97}
          style={{ marginTop: SPACING.md }}
        >
          <LinearGradient colors={backupCodesSaved ? GRADIENTS.success : GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.continueBtn}>
            <Ionicons name={backupCodesSaved ? 'checkmark-circle' : 'shield-checkmark'} size={20} color={colors.white} />
            <Text style={styles.continueBtnText}>
              {backupCodesSaved ? 'Saved Securely — Go to Settings' : 'I\'ve Saved My Backup Codes'}
            </Text>
          </LinearGradient>
        </AnimatedPressable>

        {backupCodesSaved && (
          <TouchableOpacity style={styles.dismissBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.dismissBtnText}>Done</Text>
          </TouchableOpacity>
        )}
      </Card>
    </>
  );

  const renderManageStep = () => (
    <>
      {/* Status Card */}
      <Card style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={[styles.statusIconBig, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="shield-checkmark" size={36} color={colors.success} />
          </View>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>2FA is Active</Text>
            <Text style={styles.statusSubtitle}>
              Your account is protected with two-factor authentication.
            </Text>
          </View>
        </View>

        <View style={styles.statusBadgeRow}>
          <View style={[styles.statusBadge, { backgroundColor: colors.success + '15' }]}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={[styles.statusBadgeText, { color: colors.success }]}>Enabled</Text>
          </View>
          {status?.setupAt && (
            <Text style={styles.statusDate}>
              Since {new Date(status.setupAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          )}
        </View>
      </Card>

      {/* Actions */}
      <Card title="Manage 2FA" style={{ marginTop: SPACING.md }}>
        {/* View Backup Codes */}
        <TouchableOpacity
          style={styles.manageRow}
          onPress={async () => {
            try {
              const result = await authApi.getBackupCodes();
              const codes = result.codes.filter(c => !c.used).map(c => c.code);
              if (setupData) {
                setSetupData({ ...setupData, backupCodes: codes });
              } else {
                setSetupData({ secret: '', otpauthUrl: '', backupCodes: codes });
              }
              setFlowStep('backup_codes');
            } catch (err: any) {
              setError(err?.body?.error || err?.message || 'Failed to fetch codes');
            }
          }}
        >
          <View style={[styles.manageIcon, { backgroundColor: '#FFC10720' }]}>
            <Ionicons name="key" size={20} color="#FFC107" />
          </View>
          <View style={styles.manageInfo}>
            <Text style={styles.manageLabel}>View Backup Codes</Text>
            <Text style={styles.manageSub}>See remaining backup codes</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Regenerate Backup Codes */}
        <TouchableOpacity style={styles.manageRow} onPress={handleRegenerateCodes}>
          <View style={[styles.manageIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </View>
          <View style={styles.manageInfo}>
            <Text style={styles.manageLabel}>Regenerate Backup Codes</Text>
            <Text style={styles.manageSub}>Invalidate old codes and create new ones</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Disable 2FA */}
        <TouchableOpacity style={styles.manageRow} onPress={handleDisable}>
          <View style={[styles.manageIcon, { backgroundColor: colors.danger + '20' }]}>
            <Ionicons name="shield-outline" size={20} color={colors.danger} />
          </View>
          <View style={styles.manageInfo}>
            <Text style={[styles.manageLabel, { color: colors.danger }]}>Disable Two-Factor Auth</Text>
            <Text style={styles.manageSub}>Requires current code for verification</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </Card>

      {/* Info */}
      <Card title="How It Works" style={{ marginTop: SPACING.md }}>
        <View style={styles.infoRow}>
          <Ionicons name="phone-portrait" size={18} color={colors.textMuted} />
          <Text style={styles.infoText}>
            When logging in, you'll enter your password followed by a 6-digit code
            from your authenticator app.
          </Text>
        </View>
        <View style={[styles.infoDivider, { backgroundColor: colors.divider }]} />
        <View style={styles.infoRow}>
          <Ionicons name="key" size={18} color={colors.textMuted} />
          <Text style={styles.infoText}>
            Backup codes can be used once each if you lose access to your authenticator app.
          </Text>
        </View>
        <View style={[styles.infoDivider, { backgroundColor: colors.divider }]} />
        <View style={styles.infoRow}>
          <Ionicons name="refresh" size={18} color={colors.textMuted} />
          <Text style={styles.infoText}>
            You can regenerate backup codes at any time. Old codes will be invalidated.
          </Text>
        </View>
      </Card>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Two-Factor Auth</Text>
        </View>

        {flowStep === 'loading' && renderLoadingStep()}
        {flowStep === 'setup' && renderSetupStep()}
        {flowStep === 'backup_codes' && renderBackupCodesStep()}
        {flowStep === 'manage' && renderManageStep()}

        {/* Error */}
        {error && !disableCodeModal && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Disable 2FA Verification Modal */}
        <Modal visible={disableCodeModal} transparent animationType="fade">
          <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
              <View style={styles.modalHeader}>
                <Ionicons name="shield-outline" size={32} color={colors.danger} />
                <Text style={styles.modalTitle}>Disable 2FA</Text>
                <Text style={styles.modalSubtitle}>
                  Enter a code from your authenticator app or a backup code to confirm.
                </Text>
              </View>

              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                value={disableCodeInput}
                onChangeText={(t) => { setDisableCodeInput(t); setError(null); }}
                placeholder="Enter code"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isLoading}
              />

              {error && (
                <Text style={[styles.modalError, { color: colors.danger }]}>{error}</Text>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { borderColor: colors.border }]}
                  onPress={() => { setDisableCodeModal(false); setDisableCodeInput(''); setError(null); }}
                  disabled={isLoading}
                >
                  <Text style={[styles.modalBtnText, { color: colors.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
                <AnimatedPressable
                  onPress={handleConfirmDisable}
                  disabled={!disableCodeInput.trim() || isLoading}
                  haptic="medium"
                  scaleTo={0.97}
                  style={{ flex: 1, opacity: disableCodeInput.trim() && !isLoading ? 1 : 0.5 }}
                >
                  <LinearGradient colors={GRADIENTS.danger} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modalActionBtn}>
                    <Text style={styles.modalActionBtnText}>{isLoading ? 'Disabling...' : 'Disable 2FA'}</Text>
                  </LinearGradient>
                </AnimatedPressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 20 },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      paddingTop: 60, marginBottom: SPACING.xl,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    title: { ...FONTS.bold, fontSize: FONTS.size.title, color: colors.text },

    // Loading
    loadingContainer: { alignItems: 'center', paddingVertical: 60, gap: SPACING.md },
    loadingText: { ...FONTS.regular, fontSize: FONTS.size.md, color: colors.textMuted },

    // Info
    infoCard: { marginBottom: SPACING.xl },
    heroSection: { alignItems: 'center', marginBottom: SPACING.lg },
    heroIcon: {
      width: 72, height: 72, borderRadius: 22, backgroundColor: colors.primary + '15',
      justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md,
    },
    heroTitle: { ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.text, textAlign: 'center' },
    heroDesc: {
      ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary,
      textAlign: 'center', lineHeight: 20, marginTop: SPACING.xs,
    },
    benefitsSection: { backgroundColor: colors.bgInput, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, gap: SPACING.sm },
    benefitRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    benefitText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, flex: 1 },

    // Action Button
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    },
    actionBtnText: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.white },

    // QR Code
    qrCard: { marginBottom: SPACING.xl, alignItems: 'center' },
    qrTitle: { ...FONTS.semiBold, fontSize: FONTS.size.lg, color: colors.text, textAlign: 'center' },
    qrSubtitle: {
      ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary,
      textAlign: 'center', marginTop: SPACING.xs, marginBottom: SPACING.lg,
    },
    qrContainer: { alignItems: 'center', marginBottom: SPACING.lg },
    qrBorder: { padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 2, borderStyle: 'dashed' },
    manualToggle: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      paddingVertical: SPACING.md,
    },
    manualToggleText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.primary },

    // OTP Input
    inputLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.text },
    otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm },
    otpBox: {
      flex: 1, aspectRatio: 1, borderRadius: BORDER_RADIUS.md, borderWidth: 1.5,
      backgroundColor: colors.bgInput, justifyContent: 'center', alignItems: 'center',
      maxWidth: 48,
    },
    otpDigit: { ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.text, textAlign: 'center' },
    hiddenInput: {
      position: 'absolute', width: 1, height: 1, opacity: 0,
    },
    otpHint: {
      ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted,
      marginTop: SPACING.sm, textAlign: 'center',
    },

    // Success
    successCard: { marginBottom: SPACING.md },
    successHeader: { alignItems: 'center', gap: SPACING.md },
    successIcon: { width: 88, height: 88, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
    successTitle: { ...FONTS.bold, fontSize: FONTS.size.xxl, color: colors.text, textAlign: 'center' },
    successSubtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, textAlign: 'center' },

    // Backup Codes
    warningBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
      padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.lg,
    },
    warningText: { ...FONTS.regular, fontSize: FONTS.size.xs, color: '#B8860B', flex: 1, lineHeight: 18 },
    codesGrid: {
      borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md,
    },
    codeRow: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      paddingVertical: 4,
    },
    codeText: {
      ...FONTS.bold, fontSize: FONTS.size.md, color: colors.text,
      fontFamily: 'monospace', letterSpacing: 1,
    },
    codesActions: {
      flexDirection: 'row', justifyContent: 'center', gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    codeActionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
      borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: colors.primary + '40',
    },
    codeActionText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.primary },

    // Continue
    continueBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md,
    },
    continueBtnText: { ...FONTS.bold, fontSize: FONTS.size.md, color: colors.white },
    dismissBtn: { alignItems: 'center', paddingVertical: SPACING.xl },
    dismissBtnText: { ...FONTS.medium, fontSize: FONTS.size.md, color: colors.primary },

    // Manage
    statusCard: { marginBottom: SPACING.md },
    statusHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    statusIconBig: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    statusInfo: { flex: 1 },
    statusTitle: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.text },
    statusSubtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, marginTop: 2 },
    statusBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.lg },
    statusBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
    },
    statusBadgeText: { ...FONTS.bold, fontSize: FONTS.size.xs },
    statusDate: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted },

    // Manage Rows
    manageRow: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      paddingVertical: SPACING.md,
    },
    manageIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    manageInfo: { flex: 1 },
    manageLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.text },
    manageSub: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 1 },
    divider: { height: 1, backgroundColor: colors.divider },

    // Info
    infoRow: {
      flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md,
      paddingVertical: SPACING.md,
    },
    infoText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, flex: 1, lineHeight: 20 },
    infoDivider: { height: 1, marginLeft: 36 },

    // Disable Modal
    modalOverlay: {
      flex: 1, justifyContent: 'center', alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: SPACING.xl,
    },
    modalContent: {
      width: '100%', maxWidth: 340, borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.xl, gap: SPACING.lg,
    },
    modalHeader: { alignItems: 'center', gap: SPACING.sm },
    modalTitle: { ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.text },
    modalSubtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, textAlign: 'center' },
    modalInput: {
      borderWidth: 1.5, borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md, height: 52,
      ...FONTS.bold, fontSize: FONTS.size.lg, textAlign: 'center', letterSpacing: 4,
      fontFamily: 'monospace',
    },
    modalError: { ...FONTS.regular, fontSize: FONTS.size.sm, textAlign: 'center' },
    modalActions: { flexDirection: 'row', gap: SPACING.md },
    modalBtn: {
      flex: 1, height: 48, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
      justifyContent: 'center', alignItems: 'center',
    },
    modalBtnText: { ...FONTS.medium, fontSize: FONTS.size.md },
    modalActionBtn: {
      height: 48, borderRadius: BORDER_RADIUS.md,
      justifyContent: 'center', alignItems: 'center',
    },
    modalActionBtnText: { ...FONTS.bold, fontSize: FONTS.size.md, color: colors.white },

    // Error
    errorContainer: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.danger + '15', borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md, marginTop: SPACING.lg,
    },
    errorText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.danger, flex: 1 },
  });
