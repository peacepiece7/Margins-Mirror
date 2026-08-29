import { expect, test, type Locator } from '@playwright/test';

function captureVisibleLeftExitFrame(stack: Locator) {
  return stack.evaluate(
    (element) =>
      new Promise<{ opacity: number; x: number }>((resolve) => {
        const sampleFrame = () => {
          const card = element.querySelector<HTMLElement>('[data-stack-front]');
          if (element.getAttribute('data-stack-phase') === 'exiting' && card) {
            const style = getComputedStyle(card);
            const transform = new DOMMatrixReadOnly(style.transform);
            const frame = { opacity: Number(style.opacity), x: transform.m41 };
            const visibleTravelThreshold = Math.min(20, window.innerWidth * 0.04);
            if (
              frame.opacity > 0.9 &&
              frame.x < -visibleTravelThreshold &&
              frame.x > -window.innerWidth * 0.25
            ) {
              resolve(frame);
              return;
            }
          }
          requestAnimationFrame(sampleFrame);
        };
        requestAnimationFrame(sampleFrame);
      }),
  );
}

function captureLeftExitTravel(stack: Locator) {
  return stack.evaluate(
    (element) =>
      new Promise<{ minX: number; viewportWidth: number }>((resolve) => {
        const exitingCard = element.querySelector<HTMLElement>('[data-stack-front]')!;
        let hasStarted = false;
        let minX = 0;

        const sampleFrame = () => {
          const phase = element.getAttribute('data-stack-phase');
          if (phase === 'exiting') {
            hasStarted = true;
            const transform = new DOMMatrixReadOnly(getComputedStyle(exitingCard).transform);
            minX = Math.min(minX, transform.m41);
          } else if (hasStarted) {
            resolve({ minX, viewportWidth: window.innerWidth });
            return;
          }
          requestAnimationFrame(sampleFrame);
        };
        requestAnimationFrame(sampleFrame);
      }),
  );
}

function captureSwipeExitTravel(stack: Locator) {
  return stack.evaluate(
    (element) =>
      new Promise<{ maxAbsX: number; minOpacity: number; viewportWidth: number }>((resolve) => {
        const surface = element.querySelector<HTMLElement>(
          '[data-stack-front] .landing-version-card-surface',
        )!;
        let hasStarted = false;
        let maxAbsX = 0;
        let minOpacity = 1;

        const sampleFrame = () => {
          const phase = element.getAttribute('data-stack-phase');
          if (phase === 'exiting') {
            hasStarted = true;
            const style = getComputedStyle(surface);
            const transform = new DOMMatrixReadOnly(style.transform);
            maxAbsX = Math.max(maxAbsX, Math.abs(transform.m41));
            minOpacity = Math.min(minOpacity, Number(style.opacity));
          } else if (hasStarted) {
            resolve({ maxAbsX, minOpacity, viewportWidth: window.innerWidth });
            return;
          }
          requestAnimationFrame(sampleFrame);
        };
        requestAnimationFrame(sampleFrame);
      }),
  );
}

