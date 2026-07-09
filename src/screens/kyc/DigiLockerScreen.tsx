/**
 * ============================================================================
 * Toroloom — DigiLocker Verification Screen
 * ============================================================================
 *
 * Allows users to fetch verified identity documents from DigiLocker
 * via OAuth consent flow. Integrates with Setu (Pine Labs) DigiLocker API.
 *
 * Flow:
 *   1. User taps "Connect DigiLocker"
 *   2. Backend returns OAuth authorization URL
 *   3. User completes consent in WebView
 *   4. Backend fetches documents (Aadhaar, PAN, Voter ID, etc.)
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { kycApi } from '../../services/api/kyc';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';
import type { DigiLockerDocument } from '../../types';

const DOCUMENT_TYPES = [
  { key: 'aadhaar', icon: 'finger-print', label: 'Aadhaar Card' },
  { key: 'pan', icon: 'card', label: 'PAN Card' },
  { key: 'voter', icon: 'ballot', label: 'Voter ID' },
  { key: 'driving', icon: 'car', label: 'Driving License' },
  { key: 'passport', icon: 'globe', label: 'Passport' },
  { key: 'income', icon: 'document-text', label: 'Income Documents' },
];

export default function DigiLockerScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [documents, setDocuments] = useState<DigiLockerDocument[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Get DigiLocker auth URL and open consent
  const handleConnect = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsConnecting(true);
    setError(null);

    try {
      const data = await kycApi.getDigiLockerAuth();

      // In production: open in WebView for DigiLocker OAuth consent.
      // For mock: show the consent flow UI directly.
      Alert.alert(
        'DigiLocker Consent',
        'You will be redirected to DigiLocker to authorize document sharing.\n\n' +
        'Toroloom will access:\n• Aadhaar Card\n• PAN Card\n• Voter ID\n• Address Proof\n\n' +
        'This is a mock — in production, the DigiLocker OAuth window will open here.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsConnecting(false) },
          { text: 'Authorize', onPress: () => handleFetchDocuments(data.referenceId) },
        ],
      );
    } catch (err: any) {
      const msg = err?.body?.error || err?.message || 'Failed to connect DigiLocker';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Step 2: Fetch documents after authorization
  const handleFetchDocuments = useCallback(async (referenceId: string) => {
    setIsFetching(true);
    setError(null);

    try {
      const data = await kycApi.fetchDigiLockerDocuments(referenceId);
      setDocuments(data.documents);
      setIsVerified(data.isVerified);

      if (data.isVerified) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      const msg = err?.body?.error || err?.message || 'Failed to fetch documents';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const handleContinue = useCallback(() => {
    if (route.params?.onVerified) {
      route.params.onVerified();
    }
    navigation.goBack();
  }, [navigation, route.params]);

  const getDocumentIcon = (docType: string): keyof typeof Ionicons.glyphMap => {
    switch (docType) {
      case 'identity': return 'finger-print';
      case 'address': return 'home';
      default: return 'document-text';
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>DigiLocker</Text>
      </View>

      {/* Info Card */}
      <Card style={styles.infoCard}>
        <View style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <Ionicons name="cloud-done" size={40} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Verify via DigiLocker</Text>
          <Text style={styles.heroDesc}>
            Fetch your verified government-issued documents directly from DigiLocker.
            No need to upload scanned copies.
          </Text>
        </View>

        <View style={styles.docTypesGrid}>
          {DOCUMENT_TYPES.map((doc, i) => (
            <View key={i} style={styles.docTypeItem}>
              <Ionicons name={doc.icon as keyof typeof Ionicons.glyphMap} size={16} color={colors.primary} />
              <Text style={styles.docTypeLabel}>{doc.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>Benefits</Text>
          {[
            'Instant document verification',
            'No manual upload required',
            'Government-certified documents',
            'One-time consent — auto-renewable',
          ].map((benefit, i) => (
            <View key={i} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Connect Button */}
      {!isVerified && (
        <AnimatedPressable
          onPress={handleConnect}
          disabled={isConnecting || isFetching}
          haptic="medium"
          scaleTo={0.97}
        >
          <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.connectBtn}>
            {isConnecting || isFetching ? (
              <Ionicons name="sync" size={22} color={colors.white} />
            ) : (
              <Ionicons name="cloud-download" size={22} color={colors.white} />
            )}
            <Text style={styles.connectBtnText}>
              {isConnecting ? 'Connecting...' : isFetching ? 'Fetching Documents...' : 'Connect DigiLocker'}
            </Text>
          </LinearGradient>
        </AnimatedPressable>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Fetched Documents */}
      {documents.length > 0 && (
        <Card style={styles.documentsCard}>
          <View style={styles.documentsHeader}>
            <View style={[styles.successIcon, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            </View>
            <Text style={styles.documentsTitle}>
              {documents.length} Document{documents.length > 1 ? 's' : ''} Fetched
            </Text>
          </View>

          <Text style={styles.documentSub}>
            Verified documents from DigiLocker are used for your KYC verification.
          </Text>

          {documents.map((doc, i) => (
            <View key={doc.id} style={[styles.documentItem, i < documents.length - 1 && styles.documentItemBorder]}>
              <View style={[styles.docIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name={getDocumentIcon(doc.documentType)} size={20} color={colors.primary} />
              </View>
              <View style={styles.docInfo}>
                <Text style={styles.docName}>{doc.name}</Text>
                <Text style={styles.docIssuer}>{doc.issuerName}</Text>
              </View>
              <View style={styles.docStatus}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              </View>
            </View>
          ))}

          {/* Continue */}
          <AnimatedPressable
            onPress={handleContinue}
            haptic="medium"
            scaleTo={0.97}
            style={{ marginTop: SPACING.xl }}
          >
            <LinearGradient colors={GRADIENTS.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.continueBtn}>
              <Text style={styles.continueBtnText}>Complete Verification</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.white} />
            </LinearGradient>
          </AnimatedPressable>
        </Card>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 20 },

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

    // Document Types
    docTypesGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm,
      marginBottom: SPACING.lg, justifyContent: 'center',
    },
    docTypeItem: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.bgInput, paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full,
    },
    docTypeLabel: { ...FONTS.medium, fontSize: FONTS.size.xs, color: colors.text },

    // Benefits
    benefitsSection: { backgroundColor: colors.bgInput, borderRadius: BORDER_RADIUS.md, padding: SPACING.md },
    benefitsTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text, marginBottom: SPACING.sm },
    benefitRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginVertical: 3 },
    benefitText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary },

    // Connect Button
    connectBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
      marginBottom: SPACING.lg,
    },
    connectBtnText: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.white },

    // Error
    errorContainer: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.danger + '15', borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md, marginBottom: SPACING.lg,
    },
    errorText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.danger, flex: 1 },

    // Documents
    documentsCard: { marginTop: SPACING.md },
    documentsHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
    successIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    documentsTitle: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.text },
    documentSub: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, marginBottom: SPACING.lg },
    documentItem: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      paddingVertical: SPACING.md,
    },
    documentItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
    docIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    docInfo: { flex: 1 },
    docName: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text },
    docIssuer: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textSecondary, marginTop: 1 },
    docStatus: {},

    // Continue
    continueBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md,
    },
    continueBtnText: { ...FONTS.bold, fontSize: FONTS.size.md, color: colors.white },
  });
