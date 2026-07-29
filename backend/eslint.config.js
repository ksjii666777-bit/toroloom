/**
 * ============================================================================
 * Toroloom Backend — ESLint Flat Config
 * ============================================================================
 *
 * ESLint v9 flat config with TypeScript support for backend source code.
 *
 * ============================================================================
 */

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['node_modules', 'dist', 'coverage'],
  },
  {
    rules: {
      // Allow unused vars with underscore prefix (_foo, _bar)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Allow require() statements (backend uses CommonJS)
      '@typescript-eslint/no-require-imports': 'off',
      // Allow explicit any (longstanding usage in the codebase)
      '@typescript-eslint/no-explicit-any': 'off',
      // Prefer const over let when variable is never reassigned (warn, not error)
      'prefer-const': 'warn',
      // Allow `Function` type in test files (pragmatic for mocks)
      '@typescript-eslint/no-unsafe-function-type': 'off',
      // Allow namespaces (used in some declaration patterns)
      '@typescript-eslint/no-namespace': 'off',
      // Allow caught errors to be re-thrown without cause
      'preserve-caught-error': 'off',
      // Unnecessary escape characters — warn but don't block
      'no-useless-escape': 'warn',
      // Unused assignments — warn but don't block
      'no-useless-assignment': 'warn',
    },
  },
  // Test files: disable no-unused-vars entirely — test code frequently destructures
  // values for assertions (e.g. `const { status, body } = await request(...)`)
  // and imports types/helpers that are used across describe/it blocks.
  {
    files: ['src/__tests__/**', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
