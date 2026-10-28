import { expect, test, type Locator, type Page } from '@playwright/test';

test.setTimeout(60000);

const backendUrl = process.env.MARGINS_BACKEND_URL || 'http://localhost:8080';
const e2eUsername = process.env.MARGINS_E2E_USERNAME || 'peacepiece';
const e2ePassword = process.env.MARGINS_E2E_PASSWORD || 'reader';

async function login(page: Page) {
  await expect(page.getByTestId('login-form')).toBeVisible();
  await page.getByTestId('login-username-input').fill(e2eUsername);
  await page.getByTestId('login-password-input').fill(e2ePassword);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('book-list-page')).toBeVisible();
  await expect(page).toHaveURL(/\/book\/library$/);
  await page.getByTestId('nav-discover').click();
  await expect(page.getByTestId('reading-portal')).toBeVisible();
}

async function addManualBook(page: Page, title: string, author: string) {
  await page.getByTestId('nav-discover').click();
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
  await page.getByTestId('nav-margins').click();
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

test('Library detail connects one cover while the GNB stays fixed and reduced motion is immediate', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('margins.app-download-notice.v1', 'dismissed');
    localStorage.setItem('margins.locale', 'en');
    const state = window as typeof window & { marginsViewTransitionCalls?: number };
    const transitionDocument = document as Document & {
      startViewTransition?: (update: () => void | Promise<void>) => ViewTransition;
    };
    const startViewTransition = transitionDocument.startViewTransition?.bind(document);
    state.marginsViewTransitionCalls = 0;
    if (startViewTransition) {
      transitionDocument.startViewTransition = (update) => {
        state.marginsViewTransitionCalls = (state.marginsViewTransitionCalls ?? 0) + 1;
        return startViewTransition(update);
      };
    }
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await login(page);
  await addManualBook(page, 'Transition Fixture', 'Fixture Author');
  await page.getByTestId('flash-alert').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('flash-alert')).not.toBeVisible();

  expect(await page.evaluate(() => typeof document.startViewTransition === 'function')).toBe(true);
  const row = page.getByTestId('saved-book-row').filter({ hasText: 'Transition Fixture' });
  const sourceCover = row.locator('[data-ui="book-transition-cover"]');
  const sourceBox = await sourceCover.boundingBox();
  const navBox = await page.getByTestId('nav-margins').boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  await page.screenshot({
    path: testInfo.outputPath('page-transition-desktop-library.png'),
    fullPage: true,
  });

  await row.getByTestId('saved-book-detail-link').click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { marginsViewTransitionCalls?: number })
            .marginsViewTransitionCalls ?? 0,
      ),
    )
    .toBe(1);
  await expect(page.getByTestId('current-book-summary')).toContainText('Transition Fixture');
  const animationEvidence = await page.evaluate(() => {
    const animations = document.getAnimations().filter((animation) => {
      const pseudoElement = (animation.effect as KeyframeEffect | null)?.pseudoElement ?? '';
      return (
        pseudoElement.includes('margins-book-cover') ||
        pseudoElement.includes('margins-route-content')
      );
    });
    return animations.map((animation) => {
      const effect = animation.effect as KeyframeEffect;
      const duration = Number(effect.getTiming().duration);
      animation.pause();
      animation.currentTime = duration / 2;
      return { duration, pseudoElement: effect.pseudoElement ?? '' };
    });
  });
  const coverAnimations = animationEvidence.filter(({ pseudoElement }) =>
    pseudoElement.includes('margins-book-cover'),
  );
  const contentAnimations = animationEvidence.filter(({ pseudoElement }) =>
    pseudoElement.includes('margins-route-content'),
  );
  expect(coverAnimations.length).toBeGreaterThan(0);
  expect(coverAnimations.every(({ duration }) => duration <= 320)).toBe(true);
  expect(contentAnimations.length).toBeGreaterThan(0);
  expect(contentAnimations.every(({ duration }) => duration <= 180)).toBe(true);
  expect(
    await page
      .locator('[data-ui="book-transition-cover"]')
      .evaluateAll(
        (covers) =>
          covers.filter(
            (cover) => getComputedStyle(cover).viewTransitionName === 'margins-book-cover',
          ).length,
      ),
  ).toBe(1);
  await page.screenshot({
    path: testInfo.outputPath('page-transition-desktop-midpoint.png'),
  });
  await page.evaluate(async () => {
    const animations = document.getAnimations().filter((animation) => {
      const pseudoElement = (animation.effect as KeyframeEffect | null)?.pseudoElement ?? '';
      return pseudoElement.startsWith('::view-transition');
    });
    animations.forEach((animation) => animation.play());
    await Promise.allSettled(animations.map((animation) => animation.finished));
  });

  await expect(page.getByTestId('book-detail-page')).toBeVisible();
  await expect(page).toHaveURL(/\/book\/\d+$/);
  const destinationBox = await page.locator('[data-ui="book-transition-cover"]').boundingBox();
  const settledNavBox = await page.getByTestId('nav-margins').boundingBox();
  expect(destinationBox).not.toBeNull();
  expect(destinationBox?.height).not.toBe(sourceBox?.height);
  expect(settledNavBox).toEqual(navBox);
  expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(1);
  await page.screenshot({
    path: testInfo.outputPath('page-transition-desktop-detail.png'),
    fullPage: true,
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goBack();
  await expect(page.getByTestId('book-list-page')).toBeVisible();
  const reducedStart = Date.now();
  await row.getByTestId('saved-book-detail-link').click();
  await expect(page.getByTestId('book-detail-page')).toBeVisible();
  expect(Date.now() - reducedStart).toBeLessThan(500);
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => {
          const pseudoElement = (animation.effect as KeyframeEffect | null)?.pseudoElement ?? '';
          return pseudoElement.startsWith('::view-transition');
        }).length,
    ),
  ).toBe(0);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath('page-transition-mobile-reduced.png'),
    fullPage: true,
  });
});

