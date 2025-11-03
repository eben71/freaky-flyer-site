import js from '@eslint/js';
import astro from 'eslint-plugin-astro';

const browserGlobals = Object.fromEntries(
  [
    'window',
    'document',
    'navigator',
    'location',
    'localStorage',
    'sessionStorage',
    'fetch',
    'console',
    'self',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ].map((name) => [name, 'readonly'])
);

const jsRecommendedRules = js.configs.recommended.rules ?? {};

export default [
  {
    ignores: ['**/*.ts'],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: {
      ...jsRecommendedRules,
    },
  },
  ...astro.configs.recommended,
];
