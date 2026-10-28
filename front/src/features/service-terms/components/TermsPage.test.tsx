import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { TermsHistoryPage } from './TermsHistoryPage';
import { TermsPage } from './TermsPage';

function renderPage(page: React.ReactNode) {
  return render(
    <MemoryRouter>
      <I18nProvider>{page}</I18nProvider>
    </MemoryRouter>,
  );
}

describe('service terms publication foundation', () => {
  // BDD: TERM-021
  it('shows an unpublished state without presenting acceptance controls', () => {
    const { container } = renderPage(<TermsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Service Terms' })).toBeVisible();
    expect(screen.getByText('No version is published yet')).toBeVisible();
    expect(screen.getByText(/No Service Terms acceptance is currently requested/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'View Service Terms history' })).toHaveAttribute(
      'href',
      '/terms/history',
    );
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(container.querySelector('input[type="checkbox"]')).not.toBeInTheDocument();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  // BDD: TERM-021
  it('shows no fabricated version in history', () => {
    const { container } = renderPage(<TermsHistoryPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Service Terms History' })).toBeVisible();
    expect(screen.getByText('There are no published versions.')).toBeVisible();
    expect(container).not.toHaveTextContent(/effective date/i);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });
});
