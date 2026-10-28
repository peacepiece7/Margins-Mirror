import { expect, test, type Locator } from '@playwright/test';

// Public-page UX tests deliberately stay anonymous and do not need a running auth service.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      json: { success: false, data: null, error: { message: 'Unauthorized' } },
    }),
  );
});

function captureVisibleLeftExitFrame(stack: Locator) {
  return stack.evaluate(
    (element) =>
      new Promise<{ opacity: number; x: number }>((resolve, reject) => {
        let hasStarted = false;
        let settled = false;
        let lastFrame: { opacity: number; x: number } | undefined;
        let frameCount = 0;
        let minX = 0;
        let minVisibleX = 0;
        const timeoutId = window.setTimeout(() => {
          settled = true;
          reject(
            new Error(
              `Timed out waiting for a visible left exit frame (phase=${element.getAttribute('data-stack-phase')}, frameCount=${frameCount}, minX=${minX}, minVisibleX=${minVisibleX}, lastFrame=${JSON.stringify(lastFrame)}).`,
            ),
          );
        }, 8_000);

        const sampleFrame = () => {
          if (settled) return;
          const card = element.querySelector<HTMLElement>('[data-stack-front]');
          if (element.getAttribute('data-stack-phase') === 'exiting' && card) {
            hasStarted = true;
            const style = getComputedStyle(card);
            const transform = new DOMMatrixReadOnly(style.transform);
            const frame = { opacity: Number(style.opacity), x: transform.m41 };
            frameCount += 1;
            lastFrame = frame;
            minX = Math.min(minX, frame.x);
            if (frame.opacity > 0.9) minVisibleX = Math.min(minVisibleX, frame.x);
            const visibleTravelThreshold = Math.min(20, window.innerWidth * 0.04);
            if (
              frame.opacity > 0.9 &&
              frame.x < -visibleTravelThreshold &&
              frame.x > -window.innerWidth * 0.25
            ) {
              settled = true;
              window.clearTimeout(timeoutId);
              resolve(frame);
              return;
            }
          } else if (hasStarted) {
            settled = true;
            window.clearTimeout(timeoutId);
            reject(
              new Error(
                `Card exit completed before a visible left-exit frame was sampled (frameCount=${frameCount}, minX=${minX}, minVisibleX=${minVisibleX}, lastFrame=${JSON.stringify(lastFrame)}).`,
              ),
            );
            return;
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
      new Promise<{ minX: number; viewportWidth: number }>((resolve, reject) => {
        const exitingCard = element.querySelector<HTMLElement>('[data-stack-front]')!;
        let hasStarted = false;
        let settled = false;
        let minX = 0;
        const timeoutId = window.setTimeout(() => {
          settled = true;
          reject(
            new Error(
              `Timed out capturing left exit travel (phase=${element.getAttribute('data-stack-phase')}, hasStarted=${hasStarted}, minX=${minX}).`,
            ),
          );
        }, 8_000);

        const sampleFrame = () => {
          if (settled) return;
          const phase = element.getAttribute('data-stack-phase');
          if (phase === 'exiting') {
            hasStarted = true;
            const transform = new DOMMatrixReadOnly(getComputedStyle(exitingCard).transform);
            minX = Math.min(minX, transform.m41);
          } else if (hasStarted) {
            settled = true;
            window.clearTimeout(timeoutId);
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
    viewportPosition: getComputedStyle(hero.querySelector('.landing-hero-viewport')!).position,
    viewportSceneHeight: hero.querySelector('.landing-hero-viewport')!.getBoundingClientRect()
      .height,
    mediaTransform: getComputedStyle(hero.querySelector('.landing-hero-media')!).transform,
    artSource: hero.querySelector('img')?.getAttribute('src'),
  }));
  expect(heroMetrics.height).toBeCloseTo(heroMetrics.viewportHeight * 4.29, 0);
  expect(heroMetrics.viewportPosition).toBe('sticky');
  expect(heroMetrics.viewportSceneHeight).toBe(heroMetrics.viewportHeight);
  expect(heroMetrics.mediaTransform).not.toBe('none');
  expect(heroMetrics.artSource).toBe('/landing/hero-sequence/frame_001.webp');

  const heroScrollRange = heroMetrics.height - heroMetrics.viewportHeight;
  await page.evaluate((top) => window.scrollTo({ top }), heroScrollRange * 0.13);
  await expect(page.locator('[data-landing-hero-sequence]')).toHaveAttribute(
    'src',
    '/landing/hero-sequence/frame_001.webp',
  );
  await expect
    .poll(() =>
      page.locator('.landing-header').evaluate((header) => getComputedStyle(header).opacity),
    )
    .not.toBe('1');

  await page.evaluate((top) => window.scrollTo({ top }), heroScrollRange * 0.21);
  await expect(page.locator('[data-landing-hero-sequence]')).toHaveAttribute(
    'src',
    '/landing/hero-sequence/frame_001.webp',
  );
  await expect
    .poll(() =>
      page
        .locator('.landing-hero-media')
        .evaluate((media) => new DOMMatrixReadOnly(getComputedStyle(media).transform).a),
    )
    .toBeGreaterThan(1.025);

  await page.evaluate(() => window.scrollTo({ top: window.innerHeight }));
  const heroCanvas = page.locator('[data-landing-hero-canvas]');
  await expect(heroCanvas).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => heroCanvas.getAttribute('data-frame')).not.toBe('1');
  await expect(heroCanvas).toBeVisible();
  await expect(page.locator('[data-landing-hero-sequence]')).toHaveAttribute(
    'src',
    '/landing/hero-sequence/frame_001.webp',
  );

  const primaryCta = page.getByTestId('landing-signup');
  await expect(primaryCta).toHaveCSS('color', 'rgb(21, 21, 21)');
  await expect(page.locator('.landing-bookshelf')).toHaveCount(0);
  await expect(page.locator('[data-landing-book-deck]')).toHaveCount(0);

  const gridColumns = await page
    .getByTestId('landing-workflow')
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  expect(gridColumns).toBe(3);

  const journeyImageStyles = await page
    .locator('.landing-journey .landing-screen-frame img')
    .evaluateAll((images) =>
      images.map((image) => {
        const style = getComputedStyle(image);
        return { objectFit: style.objectFit, objectPosition: style.objectPosition };
      }),
    );
  expect(journeyImageStyles).toHaveLength(6);
  expect(journeyImageStyles).toEqual(
    Array.from({ length: 6 }, () => ({ objectFit: 'cover', objectPosition: '50% 50%' })),
  );
  await expect(page.locator('img.landing-hero-art')).toHaveCSS('object-position', '100% 50%');
  await expect(heroCanvas).toHaveCSS('object-position', '100% 50%');
  await expect(page.locator('.landing-version-stack img').first()).toHaveCSS(
    'object-position',
    '50% 0%',
  );

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

  await page.evaluate(() => window.scrollTo({ top: 0 }));
  const journeyTopBeforeScroll = await page
    .locator('.landing-journey')
    .evaluate((element) => element.getBoundingClientRect().top);
  await page.evaluate(() => window.scrollTo({ top: 320 }));
  const coverMetrics = await page.evaluate(() => ({
    heroViewportTop: document.querySelector('.landing-hero-viewport')!.getBoundingClientRect().top,
    journeyTop: document.querySelector('.landing-journey')!.getBoundingClientRect().top,
  }));
  expect(coverMetrics.heroViewportTop).toBe(0);
  expect(coverMetrics.journeyTop).toBeCloseTo(journeyTopBeforeScroll - 320, 0);

  const firstJourneyMedia = page.locator('.landing-screen-media').first();
  const firstJourneyImage = firstJourneyMedia.locator('img');
  await firstJourneyMedia.scrollIntoViewIfNeeded();
  const parallaxBefore = await firstJourneyImage.evaluate(
    (image) => new DOMMatrixReadOnly(getComputedStyle(image).transform).m42,
  );
  await page.evaluate(() => window.scrollBy({ top: 180 }));
  await expect
    .poll(() =>
      firstJourneyImage.evaluate(
        (image) => new DOMMatrixReadOnly(getComputedStyle(image).transform).m42,
      ),
    )
    .toBeLessThan(parallaxBefore - 1);
  const parallaxAfter = await firstJourneyImage.evaluate((image) => {
    const media = image.parentElement!;
    return {
      imageHeight: image.getBoundingClientRect().height,
      mediaHeight: media.getBoundingClientRect().height,
      y: new DOMMatrixReadOnly(getComputedStyle(image).transform).m42,
    };
  });
  expect(Math.abs(parallaxAfter.y)).toBeLessThanOrEqual(24.1);
  expect(parallaxAfter.imageHeight - parallaxAfter.mediaHeight).toBeCloseTo(48, 0);

  await page.getByRole('radio', { name: 'KO' }).click();
  await expect(page.locator('.landing-stage-meta')).toHaveCount(0);
  await expect(page.getByTestId('landing-workflow')).not.toContainText('준비 완료');
  await expect(page.locator('.landing-screen-frame figcaption')).toHaveText([
    '00 · 독서 준비',
    '01 · 기록하',
    '02 · 질의와 답변',
    '03 · 발제 준비',
    '04 · 토론 진행',
    '05 · 생각 다듬기',
  ]);
  await expect(page.getByTestId('landing-workflow')).toContainText(
    '다양한 질문에 답하며 감상을 더 구체적으로 만들어가요.',
  );
  await expect(page.getByTestId('landing-workflow')).toContainText(
    '내 감상에서 출발한 발제안을 만들어요.',
  );
  await expect(page.getByTestId('landing-workflow')).not.toContainText('비공개 질문에 답하며');
  await expect(page.getByTestId('landing-workflow')).not.toContainText('비공개 답변은 그대로 두고');
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
  await expect(versionStack).toHaveCSS('min-height', '416px');
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

test('raises journey, preservation, and closing sections from below as they enter', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('public-landing-page')).toHaveAttribute('data-motion', 'enabled');

  const readReveal = (selector: string) =>
    page.locator(selector).evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        opacity: Number(style.opacity),
        y: new DOMMatrixReadOnly(style.transform).m42,
      };
    });
  const staged = [
    '.landing-section-heading h2',
    '.landing-journey-stage >> nth=0',
    '.landing-preservation-copy h2',
    '.landing-version-stack',
    '.landing-final-copy h2',
    '.landing-final-art',
  ];

  for (const selector of staged) {
    await expect.poll(() => readReveal(selector)).toEqual({ opacity: 0, y: 44 });
  }

  for (const selector of staged) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await expect.poll(() => readReveal(selector)).toEqual({ opacity: 1, y: 0 });
  }

  const cascade = await page
    .locator('.landing-section-heading')
    .evaluate((heading) =>
      Array.from(heading.children, (child) => getComputedStyle(child).transitionDelay),
    );
  expect(cascade).toEqual(['0s, 0s', '0.09s, 0.09s', '0.18s, 0.18s']);
});

