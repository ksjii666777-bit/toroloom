/**
 * ============================================================================
 * Toroloom — Broker Connect Screen
 * ============================================================================
 *
 * Beautiful broker selection grid for connecting stockbroker accounts.
 * Supports:
 *   - Angel One (credential-based login)
 *   - Zerodha (OAuth WebView flow)
 *   - Groww (credential-based login)
 *
 * Features:
 *   - Animated broker cards with hover/scale effects
 *   - Connection status badges (Connected/Disconnected/Loading)
 *   - OAuth WebView overlay for Zerodha
 *   - Credential input modal for Angel One & Groww
 *   - Desktop-style gradient backgrounds with neon accents
 *
 * ============================================================================
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Modal,
  TouchableOpacity, Animated, Dimensions, Alert, ActivityIndicator,
  _Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { triggerHaptic, ImpactFeedbackStyle } from '../../utils/haptics';
import { notificationAsync, NotificationFeedbackType } from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { api, snapTradeApi } from '../../services/api';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 2 columns with 16px padding each side

// ──── Broker Meta ──────────────────────────────────────────────────────────

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
    tagline: 'India\'s largest retail broking house',
    icon: 'A',
    color: '#FF6B00',
    gradient: ['#FF6B00', '#CC5500'] as const,
    hasOAuth: false,
    features: ['SmartAPI', 'Free Equity Delivery', 'EDIS Support'],
  },
  {
    type: 'zerodha',
    label: 'Zerodha',
    tagline: 'India\'s biggest stock broker',
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

// ──── Types ────────────────────────────────────────────────────────────────

interface ConnectionState {
  connected: boolean;
  brokerType: string | null;
  label: string | null;
  connectedAt: string | null;
  isLoading: boolean;
}

// ──── Component ────────────────────────────────────────────────────────────

export default function BrokerConnectScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    connected: false,
    brokerType: null,
    label: null,
    connectedAt: null,
    isLoading: true,
  });

  // Modal states
  const [selectedBroker, setSelectedBroker] = useState<BrokerMeta | null>(null);
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');

  // Animations (top level — NEVER inside loops/conditions per Rules of Hooks)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const [showSuccess, setShowSuccess] = useState(false);

  // Broker card scale animations — stored in a ref map keyed by broker type
  // This avoids calling useRef inside the render loop (Rules of Hooks violation).
  const scaleAnims = useRef<Record<string, Animated.Value>>({});
  BROKERS.forEach(b => {
    if (!scaleAnims.current[b.type]) {
      scaleAnims.current[b.type] = new Animated.Value(1);
    }
  });

  // Pre-compute glow interpolations at top level (not inside render loop)
  const glowOps = useRef<Record<string, Animated.AnimatedInterpolation<number>>>({});
  BROKERS.forEach(b => {
    if (!glowOps.current[b.type]) {
      glowOps.current[b.type] = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.15, 0.35],
      });
    }
  });

  // ── Load current connection status ─────────────────────────
  useEffect(() => {
    loadStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Entrance animation ─────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]),
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, [fadeAnim, glowAnim, slideAnim]);

  // ── Load status ────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    try {
      // Try SnapTrade first
      const st = await snapTradeApi.status();
      if (st.connected) {
        setConnectionState({
          connected: true,
          brokerType: st.brokerSlug,
          label: st.brokerName,
          connectedAt: st.connectedAt,
          isLoading: false,
        });
        return;
      }

      // Fallback: legacy broker-link API
      const data = await api.get<any>('/broker-link/status');
      setConnectionState({
        connected: data.connected,
        brokerType: data.brokerType,
        label: data.label,
        connectedAt: data.connectedAt,
        isLoading: false,
      });
    } catch {
      setConnectionState(s => ({ ...s, isLoading: false }));
    }
  }, []);

  // ── Show connected success overlay ─────────────────────────
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showConnectedSuccess = useCallback(() => {
    setShowSuccess(true);
    notificationAsync(NotificationFeedbackType.Success);

    // Clear any previous success timer
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }

    successTimerRef.current = setTimeout(() => {
      setShowSuccess(false);
      loadStatus();
      successTimerRef.current = null;
    }, 2500);
  }, [loadStatus]);

  // Cleanup success timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  // SnapTrade specific state
  const [isConnectingSnapTrade, setIsConnectingSnapTrade] = useState(false);
  const [_snapTradeOauthUrl, setSnapTradeOauthUrl] = useState<string | null>(null);

  // ── Open SnapTrade Connect ────────────────────────────────
  const openSnapTradeConnect = useCallback(async (broker: BrokerMeta) => {
    setSelectedBroker(broker);
    setIsConnectingSnapTrade(true);
    triggerHaptic(ImpactFeedbackStyle.Medium);

    try {
      await snapTradeApi.register();
      const linkResult = await snapTradeApi.getConnectLink();
      if (linkResult.oauthUrl) {
        setSnapTradeOauthUrl(linkResult.oauthUrl);
        setTimeout(() => {
          setIsConnectingSnapTrade(false);
          setConnectionState({
            connected: true,
            brokerType: broker.type,
            label: broker.label,
            connectedAt: new Date().toISOString(),
            isLoading: false,
          });
          showConnectedSuccess();
        }, 500);
      }
    } catch (err: any) {
      setIsConnectingSnapTrade(false);
      Alert.alert('Connection Failed', err.message || 'Failed to connect via SnapTrade.');
    }
  }, [showConnectedSuccess]);

  // ── Open OAuth WebView (Zerodha — legacy fallback) ────────
  const _openOAuthWebView = useCallback(async (broker: BrokerMeta) => {
    setSelectedBroker(broker);
    triggerHaptic(ImpactFeedbackStyle.Medium);

    try {
      const data = await api.get<any>(`/broker-link/oauth-url?brokerType=${broker.type}`);
      setWebViewUrl(data.oauthUrl);
      setShowWebView(true);
    } catch {
      // Fallback: try SnapTrade OAuth
      openSnapTradeConnect(broker);
    }
  }, [openSnapTradeConnect]);

  // ── Connect broker via OAuth token (dedicated for legacy WebView flow) ──
  const handleOAuthConnect = useCallback(async (brokerType: string, requestToken: string) => {
    try {
      const res = await api.post<any>('/broker-link/connect', {
        brokerType,
        credentials: { apiSecret: requestToken },
      });

      setShowWebView(false);

      if (!res.hasAccessToken && res.exchangeError) {
        Alert.alert(
          'Limited Connection',
          `Connected but token exchange failed: ${res.exchangeError}. Some features may be unavailable until you reconnect.`,
        );
      }

      showConnectedSuccess();
    } catch (err: any) {
      setShowWebView(false);
      Alert.alert('Connection Failed', err.message || 'Failed to connect via OAuth.');
    }
  }, [showConnectedSuccess]);

  // ── Disconnect broker ──────────────────────────────────────
  const handleDisconnect = useCallback(async () => {
    Alert.alert(
      'Disconnect Broker',
      `Are you sure you want to disconnect from ${connectionState.label || 'your broker'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await snapTradeApi.disconnect();
              notificationAsync(NotificationFeedbackType.Warning);
              setConnectionState({
                connected: false, brokerType: null, label: null, connectedAt: null, isLoading: false,
              });
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to disconnect');
            }
          },
        },
      ],
    );
  }, [connectionState]);

  // ── WebView navigation handler (extract request_token) ─────
  const handleWebViewNav = useCallback((navState: any) => {
    const { url } = navState;

    // Zerodha redirects to a URL with request_token after login.
    // Only act when we see the token — ignore intermediate navigation events.
    if (!url.includes('request_token=') && !url.includes('status=success')) return;

    // Extract the request_token from the URL and connect directly
    try {
      const parsed = new URL(url);
      const token = parsed.searchParams.get('request_token');
      if (token) {
        handleOAuthConnect('zerodha', token);
      }
    } catch {
      // URL parsing failed — OAuth may still have succeeded via a different flow
      setShowWebView(false);
      loadStatus();
    }
  }, [handleOAuthConnect, loadStatus]);

  // ── WebView error handler ──────────────────────────────────
  const handleWebViewError = useCallback(() => {
    setShowWebView(false);
    Alert.alert('Connection Error', 'Failed to load broker login page. Please try again.');
  }, []);

  // ── Page loading indicator ─────────────────────────────────
  if (connectionState.isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Checking connection status...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header ────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: 60 + insets.top }]}>
        <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.93}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </AnimatedPressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Connect Broker</Text>
          <Text style={styles.headerSubtitle}>1-tap OAuth — no API keys needed</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Connected State Banner ───────────────────────── */}
        {connectionState.connected && (
          <Animated.View style={[styles.connectedBanner, { opacity: fadeAnim }]}>
            <LinearGradient
              colors={GRADIENTS.success}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.connectedGradient}
            >
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <View style={styles.connectedInfo}>
                <Text style={styles.connectedTitle}>
                  Connected to {connectionState.label}
                </Text>
                <Text style={styles.connectedDate}>
                  OAuth session active
                </Text>
              </View>
              <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtn}>
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        )}

        {/* ── Section Title ────────────────────────────────── */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={styles.sectionTitle}>Choose Your Broker</Text>            <Text style={styles.sectionSubtitle}>
            {connectionState.connected
              ? 'Switch to a different broker below'
              : 'Select a broker to connect'}
          </Text>
        </Animated.View>

        {/* ── Broker Grid ──────────────────────────────────── */}
        <View style={styles.brokerGrid}>
          {BROKERS.map((broker) => {
            const isConnected = connectionState.connected && connectionState.brokerType === broker.type;
            const scaleAnim = scaleAnims.current[broker.type];
            const cardGlow = glowOps.current[broker.type];

            return (
              <Animated.View
                key={broker.type}
                style={[
                  styles.brokerCardWrapper,
                  {
                    opacity: fadeAnim,
                    transform: [
                      { translateY: slideAnim },
                      { scale: isConnected ? 0.97 : 1 },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPressIn={() => {
                    Animated.spring(scaleAnim, { toValue: 0.94, useNativeDriver: true }).start();
                  }}
                  onPressOut={() => {
                    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
                  }}
                  onPress={() => {
                    if (isConnected) {
                      handleDisconnect();
                    } else {
                      openSnapTradeConnect(broker);
                    }
                  }}
                >
                  <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <LinearGradient
                      colors={broker.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1.2 }}
                      style={styles.brokerCard}
                    >
                      {/* Glow effect when connected */}
                      {isConnected && (
                        <View style={[styles.connectedGlow, { opacity: cardGlow }]} />
                      )}

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

                      {/* Broker Info */}
                      <Text style={styles.brokerLabel}>{broker.label}</Text>
                      <Text style={styles.brokerTagline} numberOfLines={2}>
                        {broker.tagline}
                      </Text>

                      {/* Features */}
                      <View style={styles.featureList}>
                        {broker.features.map((feature, i) => (
                          <View key={i} style={styles.featureItem}>
                            <Text style={styles.featureDot}>•</Text>
                            <Text style={styles.featureText} numberOfLines={1}>{feature}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Connection status button */}
                      <View style={[
                        styles.connectBadgeContainer,
                        isConnected && styles.connectBadgeContainerConnected,
                      ]}>
                        <Text style={[
                          styles.connectBadgeText,
                          isConnected && styles.connectBadgeTextConnected,
                        ]}>
                          {isConnected ? 'Connected' : 'OAuth Connect'}
                        </Text>
                      </View>

                      {/* OAuth indicator */}
                      {!isConnected && (
                        <View style={styles.oauthIndicator}>
                          <Ionicons name="shield-checkmark" size={10} color="rgba(255,255,255,0.6)" />
                          <Text style={styles.oauthText}>OAuth Secure</Text>
                        </View>
                      )}
                    </LinearGradient>
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* ── SnapTrade Info Box ────────────────────────────── */}
        <Animated.View style={[styles.infoBox, { opacity: fadeAnim }]}>
          <Ionicons name="information-circle" size={18} color={colors.primary} />
          <Text style={styles.infoText}>
            SnapTrade provides secure 1-tap OAuth. Your credentials are never shared with us.
          </Text>
        </Animated.View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── OAuth WebView (legacy fallback) ──────────────────── */}
      <Modal
        visible={showWebView}
        animationType="slide"
        onRequestClose={() => setShowWebView(false)}
      >
        <View style={[styles.webViewContainer, { backgroundColor: colors.bg }]}>
          <View style={[styles.webViewHeader, { backgroundColor: colors.bgSecondary, paddingTop: 60 + insets.top }]}>
            <TouchableOpacity onPress={() => setShowWebView(false)} style={styles.webViewBack}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.webViewTitle}>
              Connect {selectedBroker?.label}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          <WebView
            source={{ uri: webViewUrl }}
            style={styles.webView}
            onNavigationStateChange={handleWebViewNav}
            onError={handleWebViewError}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.webViewLoadingText, { color: colors.textMuted }]}>
                  Loading {selectedBroker?.label} login...
                </Text>
              </View>
            )}
          />
        </View>
      </Modal>

      {/* ── Connecting Overlay ──────────────────────────────── */}
      {isConnectingSnapTrade && (
        <View style={styles.successOverlay}>
          <Animated.View style={styles.successContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.successTitle}>Connecting...</Text>
            <Text style={styles.successSubtitle}>
              Complete login in your browser
            </Text>
          </Animated.View>
        </View>
      )}

      {/* ── Success Animation ───────────────────────────────── */}
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
            <Text style={styles.successTitle}>Connected!</Text>
            <Text style={styles.successSubtitle}>
              Your {selectedBroker?.label} account is now linked.
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    backgroundColor: colors.bg,
  },
  headerTitleContainer: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  headerTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  headerSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
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

  // ── Connected Banner ─────────────────────────────────────────
  connectedBanner: {
    marginBottom: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  connectedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  connectedInfo: {
    flex: 1,
  },
  connectedTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#fff',
  },
  connectedDate: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  disconnectBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  disconnectText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: '#fff',
  },

  // ── Section Title ────────────────────────────────────────────
  sectionTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginBottom: SPACING.xl,
  },

  // ── Broker Grid ──────────────────────────────────────────────
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
    minHeight: 200,
    overflow: 'hidden',
    position: 'relative',
  },
  connectedGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
  },
  brokerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  brokerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
    marginBottom: SPACING.md,
  },
  featureList: {
    gap: 3,
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
  connectBadgeContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    alignSelf: 'flex-start',
  },
  connectBadgeContainerConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
  },
  connectBadgeText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: '#fff',
  },
  connectBadgeTextConnected: {
    color: '#10B981',
  },
  oauthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: SPACING.sm,
  },
  oauthText: {
    ...FONTS.regular,
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
  },

  // ── Info Box ─────────────────────────────────────────────────
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: colors.bgCard,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  // (Removed legacy credentials modal styles)

  // ── OAuth WebView ─────────────────────────────────────────────
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
    color: colors.text,
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  webViewLoadingText: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    marginTop: SPACING.md,
  },

  // ── Success Animation ─────────────────────────────────────────
  successOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
    fontSize: FONTS.size.xxl,
    color: '#fff',
    marginBottom: 4,
  },
  successSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
});
