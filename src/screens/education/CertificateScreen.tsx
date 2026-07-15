/**
 * Toroloom — Certificate Screen
 * Shows all earned course completion certificates with PDF generation & sharing.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useEducationStore } from '../../store/educationStore';
import { useAuthStore } from '../../store/authStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatDate } from '../../utils/formatters';
import type { CourseCertificate } from '../../types';

const gradeConfig: Record<CourseCertificate['grade'], { label: string; color: string; bg: string }> = {
  A: { label: 'Distinction', color: '#FFD700', bg: '#FFD70015' },
  B: { label: 'Merit', color: '#C0C0C0', bg: '#C0C0C015' },
  C: { label: 'Completed', color: '#CD7F32', bg: '#CD7F3215' },
};

export default function CertificateScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { certificates, generateCertificate, isGeneratingCertificate, courses } = useEducationStore();
  const userName = useAuthStore(s => s.user?.name) || 'Student';

  const [selectedCert, setSelectedCert] = useState<string | null>(null); // cert ID
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [pdfUris, setPdfUris] = useState<Record<string, string>>({});

  // Courses eligible for certificate (complete but no cert yet)
  const eligible = useMemo(() => {
    const { isCourseComplete } = useEducationStore.getState();
    return courses.filter(c => {
      if (certificates.find(cert => cert.courseId === c.id)) return false;
      return isCourseComplete(c.id);
    });
  }, [courses, certificates]);

  // Handle incoming route param to auto-generate for a specific course
  React.useEffect(() => {
    const autoCourseId = route?.params?.courseId as string | undefined;
    if (autoCourseId) {
      const existing = certificates.find(c => c.courseId === autoCourseId);
      if (!existing) {
        handleGenerate(autoCourseId);
      }
    }
  }, [route?.params?.courseId]);

  const handleGenerate = useCallback(async (courseId: string) => {
    const cert = await generateCertificate(courseId);
    if (cert) {
      setSelectedCert(cert.id);
      Alert.alert(
        '🎉 Certificate Generated!',
        `Your certificate for "${cert.courseTitle}" is ready. You can view or share it as a PDF.`,
        [{ text: 'View', onPress: () => setSelectedCert(cert.id) }]
      );
    } else {
      Alert.alert('Error', 'Could not generate certificate. Make sure the course is complete.');
    }
  }, [generateCertificate, userName]);

  const handleSharePDF = useCallback(async (cert: CourseCertificate) => {
    let pdfUri = cert.pdfUri;

    if (!pdfUri) {
      // Generate PDF on demand if not already generated
      setSharingId(cert.id);
      const { generateCertificatePDF } = await import('../../utils/certificateGenerator');
      const uri = await generateCertificatePDF(cert);
      setSharingId(null);
      if (!uri) {
        Alert.alert('Error', 'Could not generate PDF. Please try again.');
        return;
      }
      setPdfUris(prev => ({ ...prev, [cert.id]: uri }));
      pdfUri = uri; // Use the generated URI directly (avoids stale closure)
    }

    try {
      await Share.share({
        title: `${cert.courseTitle} — Toroloom Certificate`,
        message: `I earned my "${cert.courseTitle}" completion certificate on Toroloom! 🎉\n\nSerial: ${cert.serialNumber}`,
        url: Platform.OS === 'ios' ? pdfUri : undefined,
      });
    } catch {
      // User cancelled share
    }
  }, []);

  const selectedCertData = selectedCert
    ? certificates.find(c => c.id === selectedCert)
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => {
          if (selectedCert) {
            setSelectedCert(null);
          } else {
            nav.goBack();
          }
        }} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
          <Ionicons name={selectedCert ? 'close' : 'arrow-back'} size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {selectedCert ? 'Certificate' : 'Certificates'}
        </Text>
        {certificates.length > 0 && !selectedCert && (
          <Text style={[styles.headerCount, { color: colors.textMuted }]}>
            {certificates.length}
          </Text>
        )}
        {!selectedCert && <View style={{ width: 40 }} />}
      </View>

      {selectedCertData ? (
        /* ── Certificate Detail / Preview ── */
        <CertificatePreview
          cert={selectedCertData}
          colors={colors}
          onShare={() => handleSharePDF(selectedCertData)}
          onBack={() => setSelectedCert(null)}
          sharing={sharingId === selectedCertData.id}
        />
      ) : (
        /* ── Certificate List ── */
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {certificates.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconRing, { borderColor: colors.border }]}>
                <Ionicons name="ribbon-outline" size={48} color={colors.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Certificates Yet</Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                Complete all lessons in a course to earn your completion certificate.
              </Text>

              {/* Eligible courses — computed in component body */}
              {eligible.length > 0 && (
                <View style={{ width: '100%', marginTop: SPACING.xl }}>
                  <Text style={[styles.eligibleTitle, { color: colors.text }]}>
                    Courses Ready for Certificate
                  </Text>
                  {eligible.map(course => (
                    <TouchableOpacity
                      key={course.id}
                      style={[styles.eligibleCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                      onPress={() => handleGenerate(course.id)}
                    >
                      <View style={styles.eligibleCardLeft}>
                        <Text style={styles.eligibleIcon}>{course.thumbnail}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.eligibleName, { color: colors.text }]}>{course.title}</Text>
                          <Text style={[styles.eligibleLabel, { color: colors.textMuted }]}>
                            {course.lessons} lessons · {course.duration}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="ribbon-outline" size={22} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Link to courses */}
              <TouchableOpacity
                style={[styles.browseBtn, { backgroundColor: colors.primary }]}
                onPress={() => nav.navigate('Learn' as never)}
              >
                <Ionicons name="school-outline" size={18} color="#FFF" />
                <Text style={styles.browseBtnText}>Browse Courses</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Certificate Cards */
            <View style={styles.certList}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Your Certificates
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                {certificates.length} course{certificates.length !== 1 ? 's' : ''} completed
              </Text>

              {certificates.map((cert, index) => {
                const grade = gradeConfig[cert.grade];
                return (
                  <TouchableOpacity
                    key={cert.id}
                    style={[styles.certCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                    onPress={() => setSelectedCert(cert.id)}
                    activeOpacity={0.7}
                  >
                    {/* Decorative top accent */}
                    <LinearGradient
                      colors={[grade.color + '60', grade.color + '10']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.certAccent}
                    />

                    <View style={styles.certCardContent}>
                      {/* Icon & Grade */}
                      <View style={[styles.certIconBox, { backgroundColor: grade.bg }]}>
                        <Ionicons name="ribbon" size={28} color={grade.color} />
                      </View>

                      {/* Info */}
                      <View style={styles.certInfo}>
                        <Text style={[styles.certCourseTitle, { color: colors.text }]} numberOfLines={2}>
                          {cert.courseTitle}
                        </Text>
                        <View style={styles.certMeta}>
                          <View style={[styles.gradeBadge, { backgroundColor: grade.bg, borderColor: grade.color + '40' }]}>
                            <Text style={[styles.gradeText, { color: grade.color }]}>{grade.label}</Text>
                          </View>
                          <Text style={[styles.certDate, { color: colors.textMuted }]}>
                            {formatDate(cert.issuedAt)}
                          </Text>
                        </View>
                        <View style={styles.certStats}>
                          <Text style={[styles.certStatText, { color: colors.textMuted }]}>
                            {cert.completedLessons}/{cert.totalLessons} lessons
                          </Text>
                          {cert.quizPercent !== undefined && (
                            <>
                              <Text style={[styles.certStatDivider, { color: colors.divider }]}>·</Text>
                              <Text style={[styles.certStatText, { color: colors.textMuted }]}>
                                Quiz: {cert.quizPercent}%
                              </Text>
                            </>
                          )}
                        </View>
                      </View>

                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </View>

                    {/* Footer serial */}
                    <View style={[styles.certFooter, { borderTopColor: colors.divider }]}>
                      <Ionicons name="finger-print" size={12} color={colors.textMuted} />
                      <Text style={[styles.serialText, { color: colors.textMuted }]}>
                        #{cert.serialNumber}
                      </Text>
                      <View style={{ flex: 1 }} />
                      {/* Quick share */}
                      <TouchableOpacity
                        style={[styles.quickShareBtn, { backgroundColor: colors.primary + '15' }]}
                        onPress={() => handleSharePDF(cert)}
                      >
                        <Ionicons name="share-outline" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Lifetime stats */}
              <View style={[styles.statsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.statsTitle, { color: colors.text }]}>Learning Stats</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.primary }]}>{certificates.length}</Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>Certificates</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.primary }]}>
                      {certificates.reduce((sum, c) => sum + c.completedLessons, 0)}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>Lessons Done</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.accent }]}>
                      {certificates.filter(c => c.grade === 'A').length}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>Distinctions</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Loading overlay */}
          {isGeneratingCertificate && (
            <View style={styles.generatingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.generatingText, { color: colors.text }]}>Generating Certificate...</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Certificate Preview (Full Certificate View) ─────────────────────────

function CertificatePreview({
  cert,
  colors,
  onShare,
  onBack,
  sharing,
}: {
  cert: CourseCertificate;
  colors: any;
  onShare: () => void;
  onBack: () => void;
  sharing: boolean;
}) {
  const grade = gradeConfig[cert.grade];
  const gradeLabel = cert.grade === 'A' ? 'with Distinction' : cert.grade === 'B' ? 'with Merit' : '';
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.previewScroll, { backgroundColor: colors.bg }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Certificate Card */}
      <View style={[styles.previewCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
        {/* Corner Decorations */}
        <View style={[styles.previewCorner, styles.previewCornerTL, { borderTopColor: colors.primary, borderLeftColor: colors.primary }]} />
        <View style={[styles.previewCorner, styles.previewCornerTR, { borderTopColor: colors.primary, borderRightColor: colors.primary }]} />
        <View style={[styles.previewCorner, styles.previewCornerBL, { borderBottomColor: colors.primary, borderLeftColor: colors.primary }]} />
        <View style={[styles.previewCorner, styles.previewCornerBR, { borderBottomColor: colors.primary, borderRightColor: colors.primary }]} />

        <Text style={styles.previewTitle}>Certificate</Text>
        <View style={[styles.previewLine, { backgroundColor: colors.primary + '60' }]} />
        <Text style={styles.previewSubtitle}>of Completion</Text>
        <View style={[styles.previewDivider, { backgroundColor: colors.primary + '30' }]} />

        <Text style={[styles.previewAwarded, { color: colors.textMuted }]}>This is to certify that</Text>
        <Text style={[styles.previewName, { color: colors.text }]}>{cert.userName}</Text>

        <Text style={[styles.previewAwarded, { color: colors.textMuted }]}>has successfully completed the course</Text>
        <Text style={[styles.previewCourse, { color: colors.primary }]}>{cert.courseTitle}</Text>

        <View style={[styles.previewGradeBadge, { backgroundColor: grade.bg, borderColor: grade.color + '40' }]}>
          <Ionicons name="ribbon" size={14} color={grade.color} />
          <Text style={[styles.previewGradeText, { color: grade.color }]}>{gradeLabel || 'Completed'}</Text>
        </View>

        <View style={styles.previewStats}>
          <View style={styles.previewStatItem}>
            <Text style={[styles.previewStatValue, { color: colors.text }]}>
              {cert.completedLessons}/{cert.totalLessons}
            </Text>
            <Text style={[styles.previewStatLabel, { color: colors.textMuted }]}>Lessons</Text>
          </View>
          <View style={[styles.previewStatDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.previewStatItem}>
            <Text style={[styles.previewStatValue, { color: colors.text }]}>
              {formatDate(cert.issuedAt)}
            </Text>
            <Text style={[styles.previewStatLabel, { color: colors.textMuted }]}>Issued On</Text>
          </View>
          {cert.quizPercent !== undefined && (
            <>
              <View style={[styles.previewStatDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.previewStatItem}>
                <Text style={[styles.previewStatValue, { color: colors.text }]}>
                  {cert.quizPercent}%
                </Text>
                <Text style={[styles.previewStatLabel, { color: colors.textMuted }]}>Quiz Score</Text>
              </View>
            </>
          )}
        </View>

        <Text style={[styles.previewSerial, { color: colors.textMuted }]}>
          Serial #{cert.serialNumber}
        </Text>
        <Text style={[styles.previewFooterText, { color: colors.textMuted }]}>
          Toroloom — AI-Powered Trading & Investment Platform
        </Text>
      </View>

      {/* PDF Status */}
      {cert.pdfUri ? (
        <View style={[styles.pdfStatusCard, { backgroundColor: colors.success + '15', borderColor: colors.success + '30' }]}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={[styles.pdfStatusText, { color: colors.success }]}>PDF generated</Text>
        </View>
      ) : (
        <View style={[styles.pdfStatusCard, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '30' }]}>
          <Ionicons name="alert-circle" size={18} color={colors.warning} />
          <Text style={[styles.pdfStatusText, { color: colors.warning }]}>PDF not yet generated</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.previewActions}>
        <TouchableOpacity
          style={[styles.previewActionBtn, { backgroundColor: colors.primary }]}
          onPress={onShare}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="share-outline" size={20} color="#FFF" />
              <Text style={styles.previewActionText}>
                {cert.pdfUri ? 'Share PDF' : 'Generate & Share PDF'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {cert.pdfUri && Platform.OS === 'android' && (
          <TouchableOpacity
            style={[styles.previewActionBtn, styles.previewActionOutline, { borderColor: colors.border }]}
            onPress={async () => {
              try {
                await Linking.openURL(cert.pdfUri!);
              } catch {
                Alert.alert('Error', 'Could not open PDF file.');
              }
            }}
          >
            <Ionicons name="document-text-outline" size={20} color={colors.text} />
            <Text style={[styles.previewActionText, { color: colors.text }]}>Open PDF</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.size.xl,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  headerCount: {
    fontSize: FONTS.size.lg,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.lg, gap: 16 },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: SPACING.md },
  emptyIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: FONTS.size.xl,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
  },
  emptyDesc: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.regular.fontFamily,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.xl,
  },
  eligibleTitle: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
    marginBottom: SPACING.md,
  },
  eligibleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  eligibleCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  eligibleIcon: { fontSize: 24 },
  eligibleName: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
  },
  eligibleLabel: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    marginTop: 2,
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.md,
  },
  browseBtnText: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
    color: '#FFF',
  },

  // List
  certList: { gap: 16 },
  sectionTitle: {
    fontSize: FONTS.size.xl,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
  },
  sectionSubtitle: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.regular.fontFamily,
    marginTop: -12,
  },

  // Certificate Card
  certCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  certAccent: {
    height: 4,
    width: '100%',
  },
  certCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  certIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  certInfo: { flex: 1 },
  certCourseTitle: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  certMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 6,
  },
  gradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  gradeText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  certDate: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
  },
  certStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  certStatText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
  },
  certStatDivider: {
    fontSize: FONTS.size.sm,
  },
  certFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  serialText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    letterSpacing: 0.5,
  },
  quickShareBtn: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stats
  statsCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  statsTitle: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
    marginBottom: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: {
    fontSize: FONTS.size.xxl,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
  },
  statLabel: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 36,
  },

  // Generating overlay
  generatingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  generatingText: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
  },

  // ── Preview ──
  previewScroll: { flex: 1 },
  previewCard: {
    margin: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
    position: 'relative',
  },
  previewCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
  },
  previewCornerTL: { top: 12, left: 12, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 8 },
  previewCornerTR: { top: 12, right: 12, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 8 },
  previewCornerBL: { bottom: 12, left: 12, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 8 },
  previewCornerBR: { bottom: 12, right: 12, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 8 },
  previewTitle: {
    fontSize: 32,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
    color: '#FFD700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 20,
  },
  previewLine: {
    width: 60,
    height: 1,
    marginVertical: 6,
  },
  previewSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  previewDivider: {
    width: '50%',
    height: 1,
    marginVertical: 8,
  },
  previewAwarded: {
    fontSize: 13,
    fontFamily: FONTS.regular.fontFamily,
    letterSpacing: 1,
    marginTop: 6,
  },
  previewName: {
    fontSize: 28,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
    marginVertical: 4,
  },
  previewCourse: {
    fontSize: 18,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 24,
    marginVertical: 4,
  },
  previewGradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginVertical: SPACING.md,
  },
  previewGradeText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
    letterSpacing: 1,
  },
  previewStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  previewStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  previewStatValue: {
    fontSize: 16,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
    textAlign: 'center',
  },
  previewStatLabel: {
    fontSize: 9,
    fontFamily: FONTS.regular.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  previewStatDivider: {
    width: 1,
    height: 28,
  },
  previewSerial: {
    fontSize: 9,
    fontFamily: FONTS.regular.fontFamily,
    letterSpacing: 1,
    marginTop: SPACING.lg,
  },
  previewFooterText: {
    fontSize: 10,
    fontFamily: FONTS.regular.fontFamily,
    letterSpacing: 1,
    marginTop: 8,
  },

  // PDF Status
  pdfStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  pdfStatusText: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
  },

  // Preview Actions
  previewActions: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  previewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  previewActionOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  previewActionText: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
    color: '#FFF',
  },
});
