import { defineConfig, devices } from '@playwright/test';

const frontendPort = Number(process.env.MARGINS_CONTRAST_FRONTEND_PORT || '9615');
const baseURL = `http://127.0.0.1:${frontendPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'contrast-audit.spec.ts',
  timeout: 30_000,
  workers: 1,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'compact-320',
      use: {
        ...devices['Desktop Chrome'],
        contextOptions: { reducedMotion: 'reduce' },
        viewport: { height: 800, width: 320 },
      },
    },
    {
      name: 'desktop-1440',
      use: {
        ...devices['Desktop Chrome'],
        contextOptions: { reducedMotion: 'reduce' },
        viewport: { height: 900, width: 1440 },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${frontendPort}`,
    env: {
      ...process.env,
      MARGINS_BACKEND_URL: 'http://127.0.0.1:1',
      VITE_MARGINS_TURNSTILE_SITE_KEY: '',
    },
    reuseExistingServer: false,
    timeout: 30_000,
    url: baseURL,
  },
});
