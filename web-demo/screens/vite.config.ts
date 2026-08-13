/**
 * ============================================================================
 * Toroloom — Migrated Screens Harness (Vite config)
 * ============================================================================
 *
 * Standalone browser harness that renders REAL migrated screens (AppScreen
 * based) so layout can be verified without booting the native app. Reuses the
 * exact same module stubs as the i18n demo (web-demo/stubs) so native-only
 * modules (reanimated, haptics, vector-icons, safe-area, navigation) resolve
 * on web.
 *
 * Run:
 *   npx vite build --config web-demo/screens/vite.config.ts
 *   npx vite preview --config web-demo/screens/vite.config.ts --port 4176
 * ============================================================================
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  resolve: {
    extensions: ['.mjs', '.web.js', '.web.ts', '.web.tsx', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    alias: {
      'react-native': 'react-native-web',
      'react-native-reanimated': resolve(__dirname, '../stubs/reanimated.ts'),
      'expo-haptics': resolve(__dirname, '../stubs/expo-haptics.ts'),
      '@expo/vector-icons': resolve(__dirname, '../stubs/vector-icons.tsx'),
      'react-native-safe-area-context': resolve(__dirname, '../stubs/safe-area-context.ts'),
      '@react-native-firebase/app': resolve(__dirname, '../stubs/firebase.ts'),
      '@react-native-firebase/analytics': resolve(__dirname, '../stubs/firebase.ts'),
      'expo-modules-core': resolve(__dirname, '../stubs/expo-modules-core.ts'),
      'react-native-razorpay': resolve(__dirname, '../stubs/razorpay.ts'),
      '@react-navigation/native': resolve(__dirname, '../stubs/react-navigation.ts'),
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 6000,
    sourcemap: true,
  },
});
