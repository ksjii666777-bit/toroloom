/**
 * ============================================================================
 * Toroloom — Wealth Dashboard Screen
 * ============================================================================
 *
 * Main hub for wealth management featuring:
 *   - Net worth overview with assets/liabilities breakdown
 *   - Financial goals summary with progress bars
 *   - Monthly savings rate
 *   - Quick actions (create goal, retirement planner)
 *   - Market insights and tips
 *
 * Navigation: More → Wealth Dashboard
 * ============================================================================
 */

import React, { useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Dimensions, Platform,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { useWealthStore, type FinancialGoal } from '../../store/wealthStore';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

const { width } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────

const _formatINR = (n: number) =>
  '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const formatCompactINR = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return '₹' + (n / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return '₹' + (n / 1e5).toFixed(2) + 'L';
  if (abs >= 1e3) return '₹' + (n / 1e3).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
};

const GOAL_ICONS: Record<string, string> = {
  retirement: '🏖️', education: '🎓', house: '🏠', travel: '✈️',
  emergency: '🛡️', wedding: '💒', vehicle: '🚗', custom: '🎯',
};

const GOAL_COLORS: Record<string, string> = {
  retirement: '#6C63FF', education: '#3B82F6', house: '#F59E0B',
  travel: '#06B6D4', emergency: '#00C853', wedding: '#EC4899',
  vehicle: '#FF6B00', custom: '#8B5CF6',
};

// ─── Goal Card ─────────────────────────────────────────────────────

