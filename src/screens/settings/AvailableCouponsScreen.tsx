import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
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
import { useTheme } from '../../context/ThemeContext';
import { useSubscriptionStore } from '../../store/subscriptionStore';

import type { CouponCode } from '../../types';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import * as Haptics from 'expo-haptics';

// ─── Coupon Type Helpers ──────────────────────────────────────

function getCouponTypeMeta(type: CouponCode['type']) {
  switch (type) {
    case 'percentage':
      return { label: 'PERCENTAGE OFF', icon: 'percent', color: '#3B82F6', gradient: ['#3B82F6', '#2563EB'] as [string, string] };
    case 'fixed':
      return { label: 'FLAT DISCOUNT', icon: 'pricetag', color: '#10B981', gradient: ['#10B981', '#059669'] as [string, string] };
    case 'free_trial':
      return { label: 'FREE TRIAL', icon: 'timer', color: '#FF9800', gradient: ['#FF9800', '#F57C00'] as [string, string] };
  }
}

function getColorForType(type: CouponCode['type']): string {
  switch (type) {
    case 'percentage': return '#3B82F6';
    case 'fixed': return '#10B981';
    case 'free_trial': return '#FF9800';
  }
}

function formatDiscount(coupon: CouponCode): string {
  switch (coupon.type) {
    case 'percentage':
      return `${coupon.value}% OFF`;
    case 'fixed':
      return `₹${coupon.value.toLocaleString('en-IN')} OFF`;
    case 'free_trial':
      return `${coupon.trialDays || 7}-day FREE`;
  }
}

function getExpiryStatus(expiresAt?: string): { label: string; urgent: boolean } {
  if (!expiresAt) return { label: 'No expiry', urgent: false };
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (daysLeft <= 0) return { label: 'Expired', urgent: true };
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, urgent: true };
  if (daysLeft <= 30) return { label: `${daysLeft}d left`, urgent: false };
  return { label: `${Math.ceil(daysLeft / 30)}mo left`, urgent: false };
}

// ─── Animated Coupon Card ─────────────────────────────────────

