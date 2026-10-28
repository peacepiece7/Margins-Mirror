import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api-client';
import { apiErrorTranslationKey } from '@/lib/api-error-i18n';
import { useI18n } from '@/lib/i18n';
import { removeProtectedQueries } from '@/lib/query-client';
import type { LoginResponse } from '@/types/api/auth';
import { authApi } from './api';
import * as authSessionService from './session';

function isSupersededRefresh(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === 'AUTH_SESSION_CHANGED';
}

export function useAuthSession(setError: (message: string | undefined) => void) {
  const { setLocale, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [authSession, setAuthSession] = useState<LoginResponse>();
  const [authBootstrapped, setAuthBootstrapped] = useState(false);
  useEffect(() => {
    if (authSession?.preferredLocale) setLocale(authSession.preferredLocale);
  }, [authSession?.preferredLocale, setLocale]);
  useEffect(() => {
    let cancelled = false;
    function finishBootstrap() {
      if (!cancelled) {
        setAuthBootstrapped(true);
      }
    }

    async function bootstrapAuth() {
      const existing = authSessionService.readAuthSession();
      if (existing) {
        setAuthSession(existing);
        finishBootstrap();
        return;
      }

      const params = new URLSearchParams(location.search);
      if (location.pathname === '/auth/callback') {
        const callbackError = params.get('error');
        if (callbackError) {
          setError(t(apiErrorTranslationKey(callbackError, 'loginFailed')));
          navigate('/login', { replace: true });
          finishBootstrap();
          return;
        }
        if (params.get('registration') === 'required') {
          navigate('/consent?registration=google', { replace: true });
          finishBootstrap();
          return;
        }
        if (params.get('login') === 'success' || params.get('link') === 'success') {
          try {
            const refreshed = await authApi.refresh();
            setAuthSession(refreshed);
            navigate('/', { replace: true });
            finishBootstrap();
            return;
          } catch (error) {
            if (isSupersededRefresh(error)) {
              setAuthSession(authSessionService.readAuthSession());
              finishBootstrap();
              return;
            }
            setError(t('loginFailed'));
            navigate('/login', { replace: true });
            finishBootstrap();
            return;
          }
        }
      }

      const hadRefreshHint = authSessionService.readRefreshSessionHint();
      const shouldAttemptRefresh = authSessionService.shouldAttemptBootstrapRefresh();
      if (!shouldAttemptRefresh) {
        removeProtectedQueries(queryClient);
        setAuthSession(undefined);
        finishBootstrap();
        return;
      }

      try {
        const refreshed = await authApi.refresh();
        setAuthSession(refreshed);
      } catch (refreshError) {
        if (isSupersededRefresh(refreshError)) {
          setAuthSession(authSessionService.readAuthSession());
          return;
        }
        const invalidRefresh = authSessionService.isInvalidRefreshFailure(refreshError);
        authSessionService.clearAuthSession({
          clearRefreshHint: invalidRefresh && hadRefreshHint,
        });
        if (invalidRefresh && !hadRefreshHint) {
          authSessionService.markLegacyRefreshAttempted();
        }
        removeProtectedQueries(queryClient);
        setAuthSession(undefined);
      } finally {
        finishBootstrap();
      }
    }

    void bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, navigate, queryClient, setError, t]);

  useEffect(() => {
    return authSessionService.onAuthSessionChanged(setAuthSession);
  }, []);

  useEffect(() => {
    return authSessionService.onAuthSessionExpired(() => {
      removeProtectedQueries(queryClient);
      try {
        window.localStorage.removeItem('margins.selectedSessionId');
      } catch {
        // localStorage가 막힌 경우에는 제거할 selected session cache도 없다.
      }
      setAuthSession(undefined);
    });
  }, [queryClient]);

  useEffect(() => {
    function requireConsent() {
      navigate('/consent');
    }
    window.addEventListener('margins:consent-required', requireConsent);
    return () => window.removeEventListener('margins:consent-required', requireConsent);
  }, [navigate]);

  useEffect(() => {
    if (authSession?.consentRequired) navigate('/consent', { replace: true });
  }, [authSession, navigate]);

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      removeProtectedQueries(queryClient);
      authSessionService.clearAuthSession({
        clearRefreshHint: true,
        markExplicitLogout: true,
      });
      try {
        window.localStorage.removeItem('margins.selectedSessionId');
      } catch {
        /* Storage may be unavailable. */
      }
      setAuthSession(undefined);
      navigate('/', { replace: true });
    }
  }

  return { authSession, authBootstrapped, setAuthSession, logout };
}
