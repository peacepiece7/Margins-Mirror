const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist-test/**'],
    rules: {
      'import/no-cycle': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
]);
