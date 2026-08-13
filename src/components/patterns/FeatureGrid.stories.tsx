import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FeatureGrid, FeatureItem } from './FeatureGrid';

/**
 * FeatureGrid — a responsive tile grid for feature shortcuts.
 *
 * Tiles show an icon (optionally with a badge) above a 2-line-max label.
 * Column count adapts to screen width and font scale; labels use a fixed
 * height so every row stays aligned even when one label wraps.
 */
const meta: Meta<typeof FeatureGrid> = {
  title: 'Patterns/FeatureGrid',
  component: FeatureGrid,
  tags: ['autodocs'],
  argTypes: {
    columns: { control: 'select', options: [undefined, 2, 3, 4] },
  },
};

export default meta;
type Story = StoryObj<typeof FeatureGrid>;

const baseItems: FeatureItem[] = [
  {
    key: 'trade',
    label: 'Trade',
    icon: <Ionicons name="swap-horizontal" size={24} color="#3B82F6" />,
    onPress: () => {},
  },
  {
    key: 'portfolio',
    label: 'Portfolio',
    icon: <Ionicons name="pie-chart" size={24} color="#22C55E" />,
    onPress: () => {},
  },
  {
    key: 'watchlist',
    label: 'Watchlist',
    icon: <Ionicons name="star" size={24} color="#F59E0B" />,
    onPress: () => {},
  },
  {
    key: 'markets',
    label: 'Markets',
    icon: <Ionicons name="trending-up" size={24} color="#EF4444" />,
    onPress: () => {},
  },
];

// ─── Basic ─────────────────────────────────────────────────────────────────

export const Basic: Story = {
  args: { items: baseItems },
};

// ─── Fixed Columns ─────────────────────────────────────────────────────────

export const TwoColumns: Story = {
  args: { items: baseItems, columns: 2 },
};

export const FourColumns: Story = {
  args: { items: baseItems.slice(0, 4), columns: 4 },
};

// ─── Tones ─────────────────────────────────────────────────────────────────

export const Tones: Story = {
  name: 'Tones',
  render: () => (
    <FeatureGrid
      items={[
        {
          key: 'accent',
          label: 'Accent',
          tone: 'accent',
          icon: <Ionicons name="flash" size={24} color="#3B82F6" />,
          onPress: () => {},
        },
        {
          key: 'positive',
          label: 'Positive',
          tone: 'positive',
          icon: <Ionicons name="checkmark-circle" size={24} color="#22C55E" />,
          onPress: () => {},
        },
        {
          key: 'negative',
          label: 'Negative',
          tone: 'negative',
          icon: <Ionicons name="close-circle" size={24} color="#EF4444" />,
          onPress: () => {},
        },
        {
          key: 'warning',
          label: 'Warning',
          tone: 'warning',
          icon: <Ionicons name="alert" size={24} color="#F59E0B" />,
          onPress: () => {},
        },
        {
          key: 'neutral',
          label: 'Neutral',
          tone: 'neutral',
          icon: <Ionicons name="ellipse" size={24} color="#94A3B8" />,
          onPress: () => {},
        },
      ]}
    />
  ),
};

// ─── Badges ────────────────────────────────────────────────────────────────

export const WithBadges: Story = {
  name: 'With Badges',
  render: () => (
    <FeatureGrid
      items={[
        {
          key: 'alerts',
          label: 'Price Alerts',
          badge: 3,
          icon: <Ionicons name="notifications" size={24} color="#3B82F6" />,
          onPress: () => {},
        },
        {
          key: 'orders',
          label: 'Open Orders',
          badge: '12',
          icon: <Ionicons name="receipt" size={24} color="#22C55E" />,
          onPress: () => {},
        },
        {
          key: 'messages',
          label: 'Messages',
          badge: 99,
          icon: <Ionicons name="chatbubbles" size={24} color="#F59E0B" />,
          onPress: () => {},
        },
        {
          key: 'news',
          label: 'News',
          icon: <Ionicons name="newspaper" size={24} color="#EF4444" />,
          onPress: () => {},
        },
      ]}
    />
  ),
};

// ─── Disabled ──────────────────────────────────────────────────────────────

export const Disabled: Story = {
  name: 'Disabled',
  render: () => (
    <FeatureGrid
      items={[
        ...baseItems,
        {
          key: 'locked',
          label: 'Premium Only',
          disabled: true,
          icon: <Ionicons name="lock-closed" size={24} color="#64748B" />,
          onPress: () => {},
        },
      ]}
    />
  ),
};

// ─── Long Labels (wraps to 2 lines, rows stay aligned) ─────────────────────

export const LongLabels: Story = {
  name: 'Long Labels',
  render: () => (
    <FeatureGrid
      items={[
        {
          key: 'short',
          label: 'Short',
          icon: <Ionicons name="home" size={24} color="#3B82F6" />,
          onPress: () => {},
        },
        {
          key: 'long',
          label: 'This label wraps to a second line',
          icon: <Ionicons name="document-text" size={24} color="#22C55E" />,
          onPress: () => {},
        },
        {
          key: 'medium',
          label: 'Medium label',
          icon: <Ionicons name="layers" size={24} color="#F59E0B" />,
          onPress: () => {},
        },
        {
          key: 'verylong',
          label: 'A much longer label that definitely wraps onto two lines',
          icon: <Ionicons name="albums" size={24} color="#EF4444" />,
          onPress: () => {},
        },
      ]}
    />
  ),
};
