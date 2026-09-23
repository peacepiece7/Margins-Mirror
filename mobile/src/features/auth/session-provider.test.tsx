import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { secureTokenStore } from '@/shared/auth/secure-token-store';
import { useApiClient } from '@/shared/api/api-client-provider';

import { authApi, createGoogleOAuthVerifier } from './api';
import {
  AuthSessionProvider,
  createGoogleCallbackCoordinator,
  useAuthSession,
} from './session-provider';
import type { NativeSessionResponse } from './types';

const mockSetLocale = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('@/shared/auth/secure-token-store', () => ({
  secureTokenStore: {
    clear: jest.fn(),
    read: jest.fn(),
    write: jest.fn(),
  },
}));
jest.mock('@/shared/i18n/i18n-provider', () => {
  return { useI18n: () => ({ locale: 'en', setLocale: mockSetLocale }) };
});
jest.mock('./api', () => ({
  authApi: {
    completeGoogleRegistration: jest.fn(),
    exchangeGoogleOAuth: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    register: jest.fn(),
    startGoogleOAuth: jest.fn(),
  },
  createGoogleOAuthVerifier: jest.fn(),
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockCreateGoogleOAuthVerifier = jest.mocked(createGoogleOAuthVerifier);
const mockTokenStore = secureTokenStore as jest.Mocked<typeof secureTokenStore>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

const initialSession: NativeSessionResponse = {
  accessToken: 'initial-access',
  accessTokenExpiresInSeconds: 900,
  authMode: 'LOCAL',
  displayName: 'Reader',
  refreshToken: 'initial-refresh',
  refreshTokenExpiresInSeconds: 2_592_000,
  userId: 7,
  username: 'reader',
};

describe('native Google callback ownership', () => {
  it('shares one exchange and one session commit for simultaneous callback delivery', async () => {
    let resolve!: (value: boolean) => void;
    const exchange = jest.fn(
      (_code: string, _verifier: string) => new Promise<boolean>((done) => {
        resolve = done;
      }),
    );
    const callback = createGoogleCallbackCoordinator();
    callback.begin('device-verifier');

    const browserResult = callback.complete('one-time-code', exchange);
    const routerResult = callback.complete('one-time-code', exchange);
    expect(browserResult).toBe(routerResult);
    expect(exchange).toHaveBeenCalledTimes(1);
    expect(exchange).toHaveBeenCalledWith('one-time-code', 'device-verifier');

    resolve(false);
    await expect(Promise.all([browserResult, routerResult])).resolves.toEqual([
      false,
      false,
    ]);
    expect(exchange).toHaveBeenCalledTimes(1);
    await expect(callback.complete('another-code', exchange)).rejects.toMatchObject({
      code: 'AUTH_GOOGLE_OAUTH_REQUEST_INVALID',
    });
  });

  it('rejects a different code while an exchange is active and allows a new settled flow', async () => {
    let resolve!: (value: boolean) => void;
    const exchange = jest
      .fn<Promise<boolean>, [string, string]>()
      .mockImplementationOnce(
        () => new Promise<boolean>((done) => {
          resolve = done;
        }),
      )
      .mockResolvedValueOnce(true);
    const callback = createGoogleCallbackCoordinator();
    callback.begin('first-verifier');

    const first = callback.complete('first-code', exchange);
    await expect(callback.complete('competing-code', exchange)).rejects.toMatchObject({
      code: 'AUTH_GOOGLE_OAUTH_REQUEST_INVALID',
    });
    resolve(false);
    await expect(first).resolves.toBe(false);
    callback.begin('next-verifier');
    await expect(callback.complete('next-code', exchange)).resolves.toBe(true);
    expect(exchange).toHaveBeenCalledTimes(2);
  });

  it('refuses a captured callback code without a locally initiated verifier', async () => {
    const exchange = jest.fn<Promise<boolean>, [string, string]>();
    const callback = createGoogleCallbackCoordinator();

    await expect(callback.complete('captured-code', exchange)).rejects.toMatchObject({
      code: 'AUTH_GOOGLE_OAUTH_REQUEST_INVALID',
    });
    expect(exchange).not.toHaveBeenCalled();
  });

  it('clears a rejected verifier so a captured code cannot retry it', async () => {
    const exchange = jest.fn<Promise<boolean>, [string, string]>().mockRejectedValue(
      new Error('AUTH_GOOGLE_OAUTH_REQUEST_INVALID'),
    );
    const callback = createGoogleCallbackCoordinator();
    callback.begin('wrong-device-verifier');

    await expect(callback.complete('captured-code', exchange)).rejects.toThrow(
      'AUTH_GOOGLE_OAUTH_REQUEST_INVALID',
    );
    expect(exchange).toHaveBeenCalledWith('captured-code', 'wrong-device-verifier');
    await expect(callback.complete('different-code', exchange)).rejects.toMatchObject({
      code: 'AUTH_GOOGLE_OAUTH_REQUEST_INVALID',
    });
  });
});

describe('session mutation ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetLocale.mockResolvedValue(undefined);
    mockCreateGoogleOAuthVerifier.mockResolvedValue({
      challenge: 'device-challenge',
      verifier: 'device-verifier',
    });
  });

  it('rejects a stale Google response without replacing a later local session or SecureStore token', async () => {
    let storedRefreshToken: string | null = null;
    let sessionApi!: ReturnType<typeof useAuthSession>;
    const googleExchange = deferred<Awaited<ReturnType<typeof authApi.exchangeGoogleOAuth>>>();
    const localSession = {
      ...initialSession,
      accessToken: 'local-access',
      refreshToken: 'local-refresh',
      userId: 11,
      username: 'local-reader',
    };
    const staleGoogleSession = {
      ...initialSession,
      accessToken: 'stale-google-access',
      authMode: 'GOOGLE' as const,
      refreshToken: 'stale-google-refresh',
      userId: 12,
      username: 'google-reader',
    };
    mockTokenStore.read.mockImplementation(async () => storedRefreshToken);
    mockTokenStore.write.mockImplementation(async (token) => {
      storedRefreshToken = token;
    });
    mockTokenStore.clear.mockImplementation(async () => {
      storedRefreshToken = null;
    });
    mockAuthApi.startGoogleOAuth.mockResolvedValue('google-code');
    mockAuthApi.exchangeGoogleOAuth.mockReturnValue(googleExchange.promise);
    mockAuthApi.login.mockResolvedValue(localSession);

    function Harness() {
      sessionApi = useAuthSession();
      return null;
    }

    const screen = await render(
      <AuthSessionProvider>
        <Harness />
      </AuthSessionProvider>,
    );
    await waitFor(() => expect(sessionApi.status).toBe('anonymous'));

    let googlePromise!: Promise<boolean>;
    await act(async () => {
      googlePromise = sessionApi.loginWithGoogle();
      await waitFor(() => expect(mockAuthApi.exchangeGoogleOAuth).toHaveBeenCalledTimes(1));
    });
    await act(async () => {
      await sessionApi.login({ password: 'local-password', username: 'local-reader' });
    });
    await act(async () => {
      googleExchange.resolve({ session: staleGoogleSession, status: 'SESSION' });
      await expect(googlePromise).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    });

    expect(sessionApi.session?.accessToken).toBe('local-access');
    expect(sessionApi.session?.userId).toBe(11);
    expect(storedRefreshToken).toBe('local-refresh');
    expect(mockTokenStore.write).toHaveBeenCalledWith('local-refresh');
    expect(mockTokenStore.write).not.toHaveBeenCalledWith('stale-google-refresh');
    await act(async () => screen.unmount());
  });

  it('rejects a stale local response without replacing a later Google session or SecureStore token', async () => {
    let storedRefreshToken: string | null = null;
    let sessionApi!: ReturnType<typeof useAuthSession>;
    const localLogin = deferred<NativeSessionResponse>();
    const staleLocalSession = {
      ...initialSession,
      accessToken: 'stale-local-access',
      refreshToken: 'stale-local-refresh',
      userId: 21,
      username: 'stale-local-reader',
    };
    const googleSession = {
      ...initialSession,
      accessToken: 'google-access',
      authMode: 'GOOGLE' as const,
      refreshToken: 'google-refresh',
      userId: 22,
      username: 'google-reader',
    };
    mockTokenStore.read.mockImplementation(async () => storedRefreshToken);
    mockTokenStore.write.mockImplementation(async (token) => {
      storedRefreshToken = token;
    });
    mockTokenStore.clear.mockImplementation(async () => {
      storedRefreshToken = null;
    });
    mockAuthApi.login.mockReturnValue(localLogin.promise);
    mockAuthApi.startGoogleOAuth.mockResolvedValue('google-code');
    mockAuthApi.exchangeGoogleOAuth.mockResolvedValue({
      session: googleSession,
      status: 'SESSION',
    });

    function Harness() {
      sessionApi = useAuthSession();
      return null;
    }

    const screen = await render(
      <AuthSessionProvider>
        <Harness />
      </AuthSessionProvider>,
    );
    await waitFor(() => expect(sessionApi.status).toBe('anonymous'));

    let localPromise!: Promise<void>;
    await act(async () => {
      localPromise = sessionApi.login({
        password: 'local-password',
        username: 'stale-local-reader',
      });
      await Promise.resolve();
    });
    await act(async () => {
      await expect(sessionApi.loginWithGoogle()).resolves.toBe(false);
    });
    await act(async () => {
      localLogin.resolve(staleLocalSession);
      await expect(localPromise).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    });

    expect(sessionApi.session?.accessToken).toBe('google-access');
    expect(sessionApi.session?.userId).toBe(22);
    expect(storedRefreshToken).toBe('google-refresh');
    expect(mockTokenStore.write).toHaveBeenCalledWith('google-refresh');
    expect(mockTokenStore.write).not.toHaveBeenCalledWith('stale-local-refresh');
    await act(async () => screen.unmount());
  });

  it('restores one refresh token and persists rotation before protected content mounts', async () => {
    const events: string[] = [];
    let sessionApi!: ReturnType<typeof useAuthSession>;
    const restoredSession = {
      ...initialSession,
      accessToken: 'restored-access',
      refreshToken: 'rotated-refresh',
    };
    mockTokenStore.read.mockImplementation(async () => {
      events.push('read');
      return 'stored-refresh';
    });
    mockTokenStore.write.mockImplementation(async () => {
      events.push('write');
    });
    mockAuthApi.refresh.mockImplementation(async () => {
      events.push('refresh');
      return restoredSession;
    });

    function RestoreHarness() {
      sessionApi = useAuthSession();
      if (sessionApi.status === 'authenticated') events.push('protected-render');
      return null;
    }

    const screen = await render(
      <AuthSessionProvider>
        <RestoreHarness />
      </AuthSessionProvider>,
    );
    await waitFor(() => expect(events).toContain('protected-render'));

    expect(mockTokenStore.read).toHaveBeenCalledTimes(1);
    expect(mockAuthApi.refresh).toHaveBeenCalledTimes(1);
    expect(mockAuthApi.refresh).toHaveBeenCalledWith('stored-refresh');
    expect(mockTokenStore.write).toHaveBeenCalledWith('rotated-refresh');
    expect(events.indexOf('write')).toBeLessThan(events.indexOf('protected-render'));
    expect(sessionApi.session).not.toHaveProperty('refreshToken');
    expect(sessionApi.session).not.toHaveProperty('refreshTokenExpiresInSeconds');
    expect(JSON.stringify(sessionApi)).not.toContain('rotated-refresh');
    await act(async () => screen.unmount());
  });

  it('surfaces a SecureStore read failure and retries without clearing the credential', async () => {
    let sessionApi!: ReturnType<typeof useAuthSession>;
    mockTokenStore.read
      .mockRejectedValueOnce(new Error('keychain unavailable'))
      .mockResolvedValueOnce('stored-refresh');
    mockTokenStore.write.mockResolvedValue(undefined);
    mockAuthApi.refresh.mockResolvedValue({
      ...initialSession,
      accessToken: 'restored-access',
      refreshToken: 'rotated-refresh',
    });

    function Harness() {
      sessionApi = useAuthSession();
      return null;
    }

    const screen = await render(
      <AuthSessionProvider>
        <Harness />
      </AuthSessionProvider>,
    );
    await waitFor(() => expect(sessionApi.status).toBe('restore-error'));

    expect(mockTokenStore.clear).not.toHaveBeenCalled();
    expect(mockAuthApi.refresh).not.toHaveBeenCalled();

    await act(async () => {
      await sessionApi.retryRestore();
    });

    expect(sessionApi.status).toBe('authenticated');
    expect(mockTokenStore.read).toHaveBeenCalledTimes(2);
    expect(mockAuthApi.refresh).toHaveBeenCalledWith('stored-refresh');
    expect(mockTokenStore.write).toHaveBeenCalledWith('rotated-refresh');
    expect(mockTokenStore.clear).not.toHaveBeenCalled();
    await act(async () => screen.unmount());
  });

  // BDD: AUTH-025, ACCOUNT-016
  it('applies the authoritative preferred locale for login and refreshed sessions', async () => {
    let sessionApi!: ReturnType<typeof useAuthSession>;
    mockTokenStore.read.mockResolvedValue(null);
    mockTokenStore.write.mockResolvedValue(undefined);
    mockAuthApi.login.mockResolvedValue({ ...initialSession, preferredLocale: 'ko' });

    function Harness() {
      sessionApi = useAuthSession();
      return null;
    }

    const screen = await render(
      <AuthSessionProvider>
        <Harness />
      </AuthSessionProvider>,
    );
    await waitFor(() => expect(sessionApi.status).toBe('anonymous'));
    await act(async () => {
      await sessionApi.login({ password: 'password', username: 'reader' });
    });
    expect(mockSetLocale).toHaveBeenCalledWith('ko');
    expect(sessionApi.session).not.toHaveProperty('refreshToken');
    expect(JSON.stringify(sessionApi)).not.toContain('initial-refresh');

    mockAuthApi.refresh.mockResolvedValue({
      ...initialSession,
      accessToken: 'refreshed-access',
      preferredLocale: 'en',
      refreshToken: 'refreshed-token',
    });
    mockTokenStore.read.mockResolvedValue('initial-refresh');
    await act(async () => {
      await sessionApi.refreshSession();
    });
    expect(mockSetLocale).toHaveBeenCalledWith('en');
    expect(sessionApi.session).not.toHaveProperty('refreshToken');
    expect(JSON.stringify(sessionApi)).not.toContain('refreshed-token');
    await act(async () => screen.unmount());
  });

  it('does not publish or retain a stale refresh when logout starts during SecureStore write', async () => {
    let storedRefreshToken: string | null = null;
    let releaseRefreshWrite!: () => void;
    let markRefreshWriteStarted!: () => void;
    const refreshWriteStarted = new Promise<void>((resolve) => {
      markRefreshWriteStarted = resolve;
    });
    const renderedSessions: string[] = [];
    let sessionApi!: ReturnType<typeof useAuthSession>;

    mockTokenStore.read.mockImplementation(async () => storedRefreshToken);
    mockTokenStore.clear.mockImplementation(async () => {
      storedRefreshToken = null;
    });
    mockTokenStore.write.mockImplementation(async (refreshToken) => {
      storedRefreshToken = refreshToken;
    });
    mockAuthApi.login.mockResolvedValue(initialSession);
    mockAuthApi.logout.mockResolvedValue(undefined);

    function Harness() {
      sessionApi = useAuthSession();
      const rendered = `${sessionApi.status}:${sessionApi.session?.accessToken ?? ''}`;
      renderedSessions.push(rendered);
      return null;
    }

    const screen = await render(
      <AuthSessionProvider>
        <Harness />
      </AuthSessionProvider>,
    );
    await waitFor(() => expect(sessionApi.status).toBe('anonymous'));

    await act(async () => {
      await sessionApi.login({ password: 'password', username: 'reader' });
    });
    expect(sessionApi.session?.accessToken).toBe('initial-access');

    mockAuthApi.refresh.mockResolvedValue({
      ...initialSession,
      accessToken: 'stale-refreshed-access',
      refreshToken: 'stale-refreshed-refresh',
    });
    mockTokenStore.write.mockImplementationOnce(
      (refreshToken) =>
        new Promise<void>((resolve) => {
          markRefreshWriteStarted();
          releaseRefreshWrite = () => {
            storedRefreshToken = refreshToken;
            resolve();
          };
        }),
    );

    let refreshPromise!: Promise<void>;
    await act(async () => {
      refreshPromise = sessionApi.refreshSession();
      await refreshWriteStarted;
    });

    let logoutPromise!: Promise<void>;
    await act(async () => {
      logoutPromise = sessionApi.logout();
      await Promise.resolve();
    });
    expect(sessionApi.status).toBe('restoring');
    expect(sessionApi.logoutState).toBe('clearing');
    expect(sessionApi.session).toBeUndefined();

    await act(async () => {
      releaseRefreshWrite();
      await expect(refreshPromise).rejects.toMatchObject({
        code: 'AUTH_SESSION_CHANGED',
      });
      await logoutPromise;
    });

    expect(storedRefreshToken).toBeNull();
    expect(mockAuthApi.logout).toHaveBeenCalledWith('stale-refreshed-refresh');
    expect(renderedSessions).not.toContain('authenticated:stale-refreshed-access');
    expect(renderedSessions).toContain('anonymous:');
    await act(async () => screen.unmount());
  });

  it('keeps protected and public trees closed until a deferred credential clear survives remount', async () => {
    let storedRefreshToken: string | null = null;
    let firstSessionApi!: ReturnType<typeof useAuthSession>;
    let remountedSessionApi!: ReturnType<typeof useAuthSession>;
    const clear = deferred<void>();
    mockTokenStore.read.mockImplementation(async () => storedRefreshToken);
    mockTokenStore.write.mockImplementation(async (token) => {
      storedRefreshToken = token;
    });
    mockTokenStore.clear.mockImplementationOnce(async () => {
      await clear.promise;
      storedRefreshToken = null;
    });
    mockAuthApi.login.mockResolvedValue(initialSession);
    mockAuthApi.logout.mockResolvedValue(undefined);

    function FirstHarness() {
      firstSessionApi = useAuthSession();
      return null;
    }

    const first = await render(
      <AuthSessionProvider>
        <FirstHarness />
      </AuthSessionProvider>,
    );
    await waitFor(() => expect(firstSessionApi.status).toBe('anonymous'));
    await act(async () => {
      await firstSessionApi.login({ password: 'password', username: 'reader' });
    });

    let logoutPromise!: Promise<void>;
    await act(async () => {
      logoutPromise = firstSessionApi.logout();
      await Promise.resolve();
    });
    await waitFor(() => expect(firstSessionApi.logoutState).toBe('clearing'));
    expect(firstSessionApi.status).toBe('restoring');
    expect(firstSessionApi.session).toBeUndefined();

    await act(async () => first.unmount());

    function RemountedHarness() {
      remountedSessionApi = useAuthSession();
      return null;
    }

    const remounted = await render(
      <AuthSessionProvider>
        <RemountedHarness />
      </AuthSessionProvider>,
    );
    await waitFor(() => expect(remountedSessionApi.status).toBe('restoring'));
    expect(mockAuthApi.refresh).not.toHaveBeenCalled();

    await act(async () => {
      clear.resolve(undefined);
      await logoutPromise;
    });
    await waitFor(() => expect(remountedSessionApi.status).toBe('anonymous'));
    expect(storedRefreshToken).toBeNull();
    expect(mockAuthApi.refresh).not.toHaveBeenCalled();
    await act(async () => remounted.unmount());
  });

  it('surfaces local-clear failure without opening a route and retries the clear safely', async () => {
    let storedRefreshToken: string | null = null;
    let sessionApi!: ReturnType<typeof useAuthSession>;
    mockTokenStore.read.mockImplementation(async () => storedRefreshToken);
    mockTokenStore.write.mockImplementation(async (token) => {
      storedRefreshToken = token;
    });
    mockTokenStore.clear
      .mockRejectedValueOnce(new Error('keychain clear failed'))
      .mockImplementationOnce(async () => {
        storedRefreshToken = null;
      });
    mockAuthApi.login.mockResolvedValue(initialSession);
    mockAuthApi.logout.mockResolvedValue(undefined);

    function Harness() {
      sessionApi = useAuthSession();
      return <Text testID="protected-child">Protected child</Text>;
    }

    const screen = await render(
      <AuthSessionProvider>
        <Harness />
      </AuthSessionProvider>,
    );
    await waitFor(() => expect(sessionApi.status).toBe('anonymous'));
    await act(async () => {
      await sessionApi.login({ password: 'password', username: 'reader' });
    });
    await act(async () => {
      await sessionApi.logout();
    });

    expect(screen.getByText('We could not finish signing out on this device.')).toBeTruthy();
    expect(screen.queryByTestId('protected-child')).toBeNull();
    expect(mockAuthApi.logout).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Retry sign out' }));
    });
    await waitFor(() => expect(sessionApi.status).toBe('anonymous'));
    expect(sessionApi.logoutState).toBeUndefined();
    expect(storedRefreshToken).toBeNull();
    expect(mockAuthApi.logout).toHaveBeenCalledWith('initial-refresh');
    await act(async () => screen.unmount());
  });

  it('shares one refresh across concurrent unauthorized protected requests', async () => {
    let storedRefreshToken: string | null = null;
    let sessionApi!: ReturnType<typeof useAuthSession>;
    let apiClient!: ReturnType<typeof useApiClient>;
    mockTokenStore.read.mockImplementation(async () => storedRefreshToken);
    mockTokenStore.clear.mockImplementation(async () => {
      storedRefreshToken = null;
    });
    mockTokenStore.write.mockImplementation(async (refreshToken) => {
      storedRefreshToken = refreshToken;
    });
    mockAuthApi.login.mockResolvedValue(initialSession);

    function RequestHarness() {
      sessionApi = useAuthSession();
      apiClient = useApiClient();
      return null;
    }

    const screen = await render(
      <AuthSessionProvider>
        <RequestHarness />
      </AuthSessionProvider>,
    );
    await waitFor(() => expect(sessionApi.status).toBe('anonymous'));
    await act(async () => {
      await sessionApi.login({ password: 'password', username: 'reader' });
    });

    mockTokenStore.write.mockClear();
    mockAuthApi.refresh.mockResolvedValue({
      ...initialSession,
      accessToken: 'shared-refreshed-access',
      refreshToken: 'shared-refreshed-refresh',
    });
    const fetchMock = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const authorization = (init?.headers as Record<string, string> | undefined)
        ?.Authorization;
      if (authorization === 'Bearer initial-access') {
        return new Response(
          JSON.stringify({
            data: null,
            error: { code: 'COMMON_UNAUTHORIZED', fields: [], message: 'unauthorized' },
            success: false,
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 401 },
        );
      }
      return new Response(
        JSON.stringify({ data: { ok: true }, error: null, success: true }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 },
      );
    });
    global.fetch = fetchMock as typeof fetch;

    let responses: unknown[] = [];
    await act(async () => {
      responses = await Promise.all([
        apiClient.get('/api/books'),
        apiClient.get('/api/reviews'),
      ]);
    });
    expect(responses).toEqual([{ ok: true }, { ok: true }]);

    expect(mockAuthApi.refresh).toHaveBeenCalledTimes(1);
    expect(mockAuthApi.refresh).toHaveBeenCalledWith('initial-refresh');
    expect(mockTokenStore.write).toHaveBeenCalledTimes(1);
    expect(mockTokenStore.write).toHaveBeenCalledWith('shared-refreshed-refresh');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await act(async () => screen.unmount());
  });
});
