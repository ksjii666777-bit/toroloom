/**
 * ============================================================================
 * Toroloom — PAN Verification Screen
 * ============================================================================
 *
 * Allows users to enter and verify their PAN (Permanent Account Number).
 * Validates format locally before sending to backend for verification.
 *
 * PAN Format: ABCDE1234F (5 letters + 4 digits + 1 letter)
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
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
import type { PanVerificationResult } from '../../types';

// PAN regex: 5 uppercase letters, 4 digits, 1 uppercase letter
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;

export default function PanVerificationScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [panNumber, setPanNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<PanVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedPan = panNumber.trim().toUpperCase();
  const isFormatValid = PAN_REGEX.test(normalizedPan);

  const handlePanChange = useCallback((text: string) => {
    // Only allow alphanumeric, uppercase
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    setPanNumber(cleaned);
    setResult(null);
    setError(null);
  }, []);

  const handleVerify = useCallback(async () => {
    if (!isFormatValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid PAN', 'Please enter a valid 10-character PAN (e.g., ABCDE1234F)');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsVerifying(true);
    setError(null);
    setResult(null);

    try {
      const data = await kycApi.verifyPan(normalizedPan);
      setResult(data);

      if (data.isVerified) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      const msg = err?.body?.error || err?.message || 'Verification failed. Please try again.';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsVerifying(false);
    }
  }, [normalizedPan, isFormatValid]);

  const handleContinue = useCallback(() => {
    if (route.params?.onVerified) {
      route.params.onVerified(normalizedPan);
    }
    navigation.goBack();
  }, [navigation, normalizedPan, route.params]);

  const isVerified = result?.isVerified === true;

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
          <Text style={styles.title}>PAN Verification</Text>
        </View>

        {/* Info Section */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              PAN (Permanent Account Number) is a 10-character alphanumeric identifier
              issued by the Income Tax Department. Your PAN will be verified via the
              NSDL database.
            </Text>
          </View>
          <View style={styles.formatRow}>
            <Text style={styles.formatLabel}>Format:</Text>
            <Text style={styles.formatExample}>ABCDE1234F</Text>
          </View>
        </Card>

        {/* Input Section */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Enter PAN Number</Text>
          <View style={[styles.inputContainer, { borderColor: error ? colors.danger : result?.isVerified ? colors.success : colors.border }]}>
            <TextInput
              style={styles.input}
              value={panNumber}
              onChangeText={handlePanChange}
              placeholder="ABCDE1234F"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              maxLength={10}
              autoCorrect={false}
              editable={!isVerifying}
            />
            {panNumber.length > 0 && (
              <View style={[styles.inputStatus, {
                backgroundColor: isFormatValid
                  ? (isVerified ? colors.success + '20' : colors.primary + '20')
                  : colors.danger + '20',
              }]}>
                <Ionicons
                  name={isFormatValid ? (isVerified ? 'checkmark-circle' : 'ellipse') : 'close-circle'}
                  size={18}
                  color={isFormatValid ? (isVerified ? colors.success : colors.primary) : colors.danger}
                />
              </View>
            )}
          </View>
          <Text style={styles.inputHint}>
            {panNumber.length === 0
              ? 'Enter your 10-digit PAN number'
              : isFormatValid
                ? '✓ Valid PAN format'
                : `Enter ${10 - panNumber.length} more characters`}
          </Text>
        </View>

        {/* Verify Button */}
        <AnimatedPressable
          onPress={handleVerify}
          disabled={!isFormatValid || isVerifying}
          haptic="medium"
          scaleTo={0.97}
          style={{ opacity: isFormatValid && !isVerifying ? 1 : 0.5 }}
        >
          <LinearGradient
            colors={isVerifying ? ['#666', '#888'] : GRADIENTS.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.verifyBtn}
          >
            {isVerifying ? (
              <Ionicons name="sync" size={22} color={colors.white} />
            ) : (
              <Ionicons name="shield-checkmark" size={22} color={colors.white} />
            )}
            <Text style={styles.verifyBtnText}>
              {isVerifying ? 'Verifying...' : 'Verify PAN'}
            </Text>
          </LinearGradient>
        </AnimatedPressable>

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Success Result */}
        {result && isVerified && (
          <Card style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={[styles.resultIcon, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="checkmark-circle" size={32} color={colors.success} />
              </View>
              <View style={styles.resultInfo}>
                <Text style={styles.resultTitle}>PAN Verified ✓</Text>
                <Text style={styles.resultSubtitle}>Your PAN has been verified successfully</Text>
              </View>
            </View>

            <View style={styles.resultDivider} />

            <View style={styles.resultDetails}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>PAN Number</Text>
                <Text style={styles.resultValue}>{result.panNumber}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Name on PAN</Text>
                <Text style={styles.resultValue}>{result.nameOnPan || result.fullName}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Category</Text>
                <Text style={styles.resultValue}>{result.category || 'Individual'}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
                  <Text style={[styles.statusBadgeText, { color: colors.success }]}>VALID</Text>
                </View>
              </View>
            </View>

            {/* Continue Button */}
            <AnimatedPressable
              onPress={handleContinue}
              haptic="medium"
              scaleTo={0.97}
              style={{ marginTop: SPACING.lg }}
            >
              <LinearGradient colors={GRADIENTS.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.continueBtn}>
                <Text style={styles.continueBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color={colors.white} />
              </LinearGradient>
            </AnimatedPressable>
          </Card>
        )}

        {/* Failure Result */}
        {result && !isVerified && (
          <Card style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={[styles.resultIcon, { backgroundColor: colors.danger + '20' }]}>
                <Ionicons name="close-circle" size={32} color={colors.danger} />
              </View>
              <View style={styles.resultInfo}>
                <Text style={[styles.resultTitle, { color: colors.danger }]}>Verification Failed</Text>
                <Text style={styles.resultSubtitle}>
                  {result.status === 'INVALID'
                    ? 'The PAN format is invalid. Please check and try again.'
                    : 'PAN not found in NSDL database. Please verify your PAN.'}
                </Text>
              </View>
            </View>
          </Card>
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

    // Info
    infoCard: { marginBottom: SPACING.xl },
    infoRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
    infoText: {
      ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, flex: 1, lineHeight: 20,
    },
    formatRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md, alignItems: 'center' },
    formatLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.textMuted },
    formatExample: {
      ...FONTS.bold, fontSize: FONTS.size.sm, color: colors.primary,
      fontFamily: 'monospace', letterSpacing: 2,
    },

    // Input
    inputSection: { marginBottom: SPACING.lg },
    inputLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.text, marginBottom: SPACING.sm },
    inputContainer: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgInput,
      borderRadius: BORDER_RADIUS.md, borderWidth: 1.5, paddingHorizontal: SPACING.md,
      height: 56,
    },
    input: {
      flex: 1, ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.text,
      letterSpacing: 4, fontFamily: 'monospace', paddingVertical: 0,
    },
    inputStatus: {
      width: 36, height: 36, borderRadius: 10,
      justifyContent: 'center', alignItems: 'center',
    },
    inputHint: {
      ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: SPACING.xs,
    },

    // Verify Button
    verifyBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    },
    verifyBtnText: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.white },

    // Error
    errorContainer: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.danger + '15', borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md, marginTop: SPACING.lg,
    },
    errorText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.danger, flex: 1 },

    // Result
    resultCard: { marginTop: SPACING.xl },
    resultHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
    resultIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    resultInfo: { flex: 1 },
    resultTitle: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.text },
    resultSubtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, marginTop: 2 },
    resultDivider: { height: 1, backgroundColor: colors.divider, marginVertical: SPACING.lg },
    resultDetails: { gap: SPACING.md },
    resultRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    resultLabel: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted },
    resultValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text },
    statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.sm },
    statusBadgeText: { ...FONTS.bold, fontSize: FONTS.size.xs },

    // Continue
    continueBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md,
    },
    continueBtnText: { ...FONTS.bold, fontSize: FONTS.size.md, color: colors.white },
  });
