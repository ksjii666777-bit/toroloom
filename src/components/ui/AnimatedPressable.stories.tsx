import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AnimatedPressable from './AnimatedPressable';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, BORDER_RADIUS } from '../../constants/theme';

/**
 * AnimatedPressable — a drop-in pressable wrapper with spring-based scale
 * animation, configurable haptic feedback, and an optional highlight overlay.
 *
 * Wraps any child content and adds touch feedback automatically. Used as the
 * base interaction primitive across the entire app (buttons, cards, list rows).
 */
const meta: Meta<typeof AnimatedPressable> = {
  title: 'UI/AnimatedPressable',
  component: AnimatedPressable,
  tags: ['autodocs'],
  argTypes: {
    scaleTo: {
      control: { type: 'range', min: 0.8, max: 1, step: 0.01 },
      description: 'Scale on press-in (lower = more squash)',
    },
    haptic: {
      control: 'select',
      options: ['light', 'medium', 'heavy', 'selection', 'none'],
      description: 'Haptic feedback type on press',
    },
    disabled: { control: 'boolean' },
    highlight: { control: 'boolean', description: 'Show colored overlay on press' },
    highlightColor: { control: 'color', description: 'Overlay color (defaults to theme primary)' },
    borderRadius: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof AnimatedPressable>;

// ─── Card wrapper for visual context ───────────────────────────────────────

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  cardText: {
    color: '#E0E6ED',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  cardSubtext: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

function DemoCard({ title, subtitle = 'Tap to interact' }: { title: string; subtitle?: string }) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.icon}>
        <Ionicons name="hand-left-outline" size={20} color="#60A5FA" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={cardStyles.cardText}>{title}</Text>
        <Text style={cardStyles.cardSubtext}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#64748B" />
    </View>
  );
}

// ─── Default ──────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    onPress: () => alert('Pressed!'),
    haptic: 'light',
  },
  render: (args) => (
    <AnimatedPressable {...args}>
      <DemoCard title="Default Pressable" subtitle="Light haptic · 0.96 scale" />
    </AnimatedPressable>
  ),
};

// ─── With Highlight Overlay ───────────────────────────────────────────────

export const WithHighlight: Story = {
  args: {
    onPress: () => alert('Pressed!'),
    highlight: true,
    haptic: 'medium',
  },
  render: (args) => (
    <AnimatedPressable {...args}>
      <DemoCard title="With Highlight" subtitle="Blue overlay on press · medium haptic" />
    </AnimatedPressable>
  ),
};

// ─── Custom Highlight Color ────────────────────────────────────────────────

export const CustomHighlight: Story = {
  args: {
    onPress: () => alert('Pressed!'),
    highlight: true,
    highlightColor: '#22C55E',
    haptic: 'medium',
  },
  render: (args) => (
    <AnimatedPressable {...args}>
      <DemoCard title="Custom Highlight" subtitle="Green overlay instead of default blue" />
    </AnimatedPressable>
  ),
};

// ─── Aggressive Scale ──────────────────────────────────────────────────────

export const AggressiveScale: Story = {
  args: {
    onPress: () => alert('Squished!'),
    scaleTo: 0.85,
    haptic: 'heavy',
  },
  render: (args) => (
    <AnimatedPressable {...args}>
      <DemoCard title="Aggressive Scale (0.85)" subtitle="Heavy haptic · more squash" />
    </AnimatedPressable>
  ),
};

// ─── Subtle Scale ──────────────────────────────────────────────────────────

export const SubtleScale: Story = {
  args: {
    onPress: () => alert('Pressed!'),
    scaleTo: 0.98,
    haptic: 'selection',
  },
  render: (args) => (
    <AnimatedPressable {...args}>
      <DemoCard title="Subtle Scale (0.98)" subtitle="Selection haptic · barely noticeable" />
    </AnimatedPressable>
  ),
};

