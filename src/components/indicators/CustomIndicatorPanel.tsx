/**
 * ============================================================================
 * Toroloom — Custom Indicator Panel
 * ============================================================================
 *
 * Renders user-defined custom indicator lines on the chart.
 * Evaluates formulas via indicatorFormulaEngine and draws SVG lines.
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle as SvgCircle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import { useChartCrosshair } from '../ChartCrosshairContext';
import { evaluateFormula } from '../../utils/indicatorFormulaEngine';
import type { CustomIndicator } from '../../store/customIndicatorStore';
import type { StockHistoryPoint } from '../../types';

// ============================================================================
// Constants
// ============================================================================

const PANEL_HEIGHT = 100;
const CHART_PADDING = { top: 16, right: 12, bottom: 16, left: 52 };

// ============================================================================
// Crosshair Line (shared)
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
    <Line
      x1={x} y1={pad.top}
      x2={x} y2={pad.top + chartH}
      stroke={colors.textSecondary}
      strokeWidth={1}
      strokeDasharray="4,4"
      opacity={0.7}
    />
  );
}

// ============================================================================
// Individual Indicator Line
// ============================================================================

interface IndicatorLineProps {
  values: (number | null)[];
  color: string;
  width: number;
  minVal: number;
  maxVal: number;
  chartH: number;
}

const IndicatorLine = React.memo(({
  values,
  color,
  width,
  minVal,
  maxVal,
  chartH,
}: IndicatorLineProps) => {
  const pad = CHART_PADDING;
  const chartW = width - pad.left - pad.right;
  const range = maxVal - minVal || 1;

  const getX = (i: number) => pad.left + (i / (values.length - 1)) * chartW;
  const getY = (val: number) => pad.top + ((maxVal - val) / range) * chartH;

  let path = '';
  let dotX = 0, dotY = 0;

  for (let i = 0; i < values.length; i++) {
    if (values[i] === null) continue;
    const x = getX(i);
    const y = getY(values[i]!);
    if (!path) {
      path = `M ${x} ${y}`;
    } else {
      path += ` L ${x} ${y}`;
    }
    dotX = x;
    dotY = y;
  }

  if (!path) return null;

  return (
    <>
      <Path d={path} stroke={color} strokeWidth={1.5} fill="none" />
      {/* End dot */}
      {dotX > 0 && (
        <SvgCircle cx={dotX} cy={dotY} r={3} fill={color}
          stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} />
      )}
    </>
  );
});

// ============================================================================
// Custom Indicator Panel Component
// ============================================================================

interface CustomIndicatorPanelProps {
  data: StockHistoryPoint[];
  width?: number;
  indicators: CustomIndicator[];
}

