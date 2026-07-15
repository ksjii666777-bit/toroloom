import React, { useMemo, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Platform,
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useUserCourseStore } from '../../store/userCourseStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { UserGeneratedCourse } from '../../types';

/** Format a relative time string */
function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** Get a gradient background for a publish status */
function statusGradient(status: string): [string, string] {
  switch (status) {
    case 'published': return ['#00C853', '#009624'];
    case 'draft': return ['#6C63FF', '#3B82F6'];
    case 'archived': return ['#6B7280', '#475569'];
    default: return ['#6C63FF', '#3B82F6'];
  }
}

function statusIcon(status: string): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case 'published': return 'checkmark-circle';
    case 'draft': return 'create';
    case 'archived': return 'archive';
    default: return 'ellipse';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'published': return 'Published';
    case 'draft': return 'Draft';
    case 'archived': return 'Archived';
    default: return status;
  }
}

export default function MyCoursesScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    myCourses, deleteCourse, duplicateCourse, submitForReview,
    archiveCourse, unarchiveCourse, setEditingCourse, getStats,
  } = useUserCourseStore();
  const [activeFilter, setActiveFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');

  const stats = useMemo(() => getStats(), [myCourses, getStats]);

  const filteredCourses = useMemo(() => {
    if (activeFilter === 'all') return myCourses;
    return myCourses.filter(c => c.publishStatus === activeFilter);
  }, [myCourses, activeFilter]);

  const sortedCourses = useMemo(() => {
    return [...filteredCourses].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [filteredCourses]);

  // Reload from cache on focus
  useFocusEffect(
    useCallback(() => {
      useUserCourseStore.getState().loadFromCache();
    }, [])
  );

  const handleCreateCourse = useCallback(() => {
    const draft = useUserCourseStore.getState().createDraft();
    setEditingCourse(draft);
    navigation.navigate('CreateCourse', { courseId: draft.id });
  }, [navigation, setEditingCourse]);

  const handleEditCourse = useCallback((course: UserGeneratedCourse) => {
    setEditingCourse(course);
    navigation.navigate('CreateCourse', { courseId: course.id });
  }, [navigation, setEditingCourse]);

  const handleMoreOptions = useCallback((course: UserGeneratedCourse) => {
    const options: { label: string; onPress: () => void }[] = [];

    if (course.publishStatus === 'draft') {
      options.push({
        label: 'Submit for Review',
        onPress: () => {
          if (!course.title || course.lessonsCount === 0) {
            Alert.alert('Cannot Submit',
              'Please add a title and at least one lesson before submitting for review.');
            return;
          }
          submitForReview(course.id);
        },
      });
    }
    if (course.publishStatus === 'published') {
      options.push({
        label: 'Archive Course',
        onPress: () => archiveCourse(course.id),
      });
    }
    if (course.publishStatus === 'archived') {
      options.push({
        label: 'Restore Course',
        onPress: () => unarchiveCourse(course.id),
      });
    }
    options.push({
      label: 'Duplicate',
      onPress: () => duplicateCourse(course.id),
    });
    options.push({
      label: 'Delete',
      onPress: () => {
        Alert.alert(
          'Delete Course',
          `Are you sure you want to delete "${course.title || 'Untitled Course'}"? This action cannot be undone.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteCourse(course.id) },
          ]
        );
      },
    });

    Alert.alert(course.title || 'Course Options', undefined, options.map(o => ({
      text: o.label,
      onPress: o.onPress,
      style: o.label === 'Delete' ? 'destructive' as const : 'default' as const,
    })));
  }, [submitForReview, archiveCourse, unarchiveCourse, duplicateCourse, deleteCourse]);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Courses</Text>
          <Text style={styles.subtitle}>Create and manage your own courses</Text>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalCourses}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#00C853' }]}>{stats.publishedCourses}</Text>
            <Text style={styles.statLabel}>Published</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#6C63FF' }]}>{stats.draftCourses}</Text>
            <Text style={styles.statLabel}>Drafts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#3B82F6' }]}>{stats.totalEnrollments}</Text>
            <Text style={styles.statLabel}>Students</Text>
          </View>
        </View>

        {/* Create Button */}
        <AnimatedPressable onPress={handleCreateCourse} haptic="medium" scaleTo={0.97}>
          <View style={styles.createBtn}>
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.createBtnText}>Create New Course</Text>
          </View>
        </AnimatedPressable>

        {/* ── Review Status Section ── */}
        <ReviewStatusSection
          courses={myCourses}
          colors={colors}
          styles={styles}
          navigation={navigation}
        />

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {(['all', 'published', 'draft', 'archived'] as const).map(filter => {
            const isActive = activeFilter === filter;
            const count = filter === 'all'
              ? myCourses.length
              : myCourses.filter(c => c.publishStatus === filter).length;
            return (
              <AnimatedPressable
                key={filter}
                onPress={() => setActiveFilter(filter)}
                haptic="selection"
                scaleTo={0.94}
              >
                <View style={[
                  styles.filterChip,
                  isActive && { backgroundColor: colors.primary + '30', borderColor: colors.primary },
                ]}>
                  <Text style={[
                    styles.filterChipText,
                    isActive && { color: colors.primary },
                  ]}>
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.filterCount, isActive && { backgroundColor: colors.primary }]}>
                      <Text style={styles.filterCountText}>{count}</Text>
                    </View>
                  )}
                </View>
              </AnimatedPressable>
            );
          })}
        </View>

        {/* Course Cards */}
        {sortedCourses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="school-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No courses yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "Create New Course" to start{'\n'}building your first course!
            </Text>
          </View>
        ) : (
          sortedCourses.map((course, idx) => (
            <Animated.View
              key={course.id}
              entering={FadeInDown.delay(idx * 50).springify()}
              layout={Layout.springify()}
            >
              <CourseCard
                course={course}
                onEdit={() => handleEditCourse(course)}
                onMore={() => handleMoreOptions(course)}
                colors={colors}
                styles={styles}
              />
            </Animated.View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function CourseCard({
  course, onEdit, onMore, colors, styles,
}: {
  course: UserGeneratedCourse;
  onEdit: () => void;
  onMore: () => void;
  colors: any;
  styles: any;
}) {
  const [grad1, grad2] = statusGradient(course.publishStatus);

  return (
    <View style={styles.courseCard}>
      {/* Top: Thumbnail + Info */}
      <View style={styles.courseCardRow}>
        <View style={[styles.thumbnailBox, { backgroundColor: grad1 + '25' }]}>
          <Text style={styles.thumbnailText}>{course.thumbnail || '📚'}</Text>
        </View>
        <View style={styles.courseCardInfo}>
          <Text style={styles.courseTitle} numberOfLines={1}>
            {course.title || 'Untitled Course'}
          </Text>
          <Text style={styles.courseDesc} numberOfLines={2}>
            {course.description || 'No description yet'}
          </Text>
          <View style={styles.courseMetaRow}>
            <Text style={styles.courseMeta}>{course.lessonsCount} lessons</Text>
            <Text style={styles.courseMeta}> · </Text>
            <Text style={styles.courseMeta}>{course.duration}</Text>
          </View>
        </View>
      </View>

      {/* Status Badge + Actions */}
      <View style={styles.courseCardFooter}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: grad1 + '20', borderColor: grad1 + '40' }]}>
          <Ionicons
            name={statusIcon(course.publishStatus)}
            size={12}
            color={grad1}
          />
          <Text style={[styles.statusText, { color: grad1 }]}>
            {statusLabel(course.publishStatus)}
          </Text>
          {course.submittedForReview && course.publishStatus === 'draft' && (
            <Text style={[styles.statusText, { color: '#FFC107', fontSize: 10 }]}> · Pending</Text>
          )}
        </View>

        {/* Updated time */}
        <Text style={styles.updatedText}>{formatRelativeTime(course.updatedAt)}</Text>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <AnimatedPressable onPress={onEdit} haptic="light" scaleTo={0.92}>
            <View style={[styles.actionBtn, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="create-outline" size={16} color={colors.primary} />
            </View>
          </AnimatedPressable>
          <AnimatedPressable onPress={onMore} haptic="light" scaleTo={0.92}>
            <View style={[styles.actionBtn, { backgroundColor: colors.bgCardLight }]}>
              <Ionicons name="ellipsis-vertical" size={16} color={colors.text} />
            </View>
          </AnimatedPressable>
        </View>
      </View>
    </View>
  );
}

// ─── Review Status Section ────────────────────────────────────────────

function ReviewStatusSection({
  courses, colors, styles, navigation,
}: {
  courses: UserGeneratedCourse[];
  colors: any;
  styles: any;
  navigation: any;
}) {
  // Derive review status categories
  const pendingReview = useMemo(() =>
    courses.filter(c => c.submittedForReview && c.publishStatus === 'draft'),
  [courses]);

  const approved = useMemo(() =>
    courses.filter(c => c.publishStatus === 'published'),
  [courses]);

  const rejected = useMemo(() =>
    courses.filter(c =>
      !c.submittedForReview &&
      c.publishStatus === 'draft' &&
      c.reviewNotes !== undefined &&
      c.reviewNotes.length > 0
    ),
  [courses]);

  const hasReviewActivity = pendingReview.length > 0 || rejected.length > 0;

  // Don't show the section if nothing noteworthy
  if (!hasReviewActivity) return null;

  return (
    <View style={styles.reviewSection}>
      {/* Header */}
      <View style={styles.reviewHeader}>
        <Ionicons name="shield-checkmark" size={18} color={colors.warning} />
        <Text style={styles.reviewTitle}>Review Status</Text>
      </View>

      {/* Summary chips row */}
      <View style={styles.reviewChipsRow}>
        {pendingReview.length > 0 && (
          <View style={[styles.reviewChip, { backgroundColor: '#FFC107' + '20', borderColor: '#FFC107' + '50' }]}>
            <View style={[styles.reviewChipDot, { backgroundColor: '#FFC107' }]} />
            <Text style={[styles.reviewChipText, { color: '#FFC107' }]}>
              {pendingReview.length} Pending
            </Text>
          </View>
        )}
        {approved.length > 0 && (
          <View style={[styles.reviewChip, { backgroundColor: '#00C853' + '20', borderColor: '#00C853' + '50' }]}>
            <View style={[styles.reviewChipDot, { backgroundColor: '#00C853' }]} />
            <Text style={[styles.reviewChipText, { color: '#00C853' }]}>
              {approved.length} Approved
            </Text>
          </View>
        )}
        {rejected.length > 0 && (
          <View style={[styles.reviewChip, { backgroundColor: '#FF5252' + '20', borderColor: '#FF5252' + '50' }]}>
            <View style={[styles.reviewChipDot, { backgroundColor: '#FF5252' }]} />
            <Text style={[styles.reviewChipText, { color: '#FF5252' }]}>
              {rejected.length} Rejected
            </Text>
          </View>
        )}
      </View>

      {/* Pending Review Courses */}
      {pendingReview.length > 0 && (
        <View style={styles.reviewGroup}>
          <Text style={styles.reviewGroupTitle}>
            🟡 Pending Review
          </Text>
          {pendingReview.map(course => (
            <View key={course.id} style={[styles.reviewCourseCard, { borderLeftColor: '#FFC107' }]}>
              <View style={styles.reviewCourseRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewCourseTitle}>{course.title}</Text>
                  <Text style={styles.reviewCourseMeta}>{course.lessonsCount} lessons</Text>
                </View>
                <AnimatedPressable
                  onPress={() => navigation.navigate('CreateCourse', { courseId: course.id })}
                  haptic="light"
                  scaleTo={0.92}
                >
                  <View style={[styles.reviewActionBtn, { backgroundColor: '#FFC107' + '20' }]}>
                    <Ionicons name="eye-outline" size={16} color="#FFC107" />
                  </View>
                </AnimatedPressable>
              </View>
              <Text style={styles.reviewCourseDate}>Submitted {formatRelativeTime(course.updatedAt)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Rejected Courses */}
      {rejected.length > 0 && (
        <View style={styles.reviewGroup}>
          <Text style={styles.reviewGroupTitle}>
            ❌ Rejected — Needs Changes
          </Text>
          {rejected.map(course => (
            <View key={course.id} style={[styles.reviewCourseCard, { borderLeftColor: '#FF5252' }]}>
              <View style={styles.reviewCourseRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewCourseTitle}>{course.title}</Text>
                  {course.reviewNotes && (
                    <View style={styles.reviewNotesBox}>
                      <Ionicons name="chatbubble-ellipses-outline" size={12} color="#FF5252" />
                      <Text style={styles.reviewNotesText} numberOfLines={3}>
                        {course.reviewNotes}
                      </Text>
                    </View>
                  )}
                </View>
                <AnimatedPressable
                  onPress={() => navigation.navigate('CreateCourse', { courseId: course.id })}
                  haptic="light"
                  scaleTo={0.92}
                >
                  <View style={[styles.reviewActionBtn, { backgroundColor: '#FF5252' + '20' }]}>
                    <Ionicons name="create-outline" size={16} color="#FF5252" />
                  </View>
                </AnimatedPressable>
              </View>
            </View>
          ))}
        </View>
      )}
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
    paddingTop: 60,
    marginBottom: SPACING.lg,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.text,
  },
  statLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: colors.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  createBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#fff',
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  filterCount: {
    backgroundColor: colors.bgCardLight,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: {
    ...FONTS.bold,
    fontSize: 10,
    color: colors.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.md,
  },
  emptyTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.textMuted,
  },
  emptySubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  courseCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  courseCardRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  thumbnailBox: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailText: {
    fontSize: 28,
  },
  courseCardInfo: {
    flex: 1,
  },
  courseTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  courseDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  courseMetaRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  courseMeta: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  courseCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  statusText: {
    ...FONTS.medium,
    fontSize: 11,
  },
  updatedText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Review Status Styles ──
  reviewSection: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  reviewTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  reviewChipsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    flexWrap: 'wrap',
  },
  reviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  reviewChipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  reviewChipText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  reviewGroup: {
    marginBottom: SPACING.sm,
  },
  reviewGroupTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
    marginBottom: SPACING.sm,
  },
  reviewCourseCard: {
    backgroundColor: colors.bgSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
  },
  reviewCourseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  reviewCourseTitle: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  reviewCourseMeta: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  reviewCourseDate: {
    ...FONTS.regular,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  reviewNotesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 4,
    backgroundColor: '#FF5252' + '10',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  reviewNotesText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    lineHeight: 16,
    flex: 1,
  },
  reviewActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
