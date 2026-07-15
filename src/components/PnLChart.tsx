import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions,
  Pressable} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Svg, { Path, Line, Rect, Text as SvgText, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';

interface PnLPoint {
  date: string;
  value: number;
  cumulativePnl: number;
}

interface PnLChartProps {
  data: PnLPoint[];
  height?: number;
  width?: number;
  timeframe?: string;
  onTimeframeChange?: (tf: string) => void;
  /** Enable auto-refresh: shows a live dot and fades new data in */
  autoRefresh?: boolean;
  /** Streaming data that gets appended visually */
  streamData?: PnLPoint[];
}

const TIMEFRAMES = ['1M', '3M', '6M', '1Y', 'All'];

export default function PnLChart({
  data,
  height = 240,
  width = Dimensions.get('window').width - 40,
  timeframe = 'All',
  onTimeframeChange,
  autoRefresh = false,
  streamData = [],
}: PnLChartProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: PnLPoint } | null>(null);
  const fadeAnim = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));
  const [prevDataLength, setPrevDataLength] = useState(0);

  // Animate fade-in when new data arrives (streaming)
  useEffect(() => {
    const totalLen = data.length + streamData.length;
    if (autoRefresh && totalLen > prevDataLength && prevDataLength > 0) {
      fadeAnim.value = 0.6;
      fadeAnim.value = withTiming(1, { duration: 400 });
    }
    setPrevDataLength(totalLen);
  }, [data.length, streamData.length, autoRefresh, fadeAnim, prevDataLength, setPrevDataLength]);

  // Merge historical data with stream data (stream overrides for duplicate dates)
  const mergedData = useMemo(() => {
    if (!autoRefresh || streamData.length === 0) return data;
    const dateSet = new Set(streamData.map(d => d.date));
    const historical = data.filter(d => !dateSet.has(d.date));
    return [...historical, ...streamData];
  }, [data, streamData, autoRefresh]);

  // Filter data by timeframe
  const filteredData = useMemo(() => {
    if (!mergedData || mergedData.length === 0) return [];
    if (timeframe === 'All') return mergedData;
    const daysMap: Record<string, number> = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
    const days = daysMap[timeframe] || 365;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return mergedData.filter(d => new Date(d.date) >= cutoff);
  }, [mergedData, timeframe]);

  // ── Compute chart metrics unconditionally (move before early returns) ──
  const padding = { top: 20, right: 16, bottom: 36, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Price stats computed unconditionally
  const prices = filteredData.map(d => d.cumulativePnl);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 1;
  const priceRange = (maxPrice - minPrice) || 1;
  const padding2 = priceRange * 0.08;
  const chartMin = minPrice - padding2;
  const chartMax = maxPrice + padding2;
  const chartRange = chartMax - chartMin;

  const getX = useCallback((i: number) => padding.left + (i / Math.max(filteredData.length - 1, 1)) * chartWidth,
    [padding.left, filteredData.length, chartWidth]);
  const getY = useCallback((price: number) => padding.top + ((chartMax - price) / chartRange) * chartHeight,
    [padding.top, chartMax, chartRange, chartHeight]);

  // Generate smooth path (still wrapped in useMemo but now before early returns)
  const linePath = useMemo(() => {
    if (filteredData.length < 2) return '';
    let path = `M ${getX(0)} ${getY(filteredData[0].cumulativePnl)}`;
    for (let i = 1; i < filteredData.length; i++) {
      const x1 = getX(i - 1), y1 = getY(filteredData[i - 1].cumulativePnl);
      const x2 = getX(i), y2 = getY(filteredData[i].cumulativePnl);
      const cp1x = x1 + (x2 - x1) / 3;
      const cp2x = x1 + 2 * (x2 - x1) / 3;
      path += ` C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;
    }
    return path;
  }, [filteredData, getX, getY]);

  // Generate fill path
  const fillPath = useMemo(() => {
    if (!linePath) return '';
    const lastX = getX(Math.max(filteredData.length - 1, 0));
    const firstX = getX(0);
    const bottomY = padding.top + chartHeight;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [linePath, filteredData, getX, chartHeight, padding.top]);

  // Y-axis labels
  const yLabels = useMemo(() => {
    const count = 5;
    const labels: number[] = [];
    for (let i = 0; i < count; i++) {
      labels.push(chartMax - (chartRange * i) / (count - 1));
    }
    return labels;
  }, [chartMax, chartRange]);

  // X-axis labels
  const xLabels = useMemo(() => {
    if (filteredData.length < 2) return [];
    const count = Math.min(6, filteredData.length);
    const step = Math.max(1, Math.floor(filteredData.length / (count - 1)));
    const labels: { index: number; label: string }[] = [];
    for (let i = 0; i < filteredData.length; i += step) {
      const d = new Date(filteredData[i].date);
      labels.push({ index: i, label: `${d.getDate()}/${d.getMonth() + 1}` });
    }
    const last = filteredData.length - 1;
    if (labels.length === 0 || labels[labels.length - 1]?.index !== last) {
      const d = new Date(filteredData[last].date);
      labels.push({ index: last, label: `${d.getDate()}/${d.getMonth() + 1}` });
    }
    return labels;
  }, [filteredData]);

  if (!filteredData || filteredData.length < 2) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Not enough data for chart</Text>
        </View>
      </View>
    );
  }

  const overallPnl = filteredData[filteredData.length - 1].cumulativePnl;
  const isPositive = overallPnl >= 0;
  const lineColor = isPositive ? colors.marketUp : colors.marketDown;

  const handleTouch = (x: number) => {
    const relativeX = x - padding.left;
    const step = chartWidth / (filteredData.length - 1);
    const index = Math.max(0, Math.min(filteredData.length - 1, Math.round(relativeX / step)));
    setTooltip({ x: getX(index), y: getY(filteredData[index].cumulativePnl), point: filteredData[index] });
  };

  return (
    <Animated.View style={[styles.container, { height }, fadeStyle]}>
      {tooltip && (
        <View style={[styles.tooltip, { left: Math.min(Math.max(tooltip.x - 60, 8), width - 130) }]}>
          <Text style={[styles.tooltipValue, { color: tooltip.point.cumulativePnl >= 0 ? colors.marketUp : colors.marketDown }]}>
            {tooltip.point.cumulativePnl >= 0 ? '+' : ''}{formatCurrency(tooltip.point.cumulativePnl, true)}
          </Text>
          <Text style={styles.tooltipDate}>{new Date(tooltip.point.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        </View>
      )}

      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Grid */}
        {yLabels.map((price, i) => (
          <Line key={`g${i}`} x1={padding.left} y1={getY(price)} x2={width - padding.right} y2={getY(price)}
            stroke={colors.borderLight} strokeWidth={0.5} strokeDasharray="4,4" />
        ))}

        {/* Y labels */}
        {yLabels.map((price, i) => (
          <SvgText key={`y${i}`} x={padding.left - 8} y={getY(price) + 4} fill={colors.textMuted}
            fontSize={10} fontFamily="System" textAnchor="end">
            {formatCurrency(price, true)}
          </SvgText>
        ))}

        {/* X labels */}
        {xLabels.map(({ index, label }) => (
          <SvgText key={`x${index}`} x={getX(index)} y={height - 8} fill={colors.textMuted}
            fontSize={10} fontFamily="System" textAnchor="middle">{label}</SvgText>
        ))}

        {/* Zero line */}
        {chartMin < 0 && chartMax > 0 && (
          <Line x1={padding.left} y1={getY(0)} x2={width - padding.right} y2={getY(0)}
            stroke={colors.textMuted} strokeWidth={0.5} strokeDasharray="2,2" opacity={0.5} />
        )}

        {/* Area fill */}
        <Path d={fillPath} fill="url(#pnlGrad)" />

        {/* Line */}
        <Path d={linePath} stroke={lineColor} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Crosshair */}
        {tooltip && (
          <>
            <Line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={padding.top + chartHeight}
              stroke={colors.textSecondary} strokeWidth={1} strokeDasharray="3,3" />
            <Line x1={padding.left} y1={tooltip.y} x2={width - padding.right} y2={tooltip.y}
              stroke={colors.textSecondary} strokeWidth={1} strokeDasharray="3,3" />
            <Rect x={tooltip.x - 5} y={tooltip.y - 5} width={10} height={10} rx={5}
              fill={lineColor} opacity={0.8} />
          </>
        )}

        {/* Touch overlay */}
        <Rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight}
          fill="transparent"
          onPress={(e: any) => {
            if (e?.nativeEvent?.locationX !== undefined) {
              handleTouch(e.nativeEvent.locationX + padding.left);
            }
          }} />
      </Svg>

      {/* Timeframe selector */}
      <View style={styles.timeframes}>
        {autoRefresh && (
          <View style={styles.liveIndicator}>
            <Circle cx={4} cy={4} r={4} fill={colors.marketUp} opacity={0.8} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
        {TIMEFRAMES.map(tf => (
          <Pressable
            key={tf}
            style={[styles.timeframeBtn, timeframe === tf && styles.timeframeActive]}
            onPress={() => onTimeframeChange?.(tf)}
          >
            <Text style={[styles.timeframeText, timeframe === tf && styles.timeframeTextActive]}>{tf}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: FONTS.size.md,
    fontFamily: 'System',
  },
  tooltip: {
    position: 'absolute',
    top: SPACING.xs,
    zIndex: 10,
    backgroundColor: colors.bgCardLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 110,
  },
  tooltipValue: {
    fontSize: FONTS.size.md,
    fontFamily: 'System',
    fontWeight: '700',
  },
  tooltipDate: {
    color: colors.textSecondary,
    fontSize: FONTS.size.xs,
    fontFamily: 'System',
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#00C85315',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00C853',
    letterSpacing: 0.8,
  },
  timeframes: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  timeframeBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  timeframeActive: {
    backgroundColor: colors.primary + '25',
  },
  timeframeText: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  timeframeTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
