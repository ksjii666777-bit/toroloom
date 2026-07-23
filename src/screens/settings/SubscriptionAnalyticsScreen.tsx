/**
 * ============================================================================
 * Toroloom — Subscription Analytics Screen (Admin)
 * ============================================================================
 *
 * Admin dashboard for subscription analytics:
 *   - Stat cards: Total subs, Active subs, MRR, ARPU, Churn rate
 *   - Tier breakdown (Free / Pro / Elite)
 *   - Monthly revenue chart (last 6 months)
 *   - Trial conversion rate, Payment failure rate
 *
 * ============================================================================
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useAuthStore } from '../../store/authStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';
import { api } from '../../services/api';

const { width } = Dimensions.get('window');
const CHART_HEIGHT = 160;

// ──── API client ───────────────────────────────────────────────────────────

async function fetchOverview(): Promise<SubscriptionAnalyticsOverview> {
  const response: { data: SubscriptionAnalyticsOverview } = await api.get('/subscription-analytics/overview') as any;
  return response.data;
}

// ──── Types ────────────────────────────────────────────────────────────────

interface MonthlyRevenue {
  month: string;
  revenue: number;
  newSubscribers: number;
  churnedSubscribers: number;
}

interface SubscriptionAnalyticsOverview {
  totalSubscriptions: number;
  activeSubscriptions: number;
  tierBreakdown: {
    free: number;
    pro: number;
    elite: number;
  };
  statusBreakdown: {
    active: number;
    trial: number;
    expired: number;
    cancelled: number;
  };
  mrr: number;
  averageRevenuePerUser: number;
  churnRate30Day: number;
  churnRate90Day: number;
  monthlyRevenue: MonthlyRevenue[];
  trialConversionRate: number;
  trialUsers: number;
  paymentFailureRate: number;
  usersInGracePeriod: number;
}

// ──── Stat Card Component ─────────────────────────────────────────────────

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  color: string;
  subtitle?: string;
}

function StatCard({ icon, label, value, color, subtitle }: StatCardProps) {
  const { colors } = useTheme();

  return (
    <View style={[statCardStyles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={[statCardStyles.iconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={color} />
      </View>
      <Text style={[statCardStyles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[statCardStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      {subtitle && (
        <Text style={[statCardStyles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      )}
    </View>
  );
}

const statCardStyles = StyleSheet.create({
  card: {
    width: (width - 48 - 12) / 2,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  value: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
  },
  label: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
});

// ──── Tier Bar Component ──────────────────────────────────────────────────

function TierBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const { colors } = useTheme();
  const pct = total > 0 ? (count / total) * 100 : 0;

  return (
    <View style={tierBarStyles.row}>
      <View style={tierBarStyles.labelRow}>
        <View style={[tierBarStyles.dot, { backgroundColor: color }]} />
        <Text style={[tierBarStyles.label, { color: colors.text }]}>{label}</Text>
      </View>
      <View style={tierBarStyles.barTrack}>
        <View style={[tierBarStyles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[tierBarStyles.count, { color: colors.textSecondary }]}>
        {count} ({Math.round(pct)}%)
      </Text>
    </View>
  );
}

const tierBarStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 80,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  count: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    width: 70,
    textAlign: 'right',
  },
});

// ──── Monthly Revenue Chart ───────────────────────────────────────────────

function RevenueBarChart({ data }: { data: MonthlyRevenue[] }) {
  const { colors } = useTheme();
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.barsRow}>
        {data.map((item, i) => {
          const height = (item.revenue / maxRevenue) * CHART_HEIGHT;
          return (
            <View key={i} style={chartStyles.barCol}>
              <Text style={[chartStyles.barValue, { color: colors.textSecondary }]}>
                ₹{(item.revenue / 1000).toFixed(0)}K
              </Text>
              <View style={chartStyles.barTrack}>
                <View
                  style={[
                    chartStyles.barFill,
                    {
                      height: Math.max(height, 4),
                      backgroundColor: i === data.length - 1 ? '#10B981' : '#3B82F6',
                    },
                  ]}
                />
              </View>
              <Text style={[chartStyles.barLabel, { color: colors.textMuted }]}>
                {item.month.split(' ')[0]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: SPACING.sm,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barValue: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  barTrack: {
    width: '100%',
    height: CHART_HEIGHT,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
    minHeight: 4,
  },
  barLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
});

// ──── Main Screen ─────────────────────────────────────────────────────────

export default function SubscriptionAnalyticsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isAdmin = useAuthStore(s => s.isAdmin);

  const [data, setData] = useState<SubscriptionAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const overview = await fetchOverview();
      setData(overview);
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Render ────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="shield-checkmark" size={48} color={colors.danger} />
        <Text style={[styles.errorText, { color: colors.text }]}>{t('education.accessDenied')}</Text>
        <Text style={[styles.subText, { color: colors.textSecondary }]}>{t('education.accessDeniedMsg')}</Text>
      </View>
    );
  }

  if (loading && !data) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading analytics...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle" size={48} color={colors.danger} />
        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        <AnimatedPressable onPress={() => loadData()} haptic="light" scaleTo={0.95}>
          <View style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.retryBtnText}>{t('app.retry')}</Text>
          </View>
        </AnimatedPressable>
      </View>
    );
  }

  if (!data) return null;

  const tierColors = { free: '#6C63FF', pro: '#3B82F6', elite: '#10B981' };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.bgSecondary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </AnimatedPressable>
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={[styles.title, { color: colors.text }]}>Subscription Analytics</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Overview of all subscription data
              </Text>
            </View>
          </View>
        </View>

        {/* Stat Cards Row 1 */}
        <View style={styles.statsRow}>
          <StatCard
            icon="people"
            label="Total Users"
            value={data.totalSubscriptions.toLocaleString()}
            color="#6C63FF"
          />
          <StatCard
            icon="checkmark-circle"
            label="Active Subs"
            value={data.activeSubscriptions.toLocaleString()}
            color="#10B981"
            subtitle={`${data.statusBreakdown.trial} in trial`}
          />
        </View>

        {/* Stat Cards Row 2 */}
        <View style={styles.statsRow}>
          <StatCard
            icon="cash"
            label="MRR"
            value={`₹${data.mrr.toLocaleString()}`}
            color="#3B82F6"
          />
          <StatCard
            icon="trending-up"
            label="ARPU"
            value={`₹${data.averageRevenuePerUser.toLocaleString()}`}
            color="#8B5CF6"
            subtitle="per active user"
          />
        </View>

        {/* Stat Cards Row 3 */}
        <View style={styles.statsRow}>
          <StatCard
            icon="warning"
            label="30-Day Churn"
            value={`${data.churnRate30Day}%`}
            color={data.churnRate30Day > 10 ? '#EF4444' : '#F59E0B'}
          />
          <StatCard
            icon="refresh"
            label="Trial Conv."
            value={`${data.trialConversionRate}%`}
            color="#10B981"
            subtitle={`${data.trialUsers} trial users`}
          />
        </View>

        {/* Payment Failure Card */}
        <View style={styles.statsRow}>
          <StatCard
            icon="alert-circle"
            label="Payment Failures"
            value={`${data.paymentFailureRate}%`}
            color={data.paymentFailureRate > 5 ? '#EF4444' : '#F59E0B'}
            subtitle={`${data.usersInGracePeriod} in grace period`}
          />
          <StatCard
            icon="trending-down"
            label="90-Day Churn"
            value={`${data.churnRate90Day}%`}
            color={data.churnRate90Day > 20 ? '#EF4444' : '#F59E0B'}
          />
        </View>

        {/* Tier Breakdown */}
        <Card title="Tier Breakdown" style={styles.card}>
          <TierBar label="Free" count={data.tierBreakdown.free} total={data.totalSubscriptions} color={tierColors.free} />
          <TierBar label="Pro" count={data.tierBreakdown.pro} total={data.totalSubscriptions} color={tierColors.pro} />
          <TierBar label="Elite" count={data.tierBreakdown.elite} total={data.totalSubscriptions} color={tierColors.elite} />
        </Card>

        {/* Status Breakdown */}
        <Card title="Status Breakdown" style={styles.card}>
          <TierBar label="Active" count={data.statusBreakdown.active} total={data.totalSubscriptions} color="#10B981" />
          <TierBar label="Trial" count={data.statusBreakdown.trial} total={data.totalSubscriptions} color="#3B82F6" />
          <TierBar label="Expired" count={data.statusBreakdown.expired} total={data.totalSubscriptions} color="#F59E0B" />
          <TierBar label="Cancelled" count={data.statusBreakdown.cancelled} total={data.totalSubscriptions} color="#EF4444" />
        </Card>

        {/* Monthly Revenue Chart */}
        <Card title="Monthly Revenue (Last 6 Months)" style={styles.card}>
          <RevenueBarChart data={data.monthlyRevenue} />
          <View style={styles.chartLegend}>
            {data.monthlyRevenue.map((item, i) => (
              <Text key={i} style={[styles.legendText, { color: colors.textMuted }]}>
                {item.month}: ₹{(item.revenue / 1000).toFixed(0)}K ({item.newSubscribers} new, {item.churnedSubscribers} churned)
              </Text>
            ))}
          </View>
        </Card>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ──── Styles ──────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.xl,
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
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  card: {
    marginBottom: SPACING.lg,
  },
  chartLegend: {
    marginTop: SPACING.md,
    gap: 2,
  },
  legendText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  loadingText: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    marginTop: SPACING.md,
  },
  errorText: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    textAlign: 'center',
  },
  subText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  retryBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.white,
  },
});
