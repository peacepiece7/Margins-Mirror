import { expect, test } from '@playwright/test';

// BDD: TERM-021
test('keeps the unpublished Terms and history public at mobile width', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/terms');

  await expect(page.locator('[data-service-terms-page]')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: /Service Terms|서비스 이용약관/ }),
  ).toBeVisible();
  await expect(
    page.getByText(/No version is published yet|아직 게시된 버전이 없습니다/),
  ).toBeVisible();
  await expect(page.getByTestId('app-download-notice')).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page
    .getByRole('link', { name: /Service Terms history|서비스 이용약관 변경 이력/i })
    .click();
  await expect(page).toHaveURL(/\/terms\/history$/);
  await expect(page.locator('[data-service-terms-history-page]')).toBeVisible();
  await expect(
    page.getByText(/There are no published versions|게시된 버전이 없습니다/),
  ).toBeVisible();
  await expect(page.getByTestId('app-download-notice')).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test('links the pending Terms page to Privacy and contact', async ({ page }) => {
  await page.goto('/terms');

  await expect(page.getByRole('link', { name: /Privacy Policy|개인정보처리방침/ })).toHaveAttribute(
    'href',
    '/privacy',
  );
  await expect(page.getByRole('link', { name: /Contact|문의하기/ })).toHaveAttribute(
    'href',
    '/contact',
  );
});
