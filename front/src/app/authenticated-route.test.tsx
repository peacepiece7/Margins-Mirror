import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AuthBoundary } from '../features/auth/components/AuthBoundary';
import { PublicLandingPage } from '../features/landing/components/PublicLandingPage';
import { authApi } from '../features/auth/api';
import * as authSessionService from '../features/auth/session';
import { I18nProvider } from '@/lib/i18n';
import { bookKeys, protectedQueryRoots } from '@/lib/query-keys';
import { ApiRequestError } from '@/lib/api-client';

import { AuthenticatedAppShell } from './authenticated-app-shell';
import { PremiumRoute } from './premium-route';
import { MemoryCardApp } from '../features/memory-cards/components/MemoryCardApp';

vi.mock('../features/auth/api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    createRegistrationIntent: vi.fn(),
    requestEmailVerification: vi.fn(),
    confirmEmailVerification: vi.fn(),
    checkEmailAvailability: vi.fn(),
    checkPhoneAvailability: vi.fn(),
    refresh: vi.fn(),
    googleOAuthStartUrl: vi.fn(() => '/api/auth/oauth/google/start'),
    logout: vi.fn(),
  },
}));

vi.mock('../features/auth/session', () => ({
  readAuthSession: vi.fn(),
  readRefreshSessionHint: vi.fn(),
  shouldAttemptBootstrapRefresh: vi.fn(),
  clearAuthSession: vi.fn(),
  isInvalidRefreshFailure: vi.fn(),
  markLegacyRefreshAttempted: vi.fn(),
  onAuthSessionChanged: vi.fn(),
  onAuthSessionExpired: vi.fn(),
  writeAuthSession: vi.fn(),
}));

vi.mock('../features/memory-cards/components/MemoryCardApp', () => ({
  MemoryCardApp: () => <div data-testid="mock-memory-card">Memory Card</div>,
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="location-probe">{location.pathname}</div>
      <Link data-testid="route-root-probe" to="/">
        Root
      </Link>
    </>
  );
}

function renderGate(
  path = '/',
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  }),
) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <I18nProvider>
          <Routes>
            <Route
              path="/"
              element={
                <AuthBoundary
                  authenticated={({ logout, session }) => (
                    <AuthenticatedAppShell onLogout={logout} session={session} />
                  )}
                  publicRoot={<PublicLandingPage />}
                />
              }
            >
              <Route index element={<Navigate replace to="/book/library" />} />
              <Route path="login" element={<Navigate replace to="/book/library" />} />
              <Route path="account" element={<div data-testid="mock-account-page">Account</div>} />
              <Route path="contact" element={<div data-testid="mock-contact-page">Contact</div>} />
              <Route
                path="book/library"
                element={<div data-testid="mock-library-page">Library</div>}
              />
              <Route
                path="memory-card/*"
                element={
                  <PremiumRoute>
                    <MemoryCardApp />
                  </PremiumRoute>
                }
              />
              <Route path="auth/callback" element={<Navigate replace to="/" />} />
            </Route>
          </Routes>
          <LocationProbe />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

