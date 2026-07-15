/**
 * ============================================================================
 * Toroloom Frontend — ESLint Flat Config
 * ============================================================================
 *
 * ESLint v9 flat config with TypeScript support for Expo/React Native.
 *
 * ============================================================================
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    ignores: ['node_modules', 'coverage', 'dist', 'backend', 'android', 'ios', '.expo'],
  },
  {
    rules: {
      // Allow unused vars with underscore prefix (_foo, _bar)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      // Allow explicit any (longstanding usage in the codebase)
      '@typescript-eslint/no-explicit-any': 'off',
      // Prefer const over let when variable is never reassigned (warn, not error)
      'prefer-const': 'warn',
      // Allow require() statements (some config files use CommonJS)
      '@typescript-eslint/no-require-imports': 'off',
      // Allow `Function` type in test files (pragmatic for mocks)
      '@typescript-eslint/no-unsafe-function-type': 'off',
      // Allow namespaces (used in some declaration patterns)
      '@typescript-eslint/no-namespace': 'off',
      // Unnecessary escape characters — warn but don't block
      'no-useless-escape': 'warn',
      // Warn about unreachable code but don't block
      'no-unreachable': 'warn',
      // Allow empty catch blocks in some cases
      'no-empty': 'warn',
    },
  },
];
