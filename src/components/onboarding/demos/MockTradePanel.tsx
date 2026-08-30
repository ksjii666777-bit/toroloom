/**
 * Interactive mock trading panel for onboarding.
 * Users can toggle buy/sell, adjust quantity, and place a mock order.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, BounceIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../../hooks/useT';
import * as Haptics from 'expo-haptics';

interface MockTradePanelProps {
  onInteract: () => void;
  onDemoComplete?: () => void;
}

export function MockTradePanel({ onInteract, onDemoComplete }: MockTradePanelProps) {
  const { t } = useT();
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState(10);
  const [confirmed, setConfirmed] = useState(false);
  const mockPrice = 2450.50;
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (!confirmed) {
      pulseAnim.value = withRepeat(
        withSequence(withTiming(1.05, { duration: 800 }), withTiming(1, { duration: 800 })),
        -1,
        true,
      );
    }
  }, [confirmed, pulseAnim]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const handleConfirm = () => {
    onInteract();
    onDemoComplete?.();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setConfirmed(true);
    pulseAnim.value = withTiming(1, { duration: 200 });
  };

  const handleQtyChange = (delta: number) => {
    onInteract();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuantity(Math.max(1, Math.min(100, quantity + delta)));
  };

  const handleTradeTypeChange = (type: 'buy' | 'sell') => {
    onInteract();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTradeType(type);
    setConfirmed(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mock Trade — RELIANCE</Text>

      <View style={styles.priceRow}>
        <Text style={styles.price}>₹{mockPrice.toFixed(2)}</Text>
        <Text style={styles.change}>+2.3%</Text>
      </View>

      <View style={styles.toggle}>
        <Pressable
          style={[styles.toggleBtn, tradeType === 'buy' && styles.toggleBuy]}
          onPress={() => handleTradeTypeChange('buy')}
        >
          <Ionicons name="trending-up" size={16} color={tradeType === 'buy' ? '#fff' : '#00E676'} />
          <Text style={[styles.toggleText, tradeType === 'buy' && styles.toggleTextActive]}>Buy</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, tradeType === 'sell' && styles.toggleSell]}
          onPress={() => handleTradeTypeChange('sell')}
        >
          <Ionicons name="trending-down" size={16} color={tradeType === 'sell' ? '#fff' : '#FF5252'} />
          <Text style={[styles.toggleText, tradeType === 'sell' && styles.toggleTextActive]}>{t('onboarding.sell')}</Text>
        </Pressable>
      </View>

      <View style={styles.qtyRow}>
        <Pressable style={styles.qtyBtn} onPress={() => handleQtyChange(-5)}>
          <Ionicons name="remove" size={20} color="#9CA3AF" />
        </Pressable>
        <View style={styles.qtyValue}>
          <Text style={styles.qtyText}>{quantity}</Text>
          <Text style={styles.qtyLabel}>Qty</Text>
        </View>
        <Pressable style={styles.qtyBtn} onPress={() => handleQtyChange(5)}>
          <Ionicons name="add" size={20} color="#9CA3AF" />
        </Pressable>
      </View>

      <View style={styles.orderTotal}>
        <Text style={styles.orderTotalLabel}>{t('onboarding.total')}</Text>
        <Text style={styles.orderTotalValue}>
          ₹{(mockPrice * quantity).toLocaleString()}
        </Text>
      </View>

      {!confirmed ? (
        <Animated.View style={pulseStyle}>
          <Pressable
            style={[styles.confirmBtn, { backgroundColor: tradeType === 'buy' ? '#00E676' : '#FF5252' }]}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmBtnText}>
              {tradeType === 'buy' ? '📈 Place Buy Order' : '📉 Place Sell Order'}
            </Text>
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View entering={BounceIn.duration(400)} style={styles.confirmedBox}>
          <Ionicons name="checkmark-circle" size={28} color="#00E676" />
          <Text style={styles.confirmedText}>
            {t('onboarding.orderPlaced', { count: quantity, action: tradeType === 'buy' ? t('onboarding.bought') : t('onboarding.sold') })}
          </Text>
        </Animated.View>
      )}

      {!confirmed && (
        <Text style={styles.hint}>👆 Try placing a mock order</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  title: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter-SemiBold', marginBottom: 12, textAlign: 'center' },
  priceRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  price: { color: '#FFFFFF', fontSize: 24, fontFamily: 'Inter-Bold' },
  change: { color: '#00E676', fontSize: 14, fontFamily: 'Inter-SemiBold' },
  toggle: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  toggleBuy: { backgroundColor: '#00E67620', borderColor: '#00E676' },
  toggleSell: { backgroundColor: '#FF525220', borderColor: '#FF5252' },
  toggleText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: 'Inter-SemiBold' },
  toggleTextActive: { color: '#FFFFFF' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  qtyValue: { alignItems: 'center' },
  qtyText: { color: '#FFFFFF', fontSize: 20, fontFamily: 'Inter-Bold' },
  qtyLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10 },
  orderTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, marginBottom: 12 },
  orderTotalLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  orderTotalValue: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-Bold' },
  confirmBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  confirmBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter-Bold' },
  confirmedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: 'rgba(0,230,118,0.12)', borderRadius: 12 },
  confirmedText: { color: '#00E676', fontSize: 13, fontFamily: 'Inter-SemiBold' },
  hint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 8 },
});
