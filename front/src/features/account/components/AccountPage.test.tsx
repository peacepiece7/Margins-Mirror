import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { accountApi } from '../api';
import { AccountPage } from './AccountPage';

vi.mock('../api', () => ({
  accountApi: {
    consentStatus: vi.fn(),
    get: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

describe('AccountPage profile', () => {
  beforeEach(() => {
    window.localStorage.setItem('margins.locale', 'en');
    vi.clearAllMocks();
    vi.mocked(accountApi.get).mockResolvedValue({
      userId: 1,
      username: 'reader',
      displayName: 'Reader',
      email: 'reader@example.com',
      authProvider: 'local',
      accountStatus: 'ACTIVE',
      preferredLocale: 'en',
    });
    vi.mocked(accountApi.consentStatus).mockResolvedValue({
      acceptedVersions: {
        PRIVACY_POLICY: '2026-07-27',
        OPENAI_OVERSEAS_TRANSFER: '2026-07-27',
        AGE_OVER_14: '2026-07-27',
      },
      consentRequired: false,
      missingConsentTypes: [],
    });
    vi.mocked(accountApi.updateProfile).mockResolvedValue({
      account: {
        userId: 1,
        username: 'reader',
        displayName: 'Reader Name',
        email: 'reader@example.com',
        authProvider: 'local',
        accountStatus: 'ACTIVE',
        preferredLocale: 'en',
      },
    });
  });

  it('keeps username read-only and submits displayName only', async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <I18nProvider>
          <MemoryRouter>
            <AccountPage />
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByLabelText('Username')).toHaveAttribute('readonly');
    expect(screen.getByRole('navigation', { name: 'Account settings' })).toBeVisible();
    expect(await screen.findByText('Required consent is up to date.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'Service Terms →' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Service Terms History →' })).toHaveAttribute(
      'href',
      '/terms/history',
    );
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Reader Name' },
    });
    fireEvent.click(screen.getByTestId('account-profile-save'));

    await waitFor(() =>
      expect(accountApi.updateProfile).toHaveBeenCalledWith({
        displayName: 'Reader Name',
        preferredLocale: 'en',
      }),
    );
  });

  it('keeps the account form usable when the consent summary cannot load', async () => {
    vi.mocked(accountApi.consentStatus).mockRejectedValue(new Error('unavailable'));
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <I18nProvider>
          <MemoryRouter>
            <AccountPage />
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Consent status could not be loaded.')).toHaveAttribute(
      'role',
      'alert',
    );
    expect(await screen.findByLabelText('Display name')).toBeEnabled();
  });
});
