import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The teammate's agent tooling (vendored skills and scripts), not app code.
    ".agents/**",
    ".box-internal/**",
    // Test output.
    "playwright-report/**",
    "test-results/**",
    // Build output: the OpenNext Worker, wrangler's local state, the offline worker.
    ".open-next/**",
    ".wrangler/**",
    "public/sw.js",
  ]),
]);

export default eslintConfig;
