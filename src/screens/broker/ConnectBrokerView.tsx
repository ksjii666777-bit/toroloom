/**
 * ============================================================================
 * Toroloom — Connect Broker View (Zero-API Hybrid Gateway Edition)
 * ============================================================================
 *
 * Ultra-premium fin-tech broker connection interface featuring:
 *   - Deep Midnight Canvas Background (#07080B)
 *   - High-end glassmorphic information cards (rgba(255,255,255,0.03))
 *   - Status pill badges for "✓ ZERO-API SYNC" and "100% FREE"
 *   - Active TextInput focus states with neon cyan border (#00F2FE)
 *   - Elegant LinearGradient CTA (amber-orange #FF8C00 → #D2691E)
 *
 * This view integrates with SecureSessionSync to extract broker session
 * data via the WebView gateway, then stores credentials in the keychain
 * via the sessionStorage pipeline.
 *
 * ============================================================================
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { triggerHaptic, ImpactFeedbackStyle } from '../../utils/haptics';
import { notificationAsync, NotificationFeedbackType } from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../../hooks/useT';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

import { brokerProxyApi, snapTradeApi } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Constants ─────────────────────────────────────────────────────────────

const NEON_CYAN = '#00F2FE';
const MIDNIGHT_BG = '#07080B';
const GLASS_WHITE = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.08)';

const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

// ─── Broker Meta ───────────────────────────────────────────────────────────

interface BrokerMeta {
  type: string;
  label: string;
  tagline: string;
  icon: string;
  color: string;
  gradient: readonly [string, string];
  hasOAuth: boolean;
  features: string[];
}

const BROKERS: BrokerMeta[] = [
  {
    type: 'angel',
    label: 'Angel One',
    tagline: "India's largest retail broking house",
    icon: 'A',
    color: '#FF6B00',
    gradient: ['#FF6B00', '#CC5500'] as const,
    hasOAuth: false,
    features: ['SmartAPI', 'Free Equity Delivery', 'EDIS Support'],
  },
  {
    type: 'zerodha',
    label: 'Zerodha',
    tagline: "India's biggest stock broker",
    icon: 'Z',
    color: '#2874F0',
    gradient: ['#2874F0', '#1A5FCC'] as const,
    hasOAuth: true,
    features: ['Kite Connect API', '₹0 Brokerage', 'Trading + Demat'],
  },
  {
    type: 'groww',
    label: 'Groww',
    tagline: 'Simple, modern investing platform',
    icon: 'G',
    color: '#00A86B',
    gradient: ['#00A86B', '#008050'] as const,
    hasOAuth: true,
    features: ['Trade API', 'Zero Commission', 'Mutual Funds'],
  },
  {
    type: 'dhan',
    label: 'Dhan',
    tagline: 'India\'s fastest growing trading platform',
    icon: 'D',
    color: '#9B59B6',
    gradient: ['#9B59B6', '#7D3C98'] as const,
    hasOAuth: true,
    features: ['OAuth 2.0', 'Zero Brokerage', 'Fast Execution'],
  },
  {
    type: 'upstox',
    label: 'Upstox',
    tagline: 'Trusted by millions of traders',
    icon: 'U',
    color: '#E74C3C',
    gradient: ['#E74C3C', '#C0392B'] as const,
    hasOAuth: true,
    features: ['OAuth 2.0', 'Free Account', 'Advanced Charts'],
  },
  {
    type: 'interactive',
    label: 'Interactive Brokers',
    tagline: 'Global trading powerhouse',
    icon: 'I',
    color: '#2C3E50',
    gradient: ['#2C3E50', '#1A252F'] as const,
    hasOAuth: true,
    features: ['Global Markets', 'Advanced Tools', 'API Access'],
  },
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function ConnectBrokerView({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Connection state
  const [connectedBroker, setConnectedBroker] = useState<string | null>(null);
  const [connectedLabel, setConnectedLabel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTestingProxy, setIsTestingProxy] = useState(false);

  // Modal states
  const [selectedBroker, setSelectedBroker] = useState<BrokerMeta | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [showSuccess, setShowSuccess] = useState(false);

  // ── Check existing sessions ────────────────────────────────────
  const checkExistingSessions = useCallback(async () => {
    try {
      // First try SnapTrade status
      const st = await snapTradeApi.status();
      if (st.connected && st.brokerSlug) {
        setConnectedBroker(st.brokerSlug);
        setConnectedLabel(st.brokerName || st.brokerSlug);
        setSnapTradeConnected(true);
        setIsLoading(false);
        return;
      }

    } catch {
      // SnapTrade unavailable — gracefully fall through to disconnected state
    } finally {
      setSnapTradeConnected(false);
      setIsLoading(false);
    }
  }, []);

  // ── SnapTrade integration hooks ──
  const [_isConnectingSnapTrade, setIsConnectingSnapTrade] = useState(false);
  const [_snapTradeConnected, setSnapTradeConnected] = useState<boolean | null>(null);

  // Check existing sessions on mount
  useEffect(() => {
    checkExistingSessions();
  }, [checkExistingSessions]);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // ── Show Connected Success Overlay ──────────────────────────
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showConnectedSuccess = useCallback(() => {
    setShowSuccess(true);
    notificationAsync(NotificationFeedbackType.Success);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => {
      setShowSuccess(false);
      successTimerRef.current = null;
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // ── SnapTrade Connect Flow ───────────────────────────────────
  // Deep link handler for SnapTrade OAuth callback
  // toroloom://snaptrade/callback?authorizationId=xxx
  const snapTradeCallbackRef = useRef<string | null>(null);

  const handleSnapTradeCallback = useCallback(
    async (url: string) => {
      try {
        const parsed = new URL(url);
        const authorizationId = parsed.searchParams.get('authorizationId');
        if (!authorizationId || snapTradeCallbackRef.current === url) return;
        snapTradeCallbackRef.current = url;

        setIsConnectingSnapTrade(true);
        const result = await snapTradeApi.handleCallback(authorizationId);

        if (result.success && result.connection) {
          setConnectedBroker(result.connection.brokerSlug || selectedBroker?.type || null);
          setConnectedLabel(result.connection.brokerName || selectedBroker?.label || null);
          notificationAsync(NotificationFeedbackType.Success);
          showConnectedSuccess();
        }
      } catch (err: any) {
        Alert.alert(t('brokerConnect.connectionFailed'), err.message || t('brokerConnect.failedOAuth'));
      } finally {
        setIsConnectingSnapTrade(false);
      }
    },
    [selectedBroker, showConnectedSuccess, setIsConnectingSnapTrade, t, setConnectedBroker, setConnectedLabel],
  );

  // Listen for SnapTrade OAuth deep link callbacks
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      if (event.url.startsWith('toroloom://snaptrade/callback')) {
        handleSnapTradeCallback(event.url);
      }
    };

    // Check cold start deep link
    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith('toroloom://snaptrade/callback')) {
        handleSnapTradeCallback(url);
      }
    });

    // Listen for warm start deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => subscription.remove();
  }, [handleSnapTradeCallback]);

  const openSnapTradeConnect = useCallback(
    async (broker: BrokerMeta) => {
      setSelectedBroker(broker);
      triggerHaptic(ImpactFeedbackStyle.Medium);
      setIsConnectingSnapTrade(true);

      try {
        // Step 1: Register user with SnapTrade
        await snapTradeApi.register();

        // Step 2: Get OAuth connection portal URL
        const linkResult = await snapTradeApi.getConnectLink();

        if (linkResult.oauthUrl) {
          // Step 3: Open the OAuth URL in device browser
          // User will log into their broker there
          // On completion, SnapTrade redirects back to toroloom://snaptrade/callback?authorizationId=xxx
          await Linking.openURL(linkResult.oauthUrl);
        } else {
          throw new Error(t('brokerConnect.noOauthUrl'));
        }
      } catch (err: any) {
        Alert.alert(t('brokerConnect.connectionFailed'), err.message || t('brokerConnect.failedSnapTrade'));
        setIsConnectingSnapTrade(false);
      }
      // Don't set isConnectingSnapTrade = false here — the deep link callback will handle it
    },
    [setSelectedBroker, setIsConnectingSnapTrade, t],
  );

  // ── Open SnapTrade Connect (all brokers) ────────────────────
  const openBrokerSelection = useCallback(
    (broker: BrokerMeta) => {
      setSelectedBroker(broker);
      triggerHaptic(ImpactFeedbackStyle.Medium);
      openSnapTradeConnect(broker);
    },
    [openSnapTradeConnect],
  );

  // ── Test API Request ───────────────────────────────────────
  const handleTestApi = useCallback(async () => {
    if (!connectedBroker) return;

    setIsTestingProxy(true);

    try {
      // Use brokerProxyApi through backend (SnapTrade-powered)
      const result = await brokerProxyApi.getHoldings(connectedBroker);

      const title = result.success ? t('brokerConnect.apiSuccess') : t('brokerConnect.apiFailed');
      const body = [
        `Broker: ${connectedBroker.toUpperCase()}`,
        result.success
          ? `Data: ${JSON.stringify(result.data, null, 2).slice(0, 800)}`
          : `Error: ${result.error}`,
      ].join('\n');

      Alert.alert(title, body);
    } catch (err: any) {
      Alert.alert(t('brokerConnect.apiError'), err.message || t('brokerConnect.unexpectedApiError'));
    } finally {
      setIsTestingProxy(false);
    }
  }, [connectedBroker, t, setIsTestingProxy]);

  // ── Disconnect ──────────────────────────────────────────────
  const handleDisconnect = useCallback(
    async (_brokerType: string) => {
      Alert.alert(
        t('brokerConnect.disconnectTitle'),
        t('brokerConnect.disconnectMsg'),
        [
          { text: t('app.cancel'), style: 'cancel' },
          {
            text: t('brokerConnect.disconnect'),
            style: 'destructive',
            onPress: async () => {
              // SnapTrade: disconnect via backend
              try { await snapTradeApi.disconnect(); } catch { /* ignore */ }
              setConnectedBroker(null);
              setConnectedLabel(null);
              notificationAsync(NotificationFeedbackType.Warning);
            },
          },
        ],
      );
    },
    [t, setConnectedBroker, setConnectedLabel],
  );

  // ── Loading State ───────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={NEON_CYAN} />
        <Text style={[styles.loadingText, { color: 'rgba(255,255,255,0.5)' }]}>
          {t('brokerConnect.checkingStatus')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 60 + insets.top }]}>
        <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.93} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </AnimatedPressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{t('brokerConnect.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('brokerConnect.subtitle')}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Premium Status Pills */}
        <Animated.View style={[styles.statusPillsRow, { opacity: fadeAnim }]}>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillIcon}>✓</Text>
            <Text style={styles.statusPillText}>{t('brokerConnect.oAuth')}</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillIcon}>★</Text>
            <Text style={styles.statusPillText}>{t('brokerConnect.brokers')}</Text>
          </View>
          <View style={[styles.statusPill, styles.statusPillOutline]}>
            <Ionicons name="shield-checkmark" size={10} color="#00F2FE" />
            <Text style={[styles.statusPillText, { color: '#00F2FE' }]}>{t('brokerConnect.secure')}</Text>
          </View>
        </Animated.View>

        {/* Connected Banner */}
        {connectedBroker && (
          <Animated.View style={[styles.glassCard, { opacity: fadeAnim, marginBottom: SPACING.xl }]}>
            <View style={styles.glassCardInner}>
              <View style={styles.connectedRow}>
                <View style={[styles.glassIconCircle, { backgroundColor: 'rgba(0,210,255,0.12)' }]}>
                  <Ionicons name="checkmark-circle" size={24} color="#00D2FF" />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.glassCardTitle}>{t('brokerConnect.connected')}</Text>
                  <Text style={styles.glassCardSubtitle}>
                    {connectedLabel} · {t('brokerConnect.secureSessionActive')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    onPress={handleTestApi}
                    disabled={isTestingProxy}
                    style={[
                      styles.glassBtn,
                      isTestingProxy && { opacity: 0.6 },
                    ]}
                  >
                    {isTestingProxy ? (
                      <ActivityIndicator size="small" color="#00F2FE" />
                    ) : (
                      <Text style={[styles.glassBtnText, { color: '#00F2FE' }]}>
                        {t('brokerConnect.testApi')}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDisconnect(connectedBroker)} style={styles.glassBtn}>
                    <Text style={styles.glassBtnText}>{t('brokerConnect.disconnect')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Section Title */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={styles.sectionTitle}>{t('brokerConnect.chooseBroker')}</Text>
          <Text style={styles.sectionSubtitle}>
            {connectedBroker
              ? t('brokerConnect.switchBroker')
              : t('brokerConnect.selectBroker')}
          </Text>
        </Animated.View>

        {/* Broker Grid */}
        <View style={styles.brokerGrid}>
          {BROKERS.map((broker, _idx) => {
            const isConnected = connectedBroker === broker.type;
            return (
              <Animated.View
                key={broker.type}
                style={[
                  styles.brokerCardWrapper,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    if (isConnected) {
                      handleDisconnect(broker.type);
                    } else {
                      openBrokerSelection(broker);
                    }
                  }}
                >
                  <LinearGradient
                    colors={broker.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1.2 }}
                    style={styles.brokerCard}
                  >
                    {/* Broker Icon */}
                    <View style={styles.brokerIconRow}>
                      <View style={styles.brokerIconCircle}>
                        <Text style={styles.brokerIconText}>{broker.icon}</Text>
                      </View>
                      {isConnected && (
                        <View style={styles.connectedBadge}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      )}
                    </View>

                    <Text style={styles.brokerLabel}>{broker.label}</Text>
                    <Text style={styles.brokerTagline} numberOfLines={2}>
                      {broker.tagline}
                    </Text>

                    {/* Sync Method Badge */}
                    <View style={styles.syncMethodBadge}>
                      <Ionicons name="wifi" size={10} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.syncMethodText}>
                        {isConnected ? t('brokerConnect.sessionActive') : t('brokerConnect.oauthConnect')}
                      </Text>
                    </View>

                    {/* Features */}
                    <View style={styles.featureList}>
                      {broker.features.slice(0, 2).map((feature, i) => (
                        <View key={i} style={styles.featureItem}>
                          <Text style={styles.featureDot}>•</Text>
                          <Text style={styles.featureText} numberOfLines={1}>
                            {feature}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Status */}
                    <View
                      style={[
                        styles.connectBadge,
                        isConnected && styles.connectBadgeConnected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.connectBadgeText,
                          isConnected && styles.connectBadgeTextConnected,
                        ]}
                      >
                        {isConnected ? t('brokerConnect.connected') : t('brokerConnect.tapToConnect')}
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* Glassmorphic Info Card */}
        <Animated.View style={[styles.glassCard, { opacity: fadeAnim, marginTop: SPACING.xl }]}>
          <View style={styles.glassCardInner}>
            <View style={styles.glassCardRow}>
              <View style={[styles.glassIconCircle, { backgroundColor: 'rgba(0,210,255,0.1)' }]}>
                <Ionicons name="shield-checkmark" size={18} color="#00D2FF" />
              </View>
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={styles.glassCardTitle}>{t('brokerConnect.snapTradeOauthTitle')}</Text>
                <Text style={styles.glassCardSubtitle}>
                  {t('brokerConnect.snapTradeDesc')}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── All brokers use SnapTrade OAuth Gateway ──────────── */}

      {/* ── Success Overlay ──────────────────────────────────── */}
      {showSuccess && (
        <View style={styles.successOverlay}>
          <Animated.View style={styles.successContent}>
            <LinearGradient
              colors={GRADIENTS.success}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.successCircle}
            >
              <Ionicons name="checkmark" size={40} color="#fff" />
            </LinearGradient>
            <Text style={styles.successTitle}>{t('brokerConnect.successConnected')}</Text>
            <Text style={styles.successSubtitle}>
              {t('brokerConnect.successStored', { broker: connectedLabel || '' })}
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const createStyles = (_colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: MIDNIGHT_BG,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.lg,
      backgroundColor: MIDNIGHT_BG,
    },
    headerTitleContainer: {
      marginLeft: SPACING.md,
      flex: 1,
    },
    headerTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.title,
      color: '#FFFFFF',
    },
    headerSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.5)',
      marginTop: 2,
    },
    scrollContent: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: 20,
    },
    loadingText: {
      ...FONTS.regular,
      fontSize: FONTS.size.md,
      marginTop: SPACING.md,
    },

    // ── Status Pills ─────────────────────────────────────────
    statusPillsRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginBottom: SPACING.xl,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: GLASS_WHITE,
      borderWidth: 1,
      borderColor: GLASS_BORDER,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: BORDER_RADIUS.full,
    },
    statusPillIcon: {
      color: '#00F2FE',
      fontSize: 11,
      fontWeight: '700',
    },
    statusPillText: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    statusPillOutline: {
      backgroundColor: 'rgba(0,242,254,0.06)',
      borderColor: 'rgba(0,242,254,0.25)',
    },

    // ── Glassmorphic Card ────────────────────────────────────
    glassCard: {
      borderRadius: BORDER_RADIUS.lg,
      overflow: 'hidden',
    },
    glassCardInner: {
      backgroundColor: GLASS_WHITE,
      borderWidth: 1,
      borderColor: GLASS_BORDER,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
    },
    glassCardRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    glassIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    glassCardTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: '#FFFFFF',
    },
    glassCardSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.5)',
      marginTop: 4,
      lineHeight: 16,
    },
    connectedRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    glassBtn: {
      backgroundColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      borderColor: GLASS_BORDER,
    },
    glassBtnText: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.7)',
    },

    // ── Section Title ─────────────────────────────────────────
    sectionTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.xl,
      color: '#FFFFFF',
      marginBottom: 4,
    },
    sectionSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.4)',
      marginBottom: SPACING.xl,
    },

    // ── Broker Grid ───────────────────────────────────────────
    brokerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.md,
    },
    brokerCardWrapper: {
      width: CARD_WIDTH,
      marginBottom: SPACING.sm,
    },
    brokerCard: {
      padding: SPACING.lg,
      borderRadius: BORDER_RADIUS.xl,
      minHeight: 190,
      overflow: 'hidden',
    },
    brokerIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    brokerIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    brokerIconText: {
      ...FONTS.bold,
      fontSize: FONTS.size.xl,
      color: '#fff',
    },
    connectedBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#10B981',
      justifyContent: 'center',
      alignItems: 'center',
    },
    brokerLabel: {
      ...FONTS.bold,
      fontSize: FONTS.size.lg,
      color: '#fff',
    },
    brokerTagline: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.7)',
      marginTop: 2,
      marginBottom: SPACING.sm,
    },
    syncMethodBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: SPACING.sm,
    },
    syncMethodText: {
      ...FONTS.regular,
      fontSize: 9,
      color: 'rgba(255,255,255,0.5)',
    },
    featureList: {
      gap: 2,
      marginBottom: SPACING.md,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    featureDot: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 10,
    },
    featureText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.6)',
    },
    connectBadge: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs + 2,
      borderRadius: BORDER_RADIUS.full,
      alignSelf: 'flex-start',
    },
    connectBadgeConnected: {
      backgroundColor: 'rgba(16, 185, 129, 0.25)',
    },
    connectBadgeText: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
      color: '#fff',
    },
    connectBadgeTextConnected: {
      color: '#10B981',
    },

    // ── WebView Modal ─────────────────────────────────────────
    webViewContainer: {
      flex: 1,
    },
    webViewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.md,
    },
    webViewBack: {
      width: 24,
    },
    webViewTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.lg,
      color: '#FFFFFF',
    },

    // ── Success Overlay ───────────────────────────────────────
    successOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(7,8,11,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 999,
    },
    successContent: {
      alignItems: 'center',
    },
    successCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    successTitle: {
      ...FONTS.bold,
      fontSize: 24,
      color: '#FFFFFF',
      marginBottom: 4,
    },
    successSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.6)',
      textAlign: 'center',
      paddingHorizontal: 40,
    },

    // (Removed legacy Angel Options modal & SmartAPI TOTP form styles)
  });