test('renders a static, overflow-free mobile landing for reduced motion', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('app-download-notice')).toBeVisible();
  await page.getByTestId('app-download-close').click();

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
  const journeyImageStyles = await page
    .locator('.landing-journey .landing-screen-frame img')
    .evaluateAll((images) =>
      images.map((image) => {
        const style = getComputedStyle(image);
        return { objectFit: style.objectFit, objectPosition: style.objectPosition };
      }),
    );
  expect(journeyImageStyles).toEqual(
    Array.from({ length: 6 }, () => ({ objectFit: 'cover', objectPosition: '50% 50%' })),
  );
  const reducedParallax = await page
    .locator('[data-landing-screen-parallax]')
    .evaluateAll((images) =>
      images.map((image) => ({
        offset: (image as HTMLElement).style.getPropertyValue('--landing-screen-parallax-y'),
        transform: getComputedStyle(image).transform,
      })),
    );
  expect(reducedParallax).toEqual(
    Array.from({ length: 6 }, () => ({ offset: '', transform: 'none' })),
  );
  await page.getByRole('radio', { name: 'KO' }).click();
  const preservationTitleMetrics = await page
    .locator('.landing-preservation h2')
    .evaluate((title) => {
      const style = getComputedStyle(title);
      return {
        fontSize: Number.parseFloat(style.fontSize),
        lineHeight: Number.parseFloat(style.lineHeight),
      };
    });
  expect(preservationTitleMetrics.lineHeight / preservationTitleMetrics.fontSize).toBeCloseTo(
    1.2,
    2,
  );
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
  await page.clock.runFor(160);
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

