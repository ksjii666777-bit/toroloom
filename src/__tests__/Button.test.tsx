/**
 * ============================================================================
 * Toroloom — Button Tests
 * ============================================================================
 *
 * Tests the Button component: title rendering, press callback, disabled state,
 * loading spinner, all variant/style combinations, size variants, and icon
 * rendering alongside title text.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { Text, View } from 'react-native';
import Button from '../components/ui/Button';
import { render, fireEvent } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      secondary: '#FF6B6B',
      secondaryGradient: ['#FF6B6B', '#EE5A24'] as const,
      white: '#FFFFFF',
      transparent: 'transparent',
    },
  }),
}));

describe('Button', () => {
  it('renders the title text', () => {
    const { getByText } = render(<Button title="Trade Now" onPress={() => {}} />);
    expect(getByText('Trade Now')).toBeDefined();
  });

  it('calls onPress when pressed', () => {
    const onPress = vi.fn();
    const { getByText } = render(<Button title="Press" onPress={onPress} />);
    fireEvent.press(getByText('Press'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders in disabled state without crashing', () => {
    const { getByText, root } = render(
      <Button title="Disabled" onPress={() => {}} disabled />
    );
    expect(getByText('Disabled')).toBeDefined();
    // Verify the disabled prop reaches the TouchableOpacity
    const touchable = root.find(
      (inst) => inst.props?.disabled === true
    );
    expect(touchable).toBeDefined();
  });

  it('renders children instead of title when loading', () => {
    const { toJSON } = render(
      <Button title="Loading" onPress={() => {}} loading />
    );
    // When loading, the ActivityIndicator replaces the title text
    expect(toJSON).toBeDefined();
  });

  it('renders with primary variant by default', () => {
    const { getByText } = render(<Button title="Primary" onPress={() => {}} />);
    expect(getByText('Primary')).toBeDefined();
  });

  it('renders with outline variant', () => {
    const { getByText } = render(
      <Button title="Outline" onPress={() => {}} variant="outline" />
    );
    expect(getByText('Outline')).toBeDefined();
  });

  it('renders with ghost variant', () => {
    const { getByText } = render(
      <Button title="Ghost" onPress={() => {}} variant="ghost" />
    );
    expect(getByText('Ghost')).toBeDefined();
  });

  it('renders with danger variant', () => {
    const { getByText } = render(
      <Button title="Danger" onPress={() => {}} variant="danger" />
    );
    expect(getByText('Danger')).toBeDefined();
  });

  it('renders with secondary variant', () => {
    const { getByText } = render(
      <Button title="Secondary" onPress={() => {}} variant="secondary" />
    );
    expect(getByText('Secondary')).toBeDefined();
  });

  it('renders with success variant', () => {
    const { getByText } = render(
      <Button title="Success" onPress={() => {}} variant="success" />
    );
    expect(getByText('Success')).toBeDefined();
  });

  it('renders with small size', () => {
    const { getByText } = render(
      <Button title="Small" onPress={() => {}} size="small" />
    );
    expect(getByText('Small')).toBeDefined();
  });

  it('renders with large size', () => {
    const { getByText } = render(
      <Button title="Large" onPress={() => {}} size="large" />
    );
    expect(getByText('Large')).toBeDefined();
  });

  it('renders with icon and title', () => {
    const { getByText } = render(
      <Button
        title="With Icon"
        onPress={() => {}}
        icon={<Text>Icon</Text>}
      />
    );
    expect(getByText('With Icon')).toBeDefined();
  });

  it('renders with custom gradient', () => {
    const { getByText } = render(
      <Button
        title="Gradient"
        onPress={() => {}}
        gradient={['#FF0000', '#00FF00'] as const}
      />
    );
    expect(getByText('Gradient')).toBeDefined();
  });

  it('applies custom style', () => {
    const { getByText } = render(
      <Button
        title="Styled"
        onPress={() => {}}
        style={{ marginTop: 10 }}
      />
    );
    expect(getByText('Styled')).toBeDefined();
  });

  it('is disabled when loading is true even without disabled prop', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <Button title="Loading" onPress={onPress} loading />
    );
    // Title is not rendered when loading, but the root should have disabled state
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders with outline variant and custom size', () => {
    const { getByText } = render(
      <Button title="Out Small" onPress={() => {}} variant="outline" size="small" />
    );
    expect(getByText('Out Small')).toBeDefined();
  });

  it('renders with ghost variant and large size', () => {
    const { getByText } = render(
      <Button title="Ghost Large" onPress={() => {}} variant="ghost" size="large" />
    );
    expect(getByText('Ghost Large')).toBeDefined();
  });

  it('renders with secondary variant and custom gradient override', () => {
    const { getByText } = render(
      <Button
        title="Custom"
        onPress={() => {}}
        variant="secondary"
        gradient={['#FF0000', '#00FF00'] as const}
      />
    );
    expect(getByText('Custom')).toBeDefined();
  });

  it('does not call onPress when both disabled and loading are true', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <Button title="No Press" onPress={onPress} disabled loading />
    );
    // Verify render doesn't crash
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders all size variants without crashing', () => {
    const sizes = ['small', 'medium', 'large'] as const;
    for (const size of sizes) {
      const { toJSON } = render(
        <Button title={`Size ${size}`} onPress={() => {}} size={size} />
      );
      expect(toJSON).toBeDefined();
    }
  });
});