describe('authenticated route composition', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('renders the standalone public landing on root before login', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(false);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/');

    const landingPage = await screen.findByTestId('public-landing-page');
    expect(landingPage).toHaveTextContent('Record your thinking');
    expect(landingPage).toHaveTextContent('One book. Six records.');
    expect(landingPage.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByTestId('landing-login')).toHaveAttribute('href', '/login');
    expect(screen.getByTestId('landing-signup')).toHaveAttribute('href', '/login?mode=register');
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument();
  });

  it('renders the existing authentication form on the separate login route', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(false);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/login');

    expect(screen.getByTestId('login-form')).toBeVisible();
    expect(screen.getByTestId('google-login-submit')).toHaveClass('bg-white', 'text-stone-800');
    expect(screen.getByTestId('google-login-submit').querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toHaveClass('min-h-11', 'gap-1');
    expect(screen.getByTestId('auth-mode-login')).toHaveClass(
      'data-[state=active]:bg-[var(--margins-control)]',
      'data-[state=active]:hover:text-[var(--margins-paper)]',
    );
    expect(screen.getByTestId('login-username-input')).toHaveClass('text-base', 'md:text-sm');
    expect(screen.getByTestId('login-password-input')).toHaveClass('text-base', 'md:text-sm');
    expect(screen.getByTestId('login-fields-grid')).toHaveClass('gap-1');
    expect(document.querySelector('label[for="login-username"]')).toHaveTextContent('Username');
    expect(document.querySelector('label[for="login-password"]')).toHaveTextContent('Password');
    expect(screen.getByTestId('auth-home-link')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('auth-page')).toHaveClass('blueprint-auth-page', 'max-w-md');
    expect(screen.queryByTestId('public-landing-page')).not.toBeInTheDocument();
  });

  it('selects registration from the canonical login query', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(false);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/login?mode=register');

    expect(await screen.findByTestId('register-email-input')).toBeVisible();
    expect(screen.getByTestId('auth-mode-register')).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('auth-page')).toHaveClass('max-w-3xl');
    expect(screen.getByTestId('register-fields-grid')).toHaveClass('gap-y-1', 'md:grid-cols-2');
    expect(document.querySelector('label[for="register-username"]')).toHaveTextContent('Username');
    expect(document.querySelector('label[for="register-display-name"]')).toHaveTextContent(
      'Display name',
    );
    expect(document.querySelector('label[for="register-email"]')).toHaveTextContent('Email');
    expect(document.querySelector('label[for="register-email-code"]')).toHaveTextContent(
      'Verification code',
    );
    expect(document.querySelector('label[for="register-password"]')).toHaveTextContent('Password');
    expect(document.querySelector('label[for="register-password-confirm"]')).toHaveTextContent(
      'Confirm password',
    );
  });

  it('resets to login after leaving the registration query and returning from the public root', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(false);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/login?mode=register');

    expect(await screen.findByTestId('register-email-input')).toBeVisible();
    fireEvent.click(screen.getByTestId('route-root-probe'));
    expect(await screen.findByTestId('public-landing-page')).toBeVisible();
    fireEvent.click(screen.getByTestId('landing-login'));

    expect(await screen.findByTestId('login-username-input')).toBeVisible();
    expect(screen.queryByTestId('register-email-input')).not.toBeInTheDocument();
  });

  it('remains render-safe when registration fields unregister and remount', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(false);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/login');

    await screen.findByTestId('login-form');
    fireEvent.click(screen.getByTestId('auth-mode-register'));
    expect(screen.getByTestId('register-email-input')).toBeVisible();

    fireEvent.click(screen.getByTestId('auth-mode-login'));
    expect(screen.queryByTestId('register-email-input')).not.toBeInTheDocument();

    expect(() => fireEvent.click(screen.getByTestId('auth-mode-register'))).not.toThrow();
    expect(screen.getByTestId('register-email-input')).toBeVisible();
    expect(screen.getByTestId('register-email-check-submit')).toBeDisabled();
  });

  it('matches signup inline action heights to their inputs across breakpoints', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(false);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/login');
    await screen.findByTestId('login-form');
    fireEvent.click(screen.getByTestId('auth-mode-register'));

    expect(screen.getByTestId('register-email-input')).toHaveClass('h-11', 'md:h-8');
    expect(screen.getByTestId('register-email-check-submit')).toHaveClass('h-11', 'md:h-8');
    expect(screen.getByTestId('register-email-code-input')).toHaveClass('h-11', 'md:h-8');
    expect(screen.getByTestId('register-email-code-submit')).toHaveClass('h-11', 'md:h-8');
    expect(screen.getByTestId('register-email-code-confirm-submit')).toHaveClass('h-11', 'md:h-8');
  });

  it('redirects a signed-out account route to the login page', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(false);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/account');

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/login');
    });
    expect(screen.queryByTestId('mock-account-page')).not.toBeInTheDocument();
    expect(await screen.findByTestId('login-form')).toBeVisible();
  });

  it('redirects any signed-out protected route to the canonical login surface', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(false);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/book/library');

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/login');
    });
    expect(await screen.findByTestId('login-form')).toBeVisible();
    expect(screen.queryByTestId('mock-library-page')).not.toBeInTheDocument();
  });

  it('shows invalid login feedback with the danger treatment', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(false);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    vi.mocked(authApi.login).mockRejectedValue(new Error('Invalid username or password'));
    renderGate('/login');
    fireEvent.change(await screen.findByTestId('login-username-input'), {
      target: { value: 'reader' },
    });
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByTestId('login-submit'));

    expect(await screen.findByTestId('login-error')).toHaveClass(
      'border-red-300',
      'bg-red-50',
      'text-red-800',
    );
  });

  it('renders duplicate-check failures once in the field error area', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(false);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    vi.mocked(authApi.checkEmailAvailability).mockResolvedValue({
      email: 'reader@example.com',
      available: false,
    });
    renderGate('/login');
    await screen.findByTestId('login-form');
    fireEvent.click(screen.getByTestId('auth-mode-register'));

    fireEvent.change(screen.getByTestId('register-email-input'), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByTestId('register-email-check-submit'));

    expect(await screen.findAllByText('Email is already in use.')).toHaveLength(1);
    expect(screen.getByTestId('register-email-error')).toHaveClass('mt-1');
    expect(screen.queryByTestId('register-email-check-message')).not.toBeInTheDocument();
  });

  it('uses the server resend cooldown and prevents duplicate send clicks', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(false);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    vi.mocked(authApi.checkEmailAvailability).mockResolvedValue({
      email: 'reader@example.com',
      available: true,
    });
    vi.mocked(authApi.requestEmailVerification).mockResolvedValue({
      email: 'reader@example.com',
      expiresInSeconds: 300,
      resendAfterSeconds: 60,
      devVerificationCode: '123456',
    });
    renderGate('/login');
    await screen.findByTestId('login-form');
    fireEvent.click(screen.getByTestId('auth-mode-register'));
    fireEvent.change(screen.getByTestId('register-email-input'), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByTestId('register-email-check-submit'));
    await screen.findByTestId('register-email-check-message');

    const send = screen.getByTestId('register-email-code-submit');
    fireEvent.click(send);
    fireEvent.click(send);

    const resendTimer = await screen.findByTestId('register-email-code-resend-timer');
    expect(resendTimer).toHaveTextContent('60s');
    expect(resendTimer).toHaveClass('h-11', 'md:h-8');
    expect(authApi.requestEmailVerification).toHaveBeenCalledTimes(1);
    expect(authApi.requestEmailVerification).toHaveBeenCalledWith('reader@example.com', '');
    expect(authApi.createRegistrationIntent).not.toHaveBeenCalled();
  });

  it('requires explicit consent continuation before enabling signup', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(false);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    vi.mocked(authApi.checkEmailAvailability).mockResolvedValue({
      email: 'reader@example.com',
      available: true,
    });
    vi.mocked(authApi.requestEmailVerification).mockResolvedValue({
      email: 'reader@example.com',
      expiresInSeconds: 300,
      resendAfterSeconds: 60,
      devVerificationCode: '123456',
    });
    vi.mocked(authApi.confirmEmailVerification).mockResolvedValue({
      email: 'reader@example.com',
      verified: true,
    });
    vi.mocked(authApi.createRegistrationIntent)
      .mockRejectedValueOnce(new Error('intent failed'))
      .mockResolvedValue(undefined);
    renderGate('/login');
    await screen.findByTestId('login-form');
    fireEvent.click(screen.getByTestId('auth-mode-register'));

    expect(screen.queryByTestId('register-privacy-consent')).not.toBeInTheDocument();
    expect(screen.getByTestId('register-username-input')).toBeEnabled();
    expect(screen.getByTestId('register-display-name-input')).toBeEnabled();
    expect(screen.getByTestId('register-email-input')).toBeEnabled();
    expect(screen.getByTestId('login-password-input')).toBeEnabled();
    expect(screen.getByTestId('register-password-confirm-input')).toBeEnabled();
    expect(screen.queryByTestId('register-consent-continue')).not.toBeInTheDocument();
    expect(screen.queryByTestId('register-submit')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Privacy Policy' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('register-username-input'), {
      target: { value: 'reader' },
    });
    fireEvent.change(screen.getByTestId('register-display-name-input'), {
      target: { value: 'Reader' },
    });
    fireEvent.change(screen.getByTestId('login-password-input'), {
      target: { value: 'reader1234' },
    });
    fireEvent.change(screen.getByTestId('register-password-confirm-input'), {
      target: { value: 'reader1234' },
    });
    fireEvent.change(screen.getByTestId('register-email-input'), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByTestId('register-email-check-submit'));
    await screen.findByTestId('register-email-check-message');
    fireEvent.click(screen.getByTestId('register-email-code-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('register-email-code-input')).toHaveValue('123456'),
    );
    fireEvent.click(screen.getByTestId('register-email-code-confirm-submit'));

    expect(await screen.findByTestId('register-privacy-consent')).toBeVisible();
    expect(screen.getByTestId('register-ai-transfer-consent')).toBeVisible();
    expect(screen.getByTestId('register-age-consent')).toBeVisible();
    expect(screen.getByTestId('register-username-input')).toBeEnabled();
    expect(screen.getByTestId('register-display-name-input')).toBeEnabled();
    expect(screen.getByTestId('register-email-input')).toBeDisabled();
    expect(screen.getByTestId('login-password-input')).toBeEnabled();
    expect(screen.getByTestId('register-consent-continue')).toBeDisabled();
    expect(screen.queryByTestId('register-submit')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();

    fireEvent.click(screen.getByTestId('register-privacy-consent'));
    fireEvent.click(screen.getByTestId('register-ai-transfer-consent'));
    fireEvent.click(screen.getByTestId('register-age-consent'));

    expect(await screen.findByTestId('register-consent-continue')).toBeEnabled();
    expect(screen.queryByTestId('register-submit')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('register-consent-continue'));

    expect(await screen.findByTestId('login-error')).toHaveTextContent(
      'Consent could not be saved.',
    );
    expect(screen.queryByTestId('register-submit')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('register-consent-continue'));

    await waitFor(() => expect(authApi.createRegistrationIntent).toHaveBeenCalledTimes(2));
    expect(authApi.createRegistrationIntent).toHaveBeenCalledWith({
      privacyPolicyAccepted: true,
      aiTransferAccepted: true,
      ageOver14Confirmed: true,
      privacyPolicyVersion: '2026-07-27',
      aiTransferVersion: '2026-07-27',
    });
    expect(screen.getByTestId('register-consent-confirmed')).toBeVisible();
    expect(authApi.register).not.toHaveBeenCalled();
    expect(screen.getByTestId('register-privacy-consent')).toBeDisabled();
    expect(screen.getByTestId('register-ai-transfer-consent')).toBeDisabled();
    expect(screen.getByTestId('register-age-consent')).toBeDisabled();
    expect(screen.getByTestId('register-username-input')).toBeVisible();
    expect(screen.getByTestId('register-username-input')).toBeEnabled();
    expect(screen.getByTestId('register-display-name-input')).toBeVisible();
    expect(screen.getByTestId('register-display-name-input')).toBeEnabled();
    expect(screen.getByTestId('login-password-input')).toBeVisible();
    expect(screen.getByTestId('register-password-confirm-input')).toBeVisible();
    expect(screen.getByTestId('register-submit')).toBeEnabled();
  });

  it('redirects authenticated root to the Library route', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue({
      userId: 1,
      username: 'reader',
      displayName: 'Reader One',
      authMode: 'password',
      accessToken: 'token',
      accessTokenExpiresInSeconds: 3600,
      membershipTier: 'PREMIUM',
    });
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/');

    expect(await screen.findByTestId('mock-library-page')).toHaveTextContent('Library');
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/book/library');
    expect(screen.queryByTestId('main-auth-home-page')).not.toBeInTheDocument();
  });

  it('redirects authenticated login to the Library route', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue({
      userId: 1,
      username: 'reader',
      displayName: 'Reader One',
      authMode: 'password',
      accessToken: 'token',
      accessTokenExpiresInSeconds: 3600,
      membershipTier: 'PREMIUM',
    });
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/login');

    expect(await screen.findByTestId('mock-library-page')).toHaveTextContent('Library');
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/book/library');
  });

  it('clears account, memory-card, and reading caches on logout', async () => {
    const session = {
      userId: 1,
      username: 'reader',
      displayName: 'Reader One',
      authMode: 'password',
      accessToken: 'token',
      accessTokenExpiresInSeconds: 3600,
      membershipTier: 'PREMIUM',
    } as const;
    let currentSession: typeof session | undefined = session;
    vi.mocked(authSessionService.readAuthSession).mockImplementation(() => currentSession);
    vi.mocked(authSessionService.clearAuthSession).mockImplementation(() => {
      currentSession = undefined;
    });
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    vi.mocked(authApi.logout).mockResolvedValue(undefined);
    const { queryClient } = renderGate('/book/library');
    queryClient.setQueryData([...protectedQueryRoots.account, 'detail'], { userId: 1 });
    queryClient.setQueryData([...protectedQueryRoots.memoryCards, 'groups'], {
      groups: ['private'],
    });
    queryClient.setQueryData(bookKeys.list(), { books: ['private'] });
    queryClient.setQueryData(['public', 'catalog'], { entries: ['shared'] });

    fireEvent.click(await screen.findByTestId('logout-submit'));

    await waitFor(() => expect(authApi.logout).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/');
    expect(await screen.findByTestId('public-landing-page')).toBeVisible();
    expect(queryClient.getQueryData([...protectedQueryRoots.account, 'detail'])).toBeUndefined();
    expect(
      queryClient.getQueryData([...protectedQueryRoots.memoryCards, 'groups']),
    ).toBeUndefined();
    expect(queryClient.getQueryData(bookKeys.list())).toBeUndefined();
    expect(queryClient.getQueryData(['public', 'catalog'])).toEqual({ entries: ['shared'] });
  });

  it('clears protected caches when the active session expires', async () => {
    let expireSession: (() => void) | undefined;
    const session = {
      userId: 1,
      username: 'reader',
      displayName: 'Reader One',
      authMode: 'password',
      accessToken: 'token',
      accessTokenExpiresInSeconds: 3600,
      membershipTier: 'PREMIUM',
    } as const;
    let currentSession: typeof session | undefined = session;
    vi.mocked(authSessionService.readAuthSession).mockImplementation(() => currentSession);
    vi.mocked(authSessionService.onAuthSessionExpired).mockImplementation((listener) => {
      expireSession = listener;
      return () => undefined;
    });
    const { queryClient } = renderGate('/');
    queryClient.setQueryData([...protectedQueryRoots.account, 'detail'], { userId: 1 });
    queryClient.setQueryData([...protectedQueryRoots.memoryCards, 'groups'], {
      groups: ['private'],
    });
    queryClient.setQueryData(bookKeys.list(), { books: ['private'] });

    await screen.findByTestId('logout-submit');
    act(() => {
      currentSession = undefined;
      expireSession?.();
    });

    expect(queryClient.getQueryData([...protectedQueryRoots.account, 'detail'])).toBeUndefined();
    expect(
      queryClient.getQueryData([...protectedQueryRoots.memoryCards, 'groups']),
    ).toBeUndefined();
    expect(queryClient.getQueryData(bookKeys.list())).toBeUndefined();
    expect(await screen.findByTestId('login-form')).toBeVisible();
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/login');
  });

  it('clears prior-user protected caches during signed-out bootstrap', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(false);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData([...protectedQueryRoots.account, 'detail'], { userId: 1 });
    queryClient.setQueryData([...protectedQueryRoots.memoryCards, 'groups'], {
      groups: ['private'],
    });
    renderGate('/', queryClient);

    await screen.findByTestId('public-landing-page');

    expect(queryClient.getQueryData([...protectedQueryRoots.account, 'detail'])).toBeUndefined();
    expect(
      queryClient.getQueryData([...protectedQueryRoots.memoryCards, 'groups']),
    ).toBeUndefined();
  });

  it('uses the global Margins navigation as a home link from Memory Card', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue({
      userId: 1,
      username: 'reader',
      displayName: 'Reader One',
      authMode: 'password',
      accessToken: 'token',
      accessTokenExpiresInSeconds: 3600,
      membershipTier: 'PREMIUM',
    });
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/memory-card/groups');

    expect(await screen.findByTestId('mock-memory-card')).toBeVisible();
    fireEvent.click(screen.getByTestId('nav-margins'));

    expect(await screen.findByTestId('mock-library-page')).toBeVisible();
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/book/library');
  });

  it('opens contact from authenticated navigation', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue({
      userId: 1,
      username: 'reader',
      displayName: 'Reader One',
      authMode: 'password',
      accessToken: 'token',
      accessTokenExpiresInSeconds: 3600,
    });
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/book/library');

    fireEvent.click(await screen.findByTestId('nav-contact'));

    expect(await screen.findByTestId('mock-contact-page')).toBeVisible();
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/contact');
  });

  it('hides and redirects Memory Card for a free member', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue({
      userId: 1,
      username: 'reader',
      displayName: 'Reader One',
      authMode: 'password',
      accessToken: 'token',
      accessTokenExpiresInSeconds: 3600,
      membershipTier: 'FREE',
    });
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/memory-card/groups');

    await waitFor(() =>
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/book/library'),
    );
    expect(screen.queryByTestId('nav-memory-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-memory-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-library-page')).toBeVisible();
  });

  it('redirects a successful auth callback to the main page', async () => {
    const refreshedSession = {
      userId: 1,
      username: 'reader',
      displayName: 'Reader One',
      authMode: 'oauth',
      accessToken: 'token',
      accessTokenExpiresInSeconds: 3600,
    } as const;
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authApi.refresh).mockImplementation(async () => {
      vi.mocked(authSessionService.readAuthSession).mockReturnValue(refreshedSession);
      return refreshedSession;
    });
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/auth/callback?login=success');

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/book/library');
    });
    await waitFor(() => {
      expect(screen.getByTestId('mock-library-page')).toBeVisible();
    });
  });

  it('preserves a newer login when a pending bootstrap refresh is superseded', async () => {
    const newerSession = {
      userId: 2,
      username: 'new-reader',
      displayName: 'New Reader',
      authMode: 'password',
      accessToken: 'new-token',
      accessTokenExpiresInSeconds: 3600,
    } as const;
    let currentSession = undefined as typeof newerSession | undefined;
    let rejectRefresh!: (error: unknown) => void;
    let publishSession!: (session: typeof newerSession) => void;
    vi.mocked(authSessionService.readAuthSession).mockImplementation(() => currentSession);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(true);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    vi.mocked(authSessionService.onAuthSessionChanged).mockImplementation((listener) => {
      publishSession = listener as typeof publishSession;
      return () => undefined;
    });
    vi.mocked(authApi.refresh).mockReturnValue(
      new Promise((_, reject) => {
        rejectRefresh = reject;
      }),
    );
    renderGate('/');

    await waitFor(() => expect(authApi.refresh).toHaveBeenCalledOnce());
    await waitFor(() => expect(publishSession).toBeTypeOf('function'));
    currentSession = newerSession;
    act(() => publishSession(newerSession));
    await waitFor(() => expect(screen.getByTestId('logout-submit')).toBeVisible());

    await act(async () => {
      rejectRefresh(new ApiRequestError('AUTH_SESSION_CHANGED', 401));
    });

    expect(authSessionService.clearAuthSession).not.toHaveBeenCalled();
    expect(screen.getByTestId('logout-submit')).toBeVisible();
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument();
  });

  it('explains when a Google email already belongs to an existing account', async () => {
    vi.mocked(authSessionService.readAuthSession).mockReturnValue(undefined);
    vi.mocked(authSessionService.shouldAttemptBootstrapRefresh).mockReturnValue(false);
    vi.mocked(authSessionService.readRefreshSessionHint).mockReturnValue(false);
    vi.mocked(authSessionService.onAuthSessionExpired).mockReturnValue(() => undefined);
    renderGate('/auth/callback?error=AUTH_GOOGLE_LINK_REQUIRED');

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/login');
    });
    expect(
      await screen.findByText(
        'An account with this email already exists. Please sign in with your existing account.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('AUTH_GOOGLE_LINK_REQUIRED')).not.toBeInTheDocument();
  });
});
