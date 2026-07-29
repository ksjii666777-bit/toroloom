// ============================================================================
// Toroloom — Drawing Hit Detection Utilities
// ============================================================================
//
// Shared coordinate mapping and hit detection functions used by both
// DrawingTools component and the unit test suite.
// ============================================================================

import type { DrawingAnnotation } from './DrawingTools';

const TAP_HIT_RADIUS = 24; // px radius for tap-to-select

/**
 * Convert a chart Y coordinate to a price value.
 */
export function priceToY(
  price: number,
  maxPrice: number,
  priceRange: number,
  chartHeight: number,
  paddingTop: number,
): number {
  return paddingTop + ((maxPrice - price) / priceRange) * chartHeight;
}

/**
 * Tap-to-select: check if a touch point (px, py) is near any drawing.
 * Returns the drawing ID if found, null otherwise.
 */
export function findDrawingAtPoint(
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
      if (Math.abs(py - lineY) <= TAP_HIT_RADIUS && px >= lineX1 - 10 && px <= lineX2 + 10) {
        return d.id;
      }
    }

    // For vertical lines, check distance to the full vertical line
    if (d.type === 'vertical_line' && d.points.length > 0) {
      const pt = d.points[0];
      const lineX = paddingLeft + (pt.dataIndex - visibleStartIdx) * candleSpacing;
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
