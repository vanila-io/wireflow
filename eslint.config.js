import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['build/', 'test-results/', 'playwright-report/', 'blob-report/']),
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
]);
