// ============================================================================
// Toroloom — Chart Drawing Tools
// SVG overlay for drawing trendlines, horizontal/vertical lines,
// Fibonacci retracements, and annotations on candlestick charts.
// ============================================================================

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, PanResponder, ScrollView, TextInput } from 'react-native';
import Svg, { Line, Rect, G, Text as SvgText, Circle } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';

// ============================================================================
// Types
// ============================================================================

export type DrawingToolType =
  | 'trendline'
  | 'horizontal_line'
  | 'vertical_line'
  | 'ray'
  | 'fibonacci'
  | 'annotation'
  | 'none';

export interface DrawingPoint {
  /** Data index on the chart */
  dataIndex: number;
  /** Pixel X coordinate */
  x: number;
  /** Pixel Y coordinate */
  y: number;
  /** Price value at this point */
  price: number;
}

export interface DrawingAnnotation {
  id: string;
  type: Exclude<DrawingToolType, 'none'>;
  points: DrawingPoint[];
  color: string;
  label?: string;
  /** For Fibonacci — computed levels */
  fibLevels?: { level: number; price: number }[];
  /** Timestamp created */
  createdAt: number;
}

interface DrawingToolsProps {
  /** Chart dimensions for coordinate mapping */
  chartWidth: number;
  chartHeight: number;
  chartPadding: { top: number; right: number; bottom: number; left: number };
  /** Current data displayed (for mapping pixels ↔ data index) */
  dataLength: number;
  visibleStartIndex: number;
  /** Price range for Y-axis mapping */
  minPrice: number;
  maxPrice: number;
  priceRange: number;
  /** Current drawings */
  drawings: DrawingAnnotation[];
  /** Callback when a new drawing is completed */
  onDrawingsChange: (drawings: DrawingAnnotation[]) => void;
  /** Currently active tool */
  activeTool: DrawingToolType;
  onToolChange: (tool: DrawingToolType) => void;
  /** Whether the drawing tools are enabled */
  enabled: boolean;
  /** Fullscreen mode — larger annotation input */
  isFullscreen?: boolean;
  /** Next drawing color override (overrides cyclic selection) */
  nextDrawingColor?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DRAWING_COLORS = ['#3B82F6', '#FF5252', '#00E676', '#FFAB40', '#8B5CF6', '#06B6D4'];
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const TAP_HIT_RADIUS = 24; // px radius for tap-to-select
const SELECTED_STROKE_WIDTH = 3;
const NORMAL_STROKE_WIDTH = 2;

let drawingIdCounter = 0;
function nextDrawingId(): string {
  drawingIdCounter++;
  return `drawing_${drawingIdCounter}_${Date.now()}`;
}

// ============================================================================
// Toolbar Component
// ============================================================================

interface DrawingToolbarProps {
  activeTool: DrawingToolType;
  onToolChange: (tool: DrawingToolType) => void;
  colors: any;
  drawingCount: number;
  onClearAll: () => void;
  isFullscreen?: boolean;
  activeColor?: string;
  onColorChange?: (color: string) => void;
}

function DrawingToolbar({
  activeTool, onToolChange, colors, drawingCount, onClearAll,
  isFullscreen = false,
  activeColor,
  onColorChange,
}: DrawingToolbarProps) {
  const tools: { type: DrawingToolType; icon: string; label: string }[] = [
    { type: 'trendline', icon: '╱', label: 'Trend' },
    { type: 'horizontal_line', icon: '━', label: 'H-Line' },
    { type: 'vertical_line', icon: '┃', label: 'V-Line' },
    { type: 'ray', icon: '➚', label: 'Ray' },
    { type: 'fibonacci', icon: 'φ', label: 'Fib' },
    { type: 'annotation', icon: 'Aa', label: 'Text' },
  ];

  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <View style={[drawingStyles.toolbar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={drawingStyles.toolbarScroll}>
        {tools.map(tool => {
          const isActive = activeTool === tool.type;
          return (
            <Pressable
              key={tool.type}
              style={({pressed}) => [[
                isFullscreen ? drawingStyles.toolBtnFS : drawingStyles.toolBtn,
                isActive && { backgroundColor: colors.primary + '25', borderColor: colors.primary },
                { borderColor: isActive ? colors.primary : colors.border },
              ], {opacity: pressed ? 0.7 : 1}]}
              onPress={() => onToolChange(isActive ? 'none' : tool.type)}
            >
              <Text style={[
                isFullscreen ? drawingStyles.toolIconFS : drawingStyles.toolIcon,
                { color: isActive ? colors.primary : colors.textSecondary },
              ]}>{tool.icon}</Text>
              <Text style={[
                isFullscreen ? drawingStyles.toolLabelFS : drawingStyles.toolLabel,
                { color: isActive ? colors.primary : colors.textMuted },
              ]}>{tool.label}</Text>
            </Pressable>
          );
        })}

        {/* Color picker toggle */}
        {isFullscreen && (
          <Pressable
            style={({pressed}) => [[
              isFullscreen ? drawingStyles.toolBtnFS : drawingStyles.toolBtn,
              { borderColor: showColorPicker ? colors.primary : colors.border },
            ], {opacity: pressed ? 0.7 : 1}]}
            onPress={() => setShowColorPicker(prev => !prev)}
          >
            <View
              style={[
                drawingStyles.colorDot,
                { backgroundColor: activeColor || DRAWING_COLORS[0] },
              ]}
            />
            <Text style={[isFullscreen ? drawingStyles.toolLabelFS : drawingStyles.toolLabel, { color: colors.textMuted }]}>
              {showColorPicker ? '▲' : '▼'}
            </Text>
          </Pressable>
        )}

        {/* Clear button */}
        {drawingCount > 0 && (
          <Pressable
            style={({pressed}) => [[isFullscreen ? drawingStyles.clearBtnFS : drawingStyles.clearBtn, { backgroundColor: colors.marketDown + '20' }], {opacity: pressed ? 0.7 : 1}]}
            onPress={onClearAll}
          >
            <Text style={[isFullscreen ? drawingStyles.clearTextFS : drawingStyles.clearText, { color: colors.marketDown }]}>
              Clear ({drawingCount})
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* ── Expanded color picker (shown only in fullscreen) ── */}
      {isFullscreen && showColorPicker && (
        <View style={[drawingStyles.colorPicker, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
          {DRAWING_COLORS.map((c) => (
            <Pressable
              key={c}
              style={({pressed}) => [[
                drawingStyles.colorSwatch,
                { backgroundColor: c },
                (activeColor === c) && drawingStyles.colorSwatchActive,
              ], {opacity: pressed ? 0.7 : 1}]}
              onPress={() => {
                onColorChange?.(c);
                setShowColorPicker(false);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const drawingStyles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.xs,
  },
  toolbarScroll: {
    flexDirection: 'row',
    gap: SPACING.xs,
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
  },
  // Normal mode
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    minWidth: 44,
  },
  toolIcon: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'System',
  },
  toolLabel: {
    fontSize: 8,
    fontFamily: 'System',
    fontWeight: '500',
    marginTop: 1,
  },
  clearBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: SPACING.xs,
  },
  clearText: {
    fontSize: 10,
    fontFamily: 'System',
    fontWeight: '700',
  },
  // Fullscreen mode — larger buttons
  toolBtnFS: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    minWidth: 56,
  },
  toolIconFS: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'System',
  },
  toolLabelFS: {
    fontSize: 10,
    fontFamily: 'System',
    fontWeight: '600',
    marginTop: 2,
  },
  clearBtnFS: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: SPACING.xs,
  },
  clearTextFS: {
    fontSize: 12,
    fontFamily: 'System',
    fontWeight: '700',
  },
  // Color picker
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  colorPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    marginTop: SPACING.xs,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
});

// ============================================================================
// Coordinate Mapping Helpers
// ============================================================================

function pxToDataIndex(
  px: number,
  paddingLeft: number,
  candleSpacing: number,
  dataLength: number,
): number {
  const relativeX = px - paddingLeft;
  const index = Math.round(relativeX / candleSpacing);
  return Math.max(0, Math.min(dataLength - 1, index));
}

// ── Tap-to-select: check if a touch point (px) is near any drawing ──
function findDrawingAtPoint(
  px: number,
  py: number,
  drawings: DrawingAnnotation[],
  candleSpacing: number,
  paddingLeft: number,
  maxPrice: number,
  priceRange: number,
  chartHeight: number,
  paddingTop: number,
  visibleStartIdx: number,
  dataLength: number,
): string | null {
  // Check from last (topmost) to first
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i];

    // For horizontal lines, check distance to the full horizontal line
    if (d.type === 'horizontal_line' && d.points.length > 0) {
      const pt = d.points[0];
      const lineY = priceToY(pt.price, maxPrice, priceRange, chartHeight, paddingTop);
      const lineX1 = paddingLeft;
      const lineX2 = paddingLeft + (dataLength - 1) * candleSpacing;
      // Check if tap is near the horizontal line (within TAP_HIT_RADIUS vertically)
      if (Math.abs(py - lineY) <= TAP_HIT_RADIUS && px >= lineX1 - 10 && px <= lineX2 + 10) {
        return d.id;
      }
    }

    // For vertical lines, check distance to the full vertical line
    if (d.type === 'vertical_line' && d.points.length > 0) {
      const pt = d.points[0];
      const lineX = paddingLeft + (pt.dataIndex - visibleStartIdx) * candleSpacing;
      // Check if tap is near the vertical line (within TAP_HIT_RADIUS horizontally)
      if (Math.abs(px - lineX) <= TAP_HIT_RADIUS && py >= paddingTop - 10 && py <= paddingTop + chartHeight + 10) {
        return d.id;
      }
    }

    // For anchor-point-based drawings, check proximity to each anchor point
    for (const pt of d.points) {
      const dx = paddingLeft + (pt.dataIndex - visibleStartIdx) * candleSpacing;
      const dy = priceToY(pt.price, maxPrice, priceRange, chartHeight, paddingTop);
      const dist = Math.sqrt((px - dx) ** 2 + (py - dy) ** 2);
      if (dist <= TAP_HIT_RADIUS) {
        return d.id;
      }
    }
    // For annotation, also check near the label rect
    if (d.type === 'annotation' && d.points.length > 0) {
      const pt = d.points[0];
      const lx = paddingLeft + (pt.dataIndex - visibleStartIdx) * candleSpacing + 8;
      const ly = priceToY(pt.price, maxPrice, priceRange, chartHeight, paddingTop) - 18;
      const rectW = (d.label || '').length * 7 + 14;
      const rectH = 24;
      if (px >= lx && px <= lx + rectW && py >= ly && py <= ly + rectH) {
        return d.id;
      }
    }
  }
  return null;
}

function priceToY(
  price: number,
  maxPrice: number,
  priceRange: number,
  chartHeight: number,
  paddingTop: number,
): number {
  return paddingTop + ((maxPrice - price) / priceRange) * chartHeight;
}

function yToPrice(
  y: number,
  maxPrice: number,
  priceRange: number,
  chartHeight: number,
  paddingTop: number,
): number {
  return maxPrice - ((y - paddingTop) / chartHeight) * priceRange;
}

// ============================================================================
// Drawing Renderers
// ============================================================================

function renderTrendline(
  drawing: DrawingAnnotation,
  colors: any,
  candleSpacing: number,
  paddingLeft: number,
  maxPrice: number,
  priceRange: number,
  chartHeight: number,
  paddingTop: number,
  visibleStartIdx: number,
  isSelected: boolean,
) {
  if (drawing.points.length < 2) return null;

  const p1 = drawing.points[0];
  const p2 = drawing.points[1];

  const x1 = paddingLeft + (p1.dataIndex - visibleStartIdx) * candleSpacing;
  const y1 = priceToY(p1.price, maxPrice, priceRange, chartHeight, paddingTop);
  const x2 = paddingLeft + (p2.dataIndex - visibleStartIdx) * candleSpacing;
  const y2 = priceToY(p2.price, maxPrice, priceRange, chartHeight, paddingTop);

  const sw = isSelected ? SELECTED_STROKE_WIDTH : NORMAL_STROKE_WIDTH;
  const dotR = isSelected ? 7 : 4;

  return (
    <G key={drawing.id}>
      {/* Selection glow */}
      {isSelected && (
        <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={drawing.color} strokeWidth={sw + 4} opacity={0.2} />
      )}
      <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={drawing.color} strokeWidth={sw} />
      <Circle cx={x1} cy={y1} r={dotR} fill={drawing.color} stroke="#fff" strokeWidth={isSelected ? 2 : 1} />
      <Circle cx={x2} cy={y2} r={dotR} fill={drawing.color} stroke="#fff" strokeWidth={isSelected ? 2 : 1} />
    </G>
  );
}

function renderHorizontalLine(
  drawing: DrawingAnnotation,
  colors: any,
  candleSpacing: number,
  paddingLeft: number,
  paddingRight: number,
  maxPrice: number,
  priceRange: number,
  chartHeight: number,
  paddingTop: number,
  chartWidth: number,
  visibleStartIdx: number,
  dataLength: number,
  isSelected: boolean,
) {
  if (drawing.points.length < 1) return null;

  const p = drawing.points[0];
  const y = priceToY(p.price, maxPrice, priceRange, chartHeight, paddingTop);

  // Label dimensions for background rect
  const labelText = formatCurrency(p.price, true);
  const labelWidth = labelText.length * 7 + 12;
  const labelHeight = 18;
  const labelX = paddingLeft + (dataLength - 1) * candleSpacing - 4;
  const labelYAbove = y - 6;
  const labelYBelow = y + labelHeight + 4;

  // Clamp label to chart bounds: place below line if too close to top edge
  const labelAbove = labelYAbove - labelHeight >= paddingTop + 2;
  const labelY = labelAbove ? labelYAbove : labelYBelow;

  const sw = isSelected ? SELECTED_STROKE_WIDTH : 1.5;

  return (
    <G key={drawing.id}>
      {/* Selection glow */}
      {isSelected && (
        <Line
          x1={paddingLeft} y1={y}
          x2={paddingLeft + (dataLength - 1) * candleSpacing} y2={y}
          stroke={drawing.color} strokeWidth={sw + 4} opacity={0.2}
        />
      )}
      <Line
        x1={paddingLeft}
        y1={y}
        x2={paddingLeft + (dataLength - 1) * candleSpacing}
        y2={y}
        stroke={drawing.color}
        strokeWidth={sw}
        strokeDasharray="6,3"
      />
      <Circle cx={paddingLeft} cy={y} r={isSelected ? 6 : 3} fill={drawing.color} />
      {/* Background rect for readability over chart data */}
      <Rect
        x={labelX - labelWidth}
        y={labelY - labelHeight + 4}
        width={labelWidth}
        height={labelHeight}
        rx={4}
        fill={colors.bgCardLight}
        fillOpacity={0.9}
      />
      <SvgText
        x={labelX}
        y={labelY}
        fill={drawing.color}
        fontSize={10}
        fontFamily="System"
        fontWeight="600"
        textAnchor="end"
      >
        {labelText}
      </SvgText>
    </G>
  );
}

function renderVerticalLine(
  drawing: DrawingAnnotation,
  colors: any,
  candleSpacing: number,
  paddingLeft: number,
  maxPrice: number,
  priceRange: number,
  chartHeight: number,
  paddingTop: number,
  visibleStartIdx: number,
  chartHeightTotal: number,
  isSelected: boolean,
) {
  if (drawing.points.length < 1) return null;

  const p = drawing.points[0];
  const x = paddingLeft + (p.dataIndex - visibleStartIdx) * candleSpacing;
  const sw = isSelected ? SELECTED_STROKE_WIDTH : 1.5;

  return (
    <G key={drawing.id}>
      {isSelected && (
        <Line x1={x} y1={paddingTop} x2={x} y2={paddingTop + chartHeightTotal}
          stroke={drawing.color} strokeWidth={sw + 4} opacity={0.2} />
      )}
      <Line
        x1={x}
        y1={paddingTop}
        x2={x}
        y2={paddingTop + chartHeightTotal}
        stroke={drawing.color}
        strokeWidth={sw}
        strokeDasharray="6,3"
      />
      <Circle cx={x} cy={paddingTop} r={isSelected ? 6 : 3} fill={drawing.color} />
    </G>
  );
}

function renderRay(
  drawing: DrawingAnnotation,
  colors: any,
  candleSpacing: number,
  paddingLeft: number,
  maxPrice: number,
  priceRange: number,
  chartHeight: number,
  paddingTop: number,
  visibleStartIdx: number,
  dataLength: number,
  isSelected: boolean,
) {
  if (drawing.points.length < 2) return null;

  const p1 = drawing.points[0];
  const p2 = drawing.points[1];

  const x1 = paddingLeft + (p1.dataIndex - visibleStartIdx) * candleSpacing;
  const y1 = priceToY(p1.price, maxPrice, priceRange, chartHeight, paddingTop);
  const x2 = paddingLeft + (p2.dataIndex - visibleStartIdx) * candleSpacing;
  const y2 = priceToY(p2.price, maxPrice, priceRange, chartHeight, paddingTop);

  // Extend the ray to the right edge of the chart
  const lastX = paddingLeft + (dataLength - 1 - visibleStartIdx) * candleSpacing;
  const slope = (y2 - y1) / (x2 - x1 || 1);
  const extendedY = y2 + slope * (lastX - x2);

  const sw = isSelected ? SELECTED_STROKE_WIDTH : NORMAL_STROKE_WIDTH;
  const dotR = isSelected ? 7 : 4;

  return (
    <G key={drawing.id}>
      {isSelected && (
        <Line x1={x1} y1={y1} x2={lastX} y2={extendedY} stroke={drawing.color} strokeWidth={sw + 4} opacity={0.2} />
      )}
      <Line x1={x1} y1={y1} x2={lastX} y2={extendedY} stroke={drawing.color} strokeWidth={sw} />
      <Circle cx={x1} cy={y1} r={dotR} fill={drawing.color} stroke="#fff" strokeWidth={isSelected ? 2 : 1} />
      <Line
        x1={lastX - 16} y1={extendedY - 8}
        x2={lastX} y2={extendedY}
        stroke={drawing.color}
        strokeWidth={sw}
      />
      <Line
        x1={lastX - 16} y1={extendedY + 8}
        x2={lastX} y2={extendedY}
        stroke={drawing.color}
        strokeWidth={sw}
      />
    </G>
  );
}

function renderFibonacci(
  drawing: DrawingAnnotation,
  colors: any,
  candleSpacing: number,
  paddingLeft: number,
  maxPrice: number,
  priceRange: number,
  chartHeight: number,
  paddingTop: number,
  visibleStartIdx: number,
  isSelected: boolean,
) {
  if (drawing.points.length < 2 || !drawing.fibLevels) return null;

  const p1 = drawing.points[0];
  const p2 = drawing.points[1];

  const x1 = paddingLeft + (p1.dataIndex - visibleStartIdx) * candleSpacing;
  const y1 = priceToY(p1.price, maxPrice, priceRange, chartHeight, paddingTop);
  const x2 = paddingLeft + (p2.dataIndex - visibleStartIdx) * candleSpacing;
  const y2 = priceToY(p2.price, maxPrice, priceRange, chartHeight, paddingTop);

  const dotR = isSelected ? 6 : 3;

  return (
    <G key={drawing.id}>
      {drawing.fibLevels.map((fl, i) => {
        const fibPrice = p1.price + (p2.price - p1.price) * fl.level;
        const y = priceToY(fibPrice, maxPrice, priceRange, chartHeight, paddingTop);
        const isHighlighted = fl.level === 0.382 || fl.level === 0.5 || fl.level === 0.618;
        const baseSw = isHighlighted ? 1.5 : 0.8;
        const sw = isSelected ? baseSw + 1 : baseSw;

        return (
          <G key={`${drawing.id}-fib-${i}`}>
            <Line
              x1={x1} y1={y} x2={x2} y2={y}
              stroke={drawing.color}
              strokeWidth={sw}
              strokeDasharray={isHighlighted ? "none" : "4,4"}
              opacity={isHighlighted ? 0.8 : 0.4}
            />
            <SvgText
              x={x2 + 6}
              y={y + 4}
              fill={drawing.color}
              fontSize={9}
              fontFamily="System"
              fontWeight={isHighlighted ? "700" : "500"}
              opacity={isHighlighted ? 1 : 0.6}
            >
              {`${(fl.level * 100).toFixed(1)}% (${formatCurrency(fl.price, true)})`}
            </SvgText>
          </G>
        );
      })}
      {/* Connector line */}
      <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={drawing.color} strokeWidth={1} opacity={0.3} />
      {isSelected && (
        <Circle cx={x1} cy={y1} r={dotR + 2} fill={drawing.color} opacity={0.2} />
      )}
      <Circle cx={x1} cy={y1} r={dotR} fill={drawing.color} stroke="#fff" strokeWidth={1} />
      <Circle cx={x2} cy={y2} r={dotR} fill={drawing.color} stroke="#fff" strokeWidth={1} />
    </G>
  );
}

function renderAnnotation(
  drawing: DrawingAnnotation,
  colors: any,
  candleSpacing: number,
  paddingLeft: number,
  maxPrice: number,
  priceRange: number,
  chartHeight: number,
  paddingTop: number,
  visibleStartIdx: number,
  isSelected: boolean,
) {
  if (drawing.points.length < 1) return null;

  const p = drawing.points[0];
  const x = paddingLeft + (p.dataIndex - visibleStartIdx) * candleSpacing;
  const y = priceToY(p.price, maxPrice, priceRange, chartHeight, paddingTop);
  const text = drawing.label || '';

  const borderSw = isSelected ? 2.5 : 1;

  return (
    <G key={drawing.id}>
      {isSelected && (
        <Rect
          x={x + 8 - 3} y={y - 21}
          width={text.length * 7 + 20} height={30}
          rx={8} fill={drawing.color} opacity={0.08}
        />
      )}
      <Rect
        x={x + 8}
        y={y - 18}
        width={text.length * 7 + 14}
        height={24}
        rx={6}
        fill={colors.bgCardLight}
        stroke={drawing.color}
        strokeWidth={borderSw}
        opacity={0.95}
      />
      <SvgText
        x={x + 15}
        y={y - 2}
        fill={drawing.color}
        fontSize={11}
        fontFamily="System"
        fontWeight="600"
      >
        {text}
      </SvgText>
      <Circle cx={x} cy={y} r={isSelected ? 6 : 3} fill={drawing.color} />
    </G>
  );
}

// ============================================================================
// Drawing Annotation Generator for rendering all drawings as SVG elements
// ============================================================================

function renderAllDrawings(
  drawings: DrawingAnnotation[],
  colors: any,
  candleSpacing: number,
  paddingLeft: number,
  paddingRight: number,
  maxPrice: number,
  priceRange: number,
  chartHeight: number,
  paddingTop: number,
  visibleStartIdx: number,
  dataLength: number,
  chartWidth: number,
  selectedId: string | null,
) {
  return drawings.map(drawing => {
    const isSelected = drawing.id === selectedId;
    const chartHeightTotal = chartHeight;
    switch (drawing.type) {
      case 'trendline':
        return renderTrendline(drawing, colors, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, isSelected);
      case 'horizontal_line':
        return renderHorizontalLine(drawing, colors, candleSpacing, paddingLeft, paddingRight, maxPrice, priceRange, chartHeight, paddingTop, chartWidth, visibleStartIdx, dataLength, isSelected);
      case 'vertical_line':
        return renderVerticalLine(drawing, colors, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, chartHeightTotal, isSelected);
      case 'ray':
        return renderRay(drawing, colors, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength, isSelected);
      case 'fibonacci':
        return renderFibonacci(drawing, colors, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, isSelected);
      case 'annotation':
        return renderAnnotation(drawing, colors, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, isSelected);
      default:
        return null;
    }
  });
}

// ============================================================================
// Main DrawingTools Component
// ============================================================================

export default function DrawingTools({
  chartWidth,
  chartHeight,
  chartPadding,
  dataLength,
  visibleStartIndex,
  maxPrice,
  priceRange,
  drawings: externalDrawings,
  onDrawingsChange,
  activeTool,
  enabled,
  isFullscreen = false,
  nextDrawingColor,
}: DrawingToolsProps) {
  const { colors } = useTheme();

  // ── Internal drawing state (for in-progress drawings) ──
  const [pendingPoint, setPendingPoint] = useState<DrawingPoint | null>(null);
  const [previewPoint, setPreviewPoint] = useState<DrawingPoint | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [showAnnotationInput, setShowAnnotationInput] = useState(false);
  const colorIndexRef = useRef(0);

  // Sync colorIndexRef when nextDrawingColor changes externally
  const prevColorRef = useRef(nextDrawingColor);
  if (nextDrawingColor && nextDrawingColor !== prevColorRef.current) {
    const idx = DRAWING_COLORS.indexOf(nextDrawingColor);
    if (idx >= 0) {
      colorIndexRef.current = idx;
    }
    prevColorRef.current = nextDrawingColor;
  }

  // ── Selected drawing (tap-to-select) ──
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

  // ── Undo/redo history ──
  const historyRef = useRef<{ past: DrawingAnnotation[][]; future: DrawingAnnotation[][] }>({
    past: [],
    future: [],
  });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const saveToHistory = useCallback(() => {
    historyRef.current.past.push([...externalDrawings]);
    historyRef.current.future = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [externalDrawings]);

  const undo = useCallback(() => {
    const past = historyRef.current.past;
    if (past.length === 0) return;
    const previous = past.pop()!;
    historyRef.current.future.push([...externalDrawings]);
    setCanUndo(past.length > 0);
    setCanRedo(true);
    onDrawingsChange(previous);
  }, [externalDrawings, onDrawingsChange]);

  const redo = useCallback(() => {
    const future = historyRef.current.future;
    if (future.length === 0) return;
    const next = future.pop()!;
    historyRef.current.past.push([...externalDrawings]);
    setCanUndo(true);
    setCanRedo(future.length > 0);
    onDrawingsChange(next);
  }, [externalDrawings, onDrawingsChange]);

  const candleSpacing = useMemo(() => {
    if (dataLength === 0) return 0;
    return chartWidth / dataLength;
  }, [chartWidth, dataLength]);

  // ── Create a point from a touch event ──
  const createPoint = useCallback((touchX: number, touchY: number): DrawingPoint => {
    const dataIdx = pxToDataIndex(touchX, chartPadding.left, candleSpacing, dataLength);
    // Map Y to the visible chart area
    const clampedY = Math.max(chartPadding.top, Math.min(chartPadding.top + chartHeight, touchY));
    const price = yToPrice(clampedY, maxPrice, priceRange, chartHeight, chartPadding.top);
    const globalDataIndex = visibleStartIndex + dataIdx;

    return {
      dataIndex: globalDataIndex,
      x: touchX,
      y: clampedY,
      price: Math.round(price * 100) / 100,
    };
  }, [chartPadding, candleSpacing, dataLength, maxPrice, priceRange, chartHeight, visibleStartIndex]);

  // ── Complete a drawing ──
  const completeDrawing = useCallback((firstPoint: DrawingPoint, secondPoint?: DrawingPoint) => {
    if (activeTool === 'none') return;

    const color = DRAWING_COLORS[colorIndexRef.current % DRAWING_COLORS.length];
    colorIndexRef.current++;

    const now = Date.now();
    const points = secondPoint ? [firstPoint, secondPoint] : [firstPoint];

    let fibLevels: { level: number; price: number }[] | undefined;
    if (activeTool === 'fibonacci' && secondPoint) {
      fibLevels = FIB_LEVELS.map(level => ({
        level,
        price: Math.round((firstPoint.price + (secondPoint.price - firstPoint.price) * level) * 100) / 100,
      }));
    }

    const newDrawing: DrawingAnnotation = {
      id: nextDrawingId(),
      type: activeTool,
      points,
      color,
      fibLevels,
      createdAt: now,
    };

    saveToHistory();
    onDrawingsChange([...externalDrawings, newDrawing]);
    setPendingPoint(null);
    setPreviewPoint(null);
  }, [activeTool, externalDrawings, onDrawingsChange, saveToHistory]);

  // ── Touch handling for drawing ──
  const drawingPanResponder = useMemo(() => {
    if (!enabled || activeTool === 'none') {
      return PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: () => false,
      });
    }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3,
      onPanResponderGrant: (e) => {
        // Clear any stale preview from an interrupted gesture
        setPreviewPoint(null);

        const { locationX, locationY } = e.nativeEvent;

        if (activeTool === 'annotation') {
          // For annotation, one tap places the point — then show text input
          const point = createPoint(locationX, locationY);
          setPendingPoint(point);
          setShowAnnotationInput(true);
          return;
        }

        if (activeTool === 'horizontal_line' || activeTool === 'vertical_line') {
          // Single-tap tools: place immediately
          const point = createPoint(locationX, locationY);
          completeDrawing(point);
          return;
        }

        // Two-tap tools: store first point
        if (!pendingPoint) {
          const point = createPoint(locationX, locationY);
          setPendingPoint(point);
        }
      },
      onPanResponderMove: (e) => {
        if (activeTool === 'trendline' || activeTool === 'ray' || activeTool === 'fibonacci') {
          // Update preview when dragging second point
          if (pendingPoint) {
            const pt = createPoint(e.nativeEvent.locationX, e.nativeEvent.locationY);
            setPreviewPoint(pt);
          }
        }
      },
      onPanResponderRelease: (e) => {
        if (activeTool === 'annotation') return; // handled by grant

        if (activeTool === 'trendline' || activeTool === 'ray' || activeTool === 'fibonacci') {
          if (pendingPoint) {
            const secondPoint = createPoint(e.nativeEvent.locationX, e.nativeEvent.locationY);
            // Only complete if moved enough (avoid accidental taps)
            const dist = Math.abs(secondPoint.dataIndex - pendingPoint.dataIndex);
            if (dist > 0) {
              completeDrawing(pendingPoint, secondPoint);
            } else {
              setPendingPoint(null);
              setPreviewPoint(null);
            }
          }
        }
      },
    });
  }, [enabled, activeTool, pendingPoint, createPoint, completeDrawing]);

