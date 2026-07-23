import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Input from './Input';

/**
 * Input — a styled text input with label, icon, validation, and password visibility.
 *
 * Supports labels, placeholders, error states, icons, secure text entry,
 * multiline, and keyboard type configuration.
 */
const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    error: { control: 'text' },
    secureTextEntry: { control: 'boolean' },
    multiline: { control: 'boolean' },
    keyboardType: {
      control: 'select',
      options: ['default', 'numeric', 'email-address', 'phone-pad'],
    },
    icon: {
      control: 'select',
      options: ['mail-outline', 'lock-closed-outline', 'person-outline', 'search-outline', 'call-outline'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

// ─── Basic ─────────────────────────────────────────────────────────────────

export const Basic: Story = {
  render: () => {
    const [val, setVal] = useState('');
    return (
      <Input
        label="Full Name"
        placeholder="Enter your full name"
        value={val}
        onChangeText={setVal}
      />
    );
  },
};

// ─── With Value ────────────────────────────────────────────────────────────

export const WithValue: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'Enter your email',
    value: 'rahul@example.com',
    onChangeText: () => {},
    keyboardType: 'email-address',
  },
};

// ─── With Icon ─────────────────────────────────────────────────────────────

export const WithIcon: Story = {
  args: {
    label: 'Phone Number',
    placeholder: 'Enter your phone number',
    value: '+91 98765 43210',
    onChangeText: () => {},
    icon: 'call-outline' as const,
    keyboardType: 'phone-pad',
  },
};

// ─── Error State ───────────────────────────────────────────────────────────

export const Error: Story = {
  args: {
    label: 'Password',
    placeholder: 'Enter your password',
    value: 'abc',
    onChangeText: () => {},
    error: 'Password must be at least 6 characters',
    secureTextEntry: true,
  },
};

// ─── Password Field ────────────────────────────────────────────────────────

export const Password: Story = {
  args: {
    label: 'Password',
    placeholder: 'Create a strong password',
    value: '',
    onChangeText: () => {},
    secureTextEntry: true,
    icon: 'lock-closed-outline' as const,
  },
};

// ─── Multiline ─────────────────────────────────────────────────────────────

export const Multiline: Story = {
  args: {
    label: 'Bio',
    placeholder: 'Tell us about yourself...',
    value: '',
    onChangeText: () => {},
    multiline: true,
  },
};

// ─── All States Grid ───────────────────────────────────────────────────────

export const AllStates: Story = {
  name: 'All States',
  render: () => (
    <View style={{ gap: 4 }}>
      <Input
        label="Default Input"
        placeholder="No value, no focus"
        value=""
        onChangeText={() => {}}
      />
      <Input
        label="With Value"
        placeholder="Enter text"
        value="Sample text value"
        onChangeText={() => {}}
      />
      <Input
        label="Email Input"
        placeholder="email@example.com"
        value="user@toroloom.app"
        onChangeText={() => {}}
        icon="mail-outline"
        keyboardType="email-address"
      />
      <Input
        label="Password"
        placeholder="Enter password"
        value=""
        onChangeText={() => {}}
        secureTextEntry
        icon="lock-closed-outline"
      />
      <Input
        label="With Error"
        placeholder="Enter value"
        value="invalid"
        onChangeText={() => {}}
        error="Please enter a valid value"
      />
      <Input
        label="Multiline"
        placeholder="Write a longer message..."
        value=""
        onChangeText={() => {}}
        multiline
      />
    </View>
  ),
};
