/**
 * ============================================================================
 * Toroloom — useLoadFonts Hook Tests
 * ============================================================================
 *
 * Tests the font loading hook: loading state, success state, error state,
 * configuration, and render-time behavior.
 * ============================================================================
 */

import React from 'react';
import { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock @expo-google-fonts/inter ──────────────────────────
// We control the return values of useFonts via mockReturnValue in each test.
const mockUseFonts = vi.fn();

vi.mock('@expo-google-fonts/inter', () => ({
  useFonts: (...args: any[]) => mockUseFonts(...args),
  Inter_100Thin: null,
  Inter_300Light: null,
  Inter_400Regular: null,
  Inter_500Medium: null,
  Inter_600SemiBold: null,
  Inter_700Bold: null,
  Inter_800ExtraBold: null,
  Inter_900Black: null,
}));

// ── Imports (after mocks) ──────────────────────────────────
import { render } from './testUtils';
import useLoadFonts from '../hooks/useLoadFonts';

// ── Test Harness ───────────────────────────────────────────
let harnessResult: ReturnType<typeof useLoadFonts>;

function Harness() {
  harnessResult = useLoadFonts();
  return null;
}

// ── Tests ──────────────────────────────────────────────────

describe('useLoadFonts — Loading State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harnessResult = undefined as any;
  });

  it('returns fontsLoaded=false while fonts are loading', () => {
    mockUseFonts.mockReturnValue([false, null]);
    render(<Harness />);
    expect(harnessResult.fontsLoaded).toBe(false);
  });

  it('returns fontError=null while fonts are loading', () => {
    mockUseFonts.mockReturnValue([false, null]);
    render(<Harness />);
    expect(harnessResult.fontError).toBeNull();
  });
});

describe('useLoadFonts — Success State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harnessResult = undefined as any;
  });

  it('returns fontsLoaded=true when fonts are loaded', () => {
    mockUseFonts.mockReturnValue([true, null]);
    render(<Harness />);
    expect(harnessResult.fontsLoaded).toBe(true);
  });

  it('returns fontError=null on successful load', () => {
    mockUseFonts.mockReturnValue([true, null]);
    render(<Harness />);
    expect(harnessResult.fontError).toBeNull();
  });

  it('transition from loading to loaded updates state', () => {
    // Start loading
    mockUseFonts.mockReturnValueOnce([false, null]);
    const { update } = render(<Harness />);
    expect(harnessResult.fontsLoaded).toBe(false);

    // Transition to loaded via re-render
    mockUseFonts.mockReturnValueOnce([true, null]);
    act(() => {
      update(<Harness />);
    });
    expect(harnessResult.fontsLoaded).toBe(true);
    expect(harnessResult.fontError).toBeNull();
  });
});

describe('useLoadFonts — Error State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harnessResult = undefined as any;
  });

  it('returns fontsLoaded=false when font load fails', () => {
    mockUseFonts.mockReturnValue([false, new Error('Font failed to load')]);
    render(<Harness />);
    expect(harnessResult.fontsLoaded).toBe(false);
  });

  it('returns the error object when font load fails', () => {
    const testError = new Error('Font failed to load');
    mockUseFonts.mockReturnValue([false, testError]);
    render(<Harness />);
    expect(harnessResult.fontError).toBe(testError);
  });

  it('preserves error message from underlying useFonts', () => {
    mockUseFonts.mockReturnValue([false, new Error('Network error loading fonts')]);
    render(<Harness />);
    expect(harnessResult.fontError!.message).toBe('Network error loading fonts');
  });

  it('transition from loading to error updates state correctly', () => {
    const testError = new Error('Font failed');
    mockUseFonts.mockReturnValueOnce([false, null]);
    const { update } = render(<Harness />);
    expect(harnessResult.fontError).toBeNull();

    mockUseFonts.mockReturnValueOnce([false, testError]);
    act(() => {
      update(<Harness />);
    });
    expect(harnessResult.fontsLoaded).toBe(false);
    expect(harnessResult.fontError).toBe(testError);
  });
});

describe('useLoadFonts — Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harnessResult = undefined as any;
  });

  it('calls useFonts with the font config object', () => {
    mockUseFonts.mockReturnValue([true, null]);
    render(<Harness />);

    // Should have been called with an object containing all 8 Inter font weights
    expect(mockUseFonts).toHaveBeenCalledTimes(1);
    const config = mockUseFonts.mock.calls[0][0];
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');

    // Verify common font family keys are present
    expect(config).toHaveProperty('Inter-Thin');
    expect(config).toHaveProperty('Inter-Regular');
    expect(config).toHaveProperty('Inter-Medium');
    expect(config).toHaveProperty('Inter-Bold');
    expect(config).toHaveProperty('Inter-Black');
  });

  it('passes all 8 Inter font variants', () => {
    mockUseFonts.mockReturnValue([true, null]);
    render(<Harness />);

    const config = mockUseFonts.mock.calls[0][0];
    const keys = Object.keys(config);
    expect(keys).toContain('Inter-Thin');
    expect(keys).toContain('Inter-Light');
    expect(keys).toContain('Inter-Regular');
    expect(keys).toContain('Inter-Medium');
    expect(keys).toContain('Inter-SemiBold');
    expect(keys).toContain('Inter-Bold');
    expect(keys).toContain('Inter-ExtraBold');
    expect(keys).toContain('Inter-Black');
    expect(keys.length).toBe(8);
  });
});

describe('useLoadFonts — Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harnessResult = undefined as any;
  });

  it('handles null error gracefully', () => {
    mockUseFonts.mockReturnValue([false, null]);
    render(<Harness />);
    expect(harnessResult.fontError).toBeNull();
    expect(harnessResult.fontsLoaded).toBe(false);
  });

  it('handles undefined error gracefully', () => {
    mockUseFonts.mockReturnValue([false, undefined]);
    render(<Harness />);
    expect(harnessResult.fontError).toBeUndefined();
    expect(harnessResult.fontsLoaded).toBe(false);
  });

  it('handles multiple re-renders without error', () => {
    mockUseFonts.mockReturnValue([false, null]);
    const { update } = render(<Harness />);

    // Re-render multiple times
    mockUseFonts.mockReturnValue([false, null]);
    act(() => { update(<Harness />); });

    mockUseFonts.mockReturnValue([true, null]);
    act(() => { update(<Harness />); });

    mockUseFonts.mockReturnValue([true, null]);
    act(() => { update(<Harness />); });

    expect(harnessResult.fontsLoaded).toBe(true);
  });

  it('does not throw during render', () => {
    mockUseFonts.mockReturnValue([true, null]);
    expect(() => {
      render(<Harness />);
    }).not.toThrow();
  });

  it('returns the correct shape on every render', () => {
    mockUseFonts.mockReturnValue([false, null]);
    render(<Harness />);

    expect(harnessResult).toHaveProperty('fontsLoaded');
    expect(harnessResult).toHaveProperty('fontError');
    expect(Object.keys(harnessResult).length).toBe(2);
  });
});
