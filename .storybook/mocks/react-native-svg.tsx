/**
 * Mock for react-native-svg — used by Storybook (web Vite) so that
 * SVG components like ToroloomLogo and MetallicShieldSVG render
 * in the browser without react-native-svg being available.
 *
 * Renders simple <div>-based placeholders that approximate the SVG
 * structure so you can verify layout and sizing in Storybook.
 */

import React from 'react';
import { View, ViewProps } from 'react-native';

interface SvgProps extends ViewProps {
  width?: number | string;
  height?: number | string;
  viewBox?: string;
  children?: React.ReactNode;
}

interface PathProps {
  d?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinejoin?: string;
  strokeLinecap?: string;
  opacity?: number;
  strokeDasharray?: string;
}

interface CircleProps {
  cx?: number;
  cy?: number;
  r?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  strokeDasharray?: string;
}

interface RectProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  rx?: number;
  opacity?: number;
}

interface LineProps {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  strokeLinecap?: string;
}

interface PolygonProps {
  points?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

interface GProps {
  children?: React.ReactNode;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
}

interface DefsProps {
  children?: React.ReactNode;
}

interface StopProps {
  offset?: string;
  stopColor?: string;
  stopOpacity?: number;
}

interface LinearGradientProps {
  id?: string;
  x1?: string;
  y1?: string;
  x2?: string;
  y2?: string;
  children?: React.ReactNode;
}

function createDiv(props: Record<string, unknown>): React.ReactElement {
  const { children, style, ...rest } = props as any;
  return React.createElement(View, { ...rest }, children);
}

const SvgComponent = (props: SvgProps) => {
  const { width, height, viewBox, children, style, ...rest } = props;
  return (
    <View
      {...rest}
      style={[
        {
          width: (width as number) || 48,
          height: (height as number) || 48,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style as Record<string, unknown>,
      ]}
    >
      {children}
    </View>
  );
};

export const Path = (_props: PathProps) => createDiv(_props as any);
export const Circle = (_props: CircleProps) => createDiv(_props as any);
export const Rect = (_props: RectProps) => createDiv(_props as any);
export const Line = (_props: LineProps) => createDiv(_props as any);
export const Polygon = (_props: PolygonProps) => createDiv(_props as any);
export const G = (props: GProps) => React.createElement(View, null, props.children);
export const Defs = (_props: DefsProps) => null;
export const Stop = (_props: StopProps) => null;
export const LinearGradient = (_props: LinearGradientProps) => null;

// Default export is the Svg component itself (matching react-native-svg's API)
export default SvgComponent;
