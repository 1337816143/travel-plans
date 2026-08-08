import { defineConfig, devices } from '@playwright/test';

const androidUA =
  'Mozilla/5.0 (Linux; Android 16; Xiaomi 17 Pro Max) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Mobile Safari/537.36';
const iphoneUA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 20_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/20.0 Mobile/15E148 Safari/604.1';

export default defineConfig({
  testDir: './tests-v255',
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-v255', open: 'never' }]],
  outputDir: 'test-results-v255',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/build-v2.5.5.mjs && python3 -m http.server 4175 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4175/index.html',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'desktop-1080p-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'xiaomi17-promax-portrait-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: androidUA,
      },
    },
    {
      name: 'iphone17-promax-portrait-webkit',
      use: {
        browserName: 'webkit',
        viewport: { width: 440, height: 956 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: iphoneUA,
      },
    },
    {
      name: 'iphone17-promax-landscape-webkit',
      use: {
        browserName: 'webkit',
        viewport: { width: 956, height: 440 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: iphoneUA,
      },
    },
  ],
});
