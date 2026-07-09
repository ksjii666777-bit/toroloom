/**
 * ============================================================================
 * Toroloom — Onboarding Lottie Animations
 * ============================================================================
 *
 * Lottie animation alternatives for each onboarding step.
 * Each animation is generated inline as valid Lottie JSON with simple
 * shape layers (circles, rectangles, paths) for lightweight, performant
 * rendering via lottie-react-native.
 *
 * Usage:
 *   <LottieView source={getLottieAnimation('welcome')} autoPlay loop />
 *
 * ============================================================================
 */

import type { ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';
import React from 'react';

// ─── Lottie JSON Generator ───────────────────────────────────────────────

/**
 * Generate a minimal Lottie animation for a given step.
 * Each animation is a simple shape composition using ellipses, rectangles,
 * and basic keyframe transforms (position, scale, opacity, rotation).
 */

interface LottieLayer {
  ddd: number;
  ind: number;
  ty: 4; // shape layer
  nm: string;
  sr: 1;
  ks: {
    o: { a: number; k: any };
    p: { a: number; k: number[] | Array<{ t: number; s: number[] }> };
    s: { a: number; k: number[] | Array<{ t: number; s: number[] }> };
    r: { a: number; k: number | Array<{ t: number; s: number[] }> };
  };
  shapes: Array<{
    ty: string;
    [key: string]: any;
  }>;
  w?: number;
  h?: number;
}

interface LottieJSON {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  nm: string;
  ddd: number;
  layers: LottieLayer[];
  assets: any[];
  markers?: any[];
}

// ─── Helper: create a simple pulsing circle layer ────────────────────────

function circleLayer(
  ind: number,
  name: string,
  cx: number,
  cy: number,
  r: number,
  color: string,
  pulseScale?: boolean,
  rotate?: number,
): LottieLayer {
  const layer: LottieLayer = {
    ddd: 0,
    ind,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      p: { a: 0, k: [cx, cy, 0] },
      s: pulseScale
        ? {
            a: 1,
            k: [
              { t: 0, s: [100, 100, 100] },
              { t: 30, s: [110, 110, 100] },
              { t: 60, s: [100, 100, 100] },
            ],
          }
        : { a: 0, k: [100, 100, 100] },
      r: { a: 0, k: rotate || 0 },
    },
    shapes: [
      {
        ty: 'el',
        p: { a: 0, k: [0, 0] },
        s: { a: 0, k: [r * 2, r * 2] },
      },
      {
        ty: 'fl',
        c: { a: 0, k: hexToRGB(color) },
        o: { a: 0, k: 100 },
      },
    ],
  };
  return layer;
}

// ─── Helper: hex to Lottie RGB ─────────────────────────────────────────

function hexToRGB(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [
    parseInt(c.substring(0, 2), 16) / 255,
    parseInt(c.substring(2, 4), 16) / 255,
    parseInt(c.substring(4, 6), 16) / 255,
  ];
}

// ─── Animation Definitions ───────────────────────────────────────────────

const S = 200; // canvas size

