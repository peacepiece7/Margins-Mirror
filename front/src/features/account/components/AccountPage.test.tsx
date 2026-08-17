import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { accountApi } from '../api';
import { AccountPage } from './AccountPage';

vi.mock('../api', () => ({
  accountApi: {
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
    });
    vi.mocked(accountApi.updateProfile).mockResolvedValue({
      account: {
        userId: 1,
        username: 'reader',
        displayName: 'Reader Name',
        email: 'reader@example.com',
        authProvider: 'local',
        accountStatus: 'ACTIVE',
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
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Reader Name' },
    });
    fireEvent.click(screen.getByTestId('account-profile-save'));

    await waitFor(() =>
      expect(accountApi.updateProfile).toHaveBeenCalledWith({ displayName: 'Reader Name' }),
    );
  });
});
