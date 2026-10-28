import { expect, test, type Page } from '@playwright/test';

test.use({ isMobile: true, hasTouch: true });
const original = '책의 시대적 배경과 인물의 선택을 설명하는 긴 배경 정보입니다. '.repeat(80);
const personas = Array.from({ length: 12 }, (_, index) => ({
  personaId: index + 1,
  name: `fixture-${index + 1}`,
  displayName: `Speaker ${index + 1}`,
  description: 'Fixture',
  tone: 'Curious',
  active: true,
}));

async function fixtures(page: Page) {
  let background: { summary: string | null; revision: number; updatedAt: string | null } = {
    summary: null,
    revision: 0,
    updatedAt: null,
  };
  let aiSummary = original;
  let failSave = false;
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  await page.addInitScript(() => {
    localStorage.setItem('margins.app-download-notice.v1', 'dismissed');
  });
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET' && !path.startsWith('/api/auth/'))
      writes.push({ path, body: request.postDataJSON() ?? {} });
    let data: unknown = null;
    if (path === '/api/auth/refresh')
      data = {
        userId: 1,
        username: 'reader',
        displayName: 'Reader',
        preferredLocale: 'en',
        membershipTier: 'PREMIUM',
        authMode: 'local',
        accessToken: 'fixture',
        accessTokenExpiresInSeconds: 3600,
      };
    else if (path === '/api/catalog/capabilities') data = { operator: false };
    else if (path === '/api/books')
      data = {
        books: [
          { bookId: 1, title: 'Fixture book', author: 'Fixture author', readingStatus: 'read' },
        ],
      };
    else if (path === '/api/books/1/knowledge/summary') {
      if (request.method() === 'PATCH') {
        const body = request.postDataJSON();
        if (failSave || body.expectedRevision !== background.revision) {
          await route.fulfill({
            status: 409,
            json: {
              success: false,
              data: null,
              error: { code: 'COMMON_CONFLICT', message: 'Conflict' },
            },
          });
          return;
        }
        background = {
          summary: body.summary === null ? null : body.summary.trim(),
          revision: background.revision + 1,
          updatedAt: '2026-10-05T12:00:00',
        };
      }
      data = background;
    } else if (path === '/api/books/1/knowledge' || path === '/api/books/1/knowledge/regenerate') {
      if (request.method() === 'POST') aiSummary = 'New AI original';
      data = {
        knowledgeId: 3,
        title: 'Fixture book',
        summary: aiSummary,
        themes: [],
        keywords: [],
        discussionPoints: [],
        famousQuotes: [],
        recommendedPersonas: [],
        generationLocale: 'en',
        version: 'book-knowledge-v1',
        status: 'ready',
        stale: false,
        fallbackUsed: false,
        refreshPending: false,
      };
    } else if (path === '/api/books/1/reading-session')
      data = { sessionId: 1, bookId: 1, title: 'Fixture' };
    else if (path === '/api/reading-sessions/1')
      data = {
        session: { sessionId: 1, bookId: 1, title: 'Fixture' },
        windows: [],
        messages: [],
        questions: [],
        insights: [],
        highlights: [],
        tags: [],
      };
    else if (path === '/api/personas') data = { personas };
    else if (path === '/api/personas/recommendations') data = { personas: personas.slice(0, 2) };
    else if (path === '/api/session-windows')
      data = {
        windowId: 2,
        sessionId: 1,
        windowType: 'debate',
        title: 'Fixture',
        personaIds: request.postDataJSON().personaIds,
      };
    await route.fulfill({ json: { success: true, data, error: null } });
  });
  return {
    writes,
    failNextSave: () => {
      failSave = true;
    },
  };
}

