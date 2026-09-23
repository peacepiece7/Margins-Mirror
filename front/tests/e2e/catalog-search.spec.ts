import { test, expect } from '@playwright/test';

const backend = process.env.MARGINS_BACKEND_URL || 'http://localhost:8080';
test.beforeEach(async ({ request }) => {
  expect((await request.post(backend + '/api/test/reset')).ok()).toBeTruthy();
});
test('keyword collection, 30-day reuse, trusted save, responsive UI and operator visibility', async ({
  page,
}) => {
  await page.goto('/login');
  await page
    .getByTestId('login-username-input')
    .fill(process.env.MARGINS_E2E_USERNAME || 'peacepiece');
  await page.getByTestId('login-password-input').fill(process.env.MARGINS_E2E_PASSWORD || 'reader');
  await page.getByTestId('login-submit').click();
  await page.getByTestId('nav-discover').click();
  await expect(page.getByTestId('book-candidate-card')).toHaveCount(0);
  await page.getByTestId('language-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(requestAnimationFrame);
  });
  const fieldSelect = page.getByTestId('book-search-field-select');
  await expect(fieldSelect).toHaveAttribute('data-slot', 'select-trigger');
  const relativeFilterTop = (element: HTMLElement) => {
    const form = element.closest('form');
    if (!form) throw new Error('Catalog filter must remain inside its form.');
    return element.getBoundingClientRect().top - form.getBoundingClientRect().top;
  };
  const filterTopBeforeError = await fieldSelect.evaluate(relativeFilterTop);
  await page.getByTestId('book-search-input').fill('x'.repeat(201));
  await page.getByTestId('book-search-submit').click();
  await expect(page.getByRole('alert')).toHaveText(
    '1~200자의 검색어를 입력하세요. ISBN 검색은 유효한 ISBN을 입력해 주세요.',
  );
  const filterTopAfterError = await fieldSelect.evaluate(relativeFilterTop);
  expect(filterTopAfterError).toBe(filterTopBeforeError);
  await fieldSelect.click();
  const selectContent = page.locator('[data-slot="select-content"]');
  await expect(selectContent).toBeVisible();
  expect(await selectContent.evaluate((element) => getComputedStyle(element).zIndex)).toBe('50');
  await page.keyboard.press('Escape');
  await page.getByTestId('language-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByTestId('book-search-input').fill('Dune');
  await page.getByTestId('book-search-submit').click();
  await expect(page.getByTestId('book-candidate-title')).toHaveText('Dune', { timeout: 20000 });
  await expect(page.getByTestId('book-candidate-id')).toHaveCount(0);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
  }
  const second = page.waitForResponse(
    (r) => r.url().endsWith('/api/catalog/search') && r.request().method() === 'POST',
  );
  await page.getByTestId('book-search-submit').click();
  const cached = (await (await second).json()).data;
  expect(cached.collection.generation).toBe(1);
  expect(cached.freshness).toBe('FRESH');
  const save = page.waitForRequest((r) => r.url().endsWith('/api/books/from-catalog'));
  await page.getByTestId('book-candidate-save').click();
  expect(Object.keys((await save).postDataJSON())).toEqual(['catalogBookId']);
  await expect(page).toHaveURL(/\/book\/library$/);
  await expect(page.getByTestId('book-list-page')).toContainText('Dune');
  await page.getByTestId('nav-discover').click();
  await page.getByRole('link', { name: 'Catalog operations', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cover storage' })).toBeVisible();
  await expect(page.getByText(/0.000 \/ 10 GB/)).toBeVisible();
  await page.getByTestId('nav-discover').click();
  await page.getByTestId('book-search-input').fill('missing fixture');
  await page.getByTestId('book-search-submit').click();
  await expect(
    page.getByText('No matching editions. Try another keyword or change the filters.'),
  ).toBeVisible({ timeout: 15000 });
});
