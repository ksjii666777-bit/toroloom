// ============================================================================
// Toroloom — Tick-by-Tick Real-Time Mode
// A floating overlay component that shows live tick data streaming in
// real-time, with accelerating price updates and tick count metrics.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';

// ── Types ──

export interface TickEntry {
  price: number;
  volume: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

interface TickModeProps {
  /** Whether tick mode is active */
  active: boolean;
  /** Current price (from real-time hook) */
  currentPrice: number;
  /** Previous price (to determine green/red tick direction) */
  lastPrice: number;
  /** Called when user taps the tick mode badge to disable */
  onDisable: () => void;
  /** Total ticks received in current session */
  sessionTicks: number;
  /** Latest few ticks for display */
  recentTicks: TickEntry[];
}

// ── Component ──

export default function TickModeIndicator({
  active,
  currentPrice,
  lastPrice,
  onDisable,
  sessionTicks,
  recentTicks,
}: TickModeProps) {
  const startTimeRef = useRef(Date.now());
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const tickSpeedAnim = useRef(new Animated.Value(0)).current;
  const prevPriceRef = useRef(lastPrice);

  // ── Pulse animation for the live indicator ──
  useEffect(() => {
    if (!active) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [active, pulseAnim]);

  // ── Tick speed indicator ──
  useEffect(() => {
    if (!active || prevPriceRef.current === currentPrice) return;
    tickSpeedAnim.setValue(1);
    Animated.timing(tickSpeedAnim, {
      toValue: 0,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    prevPriceRef.current = currentPrice;
  }, [active, currentPrice, tickSpeedAnim]);

  // ── Tick direction ──
  const isUp = currentPrice >= lastPrice;

  if (!active) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: isUp ? colors.marketUp + '40' : colors.marketDown + '40' }]}>
      {/* ── Top row: Indicator + Price + Close ── */}
      <View style={styles.topRow}>
        <View style={styles.liveSection}>
          <Animated.View
            style={[
              styles.liveDot,
              { backgroundColor: colors.marketUp, opacity: pulseAnim },
            ]}
          />
          <Text style={[styles.liveLabel, { color: colors.marketUp }]}>TICK</Text>
        </View>

        <Animated.Text
          style={[
            styles.price,
            { color: colors.text, opacity: tickSpeedAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.6],
            })},
          ]}
        >
          {formatCurrency(currentPrice)}
        </Animated.Text>

        <Pressable
          style={({pressed}) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
          onPress={onDisable}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* ── Stats row ── */}
      <View style={styles.statsRow}>
        <Text style={[styles.stat, { color: colors.textMuted }]}>
          {sessionTicks} ticks
        </Text>
        <Text style={[styles.stat, { color: colors.textMuted }]}>
          ~{sessionTicks > 0 ? Math.round((sessionTicks * 1000) / (Date.now() - startTimeRef.current)) : 0}/sec
        </Text>
        <View style={[styles.directionBadge, {
          backgroundColor: isUp ? colors.marketUp + '20' : colors.marketDown + '20',
        }]}>
          <Ionicons
            name={isUp ? 'trending-up' : 'trending-down'}
            size={14}
            color={isUp ? colors.marketUp : colors.marketDown}
          />
        </View>
      </View>

      {/* ── Recent ticks mini table ── */}
      {recentTicks.length > 0 && (
        <View style={styles.ticksContainer}>
          {recentTicks.slice(-5).reverse().map((tick, i) => {
            const tickUp = tick.side === 'buy';
            return (
              <View key={`tick-${i}`} style={styles.tickRow}>
                <Text style={[styles.tickPrice, { color: tickUp ? colors.marketUp : colors.marketDown }]}>
                  {formatCurrency(tick.price)}
                </Text>
                <Text style={[styles.tickVol, { color: colors.textMuted }]}>
                  {tick.volume >= 1000 ? `${(tick.volume / 1000).toFixed(1)}K` : tick.volume}
                </Text>
                <View style={[styles.tickSide, {
                  backgroundColor: tickUp ? colors.marketUp + '20' : colors.marketDown + '20',
                }]}>
                  <Ionicons
                    name={tickUp ? 'arrow-up' : 'arrow-down'}
                    size={10}
                    color={tickUp ? colors.marketUp : colors.marketDown}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveLabel: {
    fontSize: 10,
    fontFamily: 'System',
    fontWeight: '800',
    letterSpacing: 1,
  },
  price: {
    fontSize: FONTS.size.lg,
    fontFamily: 'System',
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  stat: {
    fontSize: 9,
    fontFamily: 'System',
    fontWeight: '600',
  },
  directionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: 'auto',
  },
  ticksContainer: {
    marginTop: SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
    paddingTop: SPACING.xs,
  },
  tickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 1,
  },
  tickPrice: {
    fontSize: 10,
    fontFamily: 'System',
    fontWeight: '700',
    width: 72,
  },
  tickVol: {
    fontSize: 9,
    fontFamily: 'System',
    fontWeight: '500',
    width: 48,
  },
  tickSide: {
    width: 20,
    height: 16,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
