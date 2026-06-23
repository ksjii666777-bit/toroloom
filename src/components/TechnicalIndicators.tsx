import React, { useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, PanResponder } from 'react-native';
import Svg, { Path, Line, Rect, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';
import { useChartCrosshair } from './ChartCrosshairContext';
import type { StockHistoryPoint } from '../types';

// ============================================================================
// Indicator Computation Functions (pure math — no dependencies)
// ============================================================================

/** RSI — Relative Strength Index (14-period default) */
function computeRSI(closes: number[], period = 14): (number | null)[] {
  const rsi: (number | null)[] = [];
  if (closes.length < period + 1) return closes.map(() => null);

  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      rsi.push(null);
      continue;
    }
    let gains = 0, losses = 0;
    for (let j = i - period; j < i; j++) {
      const diff = closes[j + 1] - closes[j];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }
  }
  return rsi;
}

/** MACD — Moving Average Convergence Divergence (12, 26, 9) */
function computeMACD(closes: number[]): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const fast = 12, slow = 26, signalPeriod = 9;

  const ema = (data: number[], period: number): (number | null)[] => {
    const result: (number | null)[] = [];
    const multiplier = 2 / (period + 1);
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }
      if (i === period - 1) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += data[j];
        result.push(sum / period);
      } else {
        const prev = result[i - 1];
        if (prev !== null) {
          result.push((data[i] - prev) * multiplier + prev);
        } else {
          result.push(null);
        }
      }
    }
    return result;
  };

  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine.push(emaFast[i]! - emaSlow[i]!);
    } else {
      macdLine.push(null);
    }
  }

  const validMACD = macdLine.filter((v): v is number => v !== null);
  const signalLine = ema(validMACD, signalPeriod);

  const paddedSignal: (number | null)[] = [];
  let signalIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      paddedSignal.push(null);
    } else {
      paddedSignal.push(signalLine[signalIdx] ?? null);
      signalIdx++;
    }
  }

  const histogram: (number | null)[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null && paddedSignal[i] !== null) {
      histogram.push(macdLine[i]! - paddedSignal[i]!);
    } else {
      histogram.push(null);
    }
  }

  return { macd: macdLine, signal: paddedSignal, histogram };
}

/** Bollinger Bands (20-period, 2 standard deviations) */
function computeBollinger(closes: number[], period = 20, stdDev = 2): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const upper: (number | null)[] = [];
  const middle: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
      continue;
    }

    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    const avg = sum / period;

    let squaredDiff = 0;
    for (let j = i - period + 1; j <= i; j++) squaredDiff += (closes[j] - avg) ** 2;
    const std = Math.sqrt(squaredDiff / period);

    middle.push(avg);
    upper.push(avg + stdDev * std);
    lower.push(avg - stdDev * std);
  }

  return { upper, middle, lower };
}

// ============================================================================
// Indicator Panel Sizes
// ============================================================================

const PANEL_HEIGHT = 120;
const CHART_PADDING = { top: 16, right: 12, bottom: 20, left: 52 };

// ============================================================================
// Indicator ID type
// ============================================================================

export type IndicatorType = 'rsi' | 'macd' | 'bollinger';

// ============================================================================
// Crosshair vertical line overlay — shared by all panels
// ============================================================================

function CrosshairLine({
  index,
  dataLength,
  width,
  colors,
  chartH,
}: {
  index: number | null;
  dataLength: number;
  width: number;
  colors: any;
  chartH: number;
}) {
  if (index === null || dataLength < 2) return null;
  const pad = CHART_PADDING;
  const chartW = width - pad.left - pad.right;
  const x = pad.left + (index / (dataLength - 1)) * chartW;
  return (
    <>
      <Line
        x1={x} y1={pad.top}
        x2={x} y2={pad.top + chartH}
        stroke={colors.textSecondary}
        strokeWidth={1}
        strokeDasharray="4,4"
        opacity={0.7}
      />
      <Line
        x1={x} y1={pad.top}
        x2={x} y2={pad.top + chartH}
        stroke={colors.textSecondary}
        strokeWidth={0.5}
        opacity={0.3}
      />
    </>
  );
}

