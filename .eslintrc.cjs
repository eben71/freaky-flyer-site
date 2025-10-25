module.exports = {
  root: true,
  extends: ['@astrojs/eslint-config', 'plugin:astro/jsx-a11y-strict'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  env: {
    browser: true,
    es2021: true
  },
  ignorePatterns: ['dist/'],
  rules: {
    'astro/no-set-html-directive': 'off'
  }
};
