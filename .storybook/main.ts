import path from 'path';
import { fileURLToPath } from 'url';
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/components/ui/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  /**
   * Alias react-native → react-native-web so that component
   * imports (View, Text, etc.) resolve in the browser.
   */
  async viteFinal(config) {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const alias = (config.resolve ??= {}).alias = {
      ...((config.resolve.alias ?? {}) as Record<string, string>),
      // Comprehensive react-native mock — re-exports react-native-web + missing internals
      'react-native': path.resolve(dirname, 'mocks/react-native.ts'),
      // react-native-reanimated is not compatible with react-native-web;
      // we replace it with a no-op mock so components render in Storybook.
      'react-native-reanimated': path.resolve(dirname, 'mocks/react-native-reanimated.ts'),
      // @expo/vector-icons contains JSX in .js files that Vite cannot parse;
      // we replace it with a simple text-based mock for Storybook.
      '@expo/vector-icons': path.resolve(dirname, 'mocks/expo-vector-icons.tsx'),
      // expo-modules-core is not available in react-native-web;
      // we replace it with a stub so expo module imports don't crash.
      'expo-modules-core': path.resolve(dirname, 'mocks/expo-modules-core.ts'),
      // expo-haptics is not available in the browser; no-op mock.
      'expo-haptics': path.resolve(dirname, 'mocks/expo-haptics.ts'),
      // expo-linear-gradient rendered as CSS linear-gradient in the browser.
      'expo-linear-gradient': path.resolve(dirname, 'mocks/expo-linear-gradient.tsx'),
      // react-native-svg rendered as simple View-based placeholders in the browser.
      'react-native-svg': path.resolve(dirname, 'mocks/react-native-svg.tsx'),
      // react-native-safe-area-context needs a full mock in the browser
      'react-native-safe-area-context': path.resolve(dirname, 'mocks/react-native-safe-area-context.tsx'),
      // @react-native-firebase/app needs internal react-native vendor modules
      '@react-native-firebase/app': path.resolve(dirname, 'mocks/react-native-firebase-app.ts'),
      '@react-native-firebase/analytics': path.resolve(dirname, 'mocks/react-native-firebase-app.ts'),
    };
    return config;
  },
};

export default config;
