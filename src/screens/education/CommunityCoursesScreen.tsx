/**
 * Toroloom — Community Courses Browser
 *
 * Allows users to discover, filter, and enroll in published courses
 * created by other users (creator community).
 *
 * Features:
 *   - Featured courses carousel (horizontal scroll, sorted first)
 *   - Search by title / creator name
 *   - Filter by level (beginner / intermediate / advanced)
 *   - Filter by category
 *   - Published course cards with stats & enroll button
 *   - Enrolled badge on courses user has joined
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Platform,
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useUserCourseStore } from '../../store/userCourseStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { UserGeneratedCourse } from '../../types';

type LevelFilter = 'all' | 'beginner' | 'intermediate' | 'advanced';

const CATEGORIES = [
  'All', 'Finance', 'Investing', 'Technical', 'Fundamentals',
  'Derivatives', 'Psychology', 'Trading', 'Options', 'Personal Finance', 'Economics',
] as const;

const LEVEL_COLORS: Record<string, [string, string]> = {
  beginner: ['#00C853', '#009624'],
  intermediate: ['#FF9800', '#E65100'],
  advanced: ['#FF5252', '#D50000'],
};

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

export default function CommunityCoursesScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    myCourses, enrolledCommunityCourseIds,
    enrollInCommunityCourse, unenrollFromCommunityCourse,
    isEnrolledInCommunityCourse, loadFromCache,
  } = useUserCourseStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeLevel, setActiveLevel] = useState<LevelFilter>('all');
  const [activeCategory, setActiveCategory] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  // Reload from cache on focus
  useFocusEffect(
    useCallback(() => {
      loadFromCache();
    }, [loadFromCache])
  );

  // Get all published courses
  const allCommunityCourses = useMemo(() => myCourses.filter(c => c.publishStatus === 'published'), [myCourses]);

  // Separate featured and regular
  const { featured, regular } = useMemo(() => {
    const feat: UserGeneratedCourse[] = [];
    const reg: UserGeneratedCourse[] = [];
    allCommunityCourses.forEach(c => {
      if (c.isFeatured) feat.push(c);
      else reg.push(c);
    });
    // Sort featured by enrolledCount desc, then regular by updatedAt desc
    feat.sort((a, b) => b.enrolledCount - a.enrolledCount);
    reg.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return { featured: feat, regular: reg };
  }, [allCommunityCourses]);

  // Filter courses
  const filteredCourses = useMemo(() => {
    let list = allCommunityCourses;
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.creatorName.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    // Level filter
    if (activeLevel !== 'all') {
      list = list.filter(c => c.level === activeLevel);
    }
    // Category filter
    if (activeCategory !== 'All') {
      list = list.filter(c => c.category === activeCategory);
    }
    return list;
  }, [allCommunityCourses, searchQuery, activeLevel, activeCategory]);

  const handleEnrollToggle = useCallback((course: UserGeneratedCourse) => {
    if (isEnrolledInCommunityCourse(course.id)) {
      unenrollFromCommunityCourse(course.id);
    } else {
      enrollInCommunityCourse(course.id);
    }
  }, [enrollInCommunityCourse, unenrollFromCommunityCourse, isEnrolledInCommunityCourse]);

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
            <Text style={styles.title}>Community Courses</Text>
          </View>
          <Text style={styles.subtitle}>
            Discover courses created by fellow traders
          </Text>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search courses, creators, or topics..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <AnimatedPressable onPress={() => setSearchQuery('')} haptic="light" scaleTo={0.88}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </AnimatedPressable>
          )}
          <AnimatedPressable onPress={() => setShowFilters(!showFilters)} haptic="selection" scaleTo={0.88}>
            <Ionicons
              name={showFilters ? 'options' : 'options-outline'}
              size={20}
              color={showFilters ? colors.primary : colors.textMuted}
            />
          </AnimatedPressable>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{allCommunityCourses.length}</Text>
            <Text style={styles.statLabel}>Courses</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{featured.length}</Text>
            <Text style={styles.statLabel}>Featured</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.statValue, { color: colors.warning }]}>
              {enrolledCommunityCourseIds.length}
            </Text>
            <Text style={styles.statLabel}>Enrolled</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {allCommunityCourses.reduce((s, c) => s + c.enrolledCount, 0)}
            </Text>
            <Text style={styles.statLabel}>Students</Text>
          </View>
        </View>

        {/* Expandable Filters */}
        {showFilters && (
          <Animated.View entering={FadeInDown.springify()} style={styles.filtersSection}>
            {/* Level Filter */}
            <Text style={styles.filterLabel}>Level</Text>
            <View style={styles.chipRow}>
              {(['all', 'beginner', 'intermediate', 'advanced'] as const).map(level => {
                const isActive = activeLevel === level;
                return (
                  <AnimatedPressable
                    key={level}
                    onPress={() => setActiveLevel(level)}
                    haptic="selection"
                    scaleTo={0.94}
                  >
                    <View style={[
                      styles.filterChip,
                      isActive && {
                        backgroundColor: level === 'all' ? colors.primary + '30'
                          : (LEVEL_COLORS[level]?.[0] ?? colors.primary) + '30',
                        borderColor: level === 'all' ? colors.primary
                          : (LEVEL_COLORS[level]?.[0] ?? colors.primary),
                      },
                    ]}>
                      <Text style={[
                        styles.filterChipText,
                        isActive && {
                          color: level === 'all' ? colors.primary
                            : (LEVEL_COLORS[level]?.[0] ?? colors.primary),
                        },
                      ]}>
                        {level === 'all' ? 'All Levels' : level.charAt(0).toUpperCase() + level.slice(1)}
                      </Text>
                    </View>
                  </AnimatedPressable>
                );
              })}
            </View>

            {/* Category Filter */}
            <Text style={styles.filterLabel}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.slice(0, 6).map(cat => {
                const isActive = activeCategory === cat;
                return (
                  <AnimatedPressable
                    key={cat}
                    onPress={() => setActiveCategory(cat)}
                    haptic="selection"
                    scaleTo={0.94}
                  >
                    <View style={[
                      styles.categoryChip,
                      isActive && {
                        backgroundColor: colors.primary + '30',
                        borderColor: colors.primary,
                      },
                    ]}>
                      <Text style={[
                        styles.categoryChipText,
                        isActive && { color: colors.primary },
                      ]}>{cat}</Text>
                    </View>
                  </AnimatedPressable>
                );
              })}
            </View>
            {CATEGORIES.length > 6 && (
              <View style={styles.chipRow}>
                {CATEGORIES.slice(6).map(cat => {
                  const isActive = activeCategory === cat;
                  return (
                    <AnimatedPressable
                      key={cat}
                      onPress={() => setActiveCategory(cat)}
                      haptic="selection"
                      scaleTo={0.94}
                    >
                      <View style={[
                        styles.categoryChip,
                        isActive && {
                          backgroundColor: colors.primary + '30',
                          borderColor: colors.primary,
                        },
                      ]}>
                        <Text style={[
                          styles.categoryChipText,
                          isActive && { color: colors.primary },
                        ]}>{cat}</Text>
                      </View>
                    </AnimatedPressable>
                  );
                })}
              </View>
            )}
          </Animated.View>
        )}

        {/* Featured Courses Carousel */}
        {featured.length > 0 && searchQuery === '' && activeLevel === 'all' && activeCategory === 'All' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star" size={18} color={colors.warning} />
              <Text style={styles.sectionTitle}>Featured Courses</Text>
              <Text style={styles.sectionCount}>{featured.length}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {featured.map((course, idx) => (
                <Animated.View
                  key={course.id}
                  entering={FadeInDown.delay(idx * 80).springify()}
                >
                  <FeaturedCourseCard
                    course={course}
                    isEnrolled={enrolledCommunityCourseIds.includes(course.id)}
                    onEnrollToggle={() => handleEnrollToggle(course)}
                    colors={colors}
                    styles={styles}
                  />
                </Animated.View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* All / Filtered Courses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {searchQuery ? `Results (${filteredCourses.length})` :
               activeLevel !== 'all' || activeCategory !== 'All' ? `Filtered (${filteredCourses.length})` :
               'All Community Courses'}
            </Text>
            {filteredCourses.length > 0 && (
              <Text style={styles.sectionCount}>{filteredCourses.length}</Text>
            )}
          </View>

          {filteredCourses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name={searchQuery ? 'search-outline' : 'school-outline'}
                size={56}
                color={colors.textMuted}
              />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No courses found' : 'No courses yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `No courses match "${searchQuery}". Try a different search term.`
                  : 'No published community courses yet. Check back later!'}
              </Text>
            </View>
          ) : (
            <View style={styles.courseGrid}>
              {filteredCourses.map((course, idx) => (
                <Animated.View
                  key={course.id}
                  entering={FadeInDown.delay(idx * 40).springify()}
                  layout={Layout.springify()}
                >
                  <CommunityCourseCard
                    course={course}
                    isEnrolled={enrolledCommunityCourseIds.includes(course.id)}
                    onEnrollToggle={() => handleEnrollToggle(course)}
                    colors={colors}
                    styles={styles}
                  />
                </Animated.View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Featured Course Card ──────────────────────────────────────

function FeaturedCourseCard({
  course, isEnrolled, onEnrollToggle, colors, styles,
}: {
  course: UserGeneratedCourse;
  isEnrolled: boolean;
  onEnrollToggle: () => void;
  colors: any;
  styles: any;
}) {
  const levelGrad = LEVEL_COLORS[course.level] || ['#6C63FF', '#3B82F6'];

  return (
    <LinearGradient
      colors={levelGrad}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.featuredCard}
    >
      <View style={styles.featuredHeader}>
        <Text style={styles.featuredIcon}>{course.thumbnail || '📚'}</Text>
        {course.isFeatured && (
          <View style={styles.featuredStarBadge}>
            <Ionicons name="star" size={12} color="#fff" />
          </View>
        )}
      </View>
      <Text style={styles.featuredTitle} numberOfLines={2}>{course.title}</Text>
      <Text style={styles.featuredCreator}>by {course.creatorName}</Text>
      <View style={styles.featuredMeta}>
        <Text style={styles.featuredMetaText}>{course.lessonsCount} lessons</Text>
        <Text style={styles.featuredMetaDot}> · </Text>
        <Text style={styles.featuredMetaText}>{course.duration}</Text>
      </View>
      <View style={styles.featuredFooter}>
        <View style={styles.featuredStats}>
          <Ionicons name="people" size={12} color="rgba(255,255,255,0.8)" />
          <Text style={styles.featuredStatText}>{course.enrolledCount}</Text>
        </View>
        <AnimatedPressable onPress={onEnrollToggle} haptic="medium" scaleTo={0.92}>
          <View style={[
            styles.enrollBadge,
            isEnrolled && styles.enrollBadgeActive,
          ]}>
            <Ionicons
              name={isEnrolled ? 'checkmark' : 'add'}
              size={14}
              color={isEnrolled ? '#fff' : levelGrad[0]}
            />
            <Text style={[
              styles.enrollBadgeText,
              isEnrolled && styles.enrollBadgeTextActive,
            ]}>
              {isEnrolled ? 'Enrolled' : 'Enroll'}
            </Text>
          </View>
        </AnimatedPressable>
      </View>
    </LinearGradient>
  );
}

// ─── Community Course Card ─────────────────────────────────────

function CommunityCourseCard({
  course, isEnrolled, onEnrollToggle, colors, styles,
}: {
  course: UserGeneratedCourse;
  isEnrolled: boolean;
  onEnrollToggle: () => void;
  colors: any;
  styles: any;
}) {
  const levelGrad = LEVEL_COLORS[course.level] || ['#6C63FF', '#3B82F6'];

  return (
    <View style={styles.courseCard}>
      <View style={styles.courseCardRow}>
        <LinearGradient
          colors={levelGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.courseThumb}
        >
          <Text style={styles.courseThumbText}>{course.thumbnail || '📚'}</Text>
        </LinearGradient>
        <View style={styles.courseInfo}>
          <Text style={styles.courseTitle} numberOfLines={1}>{course.title}</Text>
          <Text style={styles.creatorName}>by {course.creatorName}</Text>
          <View style={styles.courseMetaRow}>
            <View style={[styles.levelBadge, { backgroundColor: levelGrad[0] + '20', borderColor: levelGrad[0] + '40' }]}>
              <Text style={[styles.levelBadgeText, { color: levelGrad[0] }]}>
                {course.level.charAt(0).toUpperCase() + course.level.slice(1)}
              </Text>
            </View>
            <Text style={styles.courseMeta}>{course.lessonsCount} lessons</Text>
          </View>
          <Text style={styles.courseDesc} numberOfLines={2}>{course.description}</Text>
          <View style={styles.courseCardFooter}>
            <View style={styles.courseStatsRow}>
              <Ionicons name="people" size={12} color={colors.textMuted} />
              <Text style={styles.courseStatText}>{course.enrolledCount}</Text>
              <Text style={styles.courseStatDot}> · </Text>
              <Text style={styles.courseStatText}>{formatRelativeTime(course.publishedAt || course.updatedAt)}</Text>
            </View>
            <AnimatedPressable onPress={onEnrollToggle} haptic="medium" scaleTo={0.92}>
              <View style={[
                styles.enrollBtn,
                isEnrolled && { backgroundColor: colors.success + '20', borderColor: colors.success },
              ]}>
                <Ionicons
                  name={isEnrolled ? 'checkmark-circle' : 'add-circle'}
                  size={16}
                  color={isEnrolled ? colors.success : colors.primary}
                />
                <Text style={[
                  styles.enrollBtnText,
                  isEnrolled && { color: colors.success },
                ]}>
                  {isEnrolled ? 'Enrolled' : 'Enroll'}
                </Text>
              </View>
            </AnimatedPressable>
          </View>
        </View>
      </View>
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

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  searchInput: {
    flex: 1,
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    paddingVertical: 0,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
  },
  statLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Filters
  filtersSection: {
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
  },
  filterLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCardLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.text,
  },
  categoryChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCardLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
  },

  // Section
  section: {
    marginBottom: SPACING.xl,
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
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },

  // Featured Card
  featuredCard: {
    width: 220,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginRight: SPACING.md,
    justifyContent: 'space-between',
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  featuredIcon: {
    fontSize: 32,
  },
  featuredStarBadge: {
    backgroundColor: 'rgba(255,193,7,0.3)',
    borderRadius: 10,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: '#fff',
    marginTop: SPACING.sm,
  },
  featuredCreator: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  featuredMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  featuredMetaText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  featuredMetaDot: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
  },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
  featuredStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredStatText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.8)',
  },
  enrollBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  enrollBadgeActive: {
    backgroundColor: colors.success,
  },
  enrollBadgeText: {
    ...FONTS.semiBold,
    fontSize: 10,
  },
  enrollBadgeTextActive: {
    color: '#fff',
  },

  // Course Grid
  courseGrid: {
    gap: SPACING.md,
  },
  courseCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  courseCardRow: {
    flexDirection: 'row',
    padding: SPACING.md,
  },
  courseThumb: {
    width: 72,
    height: 72,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseThumbText: {
    fontSize: 28,
  },
  courseInfo: {
    flex: 1,
    marginLeft: SPACING.md,
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
  courseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  levelBadgeText: {
    ...FONTS.bold,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  courseMeta: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  courseDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  courseCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  courseStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  courseStatText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  courseStatDot: {
    color: colors.textMuted,
    fontSize: 10,
  },
  enrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  enrollBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: colors.primary,
  },

  // Empty State
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
    paddingHorizontal: SPACING.xl,
  },
});
