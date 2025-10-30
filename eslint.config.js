// eslint.config.js
import js from '@eslint/js';
import pluginAstro from 'eslint-plugin-astro';

export default [
  js.configs.recommended,
  ...pluginAstro.configs['flat/recommended'],
  {
    rules: {
      // Add any project-specific rules here
    },
  },
];
