/**
 * ============================================================================
 * Toroloom — Staggered Animation Hook
 * ============================================================================
 *
 * Provides staggered entrance animations for lists of items.
 *
 * IMPORTANT — hooks-safety:
 *   useSharedValue and useAnimatedStyle are created up to MAX_ITEMS (50)
 *   regardless of `count`. This ensures the number of hooks never changes
 *   between renders, avoiding "Rendered more hooks than during the
 *   previous render" errors when used in components with conditional
 *   early-return patterns.
 *
 * Usage:
 *   const { animatedStyles, reset, startAnimation } = useStaggeredAnimation(items.length);
 *   // In JSX:
 *   {items.map((item, i) => (
 *     <Animated.View key={i} style={animatedStyles[i]}>
 *       ...
 *     </Animated.View>
 *   ))}
 * ============================================================================
 */

import { useEffect, useCallback } from 'react';
import {
  useSharedValue,
  withTiming,
  withDelay,
  useAnimatedStyle,
} from 'react-native-reanimated';

// ── Configuration ─────────────────────────────────────────────

const MAX_ITEMS = 50;

interface StaggeredAnimationConfig {
  initialDelay?: number;
  staggerDelay?: number;
  duration?: number;
  fromOpacity?: number;
  fromTranslateY?: number;
}

// ── Hook ──────────────────────────────────────────────────────

