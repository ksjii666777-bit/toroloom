/**
 * Web stub for `@expo/vector-icons`.
 *
 * The demo verifies TEXT translation, not glyph rendering, so each icon family
 * renders a monospace span showing its icon name (keeps the bundle free of
 * expo-font asset loading).
 */

import React from 'react';

interface IconProps {
  name?: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

const makeIcon = (family: string) =>
  ({ name = '', size = 20, color = '#000000', style }: IconProps) =>
    React.createElement(
      'span',
      {
        'data-icon': `${family}:${name}`,
        style: {
          fontSize: size,
          color,
          fontFamily: 'monospace',
          lineHeight: 1,
          ...style,
        },
      },
      name || '\u25c8'
    );

export const Ionicons = makeIcon('ion');
export const MaterialIcons = makeIcon('mi');
export const MaterialCommunityIcons = makeIcon('mci');
export const FontAwesome = makeIcon('fa');
export const FontAwesome5 = makeIcon('fa5');
export const FontAwesome6 = makeIcon('fa6');
export const Feather = makeIcon('fe');
export const AntDesign = makeIcon('ad');
export const Entypo = makeIcon('en');
export const EvilIcons = makeIcon('ev');
export const Foundation = makeIcon('fo');
export const Octicons = makeIcon('oc');
export const SimpleLineIcons = makeIcon('sl');
export const Zocial = makeIcon('zo');

export default {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  FontAwesome,
  FontAwesome5,
  FontAwesome6,
  Feather,
  AntDesign,
  Entypo,
  EvilIcons,
  Foundation,
  Octicons,
  SimpleLineIcons,
  Zocial,
};
