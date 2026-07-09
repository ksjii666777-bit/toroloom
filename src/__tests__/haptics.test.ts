/**
 * ============================================================================
 * Toroloom — Haptics Utility Tests
 * ============================================================================
 *
 * Tests the shared haptic wrapper at src/utils/haptics.ts.
 * Verifies that triggerHaptic correctly delegates to Haptics.impactAsync
 * with the appropriate ImpactFeedbackStyle and that ImpactFeedbackStyle is
 * re-exported correctly.
 *
 * The expo-haptics mock is set up globally in src/__tests__/setup.ts:
 *   impactAsync: vi.fn(() => Promise.resolve())
 *   ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' }
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Haptics from 'expo-haptics';
import { triggerHaptic, ImpactFeedbackStyle } from '../utils/haptics';

describe('triggerHaptic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls impactAsync with Light style by default', () => {
    triggerHaptic();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  it('calls impactAsync with Medium style when specified', () => {
    triggerHaptic(ImpactFeedbackStyle.Medium);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
  });

  it('calls impactAsync with Heavy style when specified', () => {
    triggerHaptic(ImpactFeedbackStyle.Heavy);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('heavy');
  });

  it('does not return a promise (fire-and-forget)', () => {
    const result = triggerHaptic();
    expect(result).toBeUndefined();
  });

  it('is truly fire-and-forget — does not await the impactAsync promise', () => {
    // Return a never-settling promise. If triggerHaptic awaited it,
    // the call would hang indefinitely. Since it returns immediately,
    // we confirm the promise is discarded without await.
    const neverSettles = new Promise<void>(() => {});
    (Haptics.impactAsync as ReturnType<typeof vi.fn>).mockReturnValue(neverSettles);

    const result = triggerHaptic();

    // Function returned synchronously — never awaited the promise
    expect(result).toBeUndefined();
  });

  it('calls impactAsync before returning (side-effect is not deferred)', () => {
    const mock = Haptics.impactAsync as ReturnType<typeof vi.fn>;

    triggerHaptic();

    // impactAsync was called immediately, not scheduled for later
    expect(mock).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    // Restore the default mock so other tests aren't affected
    (Haptics.impactAsync as ReturnType<typeof vi.fn>).mockImplementation(
      () => Promise.resolve(),
    );
  });

});

describe('ImpactFeedbackStyle re-export', () => {
  it('re-exports the Light style', () => {
    expect(ImpactFeedbackStyle.Light).toBe('light');
  });

  it('re-exports the Medium style', () => {
    expect(ImpactFeedbackStyle.Medium).toBe('medium');
  });

  it('re-exports the Heavy style', () => {
    expect(ImpactFeedbackStyle.Heavy).toBe('heavy');
  });
});
