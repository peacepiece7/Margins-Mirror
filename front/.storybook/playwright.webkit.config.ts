import { defineConfig } from '@playwright/test';

import base from './playwright.config';

export default defineConfig({
  ...base,
  projects: [320, 390, 1440].map((width) => ({
    name: `ko-${width}-webkit`,
    use: {
      browserName: 'webkit',
      viewport: { width, height: 900 },
      hasTouch: width < 768,
      locale: 'ko-KR',
    },
  })),
});
