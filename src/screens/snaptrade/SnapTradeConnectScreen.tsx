/**
 * ============================================================================
 * Toroloom — SnapTrade Connect Screen
 * ============================================================================
 *
 * Allows users to connect US brokerages via SnapTrade OAuth:
 *   - Check connection status (connected/disconnected)
 *   - Initiate SnapTrade OAuth flow (WebView redirect)
 *   - Show connected broker info with disconnect option
 *   - Navigate to portfolio/order screens once connected
 *
 * Navigation: More → SnapTrade → Connect
 * ============================================================================
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  Dimensions, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { snapTradeApi } from '../../services/api';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import _Button from '../../components/ui/Button';

const { width } = Dimensions.get('window');

type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

// Supported US brokerages via SnapTrade
const SUPPORTED_BROKERS = [
  { id: 'alpaca', name: 'Alpaca', icon: 'A', color: '#3B82F6', desc: 'Commission-free US stock trading API' },
  { id: 'tdameritrade', name: 'TD Ameritrade', icon: 'T', color: '#00A86B', desc: 'Full-featured US brokerage' },
  { id: 'etrade', name: 'E*TRADE', icon: 'E', color: '#8B5CF6', desc: 'Powerful US trading platform' },
  { id: 'robinhood', name: 'Robinhood', icon: 'R', color: '#00C853', desc: 'Simple mobile-first investing' },
  { id: 'interactive', name: 'Interactive Brokers', icon: 'I', color: '#FF6B35', desc: 'Global institutional-grade trading' },
  { id: 'schwab', name: 'Charles Schwab', icon: 'S', color: '#1E88E5', desc: 'Full-service US brokerage' },
];

export default function SnapTradeConnectScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [brokerName, setBrokerName] = useState<string | null>(null);
  const [_brokerSlug, setBrokerSlug] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // ── Load current connection status ─────────────────────────
  const loadStatus = useCallback(async () => {
    setStatus('checking');
    try {
      const st = await snapTradeApi.status();
      if (st.connected) {
        setStatus('connected');
        setBrokerName(st.brokerName);
        setBrokerSlug(st.brokerSlug);
        setConnectedAt(st.connectedAt);
      } else {
        setStatus('disconnected');
      }
    } catch {
      setStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ── Connect via SnapTrade OAuth ────────────────────────────
  const connectBroker = useCallback(async (brokerId: string) => {
    setIsConnecting(true);
    setSelectedBroker(brokerId);
    setConnectError(null);

    try {
      await snapTradeApi.register();
      const linkResult = await snapTradeApi.getConnectLink();
      if (linkResult.oauthUrl) {
        // Ask user before opening external browser
        const openUrl = await Linking.canOpenURL(linkResult.oauthUrl);
        if (openUrl) {
          await Linking.openURL(linkResult.oauthUrl);
          // Short delay to let OAuth complete in browser, then navigate
          // to Portfolio which has its own "not connected" guard
          setTimeout(async () => {
            await loadStatus();
            setIsConnecting(false);
            navigation.navigate('SnapTradePortfolio');
          }, 3000);
        } else {
          setConnectError('Unable to open browser. Please try again.');
          setIsConnecting(false);
        }
      }
    } catch (err: any) {
      setConnectError(err?.message || 'Failed to connect. Please try again.');
      setIsConnecting(false);
    }
  }, [loadStatus, navigation]);

  // ── Disconnect ─────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    try {
      await snapTradeApi.disconnect();
      setStatus('disconnected');
      setBrokerName(null);
      setBrokerSlug(null);
      setConnectedAt(null);
    } catch (err: any) {
      setConnectError(err?.message || 'Failed to disconnect.');
    }
  }, []);

  // ── Format connection date ─────────────────────────────────
  const formattedDate = connectedAt
    ? new Date(connectedAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  // ── Loading ────────────────────────────────────────────────
  if (status === 'checking') {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.statusText, { color: colors.textMuted, marginTop: SPACING.md }]}>
          Checking connection...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary, paddingTop: 60 + insets.top }]}>
        <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.93}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </AnimatedPressable>
        <View style={{ marginLeft: SPACING.md }}>
          <Text style={[styles.title, { color: colors.text }]}>SnapTrade</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {status === 'connected' ? 'Connected to US Broker' : 'Connect US Brokerage'}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Connected State ── */}
        {status === 'connected' && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <LinearGradient
              colors={GRADIENTS.success}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.connectedBanner}
            >
              <View style={styles.connectedBannerContent}>
                <View style={styles.connectedIconCircle}>
                  <Ionicons name="checkmark" size={28} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.connectedTitle}>Connected</Text>
                  <Text style={styles.connectedBroker}>{brokerName || 'Broker'}</Text>
                  {formattedDate && (
                    <Text style={styles.connectedDate}>Connected: {formattedDate}</Text>
                  )}
                </View>
              </View>
            </LinearGradient>

            {/* Quick Actions */}
            <View style={styles.actionRow}>
              <AnimatedPressable
                onPress={() => navigation.navigate('SnapTradePortfolio')}
                haptic="medium"
                scaleTo={0.95}
                style={[styles.actionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="briefcase" size={24} color={colors.primary} />
                </View>
                <Text style={[styles.actionTitle, { color: colors.text }]}>Portfolio</Text>
                <Text style={[styles.actionDesc, { color: colors.textMuted }]}>
                  View holdings & positions
                </Text>
              </AnimatedPressable>

              <AnimatedPressable
                onPress={() => navigation.navigate('SnapTradeOrder')}
                haptic="medium"
                scaleTo={0.95}
                style={[styles.actionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#00E67620' }]}>
                  <Ionicons name="swap-horizontal" size={24} color="#00E676" />
                </View>
                <Text style={[styles.actionTitle, { color: colors.text }]}>Trade</Text>
                <Text style={[styles.actionDesc, { color: colors.textMuted }]}>
                  Place US stock orders
                </Text>
              </AnimatedPressable>
            </View>

            {/* Disconnect */}
            <AnimatedPressable
              onPress={disconnect}
              haptic="warning"
              scaleTo={0.97}
              style={[styles.disconnectBtn, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '30' }]}
            >
              <Ionicons name="link-outline" size={18} color={colors.danger} />
              <Text style={[styles.disconnectText, { color: colors.danger }]}>Disconnect Broker</Text>
            </AnimatedPressable>
          </Animated.View>
        )}

        {/* ── Disconnected State ── */}
        {status === 'disconnected' && (
          <Animated.View entering={FadeInUp.duration(400)}>
            {/* Info Card */}
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={[styles.infoIconCircle, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.infoTitle, { color: colors.text }]}>SnapTrade OAuth Gateway</Text>
              <Text style={[styles.infoDesc, { color: colors.textMuted }]}>
                Connect your US brokerage account securely via SnapTrade. 
                One-tap OAuth — no API keys needed. Supports 20+ US brokerages 
                including Alpaca, TD Ameritrade, E*TRADE, Interactive Brokers, and more.
              </Text>
              <View style={styles.featureRow}>
                {[
                  { icon: 'lock-closed', text: 'End-to-end encrypted' },
                  { icon: 'flash', text: 'Instant connection' },
                  { icon: 'globe', text: '20+ US brokers' },
                ].map((f, i) => (
                  <View key={i} style={styles.featureChip}>
                    <Ionicons name={f.icon as any} size={12} color={colors.primary} />
                    <Text style={[styles.featureChipText, { color: colors.primary }]}>{f.text}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Broker Grid */}
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Select your broker</Text>
            <View style={styles.brokerGrid}>
              {SUPPORTED_BROKERS.map((broker, i) => (
                <Animated.View
                  key={broker.id}
                  entering={FadeInUp.duration(350).delay(i * 60)}
                  style={styles.brokerCardWrap}
                >
                  <AnimatedPressable
                    onPress={() => connectBroker(broker.id)}
                    disabled={isConnecting}
                    haptic="medium"
                    scaleTo={0.95}
                    style={[styles.brokerCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                  >
                    <LinearGradient
                      colors={[broker.color + '20', broker.color + '05']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={[styles.brokerIconCircle, { backgroundColor: broker.color + '20' }]}>
                      <Text style={[styles.brokerIconText, { color: broker.color }]}>{broker.icon}</Text>
                    </View>
                    <Text style={[styles.brokerName, { color: colors.text }]}>{broker.name}</Text>
                    <Text style={[styles.brokerDesc, { color: colors.textMuted }]} numberOfLines={2}>
                      {broker.desc}
                    </Text>
                    <View style={[styles.connectChip, { backgroundColor: broker.color + '20' }]}>
                      <Text style={[styles.connectChipText, { color: broker.color }]}>Connect</Text>
                    </View>
                  </AnimatedPressable>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Error Display */}
        {connectError && (
          <View style={[styles.errorCard, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '30' }]}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{connectError}</Text>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Connecting Overlay */}
      {isConnecting && (
        <View style={styles.connectingOverlay}>
          <LinearGradient
            colors={[colors.bg + 'F0', colors.bg + 'F0']}
            style={StyleSheet.absoluteFill}
          />
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.connectingTitle, { color: colors.text }]}>Connecting...</Text>
          <Text style={[styles.connectingSub, { color: colors.textMuted }]}>
            Complete login on your browser
          </Text>
          <Text style={[styles.connectingBroker, { color: colors.primary }]}>
            {selectedBroker ? SUPPORTED_BROKERS.find(b => b.id === selectedBroker)?.name : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  title: { ...FONTS.bold, fontSize: FONTS.size.title },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 2 },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },
  statusText: { ...FONTS.regular, fontSize: FONTS.size.md },

  // ── Connected Banner ──
  connectedBanner: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  connectedBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  connectedIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectedTitle: { ...FONTS.bold, fontSize: FONTS.size.lg, color: '#fff' },
  connectedBroker: { ...FONTS.medium, fontSize: FONTS.size.sm, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  connectedDate: { ...FONTS.regular, fontSize: FONTS.size.xs, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  // ── Quick Actions ──
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  actionCard: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: { ...FONTS.bold, fontSize: FONTS.size.md },
  actionDesc: { ...FONTS.regular, fontSize: FONTS.size.xs, textAlign: 'center' },

  // ── Disconnect ──
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  disconnectText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },

  // ── Info Card ──
  infoCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  infoIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  infoTitle: { ...FONTS.bold, fontSize: FONTS.size.lg, marginBottom: SPACING.xs },
  infoDesc: { ...FONTS.regular, fontSize: FONTS.size.sm, textAlign: 'center', lineHeight: 20 },
  featureRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  featureChipText: { ...FONTS.medium, fontSize: 10 },

  // ── Section ──
  sectionLabel: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    marginBottom: SPACING.md,
  },

  // ── Broker Grid ──
  brokerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  brokerCardWrap: {
    width: (width - SPACING.xl * 2 - SPACING.md) / 2,
  },
  brokerCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    gap: SPACING.sm,
  },
  brokerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brokerIconText: { ...FONTS.bold, fontSize: FONTS.size.lg },
  brokerName: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  brokerDesc: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 14 },
  connectChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.xs,
  },
  connectChipText: { ...FONTS.medium, fontSize: 9, letterSpacing: 0.3 },

  // ── Error ──
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  errorText: { ...FONTS.regular, fontSize: FONTS.size.sm, flex: 1 },

  // ── Connecting Overlay ──
  connectingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    gap: SPACING.sm,
  },
  connectingTitle: { ...FONTS.bold, fontSize: FONTS.size.xl, marginTop: SPACING.lg },
  connectingSub: { ...FONTS.regular, fontSize: FONTS.size.sm },
  connectingBroker: { ...FONTS.semiBold, fontSize: FONTS.size.md, marginTop: SPACING.sm },
});
