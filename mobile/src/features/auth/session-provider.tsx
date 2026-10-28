import { QueryClientProvider } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ApiClient } from '@/shared/api/client';
import { ApiClientProvider } from '@/shared/api/api-client-provider';
import { ApiRequestError, isInvalidRefresh } from '@/shared/api/error';
import type { SessionSnapshot } from '@/shared/api/types';
import { secureTokenStore } from '@/shared/auth/secure-token-store';
import { apiBaseUrl } from '@/shared/config';
import { useI18n } from '@/shared/i18n/i18n-provider';
import { createQueryClient } from '@/shared/query/create-query-client';
import { Button, Notice, Screen } from '@/shared/ui';

import { authApi, createGoogleOAuthVerifier } from './api';
import { authCopy } from './copy';
import type {
  AuthSession,
  ConsentInput,
  LoginInput,
  NativeSessionResponse,
  RegistrationInput,
} from './types';

type SessionStatus =
  | 'anonymous'
  | 'authenticated'
  | 'consent-required'
  | 'restore-error'
  | 'restoring';

type SessionRuntime = {
  googleRegistrationPending?: boolean;
  lifetime: number;
  logoutState?: 'clear-error' | 'clearing';
  session?: AuthSession;
  status: SessionStatus;
};

type AuthContextValue = SessionRuntime & {
  authAttemptActive: boolean;
  login(input: LoginInput): Promise<void>;
  completeGoogleOAuthCode(code: string): Promise<boolean>;
  loginWithGoogle(): Promise<boolean>;
  logout(): Promise<void>;
  refreshSession(): Promise<void>;
  register(input: RegistrationInput): Promise<void>;
  registerWithGoogle(input: ConsentInput): Promise<void>;
  retryRestore(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const initialRuntime: SessionRuntime = { lifetime: 0, status: 'restoring' };

type AuthAttemptOwnership = {
  attemptGeneration: number;
  mutationVersion: number;
};

export function createGoogleCallbackCoordinator() {
  let verifier: string | undefined;
  let current:
    | { code: string; promise: Promise<boolean>; settled: boolean }
    | undefined;
  const complete = (
    code: string,
    exchange: (code: string, verifier: string) => Promise<boolean>,
  ) => {
    if (current?.code === code) return current.promise;
    if (current && !current.settled) {
      return Promise.reject(
        new ApiRequestError({
          code: 'AUTH_GOOGLE_OAUTH_REQUEST_INVALID',
          status: 400,
        }),
      );
    }
    const activeVerifier = verifier;
    if (!activeVerifier) {
      return Promise.reject(
        new ApiRequestError({
          code: 'AUTH_GOOGLE_OAUTH_REQUEST_INVALID',
          status: 400,
        }),
      );
    }
    const slot = {
      code,
      promise: undefined as unknown as Promise<boolean>,
      settled: false,
    };
    slot.promise = exchange(code, activeVerifier).finally(() => {
      slot.settled = true;
      if (verifier === activeVerifier) verifier = undefined;
    });
    current = slot;
    return slot.promise;
  };
  return {
    begin(nextVerifier: string) {
      verifier = nextVerifier;
    },
    clear() {
      verifier = undefined;
      current = undefined;
    },
    complete,
  };
}

export function createSessionMutationQueue() {
  let tail: Promise<void> = Promise.resolve();
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = tail.then(operation, operation);
    tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
}

type SessionMutationQueue = ReturnType<typeof createSessionMutationQueue>;

let logoutCredentialClearRequired = false;
let logoutCredentialClearInFlight: Promise<string | undefined> | undefined;

function clearCredentialForLogout(enqueue: SessionMutationQueue) {
  logoutCredentialClearRequired = true;
  if (logoutCredentialClearInFlight) return logoutCredentialClearInFlight;
  const operation = enqueue(async () => {
    let refreshToken: string | null = null;
    try {
      refreshToken = await secureTokenStore.read();
    } catch {
      // Clearing the local credential is authoritative even when it cannot be read for revocation.
    }
    await secureTokenStore.clear();
    logoutCredentialClearRequired = false;
    return refreshToken ?? undefined;
  });
  logoutCredentialClearInFlight = operation;
  void operation.finally(() => {
    if (logoutCredentialClearInFlight === operation) logoutCredentialClearInFlight = undefined;
  }).catch(() => undefined);
  return operation;
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const { setLocale } = useI18n();
  const runtimeRef = useRef<SessionRuntime>(initialRuntime);
  const [runtime, setRuntime] = useState<SessionRuntime>(initialRuntime);
  const refreshInFlight = useRef<
    { lifetime: number; promise: Promise<SessionSnapshot> } | undefined
  >(undefined);
  const restoreInFlight = useRef<Promise<void> | undefined>(undefined);
  const pendingGoogleRegistrationTokenRef = useRef<string | undefined>(undefined);
  const googleStartInFlight = useRef<Promise<boolean> | undefined>(undefined);
  const googleAttemptOwnershipRef = useRef<AuthAttemptOwnership | undefined>(undefined);
  const [googleCallback] = useState(createGoogleCallbackCoordinator);
  const sessionMutationVersionRef = useRef(0);
  const authAttemptGenerationRef = useRef(0);
  const activeAuthAttemptRef = useRef<
    { generation: number; kind: 'google' | 'local' } | undefined
  >(undefined);
  const [authAttemptActive, setAuthAttemptActive] = useState(false);
  const [enqueueSessionMutation] = useState(() => createSessionMutationQueue());

  const publish = useCallback((next: SessionRuntime) => {
    runtimeRef.current = next;
    setRuntime(next);
  }, []);

  const snapshot = useCallback((): SessionSnapshot => {
    const current = runtimeRef.current;
    return {
      accessToken: current.session?.accessToken,
      lifetime: current.lifetime,
      userId: current.session?.userId,
    };
  }, []);

  const isCurrent = useCallback((bound: SessionSnapshot) => {
    const current = runtimeRef.current;
    return current.lifetime === bound.lifetime && current.session?.userId === bound.userId;
  }, []);

  const isAuthAttemptCurrent = useCallback((ownership: AuthAttemptOwnership) => {
    return (
      activeAuthAttemptRef.current?.generation === ownership.attemptGeneration &&
      sessionMutationVersionRef.current === ownership.mutationVersion
    );
  }, []);

  const beginAuthAttempt = useCallback(
    (kind: 'google' | 'local'): AuthAttemptOwnership => {
      const ownership = {
        attemptGeneration: ++authAttemptGenerationRef.current,
        mutationVersion: ++sessionMutationVersionRef.current,
      };
      activeAuthAttemptRef.current = { generation: ownership.attemptGeneration, kind };
      setAuthAttemptActive(true);
      googleCallback.clear();
      googleAttemptOwnershipRef.current = kind === 'google' ? ownership : undefined;
      if (kind === 'local') googleStartInFlight.current = undefined;
      return ownership;
    },
    [googleCallback],
  );

  const finishAuthAttempt = useCallback((ownership: AuthAttemptOwnership) => {
    if (activeAuthAttemptRef.current?.generation !== ownership.attemptGeneration) return;
    activeAuthAttemptRef.current = undefined;
    if (googleAttemptOwnershipRef.current?.attemptGeneration === ownership.attemptGeneration) {
      googleAttemptOwnershipRef.current = undefined;
    }
    setAuthAttemptActive(false);
  }, []);

  const cancelAuthAttempts = useCallback(() => {
    authAttemptGenerationRef.current += 1;
    activeAuthAttemptRef.current = undefined;
    googleAttemptOwnershipRef.current = undefined;
    googleStartInFlight.current = undefined;
    googleCallback.clear();
    setAuthAttemptActive(false);
  }, [googleCallback]);

  const commitSession = useCallback(
    async (
      response: NativeSessionResponse,
      preserveLifetime: boolean,
      bound?: SessionSnapshot,
      ownership?: AuthAttemptOwnership,
    ) => {
      const mutationVersion =
        ownership?.mutationVersion ??
        (preserveLifetime
          ? sessionMutationVersionRef.current
          : ++sessionMutationVersionRef.current);
      return enqueueSessionMutation(async () => {
        const stale = () =>
          mutationVersion !== sessionMutationVersionRef.current ||
          (ownership !== undefined && !isAuthAttemptCurrent(ownership)) ||
          (bound !== undefined && !isCurrent(bound));
        if (stale()) {
          throw new ApiRequestError({ code: 'AUTH_SESSION_CHANGED', status: 401 });
        }
        await secureTokenStore.write(response.refreshToken);
        if (stale()) {
          if (ownership) await secureTokenStore.clear();
          throw new ApiRequestError({ code: 'AUTH_SESSION_CHANGED', status: 401 });
        }
        const {
          refreshToken: _refreshToken,
          refreshTokenExpiresInSeconds: _refreshTokenExpiresInSeconds,
          ...session
        } = response;
        const current = runtimeRef.current;
        const samePrincipal = current.session?.userId === session.userId;
        const next = {
          lifetime: preserveLifetime && samePrincipal ? current.lifetime : current.lifetime + 1,
          session,
          status: session.consentRequired ? 'consent-required' : 'authenticated',
        } satisfies SessionRuntime;
        pendingGoogleRegistrationTokenRef.current = undefined;
        publish(next);
        if (session.preferredLocale) void setLocale(session.preferredLocale).catch(() => undefined);
        return snapshot();
      });
    },
    [enqueueSessionMutation, isAuthAttemptCurrent, isCurrent, publish, setLocale, snapshot],
  );

  const removeLocalSession = useCallback(
    (bound?: SessionSnapshot) => {
      if (bound && !isCurrent(bound)) return Promise.resolve(undefined);
      sessionMutationVersionRef.current += 1;
      const current = runtimeRef.current;
      pendingGoogleRegistrationTokenRef.current = undefined;
      googleCallback.clear();
      publish({ lifetime: current.lifetime + 1, status: 'anonymous' });
      return enqueueSessionMutation(async () => {
        await secureTokenStore.clear();
      });
    },
    [enqueueSessionMutation, googleCallback, isCurrent, publish],
  );

  const clearLocalSession = useCallback(
    async (bound?: SessionSnapshot) => {
      await removeLocalSession(bound);
    },
    [removeLocalSession],
  );

  const refreshBoundSession = useCallback(
    async (bound: SessionSnapshot): Promise<SessionSnapshot> => {
      if (!isCurrent(bound) || !runtimeRef.current.session) {
        throw new ApiRequestError({ code: 'AUTH_SESSION_CHANGED', status: 401 });
      }
      const current = snapshot();
      if (current.accessToken !== bound.accessToken) return current;
      if (refreshInFlight.current?.lifetime === bound.lifetime) {
        return refreshInFlight.current.promise;
      }

      const promise = (async () => {
        const refreshToken = await secureTokenStore.read();
        if (!refreshToken) {
          await clearLocalSession(bound);
          throw new ApiRequestError({ code: 'AUTH_REFRESH_TOKEN_INVALID', status: 401 });
        }
        try {
          const session = await authApi.refresh(refreshToken);
          if (!isCurrent(bound)) {
            throw new ApiRequestError({ code: 'AUTH_SESSION_CHANGED', status: 401 });
          }
          return await commitSession(session, true, bound);
        } catch (error) {
          if (isInvalidRefresh(error) && isCurrent(bound)) await clearLocalSession(bound);
          throw error;
        }
      })();
      refreshInFlight.current = { lifetime: bound.lifetime, promise };
      void promise.finally(() => {
        if (refreshInFlight.current?.promise === promise) refreshInFlight.current = undefined;
      }).catch(() => undefined);
      return promise;
    },
    [clearLocalSession, commitSession, isCurrent, snapshot],
  );

  const restore = useCallback(async () => {
    if (restoreInFlight.current) return restoreInFlight.current;
    const promise = (async () => {
      publish({ lifetime: runtimeRef.current.lifetime, status: 'restoring' });
      try {
        if (logoutCredentialClearRequired) {
          const refreshToken = await clearCredentialForLogout(enqueueSessionMutation);
          publish({ lifetime: runtimeRef.current.lifetime + 1, status: 'anonymous' });
          if (refreshToken) void authApi.logout(refreshToken).catch(() => undefined);
          return;
        }
        const refreshToken = await secureTokenStore.read();
        if (!refreshToken) {
          publish({ lifetime: runtimeRef.current.lifetime + 1, status: 'anonymous' });
          return;
        }
        const session = await authApi.refresh(refreshToken);
        await commitSession(session, false);
      } catch (error) {
        if (logoutCredentialClearRequired) {
          publish({
            lifetime: runtimeRef.current.lifetime,
            logoutState: 'clear-error',
            status: 'restoring',
          });
          return;
        }
        if (isInvalidRefresh(error)) {
          await clearLocalSession();
          return;
        }
        publish({ lifetime: runtimeRef.current.lifetime, status: 'restore-error' });
      }
    })();
    restoreInFlight.current = promise;
    try {
      await promise;
    } finally {
      if (restoreInFlight.current === promise) restoreInFlight.current = undefined;
    }
  }, [clearLocalSession, commitSession, enqueueSessionMutation, publish]);

  useEffect(() => {
    void restore();
  }, [restore]);

  const markConsentRequired = useCallback(() => {
    const current = runtimeRef.current;
    if (current.session && current.status !== 'consent-required') {
      publish({ ...current, status: 'consent-required' });
    }
  }, [publish]);

  // ApiClient only stores these callbacks; it never invokes them during construction/render.
  const [apiClient] = useState(
    // eslint-disable-next-line react-hooks/refs
    () =>
      new ApiClient(apiBaseUrl, {
        current: snapshot,
        expire: clearLocalSession,
        isCurrent,
        refresh: refreshBoundSession,
        requireConsent: markConsentRequired,
      }),
  );

  const queryClient = useMemo(() => createQueryClient(runtime.lifetime), [runtime.lifetime]);
  useEffect(() => () => queryClient.clear(), [queryClient]);

  const login = useCallback(
    async (input: LoginInput) => {
      const ownership = beginAuthAttempt('local');
      try {
        await commitSession(await authApi.login(input), false, undefined, ownership);
      } finally {
        finishAuthAttempt(ownership);
      }
    },
    [beginAuthAttempt, commitSession, finishAuthAttempt],
  );

  const register = useCallback(
    async (input: RegistrationInput) => {
      const ownership = beginAuthAttempt('local');
      try {
        await commitSession(await authApi.register(input), false, undefined, ownership);
      } finally {
        finishAuthAttempt(ownership);
      }
    },
    [beginAuthAttempt, commitSession, finishAuthAttempt],
  );

  const applyGoogleOAuthCode = useCallback(
    async (code: string, verifier: string, ownership: AuthAttemptOwnership) => {
      if (!isAuthAttemptCurrent(ownership)) {
        throw new ApiRequestError({ code: 'AUTH_SESSION_CHANGED', status: 401 });
      }
      const result = await authApi.exchangeGoogleOAuth(code, verifier);
      if (!isAuthAttemptCurrent(ownership)) {
        throw new ApiRequestError({ code: 'AUTH_SESSION_CHANGED', status: 401 });
      }
      if (result.status === 'REGISTRATION_REQUIRED') {
        const current = runtimeRef.current;
        pendingGoogleRegistrationTokenRef.current = result.pendingRegistrationToken;
        publish({ ...current, googleRegistrationPending: true });
        return true;
      }
      await commitSession(result.session, false, undefined, ownership);
      return false;
    },
    [commitSession, isAuthAttemptCurrent, publish],
  );

  const completeGoogleOAuthCode = useCallback(
    (code: string) => {
      const ownership = googleAttemptOwnershipRef.current;
      if (!ownership) {
        return Promise.reject(
          new ApiRequestError({ code: 'AUTH_GOOGLE_OAUTH_REQUEST_INVALID', status: 400 }),
        );
      }
      return googleCallback.complete(code, (nextCode, verifier) =>
        applyGoogleOAuthCode(nextCode, verifier, ownership));
    },
    [applyGoogleOAuthCode, googleCallback],
  );

  const loginWithGoogle = useCallback(async () => {
    if (
      googleStartInFlight.current &&
      activeAuthAttemptRef.current?.kind === 'google'
    ) return googleStartInFlight.current;
    const ownership = beginAuthAttempt('google');
    let promise!: Promise<boolean>;
    promise = (async () => {
      try {
        const proof = await createGoogleOAuthVerifier();
        if (!isAuthAttemptCurrent(ownership)) {
          throw new ApiRequestError({ code: 'AUTH_SESSION_CHANGED', status: 401 });
        }
        googleCallback.begin(proof.verifier);
        const code = await authApi.startGoogleOAuth(proof.challenge);
        if (!isAuthAttemptCurrent(ownership)) {
          throw new ApiRequestError({ code: 'AUTH_SESSION_CHANGED', status: 401 });
        }
        return await googleCallback.complete(code, (nextCode, verifier) =>
          applyGoogleOAuthCode(nextCode, verifier, ownership));
      } catch (error) {
        if (isAuthAttemptCurrent(ownership)) googleCallback.clear();
        throw error;
      } finally {
        if (googleStartInFlight.current === promise) {
          googleStartInFlight.current = undefined;
        }
        finishAuthAttempt(ownership);
      }
    })();
    googleStartInFlight.current = promise;
    return promise;
  }, [
    applyGoogleOAuthCode,
    beginAuthAttempt,
    finishAuthAttempt,
    googleCallback,
    isAuthAttemptCurrent,
  ]);

  const registerWithGoogle = useCallback(
    async (input: ConsentInput) => {
      const pendingGoogleRegistrationToken = pendingGoogleRegistrationTokenRef.current;
      if (!pendingGoogleRegistrationToken) {
        throw new ApiRequestError({ code: 'AUTH_GOOGLE_OAUTH_REQUEST_INVALID', status: 400 });
      }
      const ownership = beginAuthAttempt('google');
      try {
        await commitSession(
          await authApi.completeGoogleRegistration({
            ...input,
            pendingRegistrationToken: pendingGoogleRegistrationToken,
          }),
          false,
          undefined,
          ownership,
        );
      } finally {
        finishAuthAttempt(ownership);
      }
    },
    [beginAuthAttempt, commitSession, finishAuthAttempt],
  );

  const logout = useCallback(async () => {
    cancelAuthAttempts();
    sessionMutationVersionRef.current += 1;
    const current = runtimeRef.current;
    pendingGoogleRegistrationTokenRef.current = undefined;
    googleCallback.clear();
    publish({
      lifetime: current.lifetime + 1,
      logoutState: 'clearing',
      status: 'restoring',
    });
    try {
      const refreshToken = await clearCredentialForLogout(enqueueSessionMutation);
      publish({ lifetime: runtimeRef.current.lifetime, status: 'anonymous' });
      if (refreshToken) await authApi.logout(refreshToken).catch(() => undefined);
    } catch {
      publish({
        lifetime: runtimeRef.current.lifetime,
        logoutState: 'clear-error',
        status: 'restoring',
      });
    }
  }, [cancelAuthAttempts, enqueueSessionMutation, googleCallback, publish]);

  const refreshSession = useCallback(async () => {
    await refreshBoundSession(snapshot());
  }, [refreshBoundSession, snapshot]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...runtime, authAttemptActive, completeGoogleOAuthCode, login, loginWithGoogle, logout, refreshSession, register, registerWithGoogle, retryRestore: restore }),
    [authAttemptActive, completeGoogleOAuthCode, login, loginWithGoogle, logout, refreshSession, register, registerWithGoogle, restore, runtime],
  );

  return (
    <AuthContext.Provider value={value}>
      <ApiClientProvider client={apiClient}>
        <QueryClientProvider client={queryClient}>
          {runtime.logoutState === 'clear-error'
            ? <LogoutClearErrorScreen retry={logout} />
            : children}
        </QueryClientProvider>
      </ApiClientProvider>
    </AuthContext.Provider>
  );
}

function LogoutClearErrorScreen({ retry }: { retry(): Promise<void> }) {
  const { locale } = useI18n();
  const [retrying, setRetrying] = useState(false);

  async function retryClear() {
    setRetrying(true);
    try {
      await retry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <Screen>
      <Notice title={authCopy(locale, 'logoutClearFailedTitle')} tone="error">
        {authCopy(locale, 'logoutClearFailedBody')}
      </Notice>
      <Button loading={retrying} onPress={() => void retryClear()} variant="primary">
        {authCopy(locale, 'retryLogout')}
      </Button>
    </Screen>
  );
}

export function useAuthSession() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuthSession must be used inside AuthSessionProvider');
  return value;
}
