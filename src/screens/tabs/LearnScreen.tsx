import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, RefreshControl } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useEducationStore } from '../../store/educationStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { useStaggeredAnimation } from '../../hooks/useStaggeredAnimation';
import { SkeletonBlock, SkeletonCard, PortfolioSkeleton } from '../../components/ui/SkeletonLoader';

const { width } = Dimensions.get('window');

export default function LearnScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { courses } = useEducationStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const continueCourses = courses.filter(c => c.progress > 0 && c.progress < 100);
  const { animatedStyles: continueStyles } = useStaggeredAnimation(continueCourses.length, {
    initialDelay: 150,
    staggerDelay: 100,
    duration: 400,
  });

  const { animatedStyles: courseStyles } = useStaggeredAnimation(courses.length, {
    initialDelay: 200,
    staggerDelay: 80,
    duration: 450,
  });

  const levelColors: Record<string, readonly [string, string]> = {
    beginner: GRADIENTS.success,
    intermediate: GRADIENTS.warning,
    advanced: GRADIENTS.danger,
  } as Record<string, readonly [string, string]>;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <SkeletonBlock width="40%" height={28} />
            <View style={{ height: 4 }} />
            <SkeletonBlock width="50%" height={14} />
          </View>
          <View style={{ paddingLeft: SPACING.xl }}>
            <SkeletonBlock width="30%" height={18} />
            <View style={{ height: SPACING.md }} />
            <SkeletonBlock width={200} height={160} borderRadius={BORDER_RADIUS.lg} />
          </View>
          <View style={{ paddingHorizontal: SPACING.xl, marginTop: SPACING.xl }}>
            {[1, 2, 3].map(i => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: SPACING.md }}>
                <SkeletonBlock width={80} height={100} borderRadius={BORDER_RADIUS.lg} />
                <View style={{ flex: 1, marginLeft: SPACING.md, gap: 6 }}>
                  <SkeletonBlock width="70%" height={16} />
                  <SkeletonBlock width="40%" height={12} />
                  <SkeletonBlock width="50%" height={12} />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.bgSecondary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Learning Hub</Text>
          <Text style={styles.subtitle}>Master the markets, one lesson at a time</Text>
        </View>

        {/* Continue Learning */}
        {continueCourses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Continue Learning</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {continueCourses.map((course, i) => (
                <Animated.View key={course.id} style={continueStyles[i]}>
                  <AnimatedPressable
                    onPress={() => navigation.navigate('CourseDetail', { courseId: course.id, course })}
                    haptic="light"
                    scaleTo={0.97}
                  >
                    <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.continueGradient}>
                      <Text style={styles.continueIcon}>{course.thumbnail}</Text>
                      <Text style={styles.continueTitle} numberOfLines={2}>{course.title}</Text>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${course.progress}%` }]} />
                      </View>
                      <Text style={styles.progressText}>{course.progress}% complete</Text>
                    </LinearGradient>
                  </AnimatedPressable>
                </Animated.View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* All Courses */}
        <View style={styles.allCoursesSection}>
          <Text style={styles.sectionTitle}>All Courses</Text>
          <View style={styles.coursesGrid}>
            {courses.map((course, i) => (
              <Animated.View key={course.id} style={courseStyles[i]}>
                <AnimatedPressable
                  onPress={() => navigation.navigate('CourseDetail', { courseId: course.id, course })}
                  haptic="selection"
                  scaleTo={0.98}
                >
                  <View style={styles.courseCard}>
                    <LinearGradient
                      colors={levelColors[course.level] || GRADIENTS.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.courseThumb}
                    >
                      <Text style={styles.courseIcon}>{course.thumbnail}</Text>
                    </LinearGradient>
                    <View style={styles.courseInfo}>
                      <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>
                      <View style={styles.courseMeta}>
                        <Badge label={course.level} variant={course.level === 'beginner' ? 'success' : course.level === 'intermediate' ? 'warning' : 'danger'} />
                        <Text style={styles.courseDuration}>{course.duration}</Text>
                      </View>
                      <View style={styles.courseStats}>
                        <Ionicons name="book-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.courseStatText}>{course.lessons} lessons</Text>
                        <Ionicons name="people-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.courseStatText}>{course.enrolledCount.toLocaleString()}</Text>
                      </View>
                      {course.progress > 0 && (
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${course.progress}%`, backgroundColor: colors.primary }]} />
                        </View>
                      )}
                      <View style={styles.courseRatingRow}>
                        <Ionicons name="star" size={12} color="#FFC107" />
                        <Text style={styles.courseRating}>{course.rating}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.courseArrow} />
                  </View>
                </AnimatedPressable>
              </Animated.View>
            ))}
          </View>
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
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
    marginTop: 4,
  },
  section: {
    marginBottom: SPACING.xxl,
    paddingLeft: SPACING.xl,
  },
  allCoursesSection: {
    paddingHorizontal: SPACING.xl,
  },
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
    marginBottom: SPACING.md,
  },
  continueGradient: {
    padding: SPACING.lg,
    width: 200,
    height: 160,
    justifyContent: 'space-between',
    borderRadius: BORDER_RADIUS.lg,
    marginRight: SPACING.md,
  },
  continueIcon: {
    fontSize: 32,
  },
  continueTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.white,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: 2,
  },
  progressText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.8)',
  },
  coursesGrid: {
    gap: SPACING.md,
  },
  courseCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  courseThumb: {
    width: 80,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseIcon: {
    fontSize: 32,
  },
  courseInfo: {
    flex: 1,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  courseTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  courseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  courseDuration: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  courseStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  courseStatText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginRight: SPACING.sm,
  },
  courseRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  courseRating: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: '#FFC107',
  },
  courseArrow: {
    paddingRight: SPACING.md,
  },
});
