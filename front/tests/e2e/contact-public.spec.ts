import { expect, test } from '@playwright/test';

// UI-only contact/challenge fixtures. No mail, live provider or persisted inquiry is created.
for (const width of [320, 1280]) {
  test(`public contact validates and retries without losing the draft at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      window.localStorage.setItem('margins.locale', 'en');
      window.localStorage.setItem('margins.app-download-notice.v1', 'dismissed');
      let callback: ((token: string) => void) | undefined;
      let sequence = 0;
      const issueToken = () => setTimeout(() => callback?.(`contact-ui-token-${sequence++}`), 0);
      (window as typeof window & { turnstile: unknown }).turnstile = {
        render: (_container: HTMLElement, options: { callback: (token: string) => void }) => {
          callback = options.callback;
          issueToken();
          return 'contact-ui-widget';
        },
        reset: issueToken,
        remove: () => undefined,
      };
    });
    const requests: unknown[] = [];
    let releaseFailure!: () => void;
    const failureGate = new Promise<void>((resolve) => {
      releaseFailure = resolve;
    });
    await page.route('**/api/contact-inquiries', async (route) => {
      requests.push(route.request().postDataJSON());
      if (requests.length === 1) {
        await failureGate;
        await route.fulfill({
          status: 502,
          json: {
            success: false,
            data: null,
            error: {
              code: 'CONTACT_INQUIRY_DELIVERY_FAILED',
              fields: [],
              requestId: 'contact-ui-failure',
            },
          },
        });
      } else {
        await route.fulfill({
          status: 200,
          json: {
            success: true,
            data: { inquiryId: 42, status: 'OPEN', createdAt: '2026-10-10T00:00:00Z' },
            error: null,
          },
        });
      }
    });

    await page.goto('/contact');
    await expect(page.getByRole('heading', { name: 'Contact Margins' })).toBeVisible();
    await page.getByTestId('contact-submit').click();
    await expect(page.locator('#contact-email-error')).toBeVisible();
    await expect(page.getByLabel('Reply email')).toHaveAttribute(
      'aria-describedby',
      'contact-email-error',
    );
    expect(requests).toHaveLength(0);
    const emailBox = await page.getByLabel('Reply email').boundingBox();
    const categoryBox = await page.getByLabel('Category').boundingBox();
    expect(categoryBox?.height).toBe(emailBox?.height);

    await page.getByLabel('Reply email').fill('Reader@example.test');
    await page.getByLabel('Category').selectOption('BUG_REPORT');
    await page.getByLabel('Subject').fill(' Broken page ');
    await page.getByLabel('Message').fill(' My draft message. ');
    const challengeStatus = page.getByTestId('contact-bot-challenge-status');
    if (await challengeStatus.count())
      await expect(challengeStatus).toHaveText('Bot check complete.');
    await page.getByTestId('contact-submit').click();
    await expect.poll(() => requests.length).toBe(1);
    await expect(page.getByTestId('contact-submit')).toBeDisabled();
    releaseFailure();
    await expect(page.getByTestId('contact-error')).toBeVisible();
    await expect(page.getByLabel('Subject')).toHaveValue(' Broken page ');
    await expect(page.getByLabel('Message')).toHaveValue(' My draft message. ');
    await expect(page.getByTestId('contact-submit')).toBeEnabled();
    if (await challengeStatus.count())
      await expect(challengeStatus).toHaveText('Bot check complete.');

    await page.getByTestId('contact-submit').click();
    await expect(page.getByTestId('contact-success')).toContainText('Reference #42');
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(
      expect.objectContaining({
        email: 'reader@example.test',
        category: 'BUG_REPORT',
        subject: 'Broken page',
        message: 'My draft message.',
      }),
    );
    await expect(page.getByLabel('Reply email')).toHaveValue('Reader@example.test');
    await expect(page.getByLabel('Category')).toHaveValue('BUG_REPORT');
    await expect(page.getByLabel('Subject')).toHaveValue('');
    await expect(page.getByLabel('Message')).toHaveValue('');
    await page.getByRole('button', { name: 'KO', exact: true }).click();
    await expect(page.getByTestId('contact-success')).toContainText('접수 번호 #42');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
