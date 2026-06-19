import React, { useMemo } from 'react';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  G,
  Rect,
} from 'react-native-svg';
interface ToroloomLogoProps {
  size?: number;
}

export default function ToroloomLogo({ size = 48 }: ToroloomLogoProps) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const scale = s / 48; // base design at 48px

  const hexPoints = useMemo(() => {
    const r = (n: number) => {
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const x = cx + n * scale * Math.cos(angle);
        const y = cy + n * scale * Math.sin(angle);
        pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return pts.join(' ') + ' Z';
    };
    return r;
  }, [cx, cy, scale]);

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Defs>
        {/* Primary gradient — Electric Blue to Emerald */}
        <LinearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#3B82F6" stopOpacity="1" />
          <Stop offset="50%" stopColor="#6366F1" stopOpacity="0.9" />
          <Stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
        </LinearGradient>

        {/* Glow gradient — soft outer halo */}
        <LinearGradient id="glowGrad" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
          <Stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
        </LinearGradient>

        {/* Secondary — lighter core */}
        <LinearGradient id="coreGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#60A5FA" stopOpacity="1" />
          <Stop offset="100%" stopColor="#34D399" stopOpacity="0.9" />
        </LinearGradient>

        {/* Grid line gradient */}
        <LinearGradient id="gridGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
          <Stop offset="30%" stopColor="#3B82F6" stopOpacity="0.4" />
          <Stop offset="70%" stopColor="#10B981" stopOpacity="0.4" />
          <Stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Outer glow circle */}
      <Circle
        cx={cx}
        cy={cy}
        r={22 * scale}
        fill="url(#glowGrad)"
      />

      {/* Concentric hexagon — outer ring */}
      <Path
        d={hexPoints(20)}
        fill="none"
        stroke="url(#logoGrad)"
        strokeWidth={1.5 * scale}
        strokeLinejoin="round"
        opacity={0.6}
      />

      {/* Concentric hexagon — middle ring */}
      <Path
        d={hexPoints(14)}
        fill="none"
        stroke="url(#logoGrad)"
        strokeWidth={1.2 * scale}
        strokeLinejoin="round"
        opacity={0.8}
      />

      {/* Concentric hexagon — inner core */}
      <Path
        d={hexPoints(8)}
        fill="url(#coreGrad)"
        stroke="url(#logoGrad)"
        strokeWidth={1 * scale}
        strokeLinejoin="round"
        opacity={0.95}
      />

      {/* Center dot — the execution point */}
      <Circle cx={cx} cy={cy} r={2 * scale} fill="#FFFFFF" opacity={0.9} />

      {/* Matrix grid lines — vertical */}
      <G opacity={0.25}>
        <Rect
          x={cx - 0.3 * scale}
          y={cy - 16 * scale}
          width={0.6 * scale}
          height={32 * scale}
          fill="url(#gridGrad)"
          rx={0.3 * scale}
        />
        <Rect
          x={cx - 9 * scale}
          y={cy - 16 * scale}
          width={0.4 * scale}
          height={32 * scale}
          fill="url(#gridGrad)"
          rx={0.2 * scale}
          opacity={0.5}
        />
        <Rect
          x={cx + 9 * scale}
          y={cy - 16 * scale}
          width={0.4 * scale}
          height={32 * scale}
          fill="url(#gridGrad)"
          rx={0.2 * scale}
          opacity={0.5}
        />
      </G>

      {/* Diagonal cross-hairs */}
      <G opacity={0.2} stroke="url(#logoGrad)" strokeWidth={0.5 * scale}>
        <Path d={`M${cx - 18 * scale},${cy - 10 * scale} L${cx + 18 * scale},${cy + 10 * scale}`} />
        <Path d={`M${cx - 18 * scale},${cy + 10 * scale} L${cx + 18 * scale},${cy - 10 * scale}`} />
      </G>
    </Svg>
  );
}
