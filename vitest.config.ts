import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
    exclude: ['node_modules', 'backend'],
    testTimeout: 10000,
    reporters: ['verbose'],
    server: {
      deps: {
        // Inline date-fns so vitest can resolve it
        inline: ['date-fns'],
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
        statements: 55,
        branches: 40,
        functions: 50,
        lines: 55,
      },
    },
  },
});
