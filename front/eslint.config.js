import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const featureNames = [
  'auth',
  'books',
  'reading-sessions',
  'reflections',
  'debates',
  'public-reviews',
  'memory-cards',
];

const featureZones = featureNames.map((feature) => ({
  target: `./src/features/${feature}`,
  from: './src/features',
  except: [`./${feature}`],
}));

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      import: importPlugin,
      'react-hooks': reactHooks,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'import/no-cycle': 'error',
      'import/no-restricted-paths': [
        'error',
        {
          basePath: '.',
          zones: [
            ...featureZones,
            {
              target: './src/features',
              from: './src/app',
            },
            {
              target: [
                './src/assets',
                './src/components',
                './src/config',
                './src/hooks',
                './src/lib',
                './src/styles',
                './src/testing',
                './src/types',
                './src/utils',
              ],
              from: ['./src/features', './src/app'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
