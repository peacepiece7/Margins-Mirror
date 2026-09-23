import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { AiProcessingNotice } from './ai-processing-notice';

describe('AiProcessingNotice', () => {
  it('offers a do-not-show-again checkbox and only persists when checked', async () => {
    const cookieWrites: string[] = [];
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: (value: string) => {
        cookieWrites.push(value);
      },
    });

    render(
      <I18nProvider>
        <AiProcessingNotice action="AI" dismissDays={7} storageKey="notice" />
      </I18nProvider>,
    );

    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    await screen.getByRole('button').click();
    expect(cookieWrites).toHaveLength(0);
  });

  it('persists the cookie when the checkbox is checked before closing', async () => {
    const cookieWrites: string[] = [];
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: (value: string) => {
        cookieWrites.push(value);
      },
    });

    render(
      <I18nProvider>
        <AiProcessingNotice action="AI" dismissDays={7} storageKey="notice" />
      </I18nProvider>,
    );

    await screen.getByRole('checkbox').click();
    await screen.getByRole('button').click();

    expect(cookieWrites.join('')).toContain('Max-Age=604800');
  });

  it('keeps the privacy link', () => {
    render(
      <I18nProvider>
        <AiProcessingNotice action="AI" />
      </I18nProvider>,
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', '/privacy');
  });

  it('keeps the message above right-aligned dismiss controls at every width', () => {
    const view = render(
      <I18nProvider>
        <AiProcessingNotice action="AI-assisted search" dismissDays={7} storageKey="notice" />
      </I18nProvider>,
    );

    const notice = view.container.querySelector('[data-testid="ai-processing-notice"]');
    const controls = screen.getByTestId('ai-processing-notice-controls');
    const checkbox = screen.getByRole('checkbox');
    expect(notice).toHaveClass('flex-col');
    expect(notice).not.toHaveClass('sm:flex-row');
    expect(controls).toHaveClass('justify-end');
    expect(checkbox?.closest('label')).not.toHaveClass('whitespace-nowrap');
  });
});
