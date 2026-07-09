/**
 * ============================================================================
 * Toroloom — Learning Paths Screen
 * ============================================================================
 *
 * Curated learning sequences:
 *   1. Investing Fundamentals (Beginner) — 🌱
 *   2. Technical & Fundamental Trader (Intermediate) — 📊
 *   3. Options & Portfolio Pro (Advanced) — 🎯
 *
 * Each path card shows: title, description, progress, enrolled count,
 * total duration, and skills gained. Tapping navigates to detail view.
 * ============================================================================
 */

import React, { useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useEducationStore } from '../../store/educationStore';
import { mockLearningPaths } from '../../constants/mockData';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
const { width } = Dimensions.get('window');

export default function LearningPathsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { lessonProgress, courses } = useEducationStore();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Refresh from store
    setRefreshing(false);
  }, []);

  // Calculate progress for each path
  const pathsWithProgress = useMemo(() => {
    return mockLearningPaths.map(path => {
      const pathCourses = path.courseIds.map(cid => courses.find(c => c.id === cid)).filter(Boolean);
      const totalLessonsInPath = pathCourses.reduce((sum, c) => sum + (c?.lessons || 0), 0);

      // Count completed lessons
      const completedCount = Object.keys(lessonProgress).length;
      const progress = totalLessonsInPath > 0
        ? Math.min(100, Math.round((completedCount / (totalLessonsInPath || 1)) * 100))
        : 0;

      // Calculate completed courses
      const completedCourses = pathCourses.filter(c => {
        if (!c) return false;
        return c.lessons > 0 && (progress >= (c.lessons / totalLessonsInPath) * 100);
      }).length;

      return { ...path, progress, completedCourses, totalCourses: pathCourses.length };
    });
  }, [courses, lessonProgress]);

  const handlePathPress = useCallback((pathId: string) => {
    navigation.navigate('LearningPathDetail', { pathId });
  }, [navigation]);

  // ── Rank badges for levels ──
  const levelConfig: Record<string, { label: string; color: string }> = {
    beginner: { label: 'Beginner', color: '#00E676' },
    intermediate: { label: 'Intermediate', color: '#6C63FF' },
    advanced: { label: 'Advanced', color: '#FF5252' },
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Learning Paths</Text>
            <Text style={styles.subtitle}>Curated sequences to master the markets</Text>
          </View>
        </View>

        {/* Summary Banner */}
        <LinearGradient
          colors={[colors.primary + '30', colors.bgCard]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryBanner}
        >
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{mockLearningPaths.length}</Text>
              <Text style={styles.summaryLabel}>Paths</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{mockLearningPaths.reduce((s, p) => s + p.courseIds.length, 0)}</Text>
              <Text style={styles.summaryLabel}>Courses</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{mockLearningPaths.reduce((s, p) => s + p.totalLessons, 0)}</Text>
              <Text style={styles.summaryLabel}>Lessons</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{(mockLearningPaths.reduce((s, p) => s + p.enrolledCount, 0) / 1000).toFixed(0)}K</Text>
              <Text style={styles.summaryLabel}>Learners</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Path Cards */}
        {pathsWithProgress.map((path, index) => {
          const lvl = levelConfig[path.level] || { label: 'Beginner', color: '#00E676' };

          return (
            <Animated.View
              key={path.id}
              entering={FadeInDown.duration(400).delay(index * 150)}
            >
              <TouchableOpacity
                style={styles.pathCard}
                onPress={() => handlePathPress(path.id)}
                activeOpacity={0.85}
              >
                {/* Gradient Header */}
                <LinearGradient
                  colors={path.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pathHeader}
                >
                  <View style={styles.pathHeaderRow}>
                    <Text style={styles.pathIcon}>{path.icon}</Text>
                    <View style={styles.pathHeaderInfo}>
                      <Text style={styles.pathLevel}>{lvl.label}</Text>
                      <Text style={styles.pathTitle}>{path.title}</Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.pathProgressBarBg}>
                    <View
                      style={[styles.pathProgressBarFill, { width: `${path.progress}%` }]}
                    />
                  </View>
                  <Text style={styles.pathProgressText}>
                    {path.completedCourses}/{path.totalCourses} courses · {path.progress}% complete
                  </Text>
                </LinearGradient>

                {/* Body */}
                <View style={styles.pathBody}>
                  <Text style={styles.pathDescription} numberOfLines={2}>
                    {path.description}
                  </Text>

                  {/* Stats row */}
                  <View style={styles.pathStatsRow}>
                    <View style={styles.pathStat}>
                      <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.pathStatText}>{path.totalDuration}</Text>
                    </View>
                    <View style={styles.pathStat}>
                      <Ionicons name="book-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.pathStatText}>{path.totalLessons} lessons</Text>
                    </View>
                    <View style={styles.pathStat}>
                      <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.pathStatText}>{(path.enrolledCount / 1000).toFixed(1)}K</Text>
                    </View>
                  </View>

                  {/* Target audience */}
                  <View style={styles.audienceRow}>
                    <Ionicons name="bulb-outline" size={14} color={colors.warning} />
                    <Text style={styles.audienceText} numberOfLines={1}>{path.targetAudience}</Text>
                  </View>

                  {/* Skills */}
                  <View style={styles.skillsRow}>
                    {path.skillsGained.slice(0, 4).map((skill, i) => (
                      <View key={i} style={[styles.skillChip, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                        <Ionicons name="checkmark-circle" size={10} color={colors.primary} />
                        <Text style={[styles.skillChipText, { color: colors.primary }]}>{skill}</Text>
                      </View>
                    ))}
                    {path.skillsGained.length > 4 && (
                      <View style={[styles.skillChip, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
                        <Text style={[styles.skillChipText, { color: colors.textMuted }]}>+{path.skillsGained.length - 4}</Text>
                      </View>
                    )}
                  </View>

                  {/* CTA */}
                  <View style={styles.ctaRow}>
                    <Text style={[styles.ctaText, { color: lvl.color }]}>
                      {path.progress > 0 ? 'Continue Path →' : 'Start Path →'}
                    </Text>
                    <Ionicons name="arrow-forward-circle" size={20} color={lvl.color} />
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
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
    scrollContent: {
      paddingBottom: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 60,
      paddingHorizontal: SPACING.xl,
      marginBottom: SPACING.lg,
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
    headerText: {
      flex: 1,
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
      marginTop: 2,
    },
    summaryBanner: {
      marginHorizontal: SPACING.xl,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryDivider: {
      width: 1,
      height: 32,
      backgroundColor: colors.border,
    },
    summaryValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.xl,
      color: colors.text,
    },
    summaryLabel: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
    pathCard: {
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.lg,
      borderRadius: BORDER_RADIUS.xl,
      overflow: 'hidden',
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pathHeader: {
      padding: SPACING.xl,
    },
    pathHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    pathIcon: {
      fontSize: 40,
    },
    pathHeaderInfo: {
      flex: 1,
    },
    pathLevel: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.7)',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    pathTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.xxl,
      color: colors.white,
      marginTop: 2,
    },
    pathProgressBarBg: {
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: SPACING.xs,
    },
    pathProgressBarFill: {
      height: '100%',
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderRadius: 2,
    },
    pathProgressText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.7)',
    },
    pathBody: {
      padding: SPACING.xl,
      gap: SPACING.md,
    },
    pathDescription: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    pathStatsRow: {
      flexDirection: 'row',
      gap: SPACING.lg,
    },
    pathStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    pathStatText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    audienceRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      backgroundColor: colors.bgInput,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
    },
    audienceText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textSecondary,
      flex: 1,
    },
    skillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.xs,
    },
    skillChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
    },
    skillChipText: {
      ...FONTS.regular,
      fontSize: 10,
    },
    ctaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: SPACING.xs,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    ctaText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
    },
  });
