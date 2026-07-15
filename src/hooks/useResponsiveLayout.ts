/**
 * ============================================================================
 * Toroloom — Responsive Layout Hook
 * ============================================================================
 *
 * Detects orientation changes via Dimensions API and provides responsive
 * layout utilities: dynamic column count, breakpoint checks, spacing scale,
 * and font size multipliers for landscape/tablet modes.
 *
 * Usage:
 *   const { isLandscape, width, height, columns, spacing, fontSizeScale,
 *           isTablet, isSmallScreen } = useResponsiveLayout();
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

// ─── Breakpoints ──────────────────────────────────────────────────────────

export const BREAKPOINTS = {
  /** Small phone (< 375px width) */
  SMALL: 375,
  /** Medium phone (375-768px) */
  MEDIUM: 768,
  /** Tablet (768-1024px) */
  TABLET: 1024,
  /** Large tablet / desktop (> 1024px) */
  LARGE: 1024,
} as const;

// ─── Return Type ──────────────────────────────────────────────────────────

export interface ResponsiveLayout {
  /** Current window width */
  width: number;
  /** Current window height */
  height: number;
  /** Whether device is in landscape orientation */
  isLandscape: boolean;
  /** Whether device is a tablet (width >= 768) */
  isTablet: boolean;
  /** Whether screen is small (width < 375) */
  isSmallScreen: boolean;
  /** Recommended number of grid columns based on width */
  columns: number;
  /** Spacing multiplier for landscape mode (1.25x) */
  spacingScale: number;
  /** Font size multiplier for landscape mode (0.9x for landscape, 1.0x portrait) */
  fontSizeScale: number;
  /** Whether to show compact headers (landscape) */
  compactHeaders: boolean;
  /** Whether to show split-pane layouts (tablet landscape) */
  splitPane: boolean;
  /** Whether side navigation is visible (tablet landscape) */
  sideNavVisible: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getLayout(window: ScaledSize): ResponsiveLayout {
  const { width, height } = window;
  const isLandscape = width > height;
  const isTablet = width >= BREAKPOINTS.TABLET;
  const isSmallScreen = width < BREAKPOINTS.SMALL;

  // Columns: 2 on phone portrait, 3 on phone landscape, 4 on tablet
  let columns = 2;
  if (isTablet) columns = 4;
  else if (isLandscape) columns = 3;

  return {
    width,
    height,
    isLandscape,
    isTablet,
    isSmallScreen,
    columns,
    spacingScale: isLandscape ? 0.9 : 1.0,
    fontSizeScale: isLandscape ? 0.92 : 1.0,
    compactHeaders: isLandscape,
    splitPane: isTablet && isLandscape && width >= 900,
    sideNavVisible: isTablet && isLandscape && width >= 768,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useResponsiveLayout(): ResponsiveLayout {
  const [layout, setLayout] = useState<ResponsiveLayout>(() =>
    getLayout(Dimensions.get('window')),
  );

  useEffect(() => {
    const handler = ({ window }: { window: ScaledSize }) => {
      setLayout(getLayout(window));
    };

    const subscription = Dimensions.addEventListener('change', handler);
    return () => subscription.remove();
  }, []);

  // Memoize to prevent unnecessary re-renders when the object reference changes
  return useMemo(() => layout, [
    layout.width,
    layout.height,
    layout.isLandscape,
    layout.isTablet,
  ]);
}

/**
 * Calculate responsive values: given a base size and an optional multiplier,
 * returns a size adjusted for landscape mode.
 */
export function responsiveSize(
  base: number,
  landscapeMultiplier: number = 0.88,
  tabletMultiplier: number = 1.1,
  isLandscape: boolean = false,
  isTablet: boolean = false,
): number {
  if (isTablet) return Math.round(base * tabletMultiplier);
  if (isLandscape) return Math.round(base * landscapeMultiplier);
  return base;
}
