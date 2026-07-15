/**
 * Toroloom — Quiz Result Screen
 * Shows detailed quiz result with score breakdown, answer review, grade, and actions
 */
import React, { useMemo, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useEducationStore } from '../../store/educationStore';
import { useGamificationStore } from '../../store/gamificationStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { mockLessons } from '../../constants/mockData';
import type { QuizResult } from '../../types';

interface QuizResultScreenProps {
  route: {
    params: {
      result: QuizResult;
      lessonId: string;
      courseId: string;
    };
  };
  navigation: any;
}

export default function QuizResultScreen({ route, navigation }: QuizResultScreenProps) {
  const { result, lessonId, courseId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { recordQuizAttempt, getQuizAttempts, courses } = useEducationStore();
  const { addXp } = useGamificationStore();

  const [showReview, setShowReview] = useState(false);

  const passXp = 30;
  const attemptXp = 10;

  // Record attempt on mount
  React.useEffect(() => {
    recordQuizAttempt(lessonId, result);
    if (result.passed) {
      addXp(passXp);
    } else {
      addXp(attemptXp);
    }
  }, []);

  const allAttempts = getQuizAttempts(lessonId);
  const bestAttempt = allAttempts.reduce((best, curr) =>
    curr.percentage > best.percentage ? curr : best,
    result
  );
  const isBest = bestAttempt.quizId === result.quizId && bestAttempt.percentage === result.percentage;

  const gradeLabel = result.percentage >= 90 ? 'A — Distinction' :
    result.percentage >= 75 ? 'B — Merit' :
    result.percentage >= 60 ? 'C — Pass' : 'Needs Improvement';

  const gradeColor = result.percentage >= 90 ? '#FFD700' :
    result.percentage >= 75 ? '#C0C0C0' :
    result.percentage >= 60 ? '#CD7F32' : '#FF5252';

  const handleRetry = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleViewCertificate = useCallback(() => {
    navigation.navigate('Certificate', { courseId });
  }, [navigation, courseId]);

  const lesson = mockLessons.find(l => l.id === lessonId);
  const course = courses.find(c => c.id === courseId);
  const lessonQuizQuestions = lesson?.quiz?.questions || [];

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Quiz Results</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Result Hero */}
        <LinearGradient
          colors={result.passed ? ['#00C853', '#009624'] : ['#FF5252', '#D50000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroIconWrap}>
            <Ionicons
              name={result.passed ? 'checkmark-circle' : 'close-circle'}
              size={56}
              color="#FFF"
            />
          </View>
          <Text style={styles.heroTitle}>
            {result.passed ? '🎉 Congratulations!' : 'Keep Going!'}
          </Text>
          <Text style={styles.heroSubtitle}>{result.quizTitle}</Text>
          <Text style={styles.heroDesc}>
            {result.passed
              ? `You passed with ${result.percentage}%! ${isBest ? 'This is your best score! 🏆' : ''}`
              : `You scored ${result.percentage}% — passing is 60%. Try again!`}
          </Text>
        </LinearGradient>

        {/* Score Card */}
        <View style={[styles.scoreCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {/* Big Score */}
          <View style={styles.scoreRow}>
            <View style={styles.scoreMain}>
              <View style={[styles.scoreCircle, { borderColor: gradeColor + '40' }]}>
                <Text style={[styles.scoreValue, { color: gradeColor }]}>{result.percentage}%</Text>
              </View>
              <View style={styles.scoreInfo}>
                <Text style={[styles.gradeLabel, { color: gradeColor }]}>{gradeLabel}</Text>
                {result.passed && (
                  <View style={styles.passBadge}>
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                    <Text style={styles.passBadgeText}>PASSED</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="checkmark-circle" size={18} color="#00C853" />
              <Text style={[styles.statValue, { color: colors.text }]}>{result.correctAnswers}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Correct</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.statItem}>
              <Ionicons name="close-circle" size={18} color="#FF5252" />
              <Text style={[styles.statValue, { color: colors.text }]}>{result.wrongAnswers}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Wrong</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.statItem}>
              <Ionicons name="help-circle" size={18} color="#FFC107" />
              <Text style={[styles.statValue, { color: colors.text }]}>{result.unanswered}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Skipped</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={18} color="#6C63FF" />
              <Text style={[styles.statValue, { color: colors.text }]}>{formatTime(result.timeTaken)}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Time</Text>
            </View>
          </View>
        </View>

        {/* XP Earned */}
        <View style={[styles.xpCard, {
          backgroundColor: result.passed ? '#00C85315' : '#FFC10715',
          borderColor: result.passed ? '#00C85340' : '#FFC10740',
        }]}>
          <Ionicons name="flash" size={24} color={result.passed ? '#00C853' : '#FFC107'} />
          <View style={styles.xpInfo}>
            <Text style={[styles.xpTitle, { color: result.passed ? '#00C853' : '#FFC107' }]}>
              {result.passed ? `+${passXp} XP Earned!` : `+${attemptXp} XP for Attempt`}
            </Text>
            <Text style={[styles.xpDesc, { color: colors.textSecondary }]}>
              {result.passed
                ? 'Great job completing the quiz! Keep learning to earn more XP.'
                : 'Every attempt is a step forward. Review your answers and try again!'}
            </Text>
          </View>
        </View>

        {/* Attempt Info */}
        {allAttempts.length > 1 && (
          <View style={[styles.attemptCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="repeat" size={18} color={colors.textMuted} />
            <Text style={[styles.attemptText, { color: colors.textSecondary }]}>
              Attempt #{allAttempts.length} · Best: {bestAttempt.percentage}%
            </Text>
          </View>
        )}

        {/* Certificate Option */}
        {result.passed && course && (
          <AnimatedPressable
            onPress={handleViewCertificate}
            scaleTo={0.97}
            haptic="medium"
            style={{ marginBottom: SPACING.lg }}
          >
            <LinearGradient colors={GRADIENTS.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.certBtn}>
              <Ionicons name="ribbon" size={22} color="#FFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.certBtnTitle}>View Course Certificate</Text>
                <Text style={styles.certBtnSub}>See your progress & earn your certificate</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </AnimatedPressable>
        )}

        {/* Review Toggle */}
        <Pressable
          style={[styles.reviewToggle, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => setShowReview(prev => !prev)}
        >
          <Ionicons name="list-outline" size={18} color={colors.text} />
          <Text style={[styles.reviewToggleText, { color: colors.text }]}>
            {showReview ? 'Hide' : 'Review'} All Answers
          </Text>
          <Ionicons
            name={showReview ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </Pressable>

        {/* Answer Review */}
        {showReview && result.correctAnswerMap && (
          <View style={styles.reviewContainer}>
            {lessonQuizQuestions.map((q, idx) => {
              const userAns = result.answers[q.id];
              const isCorrect = userAns === q.correctAnswer;
              const isSkipped = userAns === undefined;

              return (
                <View
                  key={q.id}
                  style={[styles.reviewCard, {
                    backgroundColor: colors.bgCard,
                    borderColor: isCorrect ? '#00C85340' : isSkipped ? '#FFC10740' : '#FF525240',
                  }]}
                >
                  <View style={styles.reviewHeader}>
                    <Text style={[styles.reviewQNum, { color: colors.textMuted }]}>Q{idx + 1}</Text>
                    <View style={[styles.reviewBadge, {
                      backgroundColor: isCorrect ? '#00C85320' : isSkipped ? '#FFC10720' : '#FF525220',
                    }]}>
                      <Ionicons
                        name={isCorrect ? 'checkmark-circle' : isSkipped ? 'help-circle' : 'close-circle'}
                        size={14}
                        color={isCorrect ? '#00C853' : isSkipped ? '#FFC107' : '#FF5252'}
                      />
                      <Text style={[styles.reviewBadgeText, {
                        color: isCorrect ? '#00C853' : isSkipped ? '#FFC107' : '#FF5252',
                      }]}>
                        {isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Wrong'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.reviewQuestion, { color: colors.text }]}>{q.question}</Text>

                  {q.options.map((opt, oIdx) => {
                    const isSelected = userAns === oIdx;
                    const isRightAns = oIdx === q.correctAnswer;
                    let optStyle = { backgroundColor: 'transparent', borderColor: colors.border };
                    let optTextStyle = { color: colors.textMuted };

                    if (isRightAns) {
                      optStyle = { backgroundColor: '#00C85315', borderColor: '#00C853' };
                      optTextStyle = { color: '#00C853' };
                    } else if (isSelected && !isRightAns) {
                      optStyle = { backgroundColor: '#FF525215', borderColor: '#FF5252' };
                      optTextStyle = { color: '#FF5252' };
                    }

                    return (
                      <View key={oIdx} style={[styles.reviewOption, optStyle, { borderColor: optStyle.borderColor }]}>
                        <Text style={[styles.reviewOptionText, optTextStyle]}>{opt}</Text>
                        {isRightAns && <Ionicons name="checkmark-circle" size={16} color="#00C853" />}
                        {isSelected && !isRightAns && <Ionicons name="close-circle" size={16} color="#FF5252" />}
                      </View>
                    );
                  })}

                  <View style={[styles.explanationBox, { backgroundColor: '#6C63FF12' }]}>
                    <Ionicons name="information-circle" size={16} color="#6C63FF" />
                    <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
                      {q.explanation}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {!result.passed && (
            <AnimatedPressable
              onPress={handleRetry}
              scaleTo={0.97}
              haptic="medium"
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="refresh" size={20} color="#FFF" />
              <Text style={styles.actionBtnText}>Try Again</Text>
            </AnimatedPressable>
          )}
          <AnimatedPressable
            onPress={() => navigation.goBack()}
            scaleTo={0.97}
            haptic="light"
            style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Back to Lesson</Text>
          </AnimatedPressable>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    marginBottom: SPACING.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
  },

  // Hero
  hero: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  heroIconWrap: { marginBottom: SPACING.sm },
  heroTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: '#FFF',
    marginBottom: 4,
  },
  heroSubtitle: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: SPACING.md,
  },
  heroDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.xl,
  },

  // Score Card
  scoreCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  scoreRow: {
    marginBottom: SPACING.lg,
  },
  scoreMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xl,
  },
  scoreCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.xxl,
  },
  scoreInfo: {
    flex: 1,
    gap: SPACING.sm,
  },
  gradeLabel: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  passBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00C853',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    alignSelf: 'flex-start',
  },
  passBadgeText: {
    ...FONTS.bold,
    fontSize: FONTS.size.xs,
    color: '#FFF',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
  statLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  statDivider: {
    width: 1,
    height: 32,
  },

  // XP Card
  xpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  xpInfo: { flex: 1 },
  xpTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
  },
  xpDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    marginTop: 2,
    lineHeight: 16,
  },

  // Attempt Card
  attemptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  attemptText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },

  // Certificate Button
  certBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  certBtnTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#FFF',
  },
  certBtnSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },

  // Review
  reviewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  reviewToggleText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    flex: 1,
  },
  reviewContainer: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  reviewCard: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  reviewQNum: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  reviewBadgeText: {
    ...FONTS.medium,
    fontSize: 10,
  },
  reviewQuestion: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  reviewOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    marginBottom: 4,
  },
  reviewOptionText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    flex: 1,
  },
  explanationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
  },
  explanationText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    flex: 1,
    lineHeight: 18,
  },

  // Actions
  actions: {
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  actionBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#FFF',
  },
});
