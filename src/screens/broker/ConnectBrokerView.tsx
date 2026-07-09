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
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { triggerHaptic, ImpactFeedbackStyle } from '../../utils/haptics';
import { notificationAsync, NotificationFeedbackType } from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import SecureSessionSync from '../../components/gateway/SecureSessionSync';
import { clearBrokerSession, hasValidSession } from '../../services/gateway/sessionStorage';
import { brokerProxyApi, angelConnectApi } from '../../services/api';
import type { SessionPayload } from '../../types';

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
    hasOAuth: false,
    features: ['Trade API', 'Zero Commission', 'Mutual Funds'],
  },
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function ConnectBrokerView({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Connection state
  const [connectedBroker, setConnectedBroker] = useState<string | null>(null);
  const [connectedLabel, setConnectedLabel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTestingProxy, setIsTestingProxy] = useState(false);

  // Modal states
  const [selectedBroker, setSelectedBroker] = useState<BrokerMeta | null>(null);
  const [showSessionSync, setShowSessionSync] = useState(false);
  const [sessionSyncUrl, setSessionSyncUrl] = useState('');

  // Angel One SmartAPI states
  const [showAngelOptions, setShowAngelOptions] = useState(false);
  const [showSmartApiForm, setShowSmartApiForm] = useState(false);
  const [smartApiClientId, setSmartApiClientId] = useState('');
  const [smartApiPassword, setSmartApiPassword] = useState('');
  const [smartApiTotp, setSmartApiTotp] = useState('');
  const [isConnectingSmartApi, setIsConnectingSmartApi] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [showSuccess, setShowSuccess] = useState(false);

  // Check existing sessions on mount
  useEffect(() => {
    checkExistingSessions();
  }, []);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const checkExistingSessions = async () => {
    try {
      const brokers = ['zerodha', 'angel', 'groww'];
      for (const b of brokers) {
        const valid = await hasValidSession(b);
        if (valid) {
          setConnectedBroker(b);
          setConnectedLabel(BROKERS.find((br) => br.type === b)?.label || b);
          break;
        }
      }
    } catch {
      // Session storage unavailable — gracefully fall through to disconnected state
    } finally {
      setIsLoading(false);
    }
  };

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

  // ── Open Session Sync (Zero-API Gateway) ────────────────────
  const openSessionSync = useCallback(
    (broker: BrokerMeta) => {
      setSelectedBroker(broker);
      triggerHaptic(ImpactFeedbackStyle.Medium);

      // Map broker to their production login URL for session extraction
      const loginUrls: Record<string, string> = {
        zerodha: 'https://kite.zerodha.com/',
        angel: 'https://smartapi.angelbroking.com/',
        groww: 'https://groww.in/login',
      };

      const url = loginUrls[broker.type];
      if (url) {
        setSessionSyncUrl(url);
        // Small delay so the state updates before SecureSessionSync mounts
        setTimeout(() => setShowSessionSync(true), 100);
      } else {
        Alert.alert('Unavailable', `${broker.label} connection is not yet available via Zero-API Gateway.`);
      }
    },
    [],
  );

  // ── Open Broker Selection ───────────────────────────────────
  const openBrokerSelection = useCallback(
    (broker: BrokerMeta) => {
      setSelectedBroker(broker);
      triggerHaptic(ImpactFeedbackStyle.Medium);

      // Angel One has TWO connection methods: SmartAPI (official) + Zero-API
      if (broker.type === 'angel') {
        setShowAngelOptions(true);
      } else {
        // Other brokers: direct Zero-API sync
        openSessionSync(broker);
      }
    },
    [openSessionSync],
  );

  // ── Angel One SmartAPI Connect ──────────────────────────────
  const handleSmartApiConnect = useCallback(async () => {
    if (!smartApiClientId.trim() || !smartApiPassword.trim() || !smartApiTotp.trim()) {
      Alert.alert('Required Fields', 'Please fill in all fields: Client ID, Password, and TOTP Secret.');
      return;
    }

    setIsConnectingSmartApi(true);

    try {
      const result = await angelConnectApi.connect(
        smartApiClientId.trim(),
        smartApiPassword,
        smartApiTotp.trim(),
      );

      if (result.success) {
        setShowSmartApiForm(false);
        setConnectedBroker('angel');
        setConnectedLabel('Angel One (SmartAPI)');
        showConnectedSuccess();
      }
    } catch (err: any) {
      Alert.alert('Connection Failed', err.message || 'Failed to connect Angel One. Check your credentials.');
    } finally {
      setIsConnectingSmartApi(false);
    }
  }, [smartApiClientId, smartApiPassword, smartApiTotp, showConnectedSuccess]);

  // ── Check Angel SmartAPI Status on mount ────────────────────
  useEffect(() => {
    (async () => {
      try {
        const status = await angelConnectApi.status();
        if (status.connected) {
          setConnectedBroker('angel');
          setConnectedLabel('Angel One (SmartAPI)');
        }
      } catch {
        // Not connected — fine
      }
    })();
  }, []);

  // ── Handle Session Captured ─────────────────────────────────
  const handleSessionCaptured = useCallback(
    async (payload: SessionPayload) => {
      setShowSessionSync(false);

      // Session captured via SecureSessionSync — Zero-API Gateway
      setConnectedBroker(payload.brokerType);
      setConnectedLabel(
        BROKERS.find((b) => b.type === payload.brokerType)?.label || null,
      );
      showConnectedSuccess();
    },
    [showConnectedSuccess],
  );

  // ── Test API Request ───────────────────────────────────────
  const handleTestApi = useCallback(async () => {
    if (!connectedBroker) return;

    setIsTestingProxy(true);

    try {
      let result;

      // SmartAPI connection: use angelConnectApi directly
      // Zero-API connection: use brokerProxyApi through backend
      if (connectedBroker === 'angel' && connectedLabel?.includes('SmartAPI')) {
        const r = await angelConnectApi.holdings();
        result = { success: r.success, data: r.data, error: undefined, statusCode: 200 };
      } else {
        result = await brokerProxyApi.getHoldings(connectedBroker);
      }

      const title = result.success ? '✅ API Success' : '❌ API Failed';
      const body = [
        `Broker: ${connectedBroker.toUpperCase()}`,
        result.success
          ? `Data: ${JSON.stringify(result.data, null, 2).slice(0, 800)}`
          : `Error: ${result.error}`,
      ].join('\n');

      Alert.alert(title, body);
    } catch (err: any) {
      Alert.alert('❌ API Error', err.message || 'Unexpected error during API request.');
    } finally {
      setIsTestingProxy(false);
    }
  }, [connectedBroker, connectedLabel]);

  // ── Disconnect ──────────────────────────────────────────────
  const handleDisconnect = useCallback(
    async (brokerType: string) => {
      const isSmartApi = connectedLabel?.includes('SmartAPI');

      Alert.alert(
        'Disconnect Broker',
        'Are you sure you want to disconnect? Your session data will be removed.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: async () => {
              // SmartAPI: disconnect via backend
              if (isSmartApi) {
                try { await angelConnectApi.disconnect(); } catch { /* ignore */ }
              }
              // Zero-API: clear keychain session
              await clearBrokerSession(brokerType);
              setConnectedBroker(null);
              setConnectedLabel(null);
              notificationAsync(NotificationFeedbackType.Warning);
            },
          },
        ],
      );
    },
    [connectedLabel],
  );

  // ── Loading State ───────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={NEON_CYAN} />
        <Text style={[styles.loadingText, { color: 'rgba(255,255,255,0.5)' }]}>
          Restoring secure session...
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
          <Text style={styles.headerTitle}>Connect Broker</Text>
          <Text style={styles.headerSubtitle}>
            Zero-API gateway — no API keys required
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Premium Status Pills */}
        <Animated.View style={[styles.statusPillsRow, { opacity: fadeAnim }]}>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillIcon}>✓</Text>
            <Text style={styles.statusPillText}>ZERO-API SYNC</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillIcon}>★</Text>
            <Text style={styles.statusPillText}>100% FREE</Text>
          </View>
          <View style={[styles.statusPill, styles.statusPillOutline]}>
            <Ionicons name="shield-checkmark" size={10} color="#00F2FE" />
            <Text style={[styles.statusPillText, { color: '#00F2FE' }]}>ENCRYPTED</Text>
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
                  <Text style={styles.glassCardTitle}>Connected</Text>
                  <Text style={styles.glassCardSubtitle}>
                    {connectedLabel} · Secure Session Active
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
                        Test API
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDisconnect(connectedBroker)} style={styles.glassBtn}>
                    <Text style={styles.glassBtnText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Section Title */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={styles.sectionTitle}>Choose Your Broker</Text>
          <Text style={styles.sectionSubtitle}>
            {connectedBroker
              ? 'Switch to a different broker below'
              : 'Select a broker — no API keys needed'}
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
                        {isConnected ? 'Session Active' : 'Zero-API Sync'}
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
                        {isConnected ? 'Connected' : 'Sync Now'}
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
                <Text style={styles.glassCardTitle}>Zero-API Hybrid Gateway</Text>
                <Text style={styles.glassCardSubtitle}>
                  Your credentials are extracted via secure browser session, encrypted with
                  hardware-backed keychain storage, and never shared with third parties.
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Angel One Selection Modal ───────────────────────── */}
      <Modal
        visible={showAngelOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAngelOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.angelOptionsContainer}>
            <Text style={styles.angelOptionsTitle}>Connect Angel One</Text>
            <Text style={styles.angelOptionsSubtitle}>Choose your connection method</Text>

            {/* SmartAPI Option */}
            <TouchableOpacity
              style={[styles.angelOptionCard, { backgroundColor: 'rgba(255,107,0,0.1)', borderColor: 'rgba(255,107,0,0.3)' }]}
              onPress={() => {
                setShowAngelOptions(false);
                setShowSmartApiForm(true);
              }}
            >
              <View style={styles.angelOptionRow}>
                <View style={[styles.angelOptionIcon, { backgroundColor: 'rgba(255,107,0,0.2)' }]}>
                  <Ionicons name="code-slash" size={22} color="#FF6B00" />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.angelOptionTitle}>SmartAPI (Official)</Text>
                  <Text style={styles.angelOptionDesc}>
                    Use official Angel One SmartAPI. Most reliable — real holdings, positions & trades.
                  </Text>
                </View>
              </View>
              <View style={styles.angelOptionBadgeRow}>
                <View style={[styles.angelOptionBadge, { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
                  <Text style={[styles.angelOptionBadgeText, { color: '#10B981' }]}>✅ Most Reliable</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Zero-API Option */}
            <TouchableOpacity
              style={[styles.angelOptionCard, { backgroundColor: 'rgba(0,242,254,0.06)', borderColor: 'rgba(0,242,254,0.2)' }]}
              onPress={() => {
                setShowAngelOptions(false);
                if (selectedBroker) openSessionSync(selectedBroker);
              }}
            >
              <View style={styles.angelOptionRow}>
                <View style={[styles.angelOptionIcon, { backgroundColor: 'rgba(0,242,254,0.12)' }]}>
                  <Ionicons name="wifi" size={22} color="#00F2FE" />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.angelOptionTitle}>Zero-API Sync</Text>
                  <Text style={styles.angelOptionDesc}>
                    No credentials needed. Login via WebView — session auto-extracted.
                  </Text>
                </View>
              </View>
              <View style={styles.angelOptionBadgeRow}>
                <View style={[styles.angelOptionBadge, { backgroundColor: 'rgba(0,242,254,0.12)' }]}>
                  <Text style={[styles.angelOptionBadgeText, { color: '#00F2FE' }]}>🔒 No Credentials</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowAngelOptions(false)}
              style={styles.angelOptionCancel}
            >
              <Text style={styles.angelOptionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Angel One SmartAPI Credential Form Modal ──────────── */}
      <Modal
        visible={showSmartApiForm}
        animationType="slide"
        onRequestClose={() => setShowSmartApiForm(false)}
      >
        <View style={[styles.webViewContainer, { backgroundColor: MIDNIGHT_BG }]}>
          <View
            style={[
              styles.webViewHeader,
              {
                backgroundColor: MIDNIGHT_BG,
                paddingTop: 60 + insets.top,
                borderBottomWidth: 1,
                borderBottomColor: GLASS_BORDER,
              },
            ]}
          >
            <TouchableOpacity onPress={() => setShowSmartApiForm(false)} style={styles.webViewBack}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.webViewTitle}>Angel One SmartAPI</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={styles.smartApiFormContent}>
            <View style={styles.smartApiFormHeader}>
              <View style={[styles.smartApiIconCircle, { backgroundColor: 'rgba(255,107,0,0.15)' }]}>
                <Ionicons name="code-slash" size={32} color="#FF6B00" />
              </View>
              <Text style={styles.smartApiFormTitle}>Connect Angel One</Text>
              <Text style={styles.smartApiFormSubtitle}>
                Enter your Angel One SmartAPI credentials. These are sent securely to our server
                and used only to fetch your portfolio data.
              </Text>
            </View>

            {/* Client ID */}
            <View style={styles.smartApiFieldGroup}>
              <Text style={styles.smartApiFieldLabel}>Client ID</Text>
              <View style={[styles.smartApiInputContainer, smartApiClientId ? styles.smartApiInputFocused : null]}>
                <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.smartApiInput}
                  placeholder="Your Angel One client code"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={smartApiClientId}
                  onChangeText={setSmartApiClientId}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.smartApiFieldGroup}>
              <Text style={styles.smartApiFieldLabel}>Password</Text>
              <View style={[styles.smartApiInputContainer, smartApiPassword ? styles.smartApiInputFocused : null]}>
                <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.smartApiInput}
                  placeholder="Your Angel One trading password"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={smartApiPassword}
                  onChangeText={setSmartApiPassword}
                  secureTextEntry
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* TOTP Secret */}
            <View style={styles.smartApiFieldGroup}>
              <Text style={styles.smartApiFieldLabel}>TOTP Secret</Text>
              <View style={[styles.smartApiInputContainer, smartApiTotp ? styles.smartApiInputFocused : null]}>
                <Ionicons name="key-outline" size={18} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.smartApiInput}
                  placeholder="Base32 secret from SmartAPI portal"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={smartApiTotp}
                  onChangeText={setSmartApiTotp}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
              <Text style={styles.smartApiFieldHint}>
                Get this from smartapi.angelbroking.com → My Profile → TOTP Secret
              </Text>
            </View>

            {/* Connect Button */}
            <TouchableOpacity
              style={[
                styles.smartApiConnectBtn,
                isConnectingSmartApi && { opacity: 0.7 },
              ]}
              onPress={handleSmartApiConnect}
              disabled={isConnectingSmartApi}
            >
              <LinearGradient
                colors={['#FF6B00', '#CC5500']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.smartApiConnectGradient}
              >
                {isConnectingSmartApi ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.smartApiConnectText}>Connect to Angel One</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Info Card */}
            <View style={styles.smartApiInfoCard}>
              <Ionicons name="information-circle-outline" size={18} color="rgba(255,255,255,0.4)" />
              <Text style={styles.smartApiInfoText}>
                Your credentials are used only to authenticate with Angel One SmartAPI and are
                never stored permanently. Session expires after 30 minutes of inactivity.
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Session Sync WebView Modal ──────────────────────── */}
      <Modal
        visible={showSessionSync}
        animationType="slide"
        onRequestClose={() => setShowSessionSync(false)}
      >
        <View style={[styles.webViewContainer, { backgroundColor: MIDNIGHT_BG }]}>
          <View
            style={[
              styles.webViewHeader,
              {
                backgroundColor: MIDNIGHT_BG,
                paddingTop: 60 + insets.top,
                borderBottomWidth: 1,
                borderBottomColor: GLASS_BORDER,
              },
            ]}
          >
            <TouchableOpacity onPress={() => setShowSessionSync(false)} style={styles.webViewBack}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.webViewTitle}>Connect {selectedBroker?.label}</Text>
            <TouchableOpacity onPress={() => setShowSessionSync(false)}>
              <Text style={{ color: '#00F2FE', fontSize: 13, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {sessionSyncUrl.length > 0 && (
            <SecureSessionSync
              sourceUrl={sessionSyncUrl}
              brokerType={selectedBroker?.type || 'unknown'}
              onSessionCaptured={handleSessionCaptured}
              onError={(error) => {
                setShowSessionSync(false);
                Alert.alert('Session Sync Failed', error);
              }}
              onClose={() => setShowSessionSync(false)}
            />
          )}
        </View>
      </Modal>

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
            <Text style={styles.successTitle}>Connected!</Text>
            <Text style={styles.successSubtitle}>
              Your {connectedLabel} session is now securely stored.
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

    // ── Angel Options Modal ────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(7,8,11,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACING.xl,
    },
    angelOptionsContainer: {
      width: '100%',
      backgroundColor: '#0D0E12',
      borderRadius: BORDER_RADIUS.xl,
      borderWidth: 1,
      borderColor: GLASS_BORDER,
      padding: SPACING.xl,
      maxWidth: 400,
    },
    angelOptionsTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.xl,
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 4,
    },
    angelOptionsSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.5)',
      textAlign: 'center',
      marginBottom: SPACING.xl,
    },
    angelOptionCard: {
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    angelOptionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    angelOptionIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    angelOptionTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: '#FFFFFF',
      marginBottom: 2,
    },
    angelOptionDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.5)',
      lineHeight: 16,
    },
    angelOptionBadgeRow: {
      flexDirection: 'row',
      marginTop: SPACING.sm,
      marginLeft: 52,
    },
    angelOptionBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: BORDER_RADIUS.full,
    },
    angelOptionBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    angelOptionCancel: {
      alignItems: 'center',
      marginTop: SPACING.sm,
      paddingVertical: SPACING.sm,
    },
    angelOptionCancelText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.4)',
    },

    // ── SmartAPI Form ──────────────────────────────────────────
    smartApiFormContent: {
      padding: SPACING.xl,
      paddingBottom: 60,
    },
    smartApiFormHeader: {
      alignItems: 'center',
      marginBottom: SPACING.xl,
      marginTop: SPACING.lg,
    },
    smartApiIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    smartApiFormTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.xl,
      color: '#FFFFFF',
      marginBottom: 4,
    },
    smartApiFormSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.5)',
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: SPACING.md,
    },
    smartApiFieldGroup: {
      marginBottom: SPACING.lg,
    },
    smartApiFieldLabel: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.7)',
      marginBottom: SPACING.xs,
    },
    smartApiInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: GLASS_WHITE,
      borderWidth: 1,
      borderColor: GLASS_BORDER,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md,
      height: 48,
    },
    smartApiInputFocused: {
      borderColor: '#FF6B00',
      borderWidth: 1.5,
    },
    smartApiInput: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: FONTS.size.md,
      height: 48,
    },
    smartApiFieldHint: {
      ...FONTS.regular,
      fontSize: 10,
      color: 'rgba(255,255,255,0.3)',
      marginTop: 4,
      paddingLeft: 2,
    },
    smartApiConnectBtn: {
      borderRadius: BORDER_RADIUS.lg,
      overflow: 'hidden',
      marginTop: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    smartApiConnectGradient: {
      paddingVertical: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    smartApiConnectText: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
      color: '#FFFFFF',
    },
    smartApiInfoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: GLASS_WHITE,
      borderWidth: 1,
      borderColor: GLASS_BORDER,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
    },
    smartApiInfoText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.4)',
      flex: 1,
      lineHeight: 15,
    },
  });