  // ── Confirm annotation text ──
  const confirmAnnotation = useCallback((text: string) => {
    if (pendingPoint && text.trim()) {
      const color = DRAWING_COLORS[colorIndexRef.current % DRAWING_COLORS.length];
      colorIndexRef.current++;

      const newDrawing: DrawingAnnotation = {
        id: nextDrawingId(),
        type: 'annotation',
        points: [pendingPoint],
        color,
        label: text.trim(),
        createdAt: Date.now(),
      };

      saveToHistory();
      onDrawingsChange([...externalDrawings, newDrawing]);
      setPendingPoint(null);
      setAnnotationText('');
    }
    setShowAnnotationInput(false);
  }, [pendingPoint, externalDrawings, onDrawingsChange, saveToHistory]);

  // ── Delete selected drawing ──
  const deleteSelectedDrawing = useCallback(() => {
    if (!selectedDrawingId) return;
    saveToHistory();
    const filtered = externalDrawings.filter(d => d.id !== selectedDrawingId);
    onDrawingsChange(filtered);
    setSelectedDrawingId(null);
  }, [selectedDrawingId, externalDrawings, onDrawingsChange, saveToHistory]);

  // ── Tap-to-select handler (when not actively drawing) ──
  const selectPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const hitId = findDrawingAtPoint(
          locationX, locationY,
          externalDrawings,
          candleSpacing,
          chartPadding.left,
          maxPrice, priceRange, chartHeight, chartPadding.top,
          visibleStartIndex,
          dataLength,
        );
        if (hitId) {
          setSelectedDrawingId(hitId);
        } else {
          setSelectedDrawingId(null);
        }
      },
      onPanResponderRelease: () => {},
    });
  }, [externalDrawings, candleSpacing, chartPadding, maxPrice, priceRange, chartHeight, visibleStartIndex, dataLength]);

  // ── Render SVG overlay ──

  // Generate SVG for all completed drawings
  const drawingElements = useMemo(() => {
    return renderAllDrawings(
      externalDrawings, colors, candleSpacing,
      chartPadding.left, chartPadding.right,
      maxPrice, priceRange, chartHeight, chartPadding.top,
      visibleStartIndex, dataLength, chartWidth,
      selectedDrawingId,
    );
  }, [externalDrawings, colors, candleSpacing, chartPadding, maxPrice, priceRange, chartHeight, visibleStartIndex, dataLength, chartWidth, selectedDrawingId]);

  // Preview for in-progress drawing
  const previewElement = useMemo(() => {
    if (!pendingPoint || activeTool === 'none') return null;

    if (activeTool === 'annotation') {
      // Show a dot where annotation will be placed
      const x = chartPadding.left + (pendingPoint.dataIndex - visibleStartIndex) * candleSpacing;
      const y = priceToY(pendingPoint.price, maxPrice, priceRange, chartHeight, chartPadding.top);
      return (
        <Circle
          cx={x} cy={y} r={5}
          fill={DRAWING_COLORS[colorIndexRef.current % DRAWING_COLORS.length]}
          opacity={0.6}
          stroke="#fff"
          strokeWidth={1}
        />
      );
    }

    if (activeTool === 'horizontal_line') return null;
    if (activeTool === 'vertical_line') return null;

    // Two-tap tools (trendline, ray, fibonacci): show dashed preview line while dragging
    if (previewPoint && (activeTool === 'trendline' || activeTool === 'ray' || activeTool === 'fibonacci')) {
      const x1 = chartPadding.left + (pendingPoint.dataIndex - visibleStartIndex) * candleSpacing;
      const y1 = priceToY(pendingPoint.price, maxPrice, priceRange, chartHeight, chartPadding.top);
      const x2 = chartPadding.left + (previewPoint.dataIndex - visibleStartIndex) * candleSpacing;
      const y2 = priceToY(previewPoint.price, maxPrice, priceRange, chartHeight, chartPadding.top);
      const color = DRAWING_COLORS[colorIndexRef.current % DRAWING_COLORS.length];

      return (
        <G>
          {/* Dashed preview line */}
          <Line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color}
            strokeWidth={2}
            strokeDasharray="8,4"
            opacity={0.6}
          />
          {/* Start point dot */}
          <Circle cx={x1} cy={y1} r={5} fill={color} stroke="#fff" strokeWidth={1.5} opacity={0.8} />
          {/* End point dot */}
          <Circle cx={x2} cy={y2} r={5} fill={color} stroke="#fff" strokeWidth={1.5} opacity={0.8} />
        </G>
      );
    }

    return null; // No preview for this tool state
  }, [pendingPoint, previewPoint, activeTool, chartPadding, visibleStartIndex, candleSpacing, maxPrice, priceRange, chartHeight]);

  return (
    <>
      {/* SVG overlay for drawings */}
      <Svg
        style={StyleSheet.absoluteFill}
        width={chartWidth + chartPadding.left + chartPadding.right}
        height={chartHeight + chartPadding.top + chartPadding.bottom}
        pointerEvents={(enabled || externalDrawings.length > 0) ? 'auto' : 'none'}
      >
        <G>
          {drawingElements}
          {previewElement}
        </G>

        {/* Touch capture for drawing — only in chart area */}
        {enabled && activeTool !== 'none' && (
          <Rect
            x={chartPadding.left}
            y={chartPadding.top}
            width={chartWidth}
            height={chartHeight}
            fill="transparent"
            {...drawingPanResponder.panHandlers}
          />
        )}

        {/* Touch capture for tap-to-select — when not actively drawing */}
        {(!enabled || activeTool === 'none') && (
          <Rect
            x={chartPadding.left}
            y={chartPadding.top}
            width={chartWidth}
            height={chartHeight}
            fill="transparent"
            {...selectPanResponder.panHandlers}
          />
        )}
      </Svg>

      {/* Undo/redo floating bar — visible when there's history and not in drawing mode */}
      {(canUndo || canRedo) && activeTool === 'none' && !showAnnotationInput && !selectedDrawingId && (
        <View style={[undoStyles.bar, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
          <Pressable
            style={({pressed}) => [[undoStyles.btn, !canUndo && { opacity: 0.3 }], {opacity: pressed ? 0.6 : 1}]}
            onPress={undo}
            disabled={!canUndo}
          >
            <Text style={[undoStyles.btnText, { color: colors.text }]}>
              ↩ Undo
            </Text>
          </Pressable>
          <View style={[undoStyles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            style={({pressed}) => [[undoStyles.btn, !canRedo && { opacity: 0.3 }], {opacity: pressed ? 0.6 : 1}]}
            onPress={redo}
            disabled={!canRedo}
          >
            <Text style={[undoStyles.btnText, { color: colors.text }]}>
              Redo ↪
            </Text>
          </Pressable>
        </View>
      )}

      {/* Delete button — shown when a drawing is selected */}
      {selectedDrawingId && (
        <View style={selectStyles.deleteContainer}>
          <Pressable
            style={({pressed}) => [[selectStyles.deleteBtn, { backgroundColor: colors.marketDown, shadowColor: '#000' }], {opacity: pressed ? 0.7 : 1}]}
            onPress={deleteSelectedDrawing}
          >
            <Text style={selectStyles.deleteIcon}>🗑</Text>
            <Text style={selectStyles.deleteText}>Delete</Text>
          </Pressable>
          <Pressable
            style={({pressed}) => [[selectStyles.cancelBtn, { backgroundColor: colors.bgCardLight, borderColor: colors.border }], {opacity: pressed ? 0.7 : 1}]}
            onPress={() => setSelectedDrawingId(null)}
          >
            <Text style={[selectStyles.cancelText, { color: colors.textSecondary }]}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Annotation text input */}
      {showAnnotationInput && (
        <View style={[annotationStyles.overlay, { backgroundColor: colors.bgOverlay }]}>
          <View style={[
            isFullscreen ? annotationStyles.inputBoxFS : annotationStyles.inputBox,
            { backgroundColor: colors.bgCard, borderColor: colors.border },
          ]}>
            <Text style={[isFullscreen ? annotationStyles.inputTitleFS : annotationStyles.inputTitle, { color: colors.text }]}>
              Add Label
            </Text>
            <View style={[annotationStyles.input, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <TextInput
                style={[isFullscreen ? annotationStyles.inputFieldFS : annotationStyles.inputField, { color: colors.text }]}
                value={annotationText}
                onChangeText={setAnnotationText}
                placeholder="Type your annotation..."
                placeholderTextColor={colors.textMuted}
                autoFocus
                maxLength={100}
                returnKeyType="done"
                onSubmitEditing={() => confirmAnnotation(annotationText)}
              />
            </View>
            <View style={annotationStyles.inputActions}>
              <Pressable
                style={[annotationStyles.inputBtn, { backgroundColor: colors.bgCardLight }]}
                onPress={() => { setShowAnnotationInput(false); setPendingPoint(null); }}
              >
                <Text style={[annotationStyles.inputBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[annotationStyles.inputBtn, { backgroundColor: colors.primary }]}
                onPress={() => confirmAnnotation(annotationText)}
              >
                <Text style={[annotationStyles.inputBtnText, { color: '#fff' }]}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const undoStyles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 2,
    zIndex: 50,
    elevation: 4,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  btnText: {
    fontSize: 11,
    fontFamily: 'System',
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 16,
    marginHorizontal: 2,
  },
});

const selectStyles = StyleSheet.create({
  deleteContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    zIndex: 60,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.full,
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  deleteIcon: {
    fontSize: 16,
  },
  deleteText: {
    color: '#fff',
    fontSize: FONTS.size.md,
    fontFamily: 'System',
    fontWeight: '700',
  },
  cancelBtn: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelText: {
    fontSize: FONTS.size.lg,
    fontFamily: 'System',
    fontWeight: '600',
  },
});

const annotationStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  // Normal mode
  inputBox: {
    width: 280,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xl,
  },
  inputTitle: {
    fontSize: FONTS.size.lg,
    fontFamily: 'System',
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  input: {
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  inputField: {
    fontSize: FONTS.size.md,
    fontFamily: 'System',
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  inputBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  inputBtnText: {
    fontSize: FONTS.size.md,
    fontFamily: 'System',
    fontWeight: '600',
  },
  // Fullscreen mode — larger input
  inputBoxFS: {
    width: 360,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xl + SPACING.sm,
  },
  inputTitleFS: {
    fontSize: FONTS.size.xl,
    fontFamily: 'System',
    fontWeight: '700',
    marginBottom: SPACING.lg,
  },
  inputFieldFS: {
    fontSize: FONTS.size.lg,
    fontFamily: 'System',
  },
});

// Export the toolbar separately for use in StockDetailScreen
// Export findDrawingAtPoint for unit testing
function _findDrawingAtPoint(
  px: number,
  py: number,
  drawings: DrawingAnnotation[],
  candleSpacing: number,
  paddingLeft: number,
  maxPrice: number,
  priceRange: number,
  chartHeight: number,
  paddingTop: number,
  visibleStartIdx: number,
  dataLength: number,
): string | null {
  return findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
}
export { DrawingToolbar, _findDrawingAtPoint as findDrawingAtPoint };