// ─── Disabled ──────────────────────────────────────────────────────────────

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => (
    <AnimatedPressable {...args}>
      <DemoCard title="Disabled" subtitle="No press feedback · not tappable" />
    </AnimatedPressable>
  ),
};

// ─── No Haptic ─────────────────────────────────────────────────────────────

export const NoHaptic: Story = {
  args: {
    onPress: () => alert('Pressed!'),
    haptic: 'none',
  },
  render: (args) => (
    <AnimatedPressable {...args}>
      <DemoCard title="No Haptic" subtitle="Visual scale only · no vibration" />
    </AnimatedPressable>
  ),
};

// ─── Custom Border Radius ──────────────────────────────────────────────────

export const CustomBorderRadius: Story = {
  args: {
    onPress: () => alert('Pressed!'),
    borderRadius: 20,
  },
  render: (args) => (
    <AnimatedPressable {...args}>
      <View
        style={[
          cardStyles.card,
          { borderRadius: 20, backgroundColor: 'rgba(249,115,22,0.1)', borderColor: 'rgba(249,115,22,0.2)' },
        ]}
      >
        <View style={[cardStyles.icon, { backgroundColor: 'rgba(249,115,22,0.15)' }]}>
          <Ionicons name="sparkles-outline" size={20} color="#F97316" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.cardText}>Custom Radius (20)</Text>
          <Text style={cardStyles.cardSubtext}>Fully rounded · pill shape</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#64748B" />
      </View>
    </AnimatedPressable>
  ),
};

// ─── All States Grid ───────────────────────────────────────────────────────

export const AllStates: Story = {
  name: 'All States',
  render: () => (
    <View style={{ gap: SPACING.md }}>
      <AnimatedPressable onPress={() => alert('Default')}>
        <DemoCard title="Default" subtitle="Normal press behavior" />
      </AnimatedPressable>
      <AnimatedPressable onPress={() => alert('Highlight')} highlight>
        <DemoCard title="Highlight" subtitle="With press overlay" />
      </AnimatedPressable>
      <AnimatedPressable onPress={() => alert('Aggressive')} scaleTo={0.85} haptic="heavy">
        <DemoCard title="Aggressive Scale" subtitle="0.85 · heavy haptic" />
      </AnimatedPressable>
      <AnimatedPressable disabled>
        <DemoCard title="Disabled" subtitle="Not interactive" />
      </AnimatedPressable>
      <AnimatedPressable onPress={() => alert('Subtle')} scaleTo={0.98} haptic="selection">
        <DemoCard title="Subtle" subtitle="0.98 · selection haptic" />
      </AnimatedPressable>
    </View>
  ),
};

// ─── Use Case: Card Row ────────────────────────────────────────────────────

export const UseCaseCardRow: Story = {
  name: 'Use Case — Menu Row',
  render: () => (
    <View style={{ gap: SPACING.xs }}>
      {[
        { icon: 'wallet-outline', title: 'Portfolio', subtitle: 'View holdings & P&L', color: '#22C55E' },
        { icon: 'trending-up-outline', title: 'Markets', subtitle: 'Nifty, Bank Nifty, stocks', color: '#60A5FA' },
        { icon: 'git-network-outline', title: 'F&O Chain', subtitle: 'Options & futures', color: '#A78BFA' },
        { icon: 'bulb-outline', title: 'AI Insights', subtitle: 'AI-powered market analysis', color: '#F97316' },
      ].map((item, i) => (
        <AnimatedPressable
          key={i}
          onPress={() => alert(`Navigating to ${item.title}`)}
          haptic={i === 0 ? 'medium' : 'light'}
          highlight
          highlightColor={item.color}
        >
          <View style={[cardStyles.card]}>
            <View style={[cardStyles.icon, { backgroundColor: `${item.color}22` as string }]}>
              <Ionicons name={item.icon as any} size={20} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={cardStyles.cardText}>{item.title}</Text>
              <Text style={cardStyles.cardSubtext}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748B" />
          </View>
        </AnimatedPressable>
      ))}
    </View>
  ),
};