function CouponCard({
  coupon,
  index,
  onSelect,
}: {
  coupon: CouponCode;
  index: number;
  onSelect: (code: string) => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createCouponCardStyles(colors), [colors]);
  const scaleAnim = useSharedValue(0);
  const typeMeta = getCouponTypeMeta(coupon.type);
  const expiry = getExpiryStatus(coupon.expiresAt);
  const isExpired = expiry.urgent && expiry.label === 'Expired';
  const usesLeft = coupon.maxUses ? Math.max(0, coupon.maxUses - (coupon.currentUses || 0)) : Infinity;
  const usagePercent = coupon.maxUses ? ((coupon.currentUses || 0) / coupon.maxUses) * 100 : 0;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  useEffect(() => {
    scaleAnim.value = withDelay(index * 100, withSpring(1, { stiffness: 100, damping: 12 }));
  }, [index, scaleAnim]);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).springify()}
      style={[s.couponCard, { backgroundColor: colors.bgCard, borderColor: colors.border }, animatedStyle]}
    >
      {/* Gradient Header */}
      <LinearGradient
        colors={typeMeta.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.couponHeader}
      >
                    <View style={s.couponHeaderRow}>
                    <View style={s.couponTypeBadge}>
                      <Ionicons name={typeMeta.icon as any} size={12} color="#fff" />
                      <Text style={s.couponTypeLabel}>{typeMeta.label}</Text>
                    </View>
                    {isExpired && (
                      <View style={s.expiredBadge}>
                        <Text style={s.expiredBadgeText}>EXPIRED</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.couponCode}>{coupon.code}</Text>
      </LinearGradient>

      {/* Card Body */}
      <View style={s.couponBody}>
        {/* Discount Amount */}
        <View style={s.discountRow}>
          <Text style={[s.discountAmount, { color: getColorForType(coupon.type) }]}>
            {formatDiscount(coupon)}
          </Text>
          {coupon.minPlanTier && (
            <View style={[s.minTierBadge, { backgroundColor: getColorForType(coupon.type) + '20' }]}>
              <Text style={[s.minTierText, { color: getColorForType(coupon.type) }]}>
                {coupon.minPlanTier.toUpperCase()}+
              </Text>
            </View>
          )}
        </View>

        {/* Description */}
        <Text style={[s.couponDescription, { color: colors.textSecondary }]}>
          {coupon.description}
        </Text>

        {/* Meta Row - Expiry + Usage */}
        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <Ionicons
              name={expiry.urgent ? 'alert-circle' : 'calendar-outline'}
              size={14}
              color={expiry.urgent ? colors.danger : colors.textMuted}
            />
            <Text style={[s.metaText, { color: expiry.urgent ? colors.danger : colors.textMuted }]}>
              {expiry.label}
            </Text>
          </View>

          {!isExpired && (
            <View style={s.metaItem}>
              <Ionicons name="flash-outline" size={14} color={colors.textMuted} />
              <Text style={[s.metaText, { color: colors.textMuted }]}>
                {usesLeft === Infinity ? 'Unlimited' : `${usesLeft} left`}
              </Text>
            </View>
          )}
        </View>

        {/* Usage Progress Bar (if limited) */}
        {coupon.maxUses && coupon.maxUses > 0 && (
          <View style={s.usageBarContainer}>
            <View style={[s.usageBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  s.usageFill,
                  {
                    width: `${Math.min(100, usagePercent)}%`,
                    backgroundColor: usagePercent > 80 ? colors.danger : getColorForType(coupon.type),
                  },
                ]}
              />
            </View>
            <Text style={[s.usageText, { color: colors.textMuted }]}>
              {coupon.currentUses || 0}/{coupon.maxUses} used
            </Text>
          </View>
        )}

        {/* Apply Button */}
        {!isExpired && (
          <AnimatedPressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onSelect(coupon.code);
            }}
            haptic="medium"
            scaleTo={0.96}
            style={s.applyBtnWrapper}
          >
            <LinearGradient
              colors={typeMeta.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.applyBtn}
            >
              <Ionicons name="pricetag" size={16} color="#fff" />
              <Text style={s.applyBtnText}>Use This Coupon</Text>
            </LinearGradient>
          </AnimatedPressable>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────

export default function AvailableCouponsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [coupons, setCoupons] = useState<CouponCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const setCouponInput = useSubscriptionStore(s => s.setCouponInput);

  const loadCoupons = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const store = useSubscriptionStore.getState();
      const result = await store.getAvailableCoupons();
      setCoupons(result);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const handleSelectCoupon = useCallback(
    (code: string) => {
      setSelectedCode(code);
      setCouponInput(code);
      // Mark coupon as just selected from the list so SubscriptionScreen auto-opens
      useSubscriptionStore.getState().markCouponFromList(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate back after brief delay
      setTimeout(() => {
        navigation.goBack();
      }, 300);
    },
    [setCouponInput, navigation],
  );

  // ── Render ──────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
          <View style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </View>
        </AnimatedPressable>
        <Text style={[styles.title, { color: colors.text }]}>Available Coupons</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Selected Coupon Toast */}
      {selectedCode && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={[styles.selectedToast, { backgroundColor: colors.marketUp + '15', borderColor: colors.marketUp + '30' }]}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.marketUp} />
          <Text style={[styles.selectedToastText, { color: colors.marketUp }]}>
            Coupon <Text style={styles.selectedToastCode}>{selectedCode}</Text> applied! Returning to subscription...
          </Text>
        </Animated.View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadCoupons(true)}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Loading available coupons...
            </Text>
          </View>
        ) : coupons.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="pricetag-outline" size={40} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Coupons Available</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              There are no active promo codes right now.{'\n'}Check back later for discounts!
            </Text>
          </View>
        ) : (
          <>
            {/* Section Header */}
            <View style={styles.sectionHeader}>
              <Ionicons name="pricetag" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {coupons.length} Coupon{coupons.length !== 1 ? 's' : ''} Available
              </Text>
            </View>

            {/* Coupon Cards */}
            {coupons.map((coupon, i) => (
              <CouponCard key={coupon.code} coupon={coupon} index={i} onSelect={handleSelectCoupon} />
            ))}

            {/* Info Text */}
            <View style={styles.infoSection}>
              <View style={[styles.infoRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Tap "Use This Coupon" on any promo code to apply it and return to the subscription screen.
                </Text>
              </View>
            </View>
          </>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ─── Coupon Card Styles ───────────────────────────────────────

const createCouponCardStyles = (colors: any) =>
  StyleSheet.create({
    couponCard: {
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.lg,
      borderRadius: BORDER_RADIUS.xl,
      borderWidth: 1,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
    },
    couponHeader: {
      padding: SPACING.lg,
      paddingBottom: SPACING.md,
    },
    couponHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    couponTypeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: BORDER_RADIUS.full,
    },
    couponTypeLabel: {
      ...FONTS.bold,
      fontSize: 9,
      color: '#fff',
      letterSpacing: 0.8,
    },
    expiredBadge: {
      backgroundColor: 'rgba(255,255,255,0.3)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: BORDER_RADIUS.full,
    },
    expiredBadgeText: {
      ...FONTS.bold,
      fontSize: 9,
      color: '#fff',
      letterSpacing: 0.5,
    },
    couponCode: {
      ...FONTS.mono,
      fontSize: FONTS.size.hero,
      color: '#fff',
      letterSpacing: 3,
      textShadowColor: 'rgba(0,0,0,0.15)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    couponBody: {
      padding: SPACING.lg,
    },
    discountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    discountAmount: {
      ...FONTS.black,
      fontSize: FONTS.size.xl,
      letterSpacing: 0.5,
    },
    minTierBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: BORDER_RADIUS.full,
    },
    minTierText: {
      ...FONTS.bold,
      fontSize: 10,
      letterSpacing: 0.5,
    },
    couponDescription: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      lineHeight: 18,
      marginBottom: SPACING.md,
    },
    metaRow: {
      flexDirection: 'row',
      gap: SPACING.lg,
      marginBottom: SPACING.sm,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    metaText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
    },
    usageBarContainer: {
      marginTop: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    usageBar: {
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: 4,
    },
    usageFill: {
      height: '100%',
      borderRadius: 2,
    },
    usageText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
    },
    applyBtnWrapper: {
      marginTop: SPACING.sm,
    },
    applyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
    },
    applyBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: '#fff',
    },
  });

// ─── Main Screen Styles ───────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
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
    title: {
      ...FONTS.bold,
      fontSize: FONTS.size.title,
    },
    selectedToast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.md,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
    },
    selectedToastText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      flex: 1,
    },
    selectedToastCode: {
      ...FONTS.bold,
      letterSpacing: 1,
    },
    scrollContent: {
      paddingBottom: SPACING.xl,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 100,
    },
    loadingText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      marginTop: SPACING.md,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 80,
      paddingHorizontal: SPACING.xl,
    },
    emptyIconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderStyle: 'dashed',
      marginBottom: SPACING.lg,
    },
    emptyTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.lg,
      marginBottom: SPACING.sm,
    },
    emptySubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      textAlign: 'center',
      lineHeight: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.lg,
    },
    sectionTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.lg,
    },
    // ─── Info Section ────────────────────────────────────────
    infoSection: {
      marginHorizontal: SPACING.xl,
      marginTop: SPACING.sm,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
    },
    infoText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      lineHeight: 16,
      flex: 1,
    },
  });
