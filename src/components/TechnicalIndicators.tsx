/**
 * ============================================================================
 * Toroloom — Technical Indicators Panel
 * ============================================================================
 *
 * Renders configurable sub-panels below the main candlestick chart:
 *   - RSI (14)  — overbought/oversold zones with gradient fill + divergence markers
 *   - MACD (12,26,9) — histogram + crossover signal markers
 *   - Bollinger Bands (20,2) — %B gauge + bandwidth squeeze detection
 *   - Stochastic (14,3,3) — %K/%D crossover signals
 *   - OBV (On-Balance Volume) — volume trend with divergence
 *
 * Each panel supports crosshair sync with the main chart via
 * ChartCrosshairContext.
 *
 * ============================================================================
 */

import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, PanResponder, Pressable } from 'react-native';
import Svg, { Path, Line, Rect, Defs, LinearGradient, Stop, Circle, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
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

/** Detect RSI divergences (bullish/bearish) */
function detectRSIDivergences(
  closes: number[],
  rsi: (number | null)[],
  lookback = 60,
): { index: number; type: 'bullish' | 'bearish' }[] {
  const divergences: { index: number; type: 'bullish' | 'bearish' }[] = [];
  if (closes.length < lookback) return divergences;

  const validRsi = rsi.map((v, i) => ({ i, v }))
    .filter(x => x.v !== null) as { i: number; v: number }[];

  if (validRsi.length < 10) return divergences;

  // Look for pivot lows (local minima) and pivot highs (local maxima)
  for (let i = 5; i < validRsi.length - 5; i++) {
    const curr = validRsi[i];
    const windowStart = Math.max(0, i - 20);
    const windowEnd = Math.min(validRsi.length - 1, i + 20);

    // Check for pivot low in RSI
    let isPivotLow = true;
    for (let j = windowStart; j <= windowEnd; j++) {
      if (j !== i && validRsi[j].v < curr.v) { isPivotLow = false; break; }
    }

    // Check for pivot low in price
    let isPricePivotLow = true;
    for (let j = Math.max(0, curr.i - 20); j <= Math.min(closes.length - 1, curr.i + 20); j++) {
      if (j !== curr.i && closes[j] < closes[curr.i]) { isPricePivotLow = false; break; }
    }

    // Bullish divergence: price makes lower low, RSI makes higher low
    if (isPivotLow && !isPricePivotLow && curr.i > lookback / 2) {
      divergences.push({ index: curr.i, type: 'bullish' });
    }

    // Check for pivot high in RSI
    let isPivotHigh = true;
    for (let j = windowStart; j <= windowEnd; j++) {
      if (j !== i && validRsi[j].v > curr.v) { isPivotHigh = false; break; }
    }

    // Check for pivot high in price
    let isPricePivotHigh = true;
    for (let j = Math.max(0, curr.i - 20); j <= Math.min(closes.length - 1, curr.i + 20); j++) {
      if (j !== curr.i && closes[j] > closes[curr.i]) { isPricePivotHigh = false; break; }
    }

    // Bearish divergence: price makes higher high, RSI makes lower high
    if (isPivotHigh && !isPricePivotHigh && curr.i > lookback / 2) {
      divergences.push({ index: curr.i, type: 'bearish' });
    }
  }

  return divergences.slice(-5); // Max 5 most recent
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

  const validMACD = macdLine.filter(v => v !== null) as number[];
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

/** Detect MACD crossover signals */
function detectMACDCrossovers(
  macd: (number | null)[],
  signal: (number | null)[],
): { index: number; type: 'bullish' | 'bearish' }[] {
  const crossovers: { index: number; type: 'bullish' | 'bearish' }[] = [];
  for (let i = 1; i < macd.length; i++) {
    if (macd[i] === null || signal[i] === null || macd[i - 1] === null || signal[i - 1] === null) continue;
    const prevDiff = macd[i - 1]! - signal[i - 1]!;
    const currDiff = macd[i]! - signal[i]!;
    if (prevDiff <= 0 && currDiff > 0) {
      crossovers.push({ index: i, type: 'bullish' });
    } else if (prevDiff >= 0 && currDiff < 0) {
      crossovers.push({ index: i, type: 'bearish' });
    }
  }
  return crossovers.slice(-10); // Last 10 crossovers
}

/** Bollinger Bands (20-period, 2 standard deviations) + %B + Bandwidth */
function computeBollinger(closes: number[], period = 20, stdDev = 2): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
  percentB: (number | null)[];
  bandwidth: (number | null)[];
} {
  const upper: (number | null)[] = [];
  const middle: (number | null)[] = [];
  const lower: (number | null)[] = [];
  const percentB: (number | null)[] = [];
  const bandwidth: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
      percentB.push(null);
      bandwidth.push(null);
      continue;
    }

    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    const avg = sum / period;

    let squaredDiff = 0;
    for (let j = i - period + 1; j <= i; j++) squaredDiff += (closes[j] - avg) ** 2;
    const std = Math.sqrt(squaredDiff / period);

    const upperVal = avg + stdDev * std;
    const lowerVal = avg - stdDev * std;

    middle.push(avg);
    upper.push(upperVal);
    lower.push(lowerVal);

    // %B = (Price - Lower) / (Upper - Lower)
    const bandWidth = upperVal - lowerVal;
    percentB.push(bandWidth > 0 ? (closes[i] - lowerVal) / bandWidth : 0.5);
    // Bandwidth = (Upper - Lower) / Middle
    bandwidth.push(avg > 0 ? bandWidth / avg : 0);
  }

  return { upper, middle, lower, percentB, bandwidth };
}

