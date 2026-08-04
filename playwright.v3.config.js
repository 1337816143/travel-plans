import process from 'node:process';

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-v3',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-v3', open: 'never' }]],
  outputDir: 'test-results-v3',
  use: {
    baseURL: 'http://127.0.0.1:4174/v3/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 430, height: 932 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run preview:pages:v3',
    url: 'http://127.0.0.1:4174/v3/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
