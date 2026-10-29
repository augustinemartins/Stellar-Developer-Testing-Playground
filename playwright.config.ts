import { defineConfig, devices } from "@playwright/test";

/** Browser tests against a production build. They hit testnet, so they are opt-in: `pnpm test:e2e`. */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Phone-sized viewport with touch, using Chromium so CI only needs one browser.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm --filter @playground/web start -p 3100", url: "http://localhost:3100", reuseExistingServer: true, timeout: 120_000 },
});
