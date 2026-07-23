import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, Text } from 'react-native';
import MetallicShieldSVG from './MetallicShieldSVG';

/**
 * MetallicShieldSVG — a premium custom SVG shield icon with metallic iron
 * gradients, financial vectors (candlestick chart, trend line), cyberpunk
 * cyan glow accents, and premium gold details.
 *
 * Uses react-native-svg for high-resolution rendering at any size.
 */
const meta: Meta<typeof MetallicShieldSVG> = {
  title: 'UI/MetallicShieldSVG',
  component: MetallicShieldSVG,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'number', min: 32, max: 280, step: 8 },
      description: 'Shield dimension (width & height in px)',
    },
    glowOpacity: {
      control: { type: 'number', min: 0, max: 1, step: 0.1 },
      description: 'Cyan glow border opacity (0 = hidden, 1 = full)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof MetallicShieldSVG>;

export const Default: Story = {
  args: {
    size: 140,
    glowOpacity: 0.5,
  },
};

export const Small: Story = {
  args: {
    size: 48,
    glowOpacity: 0.3,
  },
};

export const Medium: Story = {
  args: {
    size: 80,
    glowOpacity: 0.5,
  },
};

export const Large: Story = {
  args: {
    size: 200,
    glowOpacity: 0.6,
  },
};

export const NoGlow: Story = {
  args: {
    size: 140,
    glowOpacity: 0,
  },
};

export const FullGlow: Story = {
  args: {
    size: 140,
    glowOpacity: 1,
  },
};

export const SizesShowcase: Story = {
  name: 'All Sizes',
  render: () => (
    <View style={{ gap: 16 }}>
      {[48, 80, 120, 160, 200].map((s) => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <MetallicShieldSVG size={s} glowOpacity={0.5} />
          <Text style={{ color: '#64748B', fontSize: 12 }}>{s}×{s}px</Text>
        </View>
      ))}
    </View>
  ),
};

export const GlowComparison: Story = {
  name: 'Glow Opacity Comparison',
  render: () => (
    <View style={{ gap: 16 }}>
      {[0, 0.25, 0.5, 0.75, 1].map((opacity) => (
        <View key={opacity} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <MetallicShieldSVG size={64} glowOpacity={opacity} />
          <Text style={{ color: '#64748B', fontSize: 12 }}>Glow: {opacity}</Text>
        </View>
      ))}
    </View>
  ),
};

export const InContext: Story = {
  name: 'In Context (Upgrade Prompt)',
  render: () => (
    <View
      style={{
        alignItems: 'center',
        gap: 16,
        padding: 24,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <MetallicShieldSVG size={80} glowOpacity={0.6} />
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{ color: '#E0E6ED', fontSize: 18, fontWeight: '700' }}>Upgrade to Premium</Text>
        <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center' }}>
          Unlock advanced analytics, real-time alerts, and zero-API trading
        </Text>
      </View>
    </View>
  ),
};
