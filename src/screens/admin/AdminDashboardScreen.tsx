/**
 * ============================================================================
 * Toroloom — Admin Dashboard Screen
 * ============================================================================
 *
 * Central admin hub for platform management:
 *   1. Overview Stats Cards (users, subs, MRR, signups)
 *   2. System Health Status (backend, PG, Redis, Queue, WS, Razorpay)
 *   3. KYC Pending Queue with quick action buttons
 *   4. Quick Links to all admin tools
 *   5. Pull-to-refresh with animated entry
 * ============================================================================
 */

import React, { useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  FadeInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useAdminStore, SystemService } from '../../store/adminStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Badge from '../../components/ui/Badge';
import { SkeletonBlock } from '../../components/ui/SkeletonLoader';

const { width } = Dimensions.get('window');

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
  subtitle,
  delay,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  subtitle?: string;
  delay: number;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { stiffness: 100, damping: 14 }));
  }, [delay, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      style={animatedStyle}
    >
      <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={[styles.statIconWrap, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
        {subtitle && (
          <Text style={[styles.statSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Service Status Dot ────────────────────────────────────────────────────

function ServiceStatusDot({ status }: { status: SystemService['status'] }) {
  const color =
    status === 'healthy' ? '#00E676' :
    status === 'degraded' ? '#FFC107' :
    '#FF5252';
  return <View style={[styles.statusDot, { backgroundColor: color }]} />;
}

// ─── Service Row ───────────────────────────────────────────────────────────

function ServiceRow({ service, delay }: { service: SystemService; delay: number }) {
  const { colors } = useTheme();

  const statusLabel =
    service.status === 'healthy' ? 'Healthy' :
    service.status === 'degraded' ? 'Degraded' :
    'Down';

  const statusColor =
    service.status === 'healthy' ? colors.marketUp :
    service.status === 'degraded' ? colors.warning :
    colors.danger;

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      style={[styles.serviceRow, { borderBottomColor: colors.divider }]}
    >
      <View style={styles.serviceLeft}>
        <ServiceStatusDot status={service.status} />
        <View>
          <Text style={[styles.serviceName, { color: colors.text }]}>{service.name}</Text>
          <Text style={[styles.serviceLatency, { color: colors.textMuted }]}>
            {service.latency}ms · {service.uptime}% uptime
          </Text>
        </View>
      </View>
      <Text style={[styles.serviceStatus, { color: statusColor }]}>{statusLabel}</Text>
    </Animated.View>
  );
}

// ─── Quick Link Item ───────────────────────────────────────────────────────

function QuickLink({
  icon,
  label,
  color,
  screen,
  navigation,
  delay,
  badge,
}: {
  icon: string;
  label: string;
  color: string;
  screen: string;
  navigation: any;
  delay: number;
  badge?: string;
}) {
  const { colors } = useTheme();

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <AnimatedPressable onPress={() => navigation.navigate(screen)} haptic="light" scaleTo={0.95}>
        <View style={[styles.quickLinkCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[styles.quickLinkIcon, { backgroundColor: color + '20' }]}>
            <Ionicons name={icon as any} size={22} color={color} />
          </View>
          <Text style={[styles.quickLinkLabel, { color: colors.text }]}>{label}</Text>
          {badge && <Badge label={badge} variant="danger" size="small" />}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminDashboardScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const { stats, services, refresh, isLoading } = useAdminStore();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
          <View style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </View>
        </AnimatedPressable>
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Dashboard</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            Platform overview & management
          </Text>
        </View>
        <AnimatedPressable onPress={onRefresh} haptic="light" scaleTo={0.9}>
          <View style={[styles.refreshBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="refresh" size={22} color={colors.primary} />
          </View>
        </AnimatedPressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Overview Stats ─────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard icon="people" label="Total Users" value={stats.totalUsers.toLocaleString()} color="#3B82F6" delay={0} />
          <StatCard icon="flash" label="Active Today" value={stats.activeToday.toString()} color="#00E676" delay={80} />
          <StatCard icon="person-add" label="New Today" value={stats.newSignupsToday.toString()} color="#8B5CF6" delay={160} />
          <StatCard icon="diamond" label="Subscribers" value={stats.totalSubscriptions.toString()} color="#FFC107" subtitle={`${((stats.totalSubscriptions / stats.totalUsers) * 100).toFixed(1)}% conversion`} delay={240} />
          <StatCard icon="cash" label="MRR" value={`₹${(stats.mrr / 1000).toFixed(1)}K`} color="#10B981" subtitle={`₹${stats.mrr.toLocaleString()}`} delay={320} />
          <StatCard icon="trending-down" label="Churn" value={`${stats.monthlyChurn}%`} color="#FF5252" delay={400} />
        </View>

        {/* ── KYC Pending ────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(480).springify()}>
          <AnimatedPressable
            onPress={() => navigation.navigate('AdminKYC')}
            haptic="medium"
            scaleTo={0.97}
          >
            <LinearGradient
              colors={['rgba(255,171,64,0.12)', 'rgba(255,143,0,0.06)']}
              style={[styles.kycBanner, { borderColor: colors.warning + '30' }]}
            >
              <View style={styles.kycBannerRow}>
                <View style={[styles.kycIconWrap, { backgroundColor: colors.warning + '20' }]}>
                  <Ionicons name="shield-checkmark" size={24} color={colors.warning} />
                </View>
                <View style={styles.kycBannerInfo}>
                  <Text style={[styles.kycBannerTitle, { color: colors.text }]}>
                    Pending KYC Verifications
                  </Text>
                  <Text style={[styles.kycBannerSub, { color: colors.textMuted }]}>
                    {stats.pendingKyc} user(s) awaiting document verification
                  </Text>
                </View>
                <View style={[styles.kycCount, { backgroundColor: colors.warning + '30' }]}>
                  <Text style={[styles.kycCountText, { color: colors.warning }]}>
                    {stats.pendingKyc}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </AnimatedPressable>
        </Animated.View>

        {/* ── System Health ──────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
          System Health
        </Text>
        <View style={[styles.servicesCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {isLoading ? (
            <View style={{ padding: SPACING.md, gap: SPACING.md }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <SkeletonBlock key={i} width="100%" height={36} borderRadius={8} />
              ))}
            </View>
          ) : (
            services.map((service, i) => (
              <ServiceRow key={service.name} service={service} delay={i * 60} />
            ))
          )}
        </View>

        {/* ── Quick Links ────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
          Admin Tools
        </Text>
        <View style={styles.quickLinksGrid}>
          <QuickLink icon="people" label="User Management" color="#3B82F6" screen="AdminUsers" navigation={navigation} delay={0} />
          <QuickLink icon="pricetags" label="Coupons" color="#8B5CF6" screen="AdminCouponManager" navigation={navigation} delay={60} />
          <QuickLink icon="school" label="Course Reviews" color="#00E676" screen="AdminCourseReview" navigation={navigation} delay={120} />
          <QuickLink icon="shield-checkmark" label="KYC Queue" color="#FFC107" screen="AdminKYC" navigation={navigation} delay={180} badge={String(stats.pendingKyc)} />
          <QuickLink icon="server" label="System Health" color="#FF6B6B" screen="RazorpayWebhookHealth" navigation={navigation} delay={240} />
          <QuickLink icon="bar-chart" label="Subscription Analytics" color="#10B981" screen="SubscriptionAnalytics" navigation={navigation} delay={300} />
          <QuickLink icon="settings" label="Tenant Config" color="#6C63FF" screen="TenantConfig" navigation={navigation} delay={360} />
          <QuickLink icon="flask" label="Feature Flags" color="#FF6B00" screen="FeatureFlags" navigation={navigation} delay={420} />
          <QuickLink icon="link" label="Webhooks" color="#06B6D4" screen="Webhooks" navigation={navigation} delay={480} />
          <QuickLink icon="key" label="API Keys" color="#FF5252" screen="ApiKeys" navigation={navigation} delay={540} />
          <QuickLink icon="receipt" label="Audit Log" color="#94A3B8" screen="SecurityAuditLog" navigation={navigation} delay={600} />
          <QuickLink icon="flask" label="A/B Tests" color="#FF6B6B" screen="ABTestRunner" navigation={navigation} delay={660} />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
  },
  headerSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 2,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  sectionTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  // ── Stats Grid ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    width: (width - SPACING.xl * 2 - SPACING.sm) / 3,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  statLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    textAlign: 'center',
  },
  statSubtitle: {
    ...FONTS.regular,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 1,
  },
  // ── KYC Banner ──
  kycBanner: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  kycBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  kycIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kycBannerInfo: { flex: 1 },
  kycBannerTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
  },
  kycBannerSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 2,
  },
  kycCount: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kycCountText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  // ── Services ──
  servicesCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  serviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  serviceName: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
  },
  serviceLatency: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    marginTop: 1,
  },
  serviceStatus: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    textTransform: 'capitalize',
  },
  // ── Quick Links ──
  quickLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  quickLinkCard: {
    width: (width - SPACING.xl * 2 - SPACING.sm) / 2,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  quickLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLinkLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    flex: 1,
  },
});
