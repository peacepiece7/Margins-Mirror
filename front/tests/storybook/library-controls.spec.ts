import { expect, test } from '@playwright/test';

import { noOverflow, openStory } from './helpers';

const storyId = 'patterns-books-librarycontrols--default';

test('library selects and destructive actions stay clear and usable', async ({
  page,
  browserName,
}, info) => {
  await openStory(page, info, storyId);
  await noOverflow(page);

  const sort = page.locator('select[name="book-shelf-sort"]');
  await expect(sort).toHaveAttribute('id', /^book-shelf-sort-/);
  await expect(sort).toHaveAttribute('name', 'book-shelf-sort');
  await expect(sort).toHaveAccessibleName(/.+/);

  const sortOptionsFit = await sort.evaluate((element) => {
    const select = element as HTMLSelectElement;
    const style = window.getComputedStyle(select);
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return false;
    context.font = style.font;
    const textWidth =
      select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return Array.from(select.options).every(
      (option) => context.measureText(option.label).width <= textWidth,
    );
  });
  expect(sortOptionsFit).toBe(true);

  const status = page.locator('[id^="book-status-401-"]');
  await expect(status).toHaveAttribute('id', /^book-status-401-/);
  await expect(status).toHaveAccessibleName(/.+/);
  await expect(page.locator('[id^="book-status-402-"]')).toHaveAttribute('id', /^book-status-402-/);

  const statusArrow = status.locator('svg.lucide-chevron-down');
  const statusBounds = await status.boundingBox();
  const statusArrowBounds = await statusArrow.boundingBox();
  expect(statusBounds).not.toBeNull();
  expect(statusArrowBounds).not.toBeNull();
  expect(
    statusBounds!.x + statusBounds!.width - (statusArrowBounds!.x + statusArrowBounds!.width),
  ).toBeGreaterThanOrEqual(8);

  const ids = await page
    .locator('[id]')
    .evaluateAll((elements) => elements.map((element) => (element as HTMLElement).id));
  expect(new Set(ids).size).toBe(ids.length);
  expect(
    await page
      .locator('select')
      .evaluateAll((fields) =>
        fields.every(
          (field) => (field as HTMLSelectElement).id || (field as HTMLSelectElement).name,
        ),
      ),
  ).toBe(true);

  const arrow = sort.locator('..').locator('svg.lucide-chevron-down');
  const sortBounds = await sort.boundingBox();
  const arrowBounds = await arrow.boundingBox();
  expect(sortBounds).not.toBeNull();
  expect(arrowBounds).not.toBeNull();
  const rightGap = sortBounds!.x + sortBounds!.width - (arrowBounds!.x + arrowBounds!.width);
  expect(rightGap).toBeGreaterThanOrEqual(8);

  await page.keyboard.press('Tab');
  await expect(sort).toBeFocused();
  await sort.selectOption('title_asc');
  await expect(sort).toHaveValue('title_asc');

  await status.focus();
  await expect(status).toBeFocused();
  const statusFocusRing = await status.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(statusFocusRing).not.toBe('none');
  await status.press('ArrowDown');
  const dnfOption = page.getByRole('option', { name: /^미완독$|^Did not finish$/ });
  await expect(dnfOption).toBeVisible();
  const statusList = page.getByRole('listbox');
  const statusListBounds = await statusList.boundingBox();
  expect(statusListBounds).not.toBeNull();
  expect(statusListBounds!.x).toBeGreaterThanOrEqual(0);
  expect(statusListBounds!.x + statusListBounds!.width).toBeLessThanOrEqual(
    page.viewportSize()?.width ?? 320,
  );
  const statusOptionsFit = await page.getByRole('option').evaluateAll((options) =>
    options.every((element) => {
      const option = element as HTMLElement;
      const bounds = option.getBoundingClientRect();
      return (
        option.scrollWidth <= option.clientWidth && bounds.left >= 0 && bounds.right <= innerWidth
      );
    }),
  );
  expect(statusOptionsFit).toBe(true);
  await page.keyboard.press('End');
  await expect(dnfOption).toHaveAttribute('data-highlighted', '');
  await page.keyboard.press('Enter');
  await expect(status).toHaveText(/미완독|Did not finish/);
  await expect(status).toBeFocused();

  const deleteButton = page
    .locator('button[data-slot="button"][data-variant="destructive"]')
    .first();
  const restingColor = await deleteButton.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  const enabledOpacity = await deleteButton.evaluate((element) =>
    Number(getComputedStyle(element).opacity),
  );
  const actionSurface = await deleteButton.evaluate(
    (element) => getComputedStyle(element.parentElement!).backgroundColor,
  );
  expect(restingColor).not.toBe(actionSurface);
  await deleteButton.hover();
  await expect
    .poll(() => deleteButton.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe(restingColor);

  if (browserName === 'webkit') {
    // macOS WebKit's default Tab order in this runner skips buttons; verify keyboard focus directly.
    await deleteButton.focus();
  } else {
    let deleteButtonReached = false;
    for (let index = 0; index < 32; index += 1) {
      await page.keyboard.press('Tab');
      if (await deleteButton.evaluate((element) => element === document.activeElement)) {
        deleteButtonReached = true;
        break;
      }
    }
    expect(deleteButtonReached).toBe(true);
  }
  await expect(deleteButton).toBeFocused();
  const focusRing = await deleteButton.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(focusRing).not.toBe('none');

  await page.keyboard.press('Enter');
  const cancelDialog = page.getByRole('alertdialog');
  await expect(cancelDialog).toBeVisible();
  await cancelDialog.getByRole('button', { name: /취소|Cancel/ }).focus();
  await page.keyboard.press('Enter');
  await expect(cancelDialog).toBeHidden();
  await expect(deleteButton).toBeFocused();

  await page.keyboard.press('Enter');
  const confirmDialog = page.getByRole('alertdialog');
  const confirmButton = confirmDialog.getByRole('button', { name: /삭제|Delete/ });
  await confirmButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText(/삭제 완료|Book removed/);
  await noOverflow(page);

  await openStory(page, info, 'patterns-books-librarycontrols--loading');
  const disabledStatus = page.locator('[id^="book-status-401-"]');
  const disabledDelete = page
    .locator('button[data-slot="button"][data-variant="destructive"]')
    .first();
  await expect(disabledStatus).toBeDisabled();
  await expect(disabledDelete).toBeDisabled();
  const disabledPresentation = await disabledDelete.evaluate((element) => {
    const style = getComputedStyle(element);
    const channels = (value: string) =>
      value
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number) ?? [];
    const luminance = (value: string) =>
      channels(value)
        .map((channel) => channel / 255)
        .map((channel) =>
          channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
        )
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return {
      contrast:
        (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
      opacity: Number(style.opacity),
    };
  });
  expect(disabledPresentation.opacity).toBe(enabledOpacity);
  expect(disabledPresentation.contrast).toBeGreaterThanOrEqual(4.5);
});
