import { test, expect, type Page } from '@playwright/test';
import { openStory, noOverflow } from './helpers';

test('gallery migration: compact fields preserve focus scale and manual zoom', async ({
  page,
  browser,
}, info) => {
  const checkFields = async (sample: Page) => {
    const width = sample.viewportSize()!.width;
    const coarse = await sample.evaluate(() => matchMedia('(pointer: coarse)').matches);
    const expectedSize = width < 768 || coarse ? '16px' : '14px';
    for (const [story, slot] of [
      ['components-forms-input--default', 'input'],
      ['components-forms-input--date', 'input'],
      ['components-forms-textarea--default', 'textarea'],
      ['components-forms-nativeselect--default', 'native-select'],
      ['components-forms-select--default', 'select-trigger'],
    ]) {
      await openStory(sample, info, story);
      const viewport = await sample.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport).not.toMatch(/maximum-scale|user-scalable/i);
      const field = sample.locator('[data-slot="' + slot + '"]');
      await expect(field).toHaveCSS('font-size', expectedSize);
      const scale = await sample.evaluate(() => visualViewport!.scale);
      await field.focus();
      await expect(field).toBeFocused();
      expect(await sample.evaluate(() => visualViewport!.scale)).toBe(scale);
      expect(await field.evaluate((el) => getComputedStyle(el).touchAction)).toMatch(
        /^(auto|manipulation)$/,
      );
      if (coarse) {
        const box = (await field.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      if (slot === 'native-select') {
        await field.selectOption('read');
        await expect(field).toHaveValue('read');
      } else if (slot === 'select-trigger') {
        await sample.keyboard.press('Space');
        const option = sample.getByRole('option', { name: /완독|Finished/, exact: true });
        await expect(option).toHaveCSS('font-size', expectedSize);
        await option.click();
        await expect(field).toContainText(/완독|Finished/);
        await expect(field).toBeFocused();
      }
      expect(await sample.evaluate(() => visualViewport!.scale)).toBe(scale);
      await noOverflow(sample);
    }
  };
  await checkFields(page);
  // A wide tablet must keep the coarse-pointer exception beyond the mobile breakpoint.
  if (info.project.name === 'ko-1440') {
    const tablet = await browser.newContext({
      viewport: { width: 1024, height: 900 },
      hasTouch: true,
      reducedMotion: 'reduce',
      baseURL: new URL(page.url()).origin,
    });
    try {
      await checkFields(await tablet.newPage());
    } finally {
      await tablet.close();
    }
  }
});

test('gallery migration: spacing, touch targets, motion, selected styles and keyboard', async ({
  page,
}, info) => {
  await openStory(page, info, 'components-content-card--default');
  await expect(page.locator('[data-slot="card-content"]')).toHaveCSS('padding-left', '16px');
  await openStory(page, info, 'components-actions-button--variants');
  await noOverflow(page);
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  if (touch)
    for (const button of await page.locator('[data-slot="button"]').all()) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  const first = page.locator('[data-ui="storybook-canvas"] button').first();
  expect(
    parseFloat(await first.evaluate((el) => getComputedStyle(el).transitionDuration)),
  ).toBeLessThan(0.001);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true,
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const idle = await first.evaluate((el) => getComputedStyle(el).backgroundColor);
  await first.hover();
  await expect(first).not.toHaveCSS('background-color', idle);
  await page.mouse.down();
  await expect(first).not.toHaveCSS('transform', 'none');
  await page.mouse.up();
  await openStory(page, info, 'components-navigation-tabs--default');
  const tabs = page.getByRole('tab');
  await tabs.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(1)).toHaveCSS('background-color', 'rgb(247, 244, 238)');
  await expect(tabs.nth(0)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await openStory(page, info, 'components-forms-checkbox--default');
  await page.getByRole('checkbox').focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('checkbox')).toBeChecked();
  await expect(page.getByRole('checkbox')).toHaveCSS('background-color', 'rgb(46, 58, 70)');
  await openStory(page, info, 'components-forms-select--default');
  const select = page.getByRole('combobox');
  await select.focus();
  await page.keyboard.press('Space');
  await page.getByRole('option', { name: /완독|Finished/ }).click();
  await expect(select).toContainText(/완독|Finished/);
  await expect(select).toBeFocused();
  if (touch)
    for (const target of await page.locator('[data-slot="select-trigger"]').all())
      expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('gallery migration: validation, pending, saved and preserved input after failure', async ({
  page,
}, info) => {
  await openStory(page, info, 'patterns-reading-experience--saving-failure');
  const title = page.getByRole('textbox', { name: /제목|Title/ });
  await page.getByRole('button', { name: /저장하기|Save note/ }).click();
  await expect(title).toHaveAttribute('aria-invalid', 'true');
  const errorId = await title.getAttribute('aria-describedby');
  await expect(page.locator(`[id="${errorId}"]`)).toHaveText(/제목을 입력|Enter a title/);
  await title.fill('Preserved reading note');
  await page.getByRole('button', { name: /저장하기|Save note/ }).click();
  await expect(page.getByRole('button', { name: /저장 중|Saving/ })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText(/유지됩니다|kept/);
  await expect(title).toHaveValue('Preserved reading note');
  await page.getByRole('button', { name: /저장하기|Save note/ }).click();
  await expect(page.getByRole('status')).toContainText('Preserved reading note');
});

test('saved feedback retains the submitted title while the draft changes', async ({
  page,
}, info) => {
  await openStory(page, info, 'patterns-reading-experience--input-saving');
  const title = page.getByRole('textbox', { name: /제목|Title/ });
  await title.fill('Submitted title');
  await page.getByRole('button', { name: /저장하기|Save note/ }).click();
  await expect(page.getByRole('button', { name: /저장 중|Saving/ })).toBeDisabled();
  await title.fill('Draft during save');
  await expect(page.getByRole('status')).toHaveText(/(?:저장 완료|Saved) · Submitted title/);
  await expect(title).toHaveValue('Draft during save');
  await title.fill('Draft after save');
  await expect(page.getByRole('status')).toHaveText(/(?:저장 완료|Saved) · Submitted title/);
  await page.getByRole('button', { name: /저장하기|Save note/ }).click();
  await expect(page.getByRole('status')).toHaveText(/(?:저장 완료|Saved) · Draft after save/);
});

test('gallery migration: dialog bounds, scroll, Escape, cancel and focus restoration', async ({
  page,
}, info) => {
  await openStory(page, info, 'components-overlays-dialog--default');
  const trigger = page.getByRole('button', { name: /상세 보기|View details/ });
  await trigger.click();
  const dialog = page.getByRole('dialog'),
    box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(15);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width - 15);
  expect(box.height).toBeLessThanOrEqual(868);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await openStory(page, info, 'patterns-reading-experience--deletion-confirmation');
  const remove = page.getByRole('button', { name: /삭제 확인 열기|Confirm deletion/ });
  await remove.click();
  await page.getByRole('button', { name: /취소|Cancel/ }).click();
  await expect(remove).toBeFocused();
  await remove.click();
  await page.getByRole('button', { name: /삭제하기|^Delete$/ }).click();
  await expect(page.getByRole('button', { name: /삭제 중|Deleting/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /취소|Cancel/ })).toBeDisabled();
  await expect(page.getByRole('alertdialog')).toContainText(/삭제하지 못했습니다|Deletion failed/);
  await page.getByRole('button', { name: /삭제하기|^Delete$/ }).click();
  await expect(page.getByRole('status')).toContainText(/삭제했습니다|deleted/);
  await expect(remove).toBeFocused();
});

test('long content and book rating touch targets do not overlap', async ({ page }, info) => {
  for (const id of [
    'components-feedback-alert--long-content',
    'components-content-markdowncontent--long-content',
    'patterns-reading-experience--workspace-composition',
    'patterns-books--long-title',
  ]) {
    await openStory(page, info, id);
    await noOverflow(page);
  }
  if (await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) {
    const buttons = page.getByRole('button', { name: /stars$/ }),
      boxes = [];
    for (const button of await buttons.all()) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      for (const other of boxes)
        expect(
          box.x >= other.x + other.width ||
            box.x + box.width <= other.x ||
            box.y >= other.y + other.height ||
            box.y + box.height <= other.y,
        ).toBe(true);
      boxes.push(box);
    }
    await page.getByRole('button', { name: '4.5 stars', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('4.5');
  }
});

test('static stories stay local and remount without cookie or component state leakage', async ({
  page,
}, info) => {
  const unexpected: string[] = [],
    errors: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.protocol.startsWith('http') &&
      (url.hostname !== '127.0.0.1' || url.pathname.startsWith('/api/'))
    )
      unexpected.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await openStory(page, info, 'components-integrations-turnstilewidget--default');
  await page.getByRole('button', { name: 'ready', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(/인증 완료|verified/);
  await openStory(page, info, 'patterns-reading-experience--input-saving');
  await page.getByRole('textbox', { name: /제목|Title/ }).fill('Should reset');
  await openStory(page, info, 'patterns-reading-experience--empty');
  await openStory(page, info, 'patterns-reading-experience--input-saving');
  await expect(page.getByRole('textbox', { name: /제목|Title/ })).toHaveValue('');
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(() => document.fonts.check('400 16px "Noto Sans KR Variable"', '여백')),
  ).toBe(true);
});
