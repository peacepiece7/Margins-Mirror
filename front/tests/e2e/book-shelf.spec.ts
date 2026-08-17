import { expect, test, type Locator, type Page } from '@playwright/test';

test.setTimeout(60000);

const backendUrl = process.env.MARGINS_BACKEND_URL || 'http://localhost:8080';
const e2eUsername = process.env.MARGINS_E2E_USERNAME || 'demo_reader';
const e2ePassword = process.env.MARGINS_E2E_PASSWORD || 'reader';

async function login(page: Page) {
  await expect(page.getByTestId('login-form')).toBeVisible();
  await page.getByTestId('login-username-input').fill(e2eUsername);
  await page.getByTestId('login-password-input').fill(e2ePassword);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('book-list-page')).toBeVisible();
  await expect(page).toHaveURL(/\/book\/library$/);
  await page.getByTestId('portal-nav-book-search').click();
  await expect(page.getByTestId('reading-portal')).toBeVisible();
}

async function addManualBook(page: Page, title: string, author: string) {
  await page.getByTestId('portal-nav-book-search').click();
  await expect(page).toHaveURL(/\/book\/discover$/);
  await expect(page.getByTestId('book-search-page')).toBeVisible();
  await page.getByTestId('manual-book-title-input').fill(title);
  await page.getByTestId('manual-book-author-input').fill(author);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/books') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('manual-book-submit').click(),
  ]);
  await page.getByTestId('portal-nav-book-list').click();
  await expect(page.getByTestId('book-list-page')).toBeVisible();
}

async function selectBookStatus(page: Page, row: Locator, optionName: string) {
  await row.getByRole('combobox').click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

test.beforeEach(async ({ request }) => {
  const response = await request.post(`${backendUrl}/api/test/reset`);
  expect(response.ok()).toBeTruthy();
});

test('filters, sorts, and keeps the selected book visible across shelf views', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await expect(page).toHaveURL(/\/book\/discover$/);

  await addManualBook(page, 'Alpha Shelf Book', 'Author A');
  await addManualBook(page, 'Zulu Shelf Book', 'Author Z');
  await expect(page).toHaveURL(/\/book\/library$/);

  const alphaRow = page.getByTestId('saved-book-row').filter({ hasText: 'Alpha Shelf Book' });
  const zuluRow = page.getByTestId('saved-book-row').filter({ hasText: 'Zulu Shelf Book' });

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/books/') &&
        response.url().endsWith('/shelf') &&
        response.request().method() === 'PATCH',
    ),
    selectBookStatus(page, alphaRow, 'Currently reading'),
  ]);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/books/') &&
        response.url().endsWith('/shelf') &&
        response.request().method() === 'PATCH',
    ),
    selectBookStatus(page, zuluRow, 'Read'),
  ]);

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/books?') &&
        response.url().includes('status=reading') &&
        response.request().method() === 'GET',
    ),
    page.getByTestId('book-shelf-filter').selectOption('reading'),
  ]);
  // The local E2E database may contain non-test books that the reset endpoint must preserve.
  await expect(page.getByTestId('book-list-page')).toContainText('Alpha Shelf Book');
  await expect(page.getByTestId('book-list-page')).not.toContainText('Zulu Shelf Book');

  await alphaRow.getByTestId('saved-book-detail-link').click();
  await expect(page.getByTestId('book-detail-page')).toBeVisible();
  await expect(page).toHaveURL(/\/book\/\d+$/);
  await expect(page.getByTestId('current-book-summary')).toContainText('Alpha Shelf Book');

  await page.goBack();
  await expect(page.getByTestId('book-list-page')).toBeVisible();
  await expect(page).toHaveURL(/\/book\/library$/);

  await alphaRow.getByTestId('saved-book-detail-link').click();
  await expect(page.getByTestId('book-detail-page')).toBeVisible();
  await page.getByTestId('portal-nav-book-list').click();
  await expect(page).toHaveURL(/\/book\/library$/);
  await expect(page.getByTestId('book-shelf-filter')).toHaveValue('reading');
  await expect(page.getByTestId('current-book-summary')).toContainText('Alpha Shelf Book');

  await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes('/api/books') && response.request().method() === 'GET',
    ),
    page.getByTestId('book-shelf-filter').selectOption('all'),
  ]);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/books') &&
        response.url().includes('sort=title_asc') &&
        response.request().method() === 'GET',
    ),
    page.getByTestId('book-shelf-sort').selectOption('title_asc'),
  ]);

  await expect
    .poll(async () => {
      const visibleTitles = await page.getByTestId('saved-book-detail-link').allTextContents();
      return visibleTitles[0] || '';
    })
    .toContain('Alpha Shelf Book');
});