export function useStaggeredAnimation(
  count: number,
  config: StaggeredAnimationConfig = {},
) {
  const {
    initialDelay = 100,
    staggerDelay = 60,
    duration = 400,
    fromOpacity = 0,
    fromTranslateY = 20,
  } = config;

  // ── Pre-create a fixed number of shared values ───────────────
  // Using explicit hooks ensures the hook call order never changes.
  const v0  = useSharedValue(0);
  const v1  = useSharedValue(0);
  const v2  = useSharedValue(0);
  const v3  = useSharedValue(0);
  const v4  = useSharedValue(0);
  const v5  = useSharedValue(0);
  const v6  = useSharedValue(0);
  const v7  = useSharedValue(0);
  const v8  = useSharedValue(0);
  const v9  = useSharedValue(0);
  const v10 = useSharedValue(0);
  const v11 = useSharedValue(0);
  const v12 = useSharedValue(0);
  const v13 = useSharedValue(0);
  const v14 = useSharedValue(0);
  const v15 = useSharedValue(0);
  const v16 = useSharedValue(0);
  const v17 = useSharedValue(0);
  const v18 = useSharedValue(0);
  const v19 = useSharedValue(0);
  const v20 = useSharedValue(0);
  const v21 = useSharedValue(0);
  const v22 = useSharedValue(0);
  const v23 = useSharedValue(0);
  const v24 = useSharedValue(0);
  const v25 = useSharedValue(0);
  const v26 = useSharedValue(0);
  const v27 = useSharedValue(0);
  const v28 = useSharedValue(0);
  const v29 = useSharedValue(0);
  const v30 = useSharedValue(0);
  const v31 = useSharedValue(0);
  const v32 = useSharedValue(0);
  const v33 = useSharedValue(0);
  const v34 = useSharedValue(0);
  const v35 = useSharedValue(0);
  const v36 = useSharedValue(0);
  const v37 = useSharedValue(0);
  const v38 = useSharedValue(0);
  const v39 = useSharedValue(0);
  const v40 = useSharedValue(0);
  const v41 = useSharedValue(0);
  const v42 = useSharedValue(0);
  const v43 = useSharedValue(0);
  const v44 = useSharedValue(0);
  const v45 = useSharedValue(0);
  const v46 = useSharedValue(0);
  const v47 = useSharedValue(0);
  const v48 = useSharedValue(0);
  const v49 = useSharedValue(0);

  const progressValues = [v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15, v16, v17, v18, v19,
    v20, v21, v22, v23, v24, v25, v26, v27, v28, v29, v30, v31, v32, v33, v34, v35, v36, v37, v38, v39,
    v40, v41, v42, v43, v44, v45, v46, v47, v48, v49];

  // Clamp count to valid range
  const safeCount = Math.max(0, Math.min(count, MAX_ITEMS));

  // ── Pre-create animated styles ──────────────────────────────
  // These are always called, regardless of conditional rendering in the parent.
  const a0  = useAnimatedStyle(() => animateStyle(progressValues[0],  fromOpacity, fromTranslateY));
  const a1  = useAnimatedStyle(() => animateStyle(progressValues[1],  fromOpacity, fromTranslateY));
  const a2  = useAnimatedStyle(() => animateStyle(progressValues[2],  fromOpacity, fromTranslateY));
  const a3  = useAnimatedStyle(() => animateStyle(progressValues[3],  fromOpacity, fromTranslateY));
  const a4  = useAnimatedStyle(() => animateStyle(progressValues[4],  fromOpacity, fromTranslateY));
  const a5  = useAnimatedStyle(() => animateStyle(progressValues[5],  fromOpacity, fromTranslateY));
  const a6  = useAnimatedStyle(() => animateStyle(progressValues[6],  fromOpacity, fromTranslateY));
  const a7  = useAnimatedStyle(() => animateStyle(progressValues[7],  fromOpacity, fromTranslateY));
  const a8  = useAnimatedStyle(() => animateStyle(progressValues[8],  fromOpacity, fromTranslateY));
  const a9  = useAnimatedStyle(() => animateStyle(progressValues[9],  fromOpacity, fromTranslateY));
  const a10 = useAnimatedStyle(() => animateStyle(progressValues[10], fromOpacity, fromTranslateY));
  const a11 = useAnimatedStyle(() => animateStyle(progressValues[11], fromOpacity, fromTranslateY));
  const a12 = useAnimatedStyle(() => animateStyle(progressValues[12], fromOpacity, fromTranslateY));
  const a13 = useAnimatedStyle(() => animateStyle(progressValues[13], fromOpacity, fromTranslateY));
  const a14 = useAnimatedStyle(() => animateStyle(progressValues[14], fromOpacity, fromTranslateY));
  const a15 = useAnimatedStyle(() => animateStyle(progressValues[15], fromOpacity, fromTranslateY));
  const a16 = useAnimatedStyle(() => animateStyle(progressValues[16], fromOpacity, fromTranslateY));
  const a17 = useAnimatedStyle(() => animateStyle(progressValues[17], fromOpacity, fromTranslateY));
  const a18 = useAnimatedStyle(() => animateStyle(progressValues[18], fromOpacity, fromTranslateY));
  const a19 = useAnimatedStyle(() => animateStyle(progressValues[19], fromOpacity, fromTranslateY));
  const a20 = useAnimatedStyle(() => animateStyle(progressValues[20], fromOpacity, fromTranslateY));
  const a21 = useAnimatedStyle(() => animateStyle(progressValues[21], fromOpacity, fromTranslateY));
  const a22 = useAnimatedStyle(() => animateStyle(progressValues[22], fromOpacity, fromTranslateY));
  const a23 = useAnimatedStyle(() => animateStyle(progressValues[23], fromOpacity, fromTranslateY));
  const a24 = useAnimatedStyle(() => animateStyle(progressValues[24], fromOpacity, fromTranslateY));
  const a25 = useAnimatedStyle(() => animateStyle(progressValues[25], fromOpacity, fromTranslateY));
  const a26 = useAnimatedStyle(() => animateStyle(progressValues[26], fromOpacity, fromTranslateY));
  const a27 = useAnimatedStyle(() => animateStyle(progressValues[27], fromOpacity, fromTranslateY));
  const a28 = useAnimatedStyle(() => animateStyle(progressValues[28], fromOpacity, fromTranslateY));
  const a29 = useAnimatedStyle(() => animateStyle(progressValues[29], fromOpacity, fromTranslateY));
  const a30 = useAnimatedStyle(() => animateStyle(progressValues[30], fromOpacity, fromTranslateY));
  const a31 = useAnimatedStyle(() => animateStyle(progressValues[31], fromOpacity, fromTranslateY));
  const a32 = useAnimatedStyle(() => animateStyle(progressValues[32], fromOpacity, fromTranslateY));
  const a33 = useAnimatedStyle(() => animateStyle(progressValues[33], fromOpacity, fromTranslateY));
  const a34 = useAnimatedStyle(() => animateStyle(progressValues[34], fromOpacity, fromTranslateY));
  const a35 = useAnimatedStyle(() => animateStyle(progressValues[35], fromOpacity, fromTranslateY));
  const a36 = useAnimatedStyle(() => animateStyle(progressValues[36], fromOpacity, fromTranslateY));
  const a37 = useAnimatedStyle(() => animateStyle(progressValues[37], fromOpacity, fromTranslateY));
  const a38 = useAnimatedStyle(() => animateStyle(progressValues[38], fromOpacity, fromTranslateY));
  const a39 = useAnimatedStyle(() => animateStyle(progressValues[39], fromOpacity, fromTranslateY));
  const a40 = useAnimatedStyle(() => animateStyle(progressValues[40], fromOpacity, fromTranslateY));
  const a41 = useAnimatedStyle(() => animateStyle(progressValues[41], fromOpacity, fromTranslateY));
  const a42 = useAnimatedStyle(() => animateStyle(progressValues[42], fromOpacity, fromTranslateY));
  const a43 = useAnimatedStyle(() => animateStyle(progressValues[43], fromOpacity, fromTranslateY));
  const a44 = useAnimatedStyle(() => animateStyle(progressValues[44], fromOpacity, fromTranslateY));
  const a45 = useAnimatedStyle(() => animateStyle(progressValues[45], fromOpacity, fromTranslateY));
  const a46 = useAnimatedStyle(() => animateStyle(progressValues[46], fromOpacity, fromTranslateY));
  const a47 = useAnimatedStyle(() => animateStyle(progressValues[47], fromOpacity, fromTranslateY));
  const a48 = useAnimatedStyle(() => animateStyle(progressValues[48], fromOpacity, fromTranslateY));
  const a49 = useAnimatedStyle(() => animateStyle(progressValues[49], fromOpacity, fromTranslateY));

  const allStyles = [a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19,
    a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39,
    a40, a41, a42, a43, a44, a45, a46, a47, a48, a49] as const;

  // ── Build the returned animated styles array ────────────────
  // We slice to safeCount so callers only get the styles they asked for.
  const animatedStyles = allStyles.slice(0, safeCount) as any[];

  // ── Animation helpers ──────────────────────────────────────

  const startAnimation = useCallback(() => {
    for (let i = 0; i < safeCount; i++) {
      const delay = initialDelay + i * staggerDelay;
      progressValues[i].value = withDelay(delay, withTiming(1, { duration }));
    }
  }, [safeCount, initialDelay, staggerDelay, duration]);

  const reset = useCallback(() => {
    for (let i = 0; i < safeCount; i++) {
      progressValues[i].value = 0;
    }
    // Use setTimeout fallback for environments without requestAnimationFrame (e.g. Node tests)
    const raf = typeof requestAnimationFrame !== 'undefined'
      ? requestAnimationFrame
      : (cb: () => void) => setTimeout(cb, 16);
    raf(() => { startAnimation(); });
  }, [safeCount, startAnimation]);

  useEffect(() => {
    startAnimation();
  }, [startAnimation]);

  return {
    /** Array of animated styles — use as `animatedStyles[i]` in JSX */
    animatedStyles,
    /** Reset and replay the stagger animation */
    reset,
    /** Manually trigger the stagger animation (called automatically on mount) */
    startAnimation,
  };
}

// ── Style builder (pure function, not a hook) ─────────────────

function animateStyle(
  progress: { value: number },
  fromOpacity: number,
  fromTranslateY: number,
): Record<string, any> {
  'worklet';
  const p = progress.value;
  return {
    opacity: fromOpacity + (1 - fromOpacity) * p,
    transform: [{ translateY: fromTranslateY * (1 - p) }],
  };
}
