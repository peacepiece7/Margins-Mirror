import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl =
  process.env.MARGINS_FRONT_URL ||
  `http://localhost:${process.env.MARGINS_FRONTEND_PORT || '5173'}`;
const backUrl =
  process.env.MARGINS_BACKEND_URL || process.env.MARGINS_BACK_URL || 'http://localhost:8080';
const outputDir = resolve(process.cwd(), '..', 'harness', 'artifacts', 'screenshots');

async function selectComposerMode(page, label) {
  const modeTabs = page.getByTestId('composer-mode-tabs');
  if (await modeTabs.isVisible()) {
    await page.getByTestId('composer-mode-tab').filter({ hasText: label }).click();
  }
}

async function setupWorkbench(page, request) {
  const reset = await request.post(`${backUrl}/api/test/reset`);
  if (!reset.ok()) {
    throw new Error(`Test reset failed: ${reset.status()}`);
  }

  await page.goto(baseUrl);
  await page.getByTestId('login-submit').click();
  await page.getByTestId('book-search-input').fill('Dune');
  await page.getByTestId('book-search-submit').click();
  await page.getByTestId('candidate-select').first().click();
  await page.getByTestId('generate-questions').click();
  await page.getByTestId('question-select').first().click();
  await page.getByTestId('reading-goal-input').fill('Track power and prophecy.');
  await page.getByTestId('start-page-input').fill('1');
  await page.getByTestId('current-page-input').fill('48');
  await page.getByTestId('target-page-input').fill('120');
  await page.getByTestId('progress-note-input').fill('Ritual and threat shape the opening.');
  await page.getByTestId('progress-save-submit').click();
  await page.getByTestId('highlight-page-input').fill('48');
  await page.getByTestId('highlight-location-input').fill('Opening ritual');
  await page
    .getByTestId('highlight-quote-input')
    .fill('A beginning is the time for taking the most delicate care.');
  await page.getByTestId('highlight-note-input').fill('Evidence for the session focus.');
  await page.getByTestId('highlight-save-submit').click();
  await page.getByTestId('message-input').fill('What does the opening suggest?');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByTestId('review-readiness-score').waitFor({ state: 'visible' });
}

async function setupCompletedReview(page, request) {
  await setupWorkbench(page, request);
  await page.getByTestId('window-tab-debate').click();
  await selectComposerMode(page, 'Persona');
  await page.getByTestId('debate-input').fill('Challenge this reading');
  await page.getByTestId('debate-submit').click();
  await page.getByTestId('message-list').getByText('임시 토론 응답').waitFor();
  await page
    .getByTestId('session-summary-input')
    .fill('Dune closeout: institutions and prophecy feel unresolved.');
  await page.getByTestId('session-complete-submit').click();
  await page.getByTestId('session-review').waitFor({ state: 'visible' });
  await page.getByTestId('review-insight-type').selectOption('theme');
  await page.getByTestId('review-insight-title').fill('Ritual before politics');
  await page
    .getByTestId('review-insight-content')
    .fill('The opening turns power into a ceremony before explaining the empire.');
  await page.getByTestId('review-insight-evidence').fill('Gom Jabbar scene');
  await page.getByTestId('review-insight-submit').click();
  await page.getByTestId('review-insights').getByText('Ritual before politics').waitFor();
}

async function capture(viewport, filename, setup = setupWorkbench) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const request = context.request;
  await setup(page, request);
  await page.screenshot({ path: resolve(outputDir, filename), fullPage: true });
  await browser.close();
}

await mkdir(outputDir, { recursive: true });
await capture({ width: 1440, height: 1100 }, 'session-workbench-desktop.png');
await capture({ width: 390, height: 1200 }, 'session-workbench-mobile.png');
await capture({ width: 1440, height: 1100 }, 'session-review-desktop.png', setupCompletedReview);
await capture({ width: 390, height: 1200 }, 'session-review-mobile.png', setupCompletedReview);
console.log(`Screenshots written to ${outputDir}`);
