import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['node_modules'],
    testTimeout: 45000,
    reporters: ['verbose'],
    hookTimeout: 30000,
    teardownTimeout: 5000,
    // Integration tests share databases (MongoDB/PostgreSQL) and singletons
    // (riskEngine, auditTrail). File-level parallelism causes data races
    // where one file's clearForTesting() wipes data another file just wrote.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/types/**',
        '**/*.d.ts',
      ],
      thresholds: {
        statements: 40,
        branches: 36,
        functions: 35,
        lines: 40,
      },
    },
  },
});