/** Detect Bollinger Band squeeze (low bandwidth for extended period) */
function detectBBSqueeze(bandwidth: (number | null)[], period = 20): boolean[] {
  const squeeze: boolean[] = [];
  const validBW = bandwidth.filter(v => v !== null) as number[];
  if (validBW.length < period) return bandwidth.map(() => false);

  // Calculate rolling average bandwidth
  for (let i = 0; i < bandwidth.length; i++) {
    if (bandwidth[i] === null) {
      squeeze.push(false);
      continue;
    }
    if (i < period) {
      squeeze.push(false);
      continue;
    }
    let sum = 0;
    let count = 0;
    for (let j = i - period; j < i; j++) {
      if (bandwidth[j] !== null) { sum += bandwidth[j]!; count++; }
    }
    const avg = count > 0 ? sum / count : 0;
    squeeze.push(bandwidth[i]! < avg * 0.75); // Below 75% of average = squeeze
  }
  return squeeze;
}

/** Stochastic Oscillator (14, 3, 3) */
function computeStochastic(data: StockHistoryPoint[], kPeriod = 14, dPeriod = 3): {
  k: (number | null)[];
  d: (number | null)[];
} {
  const k: (number | null)[] = [];
  const rawK: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < kPeriod - 1) {
      k.push(null);
      continue;
    }
    let lowest = Infinity, highest = -Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (data[j].low < lowest) lowest = data[j].low;
      if (data[j].high > highest) highest = data[j].high;
    }
    const range = highest - lowest;
    const val = range > 0 ? ((data[i].close - lowest) / range) * 100 : 50;
    rawK.push(val);
    k.push(val);
  }

  // %D = SMA of %K
  const d: (number | null)[] = [];
  for (let i = 0; i < k.length; i++) {
    if (i < dPeriod - 1 || k[i] === null) {
      d.push(null);
      continue;
    }
    let sum = 0;
    let count = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      if (k[j] !== null) { sum += k[j]!; count++; }
    }
    d.push(count > 0 ? sum / count : null);
  }

  return { k, d };
}

/** On-Balance Volume (OBV) */
function computeOBV(data: StockHistoryPoint[]): (number | null)[] {
  const obv: (number | null)[] = [];
  if (data.length === 0) return obv;

  obv.push(data[0].volume);
  for (let i = 1; i < data.length; i++) {
    const prev = obv[i - 1];
    if (prev === null) { obv.push(data[i].volume); continue; }

    if (data[i].close > data[i - 1].close) {
      obv.push(prev + data[i].volume);
    } else if (data[i].close < data[i - 1].close) {
      obv.push(prev - data[i].volume);
    } else {
      obv.push(prev);
    }
  }
  return obv;
}

// ============================================================================
// Indicator Panel Sizes
// ============================================================================

const PANEL_HEIGHT = 130;
const CHART_PADDING = { top: 16, right: 12, bottom: 20, left: 52 };

// ============================================================================
// Indicator ID type
// ============================================================================

export type IndicatorType = 'rsi' | 'macd' | 'bollinger' | 'stochastic' | 'obv';

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
  }), [dataLength, onIndexChange, pad.left, chartW]);

  return panResponder;
}

