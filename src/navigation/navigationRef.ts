/**
 * ============================================================================
 * Toroloom — Navigation Ref (outside-container navigation)
 * ============================================================================
 *
 * A typed navigation container ref so app-wide components that live OUTSIDE
 * the NavigationContainer (LegalReacceptanceOverlay, notifications, deep-link
 * handlers) can navigate without prop drilling.
 *
 * Usage:
 *   import { navigateFromRef } from '../navigation/navigationRef';
 *   navigateFromRef('Legal', { section: 'terms' });
 *
 * The ref is attached in AppNavigator via <NavigationContainer ref={navigationRef}>.
 * Calls are no-ops until the container reports ready.
 * ============================================================================
 */

import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Navigate by route name with typed params. Safe to call any time —
 * no-ops until the NavigationContainer has mounted and is ready.
 */
export function navigateFromRef<RouteName extends keyof RootStackParamList>(
  ...args: RouteName extends unknown
    ? undefined extends RootStackParamList[RouteName]
      ? [screen: RouteName] | [screen: RouteName, params: RootStackParamList[RouteName]]
      : [screen: RouteName, params: RootStackParamList[RouteName]]
    : never
): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate(...args);
  }
}
