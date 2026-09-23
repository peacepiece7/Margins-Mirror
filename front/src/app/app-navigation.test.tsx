import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { AppNavigation } from './app-navigation';

describe('AppNavigation', () => {
  afterEach(cleanup);

  it('keeps a visible locale switch and familiar account, contact and logout actions', () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider>
        <MemoryRouter>
          <AppNavigation
            onLogout={logout}
            session={{
              userId: 1,
              username: 'reader',
              displayName: 'Reader',
              preferredLocale: 'en',
              membershipTier: 'FREE',
              authMode: 'local',
              accessToken: 'token',
              accessTokenExpiresInSeconds: 300,
            }}
          />
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByTestId('language-toggle')).toHaveTextContent('한국어');
    expect(screen.getByTestId('nav-contact').querySelector('svg')).toBeInTheDocument();
    expect(screen.getByTestId('nav-account').querySelector('svg')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('language-toggle'));
    expect(screen.getByTestId('language-toggle')).toHaveTextContent('English');
    expect(screen.getByTestId('language-toggle')).toHaveAccessibleName('English로 변경');
    expect(screen.getByTestId('nav-contact')).toBeVisible();
    expect(screen.getByTestId('nav-account')).toBeVisible();
    fireEvent.click(screen.getByTestId('logout-submit'));
    expect(logout).toHaveBeenCalledOnce();
  });
});
