/**
 * Mock for expo-haptics — no-op in Storybook (web).
 * Haptic feedback is not available in the browser.
 */

export const ImpactFeedbackStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
  Soft: 'soft',
  Rigid: 'rigid',
};

export const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
};

export const FeedbackType = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
  Selection: 'selection',
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
};

export async function impactAsync(_style?: string) {
  // no-op
}

export async function notificationAsync(_type?: string) {
  // no-op
}

export async function selectionAsync() {
  // no-op
}

export async function impactAsyncIOS(_style?: string) {
  // no-op
}

const Haptics = {
  impactAsync,
  notificationAsync,
  selectionAsync,
  impactAsyncIOS,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
};

export default Haptics;
