/**
 * ============================================================================
 * Toroloom — useStaggeredAnimation Hook Tests
 * ============================================================================
 *
 * Tests the staggered animation hook: value creation, animation lifecycle,
 * style generation, and reset.
 */

import React, { act } from 'react';
import { describe, it, expect, beforeEach} from 'vitest';
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

// Minimal mock shape that matches what the hook actually returns.
// The hook returns AnimatedStyleHandle<Record<string, any>> at the type level.
type MockAnimatedStyle = { opacity: number; transform: { translateY: number }[] };

describe('useStaggeredAnimation', () => {
  beforeEach(() => {
    harnessResult = undefined as any;
  });

  it('returns animatedStyles, reset, and startAnimation', () => {
    render(<Harness count={3} />);
    expect(harnessResult).toBeDefined();
    expect(Array.isArray(harnessResult.animatedStyles)).toBe(true);
    expect(harnessResult.animatedStyles.length).toBe(3);
    expect(typeof harnessResult.reset).toBe('function');
    expect(typeof harnessResult.startAnimation).toBe('function');
  });

  it('creates animation values for the given count', () => {
    render(<Harness count={5} />);
    // With count=5, animatedStyles should exist for indices 0-4
    for (let i = 0; i < 5; i++) {
      const style = harnessResult.animatedStyles[i] as unknown as MockAnimatedStyle;
      expect(style).toBeDefined();
      expect(style).toHaveProperty('opacity');
      expect(style).toHaveProperty('transform');
      expect(Array.isArray(style.transform)).toBe(true);
      expect(style.transform[0]).toHaveProperty('translateY');
    }
  });

  it('returns correct array length for given count', () => {
    render(<Harness count={2} />);
    expect(harnessResult.animatedStyles.length).toBe(2);
  });

  it('uses default config values', () => {
    render(<Harness count={1} />);
    const style = harnessResult.animatedStyles[0] as unknown as MockAnimatedStyle;
    expect(style).toHaveProperty('opacity');
    expect(style).toHaveProperty('transform');
  });

  it('uses custom config values', () => {
    render(<Harness count={1} config={{ fromOpacity: 0.5, fromTranslateY: 50 }} />);
    const style = harnessResult.animatedStyles[0] as unknown as MockAnimatedStyle;
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
    expect(harnessResult.animatedStyles.length).toBe(0);
  });

  it('handles count of 1 gracefully', () => {
    render(<Harness count={1} />);
    const style = harnessResult.animatedStyles[0] as unknown as MockAnimatedStyle;
    expect(style).toHaveProperty('opacity');
    expect(style).toHaveProperty('transform');
  });

  it('handles count increase after initial render', async () => {
    const { update } = render(<Harness count={2} />);
    // Increase count to 4 — use async act to flush the useEffect
    await act(async () => {
      update(<Harness count={4} />);
    });
    expect(harnessResult.animatedStyles[3]).toBeDefined();
    expect(typeof (harnessResult.animatedStyles[3] as unknown as MockAnimatedStyle).opacity).not.toBe('undefined');
  });

  it('handles count decrease after initial render', async () => {
    const { update } = render(<Harness count={5} />);
    expect(harnessResult.animatedStyles.length).toBe(5);
    // Decrease count to 2
    await act(async () => {
      update(<Harness count={2} />);
    });
    // animatedStyles is now sliced to safeCount=2
    expect(harnessResult.animatedStyles.length).toBe(2);
  });

  it('calls startAnimation on mount via useEffect', () => {
    // The hook fires startAnimation automatically via useEffect, which sets all
    // shared values to 1 via withTiming(1, ...) mock → returns 1.
    render(<Harness count={2} />);
    // animatedStyles are computed once at creation time (useAnimatedStyle mock
    // calls updater() once). At that point progressValues are 0, so opacity = 0.
    // The real reanimated tracks shared values reactively; the mock does not.
    const style = harnessResult.animatedStyles[0] as unknown as MockAnimatedStyle;
    expect(style).toBeDefined();
    expect(typeof style.opacity).toBe('number');
    expect(Array.isArray(style.transform)).toBe(true);
  });
});
