import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    // Force all files to run in the SAME fork process so the riskEngine
    // singleton is shared across test files. This is required to verify
    // that resetForTesting() properly isolates state between files.
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
