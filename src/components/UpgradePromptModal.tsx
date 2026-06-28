/**
 * ============================================================================
 * Toroloom — Upgrade Prompt Modal
 * ============================================================================
 *
 * Full-screen modal overlay that appears when the backend returns a 402
 * Payment Required response.  Guides the user to upgrade their subscription
 * with a visually compelling comparison of their current tier vs the
 * required tier.
 *
 * Features:
 *   - Animated entrance (fade + spring scale)
 *   - Feature icon with pulsing glow
 *   - Tier comparison card (current vs required)
 *   - "Upgrade Now" CTA → navigates to SubscriptionScreen
 *   - "Maybe Later" dismiss button
 *   - Haptic feedback on show
 *
 * Placed globally in AppNavigator, next to IronLockOverlay.
 * ============================================================================
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  interpolate,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useUpgradePromptStore } from '../store/subscriptionUIStore';
import { useSubscriptionStore, SUBSCRIPTION_PLANS } from '../store/subscriptionStore';
import { BORDER_RADIUS, SPACING } from '../constants/theme';
import Button from './ui/Button';

const { width } = Dimensions.get('window');

// ──── Tier Display Config ─────────────────────────────────────────────────

const TIER_DISPLAY: Record<string, { label: string; color: string; icon: string }> = {
  free:   { label: 'Free',     color: '#6B7280', icon: 'rocket-outline' },
  pro:    { label: 'Pro',      color: '#3B82F6', icon: 'flash' },
  elite:  { label: 'Elite',    color: '#10B981', icon: 'diamond' },
};

// ──── Component ───────────────────────────────────────────────────────────

export default function UpgradePromptModal() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    visible,
    featureName,
    featureIcon,
    requiredTier,
    currentTier,
    hide,
  } = useUpgradePromptStore();

  const getPlanPrice = useSubscriptionStore(s => s.getPlanPrice);

  // Refs
  const prevVisibleRef = useRef(false);

  // ── Animations ──────────────────────────────────────────────────────────
  const backdropOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.8);
  const modalTranslateY = useSharedValue(60);
  const glowPulse = useSharedValue(0);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    opacity: interpolate(modalScale.value, [0.8, 1], [0, 1]),
    transform: [
      { scale: modalScale.value },
      { translateY: modalTranslateY.value },
    ],
  }));

  const glowRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 1], [0.15, 0.4]),
    transform: [{ scale: interpolate(glowPulse.value, [0, 1], [1, 1.15]) }],
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 1], [0.1, 0.3]),
  }));

  // ── Show/Hide Logic ────────────────────────────────────────────────────

  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (visible && !wasVisible) {
      // Reset animation values
      backdropOpacity.value = 0;
      modalScale.value = 0.8;
      modalTranslateY.value = 60;
      glowPulse.value = 0;

      // Entrance animation
      backdropOpacity.value = withTiming(1, { duration: 300 });
      modalScale.value = withSpring(1, { stiffness: 100, damping: 14 });
      modalTranslateY.value = withSpring(0, { stiffness: 100, damping: 14 });

      // Start glow pulse loop
      glowPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );

      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    if (!visible && wasVisible) {
      // Exit animation
      glowPulse.value = 0;
      backdropOpacity.value = withTiming(0, { duration: 250 });
      modalScale.value = withTiming(0.9, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(resetAnimValues)();
        }
      });
      modalTranslateY.value = withTiming(40, { duration: 200 });
    }

    // Cleanup glow animation on unmount
    return () => {
      glowPulse.value = 0;
    };
  }, [visible]);

  function resetAnimValues() {
    backdropOpacity.value = 0;
    modalScale.value = 0.8;
    modalTranslateY.value = 60;
  }

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    hide();
    // Small delay to allow modal exit animation to start before navigating
    setTimeout(() => {
      navigation.navigate('Subscription');
    }, 300);
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    hide();
  };

  // ── Data ────────────────────────────────────────────────────────────────

  const requiredPlan = SUBSCRIPTION_PLANS.find(p => p.tier === requiredTier);
  const requiredDisplay = TIER_DISPLAY[requiredTier] ?? TIER_DISPLAY.pro;
  const currentDisplay = TIER_DISPLAY[currentTier] ?? TIER_DISPLAY.free;
  const requiredPrice = requiredPlan ? getPlanPrice(requiredPlan.id) : { monthly: 0, yearly: 0 };

  if (!visible) return null;

  return (
    <View style={styles.root} pointerEvents="auto">
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </TouchableWithoutFeedback>

      {/* Modal Card */}
      <Animated.View
        style={[
          styles.modalContainer,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
          modalStyle,
        ]}
      >
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.modalGradient}
        >
          {/* Close button */}
          <View style={styles.closeRow}>
            <TouchableWithoutFeedback onPress={handleDismiss}>
              <View style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
              </View>
            </TouchableWithoutFeedback>
          </View>

          {/* Feature Icon with Glow */}
          <View style={styles.iconSection}>
            <View style={styles.iconContainer}>
              {/* Outer glow ring */}
              <Animated.View style={[styles.glowRing, glowRingStyle]} />
              {/* Inner glow */}
              <Animated.View
                style={[
                  styles.innerGlow,
                  innerGlowStyle,
                  { backgroundColor: requiredDisplay.color },
                ]}
              />
              {/* Icon */}
              <View style={[styles.iconCircle, { backgroundColor: requiredDisplay.color + '25' }]}>
                <Ionicons name={featureIcon as keyof typeof Ionicons.glyphMap} size={40} color={requiredDisplay.color} />
              </View>
            </View>
          </View>

          {/* Text Content */}
          <Text style={styles.title}>Upgrade Required</Text>
          <Text style={styles.description}>
            <Text style={styles.featureName}>{featureName}</Text> requires a{' '}
            <Text style={[styles.tierHighlight, { color: requiredDisplay.color }]}>
              {requiredDisplay.label}
            </Text>{' '}
            subscription. You're currently on the{' '}
            <Text style={[styles.tierHighlight, { color: currentDisplay.color }]}>
              {currentDisplay.label}
            </Text>{' '}
            plan.
          </Text>

          {/* Tier Comparison */}
          <View style={styles.comparisonCard}>
            {/* Current Tier */}
            <View style={styles.tierColumn}>
              <View style={[styles.tierBadge, { backgroundColor: currentDisplay.color + '20', borderColor: currentDisplay.color + '40' }]}>
                <Ionicons name={currentDisplay.icon as keyof typeof Ionicons.glyphMap} size={18} color={currentDisplay.color} />
                <Text style={[styles.tierLabel, { color: currentDisplay.color }]}>{currentDisplay.label}</Text>
              </View>
              <Text style={styles.tierStatusLabel}>Current</Text>
              <View style={styles.featureCheckRow}>
                <Ionicons name="close-circle" size={16} color="#EF4444" />
                <Text style={styles.featureCheckText}>Not available</Text>
              </View>
            </View>

            {/* Arrow */}
            <View style={styles.arrowColumn}>
              <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.3)" />
            </View>

            {/* Required Tier */}
            <View style={styles.tierColumn}>
              <View style={[styles.tierBadge, { backgroundColor: requiredDisplay.color + '20', borderColor: requiredDisplay.color + '40' }]}>
                <Ionicons name={requiredDisplay.icon as keyof typeof Ionicons.glyphMap} size={18} color={requiredDisplay.color} />
                <Text style={[styles.tierLabel, { color: requiredDisplay.color }]}>{requiredDisplay.label}</Text>
              </View>
              <Text style={styles.tierStatusLabel}>Required</Text>
              <View style={styles.featureCheckRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={[styles.featureCheckText, { color: '#10B981' }]}>Unlocked</Text>
              </View>
            </View>
          </View>

          {/* Pricing Info */}
          {requiredPlan && requiredPlan.tier !== 'free' && (
            <Text style={styles.pricingText}>
              From ₹{requiredPrice.monthly.toLocaleString('en-IN')}/month — Cancel anytime
            </Text>
          )}

          {/* CTA Buttons */}
          <View style={styles.actions}>
            <Button
              title={`Upgrade to ${requiredDisplay.label}`}
              onPress={handleUpgrade}
              variant="primary"
              size="large"
              gradient={
                requiredTier === 'elite'
                  ? ['#10B981', '#059669'] as [string, string]
                  : ['#3B82F6', '#2563EB'] as [string, string]
              }
              icon={
                <Ionicons
                  name={requiredDisplay.icon as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color="#FFFFFF"
                />
              }
            />
            <Button
              title="Maybe Later"
              onPress={handleDismiss}
              variant="ghost"
              size="medium"
            />
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// ──── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 9997,
    elevation: 9997,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    width: width * 0.88,
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  modalGradient: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  closeRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: SPACING.sm,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Icon Section ──
  iconSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  iconContainer: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  innerGlow: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Text ──
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  featureName: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tierHighlight: {
    fontWeight: '700',
  },

  // ── Comparison ──
  comparisonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    width: '100%',
  },
  tierColumn: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  arrowColumn: {
    paddingHorizontal: SPACING.sm,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  tierLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  tierStatusLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  featureCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureCheckText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },

  // ── Pricing ──
  pricingText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },

  // ── Actions ──
  actions: {
    width: '100%',
    gap: SPACING.sm,
  },
});