// ============================================================================
// Touch overlay for updating crosshair
// ============================================================================

function useCrosshairTouch(dataLength: number, width: number, onIndexChange: (index: number | null) => void) {
  const pad = CHART_PADDING;
  const chartW = width - pad.left - pad.right;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const x = e.nativeEvent.locationX;
      const relativeX = x - pad.left;
      const index = Math.round((relativeX / chartW) * (dataLength - 1));
      onIndexChange(Math.max(0, Math.min(dataLength - 1, index)));
    },
    onPanResponderMove: (e) => {
      const x = e.nativeEvent.locationX;
      const relativeX = x - pad.left;
      const index = Math.round((relativeX / chartW) * (dataLength - 1));
      onIndexChange(Math.max(0, Math.min(dataLength - 1, index)));
    },
  }), [dataLength, width, onIndexChange, pad.left, chartW]);

  return panResponder;
}

// ============================================================================
// RSI Panel
// ============================================================================

const RSIPanel = React.memo(({
  data,
  colors,
  width,
}: {
  data: { rsi: (number | null)[] };
  colors: any;
  width: number;
}) => {
  const { rsi } = data;
  const { focusedIndex, setFocusedIndex } = useChartCrosshair();
  const panelHeight = PANEL_HEIGHT;
  const pad = CHART_PADDING;
  const chartW = width - pad.left - pad.right;
  const chartH = panelHeight - pad.top - pad.bottom;

  const validPoints = rsi.filter((v): v is number => v !== null);
  if (validPoints.length < 2) {
    return (
      <View style={[indicatorStyles.panel, { height: panelHeight, width, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        <Text style={[indicatorStyles.emptyText, { color: colors.textMuted }]}>Not enough data</Text>
      </View>
    );
  }

  const getX = (i: number) => pad.left + (i / (rsi.length - 1)) * chartW;
  const getY = (val: number) => pad.top + ((100 - val) / 100) * chartH;

  // Build RSI line path
  let rsiPath = '';
  for (let i = 0; i < rsi.length; i++) {
    if (rsi[i] === null) continue;
    const x = getX(i);
    const y = getY(rsi[i]!);
    rsiPath += rsiPath ? ` L ${x} ${y}` : `M ${x} ${y}`;
  }

  const lastRSI = validPoints[validPoints.length - 1];
  const isOverbought = lastRSI > 70;
  const isOversold = lastRSI < 30;

  // Crosshair value
  const crosshairRSI = focusedIndex !== null && rsi[focusedIndex] !== null
    ? rsi[focusedIndex] : null;

  const touchPan = useCrosshairTouch(rsi.length, width, setFocusedIndex);

  return (
    <View style={[indicatorStyles.panel, { height: panelHeight, width, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
      <View style={indicatorStyles.panelHeader}>
        <Text style={[indicatorStyles.panelTitle, { color: colors.textMuted }]}>RSI (14)</Text>
        <Text style={[indicatorStyles.panelValue, {
          color: crosshairRSI !== null
            ? (crosshairRSI > 70 ? colors.marketDown : crosshairRSI < 30 ? colors.marketUp : colors.text)
            : (isOverbought ? colors.marketDown : isOversold ? colors.marketUp : colors.text),
        }]}>
          {crosshairRSI !== null ? crosshairRSI.toFixed(1) : lastRSI.toFixed(1)}
        </Text>
        <Text style={[indicatorStyles.panelStatus, { color: colors.textMuted }]}>
          {crosshairRSI !== null
            ? (crosshairRSI > 70 ? 'Overbought' : crosshairRSI < 30 ? 'Oversold' : 'Neutral')
            : (isOverbought ? 'Overbought' : isOversold ? 'Oversold' : 'Neutral')}
        </Text>
      </View>
      <View {...touchPan.panHandlers} style={{ flex: 1 }}>
        <Svg width={width} height={panelHeight}>
          {/* Overbought line */}
          <Line x1={pad.left} y1={getY(70)} x2={width - pad.right} y2={getY(70)}
            stroke={colors.marketDown} strokeWidth={0.5} strokeDasharray="3,3" opacity={0.5} />
          {/* Oversold line */}
          <Line x1={pad.left} y1={getY(30)} x2={width - pad.right} y2={getY(30)}
            stroke={colors.marketUp} strokeWidth={0.5} strokeDasharray="3,3" opacity={0.5} />
          {/* Mid line */}
          <Line x1={pad.left} y1={getY(50)} x2={width - pad.right} y2={getY(50)}
            stroke={colors.borderLight} strokeWidth={0.5} opacity={0.3} />
          {/* RSI Line */}
          <Path d={rsiPath} stroke={colors.accent} strokeWidth={1.5} fill="none" />
          {/* End dot */}
          <Circle cx={getX(rsi.length - 1)} cy={getY(lastRSI)} r={3}
            fill={isOverbought ? colors.marketDown : isOversold ? colors.marketUp : colors.accent} />
          {/* Crosshair line */}
          <CrosshairLine index={focusedIndex} dataLength={rsi.length} width={width} colors={colors} chartH={chartH} />
          {/* Crosshair value dot */}
          {crosshairRSI !== null && (
            <Circle
              cx={getX(focusedIndex!)}
              cy={getY(crosshairRSI)}
              r={4}
              fill={colors.accent}
              stroke={colors.bg}
              strokeWidth={1.5}
            />
          )}
        </Svg>
      </View>
    </View>
  );
});

// ============================================================================
// MACD Panel
// ============================================================================

const MACDPanel = React.memo(({
  data,
  colors,
  width,
}: {
  data: ReturnType<typeof computeMACD>;
  colors: any;
  width: number;
}) => {
  const { macd, signal, histogram } = data;
  const { focusedIndex, setFocusedIndex } = useChartCrosshair();
  const panelHeight = PANEL_HEIGHT;
  const pad = CHART_PADDING;
  const chartW = width - pad.left - pad.right;
  const chartH = panelHeight - pad.top - pad.bottom;

  const allValues = [
    ...macd.filter((v): v is number => v !== null),
    ...signal.filter((v): v is number => v !== null),
    ...histogram.filter((v): v is number => v !== null),
  ];
  if (allValues.length < 2) {
    return (
      <View style={[indicatorStyles.panel, { height: panelHeight, width, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        <Text style={[indicatorStyles.emptyText, { color: colors.textMuted }]}>Not enough data</Text>
      </View>
    );
  }

  const maxVal = Math.max(...allValues.map(Math.abs)) * 1.1 || 1;
  const getX = (i: number) => pad.left + (i / (macd.length - 1)) * chartW;
  const getY = (val: number) => pad.top + chartH / 2 - (val / maxVal) * (chartH / 2 * 0.9);

  // Build MACD line path
  let macdPath = '';
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] === null) continue;
    const x = getX(i);
    const y = getY(macd[i]!);
    macdPath += macdPath ? ` L ${x} ${y}` : `M ${x} ${y}`;
  }

  // Build Signal line path
  let signalPath = '';
  for (let i = 0; i < signal.length; i++) {
    if (signal[i] === null) continue;
    const x = getX(i);
    const y = getY(signal[i]!);
    signalPath += signalPath ? ` L ${x} ${y}` : `M ${x} ${y}`;
  }

  const lastMACD = macd.filter((v): v is number => v !== null).pop() || 0;
  const lastSignal = signal.filter((v): v is number => v !== null).pop() || 0;

  // Crosshair values
  const crosshairMACD = focusedIndex !== null && macd[focusedIndex] !== null ? macd[focusedIndex] : null;
  const crosshairSignal = focusedIndex !== null && signal[focusedIndex] !== null ? signal[focusedIndex] : null;

  const touchPan = useCrosshairTouch(macd.length, width, setFocusedIndex);

  return (
    <View style={[indicatorStyles.panel, { height: panelHeight, width, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
      <View style={indicatorStyles.panelHeader}>
        <Text style={[indicatorStyles.panelTitle, { color: colors.textMuted }]}>MACD (12,26,9)</Text>
        <Text style={[indicatorStyles.panelValue, {
          color: (crosshairMACD ?? lastMACD) >= 0 ? colors.marketUp : colors.marketDown,
          fontSize: 12,
        }]}>
          {(crosshairMACD ?? lastMACD) >= 0 ? '+' : ''}{(crosshairMACD ?? lastMACD).toFixed(1)}
        </Text>
        <Text style={[indicatorStyles.panelValue, { color: colors.textSecondary, fontSize: 11 }]}>
          Signal: {(crosshairSignal ?? lastSignal).toFixed(1)}
        </Text>
      </View>
      <View {...touchPan.panHandlers} style={{ flex: 1 }}>
        <Svg width={width} height={panelHeight}>
          {/* Zero line */}
          <Line x1={pad.left} y1={getY(0)} x2={width - pad.right} y2={getY(0)}
            stroke={colors.borderLight} strokeWidth={0.5} strokeDasharray="3,3" opacity={0.4} />

          {/* Histogram bars */}
          {histogram.map((val, i) => {
            if (val === null) return null;
            const x = getX(i);
            const barWidth = Math.max(chartW / histogram.length * 0.6, 1);
            const isPos = val >= 0;
            const y0 = getY(0);
            const yVal = getY(val);
            return (
              <Rect
                key={`hist-${i}`}
                x={x - barWidth / 2}
                y={isPos ? yVal : y0}
                width={barWidth}
                height={Math.max(Math.abs(yVal - y0), 1)}
                fill={isPos ? colors.marketUp : colors.marketDown}
                opacity={0.6}
                rx={0.5}
              />
            );
          })}

          {/* MACD line */}
          <Path d={macdPath} stroke={colors.primary} strokeWidth={1.5} fill="none" />
          {/* Signal line */}
          <Path d={signalPath} stroke={colors.warning} strokeWidth={1.5} fill="none" />

          {/* Crosshair line */}
          <CrosshairLine index={focusedIndex} dataLength={macd.length} width={width} colors={colors} chartH={chartH} />

          {/* Crosshair value dots */}
          {crosshairMACD !== null && (
            <Circle cx={getX(focusedIndex!)} cy={getY(crosshairMACD)} r={3}
              fill={colors.primary} stroke={colors.bg} strokeWidth={1.5} />
          )}
          {crosshairSignal !== null && (
            <Circle cx={getX(focusedIndex!)} cy={getY(crosshairSignal)} r={3}
              fill={colors.warning} stroke={colors.bg} strokeWidth={1.5} />
          )}
        </Svg>
      </View>
    </View>
  );
});

// ============================================================================
// Bollinger Bands Panel
// ============================================================================

const BollingerPanel = React.memo(({
  data,
  colors,
  width,
  candleData,
}: {
  data: ReturnType<typeof computeBollinger>;
  colors: any;
  width: number;
  candleData: StockHistoryPoint[];
}) => {
  const { upper, middle, lower } = data;
  const { focusedIndex, setFocusedIndex } = useChartCrosshair();
  const panelHeight = PANEL_HEIGHT;
  const pad = CHART_PADDING;
  const chartW = width - pad.left - pad.right;
  const chartH = panelHeight - pad.top - pad.bottom;

  const validUpper = upper.filter((v): v is number => v !== null);
  if (validUpper.length < 2) {
    return (
      <View style={[indicatorStyles.panel, { height: panelHeight, width, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        <Text style={[indicatorStyles.emptyText, { color: colors.textMuted }]}>Not enough data</Text>
      </View>
    );
  }

  const allPrices = [
    ...upper.filter((v): v is number => v !== null),
    ...middle.filter((v): v is number => v !== null),
    ...lower.filter((v): v is number => v !== null),
    ...candleData.slice(-upper.length).map(d => d.close),
  ];
  const minP = Math.min(...allPrices) * 0.995;
  const maxP = Math.max(...allPrices) * 1.005;
  const range = maxP - minP || 1;

  const getX = (i: number) => pad.left + (i / (upper.length - 1)) * chartW;
  const getY = (price: number) => pad.top + ((maxP - price) / range) * chartH;

  const buildPath = (arr: (number | null)[]) => {
    let path = '';
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === null) continue;
      const x = getX(i);
      const y = getY(arr[i]!);
      path += path ? ` L ${x} ${y}` : `M ${x} ${y}`;
    }
    return path;
  };

  const upperPath = buildPath(upper);
  const middlePath = buildPath(middle);
  const lowerPath = buildPath(lower);

  let fillPath = upperPath;
  let firstUpperIdx = -1, lastUpperIdx = -1;
  for (let i = 0; i < upper.length; i++) {
    if (upper[i] !== null) {
      if (firstUpperIdx === -1) firstUpperIdx = i;
      lastUpperIdx = i;
    }
  }
  if (fillPath && firstUpperIdx >= 0 && lastUpperIdx >= 0) {
    let revPath = '';
    for (let i = lower.length - 1; i >= 0; i--) {
      if (lower[i] === null) continue;
      const x = getX(i);
      const y = getY(lower[i]!);
      revPath += ` L ${x} ${y}`;
    }
    fillPath = `${fillPath}${revPath} Z`;
  }

  const lastUpperVal = upper.filter((v): v is number => v !== null).pop() || 0;
  const lastLowerVal = lower.filter((v): v is number => v !== null).pop() || 0;

  // Crosshair values
  const crosshairUpper = focusedIndex !== null && upper[focusedIndex] !== null ? upper[focusedIndex] : null;
  const crosshairLower = focusedIndex !== null && lower[focusedIndex] !== null ? lower[focusedIndex] : null;

  const touchPan = useCrosshairTouch(upper.length, width, setFocusedIndex);

  return (
    <View style={[indicatorStyles.panel, { height: panelHeight, width, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
      <View style={indicatorStyles.panelHeader}>
        <Text style={[indicatorStyles.panelTitle, { color: colors.textMuted }]}>Bollinger (20,2)</Text>
        <Text style={[indicatorStyles.panelValue, { fontSize: 11, color: colors.text }]}>
          U: {formatCurrency(crosshairUpper ?? lastUpperVal, true)}
        </Text>
        <Text style={[indicatorStyles.panelValue, { fontSize: 11, color: colors.textSecondary }]}>
          L: {formatCurrency(crosshairLower ?? lastLowerVal, true)}
        </Text>
      </View>
      <View {...touchPan.panHandlers} style={{ flex: 1 }}>
        <Svg width={width} height={panelHeight}>
          <Defs>
            <LinearGradient id="bbFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.08" />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {/* Fill area between bands */}
          {fillPath && <Path d={fillPath} fill="url(#bbFill)" />}

          {/* Upper band */}
          <Path d={upperPath} stroke={colors.primary} strokeWidth={1} fill="none" strokeDasharray="4,2" opacity={0.7} />
          {/* Middle band (SMA 20) */}
          <Path d={middlePath} stroke={colors.warning} strokeWidth={1.5} fill="none" />
          {/* Lower band */}
          <Path d={lowerPath} stroke={colors.primary} strokeWidth={1} fill="none" strokeDasharray="4,2" opacity={0.7} />

          {/* Close price overlay */}
          {(() => {
            const offset = upper.length - candleData.length;
            let closePath = '';
            for (let i = 0; i < candleData.length; i++) {
              const idx = offset + i;
              if (idx < 0 || idx >= upper.length) continue;
              if (upper[idx] === null) continue;
              const x = getX(idx);
              const y = getY(candleData[i].close);
              closePath += closePath ? ` L ${x} ${y}` : `M ${x} ${y}`;
            }
            return closePath ? (
              <Path d={closePath} stroke={colors.text} strokeWidth={1.5} fill="none" opacity={0.8} />
            ) : null;
          })()}

          {/* Crosshair line */}
          <CrosshairLine index={focusedIndex} dataLength={upper.length} width={width} colors={colors} chartH={chartH} />

          {/* Crosshair value dots on upper/lower bands */}
          {crosshairUpper !== null && (
            <Circle cx={getX(focusedIndex!)} cy={getY(crosshairUpper)} r={3}
              fill={colors.primary} stroke={colors.bg} strokeWidth={1.5} opacity={0.8} />
          )}
          {crosshairLower !== null && (
            <Circle cx={getX(focusedIndex!)} cy={getY(crosshairLower)} r={3}
              fill={colors.primary} stroke={colors.bg} strokeWidth={1.5} opacity={0.8} />
          )}
        </Svg>
      </View>
    </View>
  );
});

// ============================================================================
// Main TechnicalIndicators Component
// ============================================================================

interface TechnicalIndicatorsProps {
  data: StockHistoryPoint[];
  width?: number;
  /** Which indicators to show (default: all) */
  indicators?: IndicatorType[];
  /** Called when user taps an indicator toggle */
  onIndicatorToggle?: (type: IndicatorType) => void;
  /** Compact mode (smaller panels, no headers) */
  compact?: boolean;
}

export default function TechnicalIndicators({
  data,
  width = Dimensions.get('window').width - 48,
  indicators,
  onIndicatorToggle,
  compact: _compact = false,
}: TechnicalIndicatorsProps) {
  const { colors } = useTheme();

  // Extract close prices
  const closes = useMemo(() => data.map(d => d.close), [data]);

  // Compute all indicators
  const rsiData = useMemo(() => ({ rsi: computeRSI(closes) }), [closes]);
  const macdData = useMemo(() => computeMACD(closes), [closes]);
  const bbData = useMemo(() => computeBollinger(closes), [closes]);

  // Toggle state (if not controlled by parent)
  const [localIndicators, setLocalIndicators] = useState<IndicatorType[]>(['rsi', 'macd', 'bollinger']);
  const activeIndicators = indicators || localIndicators;

  const toggleIndicator = useCallback((type: IndicatorType) => {
    if (onIndicatorToggle) {
      onIndicatorToggle(type);
    } else {
      setLocalIndicators(prev =>
        prev.includes(type) ? prev.filter(i => i !== type) : [...prev, type]
      );
    }
  }, [onIndicatorToggle]);

  if (!data || data.length < 15) {
    return (
      <View style={indicatorStyles.emptyContainer}>
        <Text style={[indicatorStyles.emptyText, { color: colors.textMuted }]}>
          Need at least 15 data points for indicators
        </Text>
      </View>
    );
  }

  const panelWidth = width - SPACING.md * 2;

  return (
    <View style={indicatorStyles.container}>
      {/* Toggle chips */}
      <View style={indicatorStyles.toggleRow}>
        {(['rsi', 'macd', 'bollinger'] as IndicatorType[]).map(type => {
          const isActive = activeIndicators.includes(type);
          return (
            <TouchableOpacity
              key={type}
              style={[
                indicatorStyles.toggleChip,
                isActive && indicatorStyles.toggleChipActive,
                { backgroundColor: isActive ? colors.primary + '20' : colors.bgInput, borderColor: isActive ? colors.primary : colors.border },
              ]}
              onPress={() => toggleIndicator(type)}
            >
              <Text style={[
                indicatorStyles.toggleText,
                isActive && indicatorStyles.toggleTextActive,
                { color: isActive ? colors.primary : colors.textMuted },
              ]}>
                {type === 'rsi' ? 'RSI' : type === 'macd' ? 'MACD' : 'Bollinger'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Indicator panels */}
      <View style={indicatorStyles.panels}>
        {activeIndicators.includes('rsi') && (
          <RSIPanel data={rsiData} colors={colors} width={panelWidth} />
        )}
        {activeIndicators.includes('macd') && (
          <MACDPanel data={macdData} colors={colors} width={panelWidth} />
        )}
        {activeIndicators.includes('bollinger') && (
          <BollingerPanel data={bbData} colors={colors} width={panelWidth} candleData={data} />
        )}
      </View>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const indicatorStyles = StyleSheet.create({
  container: {
    marginTop: SPACING.md,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  toggleChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  toggleChipActive: {},
  toggleText: {
    fontFamily: 'System',
    fontSize: FONTS.size.sm,
    fontWeight: '600',
  },
  toggleTextActive: {},
  panels: {
    gap: SPACING.sm,
  },
  panel: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    paddingTop: SPACING.sm,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: 4,
  },
  panelTitle: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  panelValue: {
    fontFamily: 'System',
    fontSize: FONTS.size.sm,
    fontWeight: '700',
  },
  panelStatus: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'System',
    fontSize: FONTS.size.sm,
  },
});
