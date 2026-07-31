import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
    exclude: ['node_modules', 'backend'],
    // 30s gives headroom for coverage instrumentation overhead (v8 provider
    // slows timer-dependent tests; 15s caused TenantConfigScreen timeouts)
    testTimeout: 30000,
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
        // Set slightly below current actual coverage (with buffer so runs don't
        // flake): Statements 49.5%, Branches 42.3%, Functions 43.8%, Lines 50.3%
        statements: 48,
        branches: 40,
        functions: 42,
        lines: 48,
      },
    },
  },
});
