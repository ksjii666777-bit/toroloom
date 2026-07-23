import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, Text } from 'react-native';
import Badge from './Badge';

/**
 * Badge — a compact status indicator with a colored dot and label.
 *
 * Supports 6 color variants, 2 sizes, and an optional pop-in animation.
 * Commonly used for tags, status labels, and category chips.
 */
const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text', description: 'Badge text label' },
    variant: {
      control: 'select',
      options: ['primary', 'success', 'danger', 'warning', 'info', 'neutral'],
      description: 'Color theme variant',
    },
    size: {
      control: 'select',
      options: ['small', 'medium'],
      description: 'Badge size (padding + font)',
    },
    animated: {
      control: 'boolean',
      description: 'Enable pop-in entrance animation',
    },
    animationDelay: {
      control: 'number',
      description: 'Delay before animation starts (ms)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

// ─── Variants ──────────────────────────────────────────────────────────────

export const Primary: Story = {
  args: {
    label: 'Primary',
    variant: 'primary',
  },
};

export const Success: Story = {
  args: {
    label: 'Active',
    variant: 'success',
  },
};

export const Danger: Story = {
  args: {
    label: 'Expired',
    variant: 'danger',
  },
};

export const Warning: Story = {
  args: {
    label: 'Pending',
    variant: 'warning',
  },
};

export const Info: Story = {
  args: {
    label: 'Updated',
    variant: 'info',
  },
};

export const Neutral: Story = {
  args: {
    label: 'Draft',
    variant: 'neutral',
  },
};

// ─── Sizes ─────────────────────────────────────────────────────────────────

export const Small: Story = {
  args: {
    label: 'Small',
    variant: 'primary',
    size: 'small',
  },
};

export const Medium: Story = {
  args: {
    label: 'Medium Badge',
    variant: 'primary',
    size: 'medium',
  },
};

// ─── Animated Entry ────────────────────────────────────────────────────────

export const AnimatedEntry: Story = {
  args: {
    label: 'New!',
    variant: 'success',
    animated: true,
    animationDelay: 300,
  },
};

// ─── All Variants Grid ─────────────────────────────────────────────────────

export const AllVariants: Story = {
  name: 'All Variants',
  render: () => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Badge label="Primary" variant="primary" />
      <Badge label="Active" variant="success" />
      <Badge label="Expired" variant="danger" />
      <Badge label="Pending" variant="warning" />
      <Badge label="Updated" variant="info" />
      <Badge label="Draft" variant="neutral" />
    </View>
  ),
};

// ─── All Sizes Grid ────────────────────────────────────────────────────────

export const AllSizes: Story = {
  name: 'All Sizes',
  render: () => (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Badge label="Small" variant="primary" size="small" />
        <Text style={{ color: '#64748B', fontSize: 12 }}>Small</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Badge label="Medium" variant="primary" size="medium" />
        <Text style={{ color: '#64748B', fontSize: 12 }}>Medium</Text>
      </View>
    </View>
  ),
};

// ─── Animated Grid ─────────────────────────────────────────────────────────

export const AnimatedGrid: Story = {
  name: 'Animated Entry (Grid)',
  render: () => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Badge label="New" variant="success" animated animationDelay={0} />
      <Badge label="Hot" variant="danger" animated animationDelay={150} />
      <Badge label="Trending" variant="warning" animated animationDelay={300} />
      <Badge label="Updated" variant="info" animated animationDelay={450} />
    </View>
  ),
};

// ─── Use Cases ─────────────────────────────────────────────────────────────

export const UseCaseStatusLabels: Story = {
  name: 'Status Labels',
  render: () => (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Badge label="Active" variant="success" size="medium" />
        <Text style={{ color: '#E0E6ED', fontSize: 14 }}>Subscription is active</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Badge label="Pending" variant="warning" size="medium" />
        <Text style={{ color: '#E0E6ED', fontSize: 14 }}>Awaiting approval</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Badge label="Expired" variant="danger" size="medium" />
        <Text style={{ color: '#E0E6ED', fontSize: 14 }}>Plan has expired</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Badge label="Draft" variant="neutral" size="medium" />
        <Text style={{ color: '#E0E6ED', fontSize: 14 }}>Not yet published</Text>
      </View>
    </View>
  ),
};

// ─── Real-World Row ────────────────────────────────────────────────────────

export const UseCaseRow: Story = {
  name: 'Portfolio Row',
  render: () => (
    <View style={{ gap: 12, padding: 8 }}>
      {[
        { stock: 'RELIANCE', badge: '+2.3%', variant: 'success' as const },
        { stock: 'TCS', badge: '-0.8%', variant: 'danger' as const },
        { stock: 'HDFC', badge: '+1.1%', variant: 'success' as const },
        { stock: 'INFY', badge: 'NEW', variant: 'info' as const },
      ].map((item, idx) => (
        <View
          key={idx}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#E0E6ED', fontSize: 15, fontWeight: '600' }}>
            {item.stock}
          </Text>
          <Badge label={item.badge} variant={item.variant} />
        </View>
      ))}
    </View>
  ),
};
