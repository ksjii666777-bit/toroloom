// ============================================================================
// Toroloom — Certificate Screen
// Displays course completion certificate with share/view PDF options
// ============================================================================

import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
  Platform, Share, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { triggerHaptic, ImpactFeedbackStyle } from '../../utils/haptics';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../../context/ThemeContext';
import { useEducationStore } from '../../store/educationStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import type { CourseCertificate } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CertificateScreen({ route, navigation }: any) {
  const { courseId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { getCertificateForCourse, generateCertificate, isGeneratingCertificate } = useEducationStore();

  const [generatedPdfUri, setGeneratedPdfUri] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const cert = getCertificateForCourse(courseId);

  // If certificate already exists and has a PDF URI, use it
  const pdfUri = generatedPdfUri || cert?.pdfUri || null;

  const handleGeneratePDF = useCallback(async () => {
    triggerHaptic(ImpactFeedbackStyle.Medium);
    // First time — generate certificate
    if (!cert) {
      const result = await generateCertificate(courseId);
      if (result?.pdfUri) {
        setGeneratedPdfUri(result.pdfUri);
      } else {
        Alert.alert(
          'Certificate Generated',
          'Your certificate has been created! PDF generation will be available shortly.',
          [{ text: 'Great!' }]
        );
      }
      return;
    }

    // Generate PDF if not already present
    if (!cert.pdfUri) {
      const { generateCertificatePDF } = await import('../../utils/certificateGenerator');
      const uri = await generateCertificatePDF(cert);
      if (uri) {
        setGeneratedPdfUri(uri);
      }
    }
  }, [cert, courseId, generateCertificate]);

  const handleShare = useCallback(async () => {
    if (!pdfUri) {
      await handleGeneratePDF();
      // After generation, share
      const updatedCert = useEducationStore.getState().getCertificateForCourse(courseId);
      const finalUri = updatedCert?.pdfUri || null;
      if (!finalUri) {
        Alert.alert('Error', 'Could not generate certificate PDF. Please try again.');
        return;
      }
      await doShare(finalUri);
      return;
    }
    await doShare(pdfUri);
  }, [pdfUri, handleGeneratePDF, courseId]);

  const doShare = useCallback(async (uri: string) => {
    setIsSharing(true);
    try {
      await Share.share({
        url: Platform.OS === 'ios' ? uri : `file://${uri}`,
        message: cert
          ? `I just completed "${cert.courseTitle}" on Toroloom! 🎓 Check it out!`
          : 'I earned a certificate on Toroloom! 🎓',
        title: 'Toroloom Certificate',
      });
    } catch {
      // User cancelled share
    } finally {
      setIsSharing(false);
    }
  }, [cert]);

  const gradeConfig = useMemo(() => {
    if (!cert) return { label: 'Completed', color: '#6C63FF', gradient: GRADIENTS.primary, icon: 'checkmark-circle' as const };
    switch (cert.grade) {
      case 'A': return { label: 'Distinction', color: '#FFD700', gradient: ['#FFD700', '#FFA000'] as [string, string], icon: 'trophy' as const };
      case 'B': return { label: 'Merit', color: '#C0C0C0', gradient: ['#C0C0C0', '#9E9E9E'] as [string, string], icon: 'star' as const };
      case 'C': return { label: 'Completed', color: '#CD7F32', gradient: ['#CD7F32', '#8B4513'] as [string, string], icon: 'checkmark-circle' as const };
    }
  }, [cert]);

  if (!cert && !isGeneratingCertificate) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.text }}>Certificate not found</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={handleGeneratePDF}>
          <Text style={styles.actionBtnText}>Generate Certificate</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Certificate</Text>
          <View style={styles.backBtn} />
        </View>

        {/* Certificate Card */}
        <View style={styles.certContainer}>
          <LinearGradient colors={['#1A1A3E', '#222255', '#1A1A3E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.certCard}>
            {/* Corner decorations */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            <Text style={styles.certTitle}>Certificate</Text>
            <View style={styles.decoLine} />
            <Text style={styles.certSubtitle}>of Completion</Text>

            <View style={styles.awardedRow}>
              <Text style={styles.awardedText}>This is to certify that</Text>
            </View>

            <Text style={styles.recipientName}>
              {cert?.userName || 'Student'}
            </Text>

            <View style={styles.completedRow}>
              <Text style={styles.completedLabel}>has successfully completed the course</Text>
            </View>

            <Text style={styles.courseName}>{cert?.courseTitle || ''}</Text>

            {/* Grade badge */}
            <View style={[styles.gradeBadge, { backgroundColor: gradeConfig.color + '22', borderColor: gradeConfig.color + '44' }]}>
              <Ionicons name={gradeConfig.icon} size={16} color={gradeConfig.color} />
              <Text style={[styles.gradeText, { color: gradeConfig.color }]}>{gradeConfig.label}</Text>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{cert?.completedLessons}/{cert?.totalLessons}</Text>
                <Text style={styles.statLabel}>Lessons</Text>
              </View>
              {cert?.quizPercent !== undefined && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{cert.quizPercent}%</Text>
                    <Text style={styles.statLabel}>Quiz Score</Text>
                  </View>
                </>
              )}
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {cert ? new Date(cert.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                </Text>
                <Text style={styles.statLabel}>Issued On</Text>
              </View>
            </View>

            {/* Serial number */}
            <Text style={styles.serialNumber}>Serial #{cert?.serialNumber || ''}</Text>

            {/* Loading overlay */}
            {isGeneratingCertificate && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#6C63FF" />
                <Text style={styles.loadingText}>Generating Certificate...</Text>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* Grade key */}
        <View style={styles.gradeKey}>
          <Text style={[styles.gradeKeyTitle, { color: colors.text }]}>Grade Scale</Text>
          <View style={styles.gradeKeyRow}>
            <View style={[styles.gradeDot, { backgroundColor: '#FFD700' }]} />
            <Text style={[styles.gradeKeyLabel, { color: colors.textSecondary }]}>A (≥90%) — Distinction</Text>
          </View>
          <View style={styles.gradeKeyRow}>
            <View style={[styles.gradeDot, { backgroundColor: '#C0C0C0' }]} />
            <Text style={[styles.gradeKeyLabel, { color: colors.textSecondary }]}>B (≥75%) — Merit</Text>
          </View>
          <View style={styles.gradeKeyRow}>
            <View style={[styles.gradeDot, { backgroundColor: '#CD7F32' }]} />
            <Text style={[styles.gradeKeyLabel, { color: colors.textSecondary }]}>C (≥60%) — Completed</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={handleGeneratePDF}
            disabled={isGeneratingCertificate}
          >
            <Ionicons name="download-outline" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>
              {pdfUri ? 'Regenerate PDF' : isGeneratingCertificate ? 'Generating...' : 'Generate PDF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border }]}
            onPress={handleShare}
            disabled={isSharing || !pdfUri}
          >
            <Ionicons name="share-outline" size={20} color={colors.text} />
            <Text style={[styles.actionBtnText, { color: colors.text }]}>
              {isSharing ? 'Sharing...' : 'Share Certificate'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    marginBottom: SPACING.xl,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  // ── Certificate Card ──
  certContainer: {
    marginBottom: SPACING.lg,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  certCard: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#6C63FF',
    padding: SPACING.xl,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    minHeight: 420,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#6C63FF',
  },
  cornerTL: { top: 12, left: 12, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 8 },
  cornerTR: { top: 12, right: 12, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 8 },
  cornerBL: { bottom: 12, left: 12, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 12, right: 12, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 8 },
  certTitle: {
    fontFamily: 'Georgia',
    fontSize: 32,
    color: '#FFD700',
    letterSpacing: 3,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 16,
  },
  decoLine: {
    width: '50%',
    height: 1,
    backgroundColor: 'rgba(108, 99, 255, 0.4)',
    marginVertical: 8,
  },
  certSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  awardedRow: {
    marginBottom: 4,
  },
  awardedText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  recipientName: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'Georgia',
    marginBottom: 4,
  },
  completedRow: {
    marginBottom: 8,
  },
  completedLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  courseName: {
    fontSize: 18,
    color: '#6C63FF',
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    lineHeight: 24,
  },
  gradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  gradeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  serialNumber: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1,
    marginTop: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // ── Grade Key ──
  gradeKey: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: 8,
  },
  gradeKeyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    marginBottom: 4,
  },
  gradeKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gradeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  gradeKeyLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
  },
  // ── Actions ──
  actions: {
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.md,
  },
  actionBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#FFF',
  },
});
