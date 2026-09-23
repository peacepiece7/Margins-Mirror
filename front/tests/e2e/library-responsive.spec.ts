import { expect, test, type Page } from '@playwright/test';

const session = {
  accessToken: 'responsive-layout-token',
  accessTokenExpiresInSeconds: 3600,
  authMode: 'local',
  consentRequired: false,
  displayName: 'Layout Reader',
  membershipTier: 'PREMIUM',
  preferredLocale: 'en',
  userId: 7,
  username: 'layout-reader',
};

const threads = Array.from({ length: 6 }, (_, bookIndex) => ({
  book: {
    author: `A deliberately long author name ${bookIndex + 1} for scrollbar coverage`,
    bookId: bookIndex + 17,
    readingStatus: 'reading',
    title: `A deliberately long saved book title ${bookIndex + 1} for responsive coverage`,
  },
  recentRevisions: Array.from({ length: 3 }, (_, revisionIndex) => {
    const revisionId = bookIndex * 3 + revisionIndex + 1;
    return {
      createdAt: `2026-09-${String(revisionId).padStart(2, '0')}T12:00:00`,
      revisionId,
      revisionSource: 'USER_EDIT',
      version: revisionIndex + 1,
    };
  }),
  version: 1,
}));

async function openLibrary(page: Page) {
  await page.addInitScript((authSession) => {
    window.sessionStorage.setItem('margins.auth', JSON.stringify(authSession));
    window.localStorage.setItem('margins.auth.refreshAvailable', 'true');
    window.localStorage.setItem('margins.locale', 'en');
  }, session);
  await page.route('**/api/library/threads**', async (route) => {
    const status = new URL(route.request().url()).searchParams.get('status');
    await route.fulfill({
      contentType: 'application/json',
      json: {
        data: { threads: status === 'dnf' ? [] : threads },
        error: null,
        success: true,
      },
    });
  });
  await page.goto('/book/library');
  await expect(page.getByTestId('book-list-page')).toBeVisible();
}

test('library switches before constrained columns overlap and keeps empty content first', async ({
  page,
}) => {
  await openLibrary(page);

  for (const width of [1440, 1180, 1179, 1101, 1024, 901, 900, 769, 768, 390]) {
    await page.setViewportSize({ height: 720, width });
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
        mainBounds: main
          ? {
              clientWidth: main.clientWidth,
              left: main.getBoundingClientRect().left,
              right: main.getBoundingClientRect().right,
              scrollWidth: main.scrollWidth,
            }
          : undefined,
        mainTop: main?.getBoundingClientRect().top ?? 0,
        overflowingElements: [...document.querySelectorAll<HTMLElement>('body *')]
          .filter((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.left < -1 || bounds.right > window.innerWidth + 1;
          })
          .slice(0, 10)
          .map((element) => ({
            className: element.className,
            left: element.getBoundingClientRect().left,
            right: element.getBoundingClientRect().right,
            testId: element.dataset.testid,
          })),
        rowColumns: row ? getComputedStyle(row).gridTemplateColumns.split(/\s+/).length : 0,
        shellColumns: shell ? getComputedStyle(shell).gridTemplateColumns.split(/\s+/).length : 0,
      };
    });

    expect(metrics.documentWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(width);
    expect(metrics.shellColumns).toBe(width >= 1180 ? 3 : width > 900 ? 2 : 1);
    expect(metrics.rowColumns).toBe(width > 900 ? 3 : 1);
    expect(metrics.activityMinHeight).toBe('0px');
    expect(metrics.activityScrollbarGutter).toContain('stable');
    if (width < 1180) expect(metrics.mainTop).toBeLessThan(metrics.activityTop);
  }

  await page.setViewportSize({ height: 720, width: 1024 });
  await page.getByTestId('book-shelf-filter-dnf').click();
  await expect(page.getByText('No saved books yet.')).toBeVisible();

  const emptyOrder = await page.evaluate(() => ({
    activityTop:
      document
        .querySelector<HTMLElement>('[data-testid="library-activity-rail"]')
        ?.getBoundingClientRect().top ?? 0,
    libraryTop:
      document.querySelector<HTMLElement>('[data-testid="book-list-page"]')?.getBoundingClientRect()
        .top ?? 0,
  }));
  expect(emptyOrder.libraryTop).toBeLessThan(emptyOrder.activityTop);
});
