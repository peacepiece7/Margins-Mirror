import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';
import { ApiRequestError } from '@/lib/api-client';
import { readAuthSession, writeAuthSession } from '@/lib/auth-session';
import { privacyApi } from '../api';
import { ConsentPage } from './ConsentPage';

vi.mock('../api', () => ({
  privacyApi: {
    status: vi.fn(),
    grant: vi.fn(),
    completeGoogleRegistration: vi.fn(),
  },
}));

describe('ConsentPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('margins.locale', 'en');
    window.sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(privacyApi.status).mockResolvedValue({
      acceptedVersions: {},
      missingConsentTypes: ['PRIVACY_POLICY'],
      consentRequired: true,
    });
    vi.mocked(privacyApi.grant).mockResolvedValue({
      acceptedVersions: {
        PRIVACY_POLICY: '2026-07-27',
        OPENAI_OVERSEAS_TRANSFER: '2026-07-27',
        AGE_OVER_14: '2026-07-27',
      },
      missingConsentTypes: [],
      consentRequired: false,
    });
  });

  it('updates the cached session before leaving consent so the route does not bounce back', async () => {
    writeAuthSession({
      userId: 1,
      username: 'reader',
      displayName: 'Reader',
      authMode: 'local-jwt',
      accessToken: 'token',
      accessTokenExpiresInSeconds: 900,
      consentRequired: true,
    });

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/consent']}>
          <Routes>
            <Route path="/consent" element={<ConsentPage />} />
            <Route path="/" element={<div>Library</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Required consent' })).toBeVisible();
    screen.getAllByRole('checkbox').forEach((checkbox) => fireEvent.click(checkbox));
    fireEvent.click(screen.getByRole('button', { name: 'Agree and continue' }));

    expect(await screen.findByText('Library')).toBeVisible();
    expect(privacyApi.grant).toHaveBeenCalledTimes(1);
    expect(readAuthSession()?.consentRequired).toBe(false);
  });

  it('loads consent status only once during a stable render', async () => {
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/consent']}>
          <Routes>
            <Route path="/consent" element={<ConsentPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    await waitFor(() => expect(privacyApi.status).toHaveBeenCalledTimes(1));
  });

  it('explains an existing email conflict without exposing the backend message', async () => {
    window.localStorage.setItem('margins.locale', 'ko');
    vi.mocked(privacyApi.completeGoogleRegistration).mockRejectedValue(
      new ApiRequestError('AUTH_GOOGLE_LINK_REQUIRED', 409),
    );

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/consent?registration=google']}>
          <Routes>
            <Route path="/consent" element={<ConsentPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    screen.getAllByRole('checkbox').forEach((checkbox) => fireEvent.click(checkbox));
    fireEvent.click(screen.getByRole('button', { name: '동의하고 계속' }));

    expect(
      await screen.findByText('이미 사용 중인 이메일입니다. 기존 계정으로 로그인해 주세요.'),
    ).toBeVisible();
    expect(screen.queryByText('AUTH_GOOGLE_LINK_REQUIRED')).not.toBeInTheDocument();
  });
});
