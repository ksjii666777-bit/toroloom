/**
 * Toroloom — Reusable Quiz Component
 * Features: timer, progress bar, auto-grading, answer review, explanations, micro-animations
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Animated,
  Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../ui/AnimatedPressable';
import type { Quiz, QuizQuestion, QuizResult } from '../../types';

const { width } = Dimensions.get('window');
const OPTION_HEIGHT = 52;

interface QuizComponentProps {
  quiz: Quiz;
  onComplete: (result: QuizResult) => void;
  /** Optional timer in minutes. 0 = no timer. Default 0. */
  timerMinutes?: number;
  /** Passing percentage (0-100). Default 60. */
  passingPercent?: number;
  /** XP to award on pass. Default 30. */
  passXp?: number;
  /** XP to award for attempt (even if failed). Default 10. */
  attemptXp?: number;
  /** Whether to show explanations immediately after answer selection */
  instantFeedback?: boolean;
}

export type { QuizResult };

export default function QuizComponent({
  quiz,
  onComplete,
  timerMinutes = 0,
  passingPercent = 60,
  passXp = 30,
  attemptXp = 10,
  instantFeedback = false,
}: QuizComponentProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Record<string, boolean>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(timerMinutes * 60);
  const [isTimerWarning, setIsTimerWarning] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  const questions = quiz.questions;
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(selectedAnswers).length;
  const progress = totalQuestions > 0 ? (currentQuestionIndex / totalQuestions) : 0;

  // Timer
  useEffect(() => {
    if (timerMinutes <= 0) return;
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        if (prev <= 60) setIsTimerWarning(true);
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerMinutes]);

  // Animate progress
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentQuestionIndex]);

  const animateTransition = useCallback((direction: 'forward' | 'back') => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: direction === 'forward' ? -30 : 30,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      slideAnim.setValue(direction === 'forward' ? 30 : -30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  const handleSelectAnswer = useCallback((questionId: string, answerIndex: number) => {
    if (submittedQuestions[questionId] || isComplete) return;

    setSelectedAnswers(prev => ({ ...prev, [questionId]: answerIndex }));

    if (instantFeedback) {
      setSubmittedQuestions(prev => ({ ...prev, [questionId]: true }));
      setShowExplanation(true);
    }
  }, [submittedQuestions, isComplete, instantFeedback]);

  const handleNext = useCallback(() => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setShowExplanation(false);
      setCurrentQuestionIndex(prev => prev + 1);
      animateTransition('forward');
    }
  }, [currentQuestionIndex, totalQuestions, animateTransition]);

  const handlePrevious = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setShowExplanation(false);
      setCurrentQuestionIndex(prev => prev - 1);
      animateTransition('back');
    }
  }, [currentQuestionIndex, animateTransition]);

  const calculateResult = useCallback((): QuizResult => {
    let correct = 0;
    const correctMap: Record<string, number> = {};
    questions.forEach(q => { correctMap[q.id] = q.correctAnswer; });

    Object.entries(selectedAnswers).forEach(([qId, ansIdx]) => {
      const q = questions.find(qq => qq.id === qId);
      if (q && ansIdx === q.correctAnswer) correct++;
    });

    const answered = Object.keys(selectedAnswers).length;
    const wrong = answered - correct;
    const unanswered = totalQuestions - answered;
    const pct = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);

    return {
      quizId: quiz.id,
      quizTitle: quiz.title,
      totalQuestions,
      correctAnswers: correct,
      wrongAnswers: wrong,
      unanswered,
      score: correct,
      percentage: pct,
      passed: pct >= passingPercent,
      timeTaken,
      answers: selectedAnswers,
      correctAnswerMap: correctMap,
    };
  }, [quiz, selectedAnswers, totalQuestions, passingPercent, questions]);

  const handleSubmit = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const result = calculateResult();
    setQuizResult(result);
    setIsComplete(true);
    onComplete(result);
  }, [calculateResult, onComplete]);

  const handleAutoSubmit = useCallback(() => {
    const result = calculateResult();
    setQuizResult(result);
    setIsComplete(true);
    onComplete(result);
  }, [calculateResult, onComplete]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ── Result Screen ──
  if (isComplete && quizResult) {
    return (
      <View style={styles.resultContainer}>
        {/* Result Header */}
        <LinearGradient
          colors={quizResult.passed ? GRADIENTS.accent : GRADIENTS.danger}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.resultHeader}
        >
          <View style={styles.resultIconWrap}>
            <Ionicons
              name={quizResult.passed ? 'checkmark-circle' : 'close-circle'}
              size={48}
              color="#FFF"
            />
          </View>
          <Text style={styles.resultTitle}>
            {quizResult.passed ? '🎉 Quiz Passed!' : 'Needs Improvement'}
          </Text>
          <Text style={styles.resultSubtitle}>
            {quizResult.passed
              ? `Great job! You scored ${quizResult.percentage}%`
              : `You scored ${quizResult.percentage}% — passing is ${passingPercent}%`}
          </Text>
        </LinearGradient>

        {/* Score Circle */}
        <View style={[styles.scoreCircle, { backgroundColor: colors.bgCard }]}>
          <Text style={[styles.scoreValue, { color: quizResult.passed ? '#00E676' : '#FF5252' }]}>
            {quizResult.percentage}%
          </Text>
          <Text style={styles.scoreLabel}>Score</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: colors.bgCard }]}>
            <Ionicons name="checkmark-circle" size={20} color="#00E676" />
            <Text style={styles.statValue}>{quizResult.correctAnswers}</Text>
            <Text style={styles.statLabel}>Correct</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.bgCard }]}>
            <Ionicons name="close-circle" size={20} color="#FF5252" />
            <Text style={styles.statValue}>{quizResult.wrongAnswers}</Text>
            <Text style={styles.statLabel}>Wrong</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.bgCard }]}>
            <Ionicons name="help-circle" size={20} color="#FFC107" />
            <Text style={styles.statValue}>{quizResult.unanswered}</Text>
            <Text style={styles.statLabel}>Skipped</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.bgCard }]}>
            <Ionicons name="time-outline" size={20} color="#6C63FF" />
            <Text style={styles.statValue}>{formatTime(quizResult.timeTaken)}</Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
        </View>

        {/* XP Earned */}
        <View style={[styles.xpBanner, {
          backgroundColor: quizResult.passed
            ? (colors.success + '20')
            : (colors.warning + '20'),
          borderColor: quizResult.passed
            ? (colors.success + '40')
            : (colors.warning + '40'),
        }]}>
          <Ionicons name="flash" size={20} color={quizResult.passed ? '#00E676' : '#FFC107'} />
          <Text style={[styles.xpText, { color: quizResult.passed ? '#00E676' : '#FFC107' }]}>
            {quizResult.passed ? `+${passXp} XP` : `+${attemptXp} XP for attempting`}
          </Text>
        </View>

        {/* Answer Review Toggle */}
        <Pressable
          style={[styles.reviewToggle, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => setShowExplanation(prev => !prev)}
        >
          <Ionicons name="list-outline" size={18} color={colors.text} />
          <Text style={[styles.reviewToggleText, { color: colors.text }]}>
            {showExplanation ? 'Hide' : 'Review'} Answers
          </Text>
          <Ionicons
            name={showExplanation ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </Pressable>

        {/* Answer Review */}
        {showExplanation && (
          <View style={styles.reviewContainer}>
            {questions.map((q, idx) => {
              const userAns = selectedAnswers[q.id];
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
                    <Text style={[styles.reviewQNum, { color: colors.textMuted }]}>
                      Q{idx + 1}
                    </Text>
                    <View style={[styles.reviewBadge, {
                      backgroundColor: isCorrect ? '#00C85320' : isSkipped ? '#FFC10720' : '#FF525220',
                    }]}>
                      <Ionicons
                        name={isCorrect ? 'checkmark-circle' : isSkipped ? 'help-circle' : 'close-circle'}
                        size={16}
                        color={isCorrect ? '#00C853' : isSkipped ? '#FFC107' : '#FF5252'}
                      />
                      <Text style={[styles.reviewBadgeText, {
                        color: isCorrect ? '#00C853' : isSkipped ? '#FFC107' : '#FF5252',
                      }]}>
                        {isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Incorrect'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.reviewQuestion, { color: colors.text }]}>{q.question}</Text>

                  {/* Options */}
                  {q.options.map((opt, oIdx) => {
                    const isSelected = userAns === oIdx;
                    const isRightAns = oIdx === q.correctAnswer;
                    let optStyle = {};
                    let optTextStyle: { color: string } = { color: colors.textMuted };

                    if (isRightAns) {
                      optStyle = { backgroundColor: '#00C85320', borderColor: '#00C853' };
                      optTextStyle = { color: '#00C853' };
                    } else if (isSelected && !isRightAns) {
                      optStyle = { backgroundColor: '#FF525220', borderColor: '#FF5252' };
                      optTextStyle = { color: '#FF5252' };
                    } else if (isSelected) {
                      optStyle = { backgroundColor: colors.primary + '20', borderColor: colors.primary };
                      optTextStyle = { color: colors.primary };
                    }

                    return (
                      <View key={oIdx} style={[styles.reviewOption, optStyle as any, { borderColor: (optStyle as any).borderColor || colors.border }]}>
                        <Text style={[styles.reviewOptionText, optTextStyle]}>{opt}</Text>
                        {isRightAns && (
                          <Ionicons name="checkmark-circle" size={16} color="#00C853" />
                        )}
                        {isSelected && !isRightAns && (
                          <Ionicons name="close-circle" size={16} color="#FF5252" />
                        )}
                      </View>
                    );
                  })}

                  {/* Explanation */}
                  <View style={[styles.explanationBox, { backgroundColor: '#6C63FF15' }]}>
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
      </View>
    );
  }

  // ── Quiz Screen ──
  return (
    <View style={styles.container}>
      {/* Header: Timer + Progress */}
      <View style={styles.quizHeader}>
        <View style={styles.quizHeaderLeft}>
          <Text style={[styles.quizTitle, { color: colors.text }]}>{quiz.title}</Text>
          <Text style={[styles.quizMeta, { color: colors.textMuted }]}>
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </Text>
        </View>
        {timerMinutes > 0 && (
          <View style={[styles.timerBox, {
            backgroundColor: isTimerWarning ? '#FF525220' : colors.bgCard,
            borderColor: isTimerWarning ? '#FF525240' : colors.border,
          }]}>
            <Ionicons
              name="time-outline"
              size={16}
              color={isTimerWarning ? '#FF5252' : colors.textMuted}
            />
            <Text style={[styles.timerText, {
              color: isTimerWarning ? '#FF5252' : colors.text,
            }]}>
              {formatTime(timeRemaining)}
            </Text>
          </View>
        )}
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressBarBg, { backgroundColor: colors.bgCardLight }]}>
        <Animated.View
          style={[styles.progressBarFill, {
            width: progressWidth,
            backgroundColor: colors.primary,
          }]}
        />
      </View>

      {/* Progress Dots */}
      <View style={styles.progressDots}>
        {questions.map((q, idx) => {
          const isAnswered = selectedAnswers[q.id] !== undefined;
          const isCurrent = idx === currentQuestionIndex;
          return (
            <Pressable
              key={q.id}
              style={[
                styles.progressDot,
                {
                  backgroundColor: isCurrent
                    ? colors.primary
                    : isAnswered
                      ? '#00C853'
                      : colors.bgCardLight,
                  borderColor: isCurrent
                    ? colors.primary
                    : colors.border,
                },
                isCurrent && styles.progressDotActive,
              ]}
              onPress={() => {
                if (idx !== currentQuestionIndex) {
                  animateTransition(idx > currentQuestionIndex ? 'forward' : 'back');
                  setShowExplanation(false);
                  setCurrentQuestionIndex(idx);
                }
              }}
            />
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Question Card */}
        <Animated.View
          style={[
            styles.questionCard,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.border,
              opacity: fadeAnim,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <Text style={[styles.questionText, { color: colors.text }]}>
            {currentQuestion.question}
          </Text>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((opt, optIdx) => {
              const isSelected = selectedAnswers[currentQuestion.id] === optIdx;
              const isSubmitted = submittedQuestions[currentQuestion.id];
              const isCorrect = isSubmitted && optIdx === currentQuestion.correctAnswer;
              const isWrong = isSubmitted && isSelected && !isCorrect;

              let optBg = colors.bgCardLight;
              let optBorder = colors.border;
              let optTextColor = colors.text;
              let optIcon = null;

              if (isSubmitted) {
                if (isCorrect) {
                  optBg = '#00C85320';
                  optBorder = '#00C853';
                  optTextColor = '#00C853';
                  optIcon = <Ionicons name="checkmark-circle" size={20} color="#00C853" />;
                } else if (isWrong) {
                  optBg = '#FF525220';
                  optBorder = '#FF5252';
                  optTextColor = '#FF5252';
                  optIcon = <Ionicons name="close-circle" size={20} color="#FF5252" />;
                }
              } else if (isSelected) {
                optBg = colors.primary + '20';
                optBorder = colors.primary;
                optTextColor = colors.primary;
                optIcon = <Ionicons name="radio-button-on" size={20} color={colors.primary} />;
              } else {
                optIcon = <Ionicons name="radio-button-off" size={20} color={colors.textMuted} />;
              }

              return (
                <AnimatedPressable
                  key={optIdx}
                  onPress={() => handleSelectAnswer(currentQuestion.id, optIdx)}
                  disabled={isSubmitted}
                  scaleTo={0.98}
                  haptic="selection"
                  style={[styles.option, {
                    backgroundColor: optBg,
                    borderColor: optBorder,
                  }]}
                >
                  <Text style={[styles.optionLabel, { color: colors.textMuted }]}>
                    {String.fromCharCode(65 + optIdx)}
                  </Text>
                  <Text style={[styles.optionText, { color: optTextColor }]}>
                    {opt}
                  </Text>
                  {optIcon}
                </AnimatedPressable>
              );
            })}
          </View>

          {/* Explanation (instant feedback mode) */}
          {showExplanation && submittedQuestions[currentQuestion.id] && (
            <View style={[styles.instantExplanation, { backgroundColor: '#6C63FF15' }]}>
              <Ionicons name="information-circle" size={18} color="#6C63FF" />
              <Text style={[styles.instantExplanationText, { color: colors.textSecondary }]}>
                {currentQuestion.explanation}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Navigation Buttons */}
        <View style={styles.navRow}>
          {currentQuestionIndex > 0 && (
            <Pressable
              style={[styles.navBtn, styles.navBtnPrev, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={handlePrevious}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
              <Text style={[styles.navBtnText, { color: colors.text }]}>Previous</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          {currentQuestionIndex < totalQuestions - 1 ? (
            <Pressable
              style={[styles.navBtn, styles.navBtnNext, { backgroundColor: colors.primary }]}
              onPress={handleNext}
            >
              <Text style={[styles.navBtnText, { color: '#FFF' }]}>Next</Text>
              <Ionicons name="chevron-forward" size={18} color="#FFF" />
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.submitBtn,
                { backgroundColor: answeredCount === totalQuestions ? '#00C853' : colors.primary },
              ]}
              onPress={handleSubmit}
            >
              <Ionicons name="checkmark-done" size={20} color="#FFF" />
              <Text style={[styles.submitBtnText, { color: '#FFF' }]}>
                Submit ({answeredCount}/{totalQuestions})
              </Text>
            </Pressable>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  quizHeaderLeft: {
    flex: 1,
  },
  quizTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
  },
  quizMeta: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 2,
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  timerText: {
    ...FONTS.mono,
    fontSize: FONTS.size.md,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: SPACING.lg,
    flexWrap: 'wrap',
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  progressDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  questionCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  questionText: {
    ...FONTS.medium,
    fontSize: FONTS.size.lg,
    lineHeight: 26,
    marginBottom: SPACING.xl,
  },
  optionsContainer: {
    gap: SPACING.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    minHeight: OPTION_HEIGHT,
  },
  optionLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
  },
  optionText: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    flex: 1,
    lineHeight: 20,
  },
  instantExplanation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.lg,
  },
  instantExplanationText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    flex: 1,
    lineHeight: 20,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
  },
  navBtnPrev: {
    borderWidth: 1,
  },
  navBtnNext: {},
  navBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
  },
  submitBtnText: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
  },

  // ── Result Screen ──
  resultContainer: {
    flex: 1,
  },
  resultHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  resultIconWrap: {
    marginBottom: SPACING.md,
  },
  resultTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: '#FFF',
    marginBottom: 4,
  },
  resultSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: -40,
    marginBottom: SPACING.lg,
    borderWidth: 3,
    borderColor: colors.border,
  },
  scoreValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
  },
  scoreLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: 4,
  },
  statValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  statLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  xpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  xpText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
  },
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
    fontSize: FONTS.size.xs,
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
});
