/**
 * ============================================================================
 * Toroloom — Telegram Connect Screen
 * ============================================================================
 *
 * Allows users to link their Telegram account to receive trading alerts,
 * price notifications, and portfolio updates via Telegram bot.
 *
 * Flow:
 *   1. Check current Telegram status (linked/unlinked)
 *   2. If unlinked → Show "Connect Telegram" button
 *   3. On connect → Generate link code → Show code + instructions
 *   4. User sends /start <code> to @ToroloomBot
 *   5. Verify connection → Send test message
 *   6. If linked → Show linked status + test/unlink options
 * ============================================================================
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { telegramApi } from '../../services/api';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

const { width } = Dimensions.get('window');
const BOT_USERNAME = 'ToroloomBot';

export default function TelegramConnectScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  // ── State ──
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [codeExpiresIn, setCodeExpiresIn] = useState(600);
  const [linked, setLinked] = useState(false);
  const [telegramInfo, setTelegramInfo] = useState<{
    firstName?: string;
    username?: string;
    chatId?: number;
    linkedAt?: string;
  }>({});

  // ── Animations ──
  const pulseAnim = useSharedValue(1);
  const codeScale = useSharedValue(0.8);
  const codeOpacity = useSharedValue(0);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const codeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: codeScale.value }],
    opacity: codeOpacity.value,
  }));

  // ── Load status on mount ──
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await telegramApi.getStatus();
      setLinked(status.linked);
      if (status.linked) {
        setTelegramInfo({
          firstName: status.firstName,
          username: status.username,
          chatId: status.chatId,
          linkedAt: status.linkedAt,
        });
      }
    } catch {
      // Backend unavailable — show offline state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ── Countdown for code expiry ──
  useEffect(() => {
    if (!linkCode || codeExpiresIn <= 0) return;
    const interval = setInterval(() => {
      setCodeExpiresIn(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [linkCode, codeExpiresIn]);

  // ── Pulse animation when showing code ──
  useEffect(() => {
    if (linkCode) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      codeScale.value = withSpring(1, { stiffness: 80, damping: 12 });
      codeOpacity.value = withTiming(1, { duration: 400 });
    } else {
      pulseAnim.value = 1;
      codeScale.value = 0.8;
      codeOpacity.value = 0;
    }
  }, [linkCode]);

  // ── Generate link code ──
  const handleConnect = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLinking(true);
    try {
      const result = await telegramApi.generateCode();
      if (result.success) {
        setLinkCode(result.code);
        setCodeExpiresIn(result.expiresIn);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Error', 'Failed to generate link code. Please try again.');
    } finally {
      setLinking(false);
    }
  };

  // ── Copy code to clipboard ──
  const handleCopyCode = async () => {
    if (!linkCode) return;
    try {
      await Clipboard.setStringAsync(`/start ${linkCode}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('Copied!', `Code copied! Now open Telegram and send:\n\n/start ${linkCode}\n\nto @${BOT_USERNAME}`);
    } catch {
      // Clipboard not available
    }
  };

  // ── Check if linked after showing code ──
  const handleCheckLinked = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    try {
      const status = await telegramApi.getStatus();
      setLinked(status.linked);
      if (status.linked) {
        setTelegramInfo({
          firstName: status.firstName,
          username: status.username,
          chatId: status.chatId,
          linkedAt: status.linkedAt,
        });
        setLinkCode(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      // Backend unavailable
    } finally {
      setLoading(false);
    }
  };

  // ── Send test message ──
  const handleTestMessage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSendingTest(true);
    try {
      const result = await telegramApi.sendTest();
      if (result.success) {
        Alert.alert('✅ Sent!', 'Check your Telegram for the test message.');
      } else {
        Alert.alert('⚠️ Failed', result.message || 'Could not send test message. Make sure you have started the bot.');
      }
    } catch {
      Alert.alert('Error', 'Failed to send test message.');
    } finally {
      setSendingTest(false);
    }
  };

  // ── Unlink ──
  const handleUnlink = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Warning);
    Alert.alert(
      'Unlink Telegram?',
      'You will stop receiving notifications via Telegram. You can reconnect anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              await telegramApi.unlink();
              setLinked(false);
              setLinkCode(null);
              setTelegramInfo({});
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert('Error', 'Failed to unlink Telegram.');
            }
          },
        },
      ],
    );
  };

  // ── Format expiry time ──
  const formatExpiry = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Render ──

  if (loading && !linked) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Connect Telegram</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Checking connection status...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Connect Telegram</Text>
        </View>

        {/* Hero Section */}
        <LinearGradient
          colors={['#1E3A5F', '#0F1923']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Animated.View style={[styles.telegramIconContainer, pulseStyle]}>
            <Ionicons name="paper-plane" size={48} color="#0088CC" />
          </Animated.View>
          <Text style={styles.heroTitle}>Get Trading Alerts on Telegram</Text>
          <Text style={styles.heroSubtitle}>
            Receive real-time price alerts, trade confirmations, portfolio updates, and market news directly on your Telegram.
          </Text>
        </LinearGradient>

        {/* Features */}
        <View style={styles.featuresRow}>
          {[
            { icon: 'trending-up', label: 'Price Alerts', color: '#00C853' },
            { icon: 'checkmark-circle', label: 'Trade Confirms', color: '#3B82F6' },
            { icon: 'pie-chart', label: 'Portfolio Updates', color: '#8B5CF6' },
            { icon: 'newspaper', label: 'Market News', color: '#FFC107' },
          ].map((feat, i) => (
            <View key={i} style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: feat.color + '20' }]}>
                <Ionicons name={feat.icon as any} size={20} color={feat.color} />
              </View>
              <Text style={styles.featureLabel}>{feat.label}</Text>
            </View>
          ))}
        </View>

        {/* Linked State */}
        {linked ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.linkedSection}>
            {/* Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusIconRow}>
                <View style={styles.statusIcon}>
                  <Ionicons name="checkmark-circle" size={32} color="#22C55E" />
                </View>
                <View style={styles.statusInfo}>
                  <Text style={styles.statusTitle}>Connected</Text>
                  <Text style={styles.statusSubtitle}>
                    {telegramInfo.firstName || 'User'}{telegramInfo.username ? ` (@${telegramInfo.username})` : ''}
                  </Text>
                </View>
              </View>
              {telegramInfo.linkedAt && (
                <Text style={styles.linkedDate}>
                  Linked on {new Date(telegramInfo.linkedAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </Text>
              )}

              <View style={styles.statusDivider} />

              {/* Test Button */}
              <AnimatedPressable
                onPress={handleTestMessage}
                disabled={sendingTest}
                style={styles.actionBtn}
                haptic="light"
                scaleTo={0.97}
              >
                {sendingTest ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color={colors.primary} />
                    <Text style={styles.actionBtnText}>Send Test Message</Text>
                  </>
                )}
              </AnimatedPressable>

              {/* Unlink Button */}
              <AnimatedPressable
                onPress={handleUnlink}
                style={[styles.actionBtn, styles.unlinkBtn]}
                haptic="warning"
                scaleTo={0.97}
              >
                <Ionicons name="link-outline" size={18} color={colors.danger} />
                <Text style={[styles.actionBtnText, { color: colors.danger }]}>Unlink Telegram</Text>
              </AnimatedPressable>
            </View>

            {/* Info Note */}
            <View style={styles.infoNote}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={styles.infoNoteText}>
                To stop receiving notifications, go to Telegram and block @{BOT_USERNAME}, or unlink here.
              </Text>
            </View>
          </Animated.View>
        ) : linkCode ? (
          // ── Code Display ──
          <Animated.View entering={FadeIn.duration(300)} style={styles.codeSection}>
            <View style={styles.codeCard}>
              <Text style={styles.codeTitle}>Your Link Code</Text>
              <Animated.View style={[styles.codeBox, codeStyle]}>
                <Text style={styles.codeText}>{linkCode}</Text>
              </Animated.View>

              {/* Instructions */}
              <View style={styles.instructionsList}>
                <View style={styles.instructionStep}>
                  <View style={styles.stepDot}>
                    <Text style={styles.stepDotText}>1</Text>
                  </View>
                  <Text style={styles.instructionText}>
                    Open Telegram and search for <Text style={styles.bold}>@{BOT_USERNAME}</Text>
                  </Text>
                </View>
                <View style={styles.instructionStep}>
                  <View style={styles.stepDot}>
                    <Text style={styles.stepDotText}>2</Text>
                  </View>
                  <Text style={styles.instructionText}>
                    Send this message: <Text style={styles.codeInline}>/start {linkCode}</Text>
                  </Text>
                </View>
                <View style={styles.instructionStep}>
                  <View style={styles.stepDot}>
                    <Text style={styles.stepDotText}>3</Text>
                  </View>
                  <Text style={styles.instructionText}>
                    Wait for confirmation from the bot, then tap "Check Connection" below
                  </Text>
                </View>
              </View>

              {/* Copy button */}
              <AnimatedPressable onPress={handleCopyCode} style={styles.copyBtn} haptic="light" scaleTo={0.97}>
                <Ionicons name="copy-outline" size={18} color="#0D0D0D" />
                <Text style={styles.copyBtnText}>Copy to Clipboard</Text>
              </AnimatedPressable>

              {/* Check connection */}
              <AnimatedPressable onPress={handleCheckLinked} style={styles.checkBtn} haptic="medium" scaleTo={0.97}>
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                <Text style={styles.checkBtnText}>Check Connection</Text>
              </AnimatedPressable>

              {/* Expiry timer */}
              <View style={styles.expiryRow}>
                <Ionicons name="time-outline" size={14} color={codeExpiresIn <= 60 ? '#EF4444' : colors.textMuted} />
                <Text style={[styles.expiryText, codeExpiresIn <= 60 && { color: '#EF4444' }]}>
                  Code expires in {formatExpiry(codeExpiresIn)}
                </Text>
              </View>

              {/* Cancel */}
              <TouchableOpacity
                onPress={() => setLinkCode(null)}
                style={styles.cancelLinkBtn}
              >
                <Text style={styles.cancelLinkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : (
          // ── Connect Button ──
          <Animated.View entering={FadeIn.duration(400)}>
            <View style={styles.connectCard}>
              <Text style={styles.connectTitle}>Ready to Connect?</Text>
              <Text style={styles.connectSubtitle}>
                Link your Telegram account in 3 simple steps. You'll receive instant notifications for all your trading activity.
              </Text>

              <View style={styles.connectSteps}>
                <View style={styles.connectStep}>
                  <Ionicons name="link-outline" size={16} color="#3B82F6" />
                  <Text style={styles.connectStepText}>Generate a unique link code</Text>
                </View>
                <View style={styles.connectStep}>
                  <Ionicons name="send" size={16} color="#3B82F6" />
                  <Text style={styles.connectStepText}>Send it to @{BOT_USERNAME} on Telegram</Text>
                </View>
                <View style={styles.connectStep}>
                  <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />
                  <Text style={styles.connectStepText}>Receive alerts automatically</Text>
                </View>
              </View>

              <AnimatedPressable
                onPress={handleConnect}
                disabled={linking}
                style={styles.connectBtn}
                haptic="medium"
                scaleTo={0.97}
              >
                <LinearGradient
                  colors={['#0088CC', '#006699']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.connectBtnGradient}
                >
                  {linking ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
                      <Text style={styles.connectBtnText}>Connect Telegram</Text>
                    </>
                  )}
                </LinearGradient>
              </AnimatedPressable>
            </View>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ──
const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  loadingText: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
  },

  // ── Hero ──
  heroCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xxl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  telegramIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,136,204,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  heroTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Features ──
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  featureItem: {
    alignItems: 'center',
    gap: SPACING.sm,
    width: (width - 64) / 4 - 8,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.text,
    textAlign: 'center',
  },

  // ── Linked Section ──
  linkedSection: {
    gap: SPACING.lg,
  },
  statusCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.xl,
  },
  statusIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(34,197,94,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: '#22C55E',
  },
  statusSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  linkedDate: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginBottom: SPACING.lg,
  },
  statusDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginBottom: SPACING.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '10',
    marginBottom: SPACING.sm,
  },
  actionBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
  unlinkBtn: {
    borderColor: colors.danger + '30',
    backgroundColor: colors.danger + '08',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoNoteText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },

  // ── Code Section ──
  codeSection: {
    gap: SPACING.lg,
  },
  codeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  codeTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
    marginBottom: SPACING.lg,
  },
  codeBox: {
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    marginBottom: SPACING.xl,
    width: '100%',
    alignItems: 'center',
  },
  codeText: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.xxxl,
    color: colors.primary,
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // ── Instructions ──
  instructionsList: {
    width: '100%',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: colors.primary,
  },
  instructionText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
  },
  bold: {
    ...FONTS.semiBold,
  },
  codeInline: {
    ...FONTS.mono,
    fontSize: FONTS.size.sm,
    color: colors.primary,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // ── Buttons ──
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FFAB40',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    width: '100%',
    marginBottom: SPACING.sm,
  },
  copyBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: '#0D0D0D',
  },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: colors.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    width: '100%',
    marginBottom: SPACING.md,
  },
  checkBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: '#FFFFFF',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  expiryText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  cancelLinkBtn: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
  },
  cancelLinkText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },

  // ── Connect Button ──
  connectCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.xl,
  },
  connectTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
    marginBottom: SPACING.sm,
  },
  connectSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.xl,
  },
  connectSteps: {
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  connectStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  connectStepText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  connectBtn: {
    width: '100%',
  },
  connectBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  connectBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#FFFFFF',
  },
});