export function CustomIndicatorPanel({
  data,
  width = Dimensions.get('window').width - 48,
  indicators,
}: CustomIndicatorPanelProps) {
  const { colors } = useTheme();
  const { focusedIndex, setFocusedIndex } = useChartCrosshair();

  // Evaluate all indicators
  const evaluatedIndicators = useMemo(() => {
    return indicators.map((ind) => {
      const result = evaluateFormula(ind.formula, data);
      return { ...ind, result };
    });
  }, [indicators, data]);

  if (!data || data.length < 5) return null;

  const panelWidth = width - SPACING.md * 2;
  const pad = CHART_PADDING;
  const chartW = panelWidth - pad.left - pad.right;
  const chartH = PANEL_HEIGHT - pad.top - pad.bottom;

  // Separate overlay vs separate panel indicators
  const overlayIndicators = evaluatedIndicators.filter((ind) => ind.panel === 'overlay');
  const separateIndicators = evaluatedIndicators.filter((ind) => ind.panel === 'separate');

  // For each separate indicator, compute its own min/max range
  const panelRanges = useMemo(() => {
    return separateIndicators.map((ind) => {
      const valid = ind.result.values.filter((v): v is number => v !== null);
      if (valid.length < 2) return { minVal: 0, maxVal: 100, range: 100 };
      const mn = Math.min(...valid);
      const mx = Math.max(...valid);
      const padding = (mx - mn) * 0.1 || mn * 0.1 || 1;
      return { minVal: mn - padding, maxVal: mx + padding };
    });
  }, [separateIndicators]);

  // For overlay, compute a combined range
  const overlayRange = useMemo(() => {
    if (overlayIndicators.length === 0) return null;
    const allValues: number[] = [];
    overlayIndicators.forEach((ind) => {
      ind.result.values.forEach((v) => {
        if (v !== null) allValues.push(v);
      });
    });
    if (allValues.length < 2) return null;
    const mn = Math.min(...allValues);
    const mx = Math.max(...allValues);
    const padding = (mx - mn) * 0.1 || mn * 0.1 || 1;
    return { minVal: mn - padding, maxVal: mx + padding };
  }, [overlayIndicators]);

  // Touch handler for crosshair
  const handleTouchMove = (e: any) => {
    if (data.length < 2) return;
    const x = e.nativeEvent?.locationX ?? 0;
    const relativeX = x - pad.left;
    const index = Math.round((relativeX / chartW) * (data.length - 1));
    setFocusedIndex(Math.max(0, Math.min(data.length - 1, index)));
  };

  // Get crosshair values
  const crosshairValues = useMemo(() => {
    if (focusedIndex === null) return null;
    const vals: { label: string; value: number | null; color: string }[] = [];
    evaluatedIndicators.forEach((ind) => {
      const v = ind.result.values[focusedIndex];
      vals.push({ label: ind.label, value: v ?? null, color: ind.color });
    });
    return vals;
  }, [evaluatedIndicators, focusedIndex]);

  return (
    <View style={styles.container}>
      {/* Crosshair value overlay */}
      {crosshairValues && (
        <View style={[styles.crosshairValues, {
          backgroundColor: colors.bgCardLight,
          borderColor: colors.border,
        }]}>
          {crosshairValues.filter((v) => v.value !== null).slice(0, 5).map((v, i) => (
            <View key={i} style={styles.crosshairRow}>
              <View style={[styles.colorDot, { backgroundColor: v.color }]} />
              <Text style={[styles.crosshairLabel, { color: colors.textSecondary }]}>
                {v.label}
              </Text>
              <Text style={[styles.crosshairVal, { color: colors.text }]}>
                {formatCurrency(v.value!, true)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Separate indicator panels */}
      {separateIndicators.map((ind, idx) => {
        const range = panelRanges[idx];
        if (!range) return null;
        const { minVal, maxVal } = range;

        return (
          <View
            key={ind.id}
            style={[styles.panel, {
              height: PANEL_HEIGHT,
              width: panelWidth,
              borderColor: colors.border,
              backgroundColor: colors.bgCard,
            }]}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderMove={handleTouchMove}
            onResponderRelease={() => {
              // Keep crosshair
            }}
          >
            <View style={styles.panelHeader}>
              <View style={[styles.colorDotSm, { backgroundColor: ind.color }]} />
              <Text style={[styles.panelTitle, { color: colors.textMuted }]}>{ind.label}</Text>
              {focusedIndex !== null && ind.result.values[focusedIndex] !== null && (
                <Text style={[styles.panelValue, { color: colors.text }]}>
                  {formatCurrency(ind.result.values[focusedIndex]!, true)}
                </Text>
              )}
            </View>
            <Svg width={panelWidth} height={PANEL_HEIGHT}>
              <IndicatorLine
                values={ind.result.values}
                color={ind.color}
                width={panelWidth}
                minVal={minVal}
                maxVal={maxVal}
                chartH={chartH}
              />
              <CrosshairLine
                index={focusedIndex}
                dataLength={data.length}
                width={panelWidth}
                colors={colors}
                chartH={chartH}
              />
            </Svg>
          </View>
        );
      })}
    </View>
  );
}

// ============================================================================
// Overlay indicators (drawn on main chart)
// ============================================================================

interface CustomIndicatorOverlayProps {
  data: StockHistoryPoint[];
  chartWidth: number;
  chartHeight: number;
  chartPadding: { top: number; right: number; bottom: number; left: number };
  indicators: CustomIndicator[];
  /** Price range for mapping overlay values to chart coordinates */
  minPrice: number;
  maxPrice: number;
}

export function CustomIndicatorOverlay({
  data,
  chartWidth,
  chartHeight,
  chartPadding,
  indicators,
  minPrice,
  maxPrice,
}: CustomIndicatorOverlayProps) {
  const { colors } = useTheme();
  const { focusedIndex } = useChartCrosshair();

  const evaluated = useMemo(() => {
    // Only evaluate overlay indicators
    const overlayInds = indicators.filter((ind) => ind.panel === 'overlay');
    return overlayInds.map((ind) => ({
      ...ind,
      result: evaluateFormula(ind.formula, data),
    }));
  }, [indicators, data]);

  if (evaluated.length === 0) return null;

  const priceRange = maxPrice - minPrice || 1;
  const getX = (i: number) => chartPadding.left + (i / (data.length - 1)) * chartWidth;
  const getY = (price: number) => chartPadding.top + ((maxPrice - price) / priceRange) * chartHeight;

  return (
    <Svg
      width={chartWidth + chartPadding.left + chartPadding.right}
      height={chartHeight + chartPadding.top + chartPadding.bottom}
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none"
    >
      {evaluated.map((ind) => {
        const { values } = ind.result;
        let path = '';
        for (let i = 0; i < values.length; i++) {
          if (values[i] === null) continue;
          const x = getX(i);
          const y = getY(values[i]!);
          if (!path) {
            path = `M ${x} ${y}`;
          } else {
            path += ` L ${x} ${y}`;
          }
        }
        if (!path) return null;
        return (
          <Path
            key={ind.id}
            d={path}
            stroke={ind.color}
            strokeWidth={1.5}
            fill="none"
            opacity={0.9}
          />
        );
      })}

      {/* Crosshair dots on overlay lines */}
      {focusedIndex !== null && evaluated.map((ind) => {
        const v = ind.result.values[focusedIndex];
        if (v === null || v === undefined) return null;
        const x = getX(focusedIndex);
        const y = getY(v);
        return (
          <SvgCircle
            key={`ch-${ind.id}`}
            cx={x} cy={y} r={3}
            fill={ind.color}
            stroke="rgba(255,255,255,0.8)"
            strokeWidth={1.5}
          />
        );
      })}
    </Svg>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  panel: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    paddingTop: SPACING.xs,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    marginBottom: 2,
  },
  panelTitle: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  panelValue: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '700',
  },
  colorDotSm: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  crosshairValues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.xs,
  },
  crosshairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  colorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  crosshairLabel: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '500',
  },
  crosshairVal: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '700',
  },
});
