import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: 2,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.CI ? undefined : {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: true,
  },
});
