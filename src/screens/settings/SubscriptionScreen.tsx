import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Alert, TextInput, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withSequence } from 'react-native-reanimated';
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
  const { subscription, isLoading, initiateUpgrade, cancelSubscription, isInTrial,
    trialDaysRemaining, hasTrialAvailable, couponInput: _couponInput, couponResult, isApplyingCoupon,
    setCouponInput, applyCoupon, removeCoupon, getDiscountedPrice,
    setUpAutopay, cancelAutopay, startTrial, refreshTrialStatus } = useSubscriptionStore();
  const getPlanPrice = useSubscriptionStore(s => s.getPlanPrice);
  const getFeaturesForTier = useSubscriptionStore(s => s.getFeaturesForTier);
  const getEffectiveFeatureMatrix = useSubscriptionStore(s => s.getEffectiveFeatureMatrix);
  const effectiveMatrix = getEffectiveFeatureMatrix();
  const tenantConfig = useSubscriptionStore(s => s.tenantConfig);
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(subscription.planId);
  const [couponCode, setCouponCode] = useState('');
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [showAutopayModal, setShowAutopayModal] = useState(false);

  // Refresh trial status on mount
  useEffect(() => {
    refreshTrialStatus();
    const interval = setInterval(refreshTrialStatus, 60000); // every minute
    return () => clearInterval(interval);
  }, [, refreshTrialStatus]);

  // Auto-show coupon input when returning from AvailableCoupons with a selected coupon
  useFocusEffect(
    useCallback(() => {
      const store = useSubscriptionStore.getState();
      if (store.couponSelectedFromList && store.couponInput && !store.couponResult) {
        setShowCouponInput(true);
        // Auto-apply the coupon with current selected plan
        const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId);
        if (plan && plan.tier !== 'free') {
          const price = getPlanPrice(plan.id);
          const displayPrice = isYearly ? price.yearly : price.monthly;
          applyCoupon(plan.tier, displayPrice);
        }
        store.markCouponFromList(false);
      }
      return () => {};
    }, [selectedPlanId, isYearly, getPlanPrice, applyCoupon]),
  );

  const trialActive = isInTrial();

  // Animated values for plan cards staggered entrance
  const cardAnim0 = useSharedValue(0);
  const cardAnim1 = useSharedValue(0);
  const cardAnim2 = useSharedValue(0);
  const cardAnims = useMemo(() => [cardAnim0, cardAnim1, cardAnim2], [cardAnim0, cardAnim1, cardAnim2]);
  const couponErrorShake = useSharedValue(0);

  const cardStyle0 = useAnimatedStyle(() => ({
    transform: [{ scale: cardAnim0.value }],
  }));
  const cardStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: cardAnim1.value }],
  }));
  const cardStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: cardAnim2.value }],
  }));
  const cardStyles = [cardStyle0, cardStyle1, cardStyle2];

  const couponShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: couponErrorShake.value }],
  }));

  useEffect(() => {
    cardAnims.forEach((anim, i) => {
      anim.value = withDelay(i * 150, withSpring(1, { stiffness: 120, damping: 12 }));
    });
  }, [cardAnims]);

  const showCouponError = useCallback(() => {
    couponErrorShake.value = withSequence(
      withSpring(-10, { damping: 2 }),
      withSpring(10, { damping: 2 }),
      withSpring(-10, { damping: 2 }),
      withSpring(0, { damping: 8 }),
    );
  }, [couponErrorShake]);



  const handleSelectPlan = useCallback((planId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlanId(planId);
  }, []);

  const handleApplyCoupon = useCallback(async () => {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId);
    if (!plan || plan.tier === 'free') return;
    const price = getPlanPrice(plan.id);
    const displayPrice = isYearly ? price.yearly : price.monthly;
    await applyCoupon(plan.tier, displayPrice);
    if (!useSubscriptionStore.getState().couponResult?.valid) {
      showCouponError();
    }
  }, [selectedPlanId, isYearly, applyCoupon, getPlanPrice, showCouponError]);

  const handleStartTrial = useCallback(async () => {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId);
    if (!plan || plan.tier === 'free') return;
    if (!hasTrialAvailable(plan.tier)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await startTrial(plan.tier);
  }, [selectedPlanId, hasTrialAvailable, startTrial]);

  const handleUpgrade = useCallback(async () => {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId);
    if (!plan || plan.tier === 'free') return;
    if (plan.tier === subscription.tier) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const discounted = getDiscountedPrice(plan.id, isYearly ? 'yearly' : 'monthly');
    const displayPrice = discounted.final;

    Alert.alert(
      `Upgrade to ${plan.name}`,
      (couponResult?.valid
        ? `Original: ₹${discounted.original.toLocaleString('en-IN')}/mo\nDiscount: -₹${discounted.discount.toLocaleString('en-IN')}/mo\n`
        : '') +
      `You'll be charged ₹${displayPrice.toLocaleString('en-IN')}${isYearly ? '/yr' : '/mo'}. Cancel anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Upgrade — ₹${displayPrice.toLocaleString('en-IN')}${isYearly ? '/yr' : '/mo'}`,
          onPress: async () => {
            await initiateUpgrade(plan, isYearly ? 'yearly' : 'monthly');
          },
        },
      ]
    );
  }, [selectedPlanId, subscription.tier, isYearly, initiateUpgrade, getDiscountedPrice, couponResult]);

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

  const handleAutopayToggle = useCallback(() => {
    if (subscription.isAutoPayEnabled && subscription.upiMandate) {
      Alert.alert(
        'Disable UPI AutoPay',
        'Recurring payments will be stopped. Your current benefits remain active until the end of the billing period.',
        [
          { text: 'Keep AutoPay', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              if (subscription.upiMandate) {
                await cancelAutopay(subscription.upiMandate.mandateId);
              }
            },
          },
        ]
      );
    } else {
      setShowAutopayModal(true);
    }
  }, [subscription.isAutoPayEnabled, cancelAutopay, subscription.upiMandate]);

  const handleSetupAutopay = useCallback(async (upiId: string) => {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId);
    if (!plan || plan.tier === 'free') return;
    const price = getPlanPrice(plan.id);
    const amount = isYearly ? price.yearly : price.monthly;
    await setUpAutopay(upiId, plan.id, amount, isYearly ? 'yearly' : 'monthly');
    setShowAutopayModal(false);
    setCouponCode('');
  }, [selectedPlanId, isYearly, getPlanPrice, setUpAutopay]);

  const handleRemoveCoupon = useCallback(() => {
    removeCoupon();
    setCouponCode('');
  }, [removeCoupon]);

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

        {/* Trial Banner */}
        {trialActive && trialDaysRemaining !== null && (
          <View style={styles.trialBanner}>
            <LinearGradient colors={['rgba(255,171,64,0.15)', 'rgba(255,143,0,0.08)']} style={styles.trialBannerGradient}>
              <View style={styles.trialRow}>
                <View style={styles.trialIconWrap}>
                  <Ionicons name="timer-outline" size={24} color={colors.warning} />
                </View>
                <View style={styles.trialInfo}>
                  <Text style={styles.trialTitle}>
                    {trialDaysRemaining > 0
                      ? `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} left in trial`
                      : 'Trial ended'}
                  </Text>
                  <Text style={styles.trialSubtitle}>
                    {trialDaysRemaining > 0
                      ? `Your ${currentPlan?.name} trial ends on ${subscription.trialEndDate ? new Date(subscription.trialEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}`
                      : 'Subscribe now to keep premium features'}
                  </Text>
                </View>
                {trialDaysRemaining <= 3 && trialDaysRemaining > 0 && (
                  <View style={styles.trialBadgeUrgent}>
                    <Text style={styles.trialBadgeUrgentText}>ENDING SOON</Text>
                  </View>
                )}
              </View>
              <View style={styles.trialProgressBar}>
                <View style={[styles.trialProgressFill, { width: `${Math.min(100, Math.max(5, (trialDaysRemaining / 7) * 100))}%` }]} />
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Billing Toggle */}
        {!isPaidUser && !trialActive && (
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

        {/* Coupon Section */}
        {!isPaidUser && !trialActive && selectedPlanId !== 'plan_free' && (
          <View style={styles.couponSection}>
            {!showCouponInput && !couponResult ? (
              <>
                <AnimatedPressable onPress={() => setShowCouponInput(true)} haptic="light" scaleTo={0.97}>
                  <View style={styles.couponToggle}>
                    <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
                    <Text style={styles.couponToggleText}>Have a coupon code?</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </AnimatedPressable>
                <AnimatedPressable onPress={() => navigation.navigate('AvailableCoupons')} haptic="light" scaleTo={0.97}>
                  <View style={[styles.couponToggle, { marginTop: 8, borderStyle: 'solid', borderColor: colors.primary + '30' }]}>
                    <Ionicons name="pricetag" size={16} color={colors.primary} />
                    <Text style={styles.couponToggleText}>View available coupons</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </AnimatedPressable>
                <AnimatedPressable onPress={() => navigation.navigate('CouponHistory')} haptic="light" scaleTo={0.97}>
                  <View style={[styles.couponToggle, { marginTop: 8, borderColor: colors.textMuted + '20' }]}>
                    <Ionicons name="receipt-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.couponToggleText, { color: colors.textSecondary }]}>My used coupons</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </AnimatedPressable>
              </>
            ) : couponResult && couponResult.valid ? (
              <Animated.View style={styles.couponApplied}>
                <View style={styles.couponAppliedRow}>
                  <View style={styles.couponAppliedLeft}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.marketUp} />
                    <View>
                      <Text style={styles.couponAppliedCode}>{couponResult.code}</Text>
                      <Text style={styles.couponAppliedDesc}>
                        {couponResult.type === 'free_trial'
                          ? `${couponResult.trialDays}-day free trial`
                          : `₹${couponResult.discountAmount.toLocaleString('en-IN')} off`}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={handleRemoveCoupon} style={styles.couponRemoveBtn}>
                    <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                  </Pressable>
                </View>
              </Animated.View>
            ) : (
              <Animated.View style={[styles.couponInputRow, couponShakeStyle]}>
                <TextInput
                  style={styles.couponInput}
                  value={couponCode}
                  onChangeText={(v) => { setCouponCode(v.toUpperCase()); setCouponInput(v); }}
                  placeholder="Enter coupon code"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <AnimatedPressable
                  onPress={handleApplyCoupon}
                  haptic="medium"
                  scaleTo={0.95}
                  disabled={isApplyingCoupon || !couponCode}
                >
                  <LinearGradient
                    colors={GRADIENTS.primary}
                    style={[styles.couponApplyBtn, isApplyingCoupon && { opacity: 0.7 }]}
                  >
                    <Text style={styles.couponApplyText}>
                      {isApplyingCoupon ? '...' : 'Apply'}
                    </Text>
                  </LinearGradient>
                </AnimatedPressable>
              </Animated.View>
            )}
            {couponResult && !couponResult.valid && couponResult.code && (
              <Text style={styles.couponError}>{couponResult.message}</Text>
            )}
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
                    cardStyles[i],
                  ]}
                >
                  {/* Card Header Gradient */}
                  <LinearGradient
                    colors={plan.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.planHeader}
                  >
                    <Ionicons name={plan.icon as keyof typeof Ionicons.glyphMap} size={32} color={colors.white} />
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

        {/* Trial CTA Button */}
        {!isPaidUser && hasTrialAvailable(SUBSCRIPTION_PLANS.find(p => p.id === selectedPlanId)?.tier || 'pro') && selectedPlanId !== 'plan_free' && (
          <View style={styles.trialCtaSection}>
            <AnimatedPressable
              onPress={handleStartTrial}
              haptic="medium"
              scaleTo={0.97}
            >
              <LinearGradient
                colors={['rgba(255,171,64,0.2)', 'rgba(255,143,0,0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.trialCtaBtn}
              >
                <Ionicons name="timer-outline" size={20} color={colors.warning} />
                <Text style={styles.trialCtaBtnText}>
                  Start Free Trial — 7 Days Free
                </Text>
              </LinearGradient>
            </AnimatedPressable>
            <Text style={styles.trialCtaSubtext}>No charges. Cancel anytime.</Text>
          </View>
        )}

        {/* CTA Button */}
        {!isPaidUser && !trialActive && (
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

        {/* UPI AutoPay Section (paid users) */}
        {isPaidUser && (
          <Card style={styles.autopayCard}>
            <View style={styles.autopayHeader}>
              <Ionicons name="qr-code" size={22} color={colors.primary} />
              <Text style={styles.autopayTitle}>UPI AutoPay</Text>
            </View>
            <Text style={styles.autopayDesc}>
              Set up recurring payments via UPI so your subscription never lapses.
            </Text>
            <View style={styles.autopayStatus}>
              {subscription.isAutoPayEnabled && subscription.upiMandate ? (
                <>
                  <View style={styles.autopayStatusRow}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.marketUp} />
                    <Text style={styles.autopayStatusText}>
                      AutoPay active — {subscription.upiMandate.upiId}
                    </Text>
                  </View>
                  {subscription.upiMandate.nextChargeDate && (
                    <Text style={styles.autopayNextDate}>
                      Next charge: {new Date(subscription.upiMandate.nextChargeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  )}
                </>
              ) : (
                <View style={styles.autopayStatusRow}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  <Text style={[styles.autopayStatusText, { color: colors.textMuted }]}>AutoPay not set up</Text>
                </View>
              )}
            </View>
            <AnimatedPressable
              onPress={handleAutopayToggle}
              haptic="light"
              scaleTo={0.97}
            >                <View style={[styles.autopayBtn, subscription.isAutoPayEnabled && styles.autopayBtnDanger]}>
                <Ionicons
                  name={subscription.isAutoPayEnabled ? 'pause-circle' : 'qr-code'}
                  size={18}
                  color={subscription.isAutoPayEnabled ? colors.danger : colors.primary}
                />
                <Text style={[styles.autopayBtnText, subscription.isAutoPayEnabled && { color: colors.danger }]}>
                  {subscription.isAutoPayEnabled ? 'Disable AutoPay' : 'Set Up AutoPay'}
                </Text>
              </View>
            </AnimatedPressable>
          </Card>
        )}

        {/* Payment History Link */}
        <AnimatedPressable
          onPress={() => navigation.navigate('PaymentHistory')}
          haptic="light"
          scaleTo={0.97}
        >
          <Card style={styles.paymentHistoryCard}>
            <View style={styles.paymentHistoryRow}>
              <View style={styles.paymentHistoryLeft}>
                <Ionicons name="receipt-outline" size={22} color={colors.primary} />
                <View>
                  <Text style={styles.paymentHistoryTitle}>Payment History</Text>
                  <Text style={styles.paymentHistorySubtitle}>
                    {(subscription.payments?.length || 0) > 0
                      ? `${subscription.payments?.length} payment${subscription.payments?.length !== 1 ? 's' : ''} recorded`
                      : 'View all subscription transactions'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </Card>
        </AnimatedPressable>

        {/* UPI AutoPay Setup Modal */}
        {showAutopayModal && (
          <View style={styles.autopayModalOverlay}>
            <View style={[styles.autopayModal, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <Text style={styles.autopayModalTitle}>Set Up UPI AutoPay</Text>
              <Text style={styles.autopayModalDesc}>
                Enable recurring payments via UPI. You'll be prompted to authenticate via your UPI app.
              </Text>
              <View style={styles.autopayModalOptions}>
                {[{ id: 'rahul@hdfc', label: 'HDFC Bank' }, { id: 'rahul@paytm', label: 'Paytm' }, { id: 'rahul@icici', label: 'ICICI Bank' }].map((opt) => (
                  <AnimatedPressable
                    key={opt.id}
                    onPress={() => handleSetupAutopay(opt.id)}
                    haptic="light"
                    scaleTo={0.97}
                  >
                    <View style={[styles.autopayOption, { borderColor: colors.border }]}>
                      <View style={styles.autopayOptionLeft}>
                        <View style={[styles.autopayOptionIcon, { backgroundColor: colors.primary + '20' }]}>
                          <Ionicons name="qr-code" size={20} color={colors.primary} />
                        </View>
                        <View>
                          <Text style={styles.autopayOptionLabel}>{opt.id}</Text>
                          <Text style={styles.autopayOptionSub}>{opt.label}</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </View>
                  </AnimatedPressable>
                ))}
              </View>
              <AnimatedPressable
                onPress={() => setShowAutopayModal(false)}
                haptic="light"
                scaleTo={0.97}
              >
                <Text style={styles.autopayModalCancel}>Cancel</Text>
              </AnimatedPressable>
            </View>
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

  // ── Trial Banner ──
  trialBanner: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  trialBannerGradient: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  trialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  trialIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trialInfo: {
    flex: 1,
  },
  trialTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  trialSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  trialBadgeUrgent: {
    backgroundColor: colors.danger + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  trialBadgeUrgentText: {
    ...FONTS.bold,
    fontSize: 8,
    color: colors.danger,
    letterSpacing: 0.5,
  },
  trialProgressBar: {
    marginTop: SPACING.md,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  trialProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.warning,
  },

  // ── Trial CTA ──
  trialCtaSection: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  trialCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  trialCtaBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.warning,
  },
  trialCtaSubtext: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // ── Coupon ──
  couponSection: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  couponToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed' as const,
  },
  couponToggleText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.primary,
    flex: 1,
  },
  couponInputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  couponInput: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    ...FONTS.mono,
    fontSize: FONTS.size.md,
    color: colors.text,
    letterSpacing: 2,
  },
  couponApplyBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  couponApplyText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.white,
  },
  couponApplied: {
    backgroundColor: colors.marketUp + '10',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.marketUp + '30',
    padding: SPACING.md,
  },
  couponAppliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  couponAppliedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  couponAppliedCode: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: colors.marketUp,
    letterSpacing: 1,
  },
  couponAppliedDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.marketUp,
    marginTop: 1,
  },
  couponRemoveBtn: {
    padding: 4,
  },
  couponError: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.danger,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },

  // ── UPI AutoPay ──
  autopayCard: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  autopayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  autopayTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  autopayDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: SPACING.md,
  },
  autopayStatus: {
    marginBottom: SPACING.md,
  },
  autopayStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  autopayStatusText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.marketUp,
  },
  autopayNextDate: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 4,
    marginLeft: 26,
  },
  autopayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  autopayBtnDanger: {
    borderColor: colors.danger + '30',
    backgroundColor: colors.danger + '10',
  },
  autopayBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },

  // ── AutoPay Modal ──
  autopayModalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  autopayModal: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  autopayModalTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
    marginBottom: SPACING.sm,
  },
  autopayModalDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.xl,
  },
  autopayModalOptions: {
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  autopayOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  autopayOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  autopayOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  autopayOptionLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  autopayOptionSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  autopayModalCancel: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },

  // ── Payment History Link Card ──
  paymentHistoryCard: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  paymentHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentHistoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  paymentHistoryTitle: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  paymentHistorySubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 1,
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
