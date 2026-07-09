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
  View, Text, StyleSheet, ScrollView, TextInput, Modal,
  TouchableOpacity, Animated, Dimensions, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { triggerHaptic, ImpactFeedbackStyle } from '../../utils/haptics';
import { notificationAsync, NotificationFeedbackType } from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
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
    hasOAuth: false,
    features: ['Trade API', 'Zero Commission', 'Mutual Funds'],
  },
];

// ──── Types ────────────────────────────────────────────────────────────────

interface BrokerCredentials {
  apiKey: string;
  apiSecret?: string;
  accessToken?: string;
  clientId?: string;
  password?: string;
  totp?: string;
}

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
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');

  // Credential form
  const [credentials, setCredentials] = useState<BrokerCredentials>({
    apiKey: '', apiSecret: '', accessToken: '', clientId: '', password: '', totp: '',
  });

  // Focus state for TextInputs
  const [focusedField, setFocusedField] = useState<string | null>(null);

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
  }, []);

  // ── Load status ────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    try {
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

  // ── Open credential modal ──────────────────────────────────
  const openCredentialsModal = useCallback((broker: BrokerMeta) => {
    setSelectedBroker(broker);
    setCredentials({ apiKey: '', apiSecret: '', accessToken: '', clientId: '', password: '', totp: '' });
    setShowCredentialsModal(true);
    triggerHaptic(ImpactFeedbackStyle.Medium);
  }, []);

  // ── Open OAuth WebView (Zerodha) ───────────────────────────
  const openOAuthWebView = useCallback(async (broker: BrokerMeta) => {
    setSelectedBroker(broker);
    triggerHaptic(ImpactFeedbackStyle.Medium);

    try {
      const data = await api.get<any>(`/broker-link/oauth-url?brokerType=${broker.type}`);
      setWebViewUrl(data.oauthUrl);
      setShowWebView(true);
    } catch {
      // Fallback: show credential modal if OAuth URL not available
      Alert.alert(
        'OAuth Unavailable',
        'OAuth URL not configured. You can connect manually by entering your credentials.',
        [{ text: 'Enter Credentials', onPress: () => openCredentialsModal(broker) },
         { text: 'Cancel', style: 'cancel' }],
      );
    }
  }, [openCredentialsModal]);

  // ── Connect broker with credentials ────────────────────────
  const handleConnect = useCallback(async () => {
    if (!selectedBroker) return;

    try {
      const payload: { brokerType: string; credentials: BrokerCredentials } = { brokerType: selectedBroker.type, credentials };

      // Only send relevant fields for this broker type
      if (selectedBroker.type === 'zerodha') {
        payload.credentials = { apiKey: credentials.apiKey, apiSecret: credentials.apiSecret };
      } else if (selectedBroker.type === 'angel') {
        payload.credentials = {
          apiKey: credentials.apiKey,
          clientId: credentials.clientId,
          password: credentials.password,
          totp: credentials.totp,
        };
      } else if (selectedBroker.type === 'groww') {
        payload.credentials = { apiKey: credentials.apiKey, accessToken: credentials.accessToken };
      }

      await api.post('/broker-link/connect', payload);
      setShowCredentialsModal(false);
      showConnectedSuccess();
    } catch (err: any) {
      Alert.alert('Connection Failed', err.message || 'Failed to connect broker. Please try again.');
    }
  }, [selectedBroker, credentials, showConnectedSuccess]);

  // ── Connect broker via OAuth token (dedicated for WebView flow) ──
  const handleOAuthConnect = useCallback(async (brokerType: string, requestToken: string) => {
    try {
      const res = await api.post<any>('/broker-link/connect', {
        brokerType,
        credentials: { apiSecret: requestToken },
      });

      setShowWebView(false);

      // If token exchange failed, warn the user; otherwise show standard success
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
              await api.post('/broker-link/disconnect');
              notificationAsync(NotificationFeedbackType.Warning);
              loadStatus();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to disconnect');
            }
          },
        },
      ],
    );
  }, [connectionState, loadStatus]);

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
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading broker status...</Text>
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
          <Text style={styles.headerSubtitle}>Link your trading account to start trading</Text>
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
                {connectionState.connectedAt && (
                  <Text style={styles.connectedDate}>
                    Since {new Date(connectionState.connectedAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtn}>
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        )}

        {/* ── Section Title ────────────────────────────────── */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={styles.sectionTitle}>Choose Your Broker</Text>
          <Text style={styles.sectionSubtitle}>
            {connectionState.connected
              ? 'Switch to a different broker below'
              : 'Select a broker to connect your trading account'}
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
                    } else if (broker.hasOAuth) {
                      openOAuthWebView(broker);
                    } else {
                      openCredentialsModal(broker);
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
                          {isConnected ? 'Connected' : broker.hasOAuth ? 'Connect via OAuth' : 'Connect'}
                        </Text>
                      </View>

                      {/* OAuth indicator */}
                      {broker.hasOAuth && !isConnected && (
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

        {/* ── Info Box ──────────────────────────────────────── */}
        <Animated.View style={[styles.infoBox, { opacity: fadeAnim }]}>
          <Ionicons name="information-circle" size={18} color={colors.primary} />
          <Text style={styles.infoText}>
            Your credentials are encrypted and securely stored. We never share your broker login details with third parties.
          </Text>
        </Animated.View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Credentials Modal ──────────────────────────────── */}
      <Modal
        visible={showCredentialsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCredentialsModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: '#07080B' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconCircle, { backgroundColor: selectedBroker?.color + '20' }]}>
                <Text style={[styles.modalIconText, { color: selectedBroker?.color }]}>
                  {selectedBroker?.icon}
                </Text>
              </View>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>Connect {selectedBroker?.label}</Text>
                <Text style={styles.modalSubtitle}>Enter your API credentials</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCredentialsModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              {/* API Key (all brokers) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>API Key</Text>                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.bgInput,
                        color: colors.text,
                        borderColor: focusedField === 'apiKey' ? '#00D2FF' : colors.border,
                      },
                    ]}
                    placeholder="Enter your API key"
                    placeholderTextColor={colors.textMuted}
                    value={credentials.apiKey}
                    onChangeText={t => setCredentials(p => ({ ...p, apiKey: t }))}
                    onFocus={() => setFocusedField('apiKey')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
              </View>

              {/* API Secret (Zerodha only) */}
              {selectedBroker?.type === 'zerodha' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>API Secret</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.bgInput,
                        color: colors.text,
                        borderColor: focusedField === 'apiSecret' ? '#00D2FF' : colors.border,
                      },
                    ]}
                    placeholder="Enter your API secret"
                    placeholderTextColor={colors.textMuted}
                    value={credentials.apiSecret}
                    onChangeText={t => setCredentials(p => ({ ...p, apiSecret: t }))}
                    onFocus={() => setFocusedField('apiSecret')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    {...({ id: 'broker-api-secret', name: 'apiSecret' } as { id: string; name: string })}
                  />
                </View>
              )}

              {/* Client ID (Angel One only) */}
              {selectedBroker?.type === 'angel' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Client ID</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.bgInput,
                          color: colors.text,
                          borderColor: focusedField === 'clientId' ? '#00D2FF' : colors.border,
                        },
                      ]}
                      placeholder="Enter your Angel One Client ID"
                      placeholderTextColor={colors.textMuted}
                      value={credentials.clientId}
                      onChangeText={t => setCredentials(p => ({ ...p, clientId: t }))}
                      onFocus={() => setFocusedField('clientId')}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.bgInput,
                          color: colors.text,
                          borderColor: focusedField === 'password' ? '#00D2FF' : colors.border,
                        },
                      ]}
                      placeholder="Trading password"
                      placeholderTextColor={colors.textMuted}
                      value={credentials.password}
                      onChangeText={t => setCredentials(p => ({ ...p, password: t }))}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                      {...({ id: 'broker-password', name: 'password' } as { id: string; name: string })}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>TOTP Secret (optional)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.bgInput,
                          color: colors.text,
                          borderColor: focusedField === 'totp' ? '#00D2FF' : colors.border,
                        },
                      ]}
                      placeholder="2FA TOTP secret for auto-login"
                      placeholderTextColor={colors.textMuted}
                      value={credentials.totp}
                      onChangeText={t => setCredentials(p => ({ ...p, totp: t }))}
                      onFocus={() => setFocusedField('totp')}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </>
              )}

              {/* Access Token (Groww only) */}
              {selectedBroker?.type === 'groww' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Access Token</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.bgInput,
                        color: colors.text,
                        borderColor: focusedField === 'accessToken' ? '#00D2FF' : colors.border,
                      },
                    ]}
                    placeholder="Enter your Groww access token"
                    placeholderTextColor={colors.textMuted}
                    value={credentials.accessToken}
                    onChangeText={t => setCredentials(p => ({ ...p, accessToken: t }))}
                    onFocus={() => setFocusedField('accessToken')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    {...({ id: 'broker-access-token', name: 'accessToken' } as { id: string; name: string })}
                  />
                </View>
              )}

              {/* Connect Button */}
              <TouchableOpacity
                onPress={handleConnect}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#F59E0B', '#3B82F6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.connectButton}
                >
                  <Text style={styles.connectButtonText}>
                    Connect to {selectedBroker?.label}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── OAuth WebView ───────────────────────────────────── */}
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

  // ── Credentials Modal ─────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  connectButton: {
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  modalIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalIconText: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
  },
  modalHeaderText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  modalTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  modalSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalForm: {
    maxHeight: 400,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginBottom: SPACING.sm,
  },
  input: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  connectButtonText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#fff',
  },

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