test('keeps the hero sticky on short viewports at tablet width and above', async ({ page }) => {
  await page.setViewportSize({ width: 796, height: 640 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');

  const journeyTopBeforeScroll = await page
    .locator('.landing-journey')
    .evaluate((element) => element.getBoundingClientRect().top);
  const heroBeforeScroll = await page.locator('.landing-hero').evaluate((hero) => ({
    height: hero.getBoundingClientRect().height,
    viewportHeight: hero.querySelector('.landing-hero-viewport')!.getBoundingClientRect().height,
    viewportPosition: getComputedStyle(hero.querySelector('.landing-hero-viewport')!).position,
  }));
  expect(heroBeforeScroll.height).toBeCloseTo(2745.6, 0);
  expect(heroBeforeScroll.viewportHeight).toBe(640);
  expect(heroBeforeScroll.viewportPosition).toBe('sticky');

  await page.evaluate(() => window.scrollTo({ top: 240 }));
  const coverMetrics = await page.evaluate(() => ({
    heroViewportTop: document.querySelector('.landing-hero-viewport')!.getBoundingClientRect().top,
    journeyTop: document.querySelector('.landing-journey')!.getBoundingClientRect().top,
  }));
  expect(coverMetrics.heroViewportTop).toBe(0);
  expect(coverMetrics.journeyTop).toBeCloseTo(journeyTopBeforeScroll - 240, 0);
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
  await expect
    .poll(() =>
      page
        .locator('[data-landing-screen-parallax]')
        .evaluateAll((images) =>
          images.map((image) =>
            (image as HTMLElement).style.getPropertyValue('--landing-screen-parallax-y'),
          ),
        ),
    )
    .toEqual(Array.from({ length: 6 }, () => ''));
  const visibleExitFrame = await visibleExitFramePromise;
  expect(visibleExitFrame.opacity).toBeGreaterThan(0.9);
  expect(visibleExitFrame.x).toBeLessThan(-20);
  await expect(versionStack.locator('[data-stack-front] [data-stack-caption]')).toHaveText('GUIDE');
  await expect(versionStack).toHaveAttribute('data-stack-phase', 'idle');
});

test('keeps mobile journey parallax bounded and decodes the initial Preservation image', async ({
  page,
}) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: width === 320 ? 800 : 844 });
    await page.goto('/');

    const versionStack = page.getByTestId('landing-version-stack');
    const frontImage = versionStack.locator('[data-stack-front] img');
    await expect(frontImage).toHaveAttribute('src', '/landing/preserve-revision.webp');
    await expect(frontImage).toHaveAttribute('loading', 'eager');
    await expect
      .poll(async () => frontImage.evaluate((image) => image.naturalWidth))
      .toBeGreaterThan(0);
    await expect(
      versionStack.locator('.landing-version-card:not([data-stack-front]) img'),
    ).toHaveCount(3);
    await expect(
      versionStack.locator('.landing-version-card:not([data-stack-front]) img').first(),
    ).toHaveAttribute('loading', 'lazy');

    const journeyParallaxImages = page.locator('[data-landing-screen-parallax]');
    await expect
      .poll(() =>
        journeyParallaxImages.evaluateAll((images) =>
          images.every((image) =>
            /^-?\d+\.\d{2}px$/.test(
              (image as HTMLElement).style.getPropertyValue('--landing-screen-parallax-y'),
            ),
          ),
        ),
      )
      .toBe(true);

    const firstJourneyMedia = page.locator('.landing-screen-media').first();
    const firstJourneyImage = firstJourneyMedia.locator('img');
    await firstJourneyMedia.scrollIntoViewIfNeeded();
    const parallaxBefore = await firstJourneyImage.evaluate(
      (image) => new DOMMatrixReadOnly(getComputedStyle(image).transform).m42,
    );
    await page.evaluate(() => window.scrollBy({ top: 120 }));
    await expect
      .poll(() =>
        firstJourneyImage.evaluate(
          (image) => new DOMMatrixReadOnly(getComputedStyle(image).transform).m42,
        ),
      )
      .toBeLessThan(parallaxBefore - 1);
    const mobileParallaxMetrics = await firstJourneyImage.evaluate((image) => ({
      imageHeight: image.getBoundingClientRect().height,
      mediaHeight: image.parentElement!.getBoundingClientRect().height,
      y: new DOMMatrixReadOnly(getComputedStyle(image).transform).m42,
    }));
    expect(Math.abs(mobileParallaxMetrics.y)).toBeLessThanOrEqual(24.1);
    expect(mobileParallaxMetrics.imageHeight - mobileParallaxMetrics.mediaHeight).toBeCloseTo(
      48,
      0,
    );

    await versionStack.scrollIntoViewIfNeeded();
    await expect.poll(async () => (await frontImage.boundingBox())?.height ?? 0).toBeGreaterThan(0);
  }
});

