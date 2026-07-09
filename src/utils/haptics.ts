/**
 * ============================================================================
 * Toroloom — Haptic Feedback Utility
 * ============================================================================
 *
 * Shared helper for tactile feedback. Wraps `expo-haptics` so every screen
 * can fire consistent haptic impacts without re-importing the raw module.
 *
 * Usage:
 *   import { triggerHaptic, ImpactFeedbackStyle } from '../utils/haptics';
 *
 *   triggerHaptic();                              // Light (default)
 *   triggerHaptic(ImpactFeedbackStyle.Medium);    // Medium
 *   triggerHaptic(ImpactFeedbackStyle.Heavy);     // Heavy
 * ============================================================================
 */

import * as Haptics from 'expo-haptics';

/** Re-export the enum so callers don't need to import expo-haptics directly. */
export const ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle;

/**
 * Fire a quick haptic impact. Defaults to `.Light`.
 * Fire-and-forget — returns a Promise that is intentionally not awaited.
 */
export function triggerHaptic(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
): void {
  Haptics.impactAsync(style);
}
