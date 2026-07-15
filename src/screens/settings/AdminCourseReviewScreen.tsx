/**
 * Toroloom — Admin Course Review Screen
 *
 * Admin panel for reviewing user-submitted courses:
 *   - View all pending review submissions
 *   - Approve courses (with optional admin notes)
 *   - Reject courses (with required review notes)
 *   - Toggle featured status on published courses
 *   - Filter: Pending / Approved / Rejected / All
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TextInput, Platform,
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useUserCourseStore } from '../../store/userCourseStore';
import { useAuthStore } from '../../store/authStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { UserGeneratedCourse } from '../../types';

type ReviewFilter = 'pending' | 'approved' | 'rejected' | 'all';

/** Format relative time string */
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

/** Get submission stats from a list of courses */
function getSubmissionStats(courses: UserGeneratedCourse[]) {
  const pending = courses.filter(c => c.submittedForReview && c.publishStatus === 'draft');
  const approved = courses.filter(c => c.publishStatus === 'published');
  const rejected = courses.filter(c => !c.submittedForReview && c.publishStatus === 'draft' && c.reviewNotes);
  return { pending, approved, rejected };
}

export default function AdminCourseReviewScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isAdmin = useAuthStore(s => s.isAdmin);
  const {
    myCourses, approveCourse, rejectCourse, toggleFeatured,
    getPendingCourses,
  } = useUserCourseStore();

  const [activeFilter, setActiveFilter] = useState<ReviewFilter>('pending');
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  // Reload from cache on focus
  useFocusEffect(
    useCallback(() => {
      useUserCourseStore.getState().loadFromCache();
    }, [])
  );

  // Redirect non-admin users
  useFocusEffect(
    useCallback(() => {
      if (!isAdmin) {
        Alert.alert('Access Denied', 'You do not have admin privileges.');
        navigation.goBack();
      }
    }, [isAdmin, navigation])
  );

  const stats = useMemo(() => getSubmissionStats(myCourses), [myCourses]);

  const filteredCourses = useMemo(() => {
    switch (activeFilter) {
      case 'pending':
        return getPendingCourses();
      case 'approved':
        return myCourses.filter(c => c.publishStatus === 'published');
      case 'rejected':
        return myCourses.filter(c =>
          !c.submittedForReview && c.publishStatus === 'draft' && c.reviewNotes
        );
      case 'all':
      default:
        return myCourses.filter(c => c.submittedForReview || c.reviewNotes || c.publishStatus === 'published');
    }
  }, [activeFilter, myCourses, getPendingCourses]);

  const sortedCourses = useMemo(() => {
    return [...filteredCourses].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [filteredCourses]);

  const handleApprove = useCallback((course: UserGeneratedCourse) => {
    Alert.alert(
      'Approve Course',
      `Publish "${course.title || 'Untitled Course'}" to the course catalog?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Publish',
          onPress: () => {
            approveCourse(course.id);
            Alert.alert('✅ Published', `${course.title || 'Course'} has been published to the catalog.`);
          },
        },
      ]
    );
  }, [approveCourse]);

  const handleRejectWithNotes = useCallback((course: UserGeneratedCourse) => {
    Alert.alert(
      'Reject Course',
      'Are you sure you want to reject this course? The creator will see your feedback notes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Rejection',
          onPress: () => {
            const notes = rejectNotes.trim();
            if (!notes) {
              Alert.alert('Notes Required', 'Please provide feedback explaining why the course was rejected.');
              return;
            }
            rejectCourse(course.id, notes);
            setRejectNotes('');
            setExpandedCourseId(null);
            Alert.alert('❌ Rejected', 'The course has been rejected. The creator will see your feedback.');
          },
        },
      ]
    );
  }, [rejectCourse, rejectNotes]);

  const handleToggleFeatured = useCallback((course: UserGeneratedCourse) => {
    toggleFeatured(course.id);
    const action = course.isFeatured ? 'removed from' : 'added to';
    Alert.alert('⭐ Updated', `Course ${action} featured.`);
  }, [toggleFeatured]);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.92}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </AnimatedPressable>
            <Text style={styles.title}>Course Reviews</Text>
          </View>
          <Text style={styles.subtitle}>Review and manage user-submitted courses</Text>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: colors.warning + '40' }]}>
            <Text style={[styles.statValue, { color: colors.warning }]}>{stats.pending.length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, { borderColor: colors.success + '40' }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{stats.approved.length}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={[styles.statCard, { borderColor: colors.danger + '40' }]}>
            <Text style={[styles.statValue, { color: colors.danger }]}>{stats.rejected.length}</Text>
            <Text style={styles.statLabel}>Rejected</Text>
          </View>
          <View style={[styles.statCard, { borderColor: colors.textMuted + '40' }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{myCourses.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {(['pending', 'approved', 'rejected', 'all'] as const).map(filter => {
            const isActive = activeFilter === filter;
            const count = filter === 'pending' ? stats.pending.length
              : filter === 'approved' ? stats.approved.length
              : filter === 'rejected' ? stats.rejected.length
              : stats.pending.length + stats.approved.length + stats.rejected.length;
            return (
              <AnimatedPressable
                key={filter}
                onPress={() => setActiveFilter(filter)}
                haptic="selection"
                scaleTo={0.94}
              >
                <View style={[
                  styles.filterChip,
                  isActive && {
                    backgroundColor: filter === 'pending' ? colors.warning + '30'
                      : filter === 'approved' ? colors.success + '30'
                      : filter === 'rejected' ? colors.danger + '30'
                      : colors.primary + '30',
                    borderColor: filter === 'pending' ? colors.warning
                      : filter === 'approved' ? colors.success
                      : filter === 'rejected' ? colors.danger
                      : colors.primary,
                  },
                ]}>
                  <Text style={[
                    styles.filterChipText,
                    isActive && {
                      color: filter === 'pending' ? colors.warning
                        : filter === 'approved' ? colors.success
                        : filter === 'rejected' ? colors.danger
                        : colors.primary,
                    },
                  ]}>
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.filterCount, {
                      backgroundColor: isActive
                        ? (filter === 'pending' ? colors.warning
                          : filter === 'approved' ? colors.success
                          : filter === 'rejected' ? colors.danger
                          : colors.primary)
                        : colors.bgCardLight,
                    }]}>
                      <Text style={[styles.filterCountText, {
                        color: isActive ? '#fff' : colors.text,
                      }]}>{count}</Text>
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
            <Ionicons
              name={activeFilter === 'pending' ? 'checkmark-done-circle-outline'
                : 'document-text-outline'}
              size={64}
              color={colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {activeFilter === 'pending' ? 'No pending reviews' :
               activeFilter === 'approved' ? 'No approved courses' :
               activeFilter === 'rejected' ? 'No rejected courses' :
               'No reviewed courses'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'pending'
                ? 'When users submit courses for review, they\'ll appear here.'
                : 'No courses match this filter.'}
            </Text>
          </View>
        ) : (
          sortedCourses.map((course, idx) => (
            <Animated.View
              key={course.id}
              entering={FadeInDown.delay(idx * 50).springify()}
              layout={Layout.springify()}
            >
              <ReviewCard
                course={course}
                isExpanded={expandedCourseId === course.id}
                onToggleExpand={() => setExpandedCourseId(
                  prev => prev === course.id ? null : course.id
                )}
                onApprove={() => handleApprove(course)}
                onReject={() => handleRejectWithNotes(course)}
                onToggleFeatured={() => handleToggleFeatured(course)}
                rejectNotes={rejectNotes}
                setRejectNotes={setRejectNotes}
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

// ─── Review Card Component ─────────────────────────────────────

function ReviewCard({
  course, isExpanded, onToggleExpand,
  onApprove, onReject, onToggleFeatured,
  rejectNotes, setRejectNotes,
  colors, styles,
}: {
  course: UserGeneratedCourse;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onApprove: () => void;
  onReject: () => void;
  onToggleFeatured: () => void;
  rejectNotes: string;
  setRejectNotes: (val: string) => void;
  colors: any;
  styles: any;
}) {
  const isPending = course.submittedForReview && course.publishStatus === 'draft';
  const isApproved = course.publishStatus === 'published';
  const isRejected = !course.submittedForReview && course.publishStatus === 'draft' && !!course.reviewNotes;

  const statusColor = isPending ? colors.warning : isApproved ? colors.success : colors.danger;
  const statusLabel = isPending ? 'Pending Review' : isApproved ? 'Published' : 'Rejected';
  const statusIcon = isPending ? 'time' : isApproved ? 'checkmark-circle' : 'close-circle';

  return (
    <View style={[styles.courseCard, {
      borderLeftWidth: 3,
      borderLeftColor: statusColor,
    }]}>
      {/* Collapsed View */}
      <AnimatedPressable onPress={onToggleExpand} haptic="selection" scaleTo={0.98}>
        <View style={styles.cardHeader}>
          <View style={styles.cardThumb}>
            <Text style={styles.thumbText}>{course.thumbnail || '📚'}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.courseTitle} numberOfLines={1}>
              {course.title || 'Untitled Course'}
            </Text>
            <Text style={styles.creatorName}>by {course.creatorName}</Text>
            <View style={styles.cardMetaRow}>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor + '40' }]}>
                <Ionicons name={statusIcon} size={11} color={statusColor} />
                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              <Text style={styles.metaText}>{course.lessonsCount} lessons</Text>
              {course.isFeatured && (
                <View style={[styles.featuredBadge, { backgroundColor: colors.warning + '20', borderColor: colors.warning + '40' }]}>
                  <Ionicons name="star" size={10} color={colors.warning} />
                  <Text style={[styles.featuredText, { color: colors.warning }]}>Featured</Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </View>
      </AnimatedPressable>

      {/* Expanded Review Actions */}
      {isExpanded && (
        <Animated.View entering={FadeInDown.springify()} style={styles.cardExpanded}>
          {/* Course Details */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Description</Text>
            <Text style={styles.detailText} numberOfLines={3}>
              {course.description || 'No description'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Category</Text>
              <Text style={styles.detailValue}>{course.category}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Level</Text>
              <Text style={styles.detailValue}>{course.level}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Duration</Text>
              <Text style={styles.detailValue}>{course.duration}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Submitted</Text>
              <Text style={styles.detailValue}>{formatRelativeTime(course.updatedAt)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Lessons</Text>
              <Text style={styles.detailValue}>{course.lessonsCount}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Tags</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {course.tags?.length ? course.tags.slice(0, 2).join(', ') + (course.tags.length > 2 ? '...' : '') : '-'}
              </Text>
            </View>
          </View>

          {/* Rejection Notes */}
          {isRejected && course.reviewNotes && (
            <View style={[styles.notesBox, { backgroundColor: colors.danger + '10', borderColor: colors.danger + '20' }]}>
              <Ionicons name="chatbubble-ellipses" size={14} color={colors.danger} />
              <View style={styles.notesContent}>
                <Text style={[styles.notesLabel, { color: colors.danger }]}>Review Notes</Text>
                <Text style={[styles.notesText, { color: colors.text }]}>{course.reviewNotes}</Text>
              </View>
            </View>
          )}

          {/* Rejection Input (for pending courses) */}
          {isPending && (
            <View style={styles.rejectInputSection}>
              <Text style={styles.detailLabel}>Rejection Notes (required for rejection)</Text>
              <TextInput
                style={[styles.rejectInput, {
                  backgroundColor: colors.bgCard,
                  borderColor: colors.border,
                  color: colors.text,
                }]}
                placeholder="Explain why the course is being rejected..."
                placeholderTextColor={colors.textMuted}
                value={rejectNotes}
                onChangeText={setRejectNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {isPending ? (
              <>
                <AnimatedPressable onPress={() => {
                  if (!rejectNotes.trim()) {
                    Alert.alert('Notes Required', 'Please provide feedback before rejecting.');
                    return;
                  }
                  onReject();
                }} haptic="warning" scaleTo={0.94}>
                  <View style={[styles.actionBtn, { backgroundColor: colors.danger + '20' }]}>
                    <Ionicons name="close-circle" size={16} color={colors.danger} />
                    <Text style={[styles.actionBtnText, { color: colors.danger }]}>Reject</Text>
                  </View>
                </AnimatedPressable>
                <AnimatedPressable onPress={onApprove} haptic="medium" scaleTo={0.94}>
                  <View style={[styles.actionBtn, { backgroundColor: colors.success + '20' }]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={[styles.actionBtnText, { color: colors.success }]}>Approve & Publish</Text>
                  </View>
                </AnimatedPressable>
              </>
            ) : isApproved ? (
              <>
                <AnimatedPressable onPress={onToggleFeatured} haptic="medium" scaleTo={0.94}>
                  <View style={[styles.actionBtn, {
                    backgroundColor: course.isFeatured ? colors.warning + '20' : colors.bgCardLight,
                  }]}>
                    <Ionicons
                      name="star"
                      size={16}
                      color={course.isFeatured ? colors.warning : colors.textMuted}
                    />
                    <Text style={[styles.actionBtnText, {
                      color: course.isFeatured ? colors.warning : colors.textMuted,
                    }]}>
                      {course.isFeatured ? 'Unfeature' : 'Feature'}
                    </Text>
                  </View>
                </AnimatedPressable>
              </>
            ) : isRejected ? (
              <View style={styles.rejectedInfo}>
                <Ionicons name="information-circle" size={16} color={colors.textMuted} />
                <Text style={[styles.rejectedInfoText, { color: colors.textMuted }]}>
                  Creator will see the review notes and can resubmit after making changes.
                </Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 4,
    marginLeft: Platform.OS === 'ios' ? 52 : 48,
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
    borderWidth: 1,
  },
  statValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
  },
  statLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
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
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  cardThumb: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: colors.bgCardLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbText: {
    fontSize: 24,
  },
  cardInfo: {
    flex: 1,
  },
  courseTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  creatorName: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  statusText: {
    ...FONTS.medium,
    fontSize: 10,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  featuredText: {
    ...FONTS.bold,
    fontSize: 9,
  },
  metaText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  cardExpanded: {
    padding: SPACING.lg,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  detailSection: {
    marginBottom: SPACING.md,
  },
  detailLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  detailText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.text,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  detailItem: {
    flex: 1,
  },
  detailValue: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  notesBox: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  notesContent: {
    flex: 1,
  },
  notesLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    marginBottom: 2,
  },
  notesText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    lineHeight: 18,
  },
  rejectInputSection: {
    marginBottom: SPACING.md,
  },
  rejectInput: {
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONTS.size.sm,
    borderWidth: 1,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  actionBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  rejectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    flex: 1,
  },
  rejectedInfoText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    flex: 1,
  },
});
