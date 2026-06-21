/**
 * ============================================================================
 * Toroloom — Premium Animated Splash Screen
 * ============================================================================
 *
 * High-performance animated splash framework featuring:
 *   - Custom SVG metallic iron shield with geometric financial vectors
 *   - Glowing neon pulse micro-animations (Cyberpunk Cyan #00F0FF + Premium Gold #FFD700)
 *   - Bootstrapping diagnostics progress indicator with cycling status text
 *   - Scanning line animation across the shield
 *   - Ambient particle/star field background
 * ============================================================================
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, StatusBar } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withSequence, withDelay, interpolate, runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import MetallicShieldSVG from '../components/ui/MetallicShieldSVG';

const { width, height } = Dimensions.get('window');
const CYBER_CYAN = '#00F0FF';
const PREMIUM_GOLD = '#FFD700';
const BG_DARK = '#0A0E1A';

interface SplashScreenProps {
  onFinish?: () => void;
  minDuration?: number;
}

// ── Bootstrapping diagnostics steps ────────────────────────────
const DIAGNOSTICS_STEPS = [
  'Initializing encrypted environment...',
  'Loading market data feeds...',
  'Establishing secure WebSocket tunnel...',
  'Calibrating risk engine parameters...',
  'Syncing portfolio state...',
  'Launching Toroloom shield...',
];

export default function SplashScreen({ onFinish, minDuration = 3000 }: SplashScreenProps) {
  // ── Animation shared values ──
  const shieldScale = useSharedValue(0.3);
  const shieldOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const progressWidth = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const brandOpacity = useSharedValue(0);
  const versionOpacity = useSharedValue(0);
  const scanLineY = useSharedValue(-20);
  const goldGlowPulse = useSharedValue(0);
  const diagnosticOpacity = useSharedValue(1);

  // ── Animated styles ──
  const cyanGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 0.5, 1], [0.2, 0.9, 0.3]),
  }));

  const goldGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(goldGlowPulse.value, [0, 0.5, 1], [0.15, 0.7, 0.2]),
  }));

  const ambientGlowCyanStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 1], [0.08, 0.2]),
    transform: [{ scale: interpolate(glowPulse.value, [0, 1], [0.92, 1.08]) }],
  }));

  const ambientGlowGoldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(goldGlowPulse.value, [0, 1], [0.15, 0.7]),
    transform: [{ scale: interpolate(goldGlowPulse.value, [0, 1], [0.95, 1.05]) }],
  }));

  const shieldContainerStyle = useAnimatedStyle(() => ({
    opacity: shieldOpacity.value,
    transform: [{ scale: shieldScale.value }],
  }));

  const progressStyle = useAnimatedStyle(() => {
    const pct = interpolate(progressWidth.value, [0, 1], [0, 100]);
    return { width: `${pct}%` };
  });

  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const versionStyle = useAnimatedStyle(() => ({
    opacity: versionOpacity.value,
  }));

  const diagnosticStyle = useAnimatedStyle(() => ({
    opacity: diagnosticOpacity.value,
  }));

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  // ── Bootstrapping state ──
  const [diagnosticIndex, setDiagnosticIndex] = useState(0);

  // ── Particle/star positions (deterministic for performance) ──
  const particles = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height * 0.6,
      size: 1 + Math.random() * 2.5,
      opacity: 0.2 + Math.random() * 0.5,
      speed: 0.3 + Math.random() * 0.7,
    }))
  ).current;

  useEffect(() => {
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    // ── 1. Shield entrance: scale up + fade in ──
    shieldScale.value = withSpring(1, { stiffness: 80, damping: 10 });
    shieldOpacity.value = withTiming(1, { duration: 900 });

    // ── 2. Brand name fade in after shield ──
    brandOpacity.value = withDelay(500, withTiming(1, { duration: 500 }));

    // ── 3. Tagline fade in ──
    taglineOpacity.value = withDelay(900, withTiming(1, { duration: 600 }));

    // ── 4. Version fade in ──
    versionOpacity.value = withDelay(1200, withTiming(1, { duration: 400 }));

    // ── 5. Neon glow pulse loop (Cyan) ──
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 }),
        withTiming(0, { duration: 1200 }),
      ),
      -1, // infinite repeat
    );

    // ── 6. Gold glow pulse (slightly offset) ──
    goldGlowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0, { duration: 1500 }),
      ),
      -1, // infinite repeat
    );

    // ── 7. Scanning line across shield (sawtooth pattern) ──
    scanLineY.value = withRepeat(
      withSequence(
        withTiming(160, { duration: 2800 }),
        withTiming(-20, { duration: 0 }), // instant reset
      ),
      -1, // infinite repeat
    );

    // ── 8. Progress bar fill ──
    progressWidth.value = withTiming(1, { duration: minDuration }, (finished) => {
      if (finished && onFinish) {
        runOnJS(onFinish)();
      }
    });

    // ── 9. Bootstrapping diagnostics steps cycling ──
    const stepCount = DIAGNOSTICS_STEPS.length;
    const stepInterval = minDuration / stepCount;
    let stepIndex = 0;
    const diagInterval = setInterval(() => {
      stepIndex++;
      if (stepIndex < stepCount) {
        // Fade out, then update text and fade in
        diagnosticOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
          if (finished) {
            runOnJS(setDiagnosticIndex)(stepIndex);
            diagnosticOpacity.value = withTiming(1, { duration: 300 });
          }
        });
      }
    }, stepInterval);

    // ── Cleanup on unmount ──
    return () => {
      // Cancel animations by overriding shared values
      glowPulse.value = 0;
      goldGlowPulse.value = 0;
      scanLineY.value = -20;
      shieldScale.value = 0.3;
      shieldOpacity.value = 0;
      progressWidth.value = 0;
      brandOpacity.value = 0;
      taglineOpacity.value = 0;
      versionOpacity.value = 0;
      diagnosticOpacity.value = 1;
      timeoutIds.forEach(clearTimeout);
      clearInterval(diagInterval);
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />

      {/* ── Background Gradient ── */}
      <LinearGradient
        colors={['#070B15', '#0D1520', '#0A0E1A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Ambient particle/star field ── */}
      {particles.map((p, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: i % 3 === 0 ? CYBER_CYAN : PREMIUM_GOLD,
            opacity: p.opacity * 0.5,
          }}
        />
      ))}

      {/* ── Radial Cyan ambient glow behind shield ── */}
      <Animated.View
        style={[
          styles.ambientGlowCyan,
          ambientGlowCyanStyle,
        ]}
      />

      {/* ── Radial Gold ambient glow ── */}
      <Animated.View
        style={[
          styles.ambientGlowGold,
          ambientGlowGoldStyle,
        ]}
      />

      {/* ── Shield Logo ── */}
      <Animated.View
        style={[
          styles.shieldContainer,
          shieldContainerStyle,
        ]}
      >
        {/* Neon glow border ring */}
        <Animated.View
          style={[
            styles.neonRing,
            cyanGlowStyle,
          ]}
        />

        {/* Gold accent ring */}
        <Animated.View
          style={[
            styles.goldRing,
            goldGlowStyle,
          ]}
        />

        {/* Scanning line */}
        <Animated.View
          style={[
            styles.scanLine,
            scanLineStyle,
          ]}
        />

        {/* The custom SVG metallic shield */}
        <MetallicShieldSVG
          size={140}
          glowOpacity={0.5}
        />
      </Animated.View>

      {/* ── Brand Name ── */}
      <Animated.Text style={[styles.brandName, brandStyle]}>
        Toroloom
      </Animated.Text>

      {/* ── Tagline ── */}
      <Animated.Text style={[styles.tagline, taglineStyle]}>
        AI-Powered Trading Shield
      </Animated.Text>

      {/* ── Bootstrapping Diagnostics ── */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <Animated.View
            style={[
              styles.progressFill,
              progressStyle,
            ]}
          />
        </View>
        <Animated.View style={diagnosticStyle}>
          <Text style={styles.progressLabel}>
            {DIAGNOSTICS_STEPS[diagnosticIndex]}
          </Text>
        </Animated.View>
      </View>

      {/* ── Version ── */}
      <Animated.Text style={[styles.version, versionStyle]}>
        v1.0.0
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Ambient glows ──
  ambientGlowCyan: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: CYBER_CYAN,
    top: height * 0.26,
  },
  ambientGlowGold: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: PREMIUM_GOLD,
    top: height * 0.28,
    left: width * 0.52,
  },

  // ── Shield container ──
  shieldContainer: {
    width: 150,
    height: 150,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 28,
  },

  // ── Neon rings ──
  neonRing: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: CYBER_CYAN,
    shadowColor: CYBER_CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 8,
  },
  goldRing: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 46,
    borderWidth: 0.5,
    borderColor: PREMIUM_GOLD,
  },

  // ── Scanning line ──
  scanLine: {
    position: 'absolute',
    left: -15,
    right: -15,
    height: 3,
    backgroundColor: CYBER_CYAN,
    shadowColor: CYBER_CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: 6,
    opacity: 0.6,
    zIndex: 10,
  },

  // ── Text elements ──
  brandName: {
    fontSize: 38,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 13,
    color: '#9CA3AF',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 60,
  },

  // ── Progress ──
  progressContainer: {
    position: 'absolute',
    bottom: 120,
    left: 40,
    right: 40,
    alignItems: 'center',
  },
  progressBg: {
    width: '100%',
    height: 3,
    backgroundColor: '#1F2937',
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: 3,
    backgroundColor: CYBER_CYAN,
    borderRadius: 1.5,
  },
  progressLabel: {
    fontSize: 11,
    color: '#6B7280',
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // ── Version ──
  version: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
    color: '#4B5563',
    letterSpacing: 1,
  },
});
