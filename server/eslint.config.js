import globals from 'globals';
import pluginJs from '@eslint/js';
import vitest from '@vitest/eslint-plugin';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['node_modules/**', 'coverage/**', 'dist/**', 'library/**', 'download/**'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },
  pluginJs.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Server output goes through utils/logger.js so every line carries the
      // `[LEVEL] [Service]` prefix (§C11); bare console writes bypass that.
      'no-console': 'error',
      // Catch-clause bindings that shadow an imported logger silently turned
      // `logError(...)` into a call on the caught Error - see CHANGELOG.
      'no-shadow': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'multi-line'],
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'comma-dangle': ['error', 'always-multiline'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'arrow-spacing': ['error', { before: true, after: true }],
      'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
    },
  },
  {
    // The logger is the one sanctioned console sink.
    files: ['src/utils/logger.js'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['src/**/*.{test,spec}.{js,mjs}', 'src/test/**/*.{js,mjs}'],
    ...vitest.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...vitest.environments.env.globals,
      },
    },
  },
];