// ============================================================================
// RSI Panel (enhanced with gradient fill + divergence markers)
// ============================================================================

const RSIPanel = React.memo(({
  data,
  colors,
  width,
  closes,
}: {
  data: { rsi: (number | null)[] };
  colors: any;
  width: number;
  closes: number[];
}) => {
  const { rsi } = data;
  const { t } = useT();
  const { focusedIndex, setFocusedIndex } = useChartCrosshair();
  const panelHeight = PANEL_HEIGHT;
  const pad = CHART_PADDING;
  const chartW = width - pad.left - pad.right;
  const chartH = panelHeight - pad.top - pad.bottom;

  const touchPan = useCrosshairTouch(rsi.length, width, setFocusedIndex);

  const validPoints = rsi.filter(v => v !== null) as number[];
  if (validPoints.length < 2) {
    return (
      <View style={[indicatorStyles.panel, { height: panelHeight, width, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        <Text style={[indicatorStyles.emptyText, { color: colors.textMuted }]}>{t('components.stockAnalysis.notEnoughData')}</Text>
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

  // Build overbought gradient fill area (70-100 zone)
  const obY70 = getY(70);
  const obY100 = pad.top;
  let obFillPath = '';
  for (let i = 0; i < rsi.length; i++) {
    if (rsi[i] === null) continue;
    if (rsi[i]! > 70) {
      const x = getX(i);
      const y = Math.max(getY(Math.min(rsi[i]!, 100)), obY70);
      obFillPath += obFillPath ? ` L ${x} ${y}` : `M ${x} ${y}`;
    }
  }
  if (obFillPath) {
    // Close the path along y=70 line
    for (let i = rsi.length - 1; i >= 0; i--) {
      if (rsi[i] !== null && rsi[i]! > 70) {
        obFillPath += ` L ${getX(i)} ${obY70}`;
      }
    }
    obFillPath += ' Z';
  }

  // Build oversold gradient fill area (0-30 zone)
  const osY30 = getY(30);
  const osY0 = pad.top + chartH;
  let osFillPath = '';
  for (let i = 0; i < rsi.length; i++) {
    if (rsi[i] === null) continue;
    if (rsi[i]! < 30) {
      const x = getX(i);
      const y = Math.min(getY(Math.max(rsi[i]!, 0)), osY30);
      osFillPath += osFillPath ? ` L ${x} ${y}` : `M ${x} ${y}`;
    }
  }
  if (osFillPath) {
    for (let i = rsi.length - 1; i >= 0; i--) {
      if (rsi[i] !== null && rsi[i]! < 30) {
        osFillPath += ` L ${getX(i)} ${osY30}`;
      }
    }
    osFillPath += ' Z';
  }

  // Detect divergences
  const divergences = useMemo(() => detectRSIDivergences(closes, rsi), [closes, rsi]);

  const lastRSI = validPoints[validPoints.length - 1];
  const isOverbought = lastRSI > 70;
  const isOversold = lastRSI < 30;

  // Crosshair value
  const crosshairRSI = focusedIndex !== null && rsi[focusedIndex] !== null
    ? rsi[focusedIndex] : null;

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
          <Defs>
            <LinearGradient id="rsiOB" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.marketDown} stopOpacity="0.25" />
              <Stop offset="100%" stopColor={colors.marketDown} stopOpacity="0.05" />
            </LinearGradient>
            <LinearGradient id="rsiOS" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.marketUp} stopOpacity="0.05" />
              <Stop offset="100%" stopColor={colors.marketUp} stopOpacity="0.25" />
            </LinearGradient>
          </Defs>

          {/* Overbought zone fill */}
          {obFillPath ? <Path d={obFillPath} fill="url(#rsiOB)" /> : (
            <Rect x={pad.left} y={obY100} width={chartW} height={obY70 - obY100} fill={colors.marketDown} opacity={0.04} />
          )}

          {/* Oversold zone fill */}
          {osFillPath ? <Path d={osFillPath} fill="url(#rsiOS)" /> : (
            <Rect x={pad.left} y={obY70} width={chartW} height={osY0 - osY30} fill={colors.marketUp} opacity={0.04} />
          )}

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

          {/* Divergence markers */}
          {divergences.map((div, idx) => {
            const x = getX(div.index);
            const rsiVal = rsi[div.index];
            if (rsiVal === null) return null;
            const y = getY(rsiVal);
            const isBullish = div.type === 'bullish';
            return (
              <React.Fragment key={`div-${idx}`}>
                <Circle cx={x} cy={y} r={5} fill={isBullish ? colors.marketUp : colors.marketDown}
                  stroke="#fff" strokeWidth={1} opacity={0.9} />
                <SvgText
                  x={x + 7} y={y + 3}
                  fill={isBullish ? colors.marketUp : colors.marketDown}
                  fontSize={8} fontFamily="System" fontWeight="700"
                >
                  {isBullish ? '▲' : '▼'}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* End dot */}
          <Circle cx={getX(rsi.length - 1)} cy={getY(lastRSI)} r={3}
            fill={isOverbought ? colors.marketDown : isOversold ? colors.marketUp : colors.accent} />

          {/* Crosshair */}
          <CrosshairLine index={focusedIndex} dataLength={rsi.length} width={width} colors={colors} chartH={chartH} />
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
// MACD Panel (enhanced with crossover signals + gradient histogram)
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
  const { t } = useT();
  const { focusedIndex, setFocusedIndex } = useChartCrosshair();
  const panelHeight = PANEL_HEIGHT;
  const pad = CHART_PADDING;
  const chartW = width - pad.left - pad.right;
  const chartH = panelHeight - pad.top - pad.bottom;

  const allValues = [
    ...macd.filter(v => v !== null) as number[],
    ...signal.filter(v => v !== null) as number[],
    ...histogram.filter(v => v !== null) as number[],
  ];

  const touchPan = useCrosshairTouch(macd.length, width, setFocusedIndex);

  if (allValues.length < 2) {
    return (
      <View style={[indicatorStyles.panel, { height: panelHeight, width, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        <Text style={[indicatorStyles.emptyText, { color: colors.textMuted }]}>{t('components.stockAnalysis.notEnoughData')}</Text>
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

  // Detect crossover signals
  const crossovers = useMemo(() => detectMACDCrossovers(macd, signal), [macd, signal]);

  const lastMACD = macd.filter(v => v !== null).pop() || 0;
  const lastSignal = signal.filter(v => v !== null).pop() || 0;
  const lastHist = histogram.filter(v => v !== null).pop() || 0;

  // Crosshair values
  const crosshairMACD = focusedIndex !== null && macd[focusedIndex] !== null ? macd[focusedIndex] : null;
  const crosshairSignal = focusedIndex !== null && signal[focusedIndex] !== null ? signal[focusedIndex] : null;
  const crosshairHist = focusedIndex !== null && histogram[focusedIndex] !== null ? histogram[focusedIndex] : null;

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
          Sig: {(crosshairSignal ?? lastSignal).toFixed(1)}
        </Text>
        <Text style={[indicatorStyles.panelValue, {
          color: (crosshairHist ?? lastHist) >= 0 ? colors.marketUp : colors.marketDown,
          fontSize: 10,
        }]}>
          H: {(crosshairHist ?? lastHist) >= 0 ? '+' : ''}{(crosshairHist ?? lastHist).toFixed(1)}
        </Text>
      </View>
      <View {...touchPan.panHandlers} style={{ flex: 1 }}>
        <Svg width={width} height={panelHeight}>
          <Defs>
            <LinearGradient id="histGradUp" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.marketUp} stopOpacity="0.9" />
              <Stop offset="100%" stopColor={colors.marketUp} stopOpacity="0.3" />
            </LinearGradient>
            <LinearGradient id="histGradDown" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.marketDown} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={colors.marketDown} stopOpacity="0.9" />
            </LinearGradient>
          </Defs>

          {/* Zero line */}
          <Line x1={pad.left} y1={getY(0)} x2={width - pad.right} y2={getY(0)}
            stroke={colors.borderLight} strokeWidth={0.5} strokeDasharray="3,3" opacity={0.4} />

          {/* Histogram bars with gradient */}
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
                fill={isPos ? 'url(#histGradUp)' : 'url(#histGradDown)'}
                rx={0.5}
              />
            );
          })}

          {/* MACD line */}
          <Path d={macdPath} stroke={colors.primary} strokeWidth={1.5} fill="none" />
          {/* Signal line */}
          <Path d={signalPath} stroke={colors.warning} strokeWidth={1.5} fill="none" />

          {/* Crossover signal markers */}
          {crossovers.map((cross, idx) => {
            const x = getX(cross.index);
            const y = getY(0);
            const isBullish = cross.type === 'bullish';
            return (
              <React.Fragment key={`cross-${idx}`}>
                <Circle cx={x} cy={y - 6} r={4}
                  fill={isBullish ? colors.marketUp : colors.marketDown}
                  stroke="#fff" strokeWidth={1} opacity={0.9} />
                <SvgText x={x - 2} y={y - 3} fill="#fff" fontSize={6} fontWeight="700">
                  {isBullish ? '▲' : '▼'}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Crosshair */}
          <CrosshairLine index={focusedIndex} dataLength={macd.length} width={width} colors={colors} chartH={chartH} />
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
// Bollinger Bands Panel (enhanced with %B + squeeze detection)
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
  const { upper, middle, lower, percentB, bandwidth } = data;
  const { t } = useT();
  const { focusedIndex, setFocusedIndex } = useChartCrosshair();
  const panelHeight = PANEL_HEIGHT;
  const pad = CHART_PADDING;
  const chartW = width - pad.left - pad.right;
  const chartH = panelHeight - pad.top - pad.bottom;

  const touchPan = useCrosshairTouch(upper.length, width, setFocusedIndex);

  // Squeeze detection
  const squeeze = useMemo(() => detectBBSqueeze(bandwidth), [bandwidth]);
  const isSqueeze = focusedIndex !== null && squeeze[focusedIndex] ? true
    : squeeze.slice(-5).some(s => s);

  const validUpper = upper.filter(v => v !== null) as number[];
  if (validUpper.length < 2) {
    return (
      <View style={[indicatorStyles.panel, { height: panelHeight, width, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        <Text style={[indicatorStyles.emptyText, { color: colors.textMuted }]}>{t('components.stockAnalysis.notEnoughData')}</Text>
      </View>
    );
  }

  const allPrices = [
    ...upper.filter(v => v !== null) as number[],
    ...middle.filter(v => v !== null) as number[],
    ...lower.filter(v => v !== null) as number[],
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

  const lastUpperVal = upper.filter(v => v !== null).pop() || 0;
  const lastLowerVal = lower.filter(v => v !== null).pop() || 0;
  const lastPB = percentB.filter(v => v !== null).pop() || 0.5;

  // Crosshair values
  const crosshairUpper = focusedIndex !== null && upper[focusedIndex] !== null ? upper[focusedIndex] : null;
  const crosshairLower = focusedIndex !== null && lower[focusedIndex] !== null ? lower[focusedIndex] : null;
  const crosshairPB = focusedIndex !== null && percentB[focusedIndex] !== null ? percentB[focusedIndex] : null;

  return (
    <View style={[indicatorStyles.panel, { height: panelHeight, width, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
      <View style={indicatorStyles.panelHeader}>
        <Text style={[indicatorStyles.panelTitle, { color: colors.textMuted }]}>BB (20,2)</Text>
        <Text style={[indicatorStyles.panelValue, { fontSize: 11, color: colors.text }]}>
          U: {formatCurrency(crosshairUpper ?? lastUpperVal, true)}
        </Text>
        <Text style={[indicatorStyles.panelValue, { fontSize: 11, color: colors.textSecondary }]}>
          L: {formatCurrency(crosshairLower ?? lastLowerVal, true)}
        </Text>
        <Text style={[indicatorStyles.panelValue, {
          fontSize: 10, color: (crosshairPB ?? lastPB) > 0.8 ? colors.marketDown
            : (crosshairPB ?? lastPB) < 0.2 ? colors.marketUp : colors.text,
        }]}>
          %B: {(crosshairPB ?? lastPB).toFixed(2)}
        </Text>
        {isSqueeze && (
          <View style={[indicatorStyles.squeezeBadge, { backgroundColor: colors.warning + '25' }]}>
            <Text style={[indicatorStyles.squeezeText, { color: colors.warning }]}>SQUEEZE</Text>
          </View>
        )}
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

          {/* Crosshair */}
          <CrosshairLine index={focusedIndex} dataLength={upper.length} width={width} colors={colors} chartH={chartH} />
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
// Stochastic Panel (%K / %D with crossover signals)
// ============================================================================

const StochasticPanel = React.memo(({
  data,
  colors,
  width,
}: {
  data: ReturnType<typeof computeStochastic>;
  colors: any;
  width: number;
}) => {
  const { k, d } = data;
  const { focusedIndex, setFocusedIndex } = useChartCrosshair();
  const panelHeight = PANEL_HEIGHT;
  const pad = CHART_PADDING;
  const chartW = width - pad.left - pad.right;
  const chartH = panelHeight - pad.top - pad.bottom;

  const touchPan = useCrosshairTouch(k.length, width, setFocusedIndex);

  const validK = k.filter(v => v !== null) as number[];
  if (validK.length < 2) {
    return (
      <View style={[indicatorStyles.panel, { height: panelHeight, width, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        <Text style={[indicatorStyles.emptyText, { color: colors.textMuted }]}>Need more data</Text>
      </View>
    );
  }

  const getX = (i: number) => pad.left + (i / (k.length - 1)) * chartW;
  const getY = (val: number) => pad.top + ((100 - val) / 100) * chartH;

  // Build %K path
  let kPath = '';
  for (let i = 0; i < k.length; i++) {
    if (k[i] === null) continue;
    const x = getX(i);
    const y = getY(k[i]!);
    kPath += kPath ? ` L ${x} ${y}` : `M ${x} ${y}`;
  }

  // Build %D path
  let dPath = '';
  for (let i = 0; i < d.length; i++) {
    if (d[i] === null) continue;
    const x = getX(i);
    const y = getY(d[i]!);
    dPath += dPath ? ` L ${x} ${y}` : `M ${x} ${y}`;
  }

  const lastK = validK[validK.length - 1];
  const isOverbought = lastK > 80;
  const isOversold = lastK < 20;

  const crosshairK = focusedIndex !== null && k[focusedIndex] !== null ? k[focusedIndex] : null;
  const crosshairD = focusedIndex !== null && d[focusedIndex] !== null ? d[focusedIndex] : null;

  return (
    <View style={[indicatorStyles.panel, { height: panelHeight, width, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
      <View style={indicatorStyles.panelHeader}>
        <Text style={[indicatorStyles.panelTitle, { color: colors.textMuted }]}>STOCH (14,3,3)</Text>
        <Text style={[indicatorStyles.panelValue, {
          color: isOverbought ? colors.marketDown : isOversold ? colors.marketUp : colors.accent,
          fontSize: 12,
        }]}>
          %K: {(crosshairK ?? lastK).toFixed(1)}
        </Text>
        <Text style={[indicatorStyles.panelValue, { color: colors.warning, fontSize: 11 }]}>
          %D: {(crosshairD ?? (d.filter(v => v !== null).pop() || 50)).toFixed(1)}
        </Text>
        <Text style={[indicatorStyles.panelStatus, { color: colors.textMuted }]}>
          {isOverbought ? 'Overbought' : isOversold ? 'Oversold' : 'Neutral'}
        </Text>
      </View>
      <View {...touchPan.panHandlers} style={{ flex: 1 }}>
        <Svg width={width} height={panelHeight}>
          {/* Overbought zone */}
          <Rect x={pad.left} y={pad.top} width={chartW} height={((100 - 80) / 100) * chartH}
            fill={colors.marketDown} opacity={0.04} />
          {/* Oversold zone */}
          <Rect x={pad.left} y={pad.top + ((100 - 20) / 100) * chartH} width={chartW}
            height={(20 / 100) * chartH} fill={colors.marketUp} opacity={0.04} />

          {/* 80 line */}
          <Line x1={pad.left} y1={getY(80)} x2={width - pad.right} y2={getY(80)}
            stroke={colors.marketDown} strokeWidth={0.5} strokeDasharray="3,3" opacity={0.4} />
          {/* 20 line */}
          <Line x1={pad.left} y1={getY(20)} x2={width - pad.right} y2={getY(20)}
            stroke={colors.marketUp} strokeWidth={0.5} strokeDasharray="3,3" opacity={0.4} />

          {/* %K line */}
          <Path d={kPath} stroke={colors.accent} strokeWidth={1.5} fill="none" />
          {/* %D line */}
          <Path d={dPath} stroke={colors.warning} strokeWidth={1.5} fill="none" />

          {/* End dot */}
          <Circle cx={getX(k.length - 1)} cy={getY(lastK)} r={3}
            fill={isOverbought ? colors.marketDown : isOversold ? colors.marketUp : colors.accent} />

          {/* Crosshair */}
          <CrosshairLine index={focusedIndex} dataLength={k.length} width={width} colors={colors} chartH={chartH} />
          {crosshairK !== null && (
            <Circle cx={getX(focusedIndex!)} cy={getY(crosshairK)} r={4}
              fill={colors.accent} stroke={colors.bg} strokeWidth={1.5} />
          )}
          {crosshairD !== null && (
            <Circle cx={getX(focusedIndex!)} cy={getY(crosshairD)} r={3}
              fill={colors.warning} stroke={colors.bg} strokeWidth={1.5} />
          )}
        </Svg>
      </View>
    </View>
  );
});

// ============================================================================
// OBV Panel (On-Balance Volume)
// ============================================================================

const OBVPanel = React.memo(({
  data,
  colors,
  width,
}: {
  data: { obv: (number | null)[] };
  colors: any;
  width: number;
}) => {
  const { obv } = data;
  const { focusedIndex, setFocusedIndex } = useChartCrosshair();
  const panelHeight = PANEL_HEIGHT;
  const pad = CHART_PADDING;
  const chartW = width - pad.left - pad.right;
  const chartH = panelHeight - pad.top - pad.bottom;

  const touchPan = useCrosshairTouch(obv.length, width, setFocusedIndex);

  const validOBV = obv.filter(v => v !== null) as number[];
  if (validOBV.length < 2) {
    return (
      <View style={[indicatorStyles.panel, { height: panelHeight, width, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        <Text style={[indicatorStyles.emptyText, { color: colors.textMuted }]}>Need more data</Text>
      </View>
    );
  }

  const minOBV = Math.min(...validOBV);
  const maxOBV = Math.max(...validOBV);
  const range = maxOBV - minOBV || 1;

  const getX = (i: number) => pad.left + (i / (obv.length - 1)) * chartW;
  const getY = (val: number) => pad.top + ((maxOBV - val) / range) * chartH;

  // Build OBV path
  let obvPath = '';
  for (let i = 0; i < obv.length; i++) {
    if (obv[i] === null) continue;
    const x = getX(i);
    const y = getY(obv[i]!);
    obvPath += obvPath ? ` L ${x} ${y}` : `M ${x} ${y}`;
  }

  // Determine trend
  const lastOBV = validOBV[validOBV.length - 1];
  const prevOBV = validOBV.length > 10 ? validOBV[validOBV.length - 10] : validOBV[0];
  const isRising = lastOBV > prevOBV;

  const crosshairOBV = focusedIndex !== null && obv[focusedIndex] !== null ? obv[focusedIndex] : null;

  // Format large numbers
  const formatOBV = (v: number) => {
    if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return v.toFixed(0);
  };

  return (
    <View style={[indicatorStyles.panel, { height: panelHeight, width, borderColor: colors.border, backgroundColor: colors.bgCard }]}>
      <View style={indicatorStyles.panelHeader}>
        <Text style={[indicatorStyles.panelTitle, { color: colors.textMuted }]}>OBV</Text>
        <Text style={[indicatorStyles.panelValue, {
          color: isRising ? colors.marketUp : colors.marketDown,
          fontSize: 12,
        }]}>
          {formatOBV(crosshairOBV ?? lastOBV)}
        </Text>
        <Text style={[indicatorStyles.panelStatus, { color: isRising ? colors.marketUp : colors.marketDown }]}>
          {isRising ? '↑ Rising' : '↓ Falling'}
        </Text>
      </View>
      <View {...touchPan.panHandlers} style={{ flex: 1 }}>
        <Svg width={width} height={panelHeight}>
          <Defs>
            <LinearGradient id="obvFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={isRising ? colors.marketUp : colors.marketDown} stopOpacity="0.15" />
              <Stop offset="100%" stopColor={isRising ? colors.marketUp : colors.marketDown} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {/* Fill area under OBV */}
          {obvPath && (() => {
            let fillP = obvPath;
            fillP += ` L ${getX(obv.length - 1)} ${pad.top + chartH}`;
            fillP += ` L ${getX(0)} ${pad.top + chartH} Z`;
            return <Path d={fillP} fill="url(#obvFill)" />;
          })()}

          {/* OBV line */}
          <Path d={obvPath} stroke={isRising ? colors.marketUp : colors.marketDown} strokeWidth={1.5} fill="none" />

          {/* End dot */}
          <Circle cx={getX(obv.length - 1)} cy={getY(lastOBV)} r={3}
            fill={isRising ? colors.marketUp : colors.marketDown} />

          {/* Crosshair */}
          <CrosshairLine index={focusedIndex} dataLength={obv.length} width={width} colors={colors} chartH={chartH} />
          {crosshairOBV !== null && (
            <Circle cx={getX(focusedIndex!)} cy={getY(crosshairOBV)} r={4}
              fill={colors.accent} stroke={colors.bg} strokeWidth={1.5} />
          )}
        </Svg>
      </View>
    </View>
  );
});

// ============================================================================
// Indicator config — icons, labels
// ============================================================================

const INDICATOR_CONFIG: Record<IndicatorType, { label: string; icon: string }> = {
  rsi: { label: 'RSI', icon: '📊' },
  macd: { label: 'MACD', icon: '📈' },
  bollinger: { label: 'BB', icon: '📏' },
  stochastic: { label: 'STOCH', icon: '🎯' },
  obv: { label: 'OBV', icon: '📦' },
};

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
  const { t } = useT();

  // Extract close prices
  const closes = useMemo(() => data.map(d => d.close), [data]);

  // Compute all indicators
  const rsiData = useMemo(() => ({ rsi: computeRSI(closes) }), [closes]);
  const macdData = useMemo(() => computeMACD(closes), [closes]);
  const bbData = useMemo(() => computeBollinger(closes), [closes]);
  const stochData = useMemo(() => computeStochastic(data), [data]);
  const obvData = useMemo(() => ({ obv: computeOBV(data) }), [data]);

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
          {t('components.stockAnalysis.needDataPoints')}
        </Text>
      </View>
    );
  }

  const panelWidth = width - SPACING.md * 2;

  return (
    <View style={indicatorStyles.container}>
      {/* Toggle chips with count badge */}
      <View style={indicatorStyles.toggleRow}>
        <Text style={[indicatorStyles.toggleLabel, { color: colors.textMuted }]}>
          Indicators
        </Text>
        <View style={indicatorStyles.toggleChips}>
          {(Object.keys(INDICATOR_CONFIG) as IndicatorType[]).map(type => {
            const isActive = activeIndicators.includes(type);
            const cfg = INDICATOR_CONFIG[type];
            return (
              <Pressable
                key={type}
                style={[
                  indicatorStyles.toggleChip,
                  isActive && indicatorStyles.toggleChipActive,
                  { backgroundColor: isActive ? colors.primary + '20' : colors.bgInput, borderColor: isActive ? colors.primary : colors.border },
                ]}
                onPress={() => toggleIndicator(type)}
              >
                <Text style={indicatorStyles.toggleIcon}>{cfg.icon}</Text>
                <Text style={[
                  indicatorStyles.toggleText,
                  isActive && indicatorStyles.toggleTextActive,
                  { color: isActive ? colors.primary : colors.textMuted },
                ]}>
                  {cfg.label}
                </Text>
                {isActive && <View style={[indicatorStyles.activeIndicator, { backgroundColor: colors.primary }]} />}
              </Pressable>
            );
          })}
        </View>
        {activeIndicators.length > 0 && (
          <View style={[indicatorStyles.countBadge, { backgroundColor: colors.primary }]}>
            <Text style={[indicatorStyles.countText, { color: colors.white || '#fff' }]}>{activeIndicators.length}</Text>
          </View>
        )}
      </View>

      {/* Indicator panels */}
      <View style={indicatorStyles.panels}>
        {activeIndicators.includes('rsi') && (
          <RSIPanel data={rsiData} colors={colors} width={panelWidth} closes={closes} />
        )}
        {activeIndicators.includes('macd') && (
          <MACDPanel data={macdData} colors={colors} width={panelWidth} />
        )}
        {activeIndicators.includes('bollinger') && (
          <BollingerPanel data={bbData} colors={colors} width={panelWidth} candleData={data} />
        )}
        {activeIndicators.includes('stochastic') && (
          <StochasticPanel data={stochData} colors={colors} width={panelWidth} />
        )}
        {activeIndicators.includes('obv') && (
          <OBVPanel data={obvData} colors={colors} width={panelWidth} />
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
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    flexWrap: 'wrap',
  },
  toggleLabel: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 2,
  },
  toggleChips: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 1,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  toggleChipActive: {},
  toggleIcon: {
    fontSize: 10,
  },
  toggleText: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '600',
  },
  toggleTextActive: {},
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: 2,
  },
  countBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'System',
  },
  squeezeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.full,
    marginLeft: 4,
  },
  squeezeText: {
    fontSize: 8,
    fontWeight: '800',
    fontFamily: 'System',
    letterSpacing: 0.5,
  },
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
