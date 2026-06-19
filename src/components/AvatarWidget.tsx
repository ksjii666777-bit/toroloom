/**
 * ============================================================================
 * Toroloom — AI Companion Micro-Avatar Widget
 * ============================================================================
 *
 * Globally accessible live avatar widget that:
 *   - Displays a dynamic micro-avatar (normal / alert / celebration)
 *   - Listens to RiskStore for stop-loss breaches → hard-lock alert + voice
 *   - Listens for profit targets achieved → celebration + voice
 *   - Animates state transitions with neon glow effects
 *   - Uses voiceStore for queued, cooldown-aware voice announcements
 *
 * Usage in AppNavigator:
 *   <MainTabs />
 *   <AvatarWidget />
 * ============================================================================
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useRiskStore, selectDailyPnL } from '../store/riskStore';
import { useVoiceStore, VOICE_MESSAGES } from '../store/voiceStore';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CYBER_CYAN = '#00F0FF';
const PREMIUM_GOLD = '#FFD700';
const ALERT_RED = '#FF3366';
const PROFIT_SWING_THRESHOLD = 10000;
const BANNER_AUTO_DISMISS_MS = 6000;

// ── Types ──────────────────────────────────────────────────────

type AvatarState = 'idle' | 'listening' | 'alert' | 'celebration';

// ── Component ──────────────────────────────────────────────────

export default function AvatarWidget() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const lockdown = useRiskStore(s => s.lockdown);
  const dailyPnL = useRiskStore(selectDailyPnL);
  const prevLockdownRef = useRef(lockdown.status);
  const prevPnLRef = useRef(dailyPnL);

  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(80)).current;
  const messageOpacity = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceSpeak = useVoiceStore(s => s.speak);

  // ── Banner animation ──────────────────────────────────────
  const triggerBanner = useCallback(() => {
    setExpanded(true);
    slideUp.setValue(80);
    messageOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(slideUp, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
        bounciness: 6,
      }),
      Animated.timing(messageOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Clear any previous dismiss timer
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }

    // Auto-dismiss after BANNER_AUTO_DISMISS_MS
    dismissTimerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideUp, {
          toValue: 80,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(messageOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setExpanded(false);
        setMessage(null);
        setAvatarState('idle');
        dismissTimerRef.current = null;
      });
    }, BANNER_AUTO_DISMISS_MS);
  }, []);

  // ── Tap to toggle ─────────────────────────────────────────
  const handleTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (expanded) {
      // Dismiss early — clear timer
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      setExpanded(false);
      setMessage(null);
      setAvatarState('idle');
    } else {
      setExpanded(!expanded);
    }
  }, [expanded]);

  // ── Lockdown / P&L Listener ───────────────────────────────
  useEffect(() => {
    const currentLockdown = lockdown.status;
    const prevLockdown = prevLockdownRef.current;

    // Stop-loss breached (transitioned into lockdown)
    if (currentLockdown === 'active' && prevLockdown === 'none') {
      setAvatarState('alert');
      setMessage(VOICE_MESSAGES.stopLossBreached.text);
      voiceSpeak(VOICE_MESSAGES.stopLossBreached);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      triggerBanner();
    }

    // Lockdown lifted
    if (currentLockdown === 'none' && (prevLockdown === 'active' || prevLockdown === 'cooldown')) {
      setAvatarState('listening');
      setMessage(VOICE_MESSAGES.lockdownLifted.text);
      voiceSpeak(VOICE_MESSAGES.lockdownLifted);
      triggerBanner();
    }

    // Profit target detected (large positive P&L swing)
    const prevPnL = prevPnLRef.current;
    if (prevPnL < 0 && dailyPnL > 0 && Math.abs(dailyPnL - prevPnL) > PROFIT_SWING_THRESHOLD) {
      setAvatarState('celebration');
      setMessage(VOICE_MESSAGES.profitTargetHit.text);
      voiceSpeak(VOICE_MESSAGES.profitTargetHit);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      triggerBanner();
    }

    // Daily loss warning (P&L approaching limit)
    if (dailyPnL < 0 && Math.abs(dailyPnL) > 30000 && Math.abs(dailyPnL) < 50000) {
      voiceSpeak(VOICE_MESSAGES.dailyLossWarning);
    }

    prevLockdownRef.current = currentLockdown;
    prevPnLRef.current = dailyPnL;

    // Cleanup dismiss timer on unmount
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [lockdown.status, dailyPnL]);

  // ── Neon Pulse Loop (idle state) ──────────────────────────
  useEffect(() => {
    if (avatarState === 'idle') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [avatarState]);

  // ── Avatar visuals ────────────────────────────────────────
  const avatarIcon = avatarState === 'alert' ? 'shield' :
    avatarState === 'celebration' ? 'trophy' :
    avatarState === 'listening' ? 'ear' : 'happy';

  const avatarColor = avatarState === 'alert' ? ALERT_RED :
    avatarState === 'celebration' ? PREMIUM_GOLD :
    avatarState === 'listening' ? CYBER_CYAN : colors.primary;

  const bgColor = avatarState === 'alert' ? `${ALERT_RED}20` :
    avatarState === 'celebration' ? `${PREMIUM_GOLD}20` :
    `${CYBER_CYAN}15`;

  const glowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom: 80 + insets.bottom,
          transform: [{ translateY: slideUp }],
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Message Banner */}
      {expanded && message && (
        <Animated.View
          style={[
            styles.banner,
            {
              backgroundColor: bgColor,
              borderColor: avatarColor,
              opacity: messageOpacity,
            },
          ]}
        >
          <Ionicons name={avatarIcon as any} size={20} color={avatarColor} />
          <Text style={[styles.bannerText, { color: colors.text }]} numberOfLines={3}>
            {message}
          </Text>
          <TouchableOpacity onPress={handleTap} style={styles.dismissBtn}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Avatar Circle */}
      <TouchableOpacity onPress={handleTap} activeOpacity={0.8}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.bgCard, borderColor: avatarColor }]}>
          {/* Glow behind avatar */}
          <Animated.View
            style={[
              styles.avatarGlow,
              {
                backgroundColor: avatarColor,
                opacity: glowOpacity,
              },
            ]}
          />
          <Ionicons name={avatarIcon as any} size={24} color={avatarColor} />
        </View>
        {/* Small label */}
        <Text style={[styles.avatarLabel, { color: colors.textMuted }]}>
          {avatarState === 'alert' ? 'LOCKDOWN' :
           avatarState === 'celebration' ? 'PROFIT!' :
           avatarState === 'listening' ? 'LISTENING' : 'TOROLOOM'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    zIndex: 9999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: SCREEN_WIDTH * 0.75,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  dismissBtn: {
    padding: 4,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
    alignSelf: 'flex-end',
  },
  avatarGlow: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 4,
  },
});
