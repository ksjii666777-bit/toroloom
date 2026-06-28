import React, { useMemo, useCallback, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, PanResponder, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line, Rect, G, Text as SvgText, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { formatCurrency, formatCompactNumber } from '../utils/formatters';
import { useChartCrosshair } from './ChartCrosshairContext';
import TechnicalIndicators, { IndicatorType } from './TechnicalIndicators';
import type { StockHistoryPoint } from '../types';

// ============================================================================
// Constants
// ============================================================================

const CANDLE_WIDTH = 0.6;
const CANDLE_MIN_WIDTH = 2;
const MIN_VISIBLE_CANDLES = 10;
const MAX_ZOOM = 1;
const PINCH_THRESHOLD = 10; // minimum distance change to trigger zoom

// ============================================================================
// Props
// ============================================================================

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

  // ── New: Technical indicator toggles ──
  showRSI?: boolean;
  showMACD?: boolean;
  showBollinger?: boolean;
  onIndicatorToggle?: (type: IndicatorType) => void;

  // ── New: Zoom/pan control (optional, for reset via parent) ──
  zoomLevel?: number;
  onZoomChange?: (level: number) => void;
  scrollOffset?: number;
  onScrollChange?: (offset: number) => void;
}

// ============================================================================
// Component
// ============================================================================

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

  showRSI = false,
  showMACD = false,
  showBollinger = false,
  onIndicatorToggle,

  zoomLevel: externalZoom,
  onZoomChange,
  scrollOffset: externalScroll,
  onScrollChange,
}: CandlestickChartProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { focusedIndex, setFocusedIndex } = useChartCrosshair();

  // ── Zoom / Pan state (controlled or local) ──
  const [localZoom, setLocalZoom] = useState(0);
  const [localScroll, setLocalScroll] = useState(0);

  const zoomLevel = externalZoom ?? localZoom;
  const scrollOffset = externalScroll ?? localScroll;

  const setZoom = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(MAX_ZOOM, v));
    if (onZoomChange) onZoomChange(clamped);
    else setLocalZoom(clamped);
  }, [onZoomChange]);

  const setScroll = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    if (onScrollChange) onScrollChange(clamped);
    else setLocalScroll(clamped);
  }, [onScrollChange]);

  const resetZoom = useCallback(() => {
    setZoom(0);
    setScroll(0);
  }, [setZoom, setScroll]);

  // ── Pinch + Pan refs ──
  const pinchRef = useRef({ initialDist: 0, initialZoom: 0 });
  const panRef = useRef({ startX: 0, startScroll: 0, isTap: true, moved: false });
  const lastTapRef = useRef(0);

  // ── Compute visible data slice ──
  const { visibleData, visibleStartIndex } = useMemo(() => {
    if (!data || data.length === 0) return { visibleData: data || [], visibleStartIndex: 0 };

    const totalLen = data.length;
    // zoomLevel 0 → all visible, 1 → only MIN_VISIBLE_CANDLES / total visible
    const visibleCount = Math.max(
      MIN_VISIBLE_CANDLES,
      Math.round(totalLen * (1 - zoomLevel * 0.85)),
    );
    const maxStart = totalLen - visibleCount;
    const startIndex = Math.round(scrollOffset * maxStart);
    return {
      visibleData: data.slice(startIndex, startIndex + visibleCount),
      visibleStartIndex: startIndex,
    };
  }, [data, zoomLevel, scrollOffset]);

  const padding = { top: 16, right: 16, bottom: showVolume ? 80 : 32, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const volumeHeight = showVolume ? 40 : 0;

  // ── Compute price range from visible data ──
  const { maxPrice, priceRange } = useMemo(() => {
    if (!visibleData || visibleData.length === 0) return { minPrice: 0, maxPrice: 0, priceRange: 1 };
    let mn = Infinity, mx = -Infinity;
    for (const d of visibleData) {
      if (d.low < mn) mn = d.low;
      if (d.high > mx) mx = d.high;
    }
    const p = (mx - mn) * 0.05 || mn * 0.02;
    return { minPrice: mn - p, maxPrice: mx + p, priceRange: mx - mn + p * 2 };
  }, [visibleData]);

  // ── Compute volume range from visible data ──
  const { maxVolume } = useMemo(() => {
    if (!visibleData || visibleData.length === 0) return { maxVolume: 1 };
    let mv = 0;
    for (const d of visibleData) {
      if (d.volume > mv) mv = d.volume;
    }
    return { maxVolume: mv || 1 };
  }, [visibleData]);

  // ── MA(20) and MA(50) on visible data ──
  const maData = useMemo(() => {
    if (!showMA || !visibleData) return null;
    const ma20: (number | null)[] = [];
    const ma50: (number | null)[] = [];
    // Include some data before visible window for accurate MA values
    const extendedStart = Math.max(0, visibleStartIndex - 50);
    const extendedData = data!.slice(extendedStart, visibleStartIndex + visibleData.length);
    const localOffset = visibleStartIndex - extendedStart;

    for (let i = 0; i < visibleData.length; i++) {
      const globalI = localOffset + i;
      if (globalI >= 19) {
        let sum = 0;
        for (let j = globalI - 19; j <= globalI; j++) sum += extendedData[j].close;
        ma20.push(sum / 20);
      } else {
        ma20.push(null);
      }
      if (globalI >= 49) {
        let sum = 0;
        for (let j = globalI - 49; j <= globalI; j++) sum += extendedData[j].close;
        ma50.push(sum / 50);
      } else {
        ma50.push(null);
      }
    }
    return { ma20, ma50 };
  }, [visibleData, visibleStartIndex, data, showMA]);

  // ── Layout calculations for visible data ──
  const candleWidth = visibleData.length > 0
    ? Math.max((chartWidth / visibleData.length) * CANDLE_WIDTH, CANDLE_MIN_WIDTH)
    : 0;
  const candleSpacing = visibleData.length > 0 ? chartWidth / visibleData.length : 0;

  // getX/getY for visible data (local index 0 = first visible candle)
  const getX = useCallback((localIndex: number) => padding.left + localIndex * candleSpacing, [padding.left, candleSpacing]);
  const getY = useCallback((price: number) => padding.top + ((maxPrice - price) / priceRange) * chartHeight, [padding.top, maxPrice, priceRange, chartHeight]);
  const getVolumeY = useCallback((vol: number) => {
    const volChartTop = height - padding.bottom + 10;
    return volChartTop + (1 - vol / maxVolume) * volumeHeight;
  }, [height, padding.bottom, maxVolume, volumeHeight]);

  // ── Local touch → visible data index ──
  const touchToLocalIndex = useCallback((touchX: number) => {
    if (!visibleData || visibleData.length === 0) return null;
    const relativeX = touchX - padding.left;
    const index = Math.round(relativeX / candleSpacing);
    return Math.max(0, Math.min(visibleData.length - 1, index));
  }, [visibleData, padding.left, candleSpacing]);

  // ── Global index (full dataset) from local index ──
  const localToGlobalIndex = useCallback((localIdx: number) => {
    return visibleStartIndex + localIdx;
  }, [visibleStartIndex]);

  // ── Update crosshair from screen x ──
  const updateCrosshair = useCallback((screenX: number) => {
    const localIdx = touchToLocalIndex(screenX);
    if (localIdx === null || !visibleData) return;
    setFocusedIndex(localToGlobalIndex(localIdx));
  }, [touchToLocalIndex, visibleData, setFocusedIndex, localToGlobalIndex]);

  // ── PanResponder: handles crosshair, pan, and pinch-to-zoom ──
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3,
    onPanResponderGrant: (e) => {
      const touches = e.nativeEvent.touches;
      if (touches && touches.length >= 2) {
        // Pinch start
        const dx = touches[1].pageX - touches[0].pageX;
        const dy = touches[1].pageY - touches[0].pageY;
        pinchRef.current.initialDist = Math.sqrt(dx * dx + dy * dy);
        pinchRef.current.initialZoom = zoomLevel;
        panRef.current.moved = true;
      } else {
        // Single touch start
        panRef.current.startX = e.nativeEvent.locationX;
        panRef.current.startScroll = scrollOffset;
        panRef.current.isTap = true;
        panRef.current.moved = false;
      }
    },
    onPanResponderMove: (e, gs) => {
      const touches = e.nativeEvent.touches;
      if (touches && touches.length >= 2) {
        panRef.current.moved = true;
        const dx = touches[1].pageX - touches[0].pageX;
        const dy = touches[1].pageY - touches[0].pageY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const delta = dist - pinchRef.current.initialDist;

        if (Math.abs(delta) > PINCH_THRESHOLD) {
          const zoomDelta = delta / (width * 0.5);
          const newZoom = Math.max(0, Math.min(MAX_ZOOM, pinchRef.current.initialZoom + zoomDelta));
          setZoom(newZoom);
        }
      } else {
        panRef.current.moved = true;
        if (zoomLevel > 0) {
          // Pan mode: single finger scroll when zoomed
          const pixelsPerUnit = chartWidth / (zoomLevel * 0.85);
          const dxPixels = gs.dx - (panRef.current.startX - e.nativeEvent.locationX);
          // Recalculate from grant position
          const panDelta = (e.nativeEvent.locationX - panRef.current.startX) / (chartWidth || 1);
          const newScroll = Math.max(0, Math.min(1, panRef.current.startScroll - panDelta));
          setScroll(newScroll);
        } else {
          // Crosshair mode
          const x = e.nativeEvent.locationX;
          updateCrosshair(x);
        }
      }
    },
    onPanResponderRelease: (e) => {
      if (!panRef.current.moved) {
        // Tap — update crosshair
        const x = e.nativeEvent.locationX;
        updateCrosshair(x);

        // Double-tap detection for reset
        const now = Date.now();
        if (now - lastTapRef.current < 300 && zoomLevel > 0) {
          resetZoom();
        }
        lastTapRef.current = now;
      }
    },
  }), [updateCrosshair, zoomLevel, scrollOffset, setZoom, setScroll, chartWidth, width, resetZoom]);

  // ── Crosshair (global index → visible local index) ──
  const crosshairLocalIndex = useMemo(() => {
    if (focusedIndex === null || !visibleData) return null;
    const local = focusedIndex - visibleStartIndex;
    if (local < 0 || local >= visibleData.length) return null;
    return local;
  }, [focusedIndex, visibleStartIndex, visibleData]);

  const crosshair = useMemo(() => {
    if (crosshairLocalIndex === null || !visibleData) return null;
    const point = visibleData[crosshairLocalIndex];
    return {
      x: getX(crosshairLocalIndex),
      y: getY(point.close),
      data: point,
    };
  }, [crosshairLocalIndex, visibleData, getX, getY]);

  // ── Y-axis labels ──
  const yLabels = useMemo(() => {
    const count = 5;
    const labels: number[] = [];
    for (let i = 0; i < count; i++) {
      labels.push(maxPrice - (priceRange * i) / (count - 1));
    }
    return labels;
  }, [maxPrice, priceRange]);

  // ── X-axis labels ──
  const xLabels = useMemo(() => {
    if (!visibleData || visibleData.length === 0) return [];
    const count = Math.min(6, visibleData.length);
    const step = Math.max(1, Math.floor(visibleData.length / (count - 1)));
    const labels: { index: number; label: string }[] = [];
    for (let i = 0; i < visibleData.length; i += step) {
      const date = new Date(visibleData[i].date);
      labels.push({ index: i, label: `${date.getDate()}/${date.getMonth() + 1}` });
    }
    const last = visibleData.length - 1;
    if (labels[labels.length - 1]?.index !== last) {
      const date = new Date(visibleData[last].date);
      labels.push({ index: last, label: `${date.getDate()}/${date.getMonth() + 1}` });
    }
    return labels;
  }, [visibleData]);

  // ── Active indicators for TechnicalIndicators ──
  const activeIndicators = useMemo(() => {
    const inds: IndicatorType[] = [];
    if (showRSI) inds.push('rsi');
    if (showMACD) inds.push('macd');
    if (showBollinger) inds.push('bollinger');
    return inds;
  }, [showRSI, showMACD, showBollinger]);

  // ── Zoom indicator text ──
  const zoomPercent = Math.round(zoomLevel * 100);

  // ════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════

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
    <View style={[styles.container, { width }]}>
      {/* ── Crosshair tooltip ── */}
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

      {/* ── Zoom indicator ── */}
      {zoomLevel > 0 && (
        <View style={styles.zoomBadge}>
          <Text style={styles.zoomBadgeText}>{zoomPercent}%</Text>
        </View>
      )}

      {/* ── Reset zoom button ── */}
      {zoomLevel > 0 && (
        <TouchableOpacity style={styles.resetZoomBtn} onPress={resetZoom} activeOpacity={0.7}>
          <Text style={styles.resetZoomText}>Reset</Text>
        </TouchableOpacity>
      )}

      {/* ── SVG Chart ── */}
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

        {/* Moving Averages (behind candles) */}
        {showMA && maData && (
          <>
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

        {/* Candlesticks */}
        {visibleData.map((point, i) => {
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
              <Line x1={candleX} y1={yHigh} x2={candleX} y2={yLow} stroke={color} strokeWidth={1.2} />
              <Rect x={x} y={yTop} width={candleWidth} height={bodyHeight} fill={color} rx={0.5} />
            </G>
          );
        })}

        {/* Volume bars */}
        {showVolume && visibleData.map((point, i) => {
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

        {/* Crosshair lines */}
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
            <Circle
              cx={crosshair.x}
              cy={crosshair.y}
              r={5}
              fill={colors.primary}
              opacity={0.8}
              stroke={colors.bgCard}
              strokeWidth={1.5}
            />
          </>
        )}

        {/* Touch overlay with PanResponder */}
        <Rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight + (showVolume ? volumeHeight + 10 : 0)}
          fill="transparent"
          {...panResponder.panHandlers}
        />
      </Svg>

      {/* ── Timeframe selector ── */}
      <View style={styles.timeframes}>
        {timeframes.map((tf) => (
          <TouchableOpacity
            key={tf}
            style={[styles.timeframeBtn, activeTimeframe === tf && styles.timeframeActive]}
            onPress={() => {
              setFocusedIndex(null);
              resetZoom();
              onTimeframeChange?.(tf);
            }}
          >
            <Text style={[styles.timeframeText, activeTimeframe === tf && styles.timeframeTextActive]}>
              {tf}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Technical Indicators panels ── */}
      {activeIndicators.length > 0 && (
        <TechnicalIndicators
          data={data}
          width={width - SPACING.md * 2}
          indicators={activeIndicators}
          onIndicatorToggle={onIndicatorToggle}
          compact
        />
      )}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

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
      minHeight: 120,
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
      ...SHADOWS.medium,
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
      color: colors.info || colors.textSecondary,
      fontSize: FONTS.size.xs,
      fontFamily: 'System',
      marginTop: 2,
    },
    // ── Zoom controls ──
    zoomBadge: {
      position: 'absolute',
      top: SPACING.sm,
      right: SPACING.sm,
      backgroundColor: colors.primary + '30',
      borderRadius: BORDER_RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      zIndex: 10,
    },
    zoomBadgeText: {
      color: colors.primary,
      fontSize: FONTS.size.xs,
      fontFamily: 'System',
      fontWeight: '700',
    },
    resetZoomBtn: {
      position: 'absolute',
      bottom: 100,
      right: SPACING.sm,
      backgroundColor: colors.bgCardLight,
      borderRadius: BORDER_RADIUS.full,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 10,
    },
    resetZoomText: {
      color: colors.textSecondary,
      fontSize: FONTS.size.xs,
      fontFamily: 'System',
      fontWeight: '600',
    },
    // ── Timeframes ──
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
