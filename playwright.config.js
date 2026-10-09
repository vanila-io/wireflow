import { defineConfig, devices } from '@playwright/test';

// E2E_PORT lets several checkouts run the suite side by side.
const port = Number(process.env.E2E_PORT) || 4179;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // The editor layout is desktop-only (fixed sidebar + 19/5 column grid).
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    // Test the production bundle, not the dev server. strictPort + no reuse:
    // fail loudly instead of silently testing some other app on this port.
    command: `pnpm build && pnpm preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
