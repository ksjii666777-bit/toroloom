/**
 * ============================================================================
 * Toroloom — Onboarding Animated SVG Illustrations
 * ============================================================================
 *
 * Premium animated vector illustrations for each onboarding step using
 * react-native-svg + react-native-reanimated for smooth, performant
 * native-driver animations.
 *
 * Each illustration is self-contained, interactive, and themed to the
 * step's gradient colors.
 *
 * ============================================================================
 */

import React, { useEffect } from 'react';
import Svg, {
  Path,
  Circle,
  Rect,
  Line,
  G,
  Defs,
  LinearGradient,
  Stop,
  Ellipse,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';

// ─── Create animated SVG components ───────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// ─── Shared illustration dimensions ───────────────────────────────────────

const SIZE = 200;
const H_CENTER = SIZE / 2;
const V_CENTER = SIZE / 2;

// ═══════════════════════════════════════════════════════════════════════════
// 1. ROCKET / WELCOME ILLUSTRATION
// ═══════════════════════════════════════════════════════════════════════════

interface RocketIllustrationProps {
  colors?: readonly [string, string];
}

export function RocketIllustration({
  colors = ['#3B82F6', '#1D4ED8'],
}: RocketIllustrationProps) {
  const flameH = useSharedValue(20);
  const starOpacity1 = useSharedValue(0.3);
  const starOpacity2 = useSharedValue(0.6);
  const glowR = useSharedValue(30);
  const engineGlow = useSharedValue(0.5);

  useEffect(() => {
    flameH.value = withRepeat(
      withSequence(
        withTiming(28, { duration: 400, easing: Easing.inOut(Easing.sin) }),
        withTiming(20, { duration: 400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    starOpacity1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 }),
        withTiming(0.2, { duration: 1200 })
      ),
      -1,
      true
    );
    starOpacity2.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 900 }),
        withTiming(0.1, { duration: 900 })
      ),
      -1,
      true
    );
    glowR.value = withRepeat(
      withSequence(
        withTiming(38, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(28, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    engineGlow.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 600 }),
        withTiming(0.3, { duration: 600 })
      ),
      -1,
      true
    );
  }, []);

  // Note: rocketY not animated here — the interactive RocketAnimation component
  // handles the tap-to-launch. This SVG illustration provides the hero art.

  const flameProps = useAnimatedProps(() => ({
    rx: 12,
    ry: flameH.value,
  }));
  const star1Props = useAnimatedProps(() => ({ opacity: starOpacity1.value }));
  const star2Props = useAnimatedProps(() => ({ opacity: starOpacity2.value }));
  const glowProps = useAnimatedProps(() => ({ r: glowR.value }));
  const engineProps = useAnimatedProps(() => ({ opacity: engineGlow.value }));

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Defs>
        <LinearGradient id="rocketGlow" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0%" stopColor={colors[0]} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={colors[1]} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="flameGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FF6B35" stopOpacity="1" />
          <Stop offset="60%" stopColor="#FFAB40" stopOpacity="0.8" />
          <Stop offset="100%" stopColor="#FFD54F" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#E0E6ED" stopOpacity="1" />
          <Stop offset="100%" stopColor="#94A3B8" stopOpacity="1" />
        </LinearGradient>
      </Defs>

      {/* Stars */}
      <G>
        <AnimatedCircle cx={50} cy={40} r={2} fill="#FFFFFF" animatedProps={star1Props} />
        <AnimatedCircle cx={150} cy={55} r={1.5} fill="#FFFFFF" animatedProps={star2Props} />
        <Circle cx={130} cy={30} r={1} fill="#FFFFFF" opacity={0.4} />
        <Circle cx={40} cy={70} r={1.2} fill="#FFFFFF" opacity={0.5} />
        <Circle cx={165} cy={80} r={0.8} fill="#FFFFFF" opacity={0.3} />
      </G>

      {/* Glow behind rocket */}
      <AnimatedCircle cx={H_CENTER} cy={95} r={30} fill="url(#rocketGlow)" animatedProps={glowProps} />

      {/* Rocket group */}
      <G>
        {/* Flame */}
        <AnimatedEllipse
          cx={H_CENTER}
          cy={140}
          rx={12}
          ry={20}
          fill="url(#flameGrad)"
          animatedProps={flameProps}
        />

        {/* Engine glow */}
        <AnimatedCircle cx={H_CENTER} cy={120} r={8} fill="#FF6B35" animatedProps={engineProps} />

        {/* Body */}
        <Path
          d={`M${H_CENTER},60 L${H_CENTER + 20},105 L${H_CENTER + 16},120 L${H_CENTER - 16},120 L${H_CENTER - 20},105 Z`}
          fill="url(#bodyGrad)"
          stroke="#64748B"
          strokeWidth={1}
        />

        {/* Nose cone */}
        <Path
          d={`M${H_CENTER},60 L${H_CENTER + 10},90 L${H_CENTER - 10},90 Z`}
          fill={colors[0]}
        />

        {/* Window */}
        <Circle cx={H_CENTER} cy={100} r={7} fill="#0B0F19" />
        <Circle cx={H_CENTER} cy={100} r={5} fill={colors[0]} opacity={0.8} />
        <Circle cx={H_CENTER - 2} cy={98} r={2} fill="#FFFFFF" opacity={0.4} />

        {/* Fins */}
        <Path
          d={`M${H_CENTER + 16},115 L${H_CENTER + 28},130 L${H_CENTER + 16},125 Z`}
          fill={colors[1]}
        />
        <Path
          d={`M${H_CENTER - 16},115 L${H_CENTER - 28},130 L${H_CENTER - 16},125 Z`}
          fill={colors[1]}
        />
      </G>
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. PORTFOLIO / PIE CHART ILLUSTRATION
// ═══════════════════════════════════════════════════════════════════════════

