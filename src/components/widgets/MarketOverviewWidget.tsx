/**
 * Toroloom — Market Overview Widget
 * Shows Nifty, Sensex, and key market indices with change percentages.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useMarketStore } from '../../store/marketStore';
import { FONTS } from '../../constants/theme';
import type { WidgetSize } from '../../types/widgets';

// Mock indices data (since marketStore may not have indices)
const DEFAULT_INDICES = [
  { id: 'nifty', name: 'NIFTY 50', value: '24,861.15', change: 187.45, changePercent: 0.76, isPositive: true },
  { id: 'sensex', name: 'SENSEX', value: '81,234.50', change: 456.20, changePercent: 0.56, isPositive: true },
  { id: 'banknifty', name: 'BANK NIFTY', value: '52,345.80', change: -124.30, changePercent: -0.24, isPositive: false },
  { id: 'midcap', name: 'NIFTY MIDCAP', value: '18,567.30', change: 234.10, changePercent: 1.27, isPositive: true },
];

interface MarketOverviewWidgetProps {
  size: WidgetSize;
}

function IndexRow({ name, value, change, changePercent, isPositive }: {
  name: string; value: string; change: number; changePercent: number; isPositive: boolean;
}) {
  const { colors } = useTheme();
  const color = isPositive ? '#00E676' : '#FF5252';
  return (
    <View style={indexStyles.row}>
      <View style={indexStyles.nameCol}>
        <Text style={[indexStyles.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
      </View>
      <View style={indexStyles.valueCol}>
        <Text style={[indexStyles.value, { color: colors.text }]}>{value}</Text>
        <View style={indexStyles.changeRow}>
          <Ionicons name={isPositive ? 'caret-up' : 'caret-down'} size={10} color={color} />
          <Text style={[indexStyles.change, { color }]}>
            {change > 0 ? '+' : ''}{change.toFixed(2)} ({(changePercent > 0 ? '+' : '') + changePercent.toFixed(2)}%)
          </Text>
        </View>
      </View>
    </View>
  );
}

const indexStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  nameCol: { flex: 1 },
  name: { fontFamily: 'System', fontSize: 12, fontWeight: '700' },
  valueCol: { alignItems: 'flex-end' },
  value: { fontFamily: 'System', fontSize: 13, fontWeight: '800' },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  change: { fontFamily: 'System', fontSize: 10, fontWeight: '600' },
});

// ── Mini Sparkline ──────────────────────────────────────────────────────

function MiniChart({ isPositive }: { isPositive: boolean }) {
  const color = isPositive ? '#00E676' : '#FF5252';
  const w = 60, h = 30;
  const points = [
    { x: 0, y: 20 }, { x: 8, y: 18 }, { x: 16, y: 22 }, { x: 24, y: 15 },
    { x: 32, y: 12 }, { x: 40, y: 10 }, { x: 48, y: 6 }, { x: 56, y: 4 },
  ];
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${path} L ${w} ${h} L 0 ${h} Z`;

  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id={`mcFill_${isPositive ? 'p' : 'n'}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill={`url(#mcFill_${isPositive ? 'p' : 'n'})`} />
      <Path d={path} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function MarketOverviewWidget({ size }: MarketOverviewWidgetProps) {
  const { colors } = useTheme();
  const { indices } = useMarketStore();
  const displayIndices = indices.length > 0 ? indices : DEFAULT_INDICES;
  const showCount = size === 'small' ? 2 : displayIndices.length;

  return (
    <View style={styles.container}>
      {displayIndices.slice(0, showCount).map((idx: any) => (
        <IndexRow
          key={idx.id}
          name={idx.name || idx.shortName}
          value={typeof idx.currentValue === 'number' ? idx.currentValue.toLocaleString('en-IN') : '—'}
          change={idx.change}
          changePercent={idx.changePercent}
          isPositive={idx.isPositive || idx.change >= 0}
        />
      ))}
      {size !== 'small' && (
        <View style={styles.chartRow}>
          <MiniChart isPositive={displayIndices[0]?.isPositive ?? true} />
          <Text style={[styles.chartLabel, { color: colors.textMuted }]}>
            Nifty intraday trend
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chartRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  chartLabel: { fontFamily: 'System', fontSize: 9, fontWeight: '500' },
});
