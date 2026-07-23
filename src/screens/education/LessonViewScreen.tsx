import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useEducationStore } from '../../store/educationStore';
import { useGamificationStore } from '../../store/gamificationStore';

import { mockLessons } from '../../constants/mockData';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import VideoLessonPlayer from '../../components/video/VideoLessonPlayer';
import QuizComponent from '../../components/quiz/QuizComponent';
import type { QuizResult } from '../../types';

const { width } = Dimensions.get('window');

export default function LessonViewScreen({ route, navigation }: any) {
  const { lessonId, courseId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    currentLesson, fetchLesson, markLessonComplete, lessonProgress,
    videoProgress, videoBookmarks, downloadingVideos, downloadProgress,
    updateVideoProgress, addVideoBookmark, deleteVideoBookmark,
    downloadVideo, removeOfflineVideo, isVideoDownloaded,
  } = useEducationStore();
  const { addXp } = useGamificationStore();

  const [showQuiz, setShowQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const lesson = currentLesson?.id === lessonId ? currentLesson : mockLessons.find(l => l.id === lessonId);
  const isCompleted = lessonProgress[lessonId] || lesson?.completed || false;
  const hasVideo = !!lesson?.videoUrl;
  const lessonVideoProgress = videoProgress[lessonId];
  const lessonBookmarks = videoBookmarks[lessonId] || [];
  const lessonIsDownloading = downloadingVideos[lessonId] || false;
  const lessonDownloadProgress = downloadProgress[lessonId] || 0;
  const lessonIsDownloaded = isVideoDownloaded(lessonId);

  useEffect(() => {
    if (lessonId) fetchLesson(lessonId);
  }, [lessonId, fetchLesson]);

  // Find next/prev lessons
  const courseLessons = mockLessons.filter(l => l.courseId === courseId);
  const currentIndex = courseLessons.findIndex(l => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? courseLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < courseLessons.length - 1 ? courseLessons[currentIndex + 1] : null;

  const handleMarkComplete = useCallback(async () => {
    await markLessonComplete(lessonId);
    addXp(50);
    // Auto-advance to next lesson after marking complete
    if (nextLesson) {
      setAutoAdvancing(true);
      try {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } catch {
        // Animation may not be supported in test/headless environments
      }
      setTimeout(() => {
        setShowQuiz(false);
        setQuizResult(null);
        setAutoAdvancing(false);
        fadeAnim.setValue(0);
        navigation.replace('LessonView', { lessonId: nextLesson.id, courseId });
      }, 2000);
    }
  }, [lessonId, markLessonComplete, addXp, nextLesson, courseId, navigation, fadeAnim]);

  const handleQuizComplete = useCallback((result: QuizResult) => {
    setQuizResult(result);
    if (result.passed) {
      addXp(30);
    } else {
      addXp(10);
    }
  }, [addXp]);

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

  const handleDownload = useCallback(() => {
    if (lesson?.videoUrl) downloadVideo(lessonId, lesson.videoUrl);
  }, [lessonId, lesson?.videoUrl, downloadVideo]);

  const handleRemoveDownload = useCallback(() => {
    removeOfflineVideo(lessonId);
  }, [lessonId, removeOfflineVideo]);

  if (!lesson) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.text }}>Lesson not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Auto-advance overlay */}
      {autoAdvancing && (
        <Animated.View style={[styles.autoAdvanceOverlay, { opacity: fadeAnim }]}>
          <View style={styles.autoAdvanceCard}>
            <Ionicons name="checkmark-circle" size={48} color="#00C853" />
            <Text style={styles.autoAdvanceTitle}>🎉 Lesson Complete!</Text>
            <Text style={styles.autoAdvanceSub}>Moving to next lesson...</Text>
          </View>
        </Animated.View>
      )}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
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
            isDownloaded={lessonIsDownloaded}
            isDownloading={lessonIsDownloading}
            downloadProgress={lessonDownloadProgress}
            onDownload={handleDownload}
            onRemoveDownload={handleRemoveDownload}
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
                  <View key={`takeaway_${i}`} style={styles.takeawayRow}>
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
          <Pressable
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
          </Pressable>
        )}

        {showQuiz && lesson.quiz && !quizResult && (
          <Card title={lesson.quiz.title} subtitle="Test your understanding" noPadding>
            <View style={styles.quizComponentWrapper}>
              <QuizComponent
                quiz={lesson.quiz}
                onComplete={handleQuizComplete}
                timerMinutes={5}
                passingPercent={60}
                passXp={30}
                attemptXp={10}
              />
            </View>
          </Card>
        )}

        {/* Mark Complete Button — only if quiz passed or no quiz */}
        {!isCompleted && (!lesson?.quiz || quizResult?.passed) && (
          <Pressable
            style={styles.completeBtn}
            onPress={handleMarkComplete}
          >
            <LinearGradient colors={GRADIENTS.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.completeGradient}>
              <Ionicons name="checkmark-circle" size={22} color={colors.white} />
              <Text style={styles.completeText}>Mark as Complete</Text>
            </LinearGradient>
          </Pressable>
        )}

        {/* View Detailed Results */}
        {quizResult && (
          <Pressable
            style={[styles.continueBtn, { marginTop: 0, marginBottom: SPACING.lg }]}
            onPress={() => navigation.navigate('QuizResult', {
              result: quizResult,
              lessonId,
              courseId,
            })}
          >
            <LinearGradient colors={GRADIENTS.purple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.continueGradient}>
              <Ionicons name="analytics" size={20} color={colors.white} />
              <Text style={styles.continueText}>View Detailed Results</Text>
            </LinearGradient>
          </Pressable>
        )}

        {/* Auto-advance in progress indicator */}
        {autoAdvancing && (
          <View style={styles.autoAdvanceInline}>
            <Ionicons name="hourglass-outline" size={16} color="#00C853" />
            <Text style={styles.autoAdvanceInlineText}>Auto-advancing to next lesson...</Text>
          </View>
        )}

        {/* Navigation */}
        <View style={styles.lessonNav}>
          {prevLesson && (
            <Pressable
              style={styles.lessonNavBtn}
              onPress={() => {
                setShowQuiz(false);
                setQuizResult(null);
                navigation.replace('LessonView', { lessonId: prevLesson.id, courseId });
              }}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
              <View>
                <Text style={styles.navLabel}>Previous</Text>
                <Text style={styles.navLessonTitle} numberOfLines={1}>{prevLesson.title}</Text>
              </View>
            </Pressable>
          )}
          {nextLesson && (
            <Pressable
              style={[styles.lessonNavBtn, styles.lessonNavBtnRight]}
              onPress={() => {
                setShowQuiz(false);
                setQuizResult(null);
                navigation.replace('LessonView', { lessonId: nextLesson.id, courseId });
              }}
            >
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.navLabel, { textAlign: 'right' }]}>Next</Text>
                <Text style={[styles.navLessonTitle, { textAlign: 'right' }]} numberOfLines={1}>{nextLesson.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
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

  quizComponentWrapper: {
    padding: SPACING.md,
  },
  contentCard: {
    marginBottom: SPACING.lg,
  },
  continueBtn: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginTop: SPACING.sm,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  continueText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.white,
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
  // Quiz styles managed by QuizComponent — remove old inline quiz styles
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
  // ── Auto-advance ──
  autoAdvanceOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  autoAdvanceCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xxl,
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  autoAdvanceTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.text,
  },
  autoAdvanceSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
  },
  autoAdvanceInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  autoAdvanceInlineText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: '#00C853',
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
