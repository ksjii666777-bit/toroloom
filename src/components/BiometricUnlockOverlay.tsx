/**
 * ============================================================================
 * Toroloom — Biometric Unlock Overlay
 * ============================================================================
 *
 * Full-screen transparent overlay that prompts the user for biometric
 * authentication when the app comes to the foreground.
 *
 * Features:
 *   - Animated fade-in with blur backdrop (Reanimated)
 *   - Shows device-appropriate biometric icon (Face ID / Fingerprint)
 *   - "Use Passcode" fallback button
 *   - Error state with retry
 *   - Dismisses on successful authentication
 *
 * Usage (in App.tsx):
 *   <BiometricUnlockOverlay />
 *
 * ============================================================================
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  AppState,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useBiometricStore } from '../store/biometricStore';
import { biometricAuth } from '../services/biometricService';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';

export default function BiometricUnlockOverlay() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const enabled = useBiometricStore((s) => s.enabled);
  const isUnlocked = useBiometricStore((s) => s.isUnlocked);
  const unlock = useBiometricStore((s) => s.unlock);
  const lock = useBiometricStore((s) => s.lock);

  const [visible, setVisible] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Face ID');
  const [biometricIcon, setBiometricIcon] = useState('finger-print');
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Animated pulse for the biometric icon
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (visible && !isAuthenticating) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, // infinite repeat
        true,
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1000 }),
          withTiming(1, { duration: 1000 }),
        ),
        -1,
        true,
      );
    } else {
      pulseScale.value = withTiming(1);
      pulseOpacity.value = withTiming(1);
    }
  }, [visible, isAuthenticating]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  // Load biometric type on mount
  useEffect(() => {
    biometricAuth.getBiometricLabel().then(setBiometricLabel);
    biometricAuth.getBiometricIcon().then(setBiometricIcon);
  }, []);

  // Attempt authentication
  const attemptAuth = useCallback(async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setError(null);

    const result = await biometricAuth.authenticate(
      `Unlock Toroloom with ${biometricLabel}`,
      true,
    );

    if (result.success) {
      unlock();
      setVisible(false);
    } else {
      setError(result.error || 'Authentication failed');
    }

    setIsAuthenticating(false);
  }, [isAuthenticating, biometricLabel, unlock]);

  // Handle AppState changes — show overlay when app comes to foreground
  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return;
    }

    // Flag to prevent multiple simultaneous auth attempts
    let isAuthInProgress = false;

    const triggerAuth = () => {
      if (isAuthInProgress) return;
      isAuthInProgress = true;
      setVisible(true);
      setError(null);

      biometricAuth.authenticate(
        `Unlock Toroloom with ${biometricLabel}`,
        true,
      ).then((result) => {
        isAuthInProgress = false;
        if (result.success) {
          unlock();
          setVisible(false);
        } else {
          setError(result.error || 'Authentication failed');
        }
      });
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !isUnlocked) {
        // Small delay to let the app settle before showing biometric prompt
        setTimeout(triggerAuth, 300);
      } else if (nextState === 'background') {
        // Lock the app when going to background
        isAuthInProgress = false;
        lock();
      }
    });

    // If user already has biometric enabled but isUnlocked is false, show on mount
    if (!isUnlocked) {
      const timer = setTimeout(triggerAuth, 500);
      return () => {
        clearTimeout(timer);
        subscription.remove();
      };
    }

    return () => subscription.remove();
  }, [enabled, isUnlocked, biometricLabel]);

  if (!visible || !enabled) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={styles.overlay}
    >
      {/* Backdrop blur effect */}
      <View style={styles.backdrop} />

      <LinearGradient
        colors={['rgba(11, 15, 25, 0.97)', 'rgba(11, 15, 25, 0.99)']}
        style={styles.content}
      >
        {/* App Logo / Icon */}
        <View style={styles.logoContainer}>
          <LinearGradient
            colors={['#3B82F6', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoGradient}
          >
            <Text style={styles.logoText}>T</Text>
          </LinearGradient>
        </View>

        <Text style={styles.title}>Toroloom</Text>
        <Text style={styles.subtitle}>Biometric authentication required</Text>

        {/* Biometric Icon (pulsing) */}
        <Animated.View style={[styles.biometricContainer, pulseStyle]}>
          <TouchableOpacity
            onPress={attemptAuth}
            disabled={isAuthenticating}
            activeOpacity={0.7}
          >
            <View style={styles.biometricIconWrap}>
              <Ionicons
                name={biometricIcon as keyof typeof Ionicons.glyphMap}
                size={64}
                color={colors.primary}
              />
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.promptText}>
          {isAuthenticating
            ? 'Authenticating...'
            : `Tap to authenticate with ${biometricLabel}`}
        </Text>

        {/* Error message */}
        {error && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={styles.errorContainer}
          >
            <Ionicons name="alert-circle" size={18} color={colors.marketDown} />
            <Text style={styles.errorText}>
              {error === 'Authentication cancelled'
                ? `Authentication cancelled. Use passcode or tap to retry with ${biometricLabel}.`
                : error}
            </Text>
          </Animated.View>
        )}

        {/* Retry / Use Passcode buttons */}
        <View style={styles.buttonRow}>
          {error && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={attemptAuth}
              disabled={isAuthenticating}
            >
              <Ionicons name="refresh" size={18} color={colors.white} />
              <Text style={styles.actionBtnText}>Retry</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.bgCard }]}
            onPress={attemptAuth}
          >
            <Ionicons name="keypad-outline" size={18} color={colors.text} />
            <Text style={[styles.actionBtnText, { color: colors.text }]}>
              Use Passcode
            </Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === 'ios' && (
          <Text style={styles.hint}>
            Face ID permission is required. You can change this in
            Settings {'>'} Toroloom {'>'} Face ID & Passcode.
          </Text>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      elevation: 9999,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: SPACING.xxl,
    },
    logoContainer: {
      marginBottom: SPACING.lg,
    },
    logoGradient: {
      width: 80,
      height: 80,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoText: {
      fontSize: 40,
      fontWeight: '800',
      color: '#FFFFFF',
      fontFamily: 'Inter-ExtraBold',
    },
    title: {
      ...FONTS.bold,
      fontSize: FONTS.size.title,
      color: colors.white,
      marginBottom: SPACING.xs,
    },
    subtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.md,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: SPACING.xxl,
    },
    biometricContainer: {
      marginBottom: SPACING.lg,
    },
    biometricIconWrap: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: `${colors.primary}15`,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: `${colors.primary}30`,
    },
    promptText: {
      ...FONTS.medium,
      fontSize: FONTS.size.md,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: SPACING.xl,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: `${colors.marketDown}15`,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: SPACING.lg,
      maxWidth: 320,
    },
    errorText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.marketDown,
      flex: 1,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: SPACING.md,
      marginBottom: SPACING.xxl,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.full,
    },
    actionBtnText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      color: colors.white,
    },
    hint: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 300,
      lineHeight: 16,
    },
  });