test('mobile background and persona pickers stay collapsed, keyboard accessible and bounded', async ({
  page,
}, testInfo) => {
  const fixture = await fixtures(page);
  await page.goto('/book/1');
  const background = page.getByTestId('book-knowledge-status');
  const picker = page.getByTestId('debate-participant-picker');
  await expect(page.getByTestId('debate-entry-selected-personas')).toContainText('Speaker 1');
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const locale of ['ko', 'en']) {
      await page.getByTestId('language-toggle').click();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(background).not.toHaveAttribute('open');
      await expect(background).not.toContainText('book-knowledge-v1');
      await expect(picker).not.toHaveAttribute('open');
      await expect(background.locator('p').first()).not.toBeVisible();
      expect((await background.boundingBox())!.height).toBeLessThanOrEqual(120);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      await background.locator('summary').focus();
      await background.locator('summary').press('Enter');
      await expect(background).toHaveAttribute('open', '');
      await expect(background).not.toContainText('book-knowledge-v1');
      await expect(background.locator('p').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      await background.locator('summary').press('Enter');
    }
  }
  await picker.locator('summary').click();
  const toggles = page.getByTestId('debate-participant-toggle');
  await expect(toggles.nth(2)).toBeDisabled();
  await toggles.nth(0).click();
  await toggles.nth(2).click();
  await expect(page.getByTestId('debate-entry-selected-personas')).toHaveText('Speaker 2Speaker 3');
  expect(fixture.writes).toEqual([]);
  await picker.locator('summary').click();
  await page.setViewportSize({ width: 320, height: 844 });
  await background.scrollIntoViewIfNeeded();
  await background.screenshot({ path: testInfo.outputPath('book-background-collapsed-320.png') });
  await page
    .getByTestId('book-debate-entry')
    .screenshot({ path: testInfo.outputPath('debate-entry-collapsed-320.png') });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath('compact-background-personas-320.png'),
    fullPage: true,
  });
  await page.getByTestId('debate-topic-input').fill('Fixture topic');
  await page.getByTestId('debate-enter-submit').click();
  await expect(page).toHaveURL(/\/book\/1\/debate\/2$/);
  expect(fixture.writes).toEqual([
    {
      path: '/api/session-windows',
      body: {
        sessionId: 1,
        windowType: 'debate',
        title: 'Debate: Fixture topic',
        personaIds: [2, 3],
      },
    },
  ]);
});

test('private background saves, survives AI refresh and reload, then restores the original', async ({
  page,
}, testInfo) => {
  const fixture = await fixtures(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/book/1');
  await page.getByTestId('book-knowledge-status').locator('summary').click();
  await page.getByRole('button', { name: 'Edit background' }).click();
  await expect(page).toHaveURL(/\/book\/1\/knowledge\/edit$/);
  const input = page.getByTestId('book-background-summary-input');
  await expect(input).toHaveValue(original);
  await input.fill('Reader-authored correction');
  expect(fixture.writes).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('background-editor-320.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page).toHaveURL(/\/book\/1$/);
  const background = page.getByTestId('book-knowledge-status');
  await background.locator('summary').click();
  await expect(background).toContainText('Reader-authored correction');
  await page.getByRole('button', { name: 'Reload book background information' }).click();
  await expect(background).toContainText('Reader-authored correction');
  await page.reload();
  await expect(background).not.toHaveAttribute('open');
  await background.locator('summary').click();
  await expect(background).toContainText('Reader-authored correction');
  await page.getByRole('button', { name: 'Edit background' }).click();
  await page.getByRole('button', { name: 'Use AI background' }).click();
  expect(fixture.writes.filter(({ path }) => path.endsWith('/knowledge/summary'))).toHaveLength(1);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Use AI background' }).click();
  await expect(page).toHaveURL(/\/book\/1$/);
  await background.locator('summary').click();
  await expect(background).toContainText('New AI original');
  expect(fixture.writes.map((write) => write.body)).toEqual([
    { summary: 'Reader-authored correction', expectedRevision: 0 },
    {},
    { summary: null, expectedRevision: 1 },
  ]);
});

test('conflict keeps the private draft without writes on cancel', async ({ page }) => {
  const fixture = await fixtures(page);
  await page.goto('/book/1/knowledge/edit');
  const input = page.getByTestId('book-background-summary-input');
  await expect(input).toBeVisible();
  await input.fill('Unsaved correction');
  fixture.failNextSave();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(input).toHaveValue('Unsaved correction');
  await expect(page).toHaveURL(/knowledge\/edit$/);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/book\/1$/);
  expect(fixture.writes).toHaveLength(1);
});
