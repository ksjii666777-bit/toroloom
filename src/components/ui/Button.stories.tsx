import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View } from 'react-native';
import Button from './Button';
import { Ionicons } from '@expo/vector-icons';

/**
 * Button — the primary call-to-action component.
 *
 * Supports 6 variants, 3 sizes, loading/disabled states, icons, and gradients.
 * All buttons use AnimatedPressable under the hood for scale + haptic feedback.
 */
const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost', 'danger', 'success'],
      description: 'Visual style variant',
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
      description: 'Button size (padding + font)',
    },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    title: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// ─── Variants ──────────────────────────────────────────────────────────────

export const Primary: Story = {
  args: {
    title: 'Primary Action',
    variant: 'primary',
    onPress: () => alert('Pressed!'),
  },
};

export const Secondary: Story = {
  args: {
    title: 'Secondary Action',
    variant: 'secondary',
    onPress: () => alert('Pressed!'),
  },
};

export const Outline: Story = {
  args: {
    title: 'Outline Button',
    variant: 'outline',
    onPress: () => alert('Pressed!'),
  },
};

export const Ghost: Story = {
  args: {
    title: 'Ghost Button',
    variant: 'ghost',
    onPress: () => alert('Pressed!'),
  },
};

export const Danger: Story = {
  args: {
    title: 'Delete Account',
    variant: 'danger',
    onPress: () => alert('Deleted!'),
  },
};

export const Success: Story = {
  args: {
    title: 'Complete',
    variant: 'success',
    onPress: () => alert('Done!'),
  },
};

// ─── Sizes ─────────────────────────────────────────────────────────────────

export const Small: Story = {
  args: {
    title: 'Small',
    size: 'small',
    onPress: () => {},
  },
};

export const Medium: Story = {
  args: {
    title: 'Medium',
    size: 'medium',
    onPress: () => {},
  },
};

export const Large: Story = {
  args: {
    title: 'Large Button',
    size: 'large',
    onPress: () => {},
  },
};

// ─── States ────────────────────────────────────────────────────────────────

export const Loading: Story = {
  args: {
    title: 'Saving...',
    loading: true,
    onPress: () => {},
  },
};

export const Disabled: Story = {
  args: {
    title: 'Disabled',
    disabled: true,
    onPress: () => {},
  },
};

// ─── With Icon ─────────────────────────────────────────────────────────────

export const WithIcon: Story = {
  render: (args: any) => (
    <Button
      {...args}
      title="Download Report"
      variant="primary"
      onPress={() => {}}
      icon={<Ionicons name="download-outline" size={18} color="#FFF" />}
    />
  ),
};

// ─── Custom Gradient ───────────────────────────────────────────────────────

export const CustomGradient: Story = {
  render: (args: any) => (
    <Button
      {...args}
      title="Custom Gradient"
      onPress={() => {}}
      gradient={['#8B5CF6', '#6C63FF'] as const}
    />
  ),
};

// ─── All Variants Grid ─────────────────────────────────────────────────────

export const AllVariants: Story = {
  name: 'All Variants',
  render: () => (
    <View style={{ gap: 12 }}>
      <Button title="Primary" variant="primary" onPress={() => {}} />
      <Button title="Secondary" variant="secondary" onPress={() => {}} />
      <Button title="Outline" variant="outline" onPress={() => {}} />
      <Button title="Ghost" variant="ghost" onPress={() => {}} />
      <Button title="Danger" variant="danger" onPress={() => {}} />
      <Button title="Success" variant="success" onPress={() => {}} />
    </View>
  ),
};

// ─── All Sizes Grid ────────────────────────────────────────────────────────

export const AllSizes: Story = {
  name: 'All Sizes',
  render: () => (
    <View style={{ gap: 12 }}>
      <Button title="Small" size="small" variant="primary" onPress={() => {}} />
      <Button title="Medium" size="medium" variant="primary" onPress={() => {}} />
      <Button title="Large" size="large" variant="primary" onPress={() => {}} />
    </View>
  ),
};

// ─── States Grid ───────────────────────────────────────────────────────────

export const AllStates: Story = {
  name: 'All States',
  render: () => (
    <View style={{ gap: 12 }}>
      <Button title="Normal" variant="primary" onPress={() => {}} />
      <Button title="Loading..." loading variant="primary" onPress={() => {}} />
      <Button title="Disabled" disabled variant="primary" onPress={() => {}} />
    </View>
  ),
};
