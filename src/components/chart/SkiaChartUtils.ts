/**
 * ============================================================================
 * Toroloom — Skia Chart Utilities
 * ============================================================================
 *
 * Shared drawing helpers for the Skia-based candlestick chart renderer.
 * Pure functions — no React dependencies.
 * ============================================================================
 */

import type { StockHistoryPoint } from '../../types';

// ============================================================================
// Constants
// ============================================================================

export const CANDLE_WIDTH_RATIO = 0.6;
export const CANDLE_MIN_WIDTH = 2;
export const MIN_VISIBLE_CANDLES = 10;
export const CHART_PADDING = { top: 16, right: 16, bottom: 80, left: 60 };
export const PANEL_HEIGHT = 120;
export const INDICATOR_PADDING = { top: 16, right: 12, bottom: 20, left: 52 };

// ============================================================================
// Layout
// ============================================================================

export interface ChartLayout {
  padding: { top: number; right: number; bottom: number; left: number };
  chartWidth: number;
  chartHeight: number;
  volumeHeight: number;
  candleSpacing: number;
  candleWidth: number;
  volumeBarWidth: number;
}

export function computeChartLayout(
  width: number,
  height: number,
  showVolume: boolean,
): ChartLayout {
  const padding = {
    top: CHART_PADDING.top,
    right: CHART_PADDING.right,
    bottom: showVolume ? CHART_PADDING.bottom : CHART_PADDING.bottom - 48,
    left: CHART_PADDING.left,
  };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const volumeHeight = showVolume ? 40 : 0;

  return {
    padding,
    chartWidth,
    chartHeight,
    volumeHeight,
    candleSpacing: 0, // set by caller with data length
    candleWidth: 0, // set by caller
    volumeBarWidth: 0, // set by caller
  };
}

export function computeVisibleData(
  data: StockHistoryPoint[],
  zoomLevel: number,
  scrollOffset: number,
): { visibleData: StockHistoryPoint[]; visibleStartIndex: number } {
  if (!data || data.length === 0) {
    return { visibleData: data || [], visibleStartIndex: 0 };
  }

  const totalLen = data.length;
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
}

export interface PriceRange {
  minPrice: number;
  maxPrice: number;
  priceRange: number;
}

export function computePriceRange(visibleData: StockHistoryPoint[]): PriceRange {
  if (!visibleData || visibleData.length === 0) {
    return { minPrice: 0, maxPrice: 0, priceRange: 1 };
  }
  let mn = Infinity, mx = -Infinity;
  for (const d of visibleData) {
    if (d.low < mn) mn = d.low;
    if (d.high > mx) mx = d.high;
  }
  const p = (mx - mn) * 0.05 || mn * 0.02;
  return { minPrice: mn - p, maxPrice: mx + p, priceRange: mx - mn + p * 2 };
}

export function computeMaxVolume(visibleData: StockHistoryPoint[]): number {
  if (!visibleData || visibleData.length === 0) return 1;
  let mv = 0;
  for (const d of visibleData) {
    if (d.volume > mv) mv = d.volume;
  }
  return mv || 1;
}

// ============================================================================
// Coordinate Mappers
// ============================================================================

export function createGetX(paddingLeft: number, candleSpacing: number) {
  return (localIndex: number) => paddingLeft + localIndex * candleSpacing;
}

export function createGetY(paddingTop: number, maxPrice: number, priceRange: number, chartHeight: number) {
  return (price: number) => paddingTop + ((maxPrice - price) / priceRange) * chartHeight;
}

export function createGetVolumeY(
  height: number,
  paddingBottom: number,
  maxVolume: number,
  volumeHeight: number,
) {
  return (vol: number) => {
    const volChartTop = height - paddingBottom + 10;
    return volChartTop + (1 - vol / maxVolume) * volumeHeight;
  };
}

// ============================================================================
// Y-Axis Labels
// ============================================================================

export function computeYLabels(maxPrice: number, priceRange: number, count = 5): number[] {
  const labels: number[] = [];
  for (let i = 0; i < count; i++) {
    labels.push(maxPrice - (priceRange * i) / (count - 1));
  }
  return labels;
}

// ============================================================================
// X-Axis Labels
// ============================================================================

export interface XLabel {
  index: number;
  label: string;
}

export function computeXLabels(visibleData: StockHistoryPoint[]): XLabel[] {
  if (!visibleData || visibleData.length === 0) return [];
  const count = Math.min(6, visibleData.length);
  const step = Math.max(1, Math.floor(visibleData.length / (count - 1)));
  const labels: XLabel[] = [];
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
}

// ============================================================================
// Heikin-Ashi Computation
// ============================================================================

export function computeHeikinAshi(data: StockHistoryPoint[]): StockHistoryPoint[] {
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
// Moving Averages
// ============================================================================

export interface MAData {
  ma20: (number | null)[];
  ma50: (number | null)[];
}

export function computeMA(
  processedData: StockHistoryPoint[],
  visibleData: StockHistoryPoint[],
  visibleStartIndex: number,
): MAData | null {
  const ma20: (number | null)[] = [];
  const ma50: (number | null)[] = [];
  const extendedStart = Math.max(0, visibleStartIndex - 50);
  const extendedData = processedData.slice(extendedStart, visibleStartIndex + visibleData.length);
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
}

// ============================================================================
// Candle Colors
// ============================================================================

export function isBullish(point: StockHistoryPoint): boolean {
  return point.close >= point.open;
}

// ============================================================================
// Format helpers
// ============================================================================

export function formatPriceCompact(value: number): string {
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(2);
}
