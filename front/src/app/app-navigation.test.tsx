import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { AppNavigation } from './app-navigation';

describe('AppNavigation', () => {
  afterEach(cleanup);

  it('keeps account, contact and logout while exposing no UI-only locale toggle', () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider>
        <MemoryRouter>
          <AppNavigation
            activeApp="margins"
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

    expect(screen.queryByTestId('language-toggle')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-contact')).toBeVisible();
    expect(screen.getByTestId('nav-account')).toBeVisible();
    fireEvent.click(screen.getByTestId('logout-submit'));
    expect(logout).toHaveBeenCalledOnce();
  });
});
