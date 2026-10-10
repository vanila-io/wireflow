import { defineConfig, devices } from "@playwright/test";

// E2E_PORT lets several checkouts run the suite side by side.
const port = Number(process.env.E2E_PORT) || 4410;
// E2E_SERVER=preview runs the suite against the OpenNext build in workerd
// (`opennextjs-cloudflare preview`) instead of `next start`.
const preview = process.env.E2E_SERVER === "preview";
// E2E_BASE_URL runs the suite against a server that is already running (for
// example a build of an older commit, to check that a test fails without its fix).
const external = process.env.E2E_BASE_URL;

const desktop = { viewport: { width: 1440, height: 900 } };
const mobileSpecs = /\.mobile\.spec\.ts$/;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: external ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", testIgnore: mobileSpecs, use: { ...devices["Desktop Chrome"], ...desktop } },
    // A phone with real touch events (hasTouch, isMobile).
    { name: "mobile", testMatch: mobileSpecs, use: { ...devices["Pixel 7"] } },
  ],
  webServer: external
    ? undefined
    : {
        // The production build. No reuse: fail loudly instead of silently testing
        // some other app on this port. E2E_SKIP_BUILD=1 reuses an existing build.
        command: preview
          ? `npx opennextjs-cloudflare build && npx opennextjs-cloudflare preview --port ${port}`
          : `${process.env.E2E_SKIP_BUILD ? "" : "npm run build && "}npx next start --port ${port}`,
        url: `http://localhost:${port}`,
        reuseExistingServer: false,
        timeout: 300_000,
      },
});
