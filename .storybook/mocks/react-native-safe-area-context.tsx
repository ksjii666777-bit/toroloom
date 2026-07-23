/**
 * Mock for react-native-safe-area-context — no-op in Storybook (web).
 * Provides safe area insets with zero values since Storybook renders
 * in the browser with no device notches.
 */
import React from 'react';
import { View } from 'react-native';

export const SafeAreaProvider = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flex: 1 }}>{children}</View>
);

export const SafeAreaView = ({ children, style, ...props }: any) => (
  <View style={[{ flex: 1 }, style]} {...props}>
    {children}
  </View>
);

export const SafeAreaInsetsContext = React.createContext({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

export const SafeAreaConsumer = SafeAreaInsetsContext.Consumer;

export function useSafeAreaInsets() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

export function useSafeAreaFrame() {
  return { x: 0, y: 0, width: 1024, height: 768 };
}

export const initialWindowMetrics = {
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
  frame: { x: 0, y: 0, width: 1024, height: 768 },
};

const SafeAreaContext = {
  SafeAreaProvider,
  SafeAreaView,
  SafeAreaInsetsContext,
  SafeAreaConsumer,
  useSafeAreaInsets,
  useSafeAreaFrame,
  initialWindowMetrics,
};

export default SafeAreaContext;
