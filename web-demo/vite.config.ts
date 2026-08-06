/**
 * ============================================================================
 * Toroloom — i18n Web Demo (Vite config)
 * ============================================================================
 *
 * Standalone browser harness that renders REAL Toroloom components against the
 * REAL i18n instance (src/i18n) so the en↔hi language toggle can be verified
 * live in a browser without booting the full native app.
 *
 * Native-only modules that have no web build are replaced with tiny stubs:
 *   - react-native-reanimated  → static style stubs (no animations needed)
 *   - expo-haptics             → no-op haptics on web
 *   - @expo/vector-icons       → renders the icon name as text
 *
 * Run:
 *   npx vite build --config web-demo/vite.config.ts
 *   npx vite preview --config web-demo/vite.config.ts --port 4175
 *   # open http://localhost:4175
 * ============================================================================
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  resolve: {
    alias: {
      // React Native components → react-native-web (installed dependency)
      'react-native': 'react-native-web',
      // Native modules with no browser build → local stubs
      'react-native-reanimated': resolve(__dirname, 'stubs/reanimated.ts'),
      'expo-haptics': resolve(__dirname, 'stubs/expo-haptics.ts'),
      '@expo/vector-icons': resolve(__dirname, 'stubs/vector-icons.tsx'),
      // Deep-import react-native internals absent from react-native-web
      'react-native-safe-area-context': resolve(__dirname, 'stubs/safe-area-context.ts'),
      // Lazy-imported by services/analytics.ts (OfflineBanner chain)
      '@react-native-firebase/app': resolve(__dirname, 'stubs/firebase.ts'),
      '@react-native-firebase/analytics': resolve(__dirname, 'stubs/firebase.ts'),
      // Pulled transitively; its TS source needs react-native internals RNW lacks
      'expo-modules-core': resolve(__dirname, 'stubs/expo-modules-core.ts'),
      'react-native-razorpay': resolve(__dirname, 'stubs/razorpay.ts'),
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 6000,
    sourcemap: true,
  },
});
