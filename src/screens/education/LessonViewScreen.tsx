import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useEducationStore } from '../../store/educationStore';
import { useGamificationStore } from '../../store/gamificationStore';

import { mockLessons } from '../../constants/mockData';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import VideoLessonPlayer from '../../components/video/VideoLessonPlayer';

const { width } = Dimensions.get('window');

export default function LessonViewScreen({ route, navigation }: any) {
  const { lessonId, courseId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    currentLesson, fetchLesson, markLessonComplete, lessonProgress,
    videoProgress, videoBookmarks,
    updateVideoProgress, addVideoBookmark, deleteVideoBookmark,
  } = useEducationStore();
  const { addXp } = useGamificationStore();

  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [videoCompleted, setVideoCompleted] = useState(false);

  const lesson = currentLesson?.id === lessonId ? currentLesson : mockLessons.find(l => l.id === lessonId);
  const isCompleted = lessonProgress[lessonId] || lesson?.completed || false;
  const hasVideo = !!lesson?.videoUrl;
  const lessonVideoProgress = videoProgress[lessonId];
  const lessonBookmarks = videoBookmarks[lessonId] || [];

  useEffect(() => {
    if (lessonId) fetchLesson(lessonId);
  }, [lessonId]);

  // Find next/prev lessons
  const courseLessons = mockLessons.filter(l => l.courseId === courseId);
  const currentIndex = courseLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? courseLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < courseLessons.length - 1 ? courseLessons[currentIndex + 1] : null;

  const handleMarkComplete = useCallback(async () => {
    await markLessonComplete(lessonId);
    addXp(50);
  }, [lessonId, markLessonComplete, addXp]);

  const handleAnswerSelect = useCallback((questionId: string, answerIndex: number) => {
    if (quizSubmitted) return;
    setSelectedAnswers(prev => ({ ...prev, [questionId]: answerIndex }));
  }, [quizSubmitted]);

  const handleQuizSubmit = useCallback(() => {
    if (!lesson?.quiz) return;
    setQuizSubmitted(true);
    let score = 0;
    lesson.quiz.questions.forEach(q => {
      if (selectedAnswers[q.id] === q.correctAnswer) score++;
    });
    const pct = Math.round((score / lesson.quiz.questions.length) * 100);
    if (pct >= 60) addXp(30);
  }, [lesson, selectedAnswers, addXp]);

  const handleRetryQuiz = useCallback(() => {
    setSelectedAnswers({});
    setQuizSubmitted(false);
  }, []);

  const handleVideoProgress = useCallback((p: { lastPosition: number; duration: number; watchedPercent: number }) => {
    updateVideoProgress(lessonId, p);
  }, [lessonId, updateVideoProgress]);

  const handleVideoComplete = useCallback(() => {
    setVideoCompleted(true);
    // Auto-mark complete if video is fully watched
    if (!isCompleted) {
      addXp(25);
    }
  }, [isCompleted, addXp]);

  const handleAddBookmark = useCallback((time: number, label: string) => {
    addVideoBookmark(lessonId, time, label);
  }, [lessonId, addVideoBookmark]);

  const handleDeleteBookmark = useCallback((bookmarkId: string) => {
    deleteVideoBookmark(lessonId, bookmarkId);
  }, [lessonId, deleteVideoBookmark]);

  if (!lesson) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.text }}>Lesson not found</Text>
      </View>
    );
  }

  const quizPassed = quizSubmitted && lesson.quiz
    ? lesson.quiz.questions.filter(q => selectedAnswers[q.id] === q.correctAnswer).length / lesson.quiz.questions.length >= 0.6
    : false;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerLessonNum}>Lesson {currentIndex + 1} of {courseLessons.length}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{lesson.title}</Text>
          </View>
          {isCompleted && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#00C853" />
            </View>
          )}
        </View>

        {/* Duration & Status */}
        <View style={styles.lessonMeta}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.lessonMetaText}>{lesson.duration}</Text>
          {hasVideo && (
            <>
              <Ionicons name="videocam" size={14} color={colors.primary} />
              <Text style={styles.lessonMetaText}>Video Lesson</Text>
            </>
          )}
          {lesson.quiz && (
            <>
              <Ionicons name="help-circle-outline" size={14} color={colors.textMuted} />
              <Text style={styles.lessonMetaText}>Includes Quiz</Text>
            </>
          )}
        </View>

        {/* ─── Video Player ─── */}
        {hasVideo && lesson.videoUrl && (
          <VideoLessonPlayer
            videoUrl={lesson.videoUrl}
            transcript={lesson.transcript}
            bookmarks={lessonBookmarks}
            progress={lessonVideoProgress}
            onAddBookmark={handleAddBookmark}
            onDeleteBookmark={handleDeleteBookmark}
            onProgressUpdate={handleVideoProgress}
            onVideoComplete={handleVideoComplete}
          />
        )}

        {/* Video Completion Indicator */}
        {hasVideo && videoCompleted && !isCompleted && (
          <View style={styles.videoCompleteBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#00C853" />
            <Text style={styles.videoCompleteText}>Video fully watched! +25 XP</Text>
          </View>
        )}

        {/* Content (shown below video or as main content) */}
        <Card noPadding style={styles.contentCard}>
          <View style={styles.contentInner}>
            <Text style={styles.contentTitle}>{lesson.title}</Text>
            <Text style={styles.contentBody}>{lesson.content}</Text>

            {/* Educational content sections */}
            <View style={styles.contentSection}>
              <View style={styles.contentSectionHeader}>
                <Ionicons name="bulb-outline" size={18} color="#FFC107" />
                <Text style={styles.contentSectionTitle}>Key Takeaways</Text>
              </View>
              <View style={styles.takeaways}>
                {[
                  'Understanding core concepts and terminology',
                  'Real-world applications and examples',
                  'Practical tips for your trading journey',
                ].map((item, i) => (
                  <View key={i} style={styles.takeawayRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#00C853" />
                    <Text style={styles.takeawayText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.contentSection}>
              <View style={styles.contentSectionHeader}>
                <Ionicons name="book-outline" size={18} color="#6C63FF" />
                <Text style={styles.contentSectionTitle}>Summary</Text>
              </View>
              <Text style={styles.contentBody}>
                This lesson covered the fundamental concepts that form the building blocks of
                stock market knowledge. Apply these concepts in practice through the exercises
                and quiz to reinforce your learning.
              </Text>
            </View>
          </View>
        </Card>

        {/* Quiz Section */}
        {lesson.quiz && !showQuiz && (
          <TouchableOpacity
            style={styles.startQuizBtn}
            onPress={() => setShowQuiz(true)}
          >
            <LinearGradient colors={GRADIENTS.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quizGradient}>
              <Ionicons name="help-circle" size={24} color={colors.white} />
              <View>
                <Text style={styles.quizBtnTitle}>Test Your Knowledge</Text>
                <Text style={styles.quizBtnSub}>{lesson.quiz.questions.length} questions</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {showQuiz && lesson.quiz && (
          <Card title={lesson.quiz.title} subtitle={quizSubmitted ? `Score: ${lesson.quiz.questions.filter(q => selectedAnswers[q.id] === q.correctAnswer).length}/${lesson.quiz.questions.length}` : 'Test your understanding'}>
            {lesson.quiz.questions.map((q, qIdx) => (
              <View key={q.id} style={styles.questionBlock}>
                <Text style={styles.questionText}>
                  Q{qIdx + 1}. {q.question}
                </Text>
                {q.options.map((opt, oIdx) => {
                  const isSelected = selectedAnswers[q.id] === oIdx;
                  const isCorrect = quizSubmitted && oIdx === q.correctAnswer;
                  const isWrong = quizSubmitted && isSelected && !isCorrect;

                  let optBg = colors.bgCardLight;
                  let optBorder = colors.border;
                  let optText = colors.text;

                  if (quizSubmitted) {
                    if (isCorrect) {
                      optBg = '#00C85320';
                      optBorder = '#00C853';
                      optText = '#00C853';
                    } else if (isWrong) {
                      optBg = '#FF174420';
                      optBorder = '#FF1744';
                      optText = '#FF1744';
                    }
                  } else if (isSelected) {
                    optBg = colors.primary + '20';
                    optBorder = colors.primary;
                    optText = colors.primary;
                  }

                  return (
                    <TouchableOpacity
                      key={oIdx}
                      style={[styles.option, { backgroundColor: optBg, borderColor: optBorder }]}
                      onPress={() => handleAnswerSelect(q.id, oIdx)}
                      disabled={quizSubmitted}
                    >
                      <Text style={[styles.optionText, { color: optText }]}>{opt}</Text>
                      {quizSubmitted && isCorrect && (
                        <Ionicons name="checkmark-circle" size={18} color="#00C853" />
                      )}
                      {quizSubmitted && isWrong && (
                        <Ionicons name="close-circle" size={18} color="#FF1744" />
                      )}
                    </TouchableOpacity>
                  );
                })}
                {quizSubmitted && (
                  <View style={styles.explanation}>
                    <Ionicons name="information-circle" size={16} color="#6C63FF" />
                    <Text style={styles.explanationText}>{q.explanation}</Text>
                  </View>
                )}
              </View>
            ))}

            <View style={styles.quizActions}>
              {!quizSubmitted ? (
                <Button
                  title="Submit Answers"
                  onPress={handleQuizSubmit}
                  disabled={Object.keys(selectedAnswers).length < lesson.quiz.questions.length}
                  style={{ flex: 1 }}
                />
              ) : (
                <View style={styles.quizResultRow}>
                  <Badge
                    label={quizPassed ? '✅ Passed' : '❌ Needs Improvement'}
                    variant={quizPassed ? 'success' : 'danger'}
                    size="medium"
                  />
                  <Button
                    title="Retry"
                    onPress={handleRetryQuiz}
                    variant="outline"
                    size="small"
                  />
                </View>
              )}
            </View>
          </Card>
        )}

        {/* Mark Complete Button */}
        {!isCompleted && (
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={handleMarkComplete}
          >
            <LinearGradient colors={GRADIENTS.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.completeGradient}>
              <Ionicons name="checkmark-circle" size={22} color={colors.white} />
              <Text style={styles.completeText}>Mark as Complete</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Navigation */}
        <View style={styles.lessonNav}>
          {prevLesson && (
            <TouchableOpacity
              style={styles.lessonNavBtn}
              onPress={() => {
                setShowQuiz(false);
                setSelectedAnswers({});
                setQuizSubmitted(false);
                navigation.replace('LessonView', { lessonId: prevLesson.id, courseId });
              }}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
              <View>
                <Text style={styles.navLabel}>Previous</Text>
                <Text style={styles.navLessonTitle} numberOfLines={1}>{prevLesson.title}</Text>
              </View>
            </TouchableOpacity>
          )}
          {nextLesson && (
            <TouchableOpacity
              style={[styles.lessonNavBtn, styles.lessonNavBtnRight]}
              onPress={() => {
                setShowQuiz(false);
                setSelectedAnswers({});
                setQuizSubmitted(false);
                navigation.replace('LessonView', { lessonId: nextLesson.id, courseId });
              }}
            >
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.navLabel, { textAlign: 'right' }]}>Next</Text>
                <Text style={[styles.navLessonTitle, { textAlign: 'right' }]} numberOfLines={1}>{nextLesson.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 100 }} />
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
    paddingBottom: 20,
    paddingHorizontal: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    marginBottom: SPACING.md,
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
  headerInfo: {
    flex: 1,
  },
  headerLessonNum: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  headerTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  completedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00C85320',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  lessonMetaText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginRight: SPACING.sm,
  },

  // ── Video Complete Banner ──
  videoCompleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#00C85315',
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  videoCompleteText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: '#00C853',
  },

  contentCard: {
    marginBottom: SPACING.lg,
  },
  contentInner: {
    padding: SPACING.xl,
  },
  contentTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.text,
    marginBottom: SPACING.lg,
  },
  contentBody: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  contentSection: {
    marginTop: SPACING.xxl,
    paddingTop: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  contentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  contentSectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  takeaways: {
    gap: SPACING.md,
  },
  takeawayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  takeawayText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  startQuizBtn: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  quizGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  quizBtnTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.white,
  },
  quizBtnSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  questionBlock: {
    marginBottom: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  questionText: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.text,
    marginBottom: SPACING.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  optionText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    flex: 1,
  },
  explanation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: '#6C63FF15',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  explanationText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  quizActions: {
    marginTop: SPACING.md,
  },
  quizResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completeBtn: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
  },
  completeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  completeText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.white,
  },
  lessonNav: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  lessonNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lessonNavBtnRight: {
    justifyContent: 'flex-end',
  },
  navLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  navLessonTitle: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
    maxWidth: width * 0.25,
  },
});
