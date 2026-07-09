import React, { useMemo, useCallback, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, PanResponder } from 'react-native';
import Svg, { Path, Line, Rect, G, Text as SvgText, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { formatCurrency, formatCompactNumber } from '../utils/formatters';
import { useChartCrosshair } from './ChartCrosshairContext';
import TechnicalIndicators, { IndicatorType } from './TechnicalIndicators';
import DrawingTools, { type DrawingAnnotation, type DrawingToolType } from './chart/DrawingTools';
import { getPatternColor, type DetectedPattern } from './chart/patternDetection';
// SkiaCandlestickChart is loaded dynamically below (via require) to avoid
// triggering TurboModuleRegistry.getEnforcing('RNSkiaModule') at bundle load
// time in environments where the native Skia module isn't available (e.g. Expo Go).
import type { StockHistoryPoint } from '../types';

// ============================================================================
// Renderer Type
// ============================================================================

export type ChartRenderer = 'svg' | 'skia';

// ============================================================================
// Constants
// ============================================================================

const CANDLE_WIDTH = 0.6;
const CANDLE_MIN_WIDTH = 2;
const MIN_VISIBLE_CANDLES = 10;
const MAX_ZOOM = 1;
const PINCH_THRESHOLD = 10;

export type ChartType = 'candlestick' | 'line' | 'area' | 'heikin_ashi';

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

  // ── Chart type ──
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;

  // ── Technical indicator toggles ──
  showRSI?: boolean;
  showMACD?: boolean;
  showBollinger?: boolean;
  onIndicatorToggle?: (type: IndicatorType) => void;

  // ── Drawing tools ──
  enableDrawing?: boolean;
  drawings?: DrawingAnnotation[];
  onDrawingsChange?: (drawings: DrawingAnnotation[]) => void;
  activeDrawTool?: DrawingToolType;
  onDrawToolChange?: (tool: DrawingToolType) => void;
  /** Fullscreen mode — larger annotation input */
  isFullscreen?: boolean;
  /** Next drawing color override */
  nextDrawingColor?: string;

  // ── Pattern detection ──
  showPatterns?: boolean;
  patterns?: DetectedPattern[];

  // ── Zoom/pan control ──
  zoomLevel?: number;
  onZoomChange?: (level: number) => void;
  scrollOffset?: number;
  onScrollChange?: (offset: number) => void;

  // ── Renderer selection ──
  /** 'skia' (default, GPU-accelerated via @shopify/react-native-skia) or 'svg' (react-native-svg fallback) */
  renderer?: ChartRenderer;
}

// ============================================================================
// Heikin-Ashi calculation
// ============================================================================

