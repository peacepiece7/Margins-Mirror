import { defineConfig } from '@playwright/test';
import path from 'node:path';

const port = Number(process.env.MARGINS_STORYBOOK_PORT ?? 16913);
export default defineConfig({
  testDir: path.resolve(import.meta.dirname, '../tests/storybook'),
  outputDir:
    process.env.STORYBOOK_RESULTS_DIR ??
    path.resolve(import.meta.dirname, '../../.artifacts/storybook/results'),
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  updateSnapshots: 'none',
  fullyParallel: true,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 5_000, toHaveScreenshot: { animations: 'disabled', maxDiffPixels: 0 } },
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder:
          process.env.STORYBOOK_REPORT_DIR ??
          path.resolve(import.meta.dirname, '../../.artifacts/storybook/report'),
        open: 'never',
      },
    ],
  ],
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:' + port,
    contextOptions: { reducedMotion: 'reduce' },
    deviceScaleFactor: 1,
    timezoneId: 'UTC',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    ...[320, 390, 768, 1440].map((width) => ({
      name: 'ko-' + width,
      use: { viewport: { width, height: 900 }, hasTouch: width < 768, locale: 'ko-KR' },
    })),
    ...[320, 1440].map((width) => ({
      name: 'en-' + width,
      use: { viewport: { width, height: 900 }, hasTouch: width < 768, locale: 'en-US' },
    })),
  ],
  webServer: {
    command: 'node scripts/serve-storybook.mjs',
    cwd: path.resolve(import.meta.dirname, '..'),
    url: 'http://127.0.0.1:' + port + '/index.json',
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
