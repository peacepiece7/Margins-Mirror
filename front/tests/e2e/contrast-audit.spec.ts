import { createRequire } from 'node:module';

import { expect, test, type Locator, type Page } from '@playwright/test';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.localStorage.setItem('margins.app-download-notice.v1', 'dismissed');
    window.localStorage.setItem('margins.locale', 'ko');
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 401,
      json: {
        data: null,
        error: { code: 'AUTH_UNAUTHORIZED', fields: [] },
        success: false,
      },
    });
  });
});

test('public landing text meets representative contrast', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.landing-page')).toBeVisible();
  await expect(page.locator('.landing-page')).toHaveAttribute('data-motion', 'reduced');
  await expectContrast(page);
});

test('registration dark surface and disabled controls remain readable', async ({ page }) => {
  await page.goto('/login');
  const loginSubmit = page.getByTestId('login-submit');
  await expect(loginSubmit).toBeDisabled();
  await expectAuthSubmitGeometry(loginSubmit);
  await page.getByTestId('login-username-input').fill('contrast-user');
  await page.getByTestId('login-password-input').fill('test-only-password');
  await expect(loginSubmit).toBeEnabled();
  await expectAuthSubmitGeometry(loginSubmit);
  await page.getByTestId('login-password-input').fill('');
  await page.getByTestId('login-username-input').fill('');
  await expect(loginSubmit).toBeDisabled();
  await expectAuthSubmitGeometry(loginSubmit);
  await page.getByTestId('auth-mode-register').click();
  await expect(page.getByTestId('register-fields-grid')).toBeVisible();
  await page.waitForTimeout(200);
  await expectContrast(page);
  await expectDisabledButtonContrast(page);
});

test('account recovery dark surface and status messages remain readable', async ({ page }) => {
  let rejectRecovery = false;
  await page.route('**/api/account/recovery**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    if (rejectRecovery) {
      await route.fulfill({
        status: 400,
        json: {
          data: null,
          error: { code: 'ACCOUNT_RECOVERY_INVALID', fields: [] },
          success: false,
        },
      });
      return;
    }
    let data: unknown;
    if (path === '/api/account/recovery/challenges') {
      data = { challengeId: 'contrast-challenge', expiresInSeconds: 300 };
    } else if (path === '/api/account/recovery/challenges/contrast-challenge/verify') {
      data = { actionToken: 'contrast-action', expiresInSeconds: 300 };
    } else if (path === '/api/account/recovery') {
      expect(route.request().postDataJSON().action).toBe('RESTORE');
      data = null;
    } else {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, json: { data, error: null, success: true } });
  });
  await page.goto('/account/recovery');
  await expect(page.getByTestId('account-recovery-page')).toBeVisible();
  await expectContrast(page);
  await expectDisabledButtonContrast(page);
  const recoverySubmit = page.locator('button[type="submit"]');
  await expect(recoverySubmit).toBeDisabled();
  await expectAuthSubmitGeometry(recoverySubmit);
  await page.locator('#recovery-email').fill('contrast@example.test');
  await expect(recoverySubmit).toBeEnabled();
  await expectAuthSubmitGeometry(recoverySubmit);
  await page.locator('#recovery-email').fill('');
  await expect(recoverySubmit).toBeDisabled();
  await expectAuthSubmitGeometry(recoverySubmit);

  await page.locator('#recovery-email').fill('contrast@example.test');
  await recoverySubmit.click();
  await expect(page.locator('#recovery-code')).toBeVisible();
  await expect(page.locator('[data-slot="alert"].bg-success-surface')).toBeVisible();
  await expectContrast(page);
  await page.locator('#recovery-code').fill('ABCDEF');
  await recoverySubmit.click();
  await expect(page.locator('#recovery-code-error')).toBeVisible();
  await expectContrast(page);
  await page.locator('#recovery-code').fill('123456');
  await recoverySubmit.click();
  await expect(page.locator('[data-slot="alert"].bg-success-surface')).toContainText(
    '이메일 확인을 완료했습니다.',
  );
  await expectContrast(page);
  await page.getByRole('button', { name: '계정 복구', exact: true }).click();
  await expect(page.locator('[data-slot="alert"].bg-success-surface')).toContainText(
    '계정을 복구했습니다.',
  );
  await expectContrast(page);

  rejectRecovery = true;
  await page.goto('/account/recovery');
  await page.locator('#recovery-email').fill('contrast@example.test');
  await recoverySubmit.click();
  await expect(page.locator('[data-slot="alert"].text-destructive')).toBeVisible();
  await expectContrast(page);
});

test('legal light surfaces remain readable', async ({ page }) => {
  for (const path of ['/terms', '/privacy']) {
    await page.goto(path);
    await expectContrast(page);
  }
});

async function expectAuthSubmitGeometry(button: Locator) {
  await expect(button).toHaveCSS('height', '44px');
  await expect(button).toHaveCSS('min-height', '44px');
  await expect(button).toHaveCSS('border-radius', '0px');
}

async function expectContrast(page: Page) {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    type AxeNode = { failureSummary?: string; target: string[] };
    type AxeResult = { help: string; nodes: AxeNode[] };
    const axe = (
      globalThis as typeof globalThis & {
        axe: {
          run(
            context: Document,
            options: Record<string, unknown>,
          ): Promise<{ violations: AxeResult[] }>;
        };
      }
    ).axe;
    const result = await axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'rule', values: ['color-contrast'] },
    });
    return result.violations.flatMap((violation) =>
      violation.nodes.map((node) => ({
        failure: node.failureSummary,
        help: violation.help,
        target: node.target.join(' '),
      })),
    );
  });

  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

async function expectDisabledButtonContrast(page: Page) {
  const pairs = await page.locator('[data-slot="button"]:disabled').evaluateAll((buttons) =>
    buttons.map((button) => {
      const style = getComputedStyle(button);
      const channels = (value: string) =>
        value
          .match(/[\d.]+/g)
          ?.slice(0, 3)
          .map(Number) ?? [];
      const luminance = (value: string) =>
        channels(value)
          .map((channel) => channel / 255)
          .map((channel) =>
            channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
          )
          .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const foreground = luminance(style.color);
      const background = luminance(style.backgroundColor);
      return {
        background: style.backgroundColor,
        contrast:
          (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
        label: button.textContent?.trim(),
        opacity: style.opacity,
      };
    }),
  );

  expect(pairs.length).toBeGreaterThan(0);
  for (const pair of pairs) {
    expect(pair.opacity, JSON.stringify(pair)).toBe('1');
    expect(pair.contrast, JSON.stringify(pair)).toBeGreaterThanOrEqual(4.5);
  }
}