test('keeps the public story on root and authentication on the login route', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const locationUrl = message.location().url;
    const isExpectedLegacyRefreshFailure =
      message.text().includes('status of 401 (Unauthorized)') &&
      locationUrl.length > 0 &&
      new URL(locationUrl).pathname === '/api/auth/refresh';
    if (!isExpectedLegacyRefreshFailure) browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.goto('/');

  await expect(page.getByTestId('public-landing-page')).toBeVisible();
  await expect(page.getByTestId('landing-login')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0.68)',
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /Record your thinking|생각을 기록하다/,
  );
  await expect(page.getByTestId('login-form')).toHaveCount(0);
  await expect(page.getByTestId('landing-workflow').getByRole('listitem')).toHaveCount(6);

  const heroMetrics = await page.locator('.landing-hero').evaluate((hero) => ({
    height: hero.getBoundingClientRect().height,
    viewportHeight: window.innerHeight,
    stickyPosition: getComputedStyle(hero).position,
    mediaTransform: getComputedStyle(hero.querySelector('.landing-hero-media')!).transform,
    artSource: hero.querySelector('img')?.getAttribute('src'),
  }));
  expect(heroMetrics.height).toBe(heroMetrics.viewportHeight);
  expect(heroMetrics.stickyPosition).toBe('sticky');
  expect(heroMetrics.mediaTransform).not.toBe('none');
  expect(heroMetrics.artSource).toBe('/landing/hero-reader.webp');

  const primaryCta = page.getByTestId('landing-signup');
  await expect(primaryCta).toHaveCSS('color', 'rgb(21, 21, 21)');
  await expect(page.locator('.landing-bookshelf')).toHaveCount(0);
  await expect(page.locator('[data-landing-book-deck]')).toHaveCount(0);

  const gridColumns = await page
    .getByTestId('landing-workflow')
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  expect(gridColumns).toBe(3);

  const journeyIntroLayout = await page.locator('.landing-section-heading').evaluate((element) => {
    const title = element.querySelector('h2')!.getBoundingClientRect();
    const description = element.querySelector('p:last-child')!.getBoundingClientRect();
    return {
      columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
      titleAboveDescription: title.bottom <= description.top,
    };
  });
  expect(journeyIntroLayout.columns).toBe(1);
  expect(journeyIntroLayout.titleAboveDescription).toBe(true);
  await expect(page.locator('.landing-memory-note')).toHaveCount(0);

  const journeyTopBeforeScroll = await page
    .locator('.landing-journey')
    .evaluate((element) => element.getBoundingClientRect().top);
  await page.evaluate(() => window.scrollTo({ top: 320 }));
  const coverMetrics = await page.evaluate(() => ({
    heroTop: document.querySelector('.landing-hero')!.getBoundingClientRect().top,
    journeyTop: document.querySelector('.landing-journey')!.getBoundingClientRect().top,
    mediaTransform: getComputedStyle(document.querySelector('.landing-hero-media')!).transform,
  }));
  expect(coverMetrics.heroTop).toBe(0);
  expect(coverMetrics.journeyTop).toBeCloseTo(journeyTopBeforeScroll - 320, 0);
  expect(coverMetrics.mediaTransform).toBe(heroMetrics.mediaTransform);

  await page.getByRole('radio', { name: 'KO' }).click();
  const localizedTitleLayout = await page.evaluate(() => {
    const heading = document.querySelector<HTMLElement>('.landing-hero h1')!;
    const lede = document.querySelector<HTMLElement>('.landing-hero-lede')!;
    const headingRect = heading.getBoundingClientRect();
    const ledeRect = lede.getBoundingClientRect();
    return {
      noCollision: headingRect.bottom <= ledeRect.top,
      noHorizontalOverflow: document.documentElement.scrollWidth === window.innerWidth,
      overflowWrap: getComputedStyle(heading).overflowWrap,
    };
  });
  expect(localizedTitleLayout.noCollision).toBe(true);
  expect(localizedTitleLayout.noHorizontalOverflow).toBe(true);
  expect(localizedTitleLayout.overflowWrap).toBe('anywhere');

  const versionStack = page.getByTestId('landing-version-stack');
  await expect(versionStack).toHaveAttribute('data-reduced-motion', 'false');
  await expect(versionStack).toHaveAttribute('data-stack-motion', 'interactive');
  await expect(versionStack.locator('[data-stack-front] [data-stack-caption]')).toHaveText(
    'REVISION',
  );
  const visibleExitFramePromise = captureVisibleLeftExitFrame(versionStack);
  const exitTravelPromise = captureLeftExitTravel(versionStack);
  await versionStack.click();
  await expect(versionStack).toHaveAttribute('aria-busy', 'true');
  await expect(versionStack).toHaveAttribute('aria-disabled', 'true');
  await expect(versionStack).toHaveAttribute('data-stack-phase', 'exiting');
  const visibleExitFrame = await visibleExitFramePromise;
  expect(visibleExitFrame.opacity).toBeGreaterThan(0.9);
  expect(visibleExitFrame.x).toBeLessThan(-20);
  expect(visibleExitFrame.x).toBeGreaterThan(-160);
  await versionStack.click({ force: true });
  const exitTravel = await exitTravelPromise;
  const exitTravelRatio = Math.abs(exitTravel.minX) / exitTravel.viewportWidth;
  expect(exitTravelRatio).toBeGreaterThan(0.17);
  expect(exitTravelRatio).toBeLessThan(0.23);
  await expect(versionStack.locator('[data-stack-front] [data-stack-caption]')).toHaveText('GUIDE');
  await expect(versionStack).toHaveAttribute('data-stack-phase', 'idle');
  await expect(versionStack).toHaveAttribute('aria-busy', 'false');
  await expect(versionStack).toHaveAttribute('aria-disabled', 'false');

  const frontCard = versionStack.locator('[data-stack-front]');
  const frontCardBox = await frontCard.boundingBox();
  expect(frontCardBox).not.toBeNull();

  await page.mouse.move(
    frontCardBox!.x + frontCardBox!.width / 2,
    frontCardBox!.y + frontCardBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    frontCardBox!.x + frontCardBox!.width / 2 + 36,
    frontCardBox!.y + frontCardBox!.height / 2,
    { steps: 6 },
  );
  await page.waitForTimeout(180);
  await page.mouse.up();
  await expect(versionStack.locator('[data-stack-front] [data-stack-caption]')).toHaveText('GUIDE');
  await expect
    .poll(async () => {
      const transform = await frontCard
        .locator('.landing-version-card-surface')
        .evaluate((card) => new DOMMatrixReadOnly(getComputedStyle(card).transform).m41);
      return Math.abs(transform) < 1;
    })
    .toBe(true);

  await page.mouse.move(
    frontCardBox!.x + frontCardBox!.width / 2,
    frontCardBox!.y + frontCardBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(frontCardBox!.x + frontCardBox!.width / 2 + 180, frontCardBox!.y + 80, {
    steps: 8,
  });
  const liveDragFrame = await frontCard
    .locator('.landing-version-card-surface')
    .evaluate((card) => {
      const style = getComputedStyle(card);
      const transform = new DOMMatrixReadOnly(style.transform);
      return {
        opacity: Number(style.opacity),
        rotate: (Math.atan2(transform.b, transform.a) * 180) / Math.PI,
        x: transform.m41,
      };
    });
  expect(liveDragFrame.x).toBeGreaterThan(150);
  expect(liveDragFrame.x).toBeLessThan(210);
  expect(liveDragFrame.rotate).toBeGreaterThan(3);
  expect(liveDragFrame.opacity).toBeGreaterThan(0.25);
  expect(liveDragFrame.opacity).toBeLessThan(0.5);
  const swipeExitTravelPromise = captureSwipeExitTravel(versionStack);
  await page.mouse.up();
  await expect(versionStack).toHaveAttribute('aria-disabled', 'true');
  const swipeExitTravel = await swipeExitTravelPromise;
  const swipeExitTravelRatio = swipeExitTravel.maxAbsX / swipeExitTravel.viewportWidth;
  expect(swipeExitTravelRatio).toBeGreaterThan(0.19);
  expect(swipeExitTravelRatio).toBeLessThanOrEqual(0.205);
  expect(swipeExitTravel.minOpacity).toBeLessThan(0.05);
  await expect(versionStack.locator('[data-stack-front] [data-stack-caption]')).toHaveText(
    'INTERVIEW',
  );
  await expect(versionStack).toHaveAttribute('aria-disabled', 'false');

  await versionStack.click();
  await expect(versionStack.locator('[data-stack-front] [data-stack-caption]')).toHaveText(
    'ORIGINAL',
  );
  await expect(versionStack).toHaveAttribute('data-stack-phase', 'idle');
  await versionStack.click();
  await expect(versionStack.locator('[data-stack-front] [data-stack-caption]')).toHaveText(
    'REVISION',
  );
  await expect(versionStack).toHaveAttribute('data-stack-phase', 'idle');

  await page.locator('.landing-final-cta a[href="/login?mode=register"]').click();
  await expect(page).toHaveURL(/\/login\?mode=register$/);
  await expect(page.getByTestId('register-email-input')).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('renders a static, overflow-free mobile landing for reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const landing = page.getByTestId('public-landing-page');
  await expect(landing).toHaveAttribute('data-motion', 'reduced');
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    revealCount: document.querySelectorAll('[data-landing-reveal][data-visible="true"]').length,
    gridColumns: getComputedStyle(
      document.querySelector('[data-testid="landing-workflow"]')!,
    ).gridTemplateColumns.split(' ').length,
    heroPosition: getComputedStyle(document.querySelector('.landing-hero')!).position,
    hasBookshelf: Boolean(document.querySelector('.landing-bookshelf')),
  }));
  expect(metrics.documentWidth).toBe(metrics.viewportWidth);
  expect(metrics.revealCount).toBe(12);
  expect(metrics.gridColumns).toBe(1);
  expect(metrics.heroPosition).toBe('relative');
  expect(metrics.hasBookshelf).toBe(false);
  const versionStack = page.getByTestId('landing-version-stack');
  await expect(versionStack).toHaveAttribute('data-reduced-motion', 'true');
  await expect(versionStack).toHaveAttribute('data-stack-motion', 'interactive');
  await expect(versionStack.locator('[data-stack-front] [data-stack-caption]')).toHaveText(
    'REVISION',
  );

  const visibleExitFramePromise = captureVisibleLeftExitFrame(versionStack);
  await versionStack.click();
  await expect(versionStack).toHaveAttribute('aria-disabled', 'true');
  await expect(versionStack).toHaveAttribute('data-stack-phase', 'exiting');
  const visibleExitFrame = await visibleExitFramePromise;
  expect(visibleExitFrame.opacity).toBeGreaterThan(0.9);
  expect(visibleExitFrame.x).toBeLessThan(-10);
  await versionStack.click({ force: true });
  await expect(versionStack.locator('[data-stack-front] [data-stack-caption]')).toHaveText('GUIDE');
  await expect(versionStack).toHaveAttribute('data-stack-phase', 'idle');

  const reducedFrontCard = versionStack.locator('[data-stack-front]');
  const reducedFrontCardBox = await reducedFrontCard.boundingBox();
  expect(reducedFrontCardBox).not.toBeNull();
  await page.mouse.move(
    reducedFrontCardBox!.x + reducedFrontCardBox!.width / 2,
    reducedFrontCardBox!.y + reducedFrontCardBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    reducedFrontCardBox!.x + reducedFrontCardBox!.width / 2 - 120,
    reducedFrontCardBox!.y + reducedFrontCardBox!.height / 2 - 20,
    { steps: 8 },
  );
  const reducedDragFrame = await reducedFrontCard
    .locator('.landing-version-card-surface')
    .evaluate((card) => {
      const style = getComputedStyle(card);
      const transform = new DOMMatrixReadOnly(style.transform);
      return {
        opacity: Number(style.opacity),
        rotate: (Math.atan2(transform.b, transform.a) * 180) / Math.PI,
        x: transform.m41,
      };
    });
  expect(reducedDragFrame.x).toBeLessThan(-55);
  expect(reducedDragFrame.x).toBeGreaterThanOrEqual(-64.5);
  expect(reducedDragFrame.rotate).toBeLessThan(-8);
  expect(reducedDragFrame.opacity).toBeLessThan(0.1);
  await page.mouse.up();
  await expect(versionStack.locator('[data-stack-front] [data-stack-caption]')).toHaveText(
    'INTERVIEW',
  );
  await expect(versionStack).toHaveAttribute('data-stack-phase', 'idle');
  await expect(page.getByTestId('landing-login')).toBeVisible();
  await expect(page.getByTestId('landing-signup')).toBeVisible();
});

test('keeps an active card exit moving when reduced motion is enabled at runtime', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');

  const versionStack = page.getByTestId('landing-version-stack');
  await versionStack.scrollIntoViewIfNeeded();
  const visibleExitFramePromise = captureVisibleLeftExitFrame(versionStack);
  await versionStack.click();
  await expect(versionStack).toHaveAttribute('data-stack-phase', 'exiting');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(versionStack).toHaveAttribute('data-reduced-motion', 'true');
  await expect(versionStack).toHaveAttribute('data-stack-motion', 'interactive');
  const visibleExitFrame = await visibleExitFramePromise;
  expect(visibleExitFrame.opacity).toBeGreaterThan(0.9);
  expect(visibleExitFrame.x).toBeLessThan(-20);
  await expect(versionStack.locator('[data-stack-front] [data-stack-caption]')).toHaveText('GUIDE');
  await expect(versionStack).toHaveAttribute('data-stack-phase', 'idle');
});