function computeHeikinAshi(data: StockHistoryPoint[]): StockHistoryPoint[] {
  if (data.length === 0) return [];
  const ha: StockHistoryPoint[] = [];
  ha.push({
    date: data[0].date,
    open: data[0].open,
    high: data[0].high,
    low: data[0].low,
    close: data[0].close,
    volume: data[0].volume,
  });
  for (let i = 1; i < data.length; i++) {
    const prev = ha[i - 1];
    const curr = data[i];
    const haClose = (curr.open + curr.high + curr.low + curr.close) / 4;
    const haOpen = (prev.open + prev.close) / 2;
    const haHigh = Math.max(curr.high, haOpen, haClose);
    const haLow = Math.min(curr.low, haOpen, haClose);
    ha.push({
      date: curr.date,
      open: Math.round(haOpen * 100) / 100,
      high: Math.round(haHigh * 100) / 100,
      low: Math.round(haLow * 100) / 100,
      close: Math.round(haClose * 100) / 100,
      volume: curr.volume,
    });
  }
  return ha;
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
  chartType = 'candlestick',
  onChartTypeChange,
  showRSI = false,
  showMACD = false,
  showBollinger = false,
  onIndicatorToggle,
  enableDrawing = false,
  drawings = [],
  onDrawingsChange,
  activeDrawTool = 'none' as DrawingToolType,
  onDrawToolChange,
  isFullscreen = false,
  nextDrawingColor,
  showPatterns = false,
  patterns = [],
  zoomLevel: externalZoom,
  onZoomChange,
  scrollOffset: externalScroll,
  onScrollChange,
  renderer = 'svg',
}: CandlestickChartProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { focusedIndex, setFocusedIndex } = useChartCrosshair();

  // ── Chart type state ──
  const [localChartType, setLocalChartType] = useState<ChartType>('candlestick');
  const activeChartType = onChartTypeChange ? chartType : localChartType;
  const setChartType = useCallback((t: ChartType) => {
    if (onChartTypeChange) onChartTypeChange(t);
    else setLocalChartType(t);
  }, [onChartTypeChange]);

  // ── Show chart type menu ──
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  // ── Apply Heikin-Ashi if selected ──
  const processedData = useMemo(() => {
    if (activeChartType === 'heikin_ashi') return computeHeikinAshi(data);
    return data;
  }, [data, activeChartType]);

  // ── Zoom / Pan state ──
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
    if (!processedData || processedData.length === 0) return { visibleData: processedData || [], visibleStartIndex: 0 };

    const totalLen = processedData.length;
    const visibleCount = Math.max(
      MIN_VISIBLE_CANDLES,
      Math.round(totalLen * (1 - zoomLevel * 0.85)),
    );
    const maxStart = totalLen - visibleCount;
    const startIndex = Math.round(scrollOffset * maxStart);
    return {
      visibleData: processedData.slice(startIndex, startIndex + visibleCount),
      visibleStartIndex: startIndex,
    };
  }, [processedData, zoomLevel, scrollOffset]);

  const padding = { top: 16, right: 16, bottom: showVolume ? 80 : 32, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const volumeHeight = showVolume ? 40 : 0;

  // ── Compute price range from visible data ──
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
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
    if (!showMA || !visibleData || !processedData) return null;
    const ma20: (number | null)[] = [];
    const ma50: (number | null)[] = [];
    const extendedStart = Math.max(0, visibleStartIndex - 50);
    const extendedData = processedData!.slice(extendedStart, visibleStartIndex + visibleData.length);
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
  }, [visibleData, visibleStartIndex, processedData, showMA]);

  // ── Layout calculations ──
  const candleWidth = visibleData.length > 0
    ? Math.max((chartWidth / visibleData.length) * CANDLE_WIDTH, CANDLE_MIN_WIDTH)
    : 0;
  const candleSpacing = visibleData.length > 0 ? chartWidth / visibleData.length : 0;

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

  // ── Global index from local index ──
  const localToGlobalIndex = useCallback((localIdx: number) => {
    return visibleStartIndex + localIdx;
  }, [visibleStartIndex]);

  // ── Update crosshair ──
  const updateCrosshair = useCallback((screenX: number) => {
    const localIdx = touchToLocalIndex(screenX);
    if (localIdx === null || !visibleData) return;
    setFocusedIndex(localToGlobalIndex(localIdx));
  }, [touchToLocalIndex, visibleData, setFocusedIndex, localToGlobalIndex]);

  // ── PanResponder ──
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3,
    onPanResponderGrant: (e) => {
      const touches = e.nativeEvent.touches;
      if (touches && touches.length >= 2) {
        const dx = touches[1].pageX - touches[0].pageX;
        const dy = touches[1].pageY - touches[0].pageY;
        pinchRef.current.initialDist = Math.sqrt(dx * dx + dy * dy);
        pinchRef.current.initialZoom = zoomLevel;
        panRef.current.moved = true;
      } else {
        panRef.current.startX = e.nativeEvent.locationX;
        panRef.current.startScroll = scrollOffset;
        panRef.current.isTap = true;
        panRef.current.moved = false;
      }
    },
    onPanResponderMove: (e, _gs) => {
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
          const panDelta = (e.nativeEvent.locationX - panRef.current.startX) / (chartWidth || 1);
          const newScroll = Math.max(0, Math.min(1, panRef.current.startScroll - panDelta));
          setScroll(newScroll);
        } else {
          const x = e.nativeEvent.locationX;
          updateCrosshair(x);
        }
      }
    },
    onPanResponderRelease: (e) => {
      if (!panRef.current.moved) {
        const x = e.nativeEvent.locationX;
        updateCrosshair(x);
        const now = Date.now();
        if (now - lastTapRef.current < 300 && zoomLevel > 0) {
          resetZoom();
        }
        lastTapRef.current = now;
      }
    },
  }), [updateCrosshair, zoomLevel, scrollOffset, setZoom, setScroll, chartWidth, width, resetZoom]);

  // ── Crosshair ──
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
        // Show HH:MM for intraday
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        labels.push({ index: i, label: `${hh}:${mm}` });
      } else {
        // Show DD/MM for daily data
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

  // ── Active indicators ──
  const activeIndicators = useMemo(() => {
    const inds: IndicatorType[] = [];
    if (showRSI) inds.push('rsi');
    if (showMACD) inds.push('macd');
    if (showBollinger) inds.push('bollinger');
    return inds;
  }, [showRSI, showMACD, showBollinger]);

  const zoomPercent = Math.round(zoomLevel * 100);

  // ── Build line path for line/area chart ──
  const linePath = useMemo(() => {
    if (!visibleData || visibleData.length === 0 || (activeChartType !== 'line' && activeChartType !== 'area')) return '';
    let path = '';
    for (let i = 0; i < visibleData.length; i++) {
      const x = getX(i);
      const y = getY(visibleData[i].close);
      path += path ? ` L ${x} ${y}` : `M ${x} ${y}`;
    }
    return path;
  }, [visibleData, activeChartType, getX, getY]);

  // ── Build area fill path ──
  const areaPath = useMemo(() => {
    if (!visibleData || visibleData.length === 0 || activeChartType !== 'area') return '';
    const bottomY = getY(minPrice);
    const lastIdx = visibleData.length - 1;
    return `${linePath} L ${getX(lastIdx)} ${bottomY} L ${getX(0)} ${bottomY} Z`;
  }, [visibleData, activeChartType, linePath, minPrice, getX, getY]);

  // ── Chart types ──
  const chartTypes: { key: ChartType; label: string; icon: string }[] = [
    { key: 'candlestick', label: 'Candle', icon: '📊' },
    { key: 'line', label: 'Line', icon: '📈' },
    { key: 'area', label: 'Area', icon: '📉' },
    { key: 'heikin_ashi', label: 'HA', icon: '🕯️' },
  ];

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

  // ── Skia renderer path (GPU-accelerated) ──
  // NOTE: SkiaCandlestickChart is loaded via dynamic require() so that
  // @shopify/react-native-skia's native module (RNSkiaModule) is never
  // loaded at bundle evaluation time. If the native module is missing
  // (e.g. in Expo Go), the try-catch silently falls back to SVG.
  if (renderer === 'skia') {
    try {
      const SkiaChart = require('./chart/SkiaCandlestickChart').default;
      return (
        <View style={[styles.container, { width }]}>
          {/* ── Top bar: Chart type toggle + Zoom badge ── */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.chartTypeBtn}
              onPress={() => setShowTypeMenu(prev => !prev)}
              activeOpacity={0.7}
            >
              <Text style={styles.chartTypeBtnText}>
                {chartTypes.find(t => t.key === activeChartType)?.icon}{' '}
                {chartTypes.find(t => t.key === activeChartType)?.label}
              </Text>
              <Text style={styles.chartTypeArrow}>{showTypeMenu ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {zoomLevel > 0 && (
              <View style={styles.zoomBadge}>
                <Text style={styles.zoomBadgeText}>{zoomPercent}%</Text>
              </View>
            )}
          </View>

          {/* ── Chart type dropdown menu ── */}
          {showTypeMenu && (
            <View style={styles.typeMenu}>
              {chartTypes.map(ct => (
                <TouchableOpacity
                  key={ct.key}
                  style={[styles.typeMenuItem, activeChartType === ct.key && styles.typeMenuItemActive]}
                  onPress={() => { setChartType(ct.key); setShowTypeMenu(false); }}
                >
                  <Text style={[styles.typeMenuItemText, activeChartType === ct.key && styles.typeMenuItemTextActive]}>
                    {ct.icon} {ct.label}
                  </Text>
                  {activeChartType === ct.key && (
                    <Text style={styles.typeMenuCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Skia Canvas ── */}
          <SkiaChart
            data={data}
            height={height}
            width={width}
            showVolume={showVolume}
            showMA={showMA}
            chartType={activeChartType}
            zoomLevel={zoomLevel}
            scrollOffset={scrollOffset}
            patterns={patterns}
            visibleStartIndex={visibleStartIndex}
            padding={padding}
            chartHeight={chartHeight}
            showPatterns={showPatterns}
          />

          {/* Drawing Tools Overlay */}
          {enableDrawing && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 }}>
              <DrawingTools
                chartWidth={chartWidth}
                chartHeight={chartHeight}
                chartPadding={padding}
                dataLength={visibleData.length}
                visibleStartIndex={visibleStartIndex}
                minPrice={minPrice}
                maxPrice={maxPrice}
                priceRange={priceRange}
                drawings={drawings}
                onDrawingsChange={(d) => onDrawingsChange?.(d)}
                activeTool={activeDrawTool}
                onToolChange={(t) => onDrawToolChange?.(t)}
                enabled={enableDrawing && activeDrawTool !== 'none'}
                isFullscreen={isFullscreen}
                nextDrawingColor={nextDrawingColor}
              />
            </View>
          )}

          {/* ── Zoom controls ── */}
          <View style={styles.zoomControl}>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => setZoom(Math.max(0, zoomLevel - 0.15))}
              activeOpacity={0.6}
            >
              <Text style={styles.zoomBtnText}>−</Text>
            </TouchableOpacity>
            <View style={styles.zoomTrack}>
              <View
                style={[styles.zoomFill, { width: `${zoomPercent}%`, backgroundColor: colors.primary }]}
              />
              <TouchableOpacity
                style={[styles.zoomThumb, { left: `${zoomPercent}%` }]}
                activeOpacity={0.8}
              />
            </View>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => setZoom(Math.min(MAX_ZOOM, zoomLevel + 0.15))}
              activeOpacity={0.6}
            >
              <Text style={styles.zoomBtnText}>+</Text>
            </TouchableOpacity>
            {zoomLevel > 0 && (
              <TouchableOpacity style={styles.zoomResetBtn} onPress={resetZoom} activeOpacity={0.6}>
                <Text style={styles.zoomResetText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>

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
    } catch {
      console.warn('[CandlestickChart] Skia native module unavailable, using SVG fallback');
    }
  }

  // ── SVG renderer path (default JSX) ──
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

      {/* ── Top bar: Chart type toggle + Zoom badge ── */}
      <View style={styles.topBar}>
        {/* Chart type selector */}
        <TouchableOpacity
          style={styles.chartTypeBtn}
          onPress={() => setShowTypeMenu(prev => !prev)}
          activeOpacity={0.7}
        >
          <Text style={styles.chartTypeBtnText}>
            {chartTypes.find(t => t.key === activeChartType)?.icon}{' '}
            {chartTypes.find(t => t.key === activeChartType)?.label}
          </Text>
          <Text style={styles.chartTypeArrow}>{showTypeMenu ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {/* Zoom badge */}
        {zoomLevel > 0 && (
          <View style={styles.zoomBadge}>
            <Text style={styles.zoomBadgeText}>{zoomPercent}%</Text>
          </View>
        )}
      </View>

      {/* ── Chart type dropdown menu ── */}
      {showTypeMenu && (
        <View style={styles.typeMenu}>
          {chartTypes.map(ct => (
            <TouchableOpacity
              key={ct.key}
              style={[styles.typeMenuItem, activeChartType === ct.key && styles.typeMenuItemActive]}
              onPress={() => { setChartType(ct.key); setShowTypeMenu(false); }}
            >
              <Text style={[styles.typeMenuItemText, activeChartType === ct.key && styles.typeMenuItemTextActive]}>
                {ct.icon} {ct.label}
              </Text>
              {activeChartType === ct.key && (
                <Text style={styles.typeMenuCheck}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
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

        {/* ── Area fill (behind line) ── */}
        {activeChartType === 'area' && areaPath && (
          <Defs>
            <SvgLinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.25" />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity="0.02" />
            </SvgLinearGradient>
          </Defs>
        )}
        {activeChartType === 'area' && areaPath && (
          <Path d={areaPath} fill="url(#areaGrad)" />
        )}

        {/* Moving Averages */}
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

        {/* ── Line chart mode ── */}
        {activeChartType === 'line' && linePath && (
          <Path d={linePath} stroke={colors.primary} strokeWidth={2} fill="none" />
        )}

        {/* ── Candlesticks (candlestick or heikin_ashi) ── */}
        {(activeChartType === 'candlestick' || activeChartType === 'heikin_ashi') && (
          visibleData.map((point, i) => {
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
          })
        )}

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

        {/* Pattern Detection Overlay */}
        {showPatterns && patterns.length > 0 && patterns.map(pattern => {
          const pColor = getPatternColor(pattern.type);
          const patternStartX = padding.left + (pattern.startIndex - visibleStartIndex) * candleSpacing;
          const patternEndX = padding.left + (pattern.endIndex - visibleStartIndex) * candleSpacing;

          // Render neckline for H&S patterns
          const necklineEl = pattern.necklinePrice ? (
            <Line
              key={`${pattern.type}-${pattern.startIndex}-neck`}
              x1={patternStartX}
              y1={getY(pattern.necklinePrice)}
              x2={patternEndX}
              y2={getY(pattern.necklinePrice)}
              stroke={pColor}
              strokeWidth={1.5}
              strokeDasharray="6,4"
              opacity={0.7}
            />
          ) : null;

          // Render key levels
          const levelDots = pattern.levels.map((level, li) => {
            const lx = padding.left + (level.x - visibleStartIndex) * candleSpacing;
            const ly = getY(level.price);
            return (
              <G key={`${pattern.type}-${pattern.startIndex}-lvl-${li}`}>
                <Circle cx={lx} cy={ly} r={5} fill={pColor} stroke="#fff" strokeWidth={1.5} opacity={0.9} />
                {level.label && (
                  <SvgText
                    x={lx + 8}
                    y={ly + 4}
                    fill={pColor}
                    fontSize={10}
                    fontFamily="System"
                    fontWeight="700"
                  >
                    {level.label}
                  </SvgText>
                )}
              </G>
            );
          });

          // Pattern highlight region
          const highlightEl = (
            <Rect
              x={patternStartX}
              y={padding.top}
              width={Math.max(patternEndX - patternStartX, 0)}
              height={chartHeight}
              fill={pColor}
              opacity={0.06}
            />
          );

          return (
            <G key={`pattern-${pattern.type}-${pattern.startIndex}`}>
              {highlightEl}
              {necklineEl}
              {levelDots}
              {/* Pattern label badge */}
              <G>
                <Rect
                  x={patternStartX}
                  y={padding.top - 4}
                  width={pattern.label.length * 9 + 14}
                  height={20}
                  rx={4}
                  fill={pColor}
                  opacity={0.85}
                />
                <SvgText
                  x={patternStartX + 7}
                  y={padding.top + 10}
                  fill="#fff"
                  fontSize={9}
                  fontFamily="System"
                  fontWeight="700"
                >
                  {pattern.label} {pattern.confidence}%
                </SvgText>
              </G>
            </G>
          );
        })}

        {/* Touch overlay */}
        <Rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight + (showVolume ? volumeHeight + 10 : 0)}
          fill="transparent"
          {...panResponder.panHandlers}
        />
      </Svg>

      {/* Drawing Tools Overlay */}
      {enableDrawing && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 }}>
          <DrawingTools
            chartWidth={chartWidth}
            chartHeight={chartHeight}
            chartPadding={padding}
            dataLength={visibleData.length}
            visibleStartIndex={visibleStartIndex}
            minPrice={minPrice}
            maxPrice={maxPrice}
            priceRange={priceRange}
            drawings={drawings}
            onDrawingsChange={(d) => onDrawingsChange?.(d)}
            activeTool={activeDrawTool}
            onToolChange={(t) => onDrawToolChange?.(t)}              enabled={enableDrawing && activeDrawTool !== 'none'}
              isFullscreen={isFullscreen}
              nextDrawingColor={nextDrawingColor}
            />
          </View>
        )}

        {/* ── Zoom slider ── */}
        <View style={styles.zoomControl}>
          <TouchableOpacity
          style={styles.zoomBtn}
          onPress={() => setZoom(Math.max(0, zoomLevel - 0.15))}
          activeOpacity={0.6}
        >
          <Text style={styles.zoomBtnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.zoomTrack}>
          <View
            style={[styles.zoomFill, { width: `${zoomPercent}%`, backgroundColor: colors.primary }]}
          />
          <TouchableOpacity
            style={[styles.zoomThumb, { left: `${zoomPercent}%` }]}
            activeOpacity={0.8}
          />
        </View>
        <TouchableOpacity
          style={styles.zoomBtn}
          onPress={() => setZoom(Math.min(MAX_ZOOM, zoomLevel + 0.15))}
          activeOpacity={0.6}
        >
          <Text style={styles.zoomBtnText}>+</Text>
        </TouchableOpacity>
        {zoomLevel > 0 && (
          <TouchableOpacity style={styles.zoomResetBtn} onPress={resetZoom} activeOpacity={0.6}>
            <Text style={styles.zoomResetText}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>

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
      top: 40,
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
    // ── Top bar ──
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.xs,
    },
    chartTypeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.bgCardLight,
      borderRadius: BORDER_RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chartTypeBtnText: {
      color: colors.textSecondary,
      fontSize: FONTS.size.xs,
      fontFamily: 'System',
      fontWeight: '600',
    },
    chartTypeArrow: {
      color: colors.textMuted,
      fontSize: 8,
    },
    // ── Type menu dropdown ──
    typeMenu: {
      position: 'absolute',
      top: 36,
      left: SPACING.md,
      zIndex: 20,
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.xs,
      ...SHADOWS.medium,
    },
    typeMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.sm,
      minWidth: 120,
    },
    typeMenuItemActive: {
      backgroundColor: colors.primary + '15',
    },
    typeMenuItemText: {
      color: colors.text,
      fontSize: FONTS.size.sm,
      fontFamily: 'System',
      fontWeight: '500',
    },
    typeMenuItemTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    typeMenuCheck: {
      color: colors.primary,
      fontSize: FONTS.size.sm,
      fontWeight: '700',
    },
    // ── Zoom controls ──
    zoomBadge: {
      backgroundColor: colors.primary + '30',
      borderRadius: BORDER_RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
    },
    zoomBadgeText: {
      color: colors.primary,
      fontSize: FONTS.size.xs,
      fontFamily: 'System',
      fontWeight: '700',
    },
    zoomControl: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.sm,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    zoomBtn: {
      width: 28,
      height: 28,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.bgCardLight,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    zoomBtnText: {
      color: colors.textSecondary,
      fontSize: FONTS.size.md,
      fontWeight: '700',
    },
    zoomTrack: {
      flex: 1,
      height: 4,
      backgroundColor: colors.bgInput,
      borderRadius: 2,
      position: 'relative',
      justifyContent: 'center',
    },
    zoomFill: {
      height: '100%',
      borderRadius: 2,
    },
    zoomThumb: {
      position: 'absolute',
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.bg,
      marginLeft: -8,
      ...SHADOWS.small,
    },
    zoomResetBtn: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.bgCardLight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    zoomResetText: {
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
