import { defineConfig, devices } from '@playwright/test';

const baseURL =
  process.env.MARGINS_FRONT_URL ||
  `http://localhost:${process.env.MARGINS_FRONTEND_PORT || '9613'}`;

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['auth-registration-mock.spec.ts', 'contrast-audit.spec.ts'],
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 10_000,
  },
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
});
