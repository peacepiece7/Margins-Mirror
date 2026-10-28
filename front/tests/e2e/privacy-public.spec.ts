import { expect, test } from '@playwright/test';

test('shows public privacy policy and history on a mobile viewport', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('margins.app-download-notice.v1', 'dismissed');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/privacy');

  await expect(page.locator('[data-privacy-page]')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Privacy Policy|개인정보처리방침/ }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole('link', { name: /history|이력/i }).click();
  await expect(page).toHaveURL(/\/privacy\/history$/);
  await expect(page.locator('[data-privacy-history-page]')).toBeVisible();
  await expect(page.getByText('2026-07-27', { exact: true })).toBeVisible();
});

test('keeps consent checkboxes square instead of stretching to the label height', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('margins.app-download-notice.v1', 'dismissed');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/consent?registration=google');

  const checkboxes = page.getByRole('checkbox');
  await expect(checkboxes).toHaveCount(3);

  for (const checkbox of await checkboxes.all()) {
    await expect(checkbox).toBeVisible();
    const box = await checkbox.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBe(16);
    expect(box?.height).toBe(16);
  }
});
