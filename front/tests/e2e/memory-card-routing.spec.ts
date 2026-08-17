import { expect, test, type Page } from '@playwright/test';

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
}

test.beforeEach(async ({ request }) => {
  const response = await request.post(`${backendUrl}/api/test/reset`);
  expect(response.ok()).toBeTruthy();
});

test('restores memory-card study mode from a direct URL', async ({ page }) => {
  await page.goto('/');
  await login(page);

  await page.getByTestId('nav-memory-card').click();
  await expect(page).toHaveURL(/\/memory-card\/groups$/);

  await page.getByLabel('Group name').fill('Route Vocabulary');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/memory-card-groups') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('memory-card-group-form').getByRole('button', { name: 'Save' }).click(),
  ]);
  await expect(page).toHaveURL(/\/memory-card\/groups\/\d+$/);
  const groupUrl = page.url();
  const groupId = groupUrl.match(/\/memory-card\/groups\/(\d+)$/)?.[1];
  expect(groupId).toBeTruthy();

  await page.getByLabel('English front').fill('wand');
  await page.getByLabel('Meaning').fill('지팡이');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/api/memory-card-groups/${groupId}/cards`) &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('memory-card-card-form').getByRole('button', { name: 'Add' }).click(),
  ]);
  await expect(page.getByTestId('memory-card-card-row')).toContainText('wand');

  await page.getByTestId('memory-card-study-start').click();
  await expect(page).toHaveURL(new RegExp(`/memory-card/groups/${groupId}/study$`));
  await expect(page.getByText('wand')).toBeVisible();
  await expect(page.getByText('The meaning is hidden.')).toBeVisible();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/memory-cards/') &&
        response.url().endsWith('/memorized') &&
        response.request().method() === 'PATCH' &&
        response.status() === 200,
    ),
    page.getByTestId('memory-card-study-memorized-toggle').click(),
  ]);
  await expect(page.getByTestId('memory-card-study-memorized-toggle')).toBeChecked();
  await expect(page.getByTestId('memory-card-study-progress')).toContainText('1/1 memorized');

  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/memory-card/groups/${groupId}/study$`));
  await expect(page.getByText('wand')).toBeVisible();
  await expect(page.getByText('The meaning is hidden.')).toBeVisible();
  await expect(page.getByTestId('memory-card-study-memorized-toggle')).toBeChecked();

  await page.getByRole('button', { name: 'Back to group' }).click();
  await expect(page.getByTestId('memory-card-memorized-toggle')).toBeChecked();
});
