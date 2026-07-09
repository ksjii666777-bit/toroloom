/**
 * ============================================================================
 * Toroloom — Skia Candlestick Chart
 * ============================================================================
 *
 * High-performance candlestick chart renderer using @shopify/react-native-skia.
 * Hardware-accelerated via GPU — handles 10,000+ candles at 60fps.
 *
 * Renders: candles, wicks, volume bars, grid, axes, crosshair, MA lines,
 *          line chart, area chart, Heikin-Ashi candles, area gradient fills,
 *          and pattern detection overlays.
 *
 * ⚠️ Requires development build (not Expo Go) for native Skia module.
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Canvas,
  Path,
  Rect,
  Line,
  vec,
  LinearGradient,
  Circle,
  Group,
} from '@shopify/react-native-skia';
import { useTheme } from '../../context/ThemeContext';
import { FONTS, BORDER_RADIUS, SPACING } from '../../constants/theme';
import { formatCurrency, formatCompactNumber } from '../../utils/formatters';
import { useChartCrosshair } from '../ChartCrosshairContext';
import { getPatternColor, type DetectedPattern } from './patternDetection';
import type { StockHistoryPoint } from '../../types';

import {
  computeChartLayout,
  computeVisibleData,
  computePriceRange,
  computeMaxVolume,
  computeYLabels,
  computeXLabels,
  computeHeikinAshi,
  computeMA,
  createGetX,
  createGetY,
  createGetVolumeY,
  isBullish,
  CANDLE_WIDTH_RATIO,
  CANDLE_MIN_WIDTH,
  type ChartLayout,
  type PriceRange,
} from './SkiaChartUtils';

// ============================================================================
// Chart Type
// ============================================================================

export type SkiaChartType = 'candlestick' | 'line' | 'area' | 'heikin_ashi';

// ============================================================================
// Candle Props
// ============================================================================

interface CandleProps {
  x: number;
  candleX: number;
  candleWidth: number;
  open: number;
  high: number;
  low: number;
  close: number;
  yTop: number;
  yBottom: number;
  yHigh: number;
  yLow: number;
  bodyHeight: number;
  isBullishCandle: boolean;
  marketUp: string;
  marketDown: string;
}

// ============================================================================
// Component
// ============================================================================

interface SkiaCandlestickChartProps {
  data: StockHistoryPoint[];
  height: number;
  width: number;
  showVolume?: boolean;
  showMA?: boolean;
  chartType?: SkiaChartType;
  zoomLevel?: number;
  scrollOffset?: number;
  showPatterns?: boolean;
  patterns?: DetectedPattern[];
  visibleStartIndex?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  chartHeight?: number;
}

export default function SkiaCandlestickChart({
  data,
  height,
  width,
  showVolume = true,
  showMA = false,
  chartType = 'candlestick',
  zoomLevel = 0,
  scrollOffset = 0,
  showPatterns = false,
  patterns = [],
  visibleStartIndex: externalStartIndex,
  padding: externalPadding,
  chartHeight: externalChartHeight,
}: SkiaCandlestickChartProps) {
  const { colors } = useTheme();
  const { focusedIndex, setFocusedIndex } = useChartCrosshair();

  // ── Apply Heikin-Ashi if selected ──
  const processedData = useMemo(() => {
    if (chartType === 'heikin_ashi') return computeHeikinAshi(data);
    return data;
  }, [data, chartType]);

  // ── Visible data slice ──
  const { visibleData, visibleStartIndex } = useMemo(
    () => computeVisibleData(processedData, zoomLevel, scrollOffset),
    [processedData, zoomLevel, scrollOffset],
  );

  // ── Layout ──
  const rawLayout = useMemo(() => computeChartLayout(width, height, showVolume), [width, height, showVolume]);
  const layoutPadding = externalPadding || rawLayout.padding;
  const layoutChartHeight = externalChartHeight || rawLayout.chartHeight;
  const { volumeHeight } = rawLayout;

  // ── Candle spacing ──
  const candleSpacing = visibleData.length > 0 ? rawLayout.chartWidth / visibleData.length : 0;
  const candleWidth = visibleData.length > 0
    ? Math.max(candleSpacing * CANDLE_WIDTH_RATIO, CANDLE_MIN_WIDTH)
    : 0;
  const volumeBarWidth = Math.max(candleWidth * 0.7, 1.5);

  // ── Coordinate mappers ──
  const { minPrice, maxPrice, priceRange } = useMemo(
    () => computePriceRange(visibleData),
    [visibleData],
  );
  const maxVolume = useMemo(() => computeMaxVolume(visibleData), [visibleData]);

  const getX = useMemo(() => createGetX(layoutPadding.left, candleSpacing), [layoutPadding.left, candleSpacing]);
  const getY = useMemo(
    () => createGetY(layoutPadding.top, maxPrice, priceRange, layoutChartHeight),
    [layoutPadding.top, maxPrice, priceRange, layoutChartHeight],
  );
  const getVolumeY = useMemo(
    () => createGetVolumeY(height, layoutPadding.bottom, maxVolume, volumeHeight),
    [height, layoutPadding.bottom, maxVolume, volumeHeight],
  );

  // ── Axis labels ──
  const yLabels = useMemo(() => computeYLabels(maxPrice, priceRange), [maxPrice, priceRange]);
  const xLabels = useMemo(() => {
    if (!visibleData || visibleData.length === 0) return [];
    // Detect intraday: most data points share the same date
    const firstDate = new Date(visibleData[0].date);
    const lastDate = new Date(visibleData[visibleData.length - 1].date);
    const isIntraday = firstDate.toDateString() === lastDate.toDateString();

    const count = Math.min(6, visibleData.length);
    const step = Math.max(1, Math.floor(visibleData.length / (count - 1)));
    const labels: { index: number; label: string }[] = [];
    for (let i = 0; i < visibleData.length; i += step) {
      const date = new Date(visibleData[i].date);
      if (isIntraday) {
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        labels.push({ index: i, label: `${hh}:${mm}` });
      } else {
        labels.push({ index: i, label: `${date.getDate()}/${date.getMonth() + 1}` });
      }
    }
    const last = visibleData.length - 1;
    if (labels[labels.length - 1]?.index !== last) {
      const date = new Date(visibleData[last].date);
      if (isIntraday) {
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        labels.push({ index: last, label: `${hh}:${mm}` });
      } else {
        labels.push({ index: last, label: `${date.getDate()}/${date.getMonth() + 1}` });
      }
    }
    return labels;
  }, [visibleData]);

  // ── Moving averages ──
  const maData = useMemo(
    () => (showMA ? computeMA(processedData, visibleData, visibleStartIndex) : null),
    [showMA, processedData, visibleData, visibleStartIndex],
  );

  // ── MA path builders ──
  const { ma20Path, ma50Path } = useMemo(() => {
    if (!maData) return { ma20Path: null, ma50Path: null };

    let ma20Str = '';
    let ma50Str = '';
    for (let i = 0; i < visibleData.length; i++) {
      const ma20Val = (maData.ma20 as (number | null)[])[i];
      const ma50Val = (maData.ma50 as (number | null)[])[i];

      if (ma20Val !== null) {
        const x = getX(i);
        const y = getY(ma20Val);
        ma20Str += ma20Str ? ` L${x} ${y}` : `M${x} ${y}`;
      }
      if (ma50Val !== null) {
        const x = getX(i);
        const y = getY(ma50Val);
        ma50Str += ma50Str ? ` L${x} ${y}` : `M${x} ${y}`;
      }
    }
    return { ma20Path: ma20Str || null, ma50Path: ma50Str || null };
  }, [maData, visibleData.length, getX, getY]);

  // ── Line / Area path ──
  const { linePathStr, areaPathStr } = useMemo(() => {
    if (!visibleData || visibleData.length === 0 || (chartType !== 'line' && chartType !== 'area')) {
      return { linePathStr: null, areaPathStr: null };
    }
    let path = '';
    for (let i = 0; i < visibleData.length; i++) {
      const x = getX(i);
      const y = getY(visibleData[i].close);
      path += path ? ` L${x} ${y}` : `M${x} ${y}`;
    }

    let area = null;
    if (chartType === 'area' && path) {
      const bottomY = getY(minPrice);
      const lastIdx = visibleData.length - 1;
      area = `${path} L${getX(lastIdx)} ${bottomY} L${getX(0)} ${bottomY} Z`;
    }
    return { linePathStr: path || null, areaPathStr: area };
  }, [visibleData, chartType, getX, getY, minPrice]);

  // ── Crosshair ──
  const crosshair = useMemo(() => {
    if (focusedIndex === null || !visibleData) return null;
    const local = focusedIndex - visibleStartIndex;
    if (local < 0 || local >= visibleData.length) return null;
    const point = visibleData[local];
    return {
      x: getX(local),
      y: getY(point.close),
      data: point,
    };
  }, [focusedIndex, visibleStartIndex, visibleData, getX, getY]);

  // ── Candle data for rendering ──
  const candles = useMemo(() => {
    if (!visibleData || (chartType !== 'candlestick' && chartType !== 'heikin_ashi') || visibleData.length === 0) {
      return [];
    }
    return visibleData.map((point, i) => {
      const candleX = getX(i);
      const open = point.open;
      const close = point.close;
      const bullish = isBullish(point);
      const color = bullish ? colors.marketUp : colors.marketDown;
      const yTop = getY(Math.max(open, close));
      const yBottom = getY(Math.min(open, close));
      const yHigh = getY(point.high);
      const yLow = getY(point.low);
      const bodyHeight = Math.max(yBottom - yTop, 1);

      return {
        x: candleX - candleWidth / 2,
        candleX,
        candleWidth,
        open,
        high: point.high,
        low: point.low,
        close,
        yTop,
        yBottom,
        yHigh,
        yLow,
        bodyHeight,
        isBullishCandle: bullish,
        marketUp: colors.marketUp,
        marketDown: colors.marketDown,
      } as CandleProps;
    });
  }, [visibleData, chartType, getX, getY, candleWidth, colors.marketUp, colors.marketDown]);

  // ── Volume bars data ──
  const volumeBars = useMemo(() => {
    if (!showVolume || !visibleData) return [];
    return visibleData.map((point, i) => {
      const bullish = isBullish(point);
      return {
        x: getX(i) - volumeBarWidth / 2,
        y: getVolumeY(point.volume),
        width: volumeBarWidth,
        height: Math.max(height - layoutPadding.bottom + 10 - getVolumeY(point.volume), 1),
        color: bullish ? colors.marketUp : colors.marketDown,
        opacity: 0.4,
      };
    });
  }, [visibleData, showVolume, getX, volumeBarWidth, getVolumeY, height, layoutPadding.bottom, colors]);

  // ── Pattern detection overlays ──
  const patternOverlays = useMemo(() => {
    if (!showPatterns || !patterns || patterns.length === 0 || !visibleData) return null;

    return patterns.map((pattern) => {
      const pColor = getPatternColor(pattern.type);
      const patternStartX = layoutPadding.left + (pattern.startIndex - visibleStartIndex) * candleSpacing;
      const patternEndX = layoutPadding.left + (pattern.endIndex - visibleStartIndex) * candleSpacing;
      const patternWidth = Math.max(patternEndX - patternStartX, 0);

      // Pattern highlight region
      const highlightRect = (
        <Rect
          key={`pattern-highlight-${pattern.type}-${pattern.startIndex}`}
          x={patternStartX}
          y={layoutPadding.top}
          width={patternWidth}
          height={layoutChartHeight}
          color={pColor}
          opacity={0.06}
        />
      );

      // Neckline for H&S patterns
      const necklineEl = pattern.necklinePrice ? (
        <Line
          key={`pattern-neck-${pattern.type}-${pattern.startIndex}`}
          p1={vec(patternStartX, getY(pattern.necklinePrice))}
          p2={vec(patternEndX, getY(pattern.necklinePrice))}
          color={pColor}
          strokeWidth={1.5}
          style="stroke"
          opacity={0.7}
        />
      ) : null;

      // Level dots
      const levelDots = pattern.levels.map((level, li) => {
        const lx = layoutPadding.left + (level.x - visibleStartIndex) * candleSpacing;
        const ly = getY(level.price);
        return (
          <Group key={`pattern-level-${pattern.type}-${pattern.startIndex}-${li}`}>
            <Circle
              c={vec(lx, ly)}
              r={5}
              color={pColor}
              opacity={0.9}
            />
            <Circle
              c={vec(lx, ly)}
              r={5}
              color="white"
              style="stroke"
              strokeWidth={1.5}
              opacity={0.9}
            />
          </Group>
        );
      });

      return (
        <Group key={`pattern-${pattern.type}-${pattern.startIndex}`}>
          {highlightRect}
          {necklineEl}
          {levelDots}
        </Group>
      );
    });
  }, [showPatterns, patterns, visibleData, visibleStartIndex, candleSpacing, layoutPadding, layoutChartHeight, getY]);

  // ════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════

  if (!data || data.length === 0) {
    return (
      <View style={[fallbackStyles.container, { height, width, backgroundColor: colors.bgCard }]}>
        <Text style={[fallbackStyles.text, { color: colors.textMuted }]}>No chart data available</Text>
      </View>
    );
  }

  return (
    <View style={{ height, width }}>
      <Canvas style={{ flex: 1 }}>
        {/* ── Grid lines ── */}
        {yLabels.map((price, i) => {
          const y = getY(price);
          return (
            <Group key={`skia-grid-${i}`}>
              <Line
                p1={vec(layoutPadding.left, y)}
                p2={vec(width - layoutPadding.right, y)}
                color={colors.borderLight}
                strokeWidth={0.5}
                style="stroke"
              />
            </Group>
          );
        })}

        {/* ── Area fill ── */}
        {areaPathStr && chartType === 'area' && (
          <Group>
            <Path
              path={areaPathStr}
              color={colors.primary}
              style="fill"
              opacity={0.08}
            />
            <LinearGradient
              start={vec(0, layoutPadding.top)}
              end={vec(0, layoutPadding.top + layoutChartHeight)}
              colors={[colors.primary + '40', colors.primary + '05']}
            />
          </Group>
        )}

        {/* ── Moving Averages ── */}
        {ma20Path && (
          <Path
            path={ma20Path}
            color={colors.marketNeutral}
            style="stroke"
            strokeWidth={1.5}
          />
        )}
        {ma50Path && (
          <Path
            path={ma50Path}
            color={colors.accent}
            style="stroke"
            strokeWidth={1.5}
          />
        )}

        {/* ── Line chart ── */}
        {linePathStr && chartType === 'line' && (
          <Path
            path={linePathStr}
            color={colors.primary}
            style="stroke"
            strokeWidth={2}
          />
        )}

        {/* ── Candlesticks ── */}
        {candles.map((candle) => (
          <Group key={`skia-candle-${candle.candleX}`}>
            {/* Wick */}
            <Line
              p1={vec(candle.candleX, candle.yHigh)}
              p2={vec(candle.candleX, candle.yLow)}
              color={candle.isBullishCandle ? colors.marketUp : colors.marketDown}
              strokeWidth={1.2}
              style="stroke"
            />
            {/* Body */}
            <Rect
              x={candle.x}
              y={candle.yTop}
              width={candle.candleWidth}
              height={candle.bodyHeight}
              color={candle.isBullishCandle ? colors.marketUp : colors.marketDown}
            />
          </Group>
        ))}

        {/* ── Volume bars ── */}
        {volumeBars.map((bar, i) => (
          <Rect
            key={`skia-vol-${i}`}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            color={bar.color}
            opacity={bar.opacity}
          />
        ))}

        {/* ── Pattern overlays (behind crosshair) ── */}
        {patternOverlays}

        {/* ── Crosshair lines ── */}
        {crosshair && (
          <Group>
            <Line
              p1={vec(crosshair.x, layoutPadding.top)}
              p2={vec(crosshair.x, height - layoutPadding.bottom)}
              color={colors.textSecondary}
              strokeWidth={1}
              style="stroke"
            />
            <Line
              p1={vec(layoutPadding.left, crosshair.y)}
              p2={vec(width - layoutPadding.right, crosshair.y)}
              color={colors.textSecondary}
              strokeWidth={1}
              style="stroke"
            />
            <Circle
              c={vec(crosshair.x, crosshair.y)}
              r={5}
              color={colors.primary}
              opacity={0.8}
            />
            <Circle
              c={vec(crosshair.x, crosshair.y)}
              r={5}
              color={colors.bgCard}
              style="stroke"
              strokeWidth={1.5}
            />
          </Group>
        )}
      </Canvas>

      {/* ── Y-axis labels (RN Text overlay) ── */}
      <View style={[axisStyles.yAxisContainer, { left: 0, top: 0, width: layoutPadding.left - 8, height }]} pointerEvents="none">
        {yLabels.map((price, i) => {
          const y = getY(price);
          return (
            <Text
              key={`ylabel-${i}`}
              style={[
                axisStyles.yLabel,
                {
                  color: colors.textMuted,
                  top: y - 6,
                },
              ]}
            >
              {formatCurrency(price, true)}
            </Text>
          );
        })}
      </View>

      {/* ── X-axis labels (RN Text overlay) ── */}
      <View style={[axisStyles.xAxisContainer, { left: layoutPadding.left, bottom: 0, width: rawLayout.chartWidth }]} pointerEvents="none">
        {xLabels.map(({ index, label }) => {
          const x = getX(index) - layoutPadding.left;
          return (
            <Text
              key={`xlabel-${index}`}
              style={[
                axisStyles.xLabel,
                {
                  color: colors.textMuted,
                  left: x - 20,
                },
              ]}
            >
              {label}
            </Text>
          );
        })}
        {showVolume && (
          <Text
            style={[
              axisStyles.volumeLabel,
              { color: colors.textMuted },
            ]}
          >
            Vol
          </Text>
        )}
      </View>

      {/* ── Pattern label badges (RN Text overlay) ── */}
      {showPatterns && patterns.length > 0 && (
        <View
          style={[
            axisStyles.patternBadgeContainer,
            { top: layoutPadding.top - 4 },
          ]}
          pointerEvents="none"
        >
          {patterns.map((pattern) => {
            const pColor = getPatternColor(pattern.type);
            const pX = layoutPadding.left + (pattern.startIndex - visibleStartIndex) * candleSpacing;
            return (
              <View
                key={`badge-${pattern.type}-${pattern.startIndex}`}
                style={[
                  axisStyles.patternBadge,
                  {
                    left: pX,
                    backgroundColor: pColor,
                  },
                ]}
              >
                <Text style={axisStyles.patternBadgeText}>
                  {pattern.label} {pattern.confidence}%
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Crosshair tooltip (RN Text overlay) ── */}
      {crosshair && (
        <View
          style={[
            tooltipStyles.crosshairInfo,
            {
              top: 40,
              left: Math.min(Math.max(crosshair.x - 60, 8), width - 128),
              backgroundColor: colors.bgCardLight,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[tooltipStyles.crosshairPrice, { color: colors.text }]}>
            {formatCurrency(crosshair.data.close)}
          </Text>
          <Text style={[tooltipStyles.crosshairDate, { color: colors.textSecondary }]}>
            {new Date(crosshair.data.date).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
          <Text style={[tooltipStyles.crosshairOHLC, { color: colors.textSecondary }]}>
            O: {formatCurrency(crosshair.data.open, true)} H: {formatCurrency(crosshair.data.high, true)}
          </Text>
          <Text style={[tooltipStyles.crosshairOHLC, { color: colors.textSecondary }]}>
            L: {formatCurrency(crosshair.data.low, true)} C: {formatCurrency(crosshair.data.close, true)}
          </Text>
          <Text style={[tooltipStyles.crosshairVol, { color: colors.textSecondary }]}>
            Vol: {formatCompactNumber(crosshair.data.volume)}
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const axisStyles = StyleSheet.create({
  yAxisContainer: {
    position: 'absolute',
  },
  yLabel: {
    position: 'absolute',
    right: 4,
    fontSize: 10,
    fontFamily: 'System',
    textAlign: 'right',
  },
  xAxisContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  xLabel: {
    position: 'absolute',
    fontSize: 10,
    fontFamily: 'System',
    textAlign: 'center',
    width: 40,
    bottom: 4,
  },
  volumeLabel: {
    position: 'absolute',
    fontSize: 9,
    fontFamily: 'System',
    textAlign: 'right',
    right: 0,
    bottom: 4,
  },
  patternBadgeContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 20,
    pointerEvents: 'none',
  },
  patternBadge: {
    position: 'absolute',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  patternBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'System',
    fontWeight: '700',
  },
});

const tooltipStyles = StyleSheet.create({
  crosshairInfo: {
    position: 'absolute',
    zIndex: 10,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    minWidth: 120,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  crosshairPrice: {
    fontSize: FONTS.size.md,
    fontFamily: 'System',
    fontWeight: '700',
  },
  crosshairDate: {
    fontSize: FONTS.size.xs,
    fontFamily: 'System',
    marginTop: 2,
  },
  crosshairOHLC: {
    fontSize: FONTS.size.xs,
    fontFamily: 'System',
    marginTop: 1,
  },
  crosshairVol: {
    fontSize: FONTS.size.xs,
    fontFamily: 'System',
    marginTop: 2,
  },
});

const fallbackStyles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  text: {
    fontSize: FONTS.size.md,
    fontFamily: 'System',
  },
});
