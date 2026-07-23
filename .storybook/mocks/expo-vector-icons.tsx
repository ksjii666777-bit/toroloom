/**
 * Mock for @expo/vector-icons — used by Storybook (web Vite) so that
 * components importing Ionicons don't crash trying to parse JSX in
 * react-native-vector-icons' .js files.
 *
 * Renders simple text placeholders instead of actual icon glyphs.
 */

import React from 'react';
import { Text, View } from 'react-native';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: Record<string, unknown>;
}

function createIconSet() {
  const IconComponent = (props: IconProps) => {
    const { name, size = 24, color = '#000', style } = props;
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
          },
          style as Record<string, unknown>,
        ]}
      >
        <Text style={{ fontSize: size * 0.5, color, textAlign: 'center' }}>
          {name === 'search-outline'
            ? '🔍'
            : name === 'chevron-forward'
              ? '›'
              : name === 'download-outline'
                ? '↓'
                : name === 'mail-outline'
                  ? '✉'
                  : name === 'lock-closed-outline'
                    ? '🔒'
                    : name === 'person-outline'
                      ? '👤'
                      : name === 'call-outline'
                        ? '📞'
                        : '●'}
        </Text>
      </View>
    );
  };
  IconComponent.displayName = 'Icon';
  return IconComponent;
}

export const Ionicons = createIconSet();
export const MaterialIcons = createIconSet();
export const MaterialCommunityIcons = createIconSet();
export const FontAwesome = createIconSet();
export const Feather = createIconSet();
export const Octicons = createIconSet();
export const AntDesign = createIconSet();
export const Entypo = createIconSet();
export const EvilIcons = createIconSet();
export const Foundation = createIconSet();
export const Fontisto = createIconSet();
export const SimpleLineIcons = createIconSet();
export const Zocial = createIconSet();

const ExpoVectorIcons = {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  FontAwesome,
  Feather,
  Octicons,
  AntDesign,
};

export default ExpoVectorIcons;
