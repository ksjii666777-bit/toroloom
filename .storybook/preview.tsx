import React from 'react';
import type { Preview } from '@storybook/react';
import { View, StyleSheet } from 'react-native';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { COLORS, SPACING } from '../src/constants/theme';

/**
 * Toroloom — Storybook Preview Configuration
 *
 * Wraps all stories in the app's ThemeProvider so they render
 * with the correct dark palette, fonts, and spacing tokens.
 */
const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    padding: SPACING.lg,
    minHeight: 200,
  },
});

/**
 * Internal wrapper that reads the current theme and renders a backdrop.
 */
function StoryWrapper({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrapper, { backgroundColor: colors.bg }]}>
      {children}
    </View>
  );
}

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
    layout: 'fullscreen',
  },

  decorators: [
    (Story) => (
      <ThemeProvider>
        <StoryWrapper>
          <Story />
        </StoryWrapper>
      </ThemeProvider>
    ),
  ],
};

export default preview;
