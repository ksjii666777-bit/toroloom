/**
 * ============================================================================
 * Toroloom — Aadhaar eKYC Screen
 * ============================================================================
 *
 * Two-step flow:
 *   1. Enter Aadhaar number → Send OTP
 *   2. Enter OTP → Verify → Complete eKYC
 *
 * Uses Setu (Pine Labs) API for Aadhaar verification.
 * Captures explicit user consent before sending OTP.
 * ============================================================================
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { kycApi } from '../../services/api/kyc';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';
import type { AadhaarOtpResponse, AadhaarVerifyResponse } from '../../types';

type FlowStep = 'aadhaar_input' | 'otp_input' | 'verified';

export default function AadhaarVerificationScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [flowStep, setFlowStep] = useState<FlowStep>('aadhaar_input');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(TextInput | null)[]>([]);
  const [consentGiven, setConsentGiven] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [otpResponse, setOtpResponse] = useState<AadhaarOtpResponse | null>(null);
  const [verifyResponse, setVerifyResponse] = useState<AadhaarVerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otpTimer, setOtpTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanedAadhaar = aadhaarNumber.replace(/\s/g, '');
  const isAadhaarValid = /^[2-9]\d{11}$/.test(cleanedAadhaar);
  const isOtpComplete = otp.every(d => d.length === 1);

  // Format Aadhaar with spaces: XXXX XXXX XXXX
  const formatAadhaar = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 12);
    const parts = [];
    for (let i = 0; i < cleaned.length; i += 4) {
      parts.push(cleaned.slice(i, i + 4));
    }
    return parts.join(' ');
  };

  const handleAadhaarChange = useCallback((text: string) => {
    setAadhaarNumber(formatAadhaar(text));
    setError(null);
  }, []);

  const handleOtpDigitChange = useCallback((index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    setOtp(prev => {
      const newOtp = [...prev];
      newOtp[index] = value;
      return newOtp;
    });
    setError(null);

    // Auto-focus next digit
    if (value && index < 5) {
      const nextRef = otpInputRefs.current[index + 1];
      if (nextRef) {
        nextRef.focus();
      }
    }
  }, []);

  const handleOtpKeyPress = useCallback((index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const prevRef = otpInputRefs.current[index - 1];
      if (prevRef) {
        prevRef.focus();
      }
    }
  }, [otp]);

  // Start timer for OTP expiry
  const startOtpTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setOtpTimer(600); // 10 minutes
    timerRef.current = setInterval(() => {
      setOtpTimer(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Step 1: Send OTP
  const handleSendOtp = useCallback(async () => {
    if (!isAadhaarValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Aadhaar', 'Please enter a valid 12-digit Aadhaar number.');
      return;
    }
    if (!consentGiven) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Consent Required', 'Please consent to Aadhaar verification to proceed.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setError(null);

    try {
      const data = await kycApi.sendAadhaarOtp(cleanedAadhaar, consentGiven);
      setOtpResponse(data);
      setFlowStep('otp_input');
      startOtpTimer();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      const msg = err?.body?.error || err?.message || 'Failed to send OTP';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [cleanedAadhaar, isAadhaarValid, consentGiven, startOtpTimer]);

  // Step 2: Verify OTP
  const handleVerifyOtp = useCallback(async () => {
    if (!isOtpComplete || !otpResponse) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setError(null);

    try {
      const otpString = otp.join('');
      const data = await kycApi.verifyAadhaarOtp(otpResponse.referenceId, otpString);
      setVerifyResponse(data);

      if (data.isVerified) {
        setFlowStep('verified');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setError(data.message || 'OTP verification failed');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      const msg = err?.body?.error || err?.message || 'Verification failed';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [otp, otpResponse, isOtpComplete]);

  const handleContinue = useCallback(() => {
    if (route.params?.onVerified) {
      route.params.onVerified();
    }
    navigation.goBack();
  }, [navigation, route.params]);

  const handleResendOtp = useCallback(async () => {
    if (!otpResponse) return;
    setOtp(['', '', '', '', '', '']);
    setError(null);
    setOtpResponse(null);
    setFlowStep('aadhaar_input');
  }, [otpResponse]);

  const minutes = Math.floor(otpTimer / 60);
  const seconds = otpTimer % 60;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Aadhaar eKYC</Text>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>
              {flowStep === 'aadhaar_input' ? 'Step 1 of 2' : flowStep === 'otp_input' ? 'Step 2 of 2' : 'Complete'}
            </Text>
          </View>
        </View>

        {/* Flow Indicator */}
        <View style={styles.progressBar}>
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={[styles.progressLine, (flowStep === 'otp_input' || flowStep === 'verified') && styles.progressLineActive]} />
          <View style={[styles.progressDot, (flowStep === 'otp_input' || flowStep === 'verified') && styles.progressDotActive]} />
          <View style={[styles.progressLine, flowStep === 'verified' && styles.progressLineActive]} />
          <View style={[styles.progressDot, flowStep === 'verified' && styles.progressDotActive]} />
        </View>

        {flowStep === 'aadhaar_input' && (
          <>
            {/* Info */}
            <Card style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                <Text style={styles.infoText}>
                  Your Aadhaar details will be verified via UIDAI. Only masked data
                  (last 4 digits) is stored. We never store your full Aadhaar number.
                </Text>
              </View>
            </Card>

            {/* Aadhaar Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Enter Aadhaar Number</Text>
              <View style={[styles.inputContainer, { borderColor: error ? colors.danger : colors.border }]}>
                <Ionicons name="finger-print" size={20} color={colors.primary} />
                <TextInput
                  style={styles.input}
                  value={aadhaarNumber}
                  onChangeText={handleAadhaarChange}
                  placeholder="XXXX XXXX XXXX"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={14}
                  editable={!isLoading}
                />
              </View>
              <Text style={styles.inputHint}>12-digit number found on your Aadhaar card</Text>
            </View>

            {/* Consent Checkbox */}
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => setConsentGiven(!consentGiven)}
              disabled={isLoading}
            >
              <View style={[styles.checkbox, consentGiven && styles.checkboxActive]}>
                {consentGiven && <Ionicons name="checkmark" size={16} color={colors.white} />}
              </View>
              <Text style={styles.consentText}>
                I consent to verify my Aadhaar details for KYC purposes. I understand that
                only my masked Aadhaar data (last 4 digits, year of birth, state) will be used.
              </Text>
            </TouchableOpacity>

            {/* Send OTP Button */}
            <AnimatedPressable
              onPress={handleSendOtp}
              disabled={!isAadhaarValid || !consentGiven || isLoading}
              haptic="medium"
              scaleTo={0.97}
              style={{ opacity: isAadhaarValid && consentGiven && !isLoading ? 1 : 0.5 }}
            >
              <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
                <Ionicons name="send" size={20} color={colors.white} />
                <Text style={styles.actionBtnText}>{isLoading ? 'Sending OTP...' : 'Send OTP'}</Text>
              </LinearGradient>
            </AnimatedPressable>
          </>
        )}

        {flowStep === 'otp_input' && (
          <>
            {/* OTP Info */}
            <Card style={styles.infoCard}>
              <Text style={styles.otpSentText}>
                An OTP has been sent to the mobile number registered with Aadhaar ending with{' '}
                <Text style={{ ...FONTS.bold, color: colors.primary }}>XXXX{cleanedAadhaar.slice(-4)}</Text>
              </Text>
              {otpTimer > 0 && (
                <Text style={styles.otpTimerText}>
                  OTP expires in {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </Text>
              )}
              {otpTimer === 0 && (
                <TouchableOpacity onPress={handleResendOtp}>
                  <Text style={styles.resendText}>OTP expired. Request new OTP</Text>
                </TouchableOpacity>
              )}
            </Card>

            {/* OTP Input */}
            <View style={styles.otpSection}>
              <Text style={styles.inputLabel}>
                For demo/mock: use <Text style={{ fontFamily: 'monospace', color: colors.primary }}>123456</Text>
              </Text>
              <View style={styles.otpRow}>
                {otp.map((digit, index) => (              <View key={index} style={[
                    styles.otpBox,
                    { borderColor: digit ? colors.primary : colors.border },
                    otp[index] && styles.otpBoxFilled,
                  ]}>
                    <TextInput
                      ref={(ref) => { otpInputRefs.current[index] = ref; }}
                      style={styles.otpInput}
                      value={digit}
                      onChangeText={(v) => handleOtpDigitChange(index, v)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                      keyboardType="number-pad"
                      maxLength={1}
                      editable={!isLoading}
                    />
                  </View>
                ))}
              </View>
            </View>

            {/* Verify OTP Button */}
            <AnimatedPressable
              onPress={handleVerifyOtp}
              disabled={!isOtpComplete || isLoading}
              haptic="medium"
              scaleTo={0.97}
              style={{ opacity: isOtpComplete && !isLoading ? 1 : 0.5, marginTop: SPACING.lg }}
            >
              <LinearGradient colors={GRADIENTS.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
                <Ionicons name="shield-checkmark" size={20} color={colors.white} />
                <Text style={styles.actionBtnText}>{isLoading ? 'Verifying...' : 'Verify OTP'}</Text>
              </LinearGradient>
            </AnimatedPressable>
          </>
        )}

        {flowStep === 'verified' && verifyResponse && (
          <>
            {/* Success */}
            <Card style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <View style={[styles.resultIcon, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                </View>
                <Text style={styles.resultTitle}>Aadhaar Verified ✓</Text>
              </View>
              <Text style={styles.resultSubtitle}>Your Aadhaar has been verified successfully via UIDAI</Text>

              <View style={styles.resultDivider} />

              <View style={styles.resultDetails}>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Aadhaar Number</Text>
                  <Text style={styles.resultValue}>XXXX XXXX {verifyResponse.lastFourDigits}</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Year of Birth</Text>
                  <Text style={styles.resultValue}>{verifyResponse.yearOfBirth || 'N/A'}</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Gender</Text>
                  <Text style={styles.resultValue}>{verifyResponse.gender || 'N/A'}</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>State</Text>
                  <Text style={styles.resultValue}>{verifyResponse.state || 'N/A'}</Text>
                </View>
              </View>
            </Card>

            {/* Continue */}
            <AnimatedPressable onPress={handleContinue} haptic="medium" scaleTo={0.97}>
              <LinearGradient colors={GRADIENTS.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.continueBtn}>
                <Text style={styles.continueBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.white} />
              </LinearGradient>
            </AnimatedPressable>
          </>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 20 },

    header: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      paddingTop: 60, marginBottom: SPACING.lg,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    title: { ...FONTS.bold, fontSize: FONTS.size.title, color: colors.text, flex: 1 },
    stepIndicator: {
      backgroundColor: colors.bgCard, paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.full,
    },
    stepText: { ...FONTS.medium, fontSize: FONTS.size.xs, color: colors.textMuted },

    // Progress
    progressBar: {
      flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xl,
      paddingHorizontal: SPACING.md,
    },
    progressDot: {
      width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border,
    },
    progressDotActive: { backgroundColor: colors.primary },
    progressLine: {
      flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 4,
    },
    progressLineActive: { backgroundColor: colors.primary },

    // Info
    infoCard: { marginBottom: SPACING.lg },
    infoRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
    infoText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, flex: 1, lineHeight: 20 },

    // Input
    inputSection: { marginBottom: SPACING.lg },
    inputLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.text, marginBottom: SPACING.sm },
    inputContainer: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      backgroundColor: colors.bgInput, borderRadius: BORDER_RADIUS.md,
      borderWidth: 1.5, paddingHorizontal: SPACING.md, height: 56,
    },
    input: {
      flex: 1, ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.text,
      letterSpacing: 3, fontFamily: 'monospace', paddingVertical: 0,
    },
    inputHint: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: SPACING.xs },

    // Consent
    consentRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg, alignItems: 'flex-start' },
    checkbox: {
      width: 24, height: 24, borderRadius: 6, borderWidth: 2,
      borderColor: colors.border, justifyContent: 'center', alignItems: 'center',
      marginTop: 2,
    },
    checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    consentText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, flex: 1, lineHeight: 20 },

    // Buttons
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    },
    actionBtnText: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.white },

    // OTP
    otpSection: { marginBottom: SPACING.md },
    otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm, marginTop: SPACING.md },
    otpBox: {
      flex: 1, aspectRatio: 1, borderRadius: BORDER_RADIUS.md, borderWidth: 1.5,
      backgroundColor: colors.bgInput, justifyContent: 'center', alignItems: 'center',
      maxWidth: 52,
    },
    otpBoxFilled: {
      backgroundColor: colors.primary + '10',
      borderColor: colors.primary,
    },
    otpInput: {
      ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.text,
      textAlign: 'center', paddingVertical: 0, width: '100%', height: '100%',
    },
    otpSentText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, lineHeight: 20 },
    otpTimerText: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.primary, marginTop: SPACING.sm },
    resendText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.primary, marginTop: SPACING.sm },

    // Result
    resultCard: { marginTop: SPACING.lg },
    resultHeader: { alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
    resultIcon: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    resultTitle: { ...FONTS.bold, fontSize: FONTS.size.xxl, color: colors.text, textAlign: 'center' },
    resultSubtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, textAlign: 'center' },
    resultDivider: { height: 1, backgroundColor: colors.divider, marginVertical: SPACING.lg },
    resultDetails: { gap: SPACING.md },
    resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    resultLabel: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted },
    resultValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text },

    // Continue
    continueBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md,
      marginTop: SPACING.lg,
    },
    continueBtnText: { ...FONTS.bold, fontSize: FONTS.size.md, color: colors.white },

    // Error
    errorContainer: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.danger + '15', borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md, marginTop: SPACING.lg,
    },
    errorText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.danger, flex: 1 },
  });
