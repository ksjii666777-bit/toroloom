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
  },
});
