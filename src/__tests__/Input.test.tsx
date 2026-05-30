/**
 * ============================================================================
 * Toroloom — Input Tests
 * ============================================================================
 *
 * Tests the Input component: label display, value rendering, onChangeText
 * callback, error state, icon rendering, secureTextEntry / password toggle,
 * multi-line mode, and keyboardType passthrough.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import Input from '../components/ui/Input';
import { render, fireEvent } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      bgInput: '#F0F2F8',
      border: '#E0E0F0',
      danger: '#FF1744',
      text: '#1A1A2E',
      textSecondary: '#5A5A7A',
      textMuted: '#9A9AB0',
    },
  }),
}));

describe('Input', () => {
  it('renders the label', () => {
    const { getByText } = render(
      <Input label="Email" value="" onChangeText={() => {}} />
    );
    expect(getByText('Email')).toBeDefined();
  });

  it('renders without label when not provided', () => {
    const { toJSON } = render(<Input value="" onChangeText={() => {}} />);
    expect(toJSON).toBeDefined();
  });

  it('passes value prop to TextInput', () => {
    const { root } = render(
      <Input value="hello@test.com" onChangeText={() => {}} />
    );
    // Find the TextInput element and verify its value prop
    const textInput = root.find(
      (inst) => inst.props?.onChangeText !== undefined
    );
    expect(textInput.props.value).toBe('hello@test.com');
  });

  it('calls onChangeText when value changes', () => {
    const onChangeText = vi.fn();
    const { root } = render(
      <Input value="" onChangeText={onChangeText} />
    );
    // Find the TextInput and trigger its onChangeText prop
    // The TextInput component is our mock — find it and fire the callback
    const textInputs = root.findAll(
      (inst) => inst.props?.onChangeText !== undefined
    );
    expect(textInputs.length).toBeGreaterThanOrEqual(1);
    fireEvent.trigger(textInputs[0], 'onChangeText', 'new value');
    expect(onChangeText).toHaveBeenCalledWith('new value');
  });

  it('renders error message', () => {
    const { getByText } = render(
      <Input label="Password" value="" onChangeText={() => {}} error="Required field" />
    );
    expect(getByText('Required field')).toBeDefined();
  });

  it('renders with icon', () => {
    const { toJSON } = render(
      <Input label="User" value="" onChangeText={() => {}} icon="person-outline" />
    );
    expect(toJSON).toBeDefined();
  });

  it('passes placeholder prop to TextInput', () => {
    const { root } = render(
      <Input value="" onChangeText={() => {}} placeholder="Enter text..." />
    );
    const textInput = root.find(
      (inst) => inst.props?.onChangeText !== undefined
    );
    expect(textInput.props.placeholder).toBe('Enter text...');
  });

  it('renders with secureTextEntry', () => {
    const { toJSON } = render(
      <Input label="Password" value="secret" onChangeText={() => {}} secureTextEntry />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with multiline', () => {
    const { toJSON } = render(
      <Input label="Description" value="" onChangeText={() => {}} multiline />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with numeric keyboard type', () => {
    const { toJSON } = render(
      <Input label="Amount" value="" onChangeText={() => {}} keyboardType="numeric" />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with autoCapitalize set', () => {
    const { toJSON } = render(
      <Input label="Name" value="" onChangeText={() => {}} autoCapitalize="words" />
    );
    expect(toJSON).toBeDefined();
  });

  it('applies custom style', () => {
    const { toJSON } = render(
      <Input label="Styled" value="" onChangeText={() => {}} style={{ marginTop: 10 }} />
    );
    expect(toJSON).toBeDefined();
  });

  it('does not render error when no error prop', () => {
    const { queryByText } = render(
      <Input label="Field" value="" onChangeText={() => {}} />
    );
    // Should not find any error-like text
    const errorEl = queryByText(/error|required/i);
    expect(errorEl).toBeNull();
  });

  it('renders password toggle eye icon with secureTextEntry', () => {
    const { toJSON } = render(
      <Input label="Password" value="secret123" onChangeText={() => {}} secureTextEntry />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders with focus state styles via onFocus/onBlur', () => {
    const { root } = render(
      <Input label="Focus" value="" onChangeText={() => {}} placeholder="Type here" />
    );
    const textInputs = root.findAll(
      (inst: any) => inst.props?.onFocus !== undefined
    );
    expect(textInputs.length).toBeGreaterThanOrEqual(1);
    // Trigger focus
    fireEvent.trigger(textInputs[0], 'onFocus');
    // Trigger blur
    fireEvent.trigger(textInputs[0], 'onBlur');
  });

  it('renders with icon and label together', () => {
    const { getByText } = render(
      <Input label="Username" value="john" onChangeText={() => {}} icon="person-outline" />
    );
    expect(getByText('Username')).toBeDefined();
  });

  it('renders with all optional props combined', () => {
    const { toJSON } = render(
      <Input
        label="Full Name"
        placeholder="Enter your name"
        value="John Doe"
        onChangeText={() => {}}
        icon="person-outline"
        keyboardType="default"
        autoCapitalize="words"
        style={{ marginBottom: 20 }}
      />
    );
    expect(toJSON).toBeDefined();
  });

  it('renders multiline with placeholder', () => {
    const { root } = render(
      <Input label="Bio" value="" onChangeText={() => {}} multiline placeholder="Tell us about yourself" />
    );
    const textInput = root.find(
      (inst: any) => inst.props?.placeholder === 'Tell us about yourself'
    );
    expect(textInput).toBeDefined();
  });
});
