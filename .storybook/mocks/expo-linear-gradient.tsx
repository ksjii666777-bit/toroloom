/**
 * Mock for expo-linear-gradient — used by Storybook (web Vite) so that
 * components using gradients don't crash.
 *
 * Renders a simple View with a CSS gradient background instead.
 */

import React from 'react';
import { View, ViewProps } from 'react-native';

interface LinearGradientProps extends ViewProps {
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: number[];
}

export function LinearGradient(props: LinearGradientProps) {
  const { colors, start, end, style, children, ...rest } = props;
  const angle = start && end
    ? Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI)
    : 180;

  return (
    <View
      {...rest}
      style={[
        {
          background: `linear-gradient(${angle}deg, ${colors.join(', ')})`,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const expoLinearGradient = { LinearGradient };
export default expoLinearGradient;
