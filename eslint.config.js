// eslint.config.js
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

export default [
  js.configs.recommended,
  ...pluginAstro.configs['flat/recommended'],
  {
    files: ['**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
  },
  ...astro.configs.recommended,
];
