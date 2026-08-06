/**
 * Web stub for `@react-navigation/native`.
 *
 * Real screens (e.g. SIPCalculator) call `useNavigation()` to get back/forward
 * navigation. In the demo there is no NavigationContainer, so hooks return a
 * harmless no-op navigation object instead of throwing.
 */

import type { ReactNode } from 'react';

const noopNavigation = {
  goBack: () => undefined,
  navigate: () => undefined,
  push: () => undefined,
  replace: () => undefined,
  pop: () => undefined,
  setOptions: () => undefined,
  addListener: () => () => undefined,
  isFocused: () => true,
  getState: () => ({ routes: [] }),
};

export const useNavigation = () => noopNavigation;
export const useRoute = () => ({ params: {} });
export const useFocusEffect = () => undefined;
export const useIsFocused = () => true;
export const useNavigationState = () => undefined;
export const useLinkProps = () => ({});

/** Passthrough container — only used if a consumer insists on rendering one. */
export const NavigationContainer = ({ children }: { children?: ReactNode }) => children;

export const DefaultTheme = {};
export const DarkTheme = {};

export default {
  useNavigation,
  useRoute,
  useFocusEffect,
  useIsFocused,
  useNavigationState,
  useLinkProps,
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
};
