import { expect, test, type Locator } from '@playwright/test';

test('completes signup and keeps the consent panel readable with browser-only API mocks', async ({
  page,
}) => {
  const unexpectedRequests: string[] = [];
  await page.addInitScript(() => {
    window.localStorage.setItem('margins.app-download-notice.v1', 'dismissed');
    window.localStorage.setItem('margins.locale', 'ko');
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    const key = `${request.method()} ${url.pathname}`;
    const success = (data: unknown) =>
      route.fulfill({ json: { data, error: null, success: true } });

    if (key === 'POST /api/auth/refresh') {
      await route.fulfill({
        status: 401,
        json: { data: null, error: { code: 'AUTH_UNAUTHORIZED', fields: [] }, success: false },
      });
    } else if (key === 'GET /api/auth/email-availability') {
      await success({ email: url.searchParams.get('email'), available: true });
    } else if (key === 'POST /api/auth/email-verifications') {
      const { email } = request.postDataJSON() as { email: string };
      await success({
        email,
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
        devVerificationCode: '123456',
      });
    } else if (key === 'POST /api/auth/email-verifications/confirm') {
      const { email } = request.postDataJSON() as { email: string };
      await success({ email, verified: true });
    } else if (key === 'POST /api/auth/registration-intents') {
      await success(null);
    } else if (key === 'POST /api/auth/register') {
      const { displayName, preferredLocale, username } = request.postDataJSON() as {
        displayName: string;
        preferredLocale: 'ko' | 'en';
        username: string;
      };
      await success({
        accessToken: 'browser-only-auth-mock',
        accessTokenExpiresInSeconds: 3600,
        authMode: 'local',
        consentRequired: false,
        displayName,
        membershipTier: 'FREE',
        preferredLocale,
        userId: 9001,
        username,
      });
    } else if (key === 'GET /api/library/threads') {
      await success({ threads: [] });
    } else {
      unexpectedRequests.push(key);
      await route.fulfill({ status: 501, json: { data: null, error: { code: 'UNMOCKED' } } });
    }
  });

  await page.goto('/login?mode=register');
  await page.getByTestId('register-username-input').fill('debug_reader');
  await page.getByTestId('register-display-name-input').fill('디버그 독자');
  await page.getByTestId('register-email-input').fill('debug@example.test');
  await page.getByTestId('login-password-input').fill('reader1234');
  await page.getByTestId('register-password-confirm-input').fill('reader1234');

  await page.getByTestId('register-email-check-submit').click();
  await expect(page.getByTestId('register-email-check-message')).toBeVisible();
  await expect(page.getByTestId('register-bot-challenge')).toHaveCount(0);
  await page.getByTestId('register-email-code-submit').click();
  await expect(page.getByTestId('register-email-code-input')).toHaveValue('123456');
  await page.getByTestId('register-email-code-confirm-submit').click();

  const consentPanel = page.getByTestId('register-consent-panel');
  await expect(consentPanel).toBeVisible();
  await expect(consentPanel).toHaveCSS('background-color', 'rgb(25, 24, 21)');
  await expect(consentPanel).toHaveCSS('border-top-color', 'rgb(79, 71, 60)');
  await expect(consentPanel).toHaveCSS('color', 'rgb(238, 231, 220)');
  await expect(page.getByTestId('register-privacy-consent')).toHaveCSS(
    'border-top-color',
    'rgb(170, 161, 150)',
  );
  await expect(page.getByTestId('register-privacy-consent').locator('..')).toHaveCSS(
    'color',
    'rgb(238, 231, 220)',
  );
  await expect(consentPanel.getByRole('link', { name: '서비스 이용약관' })).toHaveCSS(
    'color',
    'rgb(189, 138, 67)',
  );

  await page.getByTestId('register-privacy-consent').check();
  await page.getByTestId('register-ai-transfer-consent').check();
  await page.getByTestId('register-age-consent').check();
  const consentContinue = page.getByTestId('register-consent-continue');
  await expect(consentContinue).toBeEnabled();
  await consentContinue.hover();
  await expect(consentContinue).toHaveCSS('color', 'rgb(23, 19, 14)');
  await expect(consentContinue).toHaveCSS('background-color', 'rgb(202, 153, 82)');
  await expectButtonContrast(consentContinue);
  await page.mouse.down();
  try {
    await expect(consentContinue).toHaveCSS('background-color', 'rgb(182, 129, 61)');
    await expectButtonContrast(consentContinue);
  } finally {
    // Release away from the control so the state probe does not advance signup.
    await page.mouse.move(0, 0);
    await page.mouse.up();
  }
  await consentContinue.click();
  await expect(page.getByTestId('register-submit')).toBeEnabled();
  await page.getByTestId('register-submit').click();

  await expect(page).toHaveURL(/\/book\/library$/);
  await expect(page.getByTestId('book-list-page')).toBeVisible();
  expect(unexpectedRequests).toEqual([]);
});

async function expectButtonContrast(button: Locator) {
  const pair = await button.evaluate((element) => {
    const style = getComputedStyle(element);
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)?.map(Number) ?? [];
      if (channels.length !== 3 || !color.startsWith('rgb(')) {
        throw new Error(`Expected an opaque RGB color, received ${color}`);
      }
      return channels
        .map((channel) => channel / 255)
        .map((channel) =>
          channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
        )
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    };
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return {
      foreground: style.color,
      background: style.backgroundColor,
      ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
    };
  });
  expect(pair.ratio, JSON.stringify(pair)).toBeGreaterThanOrEqual(4.5);
}
