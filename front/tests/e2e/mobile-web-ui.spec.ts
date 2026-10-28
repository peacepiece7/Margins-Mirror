import { expect, test } from '@playwright/test';

// UI-only fixtures: no shared backend data or live providers are used.
test.use({ isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('margins.app-download-notice.v1', 'dismissed');
  });
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path === '/api/auth/refresh'
        ? {
            userId: 1,
            username: 'reader',
            displayName: 'Reader',
            preferredLocale: 'en',
            membershipTier: 'PREMIUM',
            authMode: 'local',
            accessToken: 'ui-fixture',
            accessTokenExpiresInSeconds: 3600,
          }
        : path === '/api/catalog/capabilities'
          ? { operator: false }
          : path === '/api/library/threads'
            ? {
                threads: [
                  {
                    book: {
                      bookId: 1,
                      title: 'Mobile focus fixture',
                      author: 'Reader',
                      readingStatus: 'reading',
                    },
                    recentRevisions: [],
                    version: 1,
                  },
                ],
              }
            : path === '/api/books'
              ? { books: [], nextCursor: null }
              : path === '/api/developer/reflection-drafts'
                ? { content: 'QA generated reflection', model: 'gpt-6-luna', personas: [] }
                : null;
    await route.fulfill({ json: { success: true, data, error: null } });
  });
});

test('mobile locale and account controls fit inside GNB and focused inputs are not clipped', async ({
  page,
}, testInfo) => {
  await page.goto('/book/discover');
  await expect(page.getByTestId('book-search-input')).toBeVisible();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const locale of ['ko', 'en']) {
      await page.getByTestId('language-toggle').click();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      const metrics = await page.locator('.web-global-nav').evaluate((nav) => {
        const bounds = nav.getBoundingClientRect();
        const brand = document.querySelector('.web-app-wordmark')!.getBoundingClientRect();
        return {
          coarse: matchMedia('(pointer: coarse)').matches,
          overflow: document.documentElement.scrollWidth > innerWidth,
          controls: Array.from(
            nav.querySelectorAll('.web-global-actions [data-slot="button"]'),
          ).map((control) => {
            const rect = control.getBoundingClientRect();
            return {
              contained:
                rect.left >= bounds.left &&
                rect.right <= bounds.right &&
                rect.top >= bounds.top &&
                rect.bottom <= bounds.bottom,
              width: rect.width,
              height: rect.height,
              overlapsBrand:
                rect.left < brand.right &&
                rect.right > brand.left &&
                rect.top < brand.bottom &&
                rect.bottom > brand.top,
            };
          }),
        };
      });
      expect(metrics.coarse).toBe(true);
      expect(metrics.overflow).toBe(false);
      expect(metrics.controls).toHaveLength(4);
      for (const control of metrics.controls) {
        expect(control.contained).toBe(true);
        expect(control.overlapsBrand).toBe(false);
        expect(control.width).toBeGreaterThanOrEqual(44);
        expect(control.height).toBeGreaterThanOrEqual(44);
      }
    }
    const input = page.getByTestId('book-search-input');
    const scale = await page.evaluate(() => visualViewport!.scale);
    await input.tap();
    await expect(input).toBeFocused();
    await expect(input).toHaveCSS('font-size', '16px');
    expect(await page.evaluate(() => visualViewport!.scale)).toBe(scale);
    await expect(input).toHaveCSS('outline-offset', '-2px');
    expect(await input.evaluate((element) => getComputedStyle(element).boxShadow)).toContain(
      'inset',
    );
  }
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByTestId('book-search-input').focus();
    await page.screenshot({ path: testInfo.outputPath(`gnb-focus-${width}.png`), fullPage: true });
  }
});

test('mobile Write Reflection shows the QA action and fills only an unsaved draft', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/book/1/review/new');
  const textarea = page.locator(
    '[data-testid="reflection-content-textarea"], [data-testid="primary-reflection-content"]',
  );
  await expect(textarea).toBeVisible();
  await textarea.fill('My current reflection');
  const scale = await page.evaluate(() => visualViewport!.scale);
  await textarea.tap();
  await expect(textarea).toBeFocused();
  await expect(textarea).toHaveCSS('font-size', '16px');
  expect(await page.evaluate(() => visualViewport!.scale)).toBe(scale);
  await expect(textarea).toHaveCSS('outline-offset', '-2px');
  const url = page.url();
  const writes: string[] = [];
  page.on('request', (request) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()))
      writes.push(new URL(request.url()).pathname);
  });
  const generated = page.waitForRequest('**/api/developer/reflection-drafts');
  await page.getByTestId('developer-draft-generate').click();
  expect((await generated).postDataJSON()).toMatchObject({
    bookId: 1,
    context: 'My current reflection',
    target: 'PRIMARY_REFLECTION',
  });
  await expect(textarea).toHaveValue('QA generated reflection');
  expect(writes).toEqual(['/api/developer/reflection-drafts']);
  await expect(page).toHaveURL(url);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await textarea.focus();
  await page.screenshot({
    path: testInfo.outputPath('reflection-draft-focus-320.png'),
    fullPage: true,
  });
});

test('native mobile pickers stay readable in portrait and landscape without disabling zoom', async ({
  page,
}) => {
  await page.goto('/book/library');
  const picker = page.getByTestId('book-shelf-sort');
  await expect(picker).toBeVisible();
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    'width=device-width, initial-scale=1.0',
  );
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(picker).toHaveCSS('font-size', '16px');
    await expect(picker).toHaveCSS('touch-action', 'manipulation');
    const scale = await page.evaluate(() => visualViewport!.scale);
    await picker.focus();
    await expect(picker).toBeFocused();
    await picker.selectOption('title_asc');
    await expect(picker).toHaveValue('title_asc');
    expect(await page.evaluate(() => visualViewport!.scale)).toBe(scale);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  }
});

test.describe('fine-pointer field typography', () => {
  test.use({ isMobile: false, hasTouch: false });

  test('small screens keep the font floor and desktop keeps compact controls', async ({ page }) => {
    await page.goto('/book/library');
    const picker = page.getByTestId('book-shelf-sort');
    await expect(picker).toBeVisible();
    for (const width of [320, 390, 767, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(false);
      await expect(picker).toHaveCSS('font-size', width < 768 ? '16px' : '14px');
    }
  });
});
