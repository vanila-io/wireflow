import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    'build/',
    'test-results/',
    'playwright-report/',
    'blob-report/',
    // Vendored, minified iconfont.cn symbol script.
    'src/components/IconFont/iconfont.js',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Tooling configs and Playwright specs run in Node.
    files: ['*.config.js', 'e2e/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/service-worker.js'],
    languageOptions: { globals: globals.serviceworker },
  },
]);
