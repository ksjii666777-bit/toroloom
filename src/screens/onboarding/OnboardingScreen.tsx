import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler,
  withTiming, withSpring, withDelay, withSequence, withRepeat, interpolate,
  Extrapolation, FadeInDown, BounceIn,
} from 'react-native-reanimated';
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

// ────────────────────────────────────────────────────────
// Interactive Demo Data
// ────────────────────────────────────────────────────────

const MOCK_SECTORS = [
  { name: 'Tech', value: 45, color: '#3B82F6', icon: 'hardware-chip' },
  { name: 'Finance', value: 25, color: '#00E676', icon: 'wallet' },
  { name: 'Energy', value: 18, color: '#FFAB40', icon: 'flame' },
  { name: 'Health', value: 12, color: '#FF5252', icon: 'medkit' },
];

const MOCK_CANDLE_DATA = [
  { date: 'Mon', open: 100, high: 108, low: 98, close: 106, volume: 1200 },
  { date: 'Tue', open: 106, high: 112, low: 104, close: 110, volume: 1500 },
  { date: 'Wed', open: 110, high: 115, low: 107, close: 108, volume: 1000 },
  { date: 'Thu', open: 108, high: 118, low: 106, close: 116, volume: 1800 },
  { date: 'Fri', open: 116, high: 122, low: 114, close: 120, volume: 2200 },
  { date: 'Sat', open: 120, high: 125, low: 118, close: 124, volume: 1600 },
  { date: 'Sun', open: 124, high: 130, low: 122, close: 128, volume: 2000 },
];

const MOCK_BADGES = [
  { id: 'first-trade', icon: '🎯', label: 'First Trade', color: '#3B82F6' },
  { id: 'streak-3', icon: '🔥', label: '3-Day Streak', color: '#FFAB40' },
  { id: 'course-beginner', icon: '📘', label: 'Learner', color: '#10B981' },
  { id: 'market-pro', icon: '📊', label: 'Market Pro', color: '#8B5CF6' },
];

// ────────────────────────────────────────────────────────
// Mini Interactive Components
// ────────────────────────────────────────────────────────

