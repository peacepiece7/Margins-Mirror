import { expect, test } from '@playwright/test';

test.setTimeout(60000);

const backendUrl = process.env.MARGINS_BACKEND_URL || 'http://localhost:8080';

test.beforeEach(async ({ page, request }) => {
  const response = await request.post(`${backendUrl}/api/test/reset`);
  expect(response.ok()).toBeTruthy();
  await page.addInitScript(() => {
    let callback: ((token: string) => void) | undefined;
    let sequence = 0;
    const tokenPrefix = `e2e-turnstile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const issueToken = (token: string) => {
      (
        window as typeof window & {
          __turnstileLastToken?: string;
        }
      ).__turnstileLastToken = token;
      callback?.(token);
    };
    (window as typeof window & { __turnstileMode?: 'success' | 'error' }).__turnstileMode =
      'success';
    (
      window as typeof window & {
        __turnstileIssueToken?: (token: string) => void;
      }
    ).__turnstileIssueToken = issueToken;
    (window as typeof window & { turnstile: unknown }).turnstile = {
      render: (
        _container: HTMLElement,
        options: {
          callback: (token: string) => void;
          'error-callback': () => void;
        },
      ) => {
        callback = options.callback;
        (
          window as typeof window & {
            __turnstileFail?: () => void;
          }
        ).__turnstileFail = options['error-callback'];
        setTimeout(() => {
          const mode = (window as typeof window & { __turnstileMode?: 'success' | 'error' })
            .__turnstileMode;
          if (mode === 'error') options['error-callback']();
          else issueToken(`${tokenPrefix}-${sequence++}`);
        }, 0);
        return 'e2e-widget';
      },
      reset: () =>
        setTimeout(() => {
          const mode = (window as typeof window & { __turnstileMode?: 'success' | 'error' })
            .__turnstileMode;
          if (mode === 'success') issueToken(`${tokenPrefix}-${sequence++}`);
        }, 0),
      remove: () => undefined,
    };
  });
});

async function prepareVerification(page: import('@playwright/test').Page, email: string) {
  await page.goto('/');
  await page.getByTestId('auth-mode-register').click();
  await page.getByTestId('register-email-input').fill(email);
  await page.getByTestId('register-email-check-submit').click();
  await expect(page.getByTestId('register-email-check-message')).toBeVisible();
  await expect(page.getByTestId('register-email-code-submit')).toBeEnabled();
}

test('keeps signup inline controls level before the desktop breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto('/');
  await page.getByTestId('auth-mode-register').click();

  const controls = [
    'register-email-input',
    'register-email-check-submit',
    'register-email-code-input',
    'register-email-code-submit',
    'register-email-code-confirm-submit',
  ];

  for (const testId of controls) {
    await expect(page.getByTestId(testId)).toHaveCSS('height', '44px');
  }
});

test('creates a local account, replaces a stale route, and signs in with the new credentials', async ({
  page,
}) => {
  const suffix = Date.now().toString(36);
  const username = `signup_${suffix}`;
  const displayName = `Signup User ${suffix}`;
  const email = `${username}@example.test`;
  const password = 'reader1234';

  await page.goto('/book/999/reflection/discuss/999');
  await expect(page.getByTestId('login-form')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('auth-mode-register')).toContainText(/Sign up|회원가입/);

  await page.getByTestId('auth-mode-register').click();

  await expect(page.getByTestId('register-privacy-consent')).toHaveCount(0);
  await expect(page.getByTestId('register-username-input')).toBeEnabled();
  await expect(page.getByTestId('register-display-name-input')).toBeEnabled();
  await expect(page.getByTestId('register-email-input')).toBeEnabled();
  await expect(page.getByTestId('login-password-input')).toBeEnabled();
  await expect(page.getByTestId('register-password-confirm-input')).toBeEnabled();
  await expect(page.getByTestId('register-submit')).toHaveCount(0);
  await expect(
    page.locator(
      '[data-testid="register-username-input"], [data-testid="register-display-name-input"], [data-testid="register-email-input"]',
    ),
  ).toHaveCount(3);
  expect(
    await page
      .locator(
        '[data-testid="register-username-input"], [data-testid="register-display-name-input"], [data-testid="register-email-input"]',
      )
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid'))),
  ).toEqual(['register-username-input', 'register-display-name-input', 'register-email-input']);

  await page.getByTestId('register-username-input').fill(username);
  await page.getByTestId('register-display-name-input').fill(displayName);
  await page.getByTestId('login-password-input').fill(password);
  await page.getByTestId('register-password-confirm-input').fill(password);

  await page.getByTestId('register-email-input').fill('demo_reader@test.margins.local');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/email-availability') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    ),
    page.getByTestId('register-email-check-submit').click(),
  ]);
  await expect(page.getByTestId('register-email-error')).toContainText(
    /already in use|이미 사용 중/,
  );

  await page.getByTestId('register-email-input').fill(email);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/email-availability') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
    ),
    page.getByTestId('register-email-check-submit').click(),
  ]);
  await expect(page.getByTestId('register-email-check-message')).toContainText(
    /available|사용 가능/,
  );

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/auth/email-verifications') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('register-email-code-submit').click(),
  ]);
  await expect(page.getByTestId('register-email-code-input')).toHaveValue(/\d{6}/);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/auth/email-verifications/confirm') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('register-email-code-confirm-submit').click(),
  ]);
  await expect(page.getByTestId('register-email-code-message')).toContainText(
    /verified|인증이 완료/,
  );
  await expect(page.getByTestId('register-privacy-consent')).toBeVisible();
  await expect(page.getByTestId('register-username-input')).toBeEnabled();
  await expect(page.getByTestId('register-display-name-input')).toBeEnabled();
  await expect(page.getByTestId('register-email-input')).toBeDisabled();
  await expect(page.getByTestId('register-consent-continue')).toBeDisabled();
  await expect(page.getByTestId('register-submit')).toHaveCount(0);

  const updatedUsername = `${username}_updated`;
  const updatedDisplayName = `${displayName} Updated`;
  await page.getByTestId('register-username-input').fill(updatedUsername);
  await page.getByTestId('register-display-name-input').fill(updatedDisplayName);

  await page.getByTestId('register-privacy-consent').check();
  await page.getByTestId('register-ai-transfer-consent').check();
  await page.getByTestId('register-age-consent').check();
  await expect(page.getByTestId('register-consent-continue')).toBeEnabled();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/auth/registration-intents') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('register-consent-continue').click(),
  ]);

  await expect(page.getByTestId('register-consent-confirmed')).toBeVisible();
  await expect(page.getByTestId('register-privacy-consent')).toBeDisabled();
  await expect(page.getByTestId('register-ai-transfer-consent')).toBeDisabled();
  await expect(page.getByTestId('register-age-consent')).toBeDisabled();
  await expect(page.getByTestId('register-submit')).toBeEnabled();

  const registerRequestPromise = page.waitForRequest(
    (request) => request.url().endsWith('/api/auth/register') && request.method() === 'POST',
  );
  const [registerResponse, registerRequest] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/auth/register') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    registerRequestPromise,
    page.getByTestId('register-submit').click(),
  ]);
  expect(registerResponse.status()).toBe(200);
  await expect(page).toHaveURL(/\/book\/library$/);
  expect(registerRequest.postDataJSON()).toMatchObject({
    username: updatedUsername,
    displayName: updatedDisplayName,
    email,
  });
  await expect(page.getByTestId('book-list-page')).toBeVisible();
  await expect(page.getByTestId('auth-session-bar')).not.toContainText(updatedDisplayName);
  await expect(page.getByTestId('logout-submit')).toBeVisible();

  await page.getByTestId('logout-submit').click();
  await expect(page.getByTestId('login-form')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  await page.getByTestId('auth-mode-login').click();
  await page.getByTestId('login-username-input').fill(updatedUsername);
  await page.getByTestId('login-password-input').fill(password);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/auth/login') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('login-submit').click(),
  ]);
  await expect(page.getByTestId('book-list-page')).toBeVisible();
  await expect(page.getByTestId('auth-session-bar')).not.toContainText(updatedDisplayName);
  await expect(page.getByTestId('logout-submit')).toBeVisible();
});

test('prevents duplicate sends and allows a fresh-token resend after 60 seconds', async ({
  page,
  request,
}) => {
  await page.clock.install();
  const email = `resend_${Date.now().toString(36)}@example.test`;
  await prepareVerification(page, email);
  let requests = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/auth/email-verifications') && request.method() === 'POST') {
      requests += 1;
    }
  });

  await page.getByTestId('register-email-code-submit').evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect(page.getByTestId('register-email-code-resend-timer')).toContainText('60s');
  expect(requests).toBe(1);

  const resetResponse = await request.post(`${backendUrl}/api/test/reset`);
  expect(resetResponse.ok()).toBeTruthy();
  await page.clock.runFor(60_000);
  await expect(page.getByTestId('register-email-code-submit')).toBeEnabled();
  await page.getByTestId('register-email-code-submit').click();
  await expect.poll(() => requests).toBe(2);
});

test('keeps send disabled when the CAPTCHA widget reports failure', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('auth-mode-register').click();
  await page.getByTestId('register-email-input').fill('captcha_failure@example.test');
  await page.getByTestId('register-email-check-submit').click();
  await page.evaluate(() => {
    const target = window as typeof window & {
      __turnstileFail?: () => void;
      __turnstileMode?: 'success' | 'error';
    };
    target.__turnstileMode = 'error';
    target.__turnstileFail?.();
  });

  await expect(page.getByTestId('register-bot-challenge-status')).toContainText(
    /could not load|불러오지 못/,
  );
  await expect(page.getByTestId('register-email-code-submit')).toBeDisabled();
});

test('recovers from 429 after Retry-After and uses a reset token', async ({ page }) => {
  await page.clock.install();
  const email = `limited_${Date.now().toString(36)}@example.test`;
  let attempts = 0;
  await page.route('**/api/auth/email-verifications', async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '2' },
        body: JSON.stringify({
          success: false,
          data: null,
          error: {
            code: 'AUTH_EMAIL_VERIFICATION_RATE_LIMITED',
            fields: [],
            requestId: 'e2e-rate-limit',
          },
        }),
      });
      return;
    }
    await route.continue();
  });
  await prepareVerification(page, email);

  await page.getByTestId('register-email-code-submit').click();
  await expect(page.getByTestId('register-email-code-resend-timer')).toContainText('2s');
  await page.clock.fastForward(2_000);
  await expect(page.getByTestId('register-email-code-submit')).toBeEnabled();
  await page.getByTestId('register-email-code-submit').click();
  await expect.poll(() => attempts).toBe(2);
  await expect(page.getByTestId('register-email-code-resend-timer')).toContainText('60s');
});

test('server rejects a replayed Turnstile token before reserving another email send', async ({
  page,
}) => {
  const firstEmail = `challenge_first_${Date.now().toString(36)}@example.test`;
  await prepareVerification(page, firstEmail);
  const consumedToken = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __turnstileLastToken?: string;
        }
      ).__turnstileLastToken,
  );
  expect(consumedToken).toBeTruthy();
  await page.getByTestId('register-email-code-submit').click();
  await expect(page.getByTestId('register-email-code-resend-timer')).toContainText('60s');

  const secondEmail = `challenge_second_${Date.now().toString(36)}@example.test`;
  await page.getByTestId('register-email-input').fill(secondEmail);
  await page.getByTestId('register-email-check-submit').click();
  await expect(page.getByTestId('register-email-check-message')).toBeVisible();
  await page.evaluate((token) => {
    (
      window as typeof window & {
        __turnstileIssueToken?: (value: string) => void;
      }
    ).__turnstileIssueToken?.(token);
  }, consumedToken);
  await page.getByTestId('register-email-code-submit').click();

  await expect(page.getByTestId('register-email-error')).toContainText(/bot check|봇 확인/i);
  await expect(page.getByTestId('register-email-code-submit')).toBeEnabled();
});
