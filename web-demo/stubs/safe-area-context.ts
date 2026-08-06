/**
 * Web stub for `react-native-safe-area-context`.
 *
 * The real package deep-imports react-native internals
 * (`react-native/Libraries/Utilities/codegenNativeComponent`) that don't exist
 * in react-native-web, so the demo replaces it with a zero-inset stub.
 */

import React from 'react';

const EMPTY_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };
const EMPTY_FRAME = { x: 0, y: 0, width: 1200, height: 800 };

export const SafeAreaProvider = ({ children }: { children: React.ReactNode }): React.ReactNode => children;

export const SafeAreaConsumer = ({ children }: { children: (insets: typeof EMPTY_INSETS) => React.ReactNode }): React.ReactNode => children(EMPTY_INSETS);

export const SafeAreaView = ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }): React.ReactElement => React.createElement('div', { style }, children);

export const useSafeAreaInsets = (): typeof EMPTY_INSETS => EMPTY_INSETS;
export const useSafeAreaFrame = (): typeof EMPTY_FRAME => EMPTY_FRAME;
export const useSafeAreaEnv = (): null => null;

export default {
  SafeAreaProvider,
  SafeAreaConsumer,
  SafeAreaView,
  useSafeAreaInsets,
  useSafeAreaFrame,
  useSafeAreaEnv,
};
