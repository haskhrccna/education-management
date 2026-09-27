// Minimal starting-point config. This repo's real lint/typecheck gate is
// lint-staged.config.js (prettier + tsc --noEmit) — this file exists only so
// tooling that expects a root eslint.config.js (ESLint 9 flat config) has one
// to find, without imposing a new, unreviewed rule set on the existing
// codebase. No rules are enabled; add them deliberately when the team wants
// ESLint to actually enforce something here.
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/build/**',
      'mobile/**', // has its own eslint.config.js (Expo)
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {},
  },
];
