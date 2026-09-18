/**
 * ============================================================================
 * Toroloom — TrendSparkline
 * ============================================================================
 *
 * Tiny SVG sparkline for index trends (30 points ≈ 30 days). Used in the
 * Global Markets country view headers so users see the trend at a glance
 * alongside the open/closed badge.
 *
 * - Auto-scales to min/max of the series
 * - Green when the last point ≥ first point, red otherwise (theme
 *   marketUp/marketDown colors, overridable via the `color` prop)
 * - Degrades to null when fewer than 2 points
 * ============================================================================
 */

import React, { useMemo } from 'react';
import Svg, { Polyline } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

interface TrendSparklineProps {
  /** Numeric series (oldest → newest) */
  data: number[];
  width?: number;
  height?: number;
  /** Override trend colors with explicit values */
  color?: string;
  strokeWidth?: number;
  /** Test hook */
  testID?: string;
}

function TrendSparkline({
  data,
  width = 64,
  height = 24,
  color,
  strokeWidth = 1.5,
  testID,
}: TrendSparklineProps) {
  const { colors } = useTheme();

  const { points, isUp } = useMemo(() => {
    if (!data || data.length < 2) return { points: '', isUp: true };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    const pts = data
      .map((v, i) => {
        const x = i * stepX;
        const y = height - 2 - ((v - min) / range) * (height - 4); // 2px padding
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return { points: pts, isUp: data[data.length - 1] >= data[0] };
  }, [data, width, height]);

  if (!points) return null;

  const stroke = color ?? (isUp ? colors.marketUp : colors.marketDown);

  return (
    <Svg width={width} height={height} testID={testID}>
      <Polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default TrendSparkline;
