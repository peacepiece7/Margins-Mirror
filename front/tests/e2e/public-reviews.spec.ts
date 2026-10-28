import { expect, test } from '@playwright/test';

// BDD: FRONT-132, FRONT-133, FRONT-134, FRONT-136, FRONT-202
// UI-only fixtures: every API request is intercepted; no shared records/provider calls.
for (const width of [320, 1280]) {
  test(`Public Reviews retains drafts and retries deletion at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() =>
      localStorage.setItem('margins.app-download-notice.v1', 'dismissed'),
    );
    const review = {
      insightId: 11,
      bookId: 7,
      sessionId: 3,
      bookTitle: 'A book',
      sessionTitle: 'Reading',
      title: 'A public review',
      content: 'First line\nSecond line',
      authorName: 'Reader',
    };
    let comments = [
      {
        insightId: 11,
        commentId: 5,
        content: 'My comment',
        ownedByCurrentReader: true,
        parentCommentId: null as number | null,
      },
      {
        insightId: 11,
        commentId: 6,
        content: 'Other reader',
        ownedByCurrentReader: false,
        parentCommentId: null as number | null,
      },
    ];
    const writes: unknown[] = [];
    let deletes = 0;
    let pauseRefresh = false;
    let finishRefresh: (() => void) | undefined;
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
          accessToken: 'ui-fixture',
          accessTokenExpiresInSeconds: 3600,
        };
      if (path === '/api/books') data = { books: [] };
      if (path === '/api/reading-sessions/public-reviews') {
        if (pauseRefresh)
          await new Promise<void>((resolve) => {
            finishRefresh = resolve;
          });
        data = { reviews: [review] };
      }
      if (path === '/api/reading-sessions/public-reviews/11/comments') {
        if (request.method() === 'POST') {
          const input = request.postDataJSON();
          writes.push(input);
          comments = [
            ...comments,
            {
              insightId: 11,
              commentId: 9,
              content: input.content,
              ownedByCurrentReader: true,
              parentCommentId: input.parentCommentId,
            },
          ];
        }
        data = { insightId: 11, comments };
      }
      if (
        path === '/api/reading-sessions/public-reviews/11/comments/5' &&
        request.method() === 'DELETE'
      ) {
        deletes++;
        if (deletes === 1) {
          await route.fulfill({
            status: 500,
            json: { success: false, data: null, message: 'private failure detail' },
          });
          return;
        }
        comments = comments.filter(
          (comment) => comment.commentId !== 5 && comment.parentCommentId !== 5,
        );
        data = { insightId: 11, comments };
      }
      await route.fulfill({ json: { success: true, data, error: null } });
    });

    await page.goto('/book/public-reviews');
    await expect(page.getByText('My comment', { exact: true })).toBeVisible();
    const other = page.getByTestId('public-review-comment').filter({ hasText: 'Other reader' });
    await expect(other.getByTestId('public-review-comment-delete')).toHaveCount(0);
    const draft = page.getByTestId('public-review-comment-input');
    await draft.fill('Unsaved root draft');
    const reply = page.getByTestId('public-review-reply-form').first();
    await reply.getByTestId('public-review-reply-input').fill('A reply');
    await reply.getByTestId('public-review-reply-submit').click();
    await expect(reply.getByTestId('public-review-reply-input')).toHaveValue('');
    await expect(draft).toHaveValue('Unsaved root draft');
    expect(writes).toEqual([{ content: 'A reply', parentCommentId: 5 }]);
    await expect(
      page.getByTestId('public-review-comment').filter({ hasText: 'A reply' }),
    ).toHaveClass(/ml-6/);

    await page.getByTestId('public-review-comment-edit').first().click();
    const edit = page.getByTestId('public-review-comment-edit-input');
    await edit.fill('Unsaved edit draft');
    pauseRefresh = true;
    await page.getByTestId('public-reviews-refresh').click();
    await expect.poll(() => Boolean(finishRefresh)).toBe(true);
    await expect(draft).toBeVisible();
    await expect(edit).toHaveValue('Unsaved edit draft');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath(`public-reviews-refresh-${width}.png`),
      fullPage: true,
    });
    pauseRefresh = false;
    finishRefresh!();
    await expect(page.getByTestId('public-reviews-refresh')).toBeEnabled();
    await edit.fill('Edit after refresh');
    await page.getByTestId('public-review-comment-edit-cancel').click();

    await page.getByTestId('public-review-comment-delete').first().click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(dialog).toContainText('The request could not be completed. Please try again.');
    await expect(dialog).not.toContainText('private failure detail');
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('My comment', { exact: true })).toHaveCount(0);
    await expect(draft).toHaveValue('Unsaved root draft');
    expect(deletes).toBe(2);
  });
}
