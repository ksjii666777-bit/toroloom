/**
 * Interactive broker connection demo for onboarding.
 * Users tap brokers to simulate connecting to a trading platform.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import Animated, { BounceIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../../hooks/useT';
import * as Haptics from 'expo-haptics';
import { MOCK_BROKERS } from '../mockData';
import { SPACING } from '../../../constants/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - SPACING.xl * 2;

interface MiniBrokerConnectProps {
  onInteract: () => void;
  onDemoComplete?: () => void;
  interacted: boolean;
}

export function MiniBrokerConnect({ onInteract, onDemoComplete, interacted }: MiniBrokerConnectProps) {
  const { t } = useT();
  const [connectedBroker, setConnectedBroker] = useState<string | null>(null);
  const [connectingBroker, setConnectingBroker] = useState<string | null>(null);

  const handleConnect = async (brokerId: string) => {
    if (connectedBroker) return;
    onInteract();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConnectingBroker(brokerId);

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 800));

    onDemoComplete?.();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setConnectedBroker(brokerId);
    setConnectingBroker(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('onboarding.tapToConnectBroker')}</Text>

      <View style={styles.row}>
        {MOCK_BROKERS.map((broker) => {
          const isConnected = connectedBroker === broker.id;
          const isConnecting = connectingBroker === broker.id;
          return (
            <Pressable
              key={broker.id}
              disabled={isConnected || isConnecting}
              onPress={() => handleConnect(broker.id)}
              style={[styles.miniCard, { width: (CARD_WIDTH - 48) / 3 - 4 }]}
            >
              <LinearGradient
                colors={broker.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1.2 }}
                style={styles.miniGradient}
              >
                <View style={[styles.miniIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  {isConnecting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : isConnected ? (
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.miniIconText}>{broker.icon}</Text>
                  )}
                </View>
                <Text style={styles.miniLabel}>{broker.label}</Text>

                {isConnected && (
                  <Animated.View entering={BounceIn.duration(300)} style={styles.miniConnected}>
                    <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                    <Text style={styles.miniConnectedText}>{t('onboarding.connected')}</Text>
                  </Animated.View>
                )}
                {!isConnected && !isConnecting && (
                  <View style={styles.miniSyncBadge}>
                    <Ionicons name="wifi" size={8} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.miniSyncText}>{t('onboarding.sync')}</Text>
                  </View>
                )}
              </LinearGradient>
            </Pressable>
          );
        })}
      </View>

      {!connectedBroker && !interacted && (
        <Text style={styles.hint}>👆 Tap any broker to connect</Text>
      )}
      {connectedBroker && (
        <Animated.View entering={BounceIn.duration(400)} style={styles.successRow}>
          <Ionicons name="shield-checkmark" size={16} color="#00E676" />
          <Text style={styles.successText}>
            {MOCK_BROKERS.find(b => b.id === connectedBroker)?.label} connected! Secure session established.
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  title: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter-SemiBold', marginBottom: 12, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  miniCard: { borderRadius: 14, overflow: 'hidden' },
  miniGradient: { padding: 12, alignItems: 'center', gap: 6, minHeight: 110 },
  miniIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  miniIconText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-Bold' },
  miniLabel: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter-SemiBold', textAlign: 'center' },
  miniConnected: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  miniConnectedText: { color: '#FFFFFF', fontSize: 9, fontFamily: 'Inter-Medium' },
  miniSyncBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4, opacity: 0.6 },
  miniSyncText: { color: 'rgba(255,255,255,0.6)', fontSize: 8 },
  hint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 8 },
  successRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  successText: { color: '#00E676', fontSize: 11, fontFamily: 'Inter-Medium', flex: 1, textAlign: 'center' },
});
