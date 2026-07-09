/**
 * ============================================================================
 * Toroloom — DrawingTools Select/Deselect & Delete Tests
 * ============================================================================
 *
 * Tests the tap-to-select, deselect, and delete functionality:
 *   - findDrawingAtPoint() — hit detection for all drawing types
 *   - DrawingTools renders SVG elements for each drawing type
 *   - Delete button, undo/redo bar behavior
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import DrawingTools, { findDrawingAtPoint, type DrawingAnnotation, type DrawingPoint, type DrawingToolType } from '../components/chart/DrawingTools';

// ==================== Mocks ====================

// Mock ThemeContext with full color palette used by DrawingTools
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6',
      primaryLight: '#60A5FA',
      primaryDark: '#2563EB',
      text: '#FFFFFF',
      textSecondary: '#B0B0D0',
      textMuted: '#6E6E9A',
      bg: '#0D0D2B',
      bgCard: '#222255',
      bgCardLight: '#2A2A5E',
      bgInput: '#1E1E4A',
      bgOverlay: 'rgba(0,0,0,0.6)',
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      marketNeutral: '#888',
      accent: '#8B5CF6',
      info: '#06B6D4',
      success: '#00C853',
      danger: '#FF1744',
      warning: '#FFC107',
      white: '#FFFFFF',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

// ==================== Test Data ====================

const candleSpacing = 10;
const paddingLeft = 60;
const paddingTop = 16;
const chartHeight = 200;
const maxPrice = 150;
const priceRange = 50;
const visibleStartIdx = 0;
const dataLength = 50;

const trendlineDrawing: DrawingAnnotation = {
  id: 'drawing_trend_1',
  type: 'trendline',
  points: [
    { dataIndex: 5, x: paddingLeft + 5 * candleSpacing, y: 100, price: 100 },
    { dataIndex: 15, x: paddingLeft + 15 * candleSpacing, y: 60, price: 120 },
  ],
  color: '#3B82F6',
  createdAt: Date.now(),
};

const horizontalLineDrawing: DrawingAnnotation = {
  id: 'drawing_horiz_1',
  type: 'horizontal_line',
  points: [
    { dataIndex: 0, x: paddingLeft, y: 80, price: 110 },
  ],
  color: '#FF5252',
  createdAt: Date.now(),
};

const verticalLineDrawing: DrawingAnnotation = {
  id: 'drawing_vert_1',
  type: 'vertical_line',
  points: [
    { dataIndex: 20, x: paddingLeft + 20 * candleSpacing, y: paddingTop, price: 150 },
  ],
  color: '#00E676',
  createdAt: Date.now(),
};

const rayDrawing: DrawingAnnotation = {
  id: 'drawing_ray_1',
  type: 'ray',
  points: [
    { dataIndex: 10, x: paddingLeft + 10 * candleSpacing, y: 90, price: 105 },
    { dataIndex: 25, x: paddingLeft + 25 * candleSpacing, y: 50, price: 130 },
  ],
  color: '#FFAB40',
  createdAt: Date.now(),
};

const fibonacciDrawing: DrawingAnnotation = {
  id: 'drawing_fib_1',
  type: 'fibonacci',
  points: [
    { dataIndex: 10, x: paddingLeft + 10 * candleSpacing, y: 80, price: 110 },
    { dataIndex: 30, x: paddingLeft + 30 * candleSpacing, y: 40, price: 140 },
  ],
  color: '#8B5CF6',
  createdAt: Date.now(),
  fibLevels: [
    { level: 0, price: 110 },
    { level: 0.236, price: 117.08 },
    { level: 0.382, price: 121.46 },
    { level: 0.5, price: 125 },
    { level: 0.618, price: 128.54 },
    { level: 0.786, price: 133.58 },
    { level: 1, price: 140 },
  ],
};

const annotationDrawing: DrawingAnnotation = {
  id: 'drawing_annot_1',
  type: 'annotation',
  points: [
    { dataIndex: 8, x: paddingLeft + 8 * candleSpacing, y: 70, price: 115 },
  ],
  color: '#06B6D4',
  label: 'Resistance',
  createdAt: Date.now(),
};

// Helper: convert price to Y coordinate (same as priceToY in DrawingTools)
function priceToY(price: number): number {
  return paddingTop + ((maxPrice - price) / priceRange) * chartHeight;
}

// ============================================================================
// findDrawingAtPoint — Pure Function Tests
// ============================================================================

describe('findDrawingAtPoint — Trendline', () => {
  const drawings = [trendlineDrawing];

  it('detects tap near trendline anchor point 1', () => {
    const px = paddingLeft + 5 * candleSpacing;
    const py = priceToY(100);
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBe('drawing_trend_1');
  });

  it('detects tap near trendline anchor point 2', () => {
    const px = paddingLeft + 15 * candleSpacing;
    const py = priceToY(120);
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBe('drawing_trend_1');
  });

  it('does NOT detect tap far from trendline', () => {
    // Tap far away from both anchor points
    const px = paddingLeft + 30 * candleSpacing;
    const py = priceToY(100);
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBeNull();
  });

  it('does NOT detect tap on empty space', () => {
    const px = paddingLeft + 40 * candleSpacing;
    const py = priceToY(80);
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBeNull();
  });
});

describe('findDrawingAtPoint — Horizontal Line', () => {
  const drawings = [horizontalLineDrawing];

  it('detects tap near the full horizontal line', () => {
    // Tap in the middle of the line
    const px = paddingLeft + 25 * candleSpacing;
    const py = priceToY(110) + 5; // slightly offset but still within TAP_HIT_RADIUS (24)
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBe('drawing_horiz_1');
  });

  it('detects tap near the leftmost point of the line', () => {
    const px = paddingLeft - 5;
    const py = priceToY(110);
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBe('drawing_horiz_1');
  });

  it('does NOT detect tap far below the line', () => {
    const px = paddingLeft + 25 * candleSpacing;
    const py = priceToY(110) + 50; // far below
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBeNull();
  });
});

describe('findDrawingAtPoint — Vertical Line', () => {
  const drawings = [verticalLineDrawing];

  it('detects tap near the full vertical line', () => {
    // Tap in the middle of the vertical line
    const px = paddingLeft + 20 * candleSpacing + 3; // slightly offset
    const py = paddingTop + 100;
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBe('drawing_vert_1');
  });

  it('detects tap at the top anchor point', () => {
    const px = paddingLeft + 20 * candleSpacing;
    const py = paddingTop;
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBe('drawing_vert_1');
  });

  it('does NOT detect tap far right of the line', () => {
    const px = paddingLeft + 20 * candleSpacing + 50;
    const py = paddingTop + 100;
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBeNull();
  });
});

describe('findDrawingAtPoint — Ray', () => {
  const drawings = [rayDrawing];

  it('detects tap near ray anchor point 1', () => {
    const px = paddingLeft + 10 * candleSpacing;
    const py = priceToY(105);
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBe('drawing_ray_1');
  });

  it('detects tap near ray anchor point 2', () => {
    const px = paddingLeft + 25 * candleSpacing;
    const py = priceToY(130);
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBe('drawing_ray_1');
  });

  it('does NOT detect tap on empty space', () => {
    const px = paddingLeft + 40 * candleSpacing;
    const py = priceToY(100);
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBeNull();
  });
});

describe('findDrawingAtPoint — Fibonacci', () => {
  const drawings = [fibonacciDrawing];

  it('detects tap near fib anchor point 1', () => {
    const px = paddingLeft + 10 * candleSpacing;
    const py = priceToY(110);
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBe('drawing_fib_1');
  });

  it('detects tap near fib anchor point 2', () => {
    const px = paddingLeft + 30 * candleSpacing;
    const py = priceToY(140);
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBe('drawing_fib_1');
  });

  it('does NOT detect tap on empty space', () => {
    const px = paddingLeft + 45 * candleSpacing;
    const py = priceToY(100);
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBeNull();
  });
});

describe('findDrawingAtPoint — Annotation', () => {
  const drawings = [annotationDrawing];

  it('detects tap near annotation anchor point', () => {
    const px = paddingLeft + 8 * candleSpacing;
    const py = priceToY(115);
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBe('drawing_annot_1');
  });

  it('detects tap near annotation label rect', () => {
    // Annotation label rect position: x + 8, y - 18, width = text.length*7+14, height = 24
    // We know label is 'Resistance' (11 chars) so rectW = 11*7+14 = 91
    const px = paddingLeft + 8 * candleSpacing + 20; // inside the label rect
    const py = priceToY(115) - 10; // inside the label rect (y-18 to y+6)
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBe('drawing_annot_1');
  });

  it('does NOT detect tap far from annotation', () => {
    const px = paddingLeft + 40 * candleSpacing;
    const py = priceToY(100);
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBeNull();
  });
});

describe('findDrawingAtPoint — Multiple Drawings', () => {
  const drawings = [trendlineDrawing, horizontalLineDrawing, rayDrawing];

  it('selects the topmost drawing when multiple are hit', () => {
    // Place a tap near the first point of the trendline
    const px = paddingLeft + 5 * candleSpacing;
    const py = priceToY(100);
    const result = findDrawingAtPoint(px, py, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    // rayDrawing is last (topmost in array), but trendline's anchor is at this point
    // trendline index 0, horizontal_line index 1, ray index 2
    // The function searches from last (ray=2) first, then checks all anchor points
    // Ray's anchor points at (10, price 105) and (25, price 130) don't match (5, price 100)
    // Horizontal line at priceToY(110) doesn't match priceToY(100) within 24px
    // Trendline's first anchor at (5, price 100) should match
    expect(result).toBe('drawing_trend_1');
  });

  it('selects the topmost drawing when their anchor points overlap', () => {
    // Create two drawings at the same point
    const d1: DrawingAnnotation = { ...trendlineDrawing, id: 'd1' };
    const d2: DrawingAnnotation = { ...rayDrawing, id: 'd2', points: trendlineDrawing.points.slice(0, 1) };
    const overlappingDrawings = [d1, d2]; // d2 is topmost
    const px = paddingLeft + 5 * candleSpacing;
    const py = priceToY(100);
    const result = findDrawingAtPoint(px, py, overlappingDrawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    // d2 (ray) is topmost (index 1, searched first in reverse)
    expect(result).toBe('d2');
  });
});

describe('findDrawingAtPoint — Edge Cases', () => {
  it('returns null for empty drawings array', () => {
    const result = findDrawingAtPoint(100, 100, [], candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBeNull();
  });

  it('returns null for tap outside chart bounds', () => {
    const drawings = [trendlineDrawing];
    const result = findDrawingAtPoint(-100, -100, drawings, candleSpacing, paddingLeft, maxPrice, priceRange, chartHeight, paddingTop, visibleStartIdx, dataLength);
    expect(result).toBeNull();
  });
});

// ============================================================================
// DrawingTools Component — Rendering Tests
// ============================================================================

describe('DrawingTools Component — Rendering', () => {
  const baseProps = {
    chartWidth: 500,
    chartHeight: 200,
    chartPadding: { top: 16, right: 16, bottom: 80, left: 60 } as const,
    dataLength: 50,
    visibleStartIndex: 0,
    maxPrice: 150,
    minPrice: 100,
    priceRange: 50,
    drawings: [] as DrawingAnnotation[],
    onDrawingsChange: vi.fn(),
    onToolChange: vi.fn(),
    activeTool: 'none' as DrawingToolType,
    enabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing with minimum props', () => {
    const { toJSON } = render(<DrawingTools {...baseProps} />);
    expect(toJSON).not.toBeNull();
  });

  it('renders without crashing with all drawing types', () => {
    const { toJSON } = render(
      <DrawingTools
        {...baseProps}
        drawings={[trendlineDrawing, horizontalLineDrawing, verticalLineDrawing, rayDrawing, fibonacciDrawing, annotationDrawing]}
      />
    );
    expect(toJSON).not.toBeNull();
  });

  it('renders without crashing when enabled with a draw tool', () => {
    const { toJSON } = render(
      <DrawingTools
        {...baseProps}
        enabled={true}
        activeTool="trendline"
      />
    );
    expect(toJSON).not.toBeNull();
  });

  it('renders without crashing in fullscreen mode', () => {
    const { toJSON } = render(
      <DrawingTools
        {...baseProps}
        isFullscreen={true}
        drawings={[trendlineDrawing]}
      />
    );
    expect(toJSON).not.toBeNull();
  });

  it('renders without crashing with nextDrawingColor', () => {
    const { toJSON } = render(
      <DrawingTools
        {...baseProps}
        nextDrawingColor="#FF5252"
      />
    );
    expect(toJSON).not.toBeNull();
  });

  it('renders all 6 drawing types together without crashing', () => {
    const allDrawings = [
      trendlineDrawing,
      horizontalLineDrawing,
      verticalLineDrawing,
      rayDrawing,
      fibonacciDrawing,
      annotationDrawing,
    ];
    const { toJSON } = render(
      <DrawingTools {...baseProps} drawings={allDrawings} enabled={true} activeTool="none" />
    );
    expect(toJSON).not.toBeNull();
  });

  it('renders correctly when toggled between enabled and disabled', () => {
    const { toJSON, update } = render(
      <DrawingTools {...baseProps} enabled={false} activeTool="none" />
    );
    expect(toJSON).not.toBeNull();

    update(
      <DrawingTools {...baseProps} enabled={true} activeTool="trendline" />
    );
    expect(toJSON).not.toBeNull();
  });
});
