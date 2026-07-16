import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
    exclude: ['node_modules', 'backend'],
    testTimeout: 15000,
    reporters: ['verbose'],
    server: {
      deps: {
        // Inline packages that have strict exports maps which Node.js can't resolve
        inline: ['date-fns', 'react-native-webview', '@react-navigation/native'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/__tests__/**',
        'src/types/**',
        'src/constants/**',
        'src/vitest.d.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        statements: 73,
        branches: 63,
        functions: 68,
        lines: 73,
      },
    },
  },
});