const stepAnimations: Record<string, LottieJSON> = {
  // ── 1. Rocket / Welcome ──
  welcome: {
    v: '5.5.7',
    fr: 30,
    ip: 0,
    op: 90,
    w: S,
    h: S,
    nm: 'Welcome Rocket',
    ddd: 0,
    assets: [],
    layers: [
      // Rocket body
      {
        ddd: 0,
        ind: 0,
        ty: 4,
        nm: 'Body',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 1, k: [{ t: 0, s: [100, 120, 0] }, { t: 45, s: [100, 100, 0] }, { t: 90, s: [100, 120, 0] }] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [40, 60] } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#3B82F6') }, o: { a: 0, k: 100 } },
        ],
      },
      // Flame
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Flame',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 0, k: [100, 145, 0] },
          s: { a: 1, k: [{ t: 0, s: [100, 100, 100] }, { t: 15, s: [120, 130, 100] }, { t: 30, s: [100, 100, 100] }, { t: 45, s: [110, 120, 100] }, { t: 60, s: [100, 100, 100] }] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'el', p: { a: 0, k: [0, 5] }, s: { a: 0, k: [20, 30] } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#FF6B35') }, o: { a: 0, k: 100 } },
        ],
      },
      // Stars
      circleLayer(2, 'Star1', 50, 40, 3, '#FFFFFF', false),
      circleLayer(3, 'Star2', 150, 55, 2, '#FFFFFF', true),
      circleLayer(4, 'Star3', 130, 30, 1.5, '#FFFFFF', false),
      // Engine glow
      circleLayer(5, 'Glow', 100, 110, 15, '#3B82F6', true),
    ],
  },

  // ── 2. Portfolio ──
  portfolio: {
    v: '5.5.7',
    fr: 30,
    ip: 0,
    op: 60,
    w: S,
    h: S,
    nm: 'Portfolio',
    ddd: 0,
    assets: [],
    layers: [
      // Donut ring (outer)
      {
        ddd: 0,
        ind: 0,
        ty: 4,
        nm: 'Outer Ring',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 0, k: [100, 100, 0] },
          s: { a: 1, k: [{ t: 0, s: [0, 0, 100] }, { t: 20, s: [100, 100, 100] }] },
          r: { a: 1, k: [{ t: 0, s: [0] }, { t: 60, s: [360] }] },
        },
        shapes: [
          { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [140, 140] } },
          { ty: 'st', c: { a: 0, k: hexToRGB('#10B981') }, o: { a: 0, k: 30 }, w: { a: 0, k: 2 } },
        ],
      },
      // Center dot
      circleLayer(1, 'Center', 100, 100, 20, '#0B0F19', false),
      // Data particle 1
      {
        ddd: 0,
        ind: 2,
        ty: 4,
        nm: 'Particle 1',
        sr: 1,
        ks: {
          o: { a: 0, k: 60 },
          p: { a: 1, k: [{ t: 0, s: [30, 30, 0] }, { t: 30, s: [50, 25, 0] }, { t: 60, s: [30, 30, 0] }] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [4, 4] } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#00E676') }, o: { a: 0, k: 100 } },
        ],
      },
      // Data particle 2
      {
        ddd: 0,
        ind: 3,
        ty: 4,
        nm: 'Particle 2',
        sr: 1,
        ks: {
          o: { a: 0, k: 60 },
          p: { a: 1, k: [{ t: 0, s: [170, 50, 0] }, { t: 30, s: [145, 65, 0] }, { t: 60, s: [170, 50, 0] }] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [3, 3] } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#3B82F6') }, o: { a: 0, k: 100 } },
        ],
      },
    ],
  },

  // ── 3. Markets ──
  markets: {
    v: '5.5.7',
    fr: 30,
    ip: 0,
    op: 45,
    w: S,
    h: S,
    nm: 'Markets Candles',
    ddd: 0,
    assets: [],
    layers: [
      // Grid lines
      ...([0, 1, 2].map((i) => ({
        ddd: 0,
        ind: i,
        ty: 4,
        nm: `Grid ${i}`,
        sr: 1,
        ks: {
          o: { a: 0, k: 15 },
          p: { a: 0, k: [100, 30 + i * 20, 0] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [140, 0.5] }, r: { a: 0, k: 0 } },
          { ty: 'fl', c: { a: 0, k: [1, 1, 1] }, o: { a: 0, k: 10 } },
        ],
      } as LottieLayer))),
      // Green candles (growing up)
      {
        ddd: 0,
        ind: 10,
        ty: 4,
        nm: 'Green Candle',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 1, k: [{ t: 0, s: [50, 80, 0] }, { t: 20, s: [50, 70, 0] }] },
          s: { a: 1, k: [{ t: 0, s: [0, 100, 100] }, { t: 10, s: [100, 100, 100] }] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [10, 20] }, r: { a: 0, k: 1 } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#00E676') }, o: { a: 0, k: 100 } },
        ],
      },
      // Red candle
      {
        ddd: 0,
        ind: 11,
        ty: 4,
        nm: 'Red Candle',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 1, k: [{ t: 5, s: [70, 75, 0] }, { t: 25, s: [70, 65, 0] }] },
          s: { a: 1, k: [{ t: 5, s: [0, 100, 100] }, { t: 15, s: [100, 100, 100] }] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [10, 15] }, r: { a: 0, k: 1 } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#FF5252') }, o: { a: 0, k: 100 } },
        ],
      },
      // Green candle 2
      {
        ddd: 0,
        ind: 12,
        ty: 4,
        nm: 'Green Candle 2',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 1, k: [{ t: 10, s: [95, 85, 0] }, { t: 30, s: [95, 75, 0] }] },
          s: { a: 1, k: [{ t: 10, s: [0, 100, 100] }, { t: 20, s: [100, 100, 100] }] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [10, 25] }, r: { a: 0, k: 1 } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#00E676') }, o: { a: 0, k: 100 } },
        ],
      },
      // Trend line (thin rectangle)
      {
        ddd: 0,
        ind: 15,
        ty: 4,
        nm: 'Trend Line',
        sr: 1,
        ks: {
          o: { a: 0, k: 60 },
          p: { a: 0, k: [100, 100, 0] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 1, k: [{ t: 0, s: [25] }, { t: 10, s: [25] }] },
        },
        shapes: [
          { ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [60, 2] }, r: { a: 0, k: 1 } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#3B82F6') }, o: { a: 0, k: 100 } },
        ],
      },
    ],
  },

  // ── 4. Trading ──
  trading: {
    v: '5.5.7',
    fr: 30,
    ip: 0,
    op: 60,
    w: S,
    h: S,
    nm: 'Trading',
    ddd: 0,
    assets: [],
    layers: [
      // Buy circle
      {
        ddd: 0,
        ind: 0,
        ty: 4,
        nm: 'Buy',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 0, k: [55, 100, 0] },
          s: { a: 1, k: [{ t: 0, s: [100, 100, 100] }, { t: 15, s: [108, 108, 100] }, { t: 30, s: [100, 100, 100] }] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [50, 50] } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#00E676') }, o: { a: 0, k: 100 } },
        ],
      },
      // Sell circle
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Sell',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 0, k: [145, 100, 0] },
          s: { a: 1, k: [{ t: 15, s: [100, 100, 100] }, { t: 30, s: [106, 106, 100] }, { t: 45, s: [100, 100, 100] }] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [50, 50] } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#FF5252') }, o: { a: 0, k: 100 } },
        ],
      },
      // Arrow up (buy) — small upward triangle as filled rect
      {
        ddd: 0,
        ind: 2,
        ty: 4,
        nm: 'Arrow Up',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 1, k: [{ t: 0, s: [55, 95, 0] }, { t: 15, s: [55, 92, 0] }, { t: 30, s: [55, 95, 0] }] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [8, 8] } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#FFFFFF') }, o: { a: 0, k: 100 } },
        ],
      },
      // Arrow down (sell) — small downward triangle as filled rect
      {
        ddd: 0,
        ind: 3,
        ty: 4,
        nm: 'Arrow Down',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 1, k: [{ t: 15, s: [145, 105, 0] }, { t: 30, s: [145, 108, 0] }, { t: 45, s: [145, 105, 0] }] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [8, 8] } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#FFFFFF') }, o: { a: 0, k: 100 } },
        ],
      },
    ],
  },

  // ── 5. Broker / Shield ──
  broker: {
    v: '5.5.7',
    fr: 30,
    ip: 0,
    op: 60,
    w: S,
    h: S,
    nm: 'Broker Shield',
    ddd: 0,
    assets: [],
    layers: [
      // Shield body
      {
        ddd: 0,
        ind: 0,
        ty: 4,
        nm: 'Shield',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 0, k: [100, 100, 0] },
          s: { a: 1, k: [{ t: 0, s: [95, 95, 100] }, { t: 30, s: [105, 105, 100] }, { t: 60, s: [95, 95, 100] }] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [70, 80] } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#2874F0') }, o: { a: 0, k: 100 } },
        ],
      },
      // Checkmark (small white circle)
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Check',
        sr: 1,
        ks: {
          o: { a: 1, k: [{ t: 10, s: [0] }, { t: 20, s: [100] }] },
          p: { a: 0, k: [100, 100, 0] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [14, 14] } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#FFFFFF') }, o: { a: 0, k: 100 } },
        ],
      },
      // Network node
      circleLayer(2, 'Node1', 45, 45, 8, '#2874F0', true),
      circleLayer(3, 'Node2', 155, 45, 8, '#2874F0', true),
      circleLayer(4, 'Node3', 45, 155, 6, '#1A5FCC', false),
    ],
  },

  // ── 6. Learn ──
  learn: {
    v: '5.5.7',
    fr: 30,
    ip: 0,
    op: 60,
    w: S,
    h: S,
    nm: 'Learn Book',
    ddd: 0,
    assets: [],
    layers: [
      // Book left page
      {
        ddd: 0,
        ind: 0,
        ty: 4,
        nm: 'Left Page',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 0, k: [80, 90, 0] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [55, 75] }, r: { a: 0, k: 3 } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#8B5CF6') }, o: { a: 0, k: 30 } },
        ],
      },
      // Book right page
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Right Page',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 0, k: [120, 90, 0] },
          s: { a: 0, k: [100, 100, 100] },
          r: { a: 0, k: 0 },
        },
        shapes: [
          { ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [55, 75] }, r: { a: 0, k: 3 } },
          { ty: 'fl', c: { a: 0, k: hexToRGB('#6D28D9') }, o: { a: 0, k: 30 } },
        ],
      },
      // Glowing star 1
      circleLayer(2, 'Star 1', 35, 40, 12, '#8B5CF6', true),
      // Glowing star 2
      circleLayer(3, 'Star 2', 165, 45, 10, '#6D28D9', true),
      // Small dots
      circleLayer(4, 'Dot1', 50, 160, 3, '#FFAB40', false),
      circleLayer(5, 'Dot2', 150, 155, 4, '#00E676', false),
    ],
  },
};

// ─── Lottie View Component ───────────────────────────────────────────────

interface OnboardingLottieProps {
  stepId: string;
  style?: ViewStyle;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
}

export default function OnboardingLottie({
  stepId,
  style,
  autoPlay = true,
  loop = true,
  speed = 1,
}: OnboardingLottieProps) {
  const source = stepAnimations[stepId] || stepAnimations.welcome;

  return (
    <LottieView
      source={source}
      autoPlay={autoPlay}
      loop={loop}
      speed={speed}
      style={[{ width: 200, height: 200 }, style]}
    />
  );
}

// ─── Resolver ───────────────────────────────────────────────────────────────

export function renderLottieIllustration(stepId: string) {
  return (
    <OnboardingLottie
      stepId={stepId}
      autoPlay
      loop
      speed={0.8}
    />
  );
}
