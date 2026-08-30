/**
 * ============================================================================
 * Toroloom — Confetti Celebration Component
 * ============================================================================
 *
 * A lightweight, performant confetti animation built with Reanimated.
 * Shows colorful particles falling from the top of the screen with
 * a success message overlay.
 *
 * Usage:
 *   <ConfettiCelebration
 *     visible={paymentSuccessPlan !== null}
 *     planName={paymentSuccessPlan || ''}
 *     onComplete={() => clearPaymentSuccess()}
 *   />
 * ============================================================================
 */

import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Confetti particle colors ────────────────────────────────────────────────

const PARTICLE_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

// ─── Particle shape types ────────────────────────────────────────────────────

type ParticleShape = 'circle' | 'square' | 'rect';

// ─── Generate particles ──────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  startY: number;
  size: number;
  color: string;
  shape: ParticleShape;
  delay: number;
  duration: number;
  rotation: number;
  drift: number;
  opacity: number;
}

function generateParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      startY: -20 - Math.random() * 40,
      size: 6 + Math.random() * 8,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      shape: (['circle', 'square', 'rect'] as ParticleShape[])[Math.floor(Math.random() * 3)],
      delay: Math.random() * 800,
      duration: 1800 + Math.random() * 1200,
      rotation: Math.random() * 720 - 360,
      drift: (Math.random() - 0.5) * 120,
      opacity: 0.7 + Math.random() * 0.3,
    });
  }
  return particles;
}

// ─── Single particle component ───────────────────────────────────────────────

function ParticleView({ particle, visible }: { particle: Particle; visible: boolean }) {
  const translateY = useSharedValue(particle.startY);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withDelay(particle.delay, withTiming(particle.opacity, { duration: 200 }));
      translateY.value = withDelay(
        particle.delay,
        withTiming(SCREEN_HEIGHT + 40, {
          duration: particle.duration,
          easing: Easing.out(Easing.cubic),
        }),
      );
      translateX.value = withDelay(
        particle.delay,
        withTiming(particle.drift, {
          duration: particle.duration,
          easing: Easing.inOut(Easing.sin),
        }),
      );
      rotate.value = withDelay(
        particle.delay,
        withRepeat(
          withTiming(particle.rotation, { duration: particle.duration }),
          -1,
          false,
        ),
      );
    } else {
      opacity.value = 0;
      translateY.value = particle.startY;
      translateX.value = 0;
      rotate.value = 0;
    }
  }, [visible, particle, opacity, translateY, translateX, rotate]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const sizeStyle = useMemo(
    () => ({
      width: particle.shape === 'rect' ? particle.size * 1.5 : particle.size,
      height: particle.size,
      backgroundColor: particle.color,
      borderRadius: particle.shape === 'circle' ? particle.size / 2 : 2,
    }),
    [particle],
  );

  return <Animated.View style={[styles.particle, sizeStyle, animStyle]} />;
}

// ─── Main component ──────────────────────────────────────────────────────────

interface ConfettiCelebrationProps {
  visible: boolean;
  planName: string;
  onComplete: () => void;
  duration?: number;
}

export default function ConfettiCelebration({
  visible,
  planName,
  onComplete,
  duration = 3200,
}: ConfettiCelebrationProps) {
  const particles = useMemo(() => generateParticles(40), []);

  const backdropOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.8);
  const contentOpacity = useSharedValue(0);

  const handleAnimationComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (visible) {
      // Animate in
      backdropOpacity.value = withTiming(0.6, { duration: 300 });
      contentScale.value = withSequence(
        withTiming(1.05, { duration: 300, easing: Easing.out(Easing.back(1.5)) }),
        withTiming(1, { duration: 200 }),
      );
      contentOpacity.value = withTiming(1, { duration: 300 });

      // Auto-dismiss after duration
      const timer = setTimeout(() => {
        backdropOpacity.value = withTiming(0, { duration: 400 });
        contentScale.value = withTiming(0.9, { duration: 400 });
        contentOpacity.value = withTiming(0, { duration: 400 }, (finished) => {
          if (finished) runOnJS(handleAnimationComplete)();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      backdropOpacity.value = 0;
      contentScale.value = 0.8;
      contentOpacity.value = 0;
    }
  }, [visible, backdropOpacity, contentScale, contentOpacity, duration, handleAnimationComplete]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: contentScale.value }],
    opacity: contentOpacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="auto">
      {/* Particles layer */}
      <View style={styles.particlesLayer} pointerEvents="none">
        {particles.map((p) => (
          <ParticleView key={p.id} particle={p} visible={visible} />
        ))}
      </View>

      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]} />

      {/* Success card */}
      <View style={styles.cardWrapper}>
        <Animated.View style={contentStyle}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            {/* Glow ring */}
            <View style={styles.glowRing} />

            {/* Icon */}
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.iconGradient}
              >
                <Ionicons name="checkmark" size={40} color="#fff" />
              </LinearGradient>
            </View>

            {/* Text */}
            <Text style={styles.title}>Upgrade Successful! 🎉</Text>
            <Text style={styles.subtitle}>
              You are now on the{'\n'}
              <Text style={styles.planName}>{planName}</Text>
              {'\n'}plan
            </Text>

            {/* Confetti badge */}
            <View style={styles.badge}>
              <Ionicons name="diamond" size={12} color="#F59E0B" />
              <Text style={styles.badgeText}>PREMIUM UNLOCKED</Text>
            </View>

            {/* Tap to continue */}
            <Animated.View style={styles.tapHint}>
              <Text style={styles.tapText}>Tap anywhere to continue</Text>
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </View>

      {/* Tap anywhere to dismiss */}
      <Animated.View
        style={[styles.tapOverlay, backdropStyle]}
        onTouchEnd={() => {
          backdropOpacity.value = withTiming(0, { duration: 300 });
          contentScale.value = withTiming(0.9, { duration: 300 });
          contentOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
            if (finished) runOnJS(handleAnimationComplete)();
          });
        }}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  particlesLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  cardWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  card: {
    width: SCREEN_WIDTH * 0.78,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl * 1.5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  glowRing: {
    position: 'absolute',
    top: -40,
    left: '50%',
    marginLeft: -80,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  iconContainer: {
    marginBottom: SPACING.lg,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: '#fff',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.lg,
  },
  planName: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: '#10B981',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    marginBottom: SPACING.xl,
  },
  badgeText: {
    ...FONTS.bold,
    fontSize: 10,
    color: '#F59E0B',
    letterSpacing: 1.5,
  },
  tapHint: {
    marginTop: SPACING.sm,
  },
  tapText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.4)',
  },
  tapOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
});
