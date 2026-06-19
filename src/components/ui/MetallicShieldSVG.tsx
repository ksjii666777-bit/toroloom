/**
 * ============================================================================
 * Toroloom — Metallic Iron Shield SVG Component
 * ============================================================================
 *
 * Premium custom SVG shield icon with:
 *   - High-contrast metallic iron gradient (silver/chrome)
 *   - Geometric financial vectors (candlestick, trend lines, matrix grid)
 *   - Cyberpunk Cyan + Premium Gold accent details
 *   - Glow overlay hooks for animated neon pulse
 * ============================================================================
 */

import React from 'react';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  G,
  Rect,
  Polygon,
  Line,
} from 'react-native-svg';

interface MetallicShieldSVGProps {
  size?: number;
  glowOpacity?: number;
}

export default function MetallicShieldSVG({ size = 140, glowOpacity = 0.5 }: MetallicShieldSVGProps) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const sc = s / 140; // scale factor based on 140px base

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Defs>
        {/* ── Metallic Iron Gradient — silver/chrome with high contrast ── */}
        <LinearGradient id="metalGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#F0F0F0" stopOpacity="1" />
          <Stop offset="25%" stopColor="#C8C8C8" stopOpacity="1" />
          <Stop offset="50%" stopColor="#888888" stopOpacity="1" />
          <Stop offset="75%" stopColor="#B0B0B0" stopOpacity="1" />
          <Stop offset="100%" stopColor="#606060" stopOpacity="1" />
        </LinearGradient>

        {/* ── Dark Iron core ── */}
        <LinearGradient id="metalCore" x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0%" stopColor="#4A4A4A" stopOpacity="1" />
          <Stop offset="40%" stopColor="#2A2A2A" stopOpacity="1" />
          <Stop offset="60%" stopColor="#3A3A3A" stopOpacity="1" />
          <Stop offset="100%" stopColor="#1A1A1A" stopOpacity="1" />
        </LinearGradient>

        {/* ── Chrome highlight ── */}
        <LinearGradient id="chromeHighlight" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
          <Stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.1" />
          <Stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
        </LinearGradient>

        {/* ── Cyberpunk Cyan glow ── */}
        <LinearGradient id="cyanGlowGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#00F0FF" stopOpacity={0.8} />
          <Stop offset="100%" stopColor="#00F0FF" stopOpacity={0.2} />
        </LinearGradient>

        {/* ── Premium Gold accent ── */}
        <LinearGradient id="goldAccent" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FFD700" stopOpacity="1" />
          <Stop offset="50%" stopColor="#FFA500" stopOpacity="0.9" />
          <Stop offset="100%" stopColor="#FFD700" stopOpacity="0.7" />
        </LinearGradient>

        {/* ── Candlestick green gradient ── */}
        <LinearGradient id="candleGreen" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0%" stopColor="#00C853" stopOpacity="0" />
          <Stop offset="100%" stopColor="#00C853" stopOpacity="0.8" />
        </LinearGradient>

        {/* ── Candlestick red gradient ── */}
        <LinearGradient id="candleRed" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FF1744" stopOpacity="0" />
          <Stop offset="100%" stopColor="#FF1744" stopOpacity="0.6" />
        </LinearGradient>
      </Defs>

      {/* ── Outer glow ring ── */}
      <Circle
        cx={cx}
        cy={cy}
        r={65 * sc}
        fill="none"
        stroke="#00F0FF"
        strokeWidth={0.5 * sc}
        opacity={glowOpacity * 0.3}
        strokeDasharray={`${6 * sc} ${8 * sc}`}
      />

      {/* ── Shield outer shape ── */}
      <Path
        d={`
          M${cx},${5 * sc}
          L${cx + 55 * sc},${20 * sc}
          L${cx + 55 * sc},${60 * sc}
          Q${cx + 55 * sc},${95 * sc} ${cx},${130 * sc}
          Q${cx - 55 * sc},${95 * sc} ${cx - 55 * sc},${60 * sc}
          L${cx - 55 * sc},${20 * sc}
          Z
        `}
        fill="url(#metalGrad)"
        stroke="#999"
        strokeWidth={1.5 * sc}
        strokeLinejoin="round"
      />

      {/* ── Shield inner/core ── */}
      <Path
        d={`
          M${cx},${18 * sc}
          L${cx + 38 * sc},${30 * sc}
          L${cx + 38 * sc},${60 * sc}
          Q${cx + 38 * sc},${85 * sc} ${cx},${112 * sc}
          Q${cx - 38 * sc},${85 * sc} ${cx - 38 * sc},${60 * sc}
          L${cx - 38 * sc},${30 * sc}
          Z
        `}
        fill="url(#metalCore)"
        stroke="#AAA"
        strokeWidth={1 * sc}
        strokeLinejoin="round"
      />

      {/* ── Chrome highlight overlay ── */}
      <Path
        d={`
          M${cx},${18 * sc}
          L${cx + 38 * sc},${30 * sc}
          L${cx + 38 * sc},${60 * sc}
          Q${cx + 38 * sc},${85 * sc} ${cx},${112 * sc}
          Q${cx - 38 * sc},${85 * sc} ${cx - 38 * sc},${60 * sc}
          L${cx - 38 * sc},${30 * sc}
          Z
        `}
        fill="url(#chromeHighlight)"
        stroke="none"
      />

      {/* ── Geometric hexagonal pattern inside shield ── */}
      <Polygon
        points={[
          `${cx},${32 * sc}`,
          `${cx + 20 * sc},${42 * sc}`,
          `${cx + 20 * sc},${60 * sc}`,
          `${cx},${70 * sc}`,
          `${cx - 20 * sc},${60 * sc}`,
          `${cx - 20 * sc},${42 * sc}`,
        ].join(' ')}
        fill="none"
        stroke="#00F0FF"
        strokeWidth={0.8 * sc}
        opacity={0.5}
      />

      {/* ── Inner hexagon ── */}
      <Polygon
        points={[
          `${cx},${44 * sc}`,
          `${cx + 12 * sc},${50 * sc}`,
          `${cx + 12 * sc},${60 * sc}`,
          `${cx},${66 * sc}`,
          `${cx - 12 * sc},${60 * sc}`,
          `${cx - 12 * sc},${50 * sc}`,
        ].join(' ')}
        fill="none"
        stroke="#FFD700"
        strokeWidth={0.6 * sc}
        opacity={0.6}
      />

      {/* ── Center execution dot ── */}
      <Circle cx={cx} cy={55 * sc} r={3 * sc} fill="#FFFFFF" opacity={0.95} />
      <Circle cx={cx} cy={55 * sc} r={6 * sc} fill="#00F0FF" opacity={0.15} />

      {/* ── Financial vectors: Candlestick chart (left) ── */}
      <G opacity={0.6}>
        {/* Candle 1 — green */}
        <Rect
          x={cx - 30 * sc}
          y={55 * sc}
          width={4 * sc}
          height={16 * sc}
          fill="url(#candleGreen)"
          rx={1 * sc}
        />
        <Rect
          x={cx - 29 * sc}
          y={45 * sc}
          width={2 * sc}
          height={10 * sc}
          fill="#00C853"
          rx={1 * sc}
        />

        {/* Candle 2 — red */}
        <Rect
          x={cx - 22 * sc}
          y={58 * sc}
          width={4 * sc}
          height={12 * sc}
          fill="url(#candleRed)"
          rx={1 * sc}
        />
        <Rect
          x={cx - 21 * sc}
          y={58 * sc}
          width={2 * sc}
          height={6 * sc}
          fill="#FF1744"
          rx={1 * sc}
        />

        {/* Candle 3 — green */}
        <Rect
          x={cx - 14 * sc}
          y={50 * sc}
          width={4 * sc}
          height={14 * sc}
          fill="url(#candleGreen)"
          rx={1 * sc}
        />
        <Rect
          x={cx - 13 * sc}
          y={38 * sc}
          width={2 * sc}
          height={12 * sc}
          fill="#00C853"
          rx={1 * sc}
        />
      </G>

      {/* ── Financial vectors: Trend line (right) ── */}
      <G opacity={0.5}>
        <Line
          x1={cx + 15 * sc}
          y1={80 * sc}
          x2={cx + 25 * sc}
          y2={65 * sc}
          stroke="#00F0FF"
          strokeWidth={1.5 * sc}
          strokeLinecap="round"
        />
        <Line
          x1={cx + 25 * sc}
          y1={65 * sc}
          x2={cx + 35 * sc}
          y2={60 * sc}
          stroke="#FFD700"
          strokeWidth={1.5 * sc}
          strokeLinecap="round"
        />
        {/* Arrow head */}
        <Path
          d={`M${cx + 35 * sc},${60 * sc} L${cx + 32 * sc},${55 * sc} L${cx + 30 * sc},${63 * sc} Z`}
          fill="#FFD700"
        />
      </G>

      {/* ── Matrix grid lines ── */}
      <G opacity={0.15}>
        <Line
          x1={cx - 40 * sc} y1={70 * sc}
          x2={cx + 40 * sc} y2={70 * sc}
          stroke="#00F0FF"
          strokeWidth={0.3 * sc}
        />
        <Line
          x1={cx - 40 * sc} y1={80 * sc}
          x2={cx + 40 * sc} y2={80 * sc}
          stroke="#00F0FF"
          strokeWidth={0.3 * sc}
        />
        <Line
          x1={cx - 40 * sc} y1={90 * sc}
          x2={cx + 40 * sc} y2={90 * sc}
          stroke="#00F0FF"
          strokeWidth={0.3 * sc}
        />
      </G>

      {/* ── Cyberpunk Cyan accent border ── */}
      <Path
        d={`
          M${cx},${5 * sc}
          L${cx + 55 * sc},${20 * sc}
          L${cx + 55 * sc},${60 * sc}
          Q${cx + 55 * sc},${95 * sc} ${cx},${130 * sc}
          Q${cx - 55 * sc},${95 * sc} ${cx - 55 * sc},${60 * sc}
          L${cx - 55 * sc},${20 * sc}
          Z
        `}
        fill="none"
        stroke="url(#cyanGlowGrad)"
        strokeWidth={1.5 * sc}
        strokeLinejoin="round"
        opacity={glowOpacity}
      />

      {/* ── Premium Gold accent lines at top ── */}
      <Line
        x1={cx - 30 * sc} y1={12 * sc}
        x2={cx + 30 * sc} y2={12 * sc}
        stroke="#FFD700"
        strokeWidth={0.8 * sc}
        opacity={glowOpacity * 0.7}
        strokeLinecap="round"
      />

      {/* ── Small decorative dots ── */}
      <Circle cx={cx - 40 * sc} cy={25 * sc} r={1.5 * sc} fill="#00F0FF" opacity={0.6} />
      <Circle cx={cx + 40 * sc} cy={25 * sc} r={1.5 * sc} fill="#FFD700" opacity={0.6} />
      <Circle cx={cx} cy={38 * sc} r={1 * sc} fill="#00F0FF" opacity={0.4} />
    </Svg>
  );
}
