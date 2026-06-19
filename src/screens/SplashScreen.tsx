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
import { View, Text, StyleSheet, Animated, Dimensions, StatusBar } from 'react-native';
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
  // ── Animation refs ──
  const shieldScale = useRef(new Animated.Value(0.3)).current;
  const shieldOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const versionOpacity = useRef(new Animated.Value(0)).current;
  const scanLineY = useRef(new Animated.Value(-20)).current;
  const goldGlowPulse = useRef(new Animated.Value(0)).current;

  // ── Bootstrapping state ──
  const [diagnosticIndex, setDiagnosticIndex] = useState(0);
  const diagnosticOpacity = useRef(new Animated.Value(1)).current;

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
    const anims: Animated.CompositeAnimation[] = [];

    // ── 1. Shield entrance: scale up + fade in ──
    const entranceAnim = Animated.parallel([
      Animated.spring(shieldScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 3,
        bounciness: 6,
      }),
      Animated.timing(shieldOpacity, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    ]);
    entranceAnim.start();
    anims.push(entranceAnim);

    // ── 2. Brand name fade in after shield ──
    const brandTimeout = setTimeout(() => {
      const brandAnim = Animated.timing(brandOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      });
      brandAnim.start();
      anims.push(brandAnim);
    }, 500);
    timeoutIds.push(brandTimeout);

    // ── 3. Tagline fade in ──
    const taglineTimeout = setTimeout(() => {
      const tagAnim = Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      });
      tagAnim.start();
      anims.push(tagAnim);
    }, 900);
    timeoutIds.push(taglineTimeout);

    // ── 4. Version fade in ──
    const versionTimeout = setTimeout(() => {
      const verAnim = Animated.timing(versionOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      });
      verAnim.start();
      anims.push(verAnim);
    }, 1200);
    timeoutIds.push(versionTimeout);

    // ── 5. Neon glow pulse loop (Cyan) ──
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    glowLoop.start();

    // ── 6. Gold glow pulse (slightly offset) ──
    const goldGlowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(goldGlowPulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(goldGlowPulse, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    goldGlowLoop.start();

    // ── 7. Scanning line across shield ──
    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, {
          toValue: 160,
          duration: 2800,
          useNativeDriver: true,

        }),
        Animated.timing(scanLineY, {
          toValue: -20,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    scanLoop.start();

    // ── 8. Progress bar fill ──
    const progressAnim = Animated.timing(progressWidth, {
      toValue: 1,
      duration: minDuration,
      useNativeDriver: false,
    });
    progressAnim.start(() => {
      onFinish?.();
    });
    anims.push(progressAnim);

    // ── 9. Bootstrapping diagnostics steps cycling ──
    const stepCount = DIAGNOSTICS_STEPS.length;
    const stepInterval = minDuration / stepCount;
    let stepIndex = 0;
    const diagInterval = setInterval(() => {
      stepIndex++;
      if (stepIndex < stepCount) {
        // Fade out
        Animated.timing(diagnosticOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          setDiagnosticIndex(stepIndex);
          // Fade in
          Animated.timing(diagnosticOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        });
      }
    }, stepInterval);
    timeoutIds.push(diagInterval);

    // ── Cleanup on unmount ──
    return () => {
      glowLoop.stop();
      goldGlowLoop.stop();
      scanLoop.stop();
      anims.forEach(a => a.stop());
      timeoutIds.forEach(clearTimeout);
      clearInterval(diagInterval);
    };
  }, []);

  // Glow interpolations
  const cyanGlow = glowPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.2, 0.9, 0.3],
  });

  const goldGlow = goldGlowPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.15, 0.7, 0.2],
  });

  const progressPercent = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Background ambient glow
  const ambientScale = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });

  const ambientOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.2],
  });

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
        <Animated.View
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
          {
            opacity: ambientOpacity,
            transform: [{ scale: ambientScale }],
          },
        ]}
      />

      {/* ── Radial Gold ambient glow ── */}
      <Animated.View
        style={[
          styles.ambientGlowGold,
          {
            opacity: goldGlow,
            transform: [
              {
                scale: goldGlowPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1.05],
                }),
              },
            ],
          },
        ]}
      />

      {/* ── Shield Logo ── */}
      <Animated.View
        style={[
          styles.shieldContainer,
          {
            opacity: shieldOpacity,
            transform: [{ scale: shieldScale }],
          },
        ]}
      >
        {/* Neon glow border ring */}
        <Animated.View
          style={[
            styles.neonRing,
            { opacity: cyanGlow },
          ]}
        />

        {/* Gold accent ring */}
        <Animated.View
          style={[
            styles.goldRing,
            { opacity: goldGlow },
          ]}
        />

        {/* Scanning line */}
        <Animated.View
          style={[
            styles.scanLine,
            { transform: [{ translateY: scanLineY }] },
          ]}
        />

        {/* The custom SVG metallic shield */}
        <MetallicShieldSVG
          size={140}
          glowOpacity={0.5}
        />
      </Animated.View>

      {/* ── Brand Name ── */}
      <Animated.Text style={[styles.brandName, { opacity: brandOpacity }]}>
        Toroloom
      </Animated.Text>

      {/* ── Tagline ── */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        AI-Powered Trading Shield
      </Animated.Text>

      {/* ── Bootstrapping Diagnostics ── */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressPercent },
            ]}
          />
        </View>
        <Animated.View style={{ opacity: diagnosticOpacity }}>
          <Text style={styles.progressLabel}>
            {DIAGNOSTICS_STEPS[diagnosticIndex]}
          </Text>
        </Animated.View>
      </View>

      {/* ── Version ── */}
      <Animated.Text style={[styles.version, { opacity: versionOpacity }]}>
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
