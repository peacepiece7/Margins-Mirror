import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.setTimeout(90000);

const backendUrl = process.env.MARGINS_BACKEND_URL || 'http://localhost:8080';
const e2eUsername = process.env.MARGINS_E2E_USERNAME || 'demo_reader';
const e2ePassword = process.env.MARGINS_E2E_PASSWORD || 'reader';

async function login(page: Page) {
  await expect(page.getByTestId('login-form')).toBeVisible();
  await expect(page.getByTestId('login-username-input')).toHaveValue('');
  await expect(page.getByTestId('login-password-input')).toHaveValue('');
  await page.getByTestId('login-username-input').fill(e2eUsername);
  await page.getByTestId('login-password-input').fill(e2ePassword);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('book-list-page')).toBeVisible();
  await expect(page).toHaveURL(/\/book\/library$/);
  await page.getByTestId('portal-nav-book-search').click();
}

async function expectMobileReflectionWorkflow(page: Page, pageTestId: string) {
  await expect(page.getByTestId(pageTestId)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  const metrics = await page.evaluate((testId) => {
    const workflow = document.querySelector(`[data-testid="${testId}"]`);
    const progress = document.querySelector('[data-testid="reflection-loop-progress"]');
    return {
      bodyScrollWidth: document.documentElement.scrollWidth,
      progressClientWidth: progress?.clientWidth ?? 0,
      progressScrollWidth: progress?.scrollWidth ?? 0,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      workflowTop: workflow?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
    };
  }, pageTestId);

  expect(metrics.bodyScrollWidth).toBe(metrics.viewportWidth);
  expect(metrics.progressScrollWidth).toBe(metrics.progressClientWidth);
  expect(metrics.workflowTop).toBeGreaterThanOrEqual(0);
  expect(metrics.workflowTop).toBeLessThan(metrics.viewportHeight);
}

test.beforeEach(async ({ request }) => {
  const response = await request.post(`${backendUrl}/api/test/reset`);
  expect(response.ok()).toBeTruthy();
});

test('follows the owner replan page flow from book registration to reflection and debate', async ({
  page,
}) => {
  await page.goto('/');
  await login(page);
  await expect(page.getByTestId('logout-submit')).toBeVisible();
  await expect(page.getByTestId('reading-portal')).toBeVisible();
  await expect(page).toHaveURL(/\/book\/discover$/);

  await page.getByTestId('book-search-input').fill('Dune');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/books/search-candidates') &&
        response.request().method() === 'POST',
    ),
    page.getByTestId('book-search-submit').click(),
  ]);
  await expect(page.getByTestId('book-candidate-list')).toContainText(/dune|듄/i);
  await expect(page.getByTestId('book-candidate-id').first()).toContainText('Book ID');
  const savedCandidateTitle = await page.getByTestId('book-candidate-title').first().innerText();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/books') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('book-candidate-save').first().click(),
  ]);
  await expect(page.getByTestId('book-list-page')).toContainText(savedCandidateTitle);

  await page.getByTestId('saved-book-detail-link').filter({ hasText: savedCandidateTitle }).click();
  await expect(page.getByTestId('book-detail-page')).toContainText('Book Detail');
  await page.getByTestId('book-edit-title-input').fill('Dune: Edited');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/books/') &&
        response.request().method() === 'PATCH' &&
        response.status() === 200,
    ),
    page.getByTestId('book-edit-submit').click(),
  ]);
  await expect(page.getByTestId('current-book-summary')).toContainText('Dune: Edited');

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/session-windows/') &&
        response.url().endsWith('/questions/generate') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('book-generate-questions').click(),
  ]);
  await expect(page.getByTestId('book-question-delete').first()).toBeVisible();
  const deletedQuestionText = await page
    .getByTestId('book-question-row')
    .last()
    .getByTestId('book-question-text')
    .innerText();
  await page.getByTestId('book-question-delete').last().click();
  await expect(page.getByRole('alertdialog')).toContainText('Delete this item?');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/questions/') &&
        response.request().method() === 'DELETE' &&
        response.status() === 200,
    ),
    page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click(),
  ]);
  await expect(page.getByTestId('book-question-panel')).not.toContainText(deletedQuestionText);
  if ((await page.getByTestId('book-question-row').count()) === 0) {
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/session-windows/') &&
          response.url().endsWith('/questions/generate') &&
          response.request().method() === 'POST' &&
          response.status() === 200,
      ),
      page.getByTestId('book-generate-questions').click(),
    ]);
    await expect(page.getByTestId('book-question-row').first()).toBeVisible();
  }
  const firstQuestion = page.getByTestId('book-question-text').first();
  await expect(firstQuestion).toBeVisible();
  expect(await firstQuestion.evaluate((element) => element.tagName)).toBe('DIV');
  await expect(page.getByTestId('book-question-panel')).toHaveCount(1);

  await page.getByTestId('book-start-review').click();
  await expect(page.getByTestId('reflection-loop-page')).toBeVisible();
  await expect(page).toHaveURL(/\/book\/\d+\/reflection$/);
  await expect(page.getByTestId('language-toggle')).toHaveText('EN');
  await page.getByTestId('language-toggle').click();
  await expect(page.getByTestId('language-toggle')).toHaveText('KO');
  await page.setViewportSize({ height: 844, width: 390 });
  await expectMobileReflectionWorkflow(page, 'reflection-loop-page');
  await page
    .getByTestId('primary-reflection-content')
    .fill('The opening ritual makes power feel intimate and dangerous.');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/reading-sessions/') &&
        response.url().endsWith('/reflections') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('primary-reflection-save').click(),
  ]);
  await expect(page.getByText('Revision history')).toBeVisible();
  await expect(page.getByTestId('reflection-loop-page')).toContainText(
    'The opening ritual makes power feel intimate and dangerous.',
  );
  await page
    .getByTestId('primary-reflection-content')
    .fill('The edited ritual note keeps power intimate and dangerous.');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/reflections/') &&
        response.request().method() === 'PATCH' &&
        response.status() === 200,
    ),
    page.getByTestId('primary-reflection-save').click(),
  ]);

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/reflections/') &&
        response.url().endsWith('/interviews') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('reflection-start-interview').click(),
  ]);
  await expect(page.getByTestId('reflection-interview-page')).toBeVisible();
  await expect(page).toHaveURL(/\/book\/\d+\/reflection\/interview$/);
  await expectMobileReflectionWorkflow(page, 'reflection-interview-page');

  for (let answerIndex = 1; answerIndex <= 3; answerIndex += 1) {
    await expect(page.getByTestId('reflection-interview-question')).toBeVisible();
    await page
      .getByTestId('reflection-interview-answer')
      .fill(`Answer ${answerIndex}: the scene supports both authority and hesitation.`);
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/api/reflection-interviews/') &&
          response.url().endsWith('/responses') &&
          response.request().method() === 'POST' &&
          response.status() === 200,
      ),
      page.getByRole('button', { name: '답변 저장하고 다음' }).click(),
    ]);
  }

  await expect(page.getByTestId('discussion-guide-brief')).toBeVisible();
  await page.getByText('고급 설정', { exact: true }).click();
  await page.getByLabel(/소그룹/).click();
  await page.getByLabel('20분').click({ force: true });
  let failGuideOnce = true;
  await page.route(/\/api\/reflection-interviews\/\d+\/guides$/, async (route) => {
    if (route.request().method() === 'POST' && failGuideOnce) {
      failGuideOnce = false;
      await route.fulfill({
        body: JSON.stringify({
          data: null,
          error: {
            code: 'COMMON_UPSTREAM_ERROR',
            fields: [],
            requestId: 'e2e-guide-request',
          },
          success: false,
        }),
        contentType: 'application/json',
        status: 502,
      });
      return;
    }
    await route.continue();
  });
  const failedGuideResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/reflection-interviews/') &&
      response.url().endsWith('/guides') &&
      response.request().method() === 'POST' &&
      response.status() === 502,
  );
  await page.getByTestId('reflection-create-guide').click();
  await failedGuideResponse;
  await expect(page.getByText('발제안을 만들지 못했어요')).toBeVisible();
  await expect(
    page.getByText('저장한 Reflection과 인터뷰 답변은 그대로예요. 잠시 후 다시 시도해 주세요.'),
  ).toBeVisible();
  await expect(page.getByText('요청 ID: e2e-guide-request')).toBeVisible();
  await expect(page.getByLabel(/소그룹/)).toBeChecked();
  await expect(page.getByLabel('20분')).toBeChecked();
  await expectMobileReflectionWorkflow(page, 'reflection-interview-page');

  const guideResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/reflection-interviews/') &&
      response.url().endsWith('/guides') &&
      response.request().method() === 'POST' &&
      response.status() === 200,
  );
  await page.getByRole('button', { name: '발제안 다시 만들기' }).click();
  expect((await guideResponse).request().postDataJSON()).toEqual({
    purpose: 'THOUGHT_EXPANSION',
    audienceMode: 'SMALL_GROUP',
    targetMinutes: 20,
    disclosureMode: 'PRIVATE_CONTEXT',
    facilitationLevel: 'BEGINNER',
  });
  await page.unroute(/\/api\/reflection-interviews\/\d+\/guides$/);
  await expect(page.getByTestId('discussion-guide-page')).toBeVisible();
  await expectMobileReflectionWorkflow(page, 'discussion-guide-page');
  await expect(page.getByTestId('discussion-guide-projection-item')).toHaveCount(5);
  await expect(page.getByText('v1 · 현재').first()).toBeVisible();
  await expect(
    page.getByText(/비공개 인터뷰 답변을 AI 생성 문맥으로만 참고/).first(),
  ).toBeVisible();
  await expect(page.getByText(/Answer 1: the scene supports/)).toHaveCount(0);

  const [facilitatorDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('discussion-guide-download-markdown').click(),
  ]);
  expect(facilitatorDownload.suggestedFilename()).toMatch(/-v1-facilitator\.md$/);
  const facilitatorDownloadPath = await facilitatorDownload.path();
  expect(facilitatorDownloadPath).toBeTruthy();
  const facilitatorMarkdown = await readFile(facilitatorDownloadPath!, 'utf8');
  expect(facilitatorMarkdown).toContain('진행자용');
  expect(facilitatorMarkdown).toContain('진행 의도');
  expect(facilitatorMarkdown).toContain('비공개 인터뷰 답변');
  expect(facilitatorMarkdown).not.toContain('Answer 1: the scene supports');

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/discussion-guides/') &&
        response.url().endsWith('/projections/PARTICIPANT') &&
        response.status() === 200,
    ),
    page.getByTestId('discussion-guide-participant-tab').click(),
  ]);
  const participantPreview = page.getByTestId('discussion-guide-participant-preview');
  await expect(participantPreview).toBeVisible();
  await expect(participantPreview.getByTestId('discussion-guide-projection-item')).toHaveCount(5);
  await expect(participantPreview).not.toContainText('진행 의도');
  await expect(participantPreview).not.toContainText('비공개 인터뷰 답변');
  await expect(participantPreview).not.toContainText('후속 질문');
  await expect(page.getByTestId('discussion-guide-edit')).toBeDisabled();
  await expect(page.getByTestId('discussion-guide-regenerate')).toBeDisabled();
  await expectMobileReflectionWorkflow(page, 'discussion-guide-page');

  const [participantDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('discussion-guide-download-markdown').click(),
  ]);
  expect(participantDownload.suggestedFilename()).toMatch(/-v1-participant\.md$/);
  const participantDownloadPath = await participantDownload.path();
  expect(participantDownloadPath).toBeTruthy();
  const participantMarkdown = await readFile(participantDownloadPath!, 'utf8');
  expect(participantMarkdown).toContain('참여자용');
  expect(participantMarkdown).not.toContain('진행 의도');
  expect(participantMarkdown).not.toContain('비공개 인터뷰 답변');
  expect(participantMarkdown).not.toContain('Answer 1: the scene supports');

  await page.getByTestId('discussion-guide-facilitator-tab').click();
  await expect(page.getByTestId('discussion-guide-facilitator-preview')).toBeVisible();
  const firstGuideUrl = page.url();
  const reflectionUrl = firstGuideUrl.replace(/\/guide\/\d+$/, '');

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/discussion-guides/') &&
        response.url().endsWith('/runs') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('discussion-start-run').click(),
  ]);
  await expect(page.getByTestId('guided-discussion-page')).toBeVisible();
  const activeRunUrl = page.url();
  await page
    .getByTestId('guided-discussion-draft')
    .fill('This run starts from v1 and must remain recoverable after a new current Guide.');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/discussion-runs/') &&
        response.url().endsWith('/turns') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByRole('button', { name: '답변 보내기' }).click(),
  ]);

  await page.goto(firstGuideUrl);
  await expect(page.getByText('v1 · 현재').first()).toBeVisible();
  await page.getByTestId('discussion-guide-edit').click();
  await page.getByLabel('토론 목표').fill('Edited E2E discussion goal');
  const firstGuideItem = page.getByTestId('discussion-guide-item').first();
  await firstGuideItem.getByLabel('후속 질문 1', { exact: true }).fill('Edited E2E follow-up');
  await firstGuideItem.getByRole('button', { name: '1번 질문 후속 질문 추가' }).click();
  await firstGuideItem.getByLabel('후속 질문 2', { exact: true }).fill('Second E2E follow-up');
  const versionResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/discussion-guides/') &&
      response.url().endsWith('/versions') &&
      response.request().method() === 'POST' &&
      response.status() === 200,
  );
  await page.getByTestId('discussion-guide-save-version').click();
  expect((await versionResponse).request().postDataJSON().items[0].followUps).toEqual([
    'Edited E2E follow-up',
    'Second E2E follow-up',
  ]);
  await expect(page.getByText('v2 · 현재').first()).toBeVisible();
  await expect(page.getByText('Edited E2E discussion goal')).toBeVisible();
  await expect(
    page
      .getByTestId('discussion-guide-facilitator-preview')
      .getByText('Edited E2E follow-up', { exact: true }),
  ).toBeVisible();
  expect(page.url()).not.toBe(firstGuideUrl);

  await page.goto(reflectionUrl);
  await expect(page.getByTestId('reflection-run-recovery')).toContainText('원래 발제안 version');
  await page.getByRole('button', { name: '토론 이어가기' }).click();
  await expect(page).toHaveURL(activeRunUrl);
  await expect(page.getByTestId('guided-discussion-page')).toBeVisible();
  await expectMobileReflectionWorkflow(page, 'guided-discussion-page');
  const composerHeight = await page
    .getByTestId('guided-discussion-draft')
    .locator('xpath=ancestor::section[contains(@class, "sticky")]')
    .evaluate((composer) => composer.getBoundingClientRect().height);
  expect(composerHeight).toBeLessThan(400);
  await page
    .getByTestId('guided-discussion-draft')
    .fill('The ritual makes authority feel intimate, but the hesitation keeps it unstable.');
  await page.getByRole('button', { name: '이 메모로 토론 마치기' }).click();
  const finishDialog = page.getByRole('alertdialog', { name: '토론을 마칠까요?' });
  await expect(finishDialog).toBeVisible();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/discussion-runs/') &&
        response.url().endsWith('/turns') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    finishDialog.getByRole('button', { name: '토론 마치기' }).click(),
  ]);
  await expect(page.getByTestId('reflection-refine-page')).toBeVisible();
  await expectMobileReflectionWorkflow(page, 'reflection-refine-page');
  const refineUrl = page.url();

  await page.goto(reflectionUrl);
  await expect(page.getByTestId('reflection-run-recovery')).toContainText('시작한 발제안 version');
  await page.getByRole('button', { name: 'Reflection 다듬기' }).click();
  await expect(page).toHaveURL(refineUrl);
  await expect(page.getByTestId('reflection-refine-page')).toBeVisible();

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/discussion-runs/') &&
        response.url().endsWith('/refinement') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('reflection-keep-original').click(),
  ]);
  await expect(page.getByTestId('reflection-loop-page')).toContainText(
    'The edited ritual note keeps power intimate and dangerous.',
  );

  await page.getByTestId('portal-subnav-book-detail').click();
  await page.getByTestId('debate-topic-input').fill('How does ritual shape political authority?');
  const createRoomResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/session-windows') &&
      response.request().method() === 'POST' &&
      response.status() === 200,
  );
  await page.getByTestId('debate-enter-submit').click();
  const createRoomResponse = await createRoomResponsePromise;
  const createRoomRequest = createRoomResponse.request().postDataJSON();
  const selectedPersonaIds = createRoomRequest.personaIds as number[];
  expect(selectedPersonaIds).toHaveLength(2);
  expect((await createRoomResponse.json()).data.personaIds).toEqual(selectedPersonaIds);
  await expect(page.getByTestId('debate-page')).toBeVisible();
  await expect(page).toHaveURL(/\/book\/\d+\/debate\/\d+$/);
  const firstReplyResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/session-windows/') &&
      response.url().endsWith('/debate') &&
      response.request().method() === 'POST' &&
      response.status() === 200,
  );
  await page.getByTestId('debate-session-submit').click();
  const firstReplyResponse = await firstReplyResponsePromise;
  expect(firstReplyResponse.request().postDataJSON().personaId).toBe(selectedPersonaIds[0]);
  await expect(page.getByTestId('debate-message-list')).toContainText(
    'How does ritual shape political authority?',
  );
  await expect(page.getByTestId('debate-message-list')).toContainText('대학교수', {
    timeout: 20000,
  });
  const allRepliesResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/session-windows/') &&
      response.url().endsWith('/debate/all') &&
      response.request().method() === 'POST' &&
      response.status() === 200,
  );
  await page.getByTestId('debate-all-submit').click();
  const allRepliesResponse = await allRepliesResponsePromise;
  expect(allRepliesResponse.request().postDataJSON().personaIds).toEqual(selectedPersonaIds);
  await expect(page.getByTestId('debate-message-list')).toContainText('대학교수', {
    timeout: 20000,
  });
  await expect(page.getByTestId('debate-message-list')).toContainText('작가', {
    timeout: 20000,
  });

  const debateRoomUrl = page.url();
  const refreshedTimelinePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/reading-sessions/') &&
      response.request().method() === 'GET' &&
      response.status() === 200,
  );
  await page.reload();
  const refreshedTimeline = await refreshedTimelinePromise;
  const refreshedTimelineBody = await refreshedTimeline.json();
  const refreshedWindow = refreshedTimelineBody.data.windows.find(
    (window: { windowId: number }) => window.windowId === Number(debateRoomUrl.split('/').pop()),
  );
  expect(refreshedWindow.personaIds).toEqual(selectedPersonaIds);
  await expect(page.getByTestId('logout-submit')).toBeVisible();
  await expect(page.getByTestId('current-book-summary')).toContainText('Dune: Edited');
  await expect(page).toHaveURL(debateRoomUrl);
  await expect(page.getByTestId('debate-message-list')).toContainText(
    'How does ritual shape political authority?',
  );
  await expect(page.getByTestId('debate-message-list')).toContainText('대학교수');
  await expect(page.getByTestId('debate-message-list')).toContainText('작가');
});

