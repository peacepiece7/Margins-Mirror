import { expect, type Page, type TestInfo } from '@playwright/test';

export async function openStory(page: Page, info: TestInfo, id: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(new Date('2026-01-01T00:00:00Z'));
  const locale = info.project.name.startsWith('en-') ? 'en' : 'ko';
  await page.goto('/iframe.html?id=' + id + '&viewMode=story&globals=locale:' + locale);
  await expect(page.locator('[data-ui="storybook-canvas"]')).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('400 16px "Inter Variable"', 'Margins'),
      document.fonts.load('400 16px "Noto Sans KR Variable"', '여백의 기록'),
      document.fonts.load('400 32px "Newsreader Variable"', 'Between the lines'),
    ]);
  });
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}

export async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
