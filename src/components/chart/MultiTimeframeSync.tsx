// ============================================================================
// Toroloom — Multi-Timeframe Sync
// Mini chart thumbnails below the main chart that share crosshair position
// when tapped, allowing the user to see the same moment across timeframes.
// ============================================================================

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { StockHistoryPoint } from '../../types';
import { useChartCrosshair } from '../ChartCrosshairContext';

// ── Props ──

interface MultiTimeframeSyncProps {
  /** Candle history keyed by timeframe label */
  timeframeData: Record<string, StockHistoryPoint[]>;
  /** Currently active timeframe (highlighted) */
  activeTimeframe: string;
  /** Called when user taps a mini chart to switch timeframe */
  onTimeframeSelect: (timeframe: string) => void;
  /** Symbol for a11y / display */
  symbol: string;
}

// ── Mini chart thumbnail dimensions ──

const THUMB_WIDTH = 72;
const THUMB_HEIGHT = 40;
const THUMB_PADDING = 2;

// ── Component ──

export default function MultiTimeframeSync({
  timeframeData,
  activeTimeframe,
  onTimeframeSelect,
  symbol,
}: MultiTimeframeSyncProps) {
  const { colors } = useTheme();
  const { focusedIndex } = useChartCrosshair();

  const timeframes = useMemo(() => {
    // Show a curated set of timeframes for quick sync
    const order = ['1D', '1W', '1M', '3M', '1Y'];
    return order.filter(tf => timeframeData[tf] && timeframeData[tf].length > 0);
  }, [timeframeData]);

  const hasCrosshair = focusedIndex !== null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>
          Multi-Timeframe
        </Text>
        {hasCrosshair && (
          <View style={[styles.syncBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.syncBadgeText, { color: colors.primary }]}>
              ✦ Synced
            </Text>
          </View>
        )}
      </View>

      <View style={styles.thumbnails}>
        {timeframes.map(tf => {
          const data = timeframeData[tf];
          const isActive = tf === activeTimeframe;
          return (
            <Pressable
              key={tf}
              style={({pressed}) => [[
                styles.thumbWrapper,
                isActive && [styles.thumbActive, { borderColor: colors.primary }],
                { opacity: pressed ? 0.7 : 1 },
              ]]}
              onPress={() => onTimeframeSelect(tf)}
              accessibilityLabel={`${tf} chart, ${isActive ? 'active' : 'tap to view'}`}
            >
              <Text style={[styles.thumbLabel, { color: isActive ? colors.primary : colors.textMuted }]}>
                {tf}
              </Text>
              <MiniChart
                data={data}
                width={THUMB_WIDTH}
                height={THUMB_HEIGHT}
                colors={colors}
                isActive={isActive}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Mini Chart Component
// ════════════════════════════════════════════════════════════════════════════

interface MiniChartProps {
  data: StockHistoryPoint[];
  width: number;
  height: number;
  colors: any;
  isActive: boolean;
}

function MiniChart({ data, width, height, colors, isActive }: MiniChartProps) {
  const pad = THUMB_PADDING;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;

  const { minP, maxP, path } = useMemo(() => {
    if (!data || data.length < 2) {
      return { minP: 0, maxP: 1, path: '' };
    }
    let mn = Infinity, mx = -Infinity;
    for (const d of data) {
      if (d.close < mn) mn = d.close;
      if (d.close > mx) mx = d.close;
    }
    const range = mx - mn || 1;
    const padRange = range * 0.1;

    let p = '';
    for (let i = 0; i < data.length; i++) {
      const x = pad + (i / (data.length - 1)) * chartW;
      const y = pad + ((mx + padRange - data[i].close) / (range + padRange * 2)) * chartH;
      p += p ? ` L ${x} ${y}` : `M ${x} ${y}`;
    }
    return { minP: mn, maxP: mx, path: p };
  }, [data, chartW, chartH, pad]);

  const lineColor = isActive ? colors.primary : colors.textMuted;
  const fillColor = isActive ? colors.primary : colors.textMuted;

  return (
    <Svg width={width} height={height}>
      <Rect
        x={0} y={0} width={width} height={height}
        fill={isActive ? colors.primary + '08' : 'transparent'}
        rx={4}
      />
      {path ? (
        <>
          {/* Area fill */}
          <Path
            d={`${path} L ${pad + chartW} ${pad + chartH} L ${pad} ${pad + chartH} Z`}
            fill={fillColor}
            opacity={isActive ? 0.15 : 0.06}
          />
          {/* Line */}
          <Path
            d={path}
            stroke={lineColor}
            strokeWidth={isActive ? 1.5 : 1}
            fill="none"
            opacity={isActive ? 0.9 : 0.4}
          />
        </>
      ) : null}
    </Svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  title: {
    fontSize: FONTS.size.xs,
    fontFamily: 'System',
    fontWeight: '600',
  },
  syncBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  syncBadgeText: {
    fontSize: 9,
    fontFamily: 'System',
    fontWeight: '700',
  },
  thumbnails: {
    flexDirection: 'row',
    gap: SPACING.xs,
    justifyContent: 'space-between',
  },
  thumbWrapper: {
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  thumbActive: {
    borderWidth: 1,
  },
  thumbLabel: {
    fontSize: 8,
    fontFamily: 'System',
    fontWeight: '700',
    marginBottom: 2,
  },
});
