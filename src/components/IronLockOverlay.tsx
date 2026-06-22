/**
 * ============================================================================
 * Toroloom — Iron Lock Overlay
 * ============================================================================
 *
 * Full-screen lockdown overlay that activates when the Financial Bodyguard
 * triggers a hard lock.  Designed as a dramatic, no-nonsense deterrent:
 *   - Dark gradient backdrop with animated lock icon + neon pulse
 *   - Countdown timer showing remaining lockdown duration
 *   - Breach details (trigger loss, breached limit)
 *   - Voice announcement via voiceStore
 *   - Haptic feedback on trigger/lift
 *
 * Placed globally in AppNavigator (like AvatarWidget).
 * ============================================================================
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, withRepeat, withSequence, interpolate, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useRiskStore, selectIsLockdownActive } from '../store/riskStore';
import { useVoiceStore, VOICE_MESSAGES } from '../store/voiceStore';
import { BORDER_RADIUS} from '../constants/theme';

const { width } = Dimensions.get('window');

const LOCK_ICONS = ['lock-closed', 'lock-closed', 'shield-checkmark', 'key'] as const;
const NEO_CYAN = '#00F0FF';
const ALERT_RED = '#FF3366';

export default function IronLockOverlay() {
  const insets = useSafeAreaInsets();
  const isLockdown = useRiskStore(selectIsLockdownActive);
  const lockdown = useRiskStore(s => s.lockdown);
  const speak = useVoiceStore(s => s.speak);
  const prevLockdownRef = useRef(lockdown.status);

  const [visible, setVisible] = useState(false);

  // Animations
  const fadeAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(0.5);
  const pulseAnim = useSharedValue(0);
  const glowPulse = useSharedValue(0);

  // Animated styles
  const wrapperStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: scaleAnim.value }],
  }));

  const glowRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 1], [0.15, 0.4]),
    transform: [{ scale: interpolate(glowPulse.value, [0, 1], [1, 1.15]) }],
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 1], [0.15, 0.4]),
  }));

  const lockIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 1], [0.8, 1]),
  }));

  // Countdown
  const [timeRemaining, setTimeRemaining] = useState('');
  const [iconName, setIconName] = useState<string>(LOCK_ICONS[0]);

  // Refs for cleanup
  const iconIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Lockdown trigger/lift detection + animation ──────────
  useEffect(() => {
    const current = lockdown.status;
    const prev = prevLockdownRef.current;
    prevLockdownRef.current = current;

    if (current === 'active' && (prev === 'none' || prev === 'cooldown')) {
      // Lockdown triggered — show overlay with animations
      setVisible(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      speak(VOICE_MESSAGES.stopLossBreached);

      // Reset anim values
      fadeAnim.value = 0;
      scaleAnim.value = 0.5;
      pulseAnim.value = 0;
      glowPulse.value = 0;

      // Start loops
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000 }),
          withTiming(0, { duration: 2000 }),
        ),
        -1,
      );
      glowPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 3000 }),
          withTiming(0, { duration: 3000 }),
        ),
        -1,
      );

      // Entrance animation
      fadeAnim.value = withTiming(1, { duration: 500 });
      scaleAnim.value = withSpring(1, { stiffness: 80, damping: 12 });

      // Cycle through lock icons
      let idx = 0;
      iconIntervalRef.current = setInterval(() => {
        idx = (idx + 1) % LOCK_ICONS.length;
        setIconName(LOCK_ICONS[idx]);
      }, 4000);

    } else if (current === 'none' && (prev === 'active' || prev === 'cooldown')) {
      // Lockdown lifted — hide overlay
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      speak(VOICE_MESSAGES.lockdownLifted);

      // Clean up icon interval
      if (iconIntervalRef.current) {
        clearInterval(iconIntervalRef.current);
        iconIntervalRef.current = null;
      }

      // Cancel loops by overriding values
      pulseAnim.value = 0;
      glowPulse.value = 0;

      // Exit animation with completion callback
      fadeAnim.value = withTiming(0, { duration: 400 }, (finished) => {
        if (finished) {
          runOnJS(setVisible)(false);
        }
      });
      scaleAnim.value = withTiming(0.8, { duration: 300 });

    } else if (current === 'cooldown' && prev !== 'cooldown') {
      // Transitioned to cooldown — show overlay with cooldown icon
      if (!visible) setVisible(true);
      setIconName(LOCK_ICONS[1]);
    }

    // Cleanup on unmount
    return () => {
      if (iconIntervalRef.current) {
        clearInterval(iconIntervalRef.current);
        iconIntervalRef.current = null;
      }
      // Cancel running animations
      fadeAnim.value = 0;
      scaleAnim.value = 0.5;
      pulseAnim.value = 0;
      glowPulse.value = 0;
    };
  }, [lockdown.status]);

  // ── Countdown timer ───────────────────────────────────────
  useEffect(() => {
    if (!lockdown.liftsAt) return;

    const updateCountdown = () => {
      const lifts = new Date(lockdown.liftsAt!).getTime();
      const now = Date.now();
      const diff = lifts - now;

      if (diff <= 0) {
        setTimeRemaining('Lifting soon...');
        // Check if lockdown is expiring soon
        if (diff > -300000) { // within 5 min of expiry
          speak(VOICE_MESSAGES.lockdownExpiring);
        }
        return;
      }

      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${hrs}h ${mins}m ${secs}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lockdown.liftsAt]);

  if (!visible || (!isLockdown)) return null;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        wrapperStyle,
      ]}
      pointerEvents="auto"
    >
      <LinearGradient
        colors={['#0B0F19', '#1A0A0A', '#0D1117']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backdrop}
      >
        {/* Lock Icon with Glow */}
        <View style={styles.lockContainer}>
          {/* Outer glow ring */}
          <Animated.View
            style={[
              styles.glowRing,
              glowRingStyle,
            ]}
          />
          {/* Inner glow */}
          <Animated.View
            style={[
              styles.innerGlow,
              innerGlowStyle,
              { backgroundColor: ALERT_RED },
            ]}
          />
          {/* Lock icon */}
          <Animated.View style={lockIconStyle}>
            <Ionicons name={iconName as any} size={80} color={ALERT_RED} />
          </Animated.View>
        </View>

        {/* Lockdown Status */}
        <Text style={styles.lockdownStatus}>
          {lockdown.status === 'cooldown' ? 'COOLDOWN' : 'LOCKDOWN'}
        </Text>
        <Text style={styles.lockdownDesc}>
          {lockdown.status === 'cooldown'
            ? 'Exit-only mode continuing in cooldown'
            : 'Financial Bodyguard engaged'}
        </Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Countdown Timer */}
        <View style={styles.timerSection}>
          <Ionicons name="time-outline" size={18} color={NEO_CYAN} />
          <Text style={styles.timerLabel}>Lockdown lifts in</Text>
          <Text style={styles.timerValue}>{timeRemaining || 'Calculating...'}</Text>
        </View>

        {/* Breach Details */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Trigger Loss</Text>
            <Text style={styles.detailValue}>
              ₹{lockdown.triggerLoss?.toLocaleString() || '—'}
            </Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Limit Breached</Text>
            <Text style={styles.detailValue}>
              {lockdown.breachedLimit === 'daily_loss' ? '₹ Limit' :
               lockdown.breachedLimit === 'daily_loss_percent' ? '% Limit' : '—'}
            </Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={styles.detailValue}>
              {lockdown.status === 'active' ? 'Active' : 'Cooldown'}
            </Text>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Ionicons name="information-circle-outline" size={16} color={NEO_CYAN} />
          <Text style={styles.instructionText}>
            Only SQUARE OFF orders are permitted. All other actions are blocked until the lockdown period ends.
          </Text>
        </View>

        {/* Safe area spacer */}
        <View style={{ height: insets.bottom + 20 }} />
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9998,
    elevation: 9998,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  glowRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: ALERT_RED,
  },
  innerGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    opacity: 0.1,
  },
  lockdownStatus: {
    fontSize: 36,
    fontWeight: '900',
    color: ALERT_RED,
    letterSpacing: 8,
    marginBottom: 8,
  },
  lockdownDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    marginBottom: 32,
  },
  divider: {
    width: width * 0.4,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 32,
  },
  timerSection: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  timerLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  timerValue: {
    fontSize: 28,
    fontWeight: '700',
    color: NEO_CYAN,
    fontVariant: ['tabular-nums'],
  },
  detailsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  detailLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,240,255,0.06)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0,240,255,0.15)',
  },
  instructionText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
  },
});
