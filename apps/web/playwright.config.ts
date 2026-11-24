import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration for AssessFlow
 *
 * Ports / Environment Assumptions:
 * - API Port: 3000 (http://localhost:3000)
 * - Web Port: 5173 (http://localhost:5173, Vite)
 * - PostgreSQL Port: 5432 (real asses_db; Docker alt on 5433)
 * - Browser: Chromium only
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: [
    {
      command: 'node dist/main.js',
      cwd: '../api',
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
      timeout: 30_000,
      env: {
        ...process.env,
        PORT: '3000',
        NODE_ENV: 'test-memory',
        DATA_MODE: 'memory',
        DEV_AUTH_HEADERS: 'true',
        DATABASE_URL: 'postgresql://mock:mock@localhost:5432/mock?schema=public',
      },
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:5174',
      reuseExistingServer: true,
      timeout: 30_000,
      env: {
        ...process.env,
        DEV_API_TARGET: 'http://localhost:3000',
        VITE_API_URL: '/api/v1/assessflow',
        VITE_FEATURE_CALIBRATION: 'true',
      },
    },
  ],
});
