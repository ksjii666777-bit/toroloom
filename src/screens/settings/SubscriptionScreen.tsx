import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Animated, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useSubscriptionStore, SUBSCRIPTION_PLANS } from '../../store/subscriptionStore';
import type { SubscriptionFeature, SubscriptionTier } from '../../types';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const CARD_GAP = SPACING.md;
const CARD_WIDTH = (width - SPACING.xl * 2 - CARD_GAP * 2) / 3;

export default function SubscriptionScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { subscription, isLoading, initiateUpgrade, cancelSubscription } = useSubscriptionStore();
  const getPlanPrice = useSubscriptionStore(s => s.getPlanPrice);
  const getFeaturesForTier = useSubscriptionStore(s => s.getFeaturesForTier);
  const getEffectiveFeatureMatrix = useSubscriptionStore(s => s.getEffectiveFeatureMatrix);
  const getTenantConfig = useSubscriptionStore(s => s.getTenantConfig);
  const effectiveMatrix = getEffectiveFeatureMatrix();
  const tenantConfig = getTenantConfig();
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(subscription.planId);

  // Animated values for plan cards staggered entrance
  const cardAnims = useRef(SUBSCRIPTION_PLANS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(150, cardAnims.map((anim, i) =>
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 12,
        bounciness: 6,
        delay: i * 100,
      })
    )).start();
  }, [cardAnims]);



  const handleSelectPlan = useCallback((planId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlanId(planId);
  }, []);

  const handleUpgrade = useCallback(async () => {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId);
    if (!plan || plan.tier === 'free') return;
    if (plan.tier === subscription.tier) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const planPrice = getPlanPrice(plan.id);

    Alert.alert(
      `Upgrade to ${plan.name}`,
      isYearly
        ? `You'll be charged ₹${planPrice.yearly.toLocaleString('en-IN')}/year. Cancel anytime.`
        : `You'll be charged ₹${planPrice.monthly.toLocaleString('en-IN')}/month. Cancel anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Upgrade — ₹${isYearly ? planPrice.yearly.toLocaleString('en-IN') + '/yr' : planPrice.monthly.toLocaleString('en-IN') + '/mo'}`,
          onPress: async () => {
            // Store billing preference
            await initiateUpgrade(plan);
          },
        },
      ]
    );
  }, [selectedPlanId, subscription.tier, isYearly, initiateUpgrade, getPlanPrice]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      'Cancel Subscription',
      'Your premium features will remain active until the end of the billing period. After that, you\'ll be downgraded to the Free plan.',
      [
        { text: 'Keep Premium', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            await cancelSubscription();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  }, [cancelSubscription]);

  const currentPlan = SUBSCRIPTION_PLANS.find(p => p.id === subscription.planId);
  const isPaidUser = subscription.tier !== 'free';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
          <View style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </View>
        </AnimatedPressable>
        <Text style={styles.title}>Premium</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroGradient}>
            <Ionicons name="diamond" size={48} color={colors.white} />
            <Text style={styles.heroTitle}>
              {tenantConfig && tenantConfig.id !== 'default'
                ? `Unlock ${tenantConfig.name} Premium`
                : 'Unlock Toroloom Premium'}
            </Text>
            <Text style={styles.heroSubtitle}>
              {isPaidUser
                ? `You're on the ${currentPlan?.name} plan. Enjoy premium features!`
                : 'Get AI insights, advanced analytics, and more.'}
            </Text>
            {tenantConfig && tenantConfig.id !== 'default' && (
              <Text style={styles.tenantBranding}>Powered by {tenantConfig.name}</Text>
            )}
            {isPaidUser && (
              <Badge label={currentPlan?.name || 'Premium'} variant="primary" />
            )}
          </LinearGradient>
        </View>

        {/* Billing Toggle */}
        {!isPaidUser && (
          <View style={styles.billingToggle}>
            <AnimatedPressable
              onPress={() => { setIsYearly(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              haptic="light"
              scaleTo={0.95}
            >
              <View style={[styles.billingOption, !isYearly && styles.billingOptionActive]}>
                <Text style={[styles.billingText, !isYearly && styles.billingTextActive]}>Monthly</Text>
              </View>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => { setIsYearly(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              haptic="light"
              scaleTo={0.95}
            >
              <View style={[styles.billingOption, isYearly && styles.billingOptionActive]}>
                <Text style={[styles.billingText, isYearly && styles.billingTextActive]}>Yearly</Text>
              </View>
            </AnimatedPressable>
          </View>
        )}

        {/* Plan Cards — Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.plansContainer}
          snapToInterval={CARD_WIDTH + CARD_GAP}
          decelerationRate="fast"
        >
          {SUBSCRIPTION_PLANS.map((plan, i) => {
            const isSelected = selectedPlanId === plan.id;
            const isCurrent = subscription.planId === plan.id;
            const effectivePrice = getPlanPrice(plan.id);
            const price = isYearly ? effectivePrice.yearly : effectivePrice.monthly;

            return (
              <AnimatedPressable
                key={plan.id}
                onPress={() => handleSelectPlan(plan.id)}
                haptic="light"
                scaleTo={0.97}
                disabled={isCurrent}
              >
                <Animated.View
                  style={[
                    styles.planCard,
                    isSelected && styles.planCardSelected,
                    isCurrent && styles.planCardCurrent,
                    { transform: [{ scale: cardAnims[i] }] },
                  ]}
                >
                  {/* Card Header Gradient */}
                  <LinearGradient
                    colors={plan.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.planHeader}
                  >
                    <Ionicons name={plan.icon as any} size={32} color={colors.white} />
                    {plan.popular && (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularBadgeText}>{plan.badge}</Text>
                      </View>
                    )}
                  </LinearGradient>

                  {/* Plan Info */}
                  <View style={styles.planBody}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planTagline}>{plan.tagline}</Text>

                    {plan.tier !== 'free' ? (
                      <View style={styles.priceContainer}>
                        <Text style={styles.priceAmount}>₹{price.toLocaleString('en-IN')}</Text>
                        <Text style={styles.pricePeriod}>/{isYearly ? 'yr' : 'mo'}</Text>
                      </View>
                    ) : (
                      <Text style={styles.freePrice}>₹0</Text>
                    )}

                    {isYearly && plan.tier !== 'free' && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>
                          Save ₹{(effectivePrice.monthly * 12 - effectivePrice.yearly).toLocaleString('en-IN')}/yr
                        </Text>
                      </View>
                    )}

                    {/* Feature List */}
                    <View style={styles.featureList}>
                      {getFeaturesForTier(plan.tier).map((featureKey) => {
                        const meta = effectiveMatrix[featureKey];
                        return (
                          <View key={featureKey} style={styles.featureRow}>
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color={plan.tier === 'elite' ? colors.marketUp : colors.primary}
                            />
                            <Text style={styles.featureText}>{meta?.label || featureKey}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Selection indicator */}
                  {isSelected && (
                    <View style={styles.selectedIndicator}>
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    </View>
                  )}

                  {isCurrent && (
                    <View style={styles.currentLabel}>
                      <Text style={styles.currentLabelText}>CURRENT PLAN</Text>
                    </View>
                  )}
                </Animated.View>
              </AnimatedPressable>
            );
          })}
        </ScrollView>

        {/* Current Plan Status */}
        {isPaidUser && (
          <Card style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusIcon}>
                <Ionicons
                  name={subscription.autoRenew ? 'shield-checkmark' : 'shield-outline'}
                  size={28}
                  color={subscription.autoRenew ? colors.marketUp : colors.textMuted}
                />
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.statusTitle}>
                  {subscription.autoRenew ? 'Active — Auto-Renew On' : 'Cancelled'}
                </Text>
                <Text style={styles.statusSubtitle}>
                  {subscription.autoRenew
                    ? `Renews on ${new Date(subscription.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : `Expires on ${new Date(subscription.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </Text>
              </View>
            </View>
            <View style={styles.statusActions}>
              {subscription.autoRenew ? (
                <AnimatedPressable onPress={handleCancel} haptic="warning" scaleTo={0.97}>
                  <View style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel Auto-Renew</Text>
                  </View>
                </AnimatedPressable>
              ) : (
                <AnimatedPressable onPress={() => initiateUpgrade(SUBSCRIPTION_PLANS.find(p => p.id === subscription.planId)!)} haptic="medium" scaleTo={0.97}>
                  <View style={styles.renewBtn}>
                    <Text style={styles.renewBtnText}>Renew Subscription</Text>
                  </View>
                </AnimatedPressable>
              )}
            </View>
          </Card>
        )}

        {/* CTA Button */}
        {!isPaidUser && (
          <View style={styles.ctaSection}>
            <AnimatedPressable
              onPress={handleUpgrade}
              haptic="medium"
              scaleTo={0.97}
              disabled={isLoading || selectedPlanId === 'plan_free'}
            >
              <LinearGradient
                colors={selectedPlanId === 'plan_elite' ? GRADIENTS.success : GRADIENTS.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.ctaBtn, isLoading && styles.ctaBtnLoading]}
              >
                {isLoading ? (
                  <Text style={styles.ctaBtnText}>Processing...</Text>
                ) : (
                  <>
                    <Ionicons
                      name={selectedPlanId === 'plan_elite' ? 'diamond' : selectedPlanId === 'plan_pro' ? 'flash' : 'rocket-outline'}
                      size={20}
                      color={colors.white}
                    />
                    <Text style={styles.ctaBtnText}>
                      {selectedPlanId === 'plan_free'
                        ? 'Select a plan to upgrade'
                        : `Upgrade to ${SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId)?.name}`}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </AnimatedPressable>

            <Text style={styles.secureText}>
              <Ionicons name="lock-closed" size={12} color={colors.textMuted} /> Secure payment via Razorpay
            </Text>
          </View>
        )}

        {/* Feature Comparison Table */}
        <Card title="Compare Plans" style={styles.comparisonCard}>
          {(Object.keys(effectiveMatrix) as SubscriptionFeature[]).map((featureKey, i) => {
            const meta = effectiveMatrix[featureKey];
            const tiers: SubscriptionTier[] = ['free', 'pro', 'elite'];
            const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, elite: 2 };
            return (
              <View key={featureKey} style={[styles.compareRow, i % 2 === 0 && styles.compareRowAlt]}>
                <Text style={styles.compareFeature}>{meta.label}</Text>
                {tiers.map(tier => {
                  const isAvailable = TIER_RANK[tier] >= TIER_RANK[meta.minTier];
                  return (
                    <Ionicons
                      key={tier}
                      name={isAvailable ? 'checkmark' : 'close'}
                      size={16}
                      color={isAvailable ? colors.marketUp : colors.textMuted}
                      style={styles.compareIcon}
                    />
                  );
                })}
              </View>
            );
          })}
        </Card>

        {/* Payment Info */}
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentInfoText}>
            Payments are processed securely through Razorpay. Your payment information is encrypted and never stored on our servers.
          </Text>
          <Text style={styles.paymentInfoText}>
            You can cancel anytime from this screen. Cancellations take effect at the end of the current billing period.
          </Text>
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
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // ── Hero ──
  heroSection: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  heroGradient: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  heroTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.white,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  tenantBranding: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },

  // ── Billing Toggle ──
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.full,
    padding: 4,
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    alignSelf: 'center',
  },
  billingOption: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  billingOptionActive: {
    backgroundColor: colors.primary,
  },
  billingText: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.textMuted,
  },
  billingTextActive: {
    color: colors.white,
  },

  // ── Plan Cards ──
  plansContainer: {
    paddingHorizontal: SPACING.xl,
    gap: CARD_GAP,
    marginBottom: SPACING.xl,
  },
  planCard: {
    width: width * 0.78,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  planCardCurrent: {
    opacity: 0.8,
    borderColor: colors.textMuted,
  },
  planHeader: {
    padding: SPACING.xl,
    alignItems: 'center',
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  popularBadgeText: {
    ...FONTS.bold,
    fontSize: 9,
    color: colors.white,
    letterSpacing: 0.5,
  },
  planBody: {
    padding: SPACING.lg,
  },
  planName: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
  },
  planTagline: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: SPACING.lg,
  },
  priceAmount: {
    ...FONTS.black,
    fontSize: FONTS.size.hero,
    color: colors.text,
  },
  pricePeriod: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  freePrice: {
    ...FONTS.black,
    fontSize: FONTS.size.hero,
    color: colors.text,
    marginTop: SPACING.lg,
  },
  discountBadge: {
    marginTop: SPACING.sm,
    backgroundColor: colors.marketUp + '20',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  discountText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: colors.marketUp,
  },
  featureList: {
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  featureText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  selectedIndicator: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
  },
  currentLabel: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: colors.textMuted + '40',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  currentLabelText: {
    ...FONTS.bold,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },

  // ── Status Card ──
  statusCard: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.bgCardLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  statusSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusActions: {
    marginTop: SPACING.lg,
  },
  cancelBtn: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    backgroundColor: colors.danger + '15',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.danger + '30',
  },
  cancelBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.danger,
  },
  renewBtn: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  renewBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.primary,
  },

  // ── CTA ──
  ctaSection: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  ctaBtnLoading: {
    opacity: 0.7,
  },
  ctaBtnText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.white,
  },
  secureText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // ── Comparison Table ──
  comparisonCard: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  compareRowAlt: {
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.sm,
  },
  compareFeature: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.text,
    flex: 1,
  },
  compareIcon: {
    width: 40,
    textAlign: 'center',
  },

  // ── Payment Info ──
  paymentInfo: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  paymentInfoText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
