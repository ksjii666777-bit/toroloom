/**
 * ============================================================================
 * Toroloom — AnimatedNumber
 * ============================================================================
 *
 * Reusable count-up number with a green/red tint flash when the value
 * changes. Used by the portfolio hero and anywhere a live P&L number should
 * feel "alive" (polished, professional motion).
 *
 * Implementation notes:
 *   - Count-up is JS-driven (setInterval-based, no rAF) so it behaves
 *     correctly under fake timers in tests and never re-creates the loop
 *     on every render.
 *   - The flash tints the digits toward marketUp/marketDown on change and
 *     eases back to the normal text color (Reanimated interpolateColor).
 * ============================================================================
 */

import React, { useEffect, useRef, useState } from 'react';
import { TextProps } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';

interface AnimatedNumberProps extends Omit<TextProps, 'children'> {
  /** Current numeric value */
  value: number;
  /** Format a numeric value into display text */
  format: (v: number) => string;
  /** Total count-up duration in ms (default 900) */
  duration?: number;
  /** Number of display ticks across the duration (default 24) */
  ticks?: number;
  /** Disable the initial mount count-up (default false) */
  skipInitialAnimation?: boolean;
  testID?: string;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export default function AnimatedNumber({
  value,
  format,
  duration = 900,
  ticks = 24,
  skipInitialAnimation = false,
  testID,
  ...textProps
}: AnimatedNumberProps) {
  const { colors } = useTheme();

  const [displayValue, setDisplayValue] = useState(value);
  const fromRef = useRef(skipInitialAnimation ? value : 0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(false);

  // Change flash: pulse above 0 in the direction of the move, ease back to 0
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      flash.value,
      [0, 0.35],
      [colors.text, value >= displayValue ? colors.marketUp : colors.marketDown],
    ),
  }));

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (skipInitialAnimation) {
        fromRef.current = value;
        setDisplayValue(value);
        return;
      }
    }

    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    // Direction flash: pulse then decay
    flash.value = 0.35;
    flash.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.quad) });

    if (timerRef.current) clearInterval(timerRef.current);
    let step = 0;
    timerRef.current = setInterval(() => {
      step += 1;
      const t = Math.min(1, step / ticks);
      setDisplayValue(from + (to - from) * easeOutCubic(t));
      if (t >= 1) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        fromRef.current = to;
      }
    }, Math.max(16, Math.floor(duration / ticks)));

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      fromRef.current = to;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, ticks, skipInitialAnimation]);

  return (
    <Animated.Text testID={testID} style={flashStyle} {...textProps}>
      {format(displayValue)}
    </Animated.Text>
  );
}
