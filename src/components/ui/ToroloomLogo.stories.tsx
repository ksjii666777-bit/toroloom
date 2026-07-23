import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, Text } from 'react-native';
import ToroloomLogo from './ToroloomLogo';

/**
 * ToroloomLogo — the app's brand logo rendered as an SVG.
 *
 * Features concentric hexagons, a center execution dot, matrix grid lines,
 * and gradient fills (Electric Blue → Emerald). Uses react-native-svg.
 */
const meta: Meta<typeof ToroloomLogo> = {
  title: 'UI/ToroloomLogo',
  component: ToroloomLogo,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'number', min: 16, max: 256, step: 8 },
      description: 'Logo dimension (width & height in px)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ToroloomLogo>;

export const Default: Story = {
  args: {
    size: 48,
  },
};

export const Small: Story = {
  args: {
    size: 24,
  },
};

export const Medium: Story = {
  args: {
    size: 64,
  },
};

export const Large: Story = {
  args: {
    size: 120,
  },
};

export const ExtraLarge: Story = {
  args: {
    size: 200,
  },
};

export const SizesShowcase: Story = {
  name: 'All Sizes',
  render: () => (
    <View style={{ gap: 16 }}>
      {[24, 32, 48, 64, 96, 120].map((s) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <ToroloomLogo size={s} />
          <Text style={{ color: '#64748B', fontSize: 12 }}>{s}×{s}px</Text>
        </View>
      ))}
    </View>
  ),
};

export const InlineWithText: Story = {
  name: 'Inline with Text',
  render: () => (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ToroloomLogo size={28} />
        <Text style={{ color: '#E0E6ED', fontSize: 20, fontWeight: '700' }}>Toroloom</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ToroloomLogo size={20} />
        <Text style={{ color: '#64748B', fontSize: 13 }}>Powered by Toroloom</Text>
      </View>
    </View>
  ),
};
