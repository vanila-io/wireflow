import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Offline support: builds src/service-worker.js into build/service-worker.js
    // with the list of build files to precache. Off under `pnpm dev`.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.js',
      // src/components/UpdatePrompt registers the worker and asks before updating.
      registerType: 'prompt',
      injectRegister: false,
      // public/manifest.json is the web app manifest; index.html links it.
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{html,js,css,svg,png,ico,json,txt}'],
      },
    }),
  ],
  build: {
    // Cloudflare Workers (wrangler.jsonc) and the Dockerfile publish this directory.
    outDir: 'build',
  },
  test: {
    // Playwright specs live in e2e/ and must not be collected by Vitest.
    include: ['src/**/*.test.{js,jsx}'],
  },
});
