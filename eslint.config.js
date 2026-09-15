const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', 'web-build/*'],
  },
  {
    rules: {
      // The app's UI text is Hebrew, where a plain " is standard punctuation
      // (e.g. abbreviations like סה"כ) — not an HTML-escaping concern.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
