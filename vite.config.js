import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Netlify, Cloudflare Workers (wrangler.jsonc) and the Dockerfile publish this directory.
    outDir: 'build',
  },
  test: {
    // Playwright specs live in e2e/ and must not be collected by Vitest.
    include: ['src/**/*.test.{js,jsx}'],
  },
});
