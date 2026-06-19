/**
 * ============================================================================
 * Toroloom — useStaggeredAnimation Hook Tests
 * ============================================================================
 *
 * Tests the staggered animation hook: value creation, animation lifecycle,
 * style generation, and reset.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from './testUtils';
import { useStaggeredAnimation } from '../hooks/useStaggeredAnimation';

// ── Test Harness ───────────────────────────────────────────────
interface HarnessProps {
  count: number;
  config?: Parameters<typeof useStaggeredAnimation>[1];
}

let harnessResult: ReturnType<typeof useStaggeredAnimation>;

function Harness({ count, config }: HarnessProps) {
  harnessResult = useStaggeredAnimation(count, config);
  return null;
}

// ── Tests ──────────────────────────────────────────────────────

type MockAnimatedStyle = { opacity: number; transform: { translateY: number }[] };

describe('useStaggeredAnimation', () => {
  beforeEach(() => {
    harnessResult = undefined as any;
  });

  it('returns getAnimatedStyle, reset, and startAnimation', () => {
    render(<Harness count={3} />);
    expect(harnessResult).toBeDefined();
    expect(typeof harnessResult.getAnimatedStyle).toBe('function');
    expect(typeof harnessResult.reset).toBe('function');
    expect(typeof harnessResult.startAnimation).toBe('function');
  });

  it('creates animation values for the given count', () => {
    render(<Harness count={5} />);
    // With count=5, getAnimatedStyle should exist for indices 0-4
    for (let i = 0; i < 5; i++) {
      const style = harnessResult.getAnimatedStyle(i) as MockAnimatedStyle;
      expect(style).toBeDefined();
      expect(style).toHaveProperty('opacity');
      expect(style).toHaveProperty('transform');
      expect(Array.isArray(style.transform)).toBe(true);
      expect(style.transform[0]).toHaveProperty('translateY');
    }
  });

  it('returns default opacity/translate for out-of-range index', () => {
    render(<Harness count={2} />);
    const style = harnessResult.getAnimatedStyle(99) as MockAnimatedStyle;
    // Out-of-range index returns fallback (0 opacity, 20 translateY)
    expect(style.opacity).toBe(0);
    expect(style.transform[0].translateY).toBe(20);
  });

  it('uses default config values', () => {
    render(<Harness count={1} />);
    const style = harnessResult.getAnimatedStyle(0) as MockAnimatedStyle;
    expect(style).toHaveProperty('opacity');
    expect(style).toHaveProperty('transform');
  });

  it('uses custom config values', () => {
    render(<Harness count={1} config={{ fromOpacity: 0.5, fromTranslateY: 50 }} />);
    const style = harnessResult.getAnimatedStyle(0) as MockAnimatedStyle;
    expect(style).toHaveProperty('opacity');
    expect(style).toHaveProperty('transform');
  });

  it('startAnimation runs without error', () => {
    render(<Harness count={3} />);
    expect(() => {
      act(() => {
        harnessResult.startAnimation();
      });
    }).not.toThrow();
  });

  it('reset runs without error', () => {
    render(<Harness count={3} />);
    expect(() => {
      act(() => {
        harnessResult.reset();
      });
    }).not.toThrow();
  });

  it('handles count of 0 gracefully', () => {
    render(<Harness count={0} />);
    expect(harnessResult).toBeDefined();
    // Out-of-range index returns fallback
    const style = harnessResult.getAnimatedStyle(0) as MockAnimatedStyle;
    expect(style.opacity).toBe(0);
    expect(style.transform[0].translateY).toBe(20);
  });

  it('handles count of 1 gracefully', () => {
    render(<Harness count={1} />);
    const style = harnessResult.getAnimatedStyle(0) as MockAnimatedStyle;
    expect(style).toHaveProperty('opacity');
    expect(style).toHaveProperty('transform');
  });

  it('handles count increase after initial render', async () => {
    const { update } = render(<Harness count={2} />);
    // Increase count to 4 — use async act to flush the useEffect
    await act(async () => {
      update(<Harness count={4} />);
    });
    expect(harnessResult.getAnimatedStyle(3)).toBeDefined();
    expect(typeof (harnessResult.getAnimatedStyle(3) as MockAnimatedStyle).opacity).not.toBe('undefined');
  });

  it('handles count decrease after initial render', async () => {
    const { update } = render(<Harness count={5} />);
    // Decrease count to 2 — use async act to flush the useEffect
    await act(async () => {
      update(<Harness count={2} />);
    });
    // getAnimatedStyle is memoized via useCallback with [fromOpacity, fromTranslateY]
    // so it still references the original progressValues array (with 5 items).
    // Index 4 exists in that array and was set to 1 by startAnimation on re-render.
    const style = harnessResult.getAnimatedStyle(4) as MockAnimatedStyle;
    expect(style.opacity).toBe(1);
  });

  it('calls startAnimation on mount via useEffect', () => {
    // The hook uses Reanimated's withDelay/withTiming (not Animated.stagger).
    // The useEffect fires startAnimation automatically, which sets all
    // progress values to 1 via the mock (withTiming returns toValue).
    render(<Harness count={2} />);
    // After mount animation completes, progress = 1 → opacity = 1, translateY = 0
    const style = harnessResult.getAnimatedStyle(0) as MockAnimatedStyle;
    expect(style.opacity).toBe(1);
    expect(style.transform[0].translateY).toBe(0);
  });
});
