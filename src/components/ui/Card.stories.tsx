import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, Text } from 'react-native';
import Card from './Card';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';

/**
 * Card — a versatile content container.
 *
 * Supports titles, subtitles, gradient backgrounds, entry animations,
 * right actions, and configurable padding.
 */
const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    subtitle: { control: 'text' },
    noPadding: { control: 'boolean' },
    animated: { control: 'boolean' },
    animationDelay: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

// ─── Basic ─────────────────────────────────────────────────────────────────

export const Basic: Story = {
  args: {
    children: (
      <Text style={{ color: '#E0E6ED', fontSize: 14 }}>
        This is a basic card with default styling. It has a subtle border,
        rounded corners, and a semi-transparent background.
      </Text>
    ),
  },
};

// ─── With Header ───────────────────────────────────────────────────────────

export const WithHeader: Story = {
  args: {
    title: 'Portfolio Overview',
    subtitle: 'Your investments at a glance',
    children: (
      <View style={{ gap: 8, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: '#64748B', fontSize: 13 }}>Total Invested</Text>
          <Text style={{ color: '#E0E6ED', fontSize: 14, fontWeight: '600' }}>₹12,45,000</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: '#64748B', fontSize: 13 }}>Current Value</Text>
          <Text style={{ color: '#00E676', fontSize: 14, fontWeight: '600' }}>₹14,82,300</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: '#64748B', fontSize: 13 }}>Total Returns</Text>
          <Text style={{ color: '#00E676', fontSize: 14, fontWeight: '600' }}>+₹2,37,300 (+19.1%)</Text>
        </View>
      </View>
    ),
  },
};

// ─── With Right Action ─────────────────────────────────────────────────────

export const WithRightAction: Story = {
  args: {
    title: 'Quick Actions',
    subtitle: 'Tap to navigate',
    rightAction: (
      <Ionicons name="chevron-forward" size={20} color="#64748B" />
    ),
    children: (
      <Text style={{ color: '#E0E6ED', fontSize: 14 }}>
        Cards can include a right-aligned action element like a chevron,
        button, or badge for navigation hints.
      </Text>
    ),
  },
};

// ─── Gradient ──────────────────────────────────────────────────────────────

export const Gradient: Story = {
  args: {
    title: 'Premium Feature',
    subtitle: 'Unlock advanced analytics',
    gradient: ['rgba(59,130,246,0.15)', 'rgba(99,102,241,0.08)'] as const,
    children: (
      <View style={{ marginTop: 8 }}>
        <Button
          title="Upgrade to Pro"
          variant="primary"
          size="small"
          onPress={() => {}}
        />
      </View>
    ),
  },
};

// ─── Animated Entry ────────────────────────────────────────────────────────

export const AnimatedEntry: Story = {
  args: {
    title: 'Welcome Back!',
    subtitle: 'Your daily market summary',
    animated: true,
    animationDelay: 200,
    children: (
      <Text style={{ color: '#E0E6ED', fontSize: 14 }}>
        This card fades in and slides up when mounted. Useful for staggered
        list animations on screen transitions.
      </Text>
    ),
  },
};

// ─── No Padding ────────────────────────────────────────────────────────────

export const NoPadding: Story = {
  args: {
    title: 'Full-bleed Content',
    noPadding: true,
    children: (
      <View style={{ height: 120, backgroundColor: 'rgba(59,130,246,0.1)', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#60A5FA', fontSize: 14 }}>Full-bleed area</Text>
      </View>
    ),
  },
};

// ─── All Variants Grid ─────────────────────────────────────────────────────

export const AllVariants: Story = {
  name: 'All Variants',
  render: () => (
    <View style={{ gap: 16 }}>
      <Card title="Basic Card" subtitle="Default styling">
        <Text style={{ color: '#E0E6ED', fontSize: 14 }}>
          Standard card with header and content area.
        </Text>
      </Card>
      <Card
        title="Gradient Card"
        subtitle="Subtle brand gradient"
        gradient={['rgba(0,230,118,0.12)', 'rgba(0,200,83,0.06)'] as const}
      >
        <Text style={{ color: '#E0E6ED', fontSize: 14 }}>
          Gradient cards draw attention to important features or stats.
        </Text>
      </Card>
      <Card title="Animated Card" animated animationDelay={100}>
        <Text style={{ color: '#E0E6ED', fontSize: 14 }}>
          Entry animation with configurable delay for staggered reveals.
        </Text>
      </Card>
    </View>
  ),
};
