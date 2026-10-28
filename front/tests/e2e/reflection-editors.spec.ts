import { expect, test, type Page, type Route } from '@playwright/test';

// BDD: RLOOP-021, RLOOP-022, RLOOP-029, RLOOP-038, RLOOP-063
// All API requests are intercepted: no shared data or external providers.
async function navigateInApp(page: Page, path: string) {
  await page.evaluate((path) => {
    history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

for (const width of [320, 1280]) {
  test(`Reflection editors preserve work and retry Guide actions at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() =>
      localStorage.setItem('margins.app-download-notice.v1', 'dismissed'),
    );
    const reflections = new Map(
      [1, 2].map((bookId) => [
        bookId,
        {
          reflectionId: bookId + 10,
          sessionId: bookId + 2,
          visibility: 'PRIVATE',
          currentRevision: {
            content: `Book ${bookId} body`,
            revisionId: bookId + 20,
            revisionSource: 'INITIAL',
            version: 1,
          },
          revisions: [],
        },
      ]),
    );
    const items = ['WARM_UP', 'INTERPRETATION', 'EXPERIENCE', 'SOCIAL_VALUE', 'CLOSING'].map(
      (stage, index) => ({
        itemId: index + 101,
        questionId: index + 201,
        order: index + 1,
        stage,
        priority: 'REQUIRED',
        question: `Question ${index + 1}`,
        intent: 'Discuss this question',
        expectedMinutes: 4,
        followUps: [],
        sensitivity: 'LOW',
        skippable: true,
        sourceType: 'REFLECTION',
        sourceRefId: 11,
        sourceExcerpt: 'Reader reflection',
        privateSource: false,
      }),
    );
    const guide = (guideId: number) => ({
      guideId,
      guideVersion: guideId - 6,
      currentGuideId: guideId,
      current: true,
      reflectionId: 11,
      sessionId: 3,
      interviewId: 5,
      status: 'READY',
      origin: 'GENERATED',
      purpose: 'THOUGHT_EXPANSION',
      facilitationLevel: 'BEGINNER',
      audienceMode: 'SELF_AI',
      disclosureMode: 'PRIVATE_CONTEXT',
      targetMinutes: 20,
      goal: 'A grounded discussion',
      issues: ['First issue', 'Second issue'],
      items,
    });
    let failRead = true;
    let primaryWrites = 0;
    let refineWrites = 0;
    let regenerations = 0;
    let releaseSave: (() => void) | undefined;
    const failures = async (route: Route) =>
      route.fulfill({
        status: 500,
        json: { success: false, data: null, message: 'private provider detail' },
      });

    await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      let data: unknown = null;
      if (path === '/api/auth/refresh')
        data = {
          userId: 1,
          username: 'reader',
          displayName: 'Reader',
          preferredLocale: 'en',
          membershipTier: 'PREMIUM',
          authMode: 'local',
          accessToken: 'fixture-only',
          accessTokenExpiresInSeconds: 3600,
        };
      if (path === '/api/books') data = { books: [] };
      const bookId = Number(path.match(/^\/api\/books\/(\d+)\/reading-session$/)?.[1]);
      if (bookId) data = { bookId, sessionId: bookId + 2, title: `Session ${bookId}` };
      const sessionId = Number(path.match(/^\/api\/reading-sessions\/(\d+)\/reflection$/)?.[1]);
      if (sessionId) {
        if (failRead) return failures(route);
        data = reflections.get(sessionId - 2);
      }
      const reflectionId = Number(path.match(/^\/api\/reflections\/(\d+)$/)?.[1]);
      if (reflectionId && request.method() === 'PATCH') {
        primaryWrites++;
        if (primaryWrites === 1) return failures(route);
        if (primaryWrites >= 2)
          await new Promise<void>((resolve) => {
            releaseSave = resolve;
          });
        const previous = reflections.get(reflectionId - 10)!;
        const input = request.postDataJSON();
        data = {
          ...previous,
          visibility: input.visibility,
          currentRevision: {
            ...previous.currentRevision,
            content: input.content,
            version: previous.currentRevision.version + 1,
          },
        };
        reflections.set(reflectionId - 10, data as typeof previous);
      }
      const runId = Number(path.match(/^\/api\/discussion-runs\/(\d+)(?:\/refinement)?$/)?.[1]);
      if (runId) {
        data = { runId, guideId: 7, sessionId: 3, windowId: 13, status: 'COMPLETED' };
        if (path.endsWith('/refinement')) {
          data = {
            runId,
            reflectionId: 11,
            initialContent: 'First thought',
            currentContent: `Run ${runId} body`,
            perspectiveSummary: 'Other perspectives',
            suggestedContent: 'Suggested draft',
            suggestionStatus: 'READY',
          };
          if (request.method() === 'POST') {
            refineWrites++;
            if (refineWrites === 1) return failures(route);
            const previous = reflections.get(1)!;
            const input = request.postDataJSON();
            data = {
              ...previous,
              currentRevision: { ...previous.currentRevision, content: input.finalContent },
            };
            reflections.set(1, data as typeof previous);
          }
        }
      }
      const guideId = Number(path.match(/^\/api\/discussion-guides\/(\d+)(?:\/.+)?$/)?.[1]);
      if (guideId) {
        data = guide(guideId);
        if (path.includes('/projections/'))
          data = {
            ...guide(guideId),
            bookTitle: 'A book',
            bookAuthor: 'Author',
            projection: path.endsWith('PARTICIPANT') ? 'PARTICIPANT' : 'FACILITATOR',
          };
        if (path.endsWith('/regenerate')) {
          regenerations++;
          if (regenerations === 1) return failures(route);
          data = guide(8);
        }
      }
      if (path === '/api/reflection-interviews/5/guides')
        data = {
          interviewId: 5,
          currentGuideId: 7,
          versions: [
            {
              guideId: 7,
              guideVersion: 1,
              current: true,
              origin: 'GENERATED',
              status: 'READY',
              hasRun: false,
            },
          ],
        };
      await route.fulfill({ json: { success: true, data, error: null } });
    });

    await page.goto('/book/1/reflection');
    const primary = page.getByTestId('primary-reflection-content');
    await expect(page.getByRole('button', { name: 'Reload', exact: true })).toBeVisible();
    await expect(primary).toBeDisabled();
    failRead = false;
    await page.getByRole('button', { name: 'Reload', exact: true }).click();
    await expect(primary).toHaveValue('Book 1 body');
    await primary.fill('Reader draft');
    await page.getByTestId('primary-reflection-save').click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'The Reflection could not be processed.' }),
    ).toBeVisible();
    await expect(primary).toHaveValue('Reader draft');
    await page.getByTestId('primary-reflection-save').click();
    await expect.poll(() => primaryWrites).toBe(2);
    await expect(primary).toBeDisabled();
    releaseSave!();
    await expect(primary).toBeEnabled();
    await expect(page.getByTestId('primary-reflection-save')).toBeDisabled();
    await primary.fill('A later draft');
    await expect(page.getByTestId('primary-reflection-save')).toBeEnabled();
    await primary.blur();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath(`reflection-compose-${width}.png`),
      fullPage: true,
    });

    // An old success callback must not overwrite a new entity or move its route.
    await page.getByTestId('primary-reflection-save').click();
    await expect.poll(() => primaryWrites).toBe(3);
    await navigateInApp(page, '/book/2/reflection');
    await expect(primary).toHaveValue('Book 2 body');
    await primary.fill('Book 2 draft');
    const refreshedNewBook = page.waitForResponse((response) =>
      response.url().endsWith('/api/reading-sessions/4/reflection'),
    );
    releaseSave!();
    await refreshedNewBook;
    await expect(primary).toHaveValue('Book 2 draft');
    await expect(page).toHaveURL(/\/book\/2\/reflection$/);

    await navigateInApp(page, '/book/1/reflection/refine/9');
    const refined = page.getByTestId('refined-reflection-content');
    await expect(refined).toHaveValue('Run 9 body');
    await refined.fill('Manual draft');
    await page.getByRole('button', { name: 'Add suggestion to editor' }).click();
    await expect(refined).toHaveValue('Suggested draft');
    await page.getByRole('button', { name: 'Restore my previous edits' }).click();
    await expect(refined).toHaveValue('Manual draft');
    await page.locator('#refinement-outcome').selectOption('CHANGED');
    await navigateInApp(page, '/book/1/reflection/refine/10');
    await expect(refined).toHaveValue('Run 10 body');
    await expect(page.locator('#refinement-outcome')).toHaveValue('DEEPENED');
    await expect(page.getByRole('button', { name: 'Restore my previous edits' })).toHaveCount(0);
    await refined.fill('Final reader body');
    await expect(page.getByTestId('reflection-save-refinement')).toBeEnabled();
    await refined.blur();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath(`reflection-refine-${width}.png`),
      fullPage: true,
    });
    await page.getByTestId('reflection-save-refinement').click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'The refinement state could not be loaded.' }),
    ).toBeVisible();
    await expect(page.getByTestId('reflection-save-refinement')).toBeEnabled();
    await expect(refined).toHaveValue('Final reader body');
    await page.getByTestId('reflection-save-refinement').click();
    await expect(page).toHaveURL(/\/book\/1\/reflection$/);
    await expect(primary).toHaveValue('Final reader body');
    expect(refineWrites).toBe(2);

    await navigateInApp(page, '/book/1/reflection/guide/7');
    await expect(page.getByTestId('discussion-guide-edit')).toBeEnabled();
    await page.getByTestId('discussion-guide-edit').click();
    const minutes = page.getByTestId('discussion-guide-item').first().locator('input[type=number]');
    await minutes.fill('1.5');
    await expect(page.getByTestId('discussion-guide-save-version')).toBeDisabled();
    await minutes.fill('4');
    await expect(page.getByTestId('discussion-guide-save-version')).toBeEnabled();
    await page.getByRole('button', { name: 'Cancel editing' }).click();
    await page.getByTestId('discussion-guide-regenerate').click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Create new version' }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText('private provider detail');
    await expect(dialog.getByRole('button', { name: 'Create new version' })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.screenshot({
      path: testInfo.outputPath(`reflection-guide-retry-${width}.png`),
      fullPage: false,
    });
    await dialog.getByRole('button', { name: 'Create new version' }).click();
    await expect(page).toHaveURL(/\/book\/1\/reflection\/guide\/8$/);
    expect(regenerations).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });
}
