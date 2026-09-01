import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  Pressable, ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler,
  withTiming, withDelay, interpolate,
  Extrapolation, FadeInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useOnboardingStore, ONBOARDING_STEPS } from '../../store/onboardingStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { analytics } from '../../services/analytics';
import * as Haptics from 'expo-haptics';
import { renderIllustration } from '../../components/onboarding/onboardingUtils';
import AppScreen from '../../components/ui/AppScreen';
import OnboardingLottie from '../../components/onboarding/OnboardingLottie';
import {
  MiniPieChart,
  MiniCandlestickChart,
  MockTradePanel,
  MiniBrokerConnect,
  InteractiveBadges,
  RocketAnimation,
  AnimatedStepCard,
} from '../../components/onboarding/demos';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';


const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - SPACING.xl * 2;
const CARD_GAP = SPACING.md;

// (Demo components extracted to ../../components/onboarding/demos)
// ────────────────────────────────────────────────────────

export default function OnboardingScreen({ navigation: _navigation  }: NativeStackScreenProps<RootStackParamList, 'Onboarding'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const {
    currentStep, setCurrentStep, skipOnboarding,
    completeOnboarding,
    referralSource, interactedSteps, markStepInteracted,
    markStepDemoCompleted, stepDemoCompleted,
  } = useOnboardingStore();

  // Toggle between SVG illustrations and Lottie animations
  const [useLottie, setUseLottie] = useState(false);

  // Referral variant: skip welcome step, start at portfolio
  const startStep = referralSource ? 1 : 0;
  const visibleSteps = referralSource
    ? ONBOARDING_STEPS.filter(s => s.id !== 'welcome')
    : ONBOARDING_STEPS;
  const totalSteps = visibleSteps.length;

  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(startStep * CARD_WIDTH);
  const isLastStep = currentStep >= totalSteps - 1;
  const hasScrolledToStart = useRef(false);
  const parallaxX = useSharedValue(0);

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
  }, [bottomProgress, contentProgress, heroProgress]);

  const heroStyle = useAnimatedStyle(() => ({ opacity: heroProgress.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentProgress.value }));
  const bottomStyle = useAnimatedStyle(() => ({ opacity: bottomProgress.value }));

  // ── Card entrance animations (managed per-card by AnimatedStepCard) ──

  // ── Scroll-driven progress bar with parallax ──
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
      parallaxX.value = event.contentOffset.x * 0.3;
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

  // ── Parallax gradient style ──
  const parallaxStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -parallaxX.value }],
  }));

  // ── Scroll to the referral start step once the ScrollView has been laid out ──
  const handleScrollLayout = useCallback(() => {
    if (referralSource && !hasScrolledToStart.current) {
      hasScrolledToStart.current = true;
      scrollRef.current?.scrollTo({ x: startStep * (CARD_WIDTH + CARD_GAP), animated: false });
      setCurrentStep(startStep);
    }
  }, [referralSource, startStep, setCurrentStep]);

  const handleScrollEnd = useCallback(
    (e: any) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const page = Math.round(offsetX / CARD_WIDTH);
      const clamped = Math.max(0, Math.min(totalSteps - 1, page));
      setCurrentStep(clamped);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [setCurrentStep, totalSteps]
  );

  const scrollToStep = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({ x: index * (CARD_WIDTH + CARD_GAP), animated: true });
      setCurrentStep(index);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [setCurrentStep, scrollRef]
  );

  const handleSkip = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await skipOnboarding();
  }, [skipOnboarding]);

  const handleNext = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep < totalSteps - 1) {
      scrollToStep(currentStep + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await useOnboardingStore.getState().completeOnboarding();
    }
  }, [currentStep, totalSteps, scrollToStep]);

  const handleGetStarted = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeOnboarding();
  }, [completeOnboarding]);

  // ── Render the interactive demo for a given step ──
  const renderInteractiveDemo = (stepId: string) => {
    // Determine which step gradient to use
    const step = visibleSteps.find(s => s.id === stepId) || visibleSteps[0];
    const gradient = step?.gradient || ['#3B82F6', '#1D4ED8'];

    // When Lottie mode is on, render Lottie animations instead of SVG background + interactive component
    if (useLottie) {
      return (
        <View style={styles.illustrationWrapper}>
          <OnboardingLottie
            stepId={stepId}
            autoPlay
            loop
            speed={0.8}
          />
          <Pressable
            style={styles.lottieInteractBtn}
            onPress={() => {
              markStepInteracted(stepId);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            
          >
            <Text style={styles.lottieInteractText}>
              {interactedSteps[stepId] ? '✓ Interacted' : '👆 Tap to explore'}
            </Text>
          </Pressable>
        </View>
      );
    }

    // Default: SVG illustration background + interactive component
    switch (stepId) {
      case 'welcome':
        return (
          <View style={styles.illustrationWrapper}>
            <View style={styles.illustrationBg} pointerEvents="none">
              {renderIllustration({ stepId, gradient })}
            </View>
            <RocketAnimation
              onInteract={() => markStepInteracted(stepId)}
              onDemoComplete={() => handleDemoComplete(stepId)}
              interacted={!!interactedSteps[stepId]}
            />
          </View>
        );
      case 'portfolio':
        return (
          <View style={styles.illustrationWrapper}>
            <View style={styles.illustrationBg} pointerEvents="none">
              {renderIllustration({ stepId, gradient })}
            </View>
            <MiniPieChart
              onInteract={() => markStepInteracted(stepId)}
              onDemoComplete={() => handleDemoComplete(stepId)}
            />
          </View>
        );
      case 'markets':
        return (
          <View style={styles.illustrationWrapper}>
            <View style={styles.illustrationBg} pointerEvents="none">
              {renderIllustration({ stepId, gradient })}
            </View>
            <MiniCandlestickChart
              onInteract={() => markStepInteracted(stepId)}
              onDemoComplete={() => handleDemoComplete(stepId)}
            />
          </View>
        );
      case 'trading':
        return (
          <View style={styles.illustrationWrapper}>
            <View style={styles.illustrationBg} pointerEvents="none">
              {renderIllustration({ stepId, gradient })}
            </View>
            <MockTradePanel
              onInteract={() => markStepInteracted(stepId)}
              onDemoComplete={() => handleDemoComplete(stepId)}
            />
          </View>
        );
      case 'broker':
        return (
          <View style={styles.illustrationWrapper}>
            <View style={styles.illustrationBg} pointerEvents="none">
              {renderIllustration({ stepId, gradient })}
            </View>
            <MiniBrokerConnect
              onInteract={() => markStepInteracted(stepId)}
              onDemoComplete={() => handleDemoComplete(stepId)}
              interacted={!!interactedSteps[stepId]}
            />
          </View>
        );
      case 'learn':
        return (
          <View style={styles.illustrationWrapper}>
            <View style={styles.illustrationBg} pointerEvents="none">
              {renderIllustration({ stepId, gradient })}
            </View>
            <InteractiveBadges
              onInteract={() => markStepInteracted(stepId)}
              onDemoComplete={() => handleDemoComplete(stepId)}
            />
          </View>
        );
      default:
        return null;
    }
  };

  // ── Demo completion handler ──
  const handleDemoComplete = useCallback((stepId: string) => {
    markStepDemoCompleted(stepId); // also calls markStepInteracted internally
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [markStepDemoCompleted]);

  // ── Completion stats ──
  const totalInteractiveSteps = visibleSteps.length;
  const completedStepsCount = visibleSteps.filter(s => stepDemoCompleted[s.id]).length;
  const allDemosCompleted = totalInteractiveSteps > 0 && completedStepsCount >= totalInteractiveSteps;

  // ── Determine demo area height ──
  const getDemoAreaHeight = (stepId: string) => {
    switch (stepId) {
      case 'welcome': return 200;
      case 'portfolio': return 220;
      case 'markets': return 240;
      case 'trading': return 280;
      case 'broker': return 230;
      case 'learn': return 220;
      default: return 180;
    }
  };

  return (
    <AppScreen scroll={false} padded={false} contentStyle={{ backgroundColor: '#0B0F19' }}>
      {/* Top Bar — Skip + Page Indicator + Lottie Toggle */}
      <Animated.View style={[styles.topBar, contentStyle]}>
        <Pressable onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </Pressable>

        {/* Progress dots with completion checkmarks */}
        <View style={styles.dotsRow}>
          {visibleSteps.map((_, i) => {
            const stepId = visibleSteps[i].id;
            const isCompleted = !!stepDemoCompleted[stepId];
            const _isWelcome = stepId === 'welcome';
            return (
              <Pressable
                key={stepId}
                onPress={() => scrollToStep(i)}
                
              >
                <View style={styles.dotWrapper}>
                  <View
                    style={[
                      styles.dot,
                      i === currentStep && styles.dotActive,
                      isCompleted && styles.dotCompleted,
                      isCompleted && i === currentStep && styles.dotActiveCompleted,
                    ]}
                  >
                    {isCompleted && (
                      <Ionicons name="checkmark" size={10} color="#0B0F19" />
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Lottie toggle */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setUseLottie(prev => !prev);
          }}
          style={[
            styles.lottieToggle,
            useLottie && styles.lottieToggleActive,
          ]}
        >
          <Ionicons
            name={useLottie ? 'film' : 'code-slash'}
            size={14}
            color={useLottie ? '#00E676' : '#9CA3AF'}
          />
          <Text style={[styles.lottieToggleText, useLottie && styles.lottieToggleTextActive]}>
            {useLottie ? 'Lottie' : 'SVG'}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Scrollable Cards */}
      <Animated.View style={[styles.cardsContainer, heroStyle]}>
        {/* Parallax background accent */}
        <Animated.View style={[styles.parallaxBg, parallaxStyle]} pointerEvents="none" />

        <Animated.ScrollView
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
          {visibleSteps.map((step, i) => {
            const isInteracted = interactedSteps[step.id] || false;
            return (
              <AnimatedStepCard
                key={step.id}
                index={i}
                style={[
                  styles.card,
                  { width: CARD_WIDTH },
                ]}
              >
                {/* Card Gradient Background */}
                <LinearGradient
                  colors={step.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.cardGradient, { height: getDemoAreaHeight(step.id) }]}
                >
                  {/* Interactive Demo Area */}
                  {renderInteractiveDemo(step.id)}
                </LinearGradient>

                {/* Card Content */}
                <View style={styles.cardBody}>
                  <Text style={styles.stepLabel}>
                    STEP {i + 1} OF {totalSteps}
                  </Text>
                  <Text style={styles.cardTitle}>{step.title}</Text>
                  <Text style={styles.cardSubtitle}>{step.subtitle}</Text>
                  <Text style={styles.cardDescription}>{step.description}</Text>

                  {/* Feature highlights + interaction status */}
                  <View style={styles.highlights}>
                    <View style={styles.highlightRow}>
                      <Ionicons
                        name={isInteracted ? 'checkmark-circle' : 'hand-left'}
                        size={16}
                        color={isInteracted ? '#00E676' : colors.marketUp}
                      />
                      <Text style={[styles.highlightText, isInteracted && { color: '#00E676' }]}>
                        {isInteracted ? 'Demo completed ✓' : 'Tap to interact'}
                      </Text>
                    </View>
                    {[
                      { icon: 'shield-checkmark', text: 'Secure & encrypted' },
                      { icon: 'flash', text: 'Real-time data' },
                      { icon: 'headset', text: '24/7 support' },
                    ].map((item, hi) => (
                      <View key={hi} style={styles.highlightRow}>
                        <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={16} color={colors.marketUp} />
                        <Text style={styles.highlightText}>{item.text}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </AnimatedStepCard>
            );          })
        }
        </Animated.ScrollView>
      </Animated.View>

      {/* Bottom Section — Navigation Buttons + Progress Bar */}
      <Animated.View
        style={[
          styles.bottomSection,
          bottomStyle,
          { paddingBottom: insets.bottom + SPACING.xl },
        ]}
      >
        {/* Completion summary */}
      {isLastStep && (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.completionSummary}>
          <Ionicons name={allDemosCompleted ? 'trophy' : 'information-circle'} size={18} color={allDemosCompleted ? '#F59E0B' : '#6B7280'} />
          <Text style={[styles.completionText, allDemosCompleted && styles.completionTextDone]}>
            {allDemosCompleted
              ? `All ${totalInteractiveSteps} interactive demos completed!`
              : `${completedStepsCount}/${totalInteractiveSteps} demos completed`}
          </Text>
        </Animated.View>
      )}

      {/* Progress bar */}
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFill, progressStyle]} />
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          {/* Previous / Back */}
          {currentStep > 0 ? (
            <Pressable
              style={styles.backBtn}
              onPress={() => scrollToStep(currentStep - 1)}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
          ) : (
            <View style={{ width: 48 }} />
          )}

          {/* Main CTA */}
          <Pressable
            style={styles.ctaBtn}
            onPress={isLastStep ? handleGetStarted : handleNext}
            
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
          </Pressable>
        </View>
      </Animated.View>
    </AppScreen>
  );
}

// ────────────────────────────────────────────────────────
// Main Styles
// ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
  dotWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  dotCompleted: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
  },
  dotActiveCompleted: {
    backgroundColor: '#34D399',
    width: 24,
    height: 18,
    borderRadius: 9,
  },

  // ── Cards ──
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  parallaxBg: {
    position: 'absolute',
    top: 0,
    left: -50,
    width: width + 100,
    height: '100%',
    backgroundColor: 'rgba(59,130,246,0.03)',
    borderRadius: 100,
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
    minHeight: height * 0.6,
  },
  cardGradient: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
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

  // ── Completion Summary ──
  completionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  completionText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: '#6B7280',
  },
  completionTextDone: {
    color: '#F59E0B',
  },

  // ── Lottie Toggle Button ──
  lottieToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  lottieToggleActive: {
    backgroundColor: 'rgba(0,230,118,0.1)',
    borderColor: 'rgba(0,230,118,0.3)',
  },
  lottieToggleText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: '#9CA3AF',
  },
  lottieToggleTextActive: {
    color: '#00E676',
  },

  // ── Illustration Layout (moved from demoStyles) ──
  lottieInteractBtn: {
    position: 'absolute',
    bottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  lottieInteractText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter-Medium',
  },
  illustrationWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  illustrationBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.35,
  },
});