test('supports manual registration and saved-book deletion from the page shell', async ({
  page,
}) => {
  await page.goto('/');
  await login(page);
  await expect(page.getByTestId('logout-submit')).toBeVisible();

  await page.getByTestId('manual-book-title-input').fill('Manual Margins Book');
  await page.getByTestId('manual-book-author-input').fill('Reader Author');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/books') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('manual-book-submit').click(),
  ]);
  await expect(page.getByTestId('book-list-page')).toContainText('Manual Margins Book');
  await expect(page.getByTestId('current-book-summary')).toContainText('Manual Margins Book');

  await page
    .getByTestId('saved-book-detail-link')
    .filter({ hasText: 'Manual Margins Book' })
    .click();
  await page.getByTestId('book-start-review').click();
  await expect(page.getByTestId('reflection-loop-page')).toBeVisible();
  await expect(page).toHaveURL(/\/book\/\d+\/reflection$/);
  await expect(page.getByTestId('current-book-summary')).toContainText(
    'Manual Margins Book reflection',
  );

  await page.getByTestId('portal-nav-book-search').click();
  await page.getByTestId('manual-book-title-input').fill('Second Manual Margins Book');
  await page.getByTestId('manual-book-author-input').fill('Second Reader Author');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/books') &&
        response.request().method() === 'POST' &&
        response.status() === 200,
    ),
    page.getByTestId('manual-book-submit').click(),
  ]);
  await expect(page.getByTestId('current-book-summary')).toContainText(
    'Second Manual Margins Book',
  );
  await expect(page.getByTestId('current-book-summary')).not.toContainText(
    'Manual Margins Book reflection',
  );

  await page
    .getByTestId('saved-book-row')
    .filter({ hasText: 'Second Manual Margins Book' })
    .getByTestId('saved-book-delete')
    .click();
  await expect(page.getByRole('alertdialog')).toContainText('Delete this item?');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/books/') &&
        response.request().method() === 'DELETE' &&
        response.status() === 200,
    ),
    page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click(),
  ]);
  await expect(page.getByTestId('book-list-page')).not.toContainText('Second Manual Margins Book');
});
