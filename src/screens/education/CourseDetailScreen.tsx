import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useEducationStore } from '../../store/educationStore';
import { useGamificationStore } from '../../store/gamificationStore';

import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { educationApi } from '../../services/api/education';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import AppScreen from '../../components/ui/AppScreen';


const levelGradients: Record<string, readonly [string, string]> = {
  beginner: GRADIENTS.success,
  intermediate: GRADIENTS.warning,
  advanced: GRADIENTS.danger,
};

export default function CourseDetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'CourseDetail'>) {
  const { courseId } = route.params;
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { courses, fetchCourses, fetchLesson, markLessonComplete, lessonProgress } = useEducationStore();
  const { addXp } = useGamificationStore();
  const [courseLessons, setCourseLessons] = useState<any[]>([]);

  const course = courses.find((c: any) => c.id === courseId);

  useEffect(() => {
    fetchCourses();
    // Fetch course with lesson list from API
    educationApi.getCourse(courseId)
      .then(detail => {
        if (detail.lessonList) {
          setCourseLessons(detail.lessonList);
          if (detail.lessonList.length > 0) {
            fetchLesson(detail.lessonList[0].id);
          }
        }
      })
      .catch(() => {
        // Fallback: use mock data for lesson list
        import('../../constants/mockData').then(mod => {
          const mockLessons = mod.mockLessons.filter((l: any) => l.courseId === courseId);
          setCourseLessons(mockLessons);
          if (mockLessons.length > 0) fetchLesson(mockLessons[0].id);
        });
      });
  }, [courseId, fetchCourses, fetchLesson]);

  const { certificates } = useEducationStore();

  if (!course) {
    return (
            <AppScreen scroll={false} padded={false}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
  <Text style={{ ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.text }}>{t('education.courseNotFound')}</Text>
        </View>
      </AppScreen>
    );
  }

  const completedCount = courseLessons.filter((l: any) => lessonProgress[l.id] || l.completed).length;
  const progress = course.lessons > 0 ? Math.round((completedCount / course.lessons) * 100) : 0;
  const levelGradient = levelGradients[course.level] || GRADIENTS.primary;

  const handleLessonPress = (lessonId: string) => {
    navigation.navigate('LessonView', { lessonId, courseId: course.id });
  };

  const _handleMarkComplete = async (lessonId: string) => {
    await markLessonComplete(lessonId);
    addXp(50);
  };

  const nextIncomplete = courseLessons.find((l: any) => !(lessonProgress[l.id] || l.completed));
  const allLessonsComplete = !nextIncomplete && completedCount === course.lessons;
  const certificate = certificates.find(c => c.courseId === courseId);

  return (
          <AppScreen scroll={false} padded={false}
      >
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Back Button */}
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Course Hero */}
          <LinearGradient colors={levelGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Text style={styles.heroIcon}>{course.thumbnail}</Text>
            <Text style={styles.heroTitle}>{course.title}</Text>
            <Text style={styles.heroDesc}>{course.description}</Text>
            <View style={styles.heroMeta}>
              <Badge label={course.level} variant={course.level === 'beginner' ? 'success' : course.level === 'intermediate' ? 'warning' : 'danger'} size="medium" />
              <Badge label={course.category} variant="info" size="medium" />
            </View>
          </LinearGradient>

          {/* Progress Section */}
          <Card style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>{t('education.courseProgress')}</Text>
              <Text style={styles.progressPercent}>{progress}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
            </View>
            <View style={styles.progressStats}>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{completedCount}</Text>
                <Text style={styles.progressStatLabel}>{t('education.completed')}</Text>
              </View>
              <View style={styles.progressStatDivider} />
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{course.lessons - completedCount}</Text>
                <Text style={styles.progressStatLabel}>{t('education.remainingCount')}</Text>
              </View>
              <View style={styles.progressStatDivider} />
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{course.duration}</Text>
                <Text style={styles.progressStatLabel}>{t('education.duration')}</Text>
              </View>
            </View>
          </Card>

          {/* Course Info */}
          <Card title={t('education.aboutThisCourse')} style={styles.infoCard}>
            <Text style={styles.infoText}>{course.description}</Text>
            <View style={styles.infoStats}>
              <View style={styles.infoStat}>
                <Ionicons name="people-outline" size={16} color={colors.textMuted} />
                <Text style={styles.infoStatText}>{course.enrolledCount.toLocaleString()} {t('education.enrolled')}</Text>
              </View>
              <View style={styles.infoStat}>
                <Ionicons name="star" size={16} color="#FFC107" />
                <Text style={styles.infoStatText}>{course.rating} {t('education.rating')}</Text>
              </View>
            </View>
          </Card>

          {/* Lessons List */}
          <View style={styles.lessonsSection}>
            <Text style={styles.lessonsSectionTitle}>
              {t('education.lessonsProgress', { completed: completedCount, total: course.lessons })}
            </Text>

            {courseLessons.map((lesson: any, index) => {
              const isCompleted = lessonProgress[lesson.id] || lesson.completed;
              const isNext = nextIncomplete?.id === lesson.id;

              return (
                <Pressable
                  key={lesson.id}
                  style={({pressed}) => [[styles.lessonCard, isNext && styles.lessonCardNext], {opacity: pressed ? 0.7 : 1}]}
                  onPress={() => handleLessonPress(lesson.id)}
                >
                  <View style={styles.lessonRow}>
                    {/* Status indicator */}
                    <View style={[
                      styles.lessonStatus,
                      isCompleted && styles.lessonStatusDone,
                      isNext && !isCompleted && styles.lessonStatusNext,
                    ]}>
                      {isCompleted ? (
                        <Ionicons name="checkmark-circle" size={22} color="#00C853" />
                      ) : (
                        <Text style={[
                          styles.lessonNumber,
                          isNext && { color: colors.primary },
                        ]}>
                          {String(index + 1).padStart(2, '0')}
                        </Text>
                      )}
                    </View>

                    <View style={styles.lessonInfo}>
                      <Text style={[styles.lessonTitle, isCompleted && styles.lessonTitleDone]}>{lesson.title}</Text>
                      <View style={styles.lessonMeta}>
                        <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.lessonDuration}>{lesson.duration}</Text>
                        {isCompleted && (
                          <View style={styles.completedTag}>
                            <Ionicons name="checkmark" size={10} color="#00C853" />
                            <Text style={styles.completedText}>{t('education.lessonDone')}</Text>
                          </View>
                        )}
                        {lesson.quiz && (
                          <View style={styles.quizTag}>
                            <Ionicons name="help-circle" size={10} color="#6C63FF" />
                            <Text style={styles.quizTagText}>{t('education.lessonQuiz')}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </View>

                  {/* "Resume" badge on next incomplete lesson */}
                  {isNext && !isCompleted && (
                    <View style={styles.nextBadge}>
                      <Text style={styles.nextBadgeText}>{t('education.nextLesson')}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Continue / Next Button */}
          {nextIncomplete && (
            <Pressable
              style={styles.continueBtn}
              onPress={() => handleLessonPress(nextIncomplete.id)}
            >
              <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.continueGradient}>
                <Ionicons name="play" size={20} color={colors.white} />
                <Text style={styles.continueText}>
                  {completedCount === 0 ? t('education.startCourse') : t('education.continueLearning')}
                </Text>
              </LinearGradient>
            </Pressable>
          )}

          {/* Certificate Button — shown when all lessons complete */}
          {allLessonsComplete && (
            <Pressable
              style={[styles.continueBtn, { marginTop: SPACING.sm }]}
              onPress={() => navigation.navigate('Certificate', { courseId })}
            >
              <LinearGradient colors={GRADIENTS.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.continueGradient}>
                <Ionicons name={certificate ? 'ribbon' : 'ribbon-outline'} size={20} color={colors.white} />
                <Text style={styles.continueText}>
                  {certificate ? t('education.viewCertificate') : t('education.getCertificate')}
                </Text>
              </LinearGradient>
            </Pressable>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </AppScreen>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    marginBottom: SPACING.md,
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
  hero: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  heroIcon: {
    fontSize: 56,
    marginBottom: SPACING.md,
  },
  heroTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxxl,
    color: colors.white,
    textAlign: 'center',
  },
  heroDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  heroMeta: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  progressCard: {
    marginBottom: SPACING.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.md,
  },
  progressTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  progressPercent: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.primary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.bgCardLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressStat: {
    flex: 1,
    alignItems: 'center',
  },
  progressStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.divider,
  },
  progressStatValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  progressStatLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  infoCard: {
    marginBottom: SPACING.lg,
  },
  infoText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  infoStats: {
    flexDirection: 'row',
    gap: SPACING.xl,
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  infoStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  infoStatText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  lessonsSection: {
    marginBottom: SPACING.lg,
  },
  lessonsSectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
    marginBottom: SPACING.md,
  },
  lessonCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  lessonCardNext: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lessonStatus: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.bgCardLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  lessonStatusDone: {
    backgroundColor: '#00C85315',
  },
  lessonStatusNext: {
    backgroundColor: colors.primary + '20',
  },
  lessonNumber: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTitle: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  lessonTitleDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 4,
  },
  lessonDuration: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  completedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#00C85315',
  },
  completedText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: '#00C853',
  },
  quizTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#6C63FF20',
  },
  quizTagText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: '#6C63FF',
  },
  nextBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderBottomLeftRadius: BORDER_RADIUS.sm,
  },
  nextBadgeText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.white,
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
});
