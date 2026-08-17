import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearAuthSession,
  markAuthSessionConsentSatisfied,
  onAuthSessionChanged,
  readAuthSession,
  readAuthSessionLifetime,
  readRefreshSessionHint,
  writeAuthSession,
} from './auth-session';

function storageMock() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('auth session', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stores only the access-token session and a non-sensitive refresh hint', () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });

    writeAuthSession({
      userId: 1,
      username: 'reader',
      displayName: 'Reader',
      authMode: 'local-jwt',
      accessToken: 'token',
      accessTokenExpiresInSeconds: 900,
    });

    expect(readAuthSession()?.accessToken).toBe('token');
    expect(readRefreshSessionHint()).toBe(true);

    clearAuthSession({ clearRefreshHint: true, markExplicitLogout: true });
    expect(readAuthSession()).toBeUndefined();
    expect(readRefreshSessionHint()).toBe(false);
  });

  it('clears the cached consent gate after an existing member grants consent', () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });

    writeAuthSession({
      userId: 1,
      username: 'reader',
      displayName: 'Reader',
      authMode: 'local-jwt',
      accessToken: 'token',
      accessTokenExpiresInSeconds: 900,
      consentRequired: true,
    });

    expect(markAuthSessionConsentSatisfied()?.consentRequired).toBe(false);
    expect(readAuthSession()?.consentRequired).toBe(false);
  });

  it('preserves lifetime for token rotation and advances it at session boundaries', () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    const value = {
      userId: 1,
      username: 'reader',
      displayName: 'Reader',
      authMode: 'local-jwt' as const,
      accessToken: 'token',
      accessTokenExpiresInSeconds: 900,
    };

    writeAuthSession(value);
    const loginLifetime = readAuthSessionLifetime();
    writeAuthSession({ ...value, accessToken: 'fresh-token' }, { preserveLifetime: true });

    expect(readAuthSessionLifetime()).toBe(loginLifetime);

    writeAuthSession({ ...value, accessToken: 'new-login-token' });
    const reloginLifetime = readAuthSessionLifetime();
    clearAuthSession({ clearRefreshHint: true, markExplicitLogout: true });

    expect(reloginLifetime).toBeGreaterThan(loginLifetime);
    expect(readAuthSessionLifetime()).toBeGreaterThan(reloginLifetime);
  });

  it('notifies the authenticated shell when a session is written', () => {
    const sessionStorage = storageMock();
    const localStorage = storageMock();
    vi.stubGlobal('window', { sessionStorage, localStorage });
    const listener = vi.fn();
    const unsubscribe = onAuthSessionChanged(listener);
    const value = {
      userId: 1,
      username: 'reader',
      displayName: 'Reader',
      authMode: 'local-jwt' as const,
      accessToken: 'token',
      accessTokenExpiresInSeconds: 900,
    };

    writeAuthSession(value);

    expect(listener).toHaveBeenCalledWith(value);
    unsubscribe();
  });
});