for (const width of [320, 1280]) {
  test(`Library deletion retries a controlled failure through the real API at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem('margins.app-download-notice.v1', 'dismissed');
      localStorage.setItem('margins.locale', 'en');
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await login(page);
    const title = `Deletion Retry Fixture ${width}`;
    await addManualBook(page, title, 'Fixture Author');
    const row = page.getByTestId('saved-book-row').filter({ hasText: title });
    const href = await row.getByTestId('saved-book-detail-link').getAttribute('href');
    const path = `/api/books/${href!.split('/').at(-1)}`;
    let attempts = 0;
    let failDelete!: () => void;
    await page.route(`**${path}`, async (route) => {
      if (route.request().method() !== 'DELETE' || ++attempts > 1) return route.continue();
      await new Promise<void>((resolve) => {
        failDelete = resolve;
      });
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          data: null,
          error: { code: 'COMMON_INTERNAL_ERROR', fields: [], requestId: 'deletion-retry-fixture' },
        }),
      });
    });
    await row.getByTestId('saved-book-delete').click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect.poll(() => attempts).toBe(1);
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Loading editor' })).toBeDisabled();
    failDelete();
    await expect(dialog).toContainText('The request could not be completed. Please try again.');
    await expect(dialog.getByRole('button', { name: 'Delete', exact: true })).toBeEnabled();
    await expect(row).toContainText(title);
    await expect(page).toHaveURL(/\/book\/library$/);
    await page.screenshot({ path: testInfo.outputPath('deletion-retry.png'), fullPage: true });
    const deleted = page.waitForResponse(
      (response) =>
        response.url().endsWith(path) &&
        response.request().method() === 'DELETE' &&
        response.status() === 200,
    );
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    expect((await deleted).status()).toBe(200);
    await expect(dialog).not.toBeVisible();
    await expect(row).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('book-list-page')).toBeVisible();
    await expect(row).toHaveCount(0);
    expect(attempts).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });
}

test('reader background crosses the mobile UI, real API and database boundaries', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('margins.app-download-notice.v1', 'dismissed'),
  );
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/login');
  await login(page);
  await addManualBook(page, 'Private Background Fixture', 'Fixture Author');
  await page
    .getByTestId('saved-book-row')
    .filter({ hasText: 'Private Background Fixture' })
    .getByTestId('saved-book-detail-link')
    .click();
  const detailUrl = page.url();
  const bookId = new URL(detailUrl).pathname.split('/').at(-1);
  const summaryPath = `/api/books/${bookId}/knowledge/summary`;
  const background = page.getByTestId('book-knowledge-status');
  await expect(background).not.toHaveAttribute('open');
  await background.locator('summary').click();
  await page.getByRole('button', { name: 'Edit background' }).click();
  const input = page.getByTestId('book-background-summary-input');
  await expect(input).toBeVisible();
  await input.fill('Synthetic reader-authored background');
  const saved = page.waitForResponse(
    (response) => response.url().endsWith(summaryPath) && response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect((await saved).status()).toBe(200);
  expect((await (await saved).json()).data).toMatchObject({
    summary: 'Synthetic reader-authored background',
    revision: 1,
  });
  await expect(page).toHaveURL(detailUrl);
  const reread = page.waitForResponse(
    (response) => response.url().endsWith(summaryPath) && response.request().method() === 'GET',
  );
  await page.reload();
  expect((await (await reread).json()).data).toMatchObject({
    summary: 'Synthetic reader-authored background',
    revision: 1,
  });
  await expect(background).not.toHaveAttribute('open');
  await background.locator('summary').click();
  await expect(background).toContainText('Synthetic reader-authored background');
  await page.getByRole('button', { name: 'Edit background' }).click();
  await expect(input).toHaveValue('Synthetic reader-authored background');
  await page.getByRole('button', { name: 'Use AI background' }).click();
  const restored = page.waitForResponse(
    (response) => response.url().endsWith(summaryPath) && response.request().method() === 'PATCH',
  );
  await page.getByRole('alertdialog').getByRole('button', { name: 'Use AI background' }).click();
  expect((await restored).status()).toBe(200);
  expect((await (await restored).json()).data).toMatchObject({ summary: null, revision: 2 });
  await expect(page).toHaveURL(detailUrl);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('filters, sorts, and keeps the selected book visible across shelf views', async ({ page }) => {
  await page.goto('/login');
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
        response.url().includes('/api/library/threads?') &&
        response.url().includes('status=reading') &&
        response.request().method() === 'GET',
    ),
    page.getByTestId('book-shelf-filter-reading').click(),
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
  await page.getByTestId('nav-margins').click();
  await expect(page).toHaveURL(/\/book\/library$/);
  await expect(page.getByTestId('book-shelf-filter-reading')).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByTestId('library-activity-rail')).toContainText('Recent activity');

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/library/threads') && response.request().method() === 'GET',
    ),
    page.getByTestId('book-shelf-filter-all').click(),
  ]);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/library/threads') &&
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

  for (const width of [1440, 1180, 1179, 1101, 1024, 901, 900, 768, 390]) {
    await page.setViewportSize({ height: 900, width });
    const metrics = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('[data-testid="library-shell"]');
      const row = document.querySelector<HTMLElement>('[data-testid="saved-book-row"]');
      const main = document.querySelector<HTMLElement>('.web-library-main');
      const activityRail = document.querySelector<HTMLElement>(
        '[data-testid="library-activity-rail"]',
      );
      const activity = document.querySelector<HTMLElement>(
        '[data-testid="library-recent-activity"]',
      );
      return {
        activityMinHeight: activity ? getComputedStyle(activity).minHeight : '',
        activityScrollbarGutter: activity ? getComputedStyle(activity).scrollbarGutter : '',
        activityTop: activityRail?.getBoundingClientRect().top ?? 0,
        documentWidth: document.documentElement.scrollWidth,
        mainTop: main?.getBoundingClientRect().top ?? 0,
        rowColumns: row ? getComputedStyle(row).gridTemplateColumns.split(/\s+/).length : 0,
        shellColumns: shell ? getComputedStyle(shell).gridTemplateColumns.split(/\s+/).length : 0,
        viewportWidth: window.innerWidth,
      };
    });

    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.shellColumns).toBe(width >= 1180 ? 3 : width > 900 ? 2 : 1);
    expect(metrics.rowColumns).toBe(width > 900 ? 3 : 1);
    expect(metrics.activityMinHeight).toBe('0px');
    expect(metrics.activityScrollbarGutter).toContain('stable');
    if (width < 1180) expect(metrics.mainTop).toBeLessThan(metrics.activityTop);
    await expect(page.getByTestId('library-activity-rail')).toBeVisible();
  }
});
