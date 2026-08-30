/**
 * Interactive mini candlestick chart for onboarding.
 * Users tap candles to see OHLCV details.
 */
import React, { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useT } from '../../../hooks/useT';
import * as Haptics from 'expo-haptics';
import { MOCK_CANDLE_DATA } from '../mockData';
import { SPACING } from '../../../constants/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - SPACING.xl * 2;

interface MiniCandlestickChartProps {
  onInteract: () => void;
  onDemoComplete?: () => void;
}

export function MiniCandlestickChart({ onInteract, onDemoComplete }: MiniCandlestickChartProps) {
  const { t } = useT();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const demoCompletedRef = useRef(false);
  const chartHeight = 100;
  const chartWidth = CARD_WIDTH - SPACING.xl * 2 - 20;
  const candleWidth = Math.floor(chartWidth / MOCK_CANDLE_DATA.length) - 4;
  const prices = MOCK_CANDLE_DATA.map(d => d.high);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...MOCK_CANDLE_DATA.map(d => d.low));
  const range = maxPrice - minPrice || 1;

  const handleCandleTap = (index: number) => {
    onInteract();
    if (!demoCompletedRef.current) {
      demoCompletedRef.current = true;
      onDemoComplete?.();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIndex(selectedIndex === index ? null : index);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RELIANCE — This Week</Text>

      <View style={[styles.chart, { height: chartHeight + 30 }]}>
        <Text style={[styles.priceLabel, { top: 0 }]}>₹{maxPrice}</Text>
        <Text style={[styles.priceLabel, { bottom: 20 }]}>₹{minPrice}</Text>

        <View style={styles.candlesRow}>
          {MOCK_CANDLE_DATA.map((candle, i) => {
            const isUp = candle.close >= candle.open;
            const candleTop = ((maxPrice - Math.max(candle.open, candle.close)) / range) * chartHeight;
            const candleBottom = ((maxPrice - Math.min(candle.open, candle.close)) / range) * chartHeight;
            const wickTop = ((maxPrice - candle.high) / range) * chartHeight;
            const wickBottom = ((maxPrice - candle.low) / range) * chartHeight;
            const isSelected = selectedIndex === i;

            return (
              <Pressable
                key={candle.date}
                onPress={() => handleCandleTap(i)}
                style={[styles.candleWrapper, { width: candleWidth + 4 }]}
              >
                <View
                  style={[
                    styles.wick,
                    {
                      top: wickTop,
                      height: wickBottom - wickTop,
                      left: (candleWidth + 4) / 2 - 1,
                      backgroundColor: isUp ? '#00E676' : '#FF5252',
                    },
                  ]}
                />
                <View
                  style={[
                    styles.candleBody,
                    {
                      top: candleTop,
                      height: Math.max(candleBottom - candleTop, 3),
                      width: candleWidth,
                      left: 2,
                      backgroundColor: isUp ? '#00E676' : '#FF5252',
                      opacity: isSelected ? 1 : 0.8,
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: isSelected ? '#FFFFFF' : 'transparent',
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dayLabels}>
          {MOCK_CANDLE_DATA.map((candle) => (
            <Text key={candle.date} style={[styles.dayLabel, { width: candleWidth + 4 }]}>
              {candle.date.substring(0, 3)}
            </Text>
          ))}
        </View>
      </View>

      {selectedIndex !== null && (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.detail}>
          <Text style={styles.detailText}>
            O: {MOCK_CANDLE_DATA[selectedIndex].open} · H: {MOCK_CANDLE_DATA[selectedIndex].high} · L: {MOCK_CANDLE_DATA[selectedIndex].low} · C: {MOCK_CANDLE_DATA[selectedIndex].close}
          </Text>
          <Text style={styles.detailVol}>
            Vol: {(MOCK_CANDLE_DATA[selectedIndex].volume / 1000).toFixed(1)}K
          </Text>
        </Animated.View>
      )}

      {selectedIndex === null && (
        <Text style={styles.hint}>👆 Tap a candle for details</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  title: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter-SemiBold', marginBottom: 8, textAlign: 'center' },
  chart: { position: 'relative' },
  priceLabel: { position: 'absolute', right: 0, color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'Inter-Mono' },
  candlesRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', height: 100 },
  candleWrapper: { position: 'relative', height: 100 },
  wick: { position: 'absolute', width: 2 },
  candleBody: { position: 'absolute', borderRadius: 2 },
  dayLabels: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
  dayLabel: { textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 9, fontFamily: 'Inter-Mono' },
  detail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 4 },
  detailText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter-Mono' },
  detailVol: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  hint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 8 },
});
