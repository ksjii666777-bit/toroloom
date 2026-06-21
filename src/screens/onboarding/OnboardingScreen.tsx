import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions,
  TouchableOpacity, Platform,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, withTiming, withSpring, withDelay, interpolate, Extrapolation } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useOnboardingStore, ONBOARDING_STEPS } from '../../store/onboardingStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { analytics } from '../../services/analytics';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - SPACING.xl * 2;
const CARD_GAP = SPACING.md;
const MAX_CARDS = 5; // ONBOARDING_STEPS max length

export default function OnboardingScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { currentStep, setCurrentStep, skipOnboarding, referralSource } = useOnboardingStore();

  // Referral variant: skip welcome step, start at portfolio
  const startStep = referralSource ? 1 : 0;
  const visibleSteps = referralSource
    ? ONBOARDING_STEPS.filter(s => s.id !== 'welcome')
    : ONBOARDING_STEPS;
  const totalSteps = visibleSteps.length;

  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(startStep * CARD_WIDTH);
  const [isLastStep, setIsLastStep] = useState(startStep === totalSteps - 1);
  const hasScrolledToStart = useRef(false);

  // Track default onboarding start once on mount
  const hasTrackedDefaultStart = useRef(false);
  useEffect(() => {
    if (!referralSource && !hasTrackedDefaultStart.current) {
      hasTrackedDefaultStart.current = true;
      analytics.logEvent('onboarding_started', {
        source: 'direct',
        variant: 'default',
      }).catch(() => {});
    }
  }, [referralSource]);

  // ── Staggered entrance animation ──
  const heroProgress = useSharedValue(0);
  const contentProgress = useSharedValue(0);
  const bottomProgress = useSharedValue(0);

  useEffect(() => {
    heroProgress.value = withTiming(1, { duration: 500 });
    contentProgress.value = withDelay(500, withTiming(1, { duration: 400 }));
    bottomProgress.value = withDelay(900, withTiming(1, { duration: 300 }));
  }, []);

  const heroStyle = useAnimatedStyle(() => ({ opacity: heroProgress.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentProgress.value }));
  const bottomStyle = useAnimatedStyle(() => ({ opacity: bottomProgress.value }));

  // ── Card entrance animations ──
  // Create up to MAX_CARDS shared values for scale and opacity
  const cardScale0 = useSharedValue(0.9); const cardOpacity0 = useSharedValue(0);
  const cardScale1 = useSharedValue(0.9); const cardOpacity1 = useSharedValue(0);
  const cardScale2 = useSharedValue(0.9); const cardOpacity2 = useSharedValue(0);
  const cardScale3 = useSharedValue(0.9); const cardOpacity3 = useSharedValue(0);
  const cardScale4 = useSharedValue(0.9); const cardOpacity4 = useSharedValue(0);

  const cardScales = [cardScale0, cardScale1, cardScale2, cardScale3, cardScale4];
  const cardOpacities = [cardOpacity0, cardOpacity1, cardOpacity2, cardOpacity3, cardOpacity4];

  const cardStyle0 = useAnimatedStyle(() => ({ transform: [{ scale: cardScale0.value }], opacity: cardOpacity0.value }));
  const cardStyle1 = useAnimatedStyle(() => ({ transform: [{ scale: cardScale1.value }], opacity: cardOpacity1.value }));
  const cardStyle2 = useAnimatedStyle(() => ({ transform: [{ scale: cardScale2.value }], opacity: cardOpacity2.value }));
  const cardStyle3 = useAnimatedStyle(() => ({ transform: [{ scale: cardScale3.value }], opacity: cardOpacity3.value }));
  const cardStyle4 = useAnimatedStyle(() => ({ transform: [{ scale: cardScale4.value }], opacity: cardOpacity4.value }));

  const cardStyles = [cardStyle0, cardStyle1, cardStyle2, cardStyle3, cardStyle4];

  useEffect(() => {
    // Animate cards in sequence
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    visibleSteps.forEach((_, i) => {
      const delay = i * 150;
      const id = setTimeout(() => {
        cardScales[i].value = withSpring(1, { stiffness: 100, damping: 12 });
        cardOpacities[i].value = withTiming(1, { duration: 300 });
      }, delay);
      timeouts.push(id);
    });
    return () => timeouts.forEach(clearTimeout);
  }, []);

  // ── Scroll-driven progress bar ──
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const progressStyle = useAnimatedStyle(() => {
    const w = interpolate(
      scrollX.value,
      [0, (totalSteps - 1) * CARD_WIDTH],
      [0, CARD_WIDTH],
      Extrapolation.CLAMP,
    );
    return { width: w };
  });

  // ── Scroll to the referral start step once the ScrollView has been laid out ──
  const handleScrollLayout = useCallback(() => {
    if (referralSource && !hasScrolledToStart.current) {
      hasScrolledToStart.current = true;
      scrollRef.current?.scrollTo({ x: startStep * CARD_WIDTH, animated: false });
      setCurrentStep(startStep);
    }
  }, [referralSource, startStep, setCurrentStep]);

  // Update current step when scroll changes
  const handleScrollEnd = useCallback(
    (e: any) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const page = Math.round(offsetX / CARD_WIDTH);
      const clamped = Math.max(0, Math.min(totalSteps - 1, page));
      setCurrentStep(clamped);
      setIsLastStep(clamped === totalSteps - 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [setCurrentStep, totalSteps]
  );

  // Scroll to step
  const scrollToStep = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({ x: index * CARD_WIDTH, animated: true });
      setCurrentStep(index);
      setIsLastStep(index === totalSteps - 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [setCurrentStep, totalSteps]
  );

  // Handle skip
  const handleSkip = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await skipOnboarding();
  }, [skipOnboarding]);

  // Handle next
  const handleNext = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep < totalSteps - 1) {
      scrollToStep(currentStep + 1);
    } else {
      // Complete onboarding — state change will auto-navigate to MainTabs
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await useOnboardingStore.getState().completeOnboarding();
    }
  }, [currentStep, totalSteps, scrollToStep]);

  // Handle get started
  const handleGetStarted = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await useOnboardingStore.getState().completeOnboarding();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Bar — Skip + Page Indicator */}
      <Animated.View style={[styles.topBar, contentStyle]}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Progress dots (referral variant has 4 dots instead of 5) */}
        <View style={styles.dotsRow}>
          {visibleSteps.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => scrollToStep(i)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.dot,
                  i === currentStep && styles.dotActive,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ width: 60 }} />
      </Animated.View>

      {/* Scrollable Cards */}
      <Animated.View style={[styles.cardsContainer, heroStyle]}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + CARD_GAP}
          decelerationRate="fast"
          onMomentumScrollEnd={handleScrollEnd}
          onLayout={handleScrollLayout}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={styles.cardsContent}
        >
          {visibleSteps.map((step, i) => (
            <Animated.View
              key={step.id}
              style={[
                styles.card,
                { width: CARD_WIDTH },
                cardStyles[i],
              ]}
            >
              {/* Card Gradient Background */}
              <LinearGradient
                colors={step.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              >
                {/* Icon */}
                <View style={styles.iconWrapper}>
                  <Ionicons name={step.icon as any} size={80} color="#FFFFFF" />
                </View>

                {/* Glow effect */}
                <View style={styles.iconGlow} />
              </LinearGradient>

              {/* Card Content */}
              <View style={styles.cardBody}>
                <Text style={styles.stepLabel}>
                  STEP {i + 1} OF {totalSteps}
                </Text>
                <Text style={styles.cardTitle}>{step.title}</Text>
                <Text style={styles.cardSubtitle}>{step.subtitle}</Text>
                <Text style={styles.cardDescription}>{step.description}</Text>

                {/* Feature highlights */}
                <View style={styles.highlights}>
                  {[
                    { icon: 'shield-checkmark', text: 'Secure & encrypted' },
                    { icon: 'flash', text: 'Real-time data' },
                    { icon: 'headset', text: '24/7 support' },
                  ].map((item, hi) => (
                    <View key={hi} style={styles.highlightRow}>
                      <Ionicons name={item.icon as any} size={16} color={colors.marketUp} />
                      <Text style={styles.highlightText}>{item.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Bottom Section — Navigation Buttons + Progress Bar */}
      <Animated.View style={[styles.bottomSection, bottomStyle, { paddingBottom: insets.bottom + SPACING.xl }]}>
        {/* Progress bar */}
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFill, progressStyle]} />
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          {/* Previous / Back */}
          {currentStep > 0 ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => scrollToStep(currentStep - 1)}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 48 }} />
          )}

          {/* Main CTA */}
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={isLastStep ? handleGetStarted : handleNext}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={visibleSteps[currentStep]?.gradient || ['#3B82F6', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>
                {isLastStep ? '🚀 Get Started' : 'Continue'}
              </Text>
              {!isLastStep && (
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },

  // ── Top Bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  skipBtn: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  skipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: '#9CA3AF',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#374151',
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },

  // ── Cards ──
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardsContent: {
    paddingHorizontal: SPACING.xl,
    gap: CARD_GAP,
    paddingVertical: SPACING.lg,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: '#1F2937',
    overflow: 'hidden',
    minHeight: height * 0.55,
  },
  cardGradient: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  iconGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 180,
    height: 180,
    marginLeft: -90,
    marginTop: -90,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardBody: {
    padding: SPACING.xl,
  },
  stepLabel: {
    ...FONTS.bold,
    fontSize: FONTS.size.xs,
    color: '#6B7280',
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  cardSubtitle: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: '#3B82F6',
    marginBottom: SPACING.md,
  },
  cardDescription: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: '#9CA3AF',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  highlights: {
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    paddingTop: SPACING.lg,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  highlightText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: '#9CA3AF',
  },

  // ── Bottom Section ──
  bottomSection: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    backgroundColor: '#0B0F19',
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  progressBarBg: {
    height: 3,
    backgroundColor: '#1F2937',
    borderRadius: 1.5,
    marginBottom: SPACING.xl,
  },
  progressBarFill: {
    height: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 1.5,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaBtn: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  ctaText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: '#FFFFFF',
  },
});
