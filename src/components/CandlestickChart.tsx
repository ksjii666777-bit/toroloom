import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Path, Line, Rect, G, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { formatCurrency, formatCompactNumber } from '../utils/formatters';
import type { StockHistoryPoint } from '../types';

interface CandlestickChartProps {
  data: StockHistoryPoint[];
  height?: number;
  width?: number;
  timeframes?: string[];
  activeTimeframe?: string;
  onTimeframeChange?: (tf: string) => void;
  onDataNeeded?: (timeframe: string) => void;
  showVolume?: boolean;
  showMA?: boolean;
  loading?: boolean;
}

const CANDLE_WIDTH = 0.6;
const CANDLE_MIN_WIDTH = 2;

export default function CandlestickChart({
  data,
  height = 280,
  width = Dimensions.get('window').width - 48,
  timeframes = ['1D', '1W', '1M', '3M', '1Y', 'Max'],
  activeTimeframe = '1M',
  onTimeframeChange,
  showVolume = true,
  showMA = false,
  loading = false,
}: CandlestickChartProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number; data: StockHistoryPoint } | null>(null);

  const padding = { top: 16, right: 16, bottom: showVolume ? 80 : 32, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const volumeHeight = showVolume ? 40 : 0;

  // Calculate price range
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (!data || data.length === 0) return { minPrice: 0, maxPrice: 0, priceRange: 1 };
    let mn = Infinity, mx = -Infinity;
    for (const d of data) {
      if (d.low < mn) mn = d.low;
      if (d.high > mx) mx = d.high;
    }
    const padding = (mx - mn) * 0.05 || mn * 0.02;
    return { minPrice: mn - padding, maxPrice: mx + padding, priceRange: mx - mn + padding * 2 };
  }, [data]);

  // Calculate volume range
  const { maxVolume } = useMemo(() => {
    if (!data || data.length === 0) return { maxVolume: 1 };
    let mv = 0;
    for (const d of data) {
      if (d.volume > mv) mv = d.volume;
    }
    return { maxVolume: mv || 1 };
  }, [data]);

  // Calculate MA(20) and MA(50)
  const maData = useMemo(() => {
    if (!showMA || !data) return null;
    const ma20: (number | null)[] = [];
    const ma50: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i >= 19) {
        let sum = 0;
        for (let j = i - 19; j <= i; j++) sum += data[j].close;
        ma20.push(sum / 20);
      } else {
        ma20.push(null);
      }
      if (i >= 49) {
        let sum = 0;
        for (let j = i - 49; j <= i; j++) sum += data[j].close;
        ma50.push(sum / 50);
      } else {
        ma50.push(null);
      }
    }
    return { ma20, ma50 };
  }, [data, showMA]);

  // Mapping functions
  const candleWidth = Math.max(
    (chartWidth / data.length) * CANDLE_WIDTH,
    CANDLE_MIN_WIDTH
  );
  const candleSpacing = chartWidth / data.length;
  const halfSpacing = candleSpacing / 2;

  const getX = useCallback((index: number) => padding.left + index * candleSpacing, [padding.left, candleSpacing]);
  const getY = useCallback((price: number) => padding.top + ((maxPrice - price) / priceRange) * chartHeight, [padding.top, maxPrice, priceRange, chartHeight]);
  const getVolumeY = useCallback((vol: number) => {
    const volChartTop = height - padding.bottom + 10;
    return volChartTop + (1 - vol / maxVolume) * volumeHeight;
  }, [height, padding.bottom, maxVolume, volumeHeight]);

  // Y-axis labels
  const yLabels = useMemo(() => {
    const count = 5;
    const labels: number[] = [];
    for (let i = 0; i < count; i++) {
      labels.push(maxPrice - (priceRange * i) / (count - 1));
    }
    return labels;
  }, [maxPrice, priceRange]);

  // X-axis labels (show ~5 labels)
  const xLabels = useMemo(() => {
    if (!data || data.length === 0) return [];
    const count = Math.min(6, data.length);
    const step = Math.max(1, Math.floor(data.length / (count - 1)));
    const labels: { index: number; label: string }[] = [];
    for (let i = 0; i < data.length; i += step) {
      const date = new Date(data[i].date);
      const label = `${date.getDate()}/${date.getMonth() + 1}`;
      labels.push({ index: i, label });
    }
    // Always include last
    const last = data.length - 1;
    if (labels[labels.length - 1]?.index !== last) {
      const date = new Date(data[last].date);
      labels.push({ index: last, label: `${date.getDate()}/${date.getMonth() + 1}` });
    }
    return labels;
  }, [data]);

  // Handle touch for crosshair
  const handleTouch = useCallback((x: number) => {
    if (!data || data.length === 0) return;
    const relativeX = x - padding.left;
    const index = Math.round(relativeX / candleSpacing);
    const clampedIndex = Math.max(0, Math.min(data.length - 1, index));
    const point = data[clampedIndex];
    setCrosshair({
      x: getX(clampedIndex),
      y: getY(point.close),
      data: point,
    });
  }, [data, padding.left, candleSpacing, getX, getY]);

  if (loading) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading chart data...</Text>
        </View>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No chart data available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      {/* Crosshair price info */}
      {crosshair && (
        <View style={[styles.crosshairInfo, { left: Math.min(Math.max(crosshair.x - 60, 8), width - 128) }]}>
          <Text style={styles.crosshairPrice}>{formatCurrency(crosshair.data.close)}</Text>
          <Text style={styles.crosshairDate}>
            {new Date(crosshair.data.date).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
          <Text style={styles.crosshairOHLC}>
            O: {formatCurrency(crosshair.data.open, true)} H: {formatCurrency(crosshair.data.high, true)}
          </Text>
          <Text style={styles.crosshairOHLC}>
            L: {formatCurrency(crosshair.data.low, true)} C: {formatCurrency(crosshair.data.close, true)}
          </Text>
          <Text style={styles.crosshairVol}>Vol: {formatCompactNumber(crosshair.data.volume)}</Text>
        </View>
      )}

      <Svg width={width} height={height}>
        {/* Grid lines */}
        {yLabels.map((price, i) => (
          <Line
            key={`grid-${i}`}
            x1={padding.left}
            y1={getY(price)}
            x2={width - padding.right}
            y2={getY(price)}
            stroke={colors.borderLight}
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
        ))}

        {/* Y-axis labels */}
        {yLabels.map((price, i) => (
          <SvgText
            key={`ylabel-${i}`}
            x={padding.left - 8}
            y={getY(price) + 4}
            fill={colors.textMuted}
            fontSize={10}
            fontFamily="System"
            textAnchor="end"
          >
            {formatCurrency(price, true)}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {xLabels.map(({ index, label }) => (
          <SvgText
            key={`xlabel-${index}`}
            x={getX(index)}
            y={height - padding.bottom + (showVolume ? 48 : 18)}
            fill={colors.textMuted}
            fontSize={10}
            fontFamily="System"
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ))}

        {/* Candlesticks */}
        {data.map((point, i) => {
          const x = getX(i) - candleWidth / 2;
          const candleX = getX(i);
          const open = point.open;
          const close = point.close;
          const isBullish = close >= open;
          const color = isBullish ? colors.marketUp : colors.marketDown;

          const yTop = getY(Math.max(open, close));
          const yBottom = getY(Math.min(open, close));
          const yHigh = getY(point.high);
          const yLow = getY(point.low);
          const bodyHeight = Math.max(yBottom - yTop, 1);

          return (
            <G key={`candle-${i}`}>
              {/* Wick / Shadow */}
              <Line
                x1={candleX}
                y1={yHigh}
                x2={candleX}
                y2={yLow}
                stroke={color}
                strokeWidth={1.2}
              />
              {/* Body */}
              <Rect
                x={x}
                y={yTop}
                width={candleWidth}
                height={bodyHeight}
                fill={isBullish ? color : color}
                rx={0.5}
              />
            </G>
          );
        })}

        {/* Moving Averages */}
        {showMA && maData && (
          <>
            {/* MA20 */}
            {(() => {
              let ma20Path = '';
              maData.ma20.forEach((val, i) => {
                if (val !== null) {
                  const x = getX(i);
                  const y = getY(val);
                  ma20Path += ma20Path ? ` L ${x} ${y}` : `M ${x} ${y}`;
                }
              });
              return ma20Path ? (
                <Path d={ma20Path} stroke={colors.marketNeutral} strokeWidth={1.5} fill="none" />
              ) : null;
            })()}
            {/* MA50 */}
            {(() => {
              let ma50Path = '';
              maData.ma50.forEach((val, i) => {
                if (val !== null) {
                  const x = getX(i);
                  const y = getY(val);
                  ma50Path += ma50Path ? ` L ${x} ${y}` : `M ${x} ${y}`;
                }
              });
              return ma50Path ? (
                <Path d={ma50Path} stroke={colors.accent} strokeWidth={1.5} fill="none" />
              ) : null;
            })()}
          </>
        )}

        {/* Volume bars */}
        {showVolume && data.map((point, i) => {
          const isBullish = point.close >= point.open;
          const color = isBullish ? colors.marketUp : colors.marketDown;
          const volBarWidth = Math.max(candleWidth * 0.7, 1.5);
          const x = getX(i) - volBarWidth / 2;
          const volTop = getVolumeY(point.volume);
          const volBottom = height - padding.bottom + 10;
          const volBarHeight = Math.max(volBottom - volTop, 1);

          return (
            <Rect
              key={`vol-${i}`}
              x={x}
              y={volTop}
              width={volBarWidth}
              height={volBarHeight}
              fill={color}
              opacity={0.4}
              rx={0.5}
            />
          );
        })}

        {/* Volume axis label */}
        {showVolume && (
          <SvgText
            x={padding.left - 8}
            y={height - padding.bottom + 12}
            fill={colors.textMuted}
            fontSize={9}
            fontFamily="System"
            textAnchor="end"
          >
            Vol
          </SvgText>
        )}

        {/* Crosshair */}
        {crosshair && (
          <>
            <Line
              x1={crosshair.x}
              y1={padding.top}
              x2={crosshair.x}
              y2={height - padding.bottom}
              stroke={colors.textSecondary}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <Line
              x1={padding.left}
              y1={crosshair.y}
              x2={width - padding.right}
              y2={crosshair.y}
              stroke={colors.textSecondary}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <Rect
              x={crosshair.x - 5}
              y={crosshair.y - 5}
              width={10}
              height={10}
              rx={5}
              fill={colors.primary}
              opacity={0.8}
            />
          </>
        )}

        {/* Touch overlay */}
        <Rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight}
          fill="transparent"
          onPress={(e: any) => {
            if (e?.nativeEvent?.locationX) {
              handleTouch(e.nativeEvent.locationX + padding.left);
            }
          }}
        />
      </Svg>

      {/* Timeframe selector */}
      <View style={styles.timeframes}>
        {timeframes.map((tf) => (
          <TouchableOpacity
            key={tf}
            style={[styles.timeframeBtn, activeTimeframe === tf && styles.timeframeActive]}
            onPress={() => onTimeframeChange?.(tf)}
          >
            <Text style={[styles.timeframeText, activeTimeframe === tf && styles.timeframeTextActive]}>
              {tf}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: FONTS.size.md,
      fontFamily: 'System',
    },
    crosshairInfo: {
      position: 'absolute',
      top: SPACING.xs,
      zIndex: 10,
      backgroundColor: colors.bgCardLight,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 120,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    crosshairPrice: {
      color: colors.text,
      fontSize: FONTS.size.md,
      fontFamily: 'System',
      fontWeight: '700',
    },
    crosshairDate: {
      color: colors.textSecondary,
      fontSize: FONTS.size.xs,
      fontFamily: 'System',
      marginTop: 2,
    },
    crosshairOHLC: {
      color: colors.textSecondary,
      fontSize: FONTS.size.xs,
      fontFamily: 'System',
      marginTop: 1,
    },
    crosshairVol: {
      color: colors.info,
      fontSize: FONTS.size.xs,
      fontFamily: 'System',
      marginTop: 2,
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