function MiniPieChart({
  onInteract,
}: {
  onInteract: () => void;
}) {
  const [selectedSector, setSelectedSector] = useState<number | null>(null);
  const total = MOCK_SECTORS.reduce((sum, s) => sum + s.value, 0);

  // Build segments using simple stacked bar (simulating pie segments)
  let currentAngle = 0;
  const segments = MOCK_SECTORS.map((sector) => {
    const angle = (sector.value / total) * 360;
    const seg = { ...sector, startAngle: currentAngle, endAngle: currentAngle + angle };
    currentAngle += angle;
    return seg;
  });

  return (
    <View style={demoStyles.pieContainer}>
      <Text style={demoStyles.pieTitle}>Your Portfolio Allocation</Text>
      <View style={demoStyles.pieRow}>
        {/* Segmented bar visualization (horizontal stacked bar as pie alternative) */}
        <View style={demoStyles.pieBar}>
          {segments.map((seg, i) => {
            const isSelected = selectedSector === i;
            const widthPct = (seg.value / total) * 100;
            return (
              <TouchableOpacity
                key={seg.name}
                activeOpacity={0.7}
                onPress={() => {
                  onInteract();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedSector(isSelected ? null : i);
                }}
                style={[
                  demoStyles.pieSegment,
                  {
                    backgroundColor: seg.color,
                    width: `${widthPct}%`,
                    opacity: selectedSector === null || isSelected ? 1 : 0.4,
                    transform: isSelected ? [{ scaleY: 1.15 }] : [],
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Legend */}
      <View style={demoStyles.pieLegend}>
        {MOCK_SECTORS.map((sector, i) => {
          const isSelected = selectedSector === i;
          return (
            <TouchableOpacity
              key={sector.name}
              style={[demoStyles.legendItem, isSelected && demoStyles.legendItemActive]}
              onPress={() => {
                onInteract();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedSector(isSelected ? null : i);
              }}
            >
              <View style={[demoStyles.legendDot, { backgroundColor: sector.color }]} />
              <Text style={[demoStyles.legendLabel, isSelected && demoStyles.legendLabelActive]}>
                {sector.name}
              </Text>
              <Text style={[demoStyles.legendValue, isSelected && demoStyles.legendValueActive]}>
                {sector.value}%
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected sector detail */}
      {selectedSector !== null && (
        <Animated.View entering={BounceIn.duration(300)} style={demoStyles.sectorDetail}>
          <Ionicons name={MOCK_SECTORS[selectedSector].icon as keyof typeof Ionicons.glyphMap} size={18} color={MOCK_SECTORS[selectedSector].color} />
          <Text style={demoStyles.sectorDetailText}>
            {MOCK_SECTORS[selectedSector].name}: ₹{(Math.random() * 5 + 1).toFixed(1)}L invested
          </Text>
        </Animated.View>
      )}

      {selectedSector === null && (
        <Text style={demoStyles.pieHint}>👆 Tap a sector to explore</Text>
      )}
    </View>
  );
}

function MiniCandlestickChart({
  onInteract,
}: {
  onInteract: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const chartHeight = 100;
  const chartWidth = CARD_WIDTH - SPACING.xl * 2 - 20;
  const candleWidth = Math.floor(chartWidth / MOCK_CANDLE_DATA.length) - 4;
  const prices = MOCK_CANDLE_DATA.map(d => d.high);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...MOCK_CANDLE_DATA.map(d => d.low));
  const range = maxPrice - minPrice || 1;

  return (
    <View style={demoStyles.candleContainer}>
      <Text style={demoStyles.pieTitle}>RELIANCE — This Week</Text>

      {/* Mini chart */}
      <View style={[demoStyles.candleChart, { height: chartHeight + 30 }]}>
        {/* Price labels */}
        <Text style={[demoStyles.priceLabel, { top: 0 }]}>₹{maxPrice}</Text>
        <Text style={[demoStyles.priceLabel, { bottom: 20 }]}>₹{minPrice}</Text>

        {/* Candles */}
        <View style={demoStyles.candlesRow}>
          {MOCK_CANDLE_DATA.map((candle, i) => {
            const isUp = candle.close >= candle.open;
            const candleTop = ((maxPrice - Math.max(candle.open, candle.close)) / range) * chartHeight;
            const candleBottom = ((maxPrice - Math.min(candle.open, candle.close)) / range) * chartHeight;
            const wickTop = ((maxPrice - candle.high) / range) * chartHeight;
            const wickBottom = ((maxPrice - candle.low) / range) * chartHeight;
            const isSelected = selectedIndex === i;

            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => {
                  onInteract();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedIndex(isSelected ? null : i);
                }}
                style={[demoStyles.candleWrapper, { width: candleWidth + 4 }]}
              >
                {/* Wick */}
                <View
                  style={[
                    demoStyles.wick,
                    {
                      top: wickTop,
                      height: wickBottom - wickTop,
                      left: (candleWidth + 4) / 2 - 1,
                      backgroundColor: isUp ? '#00E676' : '#FF5252',
                    },
                  ]}
                />
                {/* Body */}
                <View
                  style={[
                    demoStyles.candleBody,
                    {
                      top: candleTop,
                      height: Math.max(candleBottom - candleTop, 3),
                      width: candleWidth,
                      left: 2,
                      backgroundColor: isUp ? '#00E676' : '#FF5252',
                      opacity: isSelected ? 1 : 0.8,
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: isSelected ? '#FFFFFF' : 'transparent',
                    },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Day labels */}
        <View style={demoStyles.dayLabels}>
          {MOCK_CANDLE_DATA.map((candle, i) => (
            <Text key={i} style={[demoStyles.dayLabel, { width: candleWidth + 4 }]}>
              {candle.date.substring(0, 3)}
            </Text>
          ))}
        </View>
      </View>

      {/* Selected candle detail */}
      {selectedIndex !== null && (
        <Animated.View entering={FadeInDown.duration(200)} style={demoStyles.candleDetail}>
          <Text style={demoStyles.candleDetailText}>
            O: {MOCK_CANDLE_DATA[selectedIndex].open} · H: {MOCK_CANDLE_DATA[selectedIndex].high} · L: {MOCK_CANDLE_DATA[selectedIndex].low} · C: {MOCK_CANDLE_DATA[selectedIndex].close}
          </Text>
          <Text style={demoStyles.candleDetailVol}>
            Vol: {(MOCK_CANDLE_DATA[selectedIndex].volume / 1000).toFixed(1)}K
          </Text>
        </Animated.View>
      )}

      {selectedIndex === null && (
        <Text style={demoStyles.pieHint}>👆 Tap a candle for details</Text>
      )}
    </View>
  );
}

function MockTradePanel({
  onInteract,
}: {
  onInteract: () => void;
}) {
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState(10);
  const [confirmed, setConfirmed] = useState(false);
  const mockPrice = 2450.50;
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (!confirmed) {
      pulseAnim.value = withRepeat(
        withSequence(withTiming(1.05, { duration: 800 }), withTiming(1, { duration: 800 })),
        -1,
        true,
      );
    }
  }, [confirmed]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const handleConfirm = () => {
    onInteract();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setConfirmed(true);
    pulseAnim.value = withTiming(1, { duration: 200 });
  };

  const handleQtyChange = (delta: number) => {
    onInteract();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuantity(Math.max(1, Math.min(100, quantity + delta)));
  };

  return (
    <View style={demoStyles.tradeContainer}>
      <Text style={demoStyles.pieTitle}>Mock Trade — RELIANCE</Text>

      {/* Price display */}
      <View style={demoStyles.tradePriceRow}>
        <Text style={demoStyles.tradePrice}>₹{mockPrice.toFixed(2)}</Text>
        <Text style={demoStyles.tradeChange}>+2.3%</Text>
      </View>

      {/* Buy/Sell Toggle */}
      <View style={demoStyles.tradeToggle}>
        <TouchableOpacity
          style={[demoStyles.tradeToggleBtn, tradeType === 'buy' && demoStyles.tradeToggleBuy]}
          onPress={() => {
            onInteract();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTradeType('buy');
            setConfirmed(false);
          }}
        >
          <Ionicons name="trending-up" size={16} color={tradeType === 'buy' ? '#fff' : '#00E676'} />
          <Text style={[demoStyles.tradeToggleText, tradeType === 'buy' && demoStyles.tradeToggleTextActive]}>Buy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[demoStyles.tradeToggleBtn, tradeType === 'sell' && demoStyles.tradeToggleSell]}
          onPress={() => {
            onInteract();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTradeType('sell');
            setConfirmed(false);
          }}
        >
          <Ionicons name="trending-down" size={16} color={tradeType === 'sell' ? '#fff' : '#FF5252'} />
          <Text style={[demoStyles.tradeToggleText, tradeType === 'sell' && demoStyles.tradeToggleTextActive]}>Sell</Text>
        </TouchableOpacity>
      </View>

      {/* Quantity Selector */}
      <View style={demoStyles.qtyRow}>
        <TouchableOpacity
          style={demoStyles.qtyBtn}
          onPress={() => handleQtyChange(-5)}
        >
          <Ionicons name="remove" size={20} color="#9CA3AF" />
        </TouchableOpacity>
        <View style={demoStyles.qtyValue}>
          <Text style={demoStyles.qtyText}>{quantity}</Text>
          <Text style={demoStyles.qtyLabel}>Qty</Text>
        </View>
        <TouchableOpacity
          style={demoStyles.qtyBtn}
          onPress={() => handleQtyChange(5)}
        >
          <Ionicons name="add" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Order Total */}
      <View style={demoStyles.orderTotal}>
        <Text style={demoStyles.orderTotalLabel}>Total</Text>
        <Text style={demoStyles.orderTotalValue}>
          ₹{(mockPrice * quantity).toLocaleString()}
        </Text>
      </View>

      {/* Confirm Button */}
      {!confirmed ? (
        <Animated.View style={pulseStyle}>
          <TouchableOpacity
            style={[
              demoStyles.confirmBtn,
              { backgroundColor: tradeType === 'buy' ? '#00E676' : '#FF5252' },
            ]}
            onPress={handleConfirm}
          >
            <Text style={demoStyles.confirmBtnText}>
              {tradeType === 'buy' ? '📈 Place Buy Order' : '📉 Place Sell Order'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <Animated.View entering={BounceIn.duration(400)} style={demoStyles.confirmedBox}>
          <Ionicons name="checkmark-circle" size={28} color="#00E676" />
          <Text style={demoStyles.confirmedText}>
            Order placed! {quantity} shares {tradeType === 'buy' ? 'bought' : 'sold'} ✓
          </Text>
        </Animated.View>
      )}

      {!confirmed && (
        <Text style={demoStyles.pieHint}>👆 Try placing a mock order</Text>
      )}
    </View>
  );
}

function InteractiveBadges({
  onInteract,
}: {
  onInteract: () => void;
}) {
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});

  const handleBadgeTap = (id: string) => {
    onInteract();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUnlocked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const unlockedCount = Object.values(unlocked).filter(Boolean).length;

  return (
    <View style={demoStyles.badgesContainer}>
      <Text style={demoStyles.pieTitle}>Tap Badges to Unlock</Text>
      <Text style={demoStyles.badgesProgress}>
        {unlockedCount} / {MOCK_BADGES.length} unlocked
      </Text>

      <View style={demoStyles.badgesGrid}>
        {MOCK_BADGES.map((badge) => {
          const isUnlocked = unlocked[badge.id];
          return (
            <TouchableOpacity
              key={badge.id}
              activeOpacity={0.7}
              onPress={() => handleBadgeTap(badge.id)}
              style={[
                demoStyles.badgeCard,
                isUnlocked && { borderColor: badge.color, backgroundColor: badge.color + '15' },
              ]}
            >
              <Animated.View
                entering={BounceIn.duration(300)}
                style={[
                  demoStyles.badgeIconCircle,
                  isUnlocked && { backgroundColor: badge.color + '30' },
                ]}
              >
                <Text style={demoStyles.badgeEmoji}>{badge.icon}</Text>
              </Animated.View>
              <Text style={[demoStyles.badgeLabel, isUnlocked && { color: badge.color }]}>
                {badge.label}
              </Text>
              {isUnlocked && (
                <View style={[demoStyles.badgeUnlockedTag, { backgroundColor: badge.color }]}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {unlockedCount >= MOCK_BADGES.length && (
        <Animated.View entering={BounceIn.duration(500)} style={demoStyles.allUnlocked}>
          <Text style={demoStyles.allUnlockedText}>🎉 All badges unlocked! You're a pro!</Text>
        </Animated.View>
      )}

      {unlockedCount === 0 && (
        <Text style={demoStyles.pieHint}>👆 Tap badges to unlock them</Text>
      )}
    </View>
  );
}

function RocketAnimation({
  onInteract,
  interacted,
}: {
  onInteract: () => void;
  interacted: boolean;
}) {
  const [launched, setLaunched] = useState(false);
  const rocketY = useSharedValue(0);
  const rocketRotate = useSharedValue(0);
  const glowOpacity = useSharedValue(0.6);
  const flameScale = useSharedValue(1);

  useEffect(() => {
    if (!launched) {
      glowOpacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 1000 }), withTiming(0.4, { duration: 1000 })),
        -1,
        true,
      );
      flameScale.value = withRepeat(
        withSequence(withTiming(1.3, { duration: 400 }), withTiming(1, { duration: 400 })),
        -1,
        true,
      );
    }
  }, [launched]);

  const handleLaunch = () => {
    if (launched) return;
    onInteract();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLaunched(true);
    rocketY.value = withTiming(-200, { duration: 1200 });
    rocketRotate.value = withTiming(-15, { duration: 1200 });
    glowOpacity.value = withTiming(0, { duration: 800 });
  };

  const rocketStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: rocketY.value },
      { rotate: `${rocketRotate.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: flameScale.value }],
  }));

  return (
    <View style={demoStyles.rocketContainer}>
      <TouchableOpacity onPress={handleLaunch} activeOpacity={0.8} disabled={launched}>
        <Animated.View style={[demoStyles.rocketWrapper, rocketStyle]}>
          {/* Glow */}
          <Animated.View style={[demoStyles.rocketGlow, glowStyle]} />
          {/* Rocket icon */}
          <View style={demoStyles.rocketIcon}>
            <Ionicons name="rocket" size={64} color="#FFFFFF" />
          </View>
          {/* Flame */}
          <Animated.View style={[demoStyles.flame, flameStyle]}>
            <LinearGradient
              colors={['#FF6B35', '#FFAB40', 'transparent']}
              style={demoStyles.flameGradient}
            />
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>

      {!launched && !interacted && (
        <Text style={demoStyles.pieHint}>🚀 Tap to launch!</Text>
      )}
      {launched && (
        <Animated.View entering={BounceIn.duration(500)} style={demoStyles.launchMsg}>
          <Text style={demoStyles.launchMsgText}>✨ Blast off! Let's start your journey</Text>
        </Animated.View>
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────

export default function OnboardingScreen({ _navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    currentStep, setCurrentStep, skipOnboarding,
    completeOnboarding,
    referralSource, interactedSteps, markStepInteracted,
  } = useOnboardingStore();

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
  }, []);

  const heroStyle = useAnimatedStyle(() => ({ opacity: heroProgress.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentProgress.value }));
  const bottomStyle = useAnimatedStyle(() => ({ opacity: bottomProgress.value }));

  // ── Card entrance animations ──
  const cardScales = Array.from({ length: 5 }, () => useSharedValue(0.9));
  const cardOpacities = Array.from({ length: 5 }, () => useSharedValue(0));

  const cardStyles = cardScales.map((_, i) =>
    useAnimatedStyle(() => ({
      transform: [{ scale: cardScales[i].value }],
      opacity: cardOpacities[i].value,
    }))
  );

  useEffect(() => {
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
      setIsLastStep(clamped === totalSteps - 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [setCurrentStep, totalSteps]
  );

  const scrollToStep = useCallback(
    (index: number) => {
      scrollRef.current?.scrollTo({ x: index * (CARD_WIDTH + CARD_GAP), animated: true });
      setCurrentStep(index);
      setIsLastStep(index === totalSteps - 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [setCurrentStep, totalSteps]
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
    switch (stepId) {
      case 'welcome':
        return (
          <RocketAnimation
            onInteract={() => markStepInteracted(stepId)}
            interacted={!!interactedSteps[stepId]}
          />
        );
      case 'portfolio':
        return <MiniPieChart onInteract={() => markStepInteracted(stepId)} />;
      case 'markets':
        return <MiniCandlestickChart onInteract={() => markStepInteracted(stepId)} />;
      case 'trading':
        return <MockTradePanel onInteract={() => markStepInteracted(stepId)} />;
      case 'learn':
        return <InteractiveBadges onInteract={() => markStepInteracted(stepId)} />;
      default:
        return null;
    }
  };

  // ── Determine demo area height ──
  const getDemoAreaHeight = (stepId: string) => {
    switch (stepId) {
      case 'welcome': return 200;
      case 'portfolio': return 220;
      case 'markets': return 240;
      case 'trading': return 280;
      case 'learn': return 220;
      default: return 180;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Bar — Skip + Page Indicator */}
      <Animated.View style={[styles.topBar, contentStyle]}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Progress dots */}
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
        {/* Parallax background accent */}
        <Animated.View style={[styles.parallaxBg, parallaxStyle]} pointerEvents="none" />

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
          {visibleSteps.map((step, i) => {
            const isInteracted = interactedSteps[step.id] || false;
            return (
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
              </Animated.View>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* Bottom Section — Navigation Buttons + Progress Bar */}
      <Animated.View
        style={[
          styles.bottomSection,
          bottomStyle,
          { paddingBottom: insets.bottom + SPACING.xl },
        ]}
      >
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

// ────────────────────────────────────────────────────────
// Demo Component Styles
// ────────────────────────────────────────────────────────

const demoStyles = StyleSheet.create({
  // ── Rocket ──
  rocketContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  rocketWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  rocketGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  rocketIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  flame: {
    position: 'absolute',
    bottom: -30,
    width: 40,
    height: 50,
    zIndex: 1,
  },
  flameGradient: {
    width: '100%',
    height: '100%',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  launchMsg: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
  },
  launchMsgText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },

  // ── Pie Chart ──
  pieContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pieTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
    textAlign: 'center',
  },
  pieRow: {
    alignItems: 'center',
  },
  pieBar: {
    flexDirection: 'row',
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  pieSegment: {
    height: '100%',
    borderRadius: 2,
  },
  pieLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  legendItemActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: 'Inter-Medium',
  },
  legendLabelActive: {
    color: '#FFFFFF',
  },
  legendValue: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  legendValueActive: {
    color: '#FFFFFF',
  },
  sectorDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  sectorDetailText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  pieHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginTop: 6,
  },

  // ── Candlestick ──
  candleContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  candleChart: {
    position: 'relative',
    justifyContent: 'center',
  },
  priceLabel: {
    position: 'absolute',
    right: 0,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontFamily: 'Inter-Medium',
  },
  candlesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 100,
    paddingLeft: 30,
  },
  candleWrapper: {
    position: 'relative',
    height: 100,
  },
  wick: {
    position: 'absolute',
    width: 2,
    borderRadius: 1,
  },
  candleBody: {
    position: 'absolute',
    borderRadius: 2,
  },
  dayLabels: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingLeft: 30,
    marginTop: 2,
  },
  dayLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 8,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  candleDetail: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
  },
  candleDetailText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
  },
  candleDetailVol: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontFamily: 'Inter-Regular',
  },

  // ── Trade Panel ──
  tradeContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  tradePriceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  tradePrice: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Inter-Bold',
  },
  tradeChange: {
    color: '#00E676',
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },
  tradeToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  tradeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tradeToggleBuy: {
    backgroundColor: '#00E676',
  },
  tradeToggleSell: {
    backgroundColor: '#FF5252',
  },
  tradeToggleText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  tradeToggleTextActive: {
    color: '#FFFFFF',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 8,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  qtyValue: {
    alignItems: 'center',
  },
  qtyText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'Inter-Bold',
  },
  qtyLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontFamily: 'Inter-Regular',
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    marginBottom: 8,
  },
  orderTotalLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  orderTotalValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  confirmBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  confirmedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0,230,118,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.3)',
  },
  confirmedText: {
    color: '#00E676',
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },

  // ── Badges ──
  badgesContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  badgesProgress: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginBottom: 10,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  badgeCard: {
    width: 72,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  badgeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeEmoji: {
    fontSize: 18,
  },
  badgeLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  badgeUnlockedTag: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  allUnlocked: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
  allUnlockedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
});

// ────────────────────────────────────────────────────────
// Main Styles
// ────────────────────────────────────────────────────────

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
});
