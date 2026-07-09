/**
 * ============================================================================
 * Toroloom — Learning Path Detail Screen
 * ============================================================================
 *
 * Shows detailed view of a single learning path:
 *   1. Path header with gradient, icon, stats
 *   2. Skills gained chips
 *   3. Course list with progress indicators
 *   4. Sticky "Start/Continue Path" button
 * ============================================================================
 */

import React, { useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useEducationStore } from '../../store/educationStore';
import { mockLearningPaths } from '../../constants/mockData';
import { mockCourses, mockLessons } from '../../constants/mockData';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function LearningPathDetailScreen({ navigation, route }: any) {
  const { pathId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { lessonProgress } = useEducationStore();

  // Find the path
  const path = useMemo(() => mockLearningPaths.find(p => p.id === pathId), [pathId]);

  // Get path courses
  const pathCourses = useMemo(() => {
    if (!path) return [];
    return path.courseIds
      .map(cid => mockCourses.find(c => c.id === cid))
      .filter(Boolean) as typeof mockCourses;
  }, [path]);

  // Calculate overall progress
  const pathProgress = useMemo(() => {
    if (!path) return { percent: 0, completedCourses: 0, totalCourses: 0 };
    const completed = pathCourses.filter(c => {
      const courseLessons = mockLessons.filter(l => l.courseId === c.id);
      if (courseLessons.length === 0) return false;
      return courseLessons.every(l => lessonProgress[l.id] || l.completed);
    }).length;
    return {
      percent: pathCourses.length > 0 ? Math.round((completed / pathCourses.length) * 100) : 0,
      completedCourses: completed,
      totalCourses: pathCourses.length,
    };
  }, [path, pathCourses, lessonProgress]);

  // Level config
  const levelConfig: Record<string, { label: string; color: string }> = {
    beginner: { label: 'Beginner', color: '#00E676' },
    intermediate: { label: 'Intermediate', color: '#6C63FF' },
    advanced: { label: 'Advanced', color: '#FF5252' },
  };

  const handleCoursePress = useCallback((courseId: string) => {
    navigation.navigate('CourseDetail', { courseId });
  }, [navigation]);

  const handleStartPath = useCallback(() => {
    // Find first incomplete course
    const firstIncomplete = pathCourses.find(c => {
      const courseLessons = mockLessons.filter(l => l.courseId === c.id);
      return !courseLessons.every(l => lessonProgress[l.id] || l.completed);
    });
    if (firstIncomplete) {
      navigation.navigate('CourseDetail', { courseId: firstIncomplete.id });
    } else if (pathCourses.length > 0) {
      navigation.navigate('CourseDetail', { courseId: pathCourses[0].id });
    }
  }, [pathCourses, lessonProgress, navigation]);

  if (!path) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="sad-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyText, { marginTop: SPACING.md }]}>Path not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.primary }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const lvl = levelConfig[path.level] || { label: 'Beginner', color: '#00E676' };

  return (
    <View style={styles.container}>
      {/* Sticky Header */}
      <View style={[styles.stickyHeader, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{path.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Banner */}
        <LinearGradient
          colors={path.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroIcon}>{path.icon}</Text>
          <Text style={styles.heroTitle}>{path.title}</Text>
          <Text style={styles.heroDesc}>{path.description}</Text>

          {/* Level badge */}
          <View style={[styles.levelBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.levelText}>{lvl.label}</Text>
          </View>

          {/* Stats */}
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{path.totalLessons}</Text>
              <Text style={styles.heroStatLabel}>Lessons</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{path.courseIds.length}</Text>
              <Text style={styles.heroStatLabel}>Courses</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{path.totalDuration}</Text>
              <Text style={styles.heroStatLabel}>Duration</Text>
            </View>
          </View>

          {/* Overall Progress */}
          <View style={styles.heroProgressContainer}>
            <View style={styles.heroProgressRow}>
              <Text style={styles.heroProgressLabel}>Overall Progress</Text>
              <Text style={styles.heroProgressPercent}>{pathProgress.percent}%</Text>
            </View>
            <View style={styles.heroProgressBarBg}>
              <View style={[styles.heroProgressBarFill, { width: `${pathProgress.percent}%` }]} />
            </View>
            <Text style={styles.heroProgressDetail}>
              {pathProgress.completedCourses}/{pathProgress.totalCourses} courses completed
            </Text>
          </View>
        </LinearGradient>

        {/* Target Audience */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Who Is This For?</Text>
          </View>
          <Text style={styles.sectionText}>{path.targetAudience}</Text>
        </View>

        {/* Skills */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy-outline" size={18} color={colors.warning} />
            <Text style={styles.sectionTitle}>Skills You'll Gain</Text>
          </View>
          <View style={styles.skillsGrid}>
            {path.skillsGained.map((skill, i) => (
              <View key={i} style={[styles.skillItem, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '20' }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.skillText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Courses */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="library-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Courses in This Path</Text>
            <Text style={styles.sectionCount}>{pathCourses.length}</Text>
          </View>

          {pathCourses.map((course, index) => {
            const courseLessons = mockLessons.filter(l => l.courseId === course.id);
            const completedCount = courseLessons.filter(l => lessonProgress[l.id] || l.completed).length;
            const courseProgress = course.lessons > 0 ? Math.round((completedCount / course.lessons) * 100) : 0;
            const isComplete = courseProgress >= 100;

            return (
              <TouchableOpacity
                key={course.id}
                style={[styles.courseCard, { borderColor: isComplete ? colors.primary + '30' : colors.border }]}
                onPress={() => handleCoursePress(course.id)}
                activeOpacity={0.7}
              >
                <View style={styles.courseRow}>
                  {/* Course number */}
                  <View style={[styles.courseNum, {
                    backgroundColor: isComplete ? colors.primary + '20' : colors.bgInput,
                    borderColor: isComplete ? colors.primary : colors.border,
                  }]}>
                    {isComplete ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : (
                      <Text style={[styles.courseNumText, { color: colors.text }]}>{index + 1}</Text>
                    )}
                  </View>

                  {/* Info */}
                  <View style={styles.courseInfo}>
                    <View style={styles.courseTitleRow}>
                      <Text style={styles.courseThumbnail}>{course.thumbnail}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.courseTitle, isComplete && styles.courseTitleDone]} numberOfLines={2}>
                          {course.title}
                        </Text>
                        <View style={styles.courseMetaRow}>
                          <Text style={styles.courseMetaText}>{course.lessons} lessons</Text>
                          <Text style={styles.courseMetaDot}>·</Text>
                          <Text style={styles.courseMetaText}>{course.duration}</Text>
                          <Text style={styles.courseMetaDot}>·</Text>
                          <Text style={[styles.courseLevelText, { color: lvl.color }]}>
                            {course.level}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Mini progress bar */}
                    <View style={styles.courseProgressBarBg}>
                      <View style={[styles.courseProgressBarFill, {
                        width: `${courseProgress}%`,
                        backgroundColor: isComplete ? '#00C853' : colors.primary,
                      }]} />
                    </View>
                    <Text style={styles.courseProgressText}>
                      {completedCount}/{course.lessons} lessons · {courseProgress}%
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky Bottom CTA */}
      <LinearGradient
        colors={[colors.bg + '00', colors.bg, colors.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.3 }}
        style={styles.bottomCtaWrapper}
      >
        <TouchableOpacity
          style={styles.startBtn}
          onPress={handleStartPath}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={path.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.startBtnGradient}
          >
            <Ionicons
              name={pathProgress.percent > 0 ? 'play' : 'rocket-outline'}
              size={20}
              color={colors.white}
            />
            <Text style={styles.startBtnText}>
              {pathProgress.percent > 0 ? 'Continue Learning' : 'Start This Path'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContent: { flex: 1 },
    scrollInner: { paddingBottom: 20 },

    // ── Sticky Header ──
    stickyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 60,
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
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
    backBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.md },
    headerTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.title,
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },

    // ── Hero ──
    hero: {
      margin: SPACING.xl,
      borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.xl,
      alignItems: 'center',
    },
    heroIcon: { fontSize: 56, marginBottom: SPACING.md },
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
    levelBadge: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: 6,
      borderRadius: BORDER_RADIUS.full,
      marginTop: SPACING.lg,
    },
    levelText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.white,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.lg,
      gap: 0,
    },
    heroStat: {
      flex: 1,
      alignItems: 'center',
    },
    heroStatDivider: {
      width: 1,
      height: 28,
      backgroundColor: 'rgba(255,255,255,0.3)',
    },
    heroStatValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.xl,
      color: colors.white,
    },
    heroStatLabel: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.7)',
      marginTop: 2,
    },
    heroProgressContainer: {
      width: '100%',
      marginTop: SPACING.xl,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
    },
    heroProgressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.xs,
    },
    heroProgressLabel: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.7)',
    },
    heroProgressPercent: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
      color: colors.white,
    },
    heroProgressBarBg: {
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 2,
      overflow: 'hidden',
    },
    heroProgressBarFill: {
      height: '100%',
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderRadius: 2,
    },
    heroProgressDetail: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.6)',
      marginTop: SPACING.xs,
    },

    // ── Section Cards ──
    sectionCard: {
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.md,
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    sectionTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.lg,
      color: colors.text,
      flex: 1,
    },
    sectionCount: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
      color: colors.primary,
    },
    sectionText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    // ── Skills ──
    skillsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    skillItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
    },
    skillText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      color: colors.text,
    },

    // ── Course List ──
    courseCard: {
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
    },
    courseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    courseNum: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
    },
    courseNumText: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
    },
    courseInfo: {
      flex: 1,
    },
    courseTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    courseThumbnail: {
      fontSize: 20,
    },
    courseTitle: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      color: colors.text,
    },
    courseTitleDone: {
      color: colors.textMuted,
      textDecorationLine: 'line-through',
    },
    courseMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    courseMetaText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    courseMetaDot: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    courseLevelText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      textTransform: 'capitalize',
    },
    courseProgressBarBg: {
      height: 3,
      backgroundColor: colors.bgInput,
      borderRadius: 1.5,
      overflow: 'hidden',
      marginTop: 6,
    },
    courseProgressBarFill: {
      height: '100%',
      borderRadius: 1.5,
    },
    courseProgressText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 2,
    },

    // ── Bottom CTA ──
    bottomCtaWrapper: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingTop: SPACING.xl,
      paddingHorizontal: SPACING.xl,
      paddingBottom: 40,
    },
    startBtn: {
      borderRadius: BORDER_RADIUS.lg,
      overflow: 'hidden',
    },
    startBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.lg,
    },
    startBtnText: {
      ...FONTS.bold,
      fontSize: FONTS.size.lg,
      color: colors.white,
    },

    // ── Empty ──
    emptyText: {
      ...FONTS.regular,
      fontSize: FONTS.size.md,
      color: colors.textMuted,
    },
  });
