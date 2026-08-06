/**
 * Web stub for `expo-haptics` — haptics are no-ops in the browser demo.
 */

export const ImpactFeedbackStyle = { Light: 0, Medium: 1, Heavy: 2 } as const;
export const NotificationFeedbackType = { Success: 0, Warning: 1, Error: 2 } as const;

export const impactAsync = async (): Promise<void> => undefined;
export const selectionAsync = async (): Promise<void> => undefined;
export const notificationAsync = async (): Promise<void> => undefined;

export default {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  selectionAsync,
  notificationAsync,
};