const PIE_SEGMENTS = [
  { percent: 0.45, color: '#3B82F6', label: 'Tech' },
  { percent: 0.25, color: '#00E676', label: 'Finance' },
  { percent: 0.18, color: '#FFAB40', label: 'Energy' },
  { percent: 0.12, color: '#FF5252', label: 'Health' },
];

interface PortfolioIllustrationProps {
  colors?: readonly [string, string];
  onInteract?: () => void;
}

export function PortfolioIllustration({
  colors = ['#10B981', '#047857'],
}: PortfolioIllustrationProps) {
  // ── Animated values ──
  const segmentOpacity = PIE_SEGMENTS.map(() => useSharedValue(0));
  const segmentScale = PIE_SEGMENTS.map(() => useSharedValue(1));
  const centerGlowO = useSharedValue(0.3);
  const particle1X = useSharedValue(40);
  const particle1Y = useSharedValue(35);
  const particle2X = useSharedValue(160);
  const particle2Y = useSharedValue(50);
  const ringRotate = useSharedValue(0);

  useEffect(() => {
    // Sweep-in segments one by one
    PIE_SEGMENTS.forEach((_, i) => {
      segmentOpacity[i].value = withDelay(
        200 + i * 150,
        withTiming(0.85, { duration: 600, easing: Easing.out(Easing.cubic) })
      );
      // Subtle pulse on each segment
      segmentScale[i].value = withDelay(
        600 + i * 150,
        withRepeat(
          withSequence(
            withTiming(1.04, { duration: 1200 + i * 400, easing: Easing.inOut(Easing.sin) }),
            withTiming(1, { duration: 1200 + i * 400, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        )
      );
    });

    // Center glow pulse
    centerGlowO.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.2, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Floating particles orbit
    particle1X.value = withRepeat(
      withSequence(
        withTiming(55, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(40, { duration: 2500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    particle1Y.value = withRepeat(
      withSequence(
        withTiming(25, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(45, { duration: 3000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    particle2X.value = withRepeat(
      withSequence(
        withTiming(145, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(170, { duration: 2800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    particle2Y.value = withRepeat(
      withSequence(
        withTiming(65, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(40, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Outer ring rotation
    ringRotate.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  // ── Animated props ──
  const segmentAnimProps = segmentScale.map((s, i) =>
    useAnimatedProps(() => ({
      opacity: segmentOpacity[i].value,
      transform: [{ scale: s.value }],
    }))
  );
  const centerProps = useAnimatedProps(() => ({ opacity: centerGlowO.value }));
  const particle1Props = useAnimatedProps(() => ({ cx: particle1X.value, cy: particle1Y.value }));
  const particle2Props = useAnimatedProps(() => ({ cx: particle2X.value, cy: particle2Y.value }));
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: -ringRotate.value,
  }));

  // ── Segment positions (computed once) ──
  const segmentPositions = PIE_SEGMENTS.map((seg, i) => {
    const cumulative = PIE_SEGMENTS.slice(0, i).reduce((s, x) => s + x.percent, 0);
    const startAngle = cumulative * 360;
    const endAngle = (cumulative + seg.percent) * 360;
    const midAngle = ((startAngle + endAngle) / 2) * (Math.PI / 180);
    const midX = H_CENTER + 55 * Math.cos(midAngle - Math.PI / 2);
    const midY = V_CENTER + 55 * Math.sin(midAngle - Math.PI / 2);
    return { startAngle, endAngle, midX, midY };
  });

  const buildArcPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} L${cx},${cy} Z`;
  };

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Defs>
        <LinearGradient id="donutCenterGlow" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0%" stopColor={colors[0]} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={colors[1]} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Animated outer glow ring */}
      <AnimatedCircle cx={H_CENTER} cy={V_CENTER} r={75} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} strokeDasharray="8,12" animatedProps={ringProps} />

      {/* Donut chart arcs — each with sweep-in + pulse */}
      {PIE_SEGMENTS.map((seg, i) => {
        const { startAngle, endAngle } = segmentPositions[i];
        const r = 55;
        return (
          <G key={i}>
            <AnimatedPath
              d={buildArcPath(H_CENTER, V_CENTER, r, startAngle, endAngle)}
              fill={seg.color}
              animatedProps={segmentAnimProps[i]}
            />
            {/* Glow border on segment */}
            <AnimatedPath
              d={buildArcPath(H_CENTER, V_CENTER, r, startAngle, endAngle)}
              fill="none"
              stroke={seg.color}
              strokeWidth={1.5}
              animatedProps={segmentAnimProps[i]}
            />
          </G>
        );
      })}

      {/* Inner circle (creates donut) */}
      <Circle cx={H_CENTER} cy={V_CENTER} r={25} fill="#0B0F19" />

      {/* Pulsing center glow */}
      <AnimatedCircle cx={H_CENTER} cy={V_CENTER} r={30} fill="url(#donutCenterGlow)" animatedProps={centerProps} />

      {/* Percentage labels */}
      {PIE_SEGMENTS.map((seg, i) => (
        <G key={`label-${i}`}>
          <Circle cx={segmentPositions[i].midX} cy={segmentPositions[i].midY} r={3} fill="#FFFFFF" opacity={0.8} />
          <Line
            x1={segmentPositions[i].midX}
            y1={segmentPositions[i].midY}
            x2={segmentPositions[i].midX * 1.15}
            y2={segmentPositions[i].midY * 1.15}
            stroke={seg.color}
            strokeWidth={0.5}
            opacity={0.5}
          />
        </G>
      ))}

      {/* Floating data particles — orbiting motion */}
      <AnimatedCircle r={2} fill="#00E676" opacity={0.4} animatedProps={particle1Props} />
      <AnimatedCircle r={1.5} fill="#3B82F6" opacity={0.5} animatedProps={particle2Props} />
      <Circle cx={30} cy={150} r={1.2} fill="#FFAB40" opacity={0.3} />
      <Circle cx={170} cy={140} r={1.8} fill="#FF5252" opacity={0.2} />
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. MARKETS / CANDLESTICK ILLUSTRATION
// ═══════════════════════════════════════════════════════════════════════════

const CANDLE_DATA = [
  { open: 80, close: 90, high: 95, low: 75 },
  { open: 90, close: 85, high: 92, low: 82 },
  { open: 85, close: 100, high: 105, low: 83 },
  { open: 100, close: 108, high: 112, low: 98 },
  { open: 108, close: 105, high: 110, low: 102 },
  { open: 105, close: 118, high: 122, low: 103 },
  { open: 118, close: 125, high: 130, low: 116 },
];

interface MarketsIllustrationProps {
  colors?: readonly [string, string];
  onInteract?: () => void;
}

export function MarketsIllustration({
  colors = ['#3B82F6', '#6366F1'],
}: MarketsIllustrationProps) {
  const chartB = 55;
  const chartT = 20;
  const chartH = chartB - chartT;
  const candleW = 12;
  const gap = 8;
  const startX = 45;

  const prices = CANDLE_DATA.map(d => d.high);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...CANDLE_DATA.map(d => d.low));
  const range = maxPrice - minPrice || 1;

  const toY = (price: number) => chartB - ((price - minPrice) / range) * chartH;

  const linePoints = CANDLE_DATA.map((d, i) => {
    const x = startX + i * (candleW + gap) + candleW / 2;
    const closeY = toY(d.close);
    return `${x},${closeY}`;
  }).join(' ');

  // ── Animated values ──
  const candleScales = CANDLE_DATA.map(() => useSharedValue(0));
  const candleOpacities = CANDLE_DATA.map(() => useSharedValue(0));
  const dotGlows = CANDLE_DATA.map(() => useSharedValue(0.3));
  const trendDash = useSharedValue(200);
  const crosshairX = useSharedValue(H_CENTER);
  const crosshairY = useSharedValue(V_CENTER);

  useEffect(() => {
    // Candles grow in one by one
    CANDLE_DATA.forEach((_, i) => {
      candleScales[i].value = withDelay(
        100 + i * 80,
        withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
      );
      candleOpacities[i].value = withDelay(
        100 + i * 80,
        withTiming(0.85, { duration: 300 })
      );
      // Dot glow pulse
      dotGlows[i].value = withDelay(
        400 + i * 80,
        withRepeat(
          withSequence(
            withTiming(0.9, { duration: 1000 + i * 200 }),
            withTiming(0.2, { duration: 1000 + i * 200 })
          ),
          -1,
          true
        )
      );
    });

    // Trend line draws in
    trendDash.value = withDelay(
      200,
      withTiming(0, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );

    // Crosshair floats
    crosshairX.value = withRepeat(
      withSequence(
        withTiming(90, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(H_CENTER, { duration: 3000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    crosshairY.value = withRepeat(
      withSequence(
        withTiming(30, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
        withTiming(V_CENTER, { duration: 3500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  // ── Animated props ──
  const candleAnimProps = CANDLE_DATA.map((d, i) => {
    const openY = toY(d.open);
    const closeY = toY(d.close);
    const bodyBottom = Math.max(openY, closeY);
    const bodyH = Math.max(Math.abs(closeY - openY), 2);

    return useAnimatedProps(() => ({
      y: bodyBottom - bodyH * candleScales[i].value,
      height: bodyH * candleScales[i].value,
      opacity: candleOpacities[i].value,
    }));
  });

  const glowAnimProps = CANDLE_DATA.map((d, i) => {
    const openY = toY(d.open);
    const closeY = toY(d.close);
    const bodyBottom = Math.max(openY, closeY);
    const bodyH = Math.max(Math.abs(closeY - openY), 2);

    return useAnimatedProps(() => ({
      y: bodyBottom - bodyH * candleScales[i].value,
      height: bodyH * candleScales[i].value,
      opacity: candleOpacities[i].value * 0.35,
    }));
  });

  const dotProps = CANDLE_DATA.map((_, i) =>
    useAnimatedProps(() => ({ opacity: dotGlows[i].value }))
  );

  const trendProps = useAnimatedProps(() => ({
    strokeDashoffset: trendDash.value,
  }));

  const crosshairXProps = useAnimatedProps(() => ({ x1: crosshairX.value, x2: crosshairX.value }));
  const crosshairYProps = useAnimatedProps(() => ({ y1: crosshairY.value, y2: crosshairY.value }));

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Defs>
        <LinearGradient id="trendLineGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={colors[0]} stopOpacity="0" />
          <Stop offset="50%" stopColor={colors[0]} stopOpacity="0.8" />
          <Stop offset="100%" stopColor={colors[1]} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="fillArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colors[0]} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={colors[0]} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Background grid lines */}
      {[0, 1, 2, 3].map(i => (
        <Line
          key={`grid-${i}`}
          x1={35}
          y1={chartT + (chartH / 4) * i}
          x2={185}
          y2={chartT + (chartH / 4) * i}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={0.5}
        />
      ))}

      {/* Candles — grow in with scale animation */}
      {CANDLE_DATA.map((d, i) => {
        const isUp = d.close >= d.open;
        const x = startX + i * (candleW + gap);
        const highY = toY(d.high);
        const lowY = toY(d.low);
        return (
          <G key={i}>
            {/* Wick */}
            <Line
              x1={x + candleW / 2}
              y1={highY}
              x2={x + candleW / 2}
              y2={lowY}
              stroke={isUp ? '#00E676' : '#FF5252'}
              strokeWidth={1}
            />
            {/* Body — animated height & opacity */}
            <AnimatedRect
              x={x}
              width={candleW}
              fill={isUp ? '#00E676' : '#FF5252'}
              rx={1}
              animatedProps={candleAnimProps[i]}
            />
            {/* Glow — animated with scale */}
            <AnimatedRect
              x={x - 1}
              width={candleW + 2}
              fill="none"
              stroke={isUp ? '#00E676' : '#FF5252'}
              strokeWidth={0.5}
              rx={2}
              animatedProps={glowAnimProps[i]}
            />
          </G>
        );
      })}

      {/* Trend line — draws in */}
      <Polyline points={linePoints} fill="none" stroke="url(#trendLineGrad)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="200" animatedProps={trendProps} />

      {/* Moving average glow dots — pulsing */}
      {CANDLE_DATA.map((d, i) => {
        const x = startX + i * (candleW + gap) + candleW / 2;
        const closeY = toY(d.close);
        return (
          <AnimatedCircle
            key={`dot-${i}`}
            cx={x}
            cy={closeY}
            r={2}
            fill={colors[0]}
            animatedProps={dotProps[i]}
          />
        );
      })}

      {/* Floating crosshair */}
      <AnimatedLine x1={H_CENTER} y1={15} x2={H_CENTER} y2={60} stroke={colors[0]} strokeWidth={0.5} strokeDasharray="2,3" animatedProps={crosshairXProps} />
      <AnimatedLine x1={35} y1={V_CENTER} x2={185} y2={V_CENTER} stroke={colors[1]} strokeWidth={0.5} strokeDasharray="2,3" animatedProps={crosshairYProps} />
    </Svg>
  );
}

// Simple polyline component
function Polyline({ points, ...props }: any) {
  const parts = points.split(' ').map((p: string) => p.split(','));
  const d = parts.map((p: string[], i: number) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  return <Path d={d} {...props} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. TRADING / EXECUTION ILLUSTRATION
// ═══════════════════════════════════════════════════════════════════════════

interface TradingIllustrationProps {
  colors?: readonly [string, string];
}

export function TradingIllustration({
  colors = ['#F59E0B', '#D97706'],
}: TradingIllustrationProps) {
  // ── Animated values ──
  const buyPulse = useSharedValue(1);
  const sellPulse = useSharedValue(1);
  const buyGlow = useSharedValue(0.3);
  const sellGlow = useSharedValue(0.3);
  const flowOffset = useSharedValue(0);
  const dot1X = useSharedValue(30);
  const dot2X = useSharedValue(170);

  useEffect(() => {
    // Buy circle pulses
    buyPulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    buyGlow.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.2, { duration: 1000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Sell circle pulses (offset phase)
    sellPulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    sellGlow.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.15, { duration: 1300, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Connector dashes flow along the path (seamless loop)
    flowOffset.value = withRepeat(
      withTiming(-14, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );

    // Floating dots drift
    dot1X.value = withRepeat(
      withSequence(
        withTiming(40, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(25, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    dot2X.value = withRepeat(
      withSequence(
        withTiming(160, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(178, { duration: 2500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  // ── Animated props ──
  const buyProps = useAnimatedProps(() => ({
    r: 28 * buyPulse.value,
    opacity: 0.85 + (buyPulse.value - 1) * 2,
  }));
  const buyGlowProps = useAnimatedProps(() => ({ opacity: buyGlow.value }));
  const sellProps = useAnimatedProps(() => ({
    r: 28 * sellPulse.value,
    opacity: 0.85 + (sellPulse.value - 1) * 2,
  }));
  const sellGlowProps = useAnimatedProps(() => ({ opacity: sellGlow.value }));
  const flowProps = useAnimatedProps(() => ({ strokeDashoffset: flowOffset.value }));
  const dot1Props = useAnimatedProps(() => ({ cx: dot1X.value }));
  const dot2Props = useAnimatedProps(() => ({ cx: dot2X.value }));

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Defs>
        <LinearGradient id="buyGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#00E676" stopOpacity="1" />
          <Stop offset="100%" stopColor="#00C853" stopOpacity="0.8" />
        </LinearGradient>
        <LinearGradient id="sellGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FF5252" stopOpacity="1" />
          <Stop offset="100%" stopColor="#D32F2F" stopOpacity="0.8" />
        </LinearGradient>
        <LinearGradient id="tradeConnector" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#00E676" stopOpacity="0" />
          <Stop offset="50%" stopColor={colors[0]} stopOpacity="0.6" />
          <Stop offset="100%" stopColor="#FF5252" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Order flow connector line — flowing dashes */}
      <AnimatedPath
        d={`M40,${V_CENTER} Q100,${V_CENTER - 15} ${H_CENTER},${V_CENTER} Q150,${V_CENTER + 15} 160,${V_CENTER}`}
        fill="none"
        stroke="url(#tradeConnector)"
        strokeWidth={1.5}
        strokeDasharray="6,8"
        animatedProps={flowProps}
      />

      {/* Buy circle — pulsing */}
      <AnimatedCircle cx={50} cy={V_CENTER} fill="url(#buyGrad)" animatedProps={buyProps} />
      <AnimatedCircle cx={50} cy={V_CENTER} r={32} fill="none" stroke="#00E676" strokeWidth={1} animatedProps={buyGlowProps} />
      {/* Buy arrow up — bouncing */}
      <G>
        <Path
          d={`M50,${V_CENTER - 8} L44,${V_CENTER + 2} L56,${V_CENTER + 2} Z`}
          fill="#FFFFFF"
        />
        <Line x1={50} y1={V_CENTER - 8} x2={50} y2={V_CENTER + 10} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
      </G>

      {/* Order book icon in middle */}
      <Rect x={90} y={V_CENTER - 12} width={20} height={24} rx={3} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
      <Line x1={95} y1={V_CENTER - 6} x2={105} y2={V_CENTER - 6} stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
      <Line x1={95} y1={V_CENTER - 2} x2={105} y2={V_CENTER - 2} stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
      <Line x1={95} y1={V_CENTER + 2} x2={101} y2={V_CENTER + 2} stroke="rgba(255,255,255,0.4)" strokeWidth={1} />

      {/* Sell circle — pulsing */}
      <AnimatedCircle cx={150} cy={V_CENTER} fill="url(#sellGrad)" animatedProps={sellProps} />
      <AnimatedCircle cx={150} cy={V_CENTER} r={32} fill="none" stroke="#FF5252" strokeWidth={1} animatedProps={sellGlowProps} />
      {/* Sell arrow down — bouncing */}
      <G>
        <Path
          d={`M150,${V_CENTER + 8} L144,${V_CENTER - 2} L156,${V_CENTER - 2} Z`}
          fill="#FFFFFF"
        />
        <Line x1={150} y1={V_CENTER + 8} x2={150} y2={V_CENTER - 10} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
      </G>

      {/* Small decorative dots — drifting */}
      <AnimatedCircle cy={30} r={1.5} fill="#00E676" opacity={0.4} animatedProps={dot1Props} />
      <AnimatedCircle cy={30} r={1.5} fill="#FF5252" opacity={0.4} animatedProps={dot2Props} />
      <Circle cx={30} cy={170} r={1} fill="#FFAB40" opacity={0.3} />
      <Circle cx={170} cy={170} r={1} fill="#3B82F6" opacity={0.3} />

      {/* Execution lines */}
      <Line x1={50} y1={V_CENTER - 28} x2={50} y2={V_CENTER - 40} stroke="#00E676" strokeWidth={0.5} opacity={0.3} />
      <Line x1={150} y1={V_CENTER + 28} x2={150} y2={V_CENTER + 40} stroke="#FF5252" strokeWidth={0.5} opacity={0.3} />
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. BROKER / CONNECTION SHIELD ILLUSTRATION
// ═══════════════════════════════════════════════════════════════════════════

interface BrokerIllustrationProps {
  colors?: readonly [string, string];
  onInteract?: () => void;
}

export function BrokerIllustration({
  colors = ['#2874F0', '#1A5FCC'],
}: BrokerIllustrationProps) {
  const pulse1 = useSharedValue(0.3);
  const pulse2 = useSharedValue(0.5);
  const pulse3 = useSharedValue(0.7);
  const shieldGlow = useSharedValue(0.4);

  useEffect(() => {
    pulse1.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.2, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    pulse2.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    pulse3.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.1, { duration: 1200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    shieldGlow.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 2500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const node1Props = useAnimatedProps(() => ({ opacity: pulse1.value }));
  const node2Props = useAnimatedProps(() => ({ opacity: pulse2.value }));
  const node3Props = useAnimatedProps(() => ({ opacity: pulse3.value }));
  const shieldProps = useAnimatedProps(() => ({ r: 38 + pulse1.value * 5 }));

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Defs>
        <LinearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={colors[0]} stopOpacity="1" />
          <Stop offset="100%" stopColor={colors[1]} stopOpacity="0.8" />
        </LinearGradient>
        <LinearGradient id="connectionLine" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={colors[0]} stopOpacity="0" />
          <Stop offset="50%" stopColor={colors[0]} stopOpacity="0.4" />
          <Stop offset="100%" stopColor={colors[0]} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Connection lines between nodes */}
      <Line x1={40} y1={40} x2={H_CENTER} y2={V_CENTER} stroke={colors[0]} strokeWidth={0.5} opacity={0.2} strokeDasharray="3,3" />
      <Line x1={160} y1={40} x2={H_CENTER} y2={V_CENTER} stroke={colors[0]} strokeWidth={0.5} opacity={0.2} strokeDasharray="3,3" />
      <Line x1={40} y1={160} x2={H_CENTER} y2={V_CENTER} stroke={colors[0]} strokeWidth={0.5} opacity={0.15} strokeDasharray="3,3" />
      <Line x1={160} y1={160} x2={H_CENTER} y2={V_CENTER} stroke={colors[0]} strokeWidth={0.5} opacity={0.15} strokeDasharray="3,3" />

      {/* Network nodes */}
      <AnimatedCircle cx={40} cy={40} r={6} fill={colors[0]} animatedProps={node1Props} />
      <Circle cx={40} cy={40} r={10} fill={colors[0]} opacity={0.1} />
      <AnimatedCircle cx={160} cy={40} r={6} fill={colors[0]} animatedProps={node2Props} />
      <Circle cx={160} cy={40} r={10} fill={colors[0]} opacity={0.1} />
      <AnimatedCircle cx={40} cy={160} r={5} fill={colors[1]} animatedProps={node3Props} />
      <Circle cx={40} cy={160} r={8} fill={colors[1]} opacity={0.1} />
      <Circle cx={160} cy={160} r={5} fill={colors[1]} opacity={0.3} />

      {/* Shield */}
      <AnimatedCircle cx={H_CENTER} cy={V_CENTER} fill="url(#shieldGrad)" animatedProps={shieldProps} />
      <Circle cx={H_CENTER} cy={V_CENTER} r={38} fill="none" stroke={colors[0]} strokeWidth={1} opacity={0.3} />

      {/* Shield center checkmark */}
      <Path
        d={`M${H_CENTER - 12},${V_CENTER} L${H_CENTER - 4},${V_CENTER + 10} L${H_CENTER + 14},${V_CENTER - 8}`}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Lock icon */}
      <Circle cx={H_CENTER} cy={45} r={8} fill={colors[0]} opacity={0.8} />
      <Path
        d={`M${H_CENTER - 3},${45} L${H_CENTER - 3},${42} Q${H_CENTER - 3},${39} ${H_CENTER},${39} Q${H_CENTER + 3},${39} ${H_CENTER + 3},${42} L${H_CENTER + 3},${45}`}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.5}
      />
      <Rect x={H_CENTER - 3.5} y={44} width={7} height={5} rx={1} fill="#FFFFFF" />

      {/* Outer decorative ring */}
      <Circle
        cx={H_CENTER}
        cy={V_CENTER}
        r={55}
        fill="none"
        stroke={colors[0]}
        strokeWidth={0.3}
        opacity={0.2}
        strokeDasharray="4,6"
      />
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. LEARN / BOOK & BADGES ILLUSTRATION
// ═══════════════════════════════════════════════════════════════════════════

interface LearnIllustrationProps {
  colors?: readonly [string, string];
  onInteract?: () => void;
}

export function LearnIllustration({
  colors = ['#8B5CF6', '#6D28D9'],
}: LearnIllustrationProps) {
  const glow1 = useSharedValue(0.4);
  const glow2 = useSharedValue(0.6);
  const pageOffset = useSharedValue(0);

  useEffect(() => {
    glow1.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    glow2.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    pageOffset.value = withRepeat(
      withSequence(
        withTiming(2, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const glow1Props = useAnimatedProps(() => ({ r: 12 + glow1.value * 4 }));
  const glow2Props = useAnimatedProps(() => ({ r: 10 + glow2.value * 3 }));

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Defs>
        <LinearGradient id="bookGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={colors[0]} stopOpacity="1" />
          <Stop offset="100%" stopColor={colors[1]} stopOpacity="0.8" />
        </LinearGradient>
        <LinearGradient id="pageGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <Stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.9" />
        </LinearGradient>
        <LinearGradient id="glowGrad" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0%" stopColor={colors[0]} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={colors[1]} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Book base (open book) */}
      {/* Left page */}
      <Path
        d={`M${H_CENTER - 5},45 L${H_CENTER - 5},125 L${H_CENTER - 55},115 L${H_CENTER - 55},35 Z`}
        fill="url(#pageGrad)"
        stroke="#CBD5E1"
        strokeWidth={0.5}
        opacity={0.9}
      />
      {/* Right page */}
      <Path
        d={`M${H_CENTER + 5},45 L${H_CENTER + 5},125 L${H_CENTER + 55},115 L${H_CENTER + 55},35 Z`}
        fill="url(#pageGrad)"
        stroke="#CBD5E1"
        strokeWidth={0.5}
        opacity={0.9}
      />
      {/* Spine */}
      <Line x1={H_CENTER} y1={42} x2={H_CENTER} y2={128} stroke={colors[0]} strokeWidth={2} />

      {/* Book cover edges */}
      <Path
        d={`M${H_CENTER - 58},33 L${H_CENTER - 58},117 L${H_CENTER - 3},128 L${H_CENTER - 3},42 Z`}
        fill="url(#bookGrad)"
        opacity={0.3}
      />
      <Path
        d={`M${H_CENTER + 58},33 L${H_CENTER + 58},117 L${H_CENTER + 3},128 L${H_CENTER + 3},42 Z`}
        fill="url(#bookGrad)"
        opacity={0.3}
      />

      {/* Text lines on left page */}
      <Line x1={H_CENTER - 45} y1={60} x2={H_CENTER - 10} y2={60} stroke="#64748B" strokeWidth={1.5} opacity={0.3} />
      <Line x1={H_CENTER - 45} y1={68} x2={H_CENTER - 15} y2={68} stroke="#64748B" strokeWidth={1.5} opacity={0.3} />
      <Line x1={H_CENTER - 45} y1={76} x2={H_CENTER - 20} y2={76} stroke="#64748B" strokeWidth={1.5} opacity={0.2} />
      <Line x1={H_CENTER - 45} y1={84} x2={H_CENTER - 12} y2={84} stroke="#64748B" strokeWidth={1.5} opacity={0.2} />
      <Line x1={H_CENTER - 45} y1={92} x2={H_CENTER - 25} y2={92} stroke="#64748B" strokeWidth={1.5} opacity={0.15} />

      {/* Text lines on right page */}
      <Line x1={H_CENTER + 12} y1={60} x2={H_CENTER + 47} y2={60} stroke="#64748B" strokeWidth={1.5} opacity={0.3} />
      <Line x1={H_CENTER + 12} y1={68} x2={H_CENTER + 42} y2={68} stroke="#64748B" strokeWidth={1.5} opacity={0.3} />
      <Line x1={H_CENTER + 12} y1={76} x2={H_CENTER + 37} y2={76} stroke="#64748B" strokeWidth={1.5} opacity={0.2} />
      <Line x1={H_CENTER + 12} y1={84} x2={H_CENTER + 45} y2={84} stroke="#64748B" strokeWidth={1.5} opacity={0.2} />

      {/* Floating badges / icons around book */}
      {/* Star badge top-left */}
      <G>
        <AnimatedCircle cx={30} cy={35} fill={colors[0]} animatedProps={glow1Props} />
        <Path
          d={`M30,29 L32,33 L36,33 L33,36 L34,40 L30,38 L26,40 L27,36 L24,33 L28,33 Z`}
          fill="#FFFFFF"
          opacity={0.9}
        />
      </G>

      {/* Star badge top-right */}
      <G>
        <AnimatedCircle cx={170} cy={40} fill={colors[1]} animatedProps={glow2Props} />
        <Path
          d={`M170,35 L171.5,38 L174.5,38 L172,40 L173,43 L170,41.5 L167,43 L168,40 L165.5,38 L168.5,38 Z`}
          fill="#FFFFFF"
          opacity={0.9}
        />
      </G>

      {/* Small floating dots */}
      <Circle cx={30} cy={140} r={2} fill={colors[0]} opacity={0.4} />
      <Circle cx={170} cy={135} r={1.5} fill={colors[1]} opacity={0.3} />
      <Circle cx={55} cy={160} r={1.2} fill="#FFAB40" opacity={0.3} />
      <Circle cx={145} cy={158} r={1.8} fill="#00E676" opacity={0.3} />

      {/* Graduation cap at bottom center */}
      <Path
        d={`M${H_CENTER - 15},145 L${H_CENTER},138 L${H_CENTER + 15},145 L${H_CENTER},152 Z`}
        fill={colors[0]}
        opacity={0.6}
      />
      <Line x1={H_CENTER} y1={138} x2={H_CENTER} y2={132} stroke={colors[0]} strokeWidth={1} opacity={0.5} />
      <Circle cx={H_CENTER} cy={132} r={2} fill={colors[0]} opacity={0.5} />
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Illustration Resolver
// ═══════════════════════════════════════════════════════════════════════════

interface IllustrationProps {
  stepId: string;
  gradient: readonly [string, string];
}

export function renderIllustration({ stepId, gradient }: IllustrationProps) {
  switch (stepId) {
    case 'welcome':
      return <RocketIllustration colors={gradient} />;
    case 'portfolio':
      return <PortfolioIllustration colors={gradient} />;
    case 'markets':
      return <MarketsIllustration colors={gradient} />;
    case 'trading':
      return <TradingIllustration colors={gradient} />;
    case 'broker':
      return <BrokerIllustration colors={gradient} />;
    case 'learn':
      return <LearnIllustration colors={gradient} />;
    default:
      return null;
  }
}
