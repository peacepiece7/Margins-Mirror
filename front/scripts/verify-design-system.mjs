import assert from 'node:assert/strict';
import { mkdir, access, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';

// Exercise real React primitives against bundled CSS; no auth or backend required.
await access('dist-design-system/design-system.html');
await access('dist/index.html');
assert.equal(
  (await readdir('dist')).includes('design-system.html'),
  false,
  'Default build excludes gallery HTML',
);
for (const name of await readdir('dist/assets')) {
  if (!name.endsWith('.js')) continue;
  assert.equal(
    (await readFile(resolve('dist/assets', name), 'utf8')).includes('읽는 경험을 위한 공통 언어'),
    false,
    'Default build excludes gallery code',
  );
}
const output = resolve('..', '.artifacts', 'design-system');
await mkdir(output, { recursive: true });
const server = await preview({
  configFile: false,
  root: process.cwd(),
  build: { outDir: 'dist-design-system' },
  preview: { host: '127.0.0.1', port: 0 },
});
const address = server.httpServer.address();
const url = `http://127.0.0.1:${address.port}/design-system.html`;
const browser = await chromium.launch();
const errors = [];
const persistentSurfaces = [
  'app-download-notice',
  'app-download-action',
  'book-question-panel',
  'book-debate-entry',
];
const appAssets = await readdir('dist/assets');
const appJs = (
  await Promise.all(
    appAssets
      .filter((name) => name.endsWith('.js'))
      .map((name) => readFile(resolve('dist/assets', name), 'utf8')),
  )
).join('\n');
const appCss = (
  await Promise.all(
    appAssets
      .filter((name) => name.endsWith('.css'))
      .map((name) => readFile(resolve('dist/assets', name), 'utf8')),
  )
).join('\n');
assert.equal(
  appCss.includes('[data-testid'),
  false,
  'Production styles must not depend on stripped selectors',
);
for (const id of persistentSurfaces) {
  assert.ok(appJs.includes(`"data-ui":"${id}"`), `Production preserves ${id} styling hook`);
  assert.ok(
    appCss.includes(`data-ui=${id}`) || appCss.includes(`data-ui="${id}"`),
    `Production CSS targets ${id}`,
  );
}
try {
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width < 768,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `${width}px page overflow`,
    );
    const content = page.locator('[data-slot="card-content"]').first();
    assert.equal(
      await content.evaluate((el) => getComputedStyle(el).paddingLeft),
      '16px',
      'Card padding compiles',
    );
    const button = page.getByRole('button', { name: '기록 추가', exact: true });
    if (width < 768) {
      for (const selector of [
        '[data-slot="button"]',
        '[data-slot="input"]',
        '[data-slot="tabs-trigger"]',
        '[data-slot="select-trigger"]',
      ]) {
        for (const el of await page.locator(selector).all()) {
          const box = await el.boundingBox();
          if (box)
            assert.ok(
              box.width >= 44 && box.height >= 44,
              `${width}px touch target ${selector}: ${JSON.stringify(box)}`,
            );
        }
      }
    }
    assert.ok(
      parseFloat(await button.evaluate((el) => getComputedStyle(el).transitionDuration)) < 0.001,
      'Reduced motion removes transitions',
    );
    const record = page.getByRole('tab', { name: '기록', exact: true });
    const discussion = page.getByRole('tab', { name: '대화', exact: true });
    await record.focus();
    await page.keyboard.press('ArrowRight');
    await expect(discussion).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toContainText('다양한 관점');
    await expect(discussion).toHaveCSS('background-color', 'rgb(247, 244, 238)');
    await expect(record).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    const checkbox = page.getByRole('checkbox', { name: '나중에 다시 읽기' });
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toHaveCSS('background-color', 'rgb(46, 58, 70)');
    const select = page.getByRole('combobox', { name: '독서 상태' });
    await select.click();
    await page.getByRole('option', { name: '완독', exact: true }).click();
    await expect(select).toContainText('완독');
    await page.getByRole('button', { name: '저장하기', exact: true }).click();
    await expect(page.getByText('제목을 입력해 주세요.', { exact: true })).toBeVisible();
    await page.getByLabel('제목 (필수)', { exact: true }).fill('브라우저 검증 기록');
    await page.getByRole('button', { name: '저장하기', exact: true }).click();
    await expect(
      page
        .locator('#sample-form')
        .locator('..')
        .locator('..')
        .getByRole('button', { name: '저장 중' }),
    ).toBeDisabled();
    await expect(page.getByRole('status').filter({ hasText: '브라우저 검증 기록' })).toBeVisible();
    const trigger = page.getByRole('button', { name: '상세 보기', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    assert.ok(box.x >= 15 && box.x + box.width <= width - 15, `${width}px dialog inset`);
    assert.ok(box.height <= 868, 'Dialog fits dynamic viewport');
    assert.equal(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
      'Long content wraps',
    );
    await page.screenshot({ path: resolve(output, `dialog-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    const remove = page.getByRole('button', { name: '삭제 확인 열기', exact: true });
    await remove.click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(remove).toBeFocused();
    await remove.click();
    await page.getByRole('button', { name: '삭제하기', exact: true }).click();
    await expect(page.getByRole('button', { name: '삭제 중', exact: true })).toBeDisabled();
    await expect(page.getByText('예시 기록을 삭제했습니다.', { exact: true })).toBeVisible();
    await page.screenshot({ path: resolve(output, `gallery-${width}.png`), fullPage: true });
    console.log(
      `PASS ${width}px: spacing, touch, motion, selection, validation, pending, saved, dialog/focus, confirmation`,
    );
    await context.close();
  }
  assert.deepEqual(errors, [], 'Unexpected browser errors');
  console.log(`PASS: production gallery UI; screenshots ${output}`);
} finally {
  await browser.close();
  await new Promise((done) => server.httpServer.close(done));
}