test.describe('coarse-pointer mobile Preservation stack', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('keeps the stack body and generic touch targets usable at 390px and 519px', async ({
    page,
  }) => {
    for (const width of [390, 519]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');

      const stack = page.getByTestId('landing-version-stack');
      const frontImage = stack.locator('[data-stack-front] img');
      await expect(stack).toBeVisible();
      const metrics = await page.evaluate(() => {
        const stackElement = document.querySelector<HTMLElement>(
          '[data-testid="landing-version-stack"]',
        )!;
        const login = document.querySelector<HTMLElement>('[data-testid="landing-login"]')!;
        const stackStyle = getComputedStyle(stackElement);
        const stackBox = stackElement.getBoundingClientRect();
        const loginBox = login.getBoundingClientRect();
        return {
          coarsePointer: window.matchMedia('(pointer: coarse)').matches,
          stackHeight: stackBox.height,
          stackMinHeight: stackStyle.minHeight,
          loginHeight: loginBox.height,
          loginWidth: loginBox.width,
        };
      });

      expect(metrics.coarsePointer).toBe(true);
      expect(metrics.stackMinHeight).toBe('336px');
      // Transformed DOMRects can report 335.9995 for a computed 336px box.
      expect(metrics.stackHeight).toBeGreaterThanOrEqual(336 - 0.01);
      expect(metrics.loginHeight).toBeGreaterThanOrEqual(44);
      expect(metrics.loginWidth).toBeGreaterThanOrEqual(44);
      await expect(frontImage).toHaveAttribute('src', '/landing/preserve-revision.webp');
      await expect(frontImage).toHaveAttribute('loading', 'eager');
      await expect
        .poll(async () => frontImage.evaluate((image) => image.naturalWidth))
        .toBeGreaterThan(0);
      await expect
        .poll(async () => frontImage.evaluate((image) => image.naturalHeight))
        .toBeGreaterThan(0);
      await expect
        .poll(async () => (await frontImage.boundingBox())?.height ?? 0)
        .toBeGreaterThan(200);
    }
  });
});
