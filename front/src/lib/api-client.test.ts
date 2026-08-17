import { afterEach, describe, expect, it, vi } from 'vitest';

import { authJson, fetchWithAuthRetry, getJson, postJson, rotateRefreshToken } from './api-client';
import {
  onAuthSessionChanged,
  onAuthSessionExpired,
  readAuthSession,
  writeAuthSession,
} from './auth-session';

function apiResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function apiError(code: string) {
  return {
    success: false,
    data: null,
    error: { code, fields: [], requestId: 'request-id' },
  };
}

function session(userId: number, accessToken: string) {
  return {
    userId,
    username: `reader-${userId}`,
    displayName: `Reader ${userId}`,
    authMode: 'local-jwt' as const,
    accessToken,
    accessTokenExpiresInSeconds: 900,
  };
}

function storageMock() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('api client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shares one refresh request across concurrent 401 responses', async () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    writeAuthSession({
      userId: 1,
      username: 'reader',
      displayName: 'Reader',
      authMode: 'local-jwt',
      accessToken: 'expired',
      accessTokenExpiresInSeconds: 900,
    });

    let refreshCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (input === '/api/auth/refresh') {
          refreshCount += 1;
          return apiResponse(200, {
            success: true,
            data: {
              userId: 1,
              username: 'reader',
              displayName: 'Reader',
              authMode: 'local-jwt',
              accessToken: 'fresh',
              accessTokenExpiresInSeconds: 900,
            },
          });
        }
        const headers = init?.headers as Record<string, string>;
        if (headers.Authorization === 'Bearer fresh') {
          return apiResponse(200, { success: true, data: { books: [] } });
        }
        return apiResponse(401, apiError('COMMON_UNAUTHORIZED'));
      }),
    );

    const [first, second] = await Promise.all([
      getJson<{ books: unknown[] }>('/api/books'),
      getJson<{ books: unknown[] }>('/api/books'),
    ]);

    expect(first.books).toEqual([]);
    expect(second.books).toEqual([]);
    expect(refreshCount).toBe(1);
  });

  it('replays an Axios 401 that arrives after same-lifetime token rotation', async () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    writeAuthSession(session(1, 'expired'));

    const initialRequestsStarted = deferred<void>();
    const firstUnauthorized = deferred<Response>();
    const delayedUnauthorized = deferred<Response>();
    const refreshStarted = deferred<void>();
    const refreshResponse = deferred<Response>();
    const freshRequestStarted = deferred<void>();
    let initialRequestCount = 0;
    let refreshCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        if (input === '/api/auth/refresh') {
          refreshCount += 1;
          refreshStarted.resolve();
          return refreshResponse.promise;
        }
        const authorization = (init?.headers as Record<string, string>).Authorization;
        if (authorization === 'Bearer fresh') {
          freshRequestStarted.resolve();
          return Promise.resolve(apiResponse(200, { success: true, data: { books: [] } }));
        }
        initialRequestCount += 1;
        if (initialRequestCount === 2) initialRequestsStarted.resolve();
        return initialRequestCount === 1 ? firstUnauthorized.promise : delayedUnauthorized.promise;
      }),
    );

    const first = getJson<{ books: unknown[] }>('/api/books');
    const second = getJson<{ books: unknown[] }>('/api/books');
    await initialRequestsStarted.promise;
    firstUnauthorized.resolve(apiResponse(401, apiError('COMMON_UNAUTHORIZED')));
    await refreshStarted.promise;
    refreshResponse.resolve(apiResponse(200, { success: true, data: session(1, 'fresh') }));
    await freshRequestStarted.promise;
    delayedUnauthorized.resolve(apiResponse(401, apiError('COMMON_UNAUTHORIZED')));

    await expect(Promise.all([first, second])).resolves.toEqual([{ books: [] }, { books: [] }]);
    expect(refreshCount).toBe(1);
  });

  it('does not dispatch an Axios replay after a newer principal takes over', async () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    writeAuthSession(session(1, 'expired'));

    let switchToNewPrincipal = false;
    const originalGetItem = sessionStorage.getItem;
    sessionStorage.getItem = (key: string) => {
      const value = originalGetItem(key);
      if (key === 'margins.auth' && switchToNewPrincipal) {
        switchToNewPrincipal = false;
        writeAuthSession(session(2, 'principal-b'));
      }
      return value;
    };
    const unsubscribe = onAuthSessionChanged((updated) => {
      if (updated.accessToken === 'fresh') switchToNewPrincipal = true;
    });
    let refreshCount = 0;
    let protectedRequestCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (input === '/api/auth/refresh') {
          refreshCount += 1;
          return apiResponse(200, { success: true, data: session(1, 'fresh') });
        }
        protectedRequestCount += 1;
        const authorization = (init?.headers as Record<string, string>).Authorization;
        if (authorization === 'Bearer principal-b') {
          return apiResponse(200, { success: true, data: { books: [] } });
        }
        return apiResponse(401, apiError('COMMON_UNAUTHORIZED'));
      }),
    );

    await expect(getJson<{ books: unknown[] }>('/api/books')).rejects.toMatchObject({
      code: 'AUTH_SESSION_CHANGED',
    });
    expect(refreshCount).toBe(1);
    expect(protectedRequestCount).toBe(1);
    expect(readAuthSession()).toMatchObject({ userId: 2, accessToken: 'principal-b' });
    unsubscribe();
  });

  it('replays a raw 401 that arrives after same-lifetime token rotation', async () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    writeAuthSession(session(1, 'expired'));

    const initialRequestsStarted = deferred<void>();
    const firstUnauthorized = deferred<Response>();
    const delayedUnauthorized = deferred<Response>();
    const refreshStarted = deferred<void>();
    const refreshResponse = deferred<Response>();
    const freshRequestStarted = deferred<void>();
    let initialRequestCount = 0;
    let refreshCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        if (input === '/api/auth/refresh') {
          refreshCount += 1;
          refreshStarted.resolve();
          return refreshResponse.promise;
        }
        const authorization = (init?.headers as Record<string, string>).Authorization;
        if (authorization === 'Bearer fresh') {
          freshRequestStarted.resolve();
          return Promise.resolve(apiResponse(200, { success: true, data: { ok: true } }));
        }
        initialRequestCount += 1;
        if (initialRequestCount === 2) initialRequestsStarted.resolve();
        return initialRequestCount === 1 ? firstUnauthorized.promise : delayedUnauthorized.promise;
      }),
    );

    const first = fetchWithAuthRetry('/api/debates/1/stream', { method: 'POST' });
    const second = fetchWithAuthRetry('/api/debates/1/stream', { method: 'POST' });
    await initialRequestsStarted.promise;
    firstUnauthorized.resolve(apiResponse(401, apiError('COMMON_UNAUTHORIZED')));
    await refreshStarted.promise;
    refreshResponse.resolve(apiResponse(200, { success: true, data: session(1, 'fresh') }));
    await freshRequestStarted.promise;
    delayedUnauthorized.resolve(apiResponse(401, apiError('COMMON_UNAUTHORIZED')));

    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(refreshCount).toBe(1);
  });

  it('retries an interview POST after 401 without losing the answer body', async () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    writeAuthSession({
      userId: 1,
      username: 'reader',
      displayName: 'Reader',
      authMode: 'local-jwt',
      accessToken: 'expired',
      accessTokenExpiresInSeconds: 900,
    });

    const payload = { questionId: 13, mode: 'ANSWER', content: '답변 본문' };
    const interviewCalls: Array<{ init?: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (input === '/api/auth/refresh') {
          return apiResponse(200, {
            success: true,
            data: {
              userId: 1,
              username: 'reader',
              displayName: 'Reader',
              authMode: 'local-jwt',
              accessToken: 'fresh',
              accessTokenExpiresInSeconds: 900,
            },
          });
        }
        interviewCalls.push({ init });
        const headers = init?.headers as Record<string, string>;
        if (headers.Authorization === 'Bearer expired') {
          return apiResponse(401, apiError('COMMON_UNAUTHORIZED'));
        }
        return apiResponse(200, { success: true, data: { saved: true } });
      }),
    );

    await expect(postJson('/api/reflection-interviews/12/responses', payload)).resolves.toEqual({
      saved: true,
    });

    expect(interviewCalls).toHaveLength(2);
    expect(interviewCalls[0].init?.body).toBe(interviewCalls[1].init?.body);
    expect(interviewCalls[1].init?.body).toBe(JSON.stringify(payload));
    expect((interviewCalls[1].init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer fresh',
    );
  });

  it('notifies the auth boundary when refresh is rejected', async () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    writeAuthSession({
      userId: 1,
      username: 'reader',
      displayName: 'Reader',
      authMode: 'local-jwt',
      accessToken: 'expired',
      accessTokenExpiresInSeconds: 900,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(apiResponse(401, apiError('COMMON_UNAUTHORIZED'))),
    );
    const listener = vi.fn();
    const unsubscribe = onAuthSessionExpired(listener);

    await expect(getJson('/api/books')).rejects.toMatchObject({
      code: 'COMMON_UNAUTHORIZED',
      requestId: 'request-id',
    });
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('does not let a stale Axios refresh overwrite a newer authenticated session', async () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    writeAuthSession(session(1, 'expired-a'));

    let resolveRefresh!: (response: Response) => void;
    let refreshStarted!: () => void;
    const refreshStartedPromise = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        if (input === '/api/auth/refresh') {
          refreshStarted();
          return refreshResponse;
        }
        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer expired-a');
        return Promise.resolve(apiResponse(401, apiError('COMMON_UNAUTHORIZED')));
      }),
    );
    const expiredListener = vi.fn();
    const unsubscribe = onAuthSessionExpired(expiredListener);

    const request = getJson('/api/books');
    await refreshStartedPromise;
    writeAuthSession(session(2, 'fresh-b'));
    resolveRefresh(
      apiResponse(200, {
        success: true,
        data: session(1, 'fresh-a'),
      }),
    );

    await expect(request).rejects.toMatchObject({ code: 'COMMON_UNAUTHORIZED' });
    expect(readAuthSession()).toMatchObject({ userId: 2, accessToken: 'fresh-b' });
    expect(expiredListener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('does not replay a prior principal request after a newer login', async () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    writeAuthSession(session(1, 'token-a'));

    let resolveInitialRequest!: (response: Response) => void;
    let requestStarted!: () => void;
    const requestStartedPromise = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    const initialResponse = new Promise<Response>((resolve) => {
      resolveInitialRequest = resolve;
    });
    let refreshCount = 0;
    const fetchMock = vi.fn((input: string) => {
      if (input === '/api/auth/refresh') {
        refreshCount += 1;
        return Promise.resolve(
          apiResponse(200, { success: true, data: session(2, 'refreshed-b') }),
        );
      }
      requestStarted();
      return initialResponse;
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = getJson('/api/books');
    await requestStartedPromise;
    writeAuthSession(session(2, 'token-b'));
    resolveInitialRequest(apiResponse(401, apiError('COMMON_UNAUTHORIZED')));

    await expect(request).rejects.toMatchObject({ code: 'COMMON_UNAUTHORIZED' });
    expect(refreshCount).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readAuthSession()).toMatchObject({ userId: 2, accessToken: 'token-b' });
  });

  it('does not refresh a raw request dispatched before a newer same-token session revision', async () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    writeAuthSession(session(1, 'token-a'));

    let resolveInitialRequest!: (response: Response) => void;
    let requestStarted!: () => void;
    const requestStartedPromise = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    const initialResponse = new Promise<Response>((resolve) => {
      resolveInitialRequest = resolve;
    });
    let refreshCount = 0;
    const fetchMock = vi.fn((input: string) => {
      if (input === '/api/auth/refresh') {
        refreshCount += 1;
        return Promise.resolve(apiResponse(200, { success: true, data: session(1, 'fresh-a') }));
      }
      requestStarted();
      return initialResponse;
    });
    vi.stubGlobal('fetch', fetchMock);

    const request = fetchWithAuthRetry('/api/debates/1/stream', { method: 'POST' });
    await requestStartedPromise;
    writeAuthSession({ ...session(1, 'token-a'), displayName: 'Updated Reader' });
    resolveInitialRequest(apiResponse(401, apiError('COMMON_UNAUTHORIZED')));

    const response = await request;
    expect(response.status).toBe(401);
    expect(refreshCount).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readAuthSession()).toMatchObject({ userId: 1, displayName: 'Updated Reader' });
  });

  it('does not let a bootstrap refresh overwrite a session created while it is pending', async () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });

    let resolveRefresh!: (response: Response) => void;
    let refreshStarted!: () => void;
    const refreshStartedPromise = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input === '/api/auth/refresh') {
          refreshStarted();
          return refreshResponse;
        }
        return Promise.resolve(apiResponse(401, apiError('COMMON_UNAUTHORIZED')));
      }),
    );

    const refresh = rotateRefreshToken();
    await refreshStartedPromise;
    writeAuthSession(session(2, 'fresh-b'));
    resolveRefresh(
      apiResponse(200, {
        success: true,
        data: session(1, 'fresh-a'),
      }),
    );

    await expect(refresh).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    expect(readAuthSession()).toMatchObject({ userId: 2, accessToken: 'fresh-b' });
  });

  it('turns a stale bootstrap refresh failure into session-change cancellation', async () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });

    let resolveRefresh!: (response: Response) => void;
    let refreshStarted!: () => void;
    const refreshStartedPromise = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input === '/api/auth/refresh') {
          refreshStarted();
          return refreshResponse;
        }
        return Promise.resolve(apiResponse(401, apiError('COMMON_UNAUTHORIZED')));
      }),
    );

    const refresh = rotateRefreshToken();
    await refreshStartedPromise;
    writeAuthSession(session(2, 'fresh-b'));
    resolveRefresh(apiResponse(401, apiError('COMMON_UNAUTHORIZED')));

    await expect(refresh).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' });
    expect(readAuthSession()).toMatchObject({ userId: 2, accessToken: 'fresh-b' });
  });

  it('does not let a stale fetch refresh clear a newer authenticated session', async () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    writeAuthSession(session(1, 'expired-a'));

    let resolveRefresh!: (response: Response) => void;
    let refreshStarted!: () => void;
    const refreshStartedPromise = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input === '/api/auth/refresh') {
          refreshStarted();
          return refreshResponse;
        }
        return Promise.resolve(apiResponse(401, apiError('COMMON_UNAUTHORIZED')));
      }),
    );
    const expiredListener = vi.fn();
    const unsubscribe = onAuthSessionExpired(expiredListener);

    const request = fetchWithAuthRetry('/api/debates/1/stream', { method: 'POST' });
    await refreshStartedPromise;
    writeAuthSession(session(2, 'fresh-b'));
    resolveRefresh(
      apiResponse(200, {
        success: true,
        data: session(1, 'fresh-a'),
      }),
    );

    const response = await request;
    expect(response.status).toBe(401);
    expect(readAuthSession()).toMatchObject({ userId: 2, accessToken: 'fresh-b' });
    expect(expiredListener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('does not expire a same-token session revision written during Axios refresh', async () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    writeAuthSession(session(1, 'expired-a'));

    let resolveRefresh!: (response: Response) => void;
    let refreshStarted!: () => void;
    const refreshStartedPromise = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input === '/api/auth/refresh') {
          refreshStarted();
          return refreshResponse;
        }
        return Promise.resolve(apiResponse(401, apiError('COMMON_UNAUTHORIZED')));
      }),
    );
    const expiredListener = vi.fn();
    const unsubscribe = onAuthSessionExpired(expiredListener);

    const request = getJson('/api/books');
    await refreshStartedPromise;
    writeAuthSession({ ...session(1, 'expired-a'), displayName: 'Updated Reader' });
    resolveRefresh(apiResponse(200, { success: true, data: session(1, 'fresh-a') }));

    await expect(request).rejects.toMatchObject({ code: 'COMMON_UNAUTHORIZED' });
    expect(readAuthSession()).toMatchObject({ userId: 1, displayName: 'Updated Reader' });
    expect(expiredListener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('does not expire a same-token session revision written during raw fetch refresh', async () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    writeAuthSession(session(1, 'expired-a'));

    let resolveRefresh!: (response: Response) => void;
    let refreshStarted!: () => void;
    const refreshStartedPromise = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        if (input === '/api/auth/refresh') {
          refreshStarted();
          return refreshResponse;
        }
        return Promise.resolve(apiResponse(401, apiError('COMMON_UNAUTHORIZED')));
      }),
    );
    const expiredListener = vi.fn();
    const unsubscribe = onAuthSessionExpired(expiredListener);

    const request = fetchWithAuthRetry('/api/debates/1/stream', { method: 'POST' });
    await refreshStartedPromise;
    writeAuthSession({ ...session(1, 'expired-a'), displayName: 'Updated Reader' });
    resolveRefresh(apiResponse(200, { success: true, data: session(1, 'fresh-a') }));

    const response = await request;
    expect(response.status).toBe(401);
    expect(readAuthSession()).toMatchObject({ userId: 1, displayName: 'Updated Reader' });
    expect(expiredListener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('notifies consent routing once for Axios and raw fetch 428 responses', async () => {
    const eventTarget = new EventTarget();
    vi.stubGlobal('window', {
      sessionStorage: storageMock(),
      localStorage: storageMock(),
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    });
    const listener = vi.fn();
    window.addEventListener('margins:consent-required', listener);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(apiResponse(428, apiError('PRIVACY_CONSENT_REQUIRED'))),
    );

    await expect(getJson('/api/books')).rejects.toMatchObject({
      code: 'PRIVACY_CONSENT_REQUIRED',
    });
    expect(listener).toHaveBeenCalledTimes(1);

    const response = await fetchWithAuthRetry('/api/debates/1/stream', { method: 'POST' });
    expect(response.status).toBe(428);
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener('margins:consent-required', listener);
  });

  it('preserves Retry-After on typed rate-limit failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(apiError('AUTH_EMAIL_VERIFICATION_RATE_LIMITED')), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '17' },
        }),
      ),
    );

    await expect(
      authJson({
        url: '/api/auth/email-verifications',
        method: 'POST',
        data: { email: 'reader@example.com', botChallengeToken: 'token' },
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_EMAIL_VERIFICATION_RATE_LIMITED',
      status: 429,
      retryAfterSeconds: 17,
    });
  });
});