function GoalCard({ goal, index, onPress }: { goal: FinancialGoal; index: number; onPress: (g: FinancialGoal) => void }) {
  const { colors } = useTheme();
  const progress = useWealthStore(s => s.getGoalProgress(goal));
  const color = GOAL_COLORS[goal.category] || '#6C63FF';
  const icon = GOAL_ICONS[goal.category] || '🎯';

  return (
    <Animated.View entering={FadeInUp.duration(300).delay(index * 60)}>
      <Pressable onPress={() => onPress(goal)} style={[styles.goalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.goalHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
            <Text style={{ fontSize: 24 }}>{icon}</Text>
            <View>
              <Text style={[styles.goalName, { color: colors.text }]}>{goal.name}</Text>
              <Text style={[styles.goalTarget, { color: colors.textMuted }]}>
                Target: {formatCompactINR(goal.targetAmount)}
              </Text>
            </View>
          </View>
          <View style={[styles.goalPriority, { backgroundColor: goal.priority === 'high' ? '#FF525220' : goal.priority === 'medium' ? '#FFC10720' : '#00C85320' }]}>
            <Text style={[styles.goalPriorityText, { color: goal.priority === 'high' ? '#FF5252' : goal.priority === 'medium' ? '#FFC107' : '#00C853' }]}>
              {goal.priority}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressBarBg, { backgroundColor: colors.bgInput }]}>
          <View style={[styles.progressBarFill, { width: `${Math.min(100, progress)}%`, backgroundColor: color }]} />
        </View>

        <View style={styles.goalFooter}>
          <Text style={[styles.goalProgressText, { color: colors.text }]}>{progress.toFixed(0)}% complete</Text>
          <Text style={[styles.goalAmount, { color }]}>{formatCompactINR(goal.currentAmount)}</Text>
        </View>

        <View style={[styles.goalMeta, { borderTopColor: colors.divider }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.goalMetaText, { color: colors.textMuted }]}>
              {new Date(goal.targetDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="trending-up" size={12} color={colors.textMuted} />
            <Text style={[styles.goalMetaText, { color: colors.textMuted }]}>{goal.expectedReturn}% p.a.</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════

export default function WealthDashboardScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { goals, summary, retirementPlan } = useWealthStore();
  const _getGoalProgress = useWealthStore(s => s.getGoalProgress);

  const stats = useMemo(() => {
    const totalGoalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
    const totalGoalCurrent = goals.reduce((s, g) => s + g.currentAmount, 0);
    const overallProgress = totalGoalTarget > 0 ? (totalGoalCurrent / totalGoalTarget) * 100 : 0;
    const completedGoals = goals.filter(g => g.currentAmount >= g.targetAmount).length;
    return { totalGoalTarget, totalGoalCurrent, overallProgress, completedGoals };
  }, [goals]);

  const openGoal = useCallback((goal: FinancialGoal) => {
    navigation.navigate('GoalDetail', { goalId: goal.id });
  }, [navigation]);

  const quickActions = [
    { icon: 'flag', label: 'New Goal', color: '#6C63FF', screen: 'GoalCreate', gradient: ['#6C63FF', '#4F46E5'] as const },
    { icon: 'umbrella', label: 'Retirement', color: '#3B82F6', screen: 'RetirementPlanner', gradient: ['#3B82F6', '#1D4ED8'] as const },
    { icon: 'calculator', label: 'SIP Calc', color: '#00C853', screen: 'SIPCalculator', gradient: ['#00C853', '#009624'] as const },
    { icon: 'trending-up', label: 'Lumpsum', color: '#FFC107', screen: 'LumpsumCalculator', gradient: ['#FFC107', '#F59E0B'] as const },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: 50 + insets.top }]}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.title, { color: colors.text }]}>Wealth Dashboard</Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Track your goals, plan your retirement, build your future
          </Text>
        </View>

        {/* ── Net Worth Card ── */}
        <Animated.View entering={FadeInUp.duration(400)}>
          <LinearGradient
            colors={['#1a2332', '#0a1628']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.netWorthCard}
          >
            <Text style={styles.netWorthLabel}>Net Worth</Text>
            <Text style={styles.netWorthValue}>{formatCompactINR(summary.totalNetWorth)}</Text>

            <View style={styles.netWorthRow}>
              <View style={styles.netWorthItem}>
                <Ionicons name="arrow-up-circle" size={16} color="#00E676" />
                <Text style={styles.netWorthItemLabel}>Assets</Text>
                <Text style={styles.netWorthItemValue}>{formatCompactINR(summary.totalAssets)}</Text>
              </View>
              <View style={[styles.netWorthDivider, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
              <View style={styles.netWorthItem}>
                <Ionicons name="arrow-down-circle" size={16} color="#FF5252" />
                <Text style={styles.netWorthItemLabel}>Liabilities</Text>
                <Text style={styles.netWorthItemValue}>{formatCompactINR(summary.totalLiabilities)}</Text>
              </View>
              <View style={[styles.netWorthDivider, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
              <View style={styles.netWorthItem}>
                <Ionicons name="trending-up" size={16} color="#FFC107" />
                <Text style={styles.netWorthItemLabel}>Savings Rate</Text>
                <Text style={styles.netWorthItemValue}>{summary.savingsRate.toFixed(0)}%</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Quick Actions ── */}
        <Animated.View entering={FadeInUp.duration(450)} style={styles.quickActionsRow}>
          {quickActions.map((action, _i) => (
            <AnimatedPressable
              key={action.screen}
              onPress={() => navigation.navigate(action.screen)}
              haptic="light"
              scaleTo={0.93}
            >
              <LinearGradient
                colors={action.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quickActionCard}
              >
                <Ionicons name={action.icon as any} size={22} color="#fff" />
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </LinearGradient>
            </AnimatedPressable>
          ))}
        </Animated.View>

        {/* ── Monthly Overview ── */}
        <Animated.View entering={FadeInUp.duration(500)} style={[styles.overviewCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Monthly Overview</Text>
          <View style={styles.overviewRow}>
            <View style={styles.overviewItem}>
              <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Income</Text>
              <Text style={[styles.overviewValue, { color: '#00E676' }]}>{formatCompactINR(summary.monthlyIncome)}</Text>
            </View>
            <View style={[styles.overviewDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.overviewItem}>
              <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Expenses</Text>
              <Text style={[styles.overviewValue, { color: '#FF5252' }]}>{formatCompactINR(summary.monthlyExpenses)}</Text>
            </View>
            <View style={[styles.overviewDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.overviewItem}>
              <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Savings</Text>
              <Text style={[styles.overviewValue, { color: '#FFC107' }]}>{formatCompactINR(summary.monthlyIncome - summary.monthlyExpenses)}</Text>
            </View>
          </View>
          {/* Savings Rate Bar */}
          <View style={[styles.rateBar, { backgroundColor: colors.bgInput }]}>
            <View style={[styles.rateBarFill, { width: `${Math.min(100, summary.savingsRate)}%`, backgroundColor: '#00E676' }]} />
          </View>
          <Text style={[styles.rateLabel, { color: colors.textMuted }]}>
            {summary.savingsRate.toFixed(0)}% savings rate ·{' '}
            {summary.savingsRate >= 30 ? 'Excellent 🎉' : summary.savingsRate >= 20 ? 'Good 👍' : 'Room for improvement 💪'}
          </Text>
        </Animated.View>

        {/* ── Goals Section ── */}
        <Animated.View entering={FadeInUp.duration(550)}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Financial Goals
            </Text>
            <Pressable onPress={() => navigation.navigate('GoalCreate')}>
              <Text style={[styles.seeAllText, { color: colors.primary }]}>+ Add Goal</Text>
            </Pressable>
          </View>

          {/* Goals Progress Summary */}
          <View style={[styles.goalsSummary, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.goalsSummaryRow}>
              <View style={styles.goalsSummaryItem}>
                <Text style={[styles.goalsSummaryLabel, { color: colors.textMuted }]}>Goals</Text>
                <Text style={[styles.goalsSummaryValue, { color: colors.text }]}>{goals.length}</Text>
              </View>
              <View style={[styles.goalsSummaryDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.goalsSummaryItem}>
                <Text style={[styles.goalsSummaryLabel, { color: colors.textMuted }]}>Completed</Text>
                <Text style={[styles.goalsSummaryValue, { color: '#00E676' }]}>{stats.completedGoals}</Text>
              </View>
              <View style={[styles.goalsSummaryDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.goalsSummaryItem}>
                <Text style={[styles.goalsSummaryLabel, { color: colors.textMuted }]}>Total Target</Text>
                <Text style={[styles.goalsSummaryValue, { color: colors.text }]}>{formatCompactINR(stats.totalGoalTarget)}</Text>
              </View>
            </View>
            {/* Overall Progress Bar */}
            <View style={[styles.progressBarBg, { backgroundColor: colors.bgInput, marginTop: SPACING.md }]}>
              <View style={[styles.progressBarFill, { width: `${Math.min(100, stats.overallProgress)}%`, backgroundColor: '#6C63FF' }]} />
            </View>
            <Text style={[styles.goalsProgressOverall, { color: colors.textMuted }]}>
              Overall: {stats.overallProgress.toFixed(1)}% funded
            </Text>
          </View>

          {/* Goal Cards */}
          {goals.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="flag-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No goals yet</Text>
              <Pressable onPress={() => navigation.navigate('GoalCreate')} style={[styles.createGoalBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.createGoalBtnText}>Create Your First Goal</Text>
              </Pressable>
            </View>
          ) : (
            goals.map((goal, i) => (
              <GoalCard key={goal.id} goal={goal} index={i} onPress={openGoal} />
            ))
          )}
        </Animated.View>

        {/* ── Retirement Preview ── */}
        <Animated.View entering={FadeInUp.duration(600)} style={[styles.retirementPreview, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.retirementPreviewHeader}>
            <Text style={{ fontSize: 28 }}>🏖️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.retirementPreviewTitle, { color: colors.text }]}>Retirement Planning</Text>
              <Text style={[styles.retirementPreviewSub, { color: colors.textMuted }]}>
                {retirementPlan.currentAge} yrs old · Plan to retire at {retirementPlan.retirementAge}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
          <Pressable
            onPress={() => navigation.navigate('RetirementPlanner')}
            style={[styles.retirementPreviewBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
          >
            <Text style={[styles.retirementPreviewBtnText, { color: colors.primary }]}>View Retirement Planner →</Text>
          </Pressable>
        </Animated.View>

        {/* ── Tips ── */}
        <View style={[styles.tipCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="bulb" size={18} color="#FFC107" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.tipTitle, { color: colors.text }]}>💰 Wealth Tip</Text>
            <Text style={[styles.tipText, { color: colors.textMuted }]}>
              Start investing early — even ₹5,000/month at 12% grows to over ₹1.5 Cr in 25 years!
            </Text>
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.xl },
  header: { marginBottom: SPACING.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backBtn: { padding: 4 },
  title: { ...FONTS.bold, fontSize: FONTS.size.title },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 4 },

  // Net Worth
  netWorthCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
  },
  netWorthLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: 'rgba(255,255,255,0.6)' },
  netWorthValue: { ...FONTS.bold, fontSize: 32, color: '#fff', marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  netWorthRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: SPACING.lg,
    paddingTop: SPACING.lg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
  },
  netWorthItem: { flex: 1, alignItems: 'center', gap: 4 },
  netWorthItemLabel: { ...FONTS.regular, fontSize: 9, color: 'rgba(255,255,255,0.5)' },
  netWorthItemValue: { ...FONTS.bold, fontSize: FONTS.size.sm, color: '#fff' },
  netWorthDivider: { width: 1, height: 30 },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md,
  },
  quickActionCard: {
    width: (width - SPACING.xl * 2 - SPACING.sm * 3) / 4,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    gap: 4,
  },
  quickActionLabel: { ...FONTS.medium, fontSize: 9, color: '#fff' },

  // Overview
  overviewCard: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.md,
  },
  sectionTitle: { ...FONTS.bold, fontSize: FONTS.size.md, marginBottom: SPACING.md },
  overviewRow: { flexDirection: 'row', alignItems: 'center' },
  overviewItem: { flex: 1, alignItems: 'center', gap: 4 },
  overviewLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  overviewValue: { ...FONTS.bold, fontSize: FONTS.size.md },
  overviewDivider: { width: 1, height: 30, marginHorizontal: SPACING.sm },
  rateBar: { height: 6, borderRadius: 3, marginTop: SPACING.md, overflow: 'hidden' },
  rateBarFill: { height: '100%', borderRadius: 3 },
  rateLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 4, textAlign: 'center' },

  // Goals Section
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  seeAllText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  goalsSummary: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.md,
  },
  goalsSummaryRow: { flexDirection: 'row', alignItems: 'center' },
  goalsSummaryItem: { flex: 1, alignItems: 'center' },
  goalsSummaryLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  goalsSummaryValue: { ...FONTS.bold, fontSize: FONTS.size.lg, marginTop: 2 },
  goalsSummaryDivider: { width: 1, height: 30 },
  goalsProgressOverall: { ...FONTS.regular, fontSize: FONTS.size.xs, textAlign: 'center', marginTop: SPACING.sm },

  // Goal Card
  goalCard: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.sm,
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  goalName: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  goalTarget: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  goalPriority: {
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  goalPriorityText: { ...FONTS.semiBold, fontSize: 8, textTransform: 'uppercase' },
  progressBarBg: { height: 8, borderRadius: 4, marginTop: SPACING.md, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  goalFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.sm,
  },
  goalProgressText: { ...FONTS.regular, fontSize: FONTS.size.xs },
  goalAmount: { ...FONTS.bold, fontSize: FONTS.size.sm, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  goalMeta: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: SPACING.sm, marginTop: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth,
  },
  goalMetaText: { ...FONTS.regular, fontSize: 9 },

  // Empty State
  emptyState: {
    padding: SPACING.xxl, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md,
  },
  emptyText: { ...FONTS.regular, fontSize: FONTS.size.sm },
  createGoalBtn: {
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  createGoalBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: '#fff' },

  // Retirement Preview
  retirementPreview: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.md,
  },
  retirementPreviewHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
  },
  retirementPreviewTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  retirementPreviewSub: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  retirementPreviewBtn: {
    paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, alignItems: 'center', marginTop: SPACING.md,
  },
  retirementPreviewBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },

  // Tip
  tipCard: {
    flexDirection: 'row', gap: SPACING.md, padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.lg,
  },
  tipTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  tipText: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2, lineHeight: 16 },
});
