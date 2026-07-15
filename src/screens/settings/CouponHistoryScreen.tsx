import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { couponApi, CouponUsageDisplay } from '../../services/api/coupons';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import * as Haptics from 'expo-haptics';

// ─── Type Color Helpers ──────────────────────────────────────

function getDiscountColor(code: string): string {
  const hash = code.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colors = ['#3B82F6', '#10B981', '#8B5CF6', '#FF9800', '#EF4444', '#EC4899'];
  return colors[hash % colors.length];
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ─── Usage Card Component ────────────────────────────────────

function UsageCard({ usage, index }: { usage: CouponUsageDisplay; index: number }) {
  const { colors } = useTheme();
  const color = getDiscountColor(usage.code);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify()}
      style={[s.usageCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
    >
      <View style={s.usageCardRow}>
        {/* Icon */}
        <View style={[s.usageIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name="pricetag" size={20} color={color} />
        </View>

        {/* Details */}
        <View style={s.usageDetails}>
          <View style={s.usageCodeRow}>
            <Text style={[s.usageCode, { color }]}>{usage.code}</Text>
            <Text style={[s.usageDate, { color: colors.textMuted }]}>{formatDate(usage.usedAt)}</Text>
          </View>
          <View style={s.usagePricing}>
            <Text style={[s.usageOriginal, { color: colors.textSecondary }]}>
              {formatCurrency(usage.originalPrice)}
            </Text>
            <Text style={[s.usageDiscount, { color: colors.marketUp }]}>
              -{formatCurrency(usage.discountAmount)}
            </Text>
            <Text style={[s.usageFinal, { color: colors.text }]}>
              = {formatCurrency(usage.finalPrice)}
            </Text>
          </View>
          {usage.planId && (
            <Text style={[s.usagePlan, { color: colors.textMuted }]}>
              Applied to: {usage.planId.replace('plan_', '').toUpperCase()}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────

export default function CouponHistoryScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [usages, setUsages] = useState<CouponUsageDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await couponApi.getUserUsageHistory();
      setUsages(data);
    } catch {
      setUsages([]);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const totalSaved = useMemo(
    () => usages.reduce((sum, u) => sum + u.discountAmount, 0),
    [usages],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
          <View style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </View>
        </AnimatedPressable>
        <Text style={[styles.title, { color: colors.text }]}>My Coupons</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHistory(true)}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading coupon history...</Text>
          </View>
        ) : usages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="receipt-outline" size={40} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Coupons Used Yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Your applied coupons will appear here.{'\n'}Go to Premium to find available discounts!
            </Text>
            <AnimatedPressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('Subscription');
              }}
              haptic="light"
              scaleTo={0.97}
            >
              <View style={[styles.emptyCta, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                <Ionicons name="flash" size={16} color={colors.primary} />
                <Text style={[styles.emptyCtaText, { color: colors.primary }]}>View Premium Plans</Text>
              </View>
            </AnimatedPressable>
          </View>
        ) : (
          <>
            {/* Summary Card */}
            <View style={[styles.summaryCard, { backgroundColor: colors.marketUp + '10', borderColor: colors.marketUp + '20' }]}>
              <View style={styles.summaryIconWrap}>
                <Ionicons name="wallet-outline" size={24} color={colors.marketUp} />
              </View>
              <View style={styles.summaryInfo}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Saved</Text>
                <Text style={[styles.summaryAmount, { color: colors.marketUp }]}>
                  {formatCurrency(totalSaved)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryInfo}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Coupons Used</Text>
                <Text style={[styles.summaryCount, { color: colors.text }]}>{usages.length}</Text>
              </View>
            </View>

            {/* Usage List */}
            <View style={styles.sectionHeader}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Usage History</Text>
            </View>
            {usages.map((usage, i) => (
              <UsageCard key={usage.id} usage={usage} index={i} />
            ))}
          </>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  usageCard: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
  },
  usageCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  usageIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  usageDetails: {
    flex: 1,
  },
  usageCodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageCode: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    letterSpacing: 1,
  },
  usageDate: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  usagePricing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 2,
  },
  usageOriginal: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    textDecorationLine: 'line-through',
  },
  usageDiscount: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  usageFinal: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  usagePlan: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    marginTop: 2,
  },
});

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    header: {
      paddingTop: 60,
      paddingHorizontal: SPACING.xl,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    title: { ...FONTS.bold, fontSize: FONTS.size.title },
    scrollContent: { paddingBottom: SPACING.xl },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 100 },
    loadingText: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: SPACING.md },
    emptyContainer: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: SPACING.xl },
    emptyIconWrap: {
      width: 80, height: 80, borderRadius: 40,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 1, borderStyle: 'dashed', marginBottom: SPACING.lg,
    },
    emptyTitle: { ...FONTS.semiBold, fontSize: FONTS.size.lg, marginBottom: SPACING.sm },
    emptySubtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.lg },
    emptyCta: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl,
      borderRadius: BORDER_RADIUS.full, borderWidth: 1,
    },
    emptyCtaText: { ...FONTS.medium, fontSize: FONTS.size.sm },

    // Summary Card
    summaryCard: {
      flexDirection: 'row', alignItems: 'center',
      marginHorizontal: SPACING.xl, marginBottom: SPACING.lg,
      padding: SPACING.lg, borderRadius: BORDER_RADIUS.xl, borderWidth: 1,
      gap: SPACING.md,
    },
    summaryIconWrap: {
      width: 48, height: 48, borderRadius: 14,
      justifyContent: 'center', alignItems: 'center',
    },
    summaryInfo: { flex: 1 },
    summaryLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
    summaryAmount: { ...FONTS.black, fontSize: FONTS.size.xl, marginTop: 2 },
    summaryDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },
    summaryCount: { ...FONTS.black, fontSize: FONTS.size.xl, marginTop: 2 },

    // Section
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      marginHorizontal: SPACING.xl, marginBottom: SPACING.md, marginTop: SPACING.sm,
    },
    sectionTitle: { ...FONTS.semiBold, fontSize: FONTS.size.lg },
  });
