import { defineConfig, devices } from '@playwright/test';

// E2E_PORT lets several checkouts run the suite side by side.
const port = Number(process.env.E2E_PORT) || 4400;
// E2E_SERVER=preview runs the suite against the OpenNext build in workerd
// (`opennextjs-cloudflare preview`) instead of `next start`.
const preview = process.env.E2E_SERVER === 'preview';
// E2E_FIREFOX=1 adds a Firefox run of the desktop specs.
const firefox = process.env.E2E_FIREFOX === '1';

const desktop = { viewport: { width: 1440, height: 900 } };
const mobileSpecs = /\.mobile\.spec\.ts$/;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', testIgnore: mobileSpecs, use: { ...devices['Desktop Chrome'], ...desktop } },
    // Phone layout with real touch events (hasTouch, isMobile).
    { name: 'mobile', testMatch: mobileSpecs, use: { ...devices['Pixel 7'] } },
    ...(firefox ? [{ name: 'firefox', testIgnore: mobileSpecs, use: { ...devices['Desktop Firefox'], ...desktop } }] : []),
  ],
  webServer: {
    // Test the production build. No reuse: fail loudly instead of silently
    // testing some other app on this port.
    command: preview
      ? `pnpm exec opennextjs-cloudflare build && pnpm exec opennextjs-cloudflare preview --port ${port}`
      : `pnpm build && pnpm exec next start --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
