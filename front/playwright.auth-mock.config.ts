import { defineConfig, devices } from '@playwright/test';

const frontendPort = Number(process.env.MARGINS_AUTH_MOCK_FRONTEND_PORT || '9614');
const baseURL = `http://127.0.0.1:${frontendPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'auth-registration-mock.spec.ts',
  timeout: 30_000,
  workers: 1,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
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
