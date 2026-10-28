import { test, expect } from '@playwright/test';
import { openStory, noOverflow } from './helpers';

const cases = [
  ['foundations', 'foundations-overview--overview'],
  ['buttons', 'components-actions-button--variants'],
  ['input-error', 'patterns-reading-experience--input-error'],
  ['feedback', 'components-feedback-alert--variants'],
  ['dialog', 'components-overlays-dialog--open'],
  ['books', 'patterns-books--long-title'],
  ['library-controls', 'patterns-books-librarycontrols--default'],
  ['ai-response', 'patterns-reading-experience--ai-partial'],
] as const;

for (const [name, id] of cases)
  test(name, async ({ page }, info) => {
    await openStory(page, info, id);
    if (name === 'foundations')
      await expect(page.locator('main[data-ready]')).toHaveAttribute('data-ready', 'true');
    if (name === 'dialog') await expect(page.getByRole('dialog')).toBeVisible();
    await noOverflow(page);
    await expect(page).toHaveScreenshot(name + '.png', { fullPage: true });
  });
