import { test, expect, type Page, type TestInfo } from '@playwright/test';

async function openDocs(page: Page, info: TestInfo, prefix: string) {
  const index = await (await page.request.get('/index.json')).json();
  const entry = Object.values(index.entries).find((item) => {
    const entry = item as { type: string; id: string };
    return entry.type === 'docs' && entry.id.startsWith(prefix + '--');
  }) as { id: string } | undefined;
  expect(entry, prefix).toBeDefined();
  const locale = info.project.name.startsWith('en-') ? 'en' : 'ko';
  await page.goto(`/iframe.html?id=${entry!.id}&viewMode=docs&globals=locale:${locale}`);
  const storyCount = Object.values(index.entries).filter((item) => {
    const story = item as { type: string; id: string };
    return story.type === 'story' && story.id.startsWith(prefix + '--');
  }).length;
  await expect(page.locator('[data-ui="storybook-canvas"]')).toHaveCount(
    storyCount === 1 ? 1 : storyCount + 1,
  );
}

for (const id of [
  'components-forms-input',
  'components-forms-textarea',
  'components-forms-checkbox',
  'components-forms-form',
  'components-forms-label',
  'components-forms-nativeselect',
  'components-forms-select',
  'components-forms-radiogroup',
  'components-navigation-skiplink',
  'foundations-overview',
  'patterns-reading-experience',
  'patterns-books',
  'patterns-books-librarycontrols',
]) {
  test(`inline Docs references belong to each mounted example: ${id}`, async ({ page }, info) => {
    await openDocs(page, info, id);
    const examples = page.locator('[data-ui="storybook-canvas"]');
    await expect(examples.first()).toBeVisible();
    const invalidReferences = await examples.evaluateAll((samples) => {
      const failures: string[] = [];
      for (const sample of samples) {
        for (const element of sample.querySelectorAll('[id]')) {
          if (document.querySelectorAll(`[id="${element.id}"]`).length !== 1)
            failures.push(`duplicate: ${element.id}`);
        }
        for (const element of sample.querySelectorAll(
          '[for], [aria-describedby], [aria-labelledby], a[href^="#"]',
        )) {
          const references = [
            element.getAttribute('for'),
            element.getAttribute('aria-describedby'),
            element.getAttribute('aria-labelledby'),
            element.getAttribute('href')?.slice(1),
          ]
            .filter(Boolean)
            .flatMap((value) => value!.split(/\s+/));
          for (const reference of references) {
            if (!sample.contains(document.getElementById(reference)))
              failures.push(`outside example: ${reference}`);
          }
        }
      }
      return failures;
    });
    expect(invalidReferences, id).toEqual([]);
    for (const example of await examples.all()) {
      const label = example.locator('label[for]').first();
      if (!(await label.count())) continue;
      const targetId = await label.getAttribute('for');
      const target = example.locator(`[id="${targetId}"]`);
      if (await target.isDisabled()) continue;
      await label.click();
      // Select labels activate a popup; the association above covers their target.
      if ((await target.getAttribute('data-slot')) !== 'select-trigger')
        await expect(target).toBeFocused();
      await page.keyboard.press('Escape');
    }
  });
}

test('Dialog Docs remain usable while the open example traps focus in its frame', async ({
  page,
}, info) => {
  await openDocs(page, info, 'components-overlays-dialog');
  await expect(page.locator('[data-ui="storybook-canvas"]')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Dialog', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const openExample = page.frameLocator('iframe[data-ui="storybook-dialog-frame"]');
  const english = info.project.name.startsWith('en-');
  await expect(openExample.locator('html')).toHaveAttribute('lang', english ? 'en' : 'ko');
  await expect(openExample.getByRole('heading')).toHaveText(
    english ? 'Preview note' : '기록 미리보기',
  );
  await expect(openExample.getByRole('dialog')).toBeVisible();
  const trigger = page.locator('[data-ui="storybook-canvas"]').first().getByRole('button');
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(openExample.getByRole('dialog')).toBeVisible();
});

test('inline Turnstile widgets keep independent token and status', async ({ page }, info) => {
  const externalRequests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).hostname === 'challenges.cloudflare.com')
      externalRequests.push(request.url());
  });
  await openDocs(page, info, 'components-integrations-turnstilewidget');
  const examples = page.locator('[data-ui="storybook-canvas"]');
  await expect(examples).toHaveCount(3);
  const first = examples.nth(0),
    second = examples.nth(1);
  await first.getByRole('button', { name: 'ready', exact: true }).click();
  await expect(first.getByRole('status')).toContainText(/인증 완료|verified/);
  await expect(second.getByRole('status')).toContainText(/토큰 없음|No example token/);
  await second.getByRole('button', { name: 'ready', exact: true }).click();
  await expect(second.getByRole('status')).toContainText(/인증 완료|verified/);
  await first.getByRole('button', { name: 'expired', exact: true }).click();
  await expect(first.getByRole('status')).toContainText(/토큰 없음|No example token/);
  await expect(second.getByRole('status')).toContainText(/인증 완료|verified/);
  await first.getByRole('button', { name: 'error', exact: true }).click();
  await expect(first.getByText(/확인을 불러오지|check could not load/i)).toBeVisible();
  await expect(second.getByText(/확인을 불러오지|check could not load/i)).toHaveCount(0);
  await second.getByRole('button', { name: 'expired', exact: true }).click();
  await expect(second.getByRole('status')).toContainText(/토큰 없음|No example token/);
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});
