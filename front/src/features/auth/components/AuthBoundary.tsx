import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SubmitHandler, useForm, useWatch } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiErrorMessage, apiErrorTranslationKey } from '@/lib/api-error-i18n';
import { ApiRequestError } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n';
import type { LoginResponse } from '@/types/api/auth';
import { testAttr } from '@/utils/testAttrs';
import { removeProtectedQueries } from '@/lib/query-client';

import { authApi } from '../api';
import * as authSessionService from '../session';
import { AuthShell } from './AuthShell';
import { AuthenticatedQueryProvider } from './AuthenticatedQueryProvider';
import { LanguageToggle } from './LanguageToggle';
import { LoginForm } from './LoginForm';
import { RegistrationForm } from './RegistrationForm';
import type { AuthFormValues } from './auth-form';
const privacyVersion = '2026-07-27';

function isSupersededRefresh(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === 'AUTH_SESSION_CHANGED';
}

type AuthBoundaryProps = {
  authenticated: (context: { logout: () => Promise<void>; session: LoginResponse }) => ReactNode;
};

export function AuthBoundary({ authenticated }: AuthBoundaryProps) {
  const { locale, setLocale, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [authSession, setAuthSession] = useState<LoginResponse | undefined>();
  const [authBootstrapped, setAuthBootstrapped] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | undefined>();
  const [emailAvailabilityMessage, setEmailAvailabilityMessage] = useState<string | undefined>();
  const [verifiedAvailableEmail, setVerifiedAvailableEmail] = useState<string | undefined>();
  const [verifiedEmail, setVerifiedEmail] = useState<string | undefined>();
  const [verifiedEmailVerificationCode, setVerifiedEmailVerificationCode] = useState<
    string | undefined
  >();
  const [verificationCodeRequested, setVerificationCodeRequested] = useState(false);
  const [verificationResendSeconds, setVerificationResendSeconds] = useState(0);
  const [botChallengeToken, setBotChallengeToken] = useState<string>();
  const [botChallengeResetSignal, setBotChallengeResetSignal] = useState(0);
  const [registrationIntentLoading, setRegistrationIntentLoading] = useState(false);
  const [registrationIntentCreated, setRegistrationIntentCreated] = useState(false);
  const verificationRequestInFlightRef = useRef(false);

  const form = useForm<AuthFormValues>({
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldUnregister: true,
    defaultValues: {
      username: '',
      displayName: '',
      email: '',
      emailVerificationCode: '',
      password: '',
      confirmPassword: '',
      privacyPolicyAccepted: false,
      aiTransferAccepted: false,
      ageOver14Confirmed: false,
    },
  });
  const {
    handleSubmit,
    getValues,
    setValue,
    trigger,
    setError: setFieldError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = form;
  const error = errors.root?.server?.message;

  const setError = useCallback(
    (message: string | undefined) => {
      if (message) {
        setFieldError('root.server', { type: 'server', message });
      } else {
        clearErrors('root.server');
      }
    },
    [clearErrors, setFieldError],
  );

  const email = useWatch({
    control: form.control,
    name: 'email',
    defaultValue: '',
  });
  const emailVerificationCode = useWatch({
    control: form.control,
    name: 'emailVerificationCode',
    defaultValue: '',
  });
  const privacyPolicyAccepted = useWatch({
    control: form.control,
    name: 'privacyPolicyAccepted',
  });
  const aiTransferAccepted = useWatch({
    control: form.control,
    name: 'aiTransferAccepted',
  });
  const ageOver14Confirmed = useWatch({
    control: form.control,
    name: 'ageOver14Confirmed',
  });
  const normalizedEmail = email.trim().toLowerCase();
  const emailAvailabilityConfirmed = Boolean(
    normalizedEmail && verifiedAvailableEmail === normalizedEmail,
  );
  const emailVerificationConfirmed = Boolean(
    normalizedEmail &&
    verifiedEmail === normalizedEmail &&
    verifiedEmailVerificationCode === emailVerificationCode.trim(),
  );
  const registrationConsentsAccepted =
    emailVerificationConfirmed && privacyPolicyAccepted && aiTransferAccepted && ageOver14Confirmed;
  const isMainRoute = location.pathname === '/';

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
          navigate('/', { replace: true });
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
            navigate('/', { replace: true });
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

  useEffect(() => {
    if (verificationResendSeconds <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setVerificationResendSeconds((remainingSeconds) => Math.max(remainingSeconds - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [verificationResendSeconds]);

  function resetEmailVerificationState() {
    setVerificationMessage(undefined);
    setEmailAvailabilityMessage(undefined);
    setVerifiedAvailableEmail(undefined);
    setVerifiedEmail(undefined);
    setVerifiedEmailVerificationCode(undefined);
    setVerificationCodeRequested(false);
    setVerificationResendSeconds(0);
    setBotChallengeToken(undefined);
    setBotChallengeResetSignal((signal) => signal + 1);
    setRegistrationIntentCreated(false);
  }

  function resetOtpConfirmationState() {
    setVerifiedEmail(undefined);
    setVerifiedEmailVerificationCode(undefined);
    setRegistrationIntentCreated(false);
  }

  const submitLogin: SubmitHandler<AuthFormValues> = async (values) => {
    setError(undefined);

    try {
      if (authMode === 'register' && !emailVerificationConfirmed) {
        setFieldError('emailVerificationCode', {
          type: 'manual',
          message: t('emailVerificationConfirmRequired'),
        });
        return;
      }
      if (authMode === 'register' && !registrationIntentCreated) {
        setError(t('consentSaveFailed'));
        return;
      }
      const result =
        authMode === 'login'
          ? await authApi.login(values.username.trim(), values.password.trim())
          : await authApi.register({
              username: values.username.trim(),
              password: values.password.trim(),
              confirmPassword: values.confirmPassword.trim(),
              displayName: values.displayName.trim(),
              email: values.email.trim(),
              emailVerificationCode: values.emailVerificationCode.trim(),
            });
      authSessionService.writeAuthSession(result);
      if (authMode === 'register') {
        window.location.replace('/');
        return;
      }
      setAuthSession(result);
    } catch (loginError) {
      if (authMode === 'register' && loginError instanceof ApiRequestError) {
        if (
          loginError.code === 'AUTH_EMAIL_ALREADY_REGISTERED' ||
          loginError.code === 'AUTH_GOOGLE_LINK_REQUIRED'
        ) {
          setFieldError('email', { type: 'server', message: t('emailInUse') });
          return;
        }
        if (loginError.code === 'AUTH_USERNAME_ALREADY_REGISTERED') {
          setFieldError('username', { type: 'server', message: t('usernameInUse') });
          return;
        }
      }
      setError(
        apiErrorMessage(loginError, t, authMode === 'login' ? 'loginFailed' : 'registerFailed'),
      );
    }
  };

  async function continueAfterConsent() {
    if (!registrationConsentsAccepted || registrationIntentCreated || registrationIntentLoading) {
      return;
    }

    setRegistrationIntentLoading(true);
    setError(undefined);

    try {
      await authApi.createRegistrationIntent({
        privacyPolicyAccepted: getValues('privacyPolicyAccepted'),
        aiTransferAccepted: getValues('aiTransferAccepted'),
        ageOver14Confirmed: getValues('ageOver14Confirmed'),
        privacyPolicyVersion: privacyVersion,
        aiTransferVersion: privacyVersion,
      });
      setRegistrationIntentCreated(true);
    } catch (intentError) {
      setError(apiErrorMessage(intentError, t, 'consentSaveFailed'));
    } finally {
      setRegistrationIntentLoading(false);
    }
  }

  async function requestEmailVerification() {
    if (verificationRequestInFlightRef.current) return;
    verificationRequestInFlightRef.current = true;
    const valid = await trigger('email');
    if (!valid) {
      verificationRequestInFlightRef.current = false;
      return;
    }
    if (verificationCodeRequested && verificationResendSeconds > 0) {
      verificationRequestInFlightRef.current = false;
      return;
    }
    setVerificationLoading(true);
    setError(undefined);
    setVerificationMessage(undefined);

    try {
      if (!emailAvailabilityConfirmed) {
        setFieldError('email', { type: 'manual', message: t('emailCheckRequired') });
        return;
      }
      setVerifiedEmail(undefined);
      setVerifiedEmailVerificationCode(undefined);
      const result = await authApi.requestEmailVerification(
        getValues('email').trim(),
        botChallengeToken ?? '',
      );
      if (result.devVerificationCode) {
        setValue('emailVerificationCode', result.devVerificationCode, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      setVerificationCodeRequested(true);
      setVerificationResendSeconds(result.resendAfterSeconds);
      setVerificationMessage(t('emailVerificationSent'));
    } catch (verificationError) {
      if (
        verificationError instanceof ApiRequestError &&
        verificationError.code === 'AUTH_EMAIL_VERIFICATION_RATE_LIMITED'
      ) {
        setVerificationCodeRequested(true);
        setVerificationResendSeconds(verificationError.retryAfterSeconds ?? 60);
      }
      setFieldError('email', {
        type: 'server',
        message: apiErrorMessage(verificationError, t, 'emailVerificationFailed'),
      });
    } finally {
      verificationRequestInFlightRef.current = false;
      setBotChallengeToken(undefined);
      setBotChallengeResetSignal((signal) => signal + 1);
      setVerificationLoading(false);
    }
  }

  async function confirmEmailVerification() {
    const valid = await trigger(['email', 'emailVerificationCode']);
    if (!valid) {
      return;
    }
    setVerificationLoading(true);
    setError(undefined);
    setVerificationMessage(undefined);
    setVerifiedEmail(undefined);
    setVerifiedEmailVerificationCode(undefined);

    try {
      if (!emailAvailabilityConfirmed) {
        setFieldError('email', { type: 'manual', message: t('emailCheckRequired') });
        return;
      }
      const trimmedCode = getValues('emailVerificationCode').trim();
      const result = await authApi.confirmEmailVerification(getValues('email').trim(), trimmedCode);
      if (!result.verified) {
        throw new Error(t('emailVerificationConfirmFailed'));
      }
      setVerifiedEmail(result.email);
      setVerifiedEmailVerificationCode(trimmedCode);
      setVerificationMessage(t('emailVerified'));
      clearErrors('emailVerificationCode');
    } catch (verificationError) {
      setFieldError('emailVerificationCode', {
        type: 'server',
        message: apiErrorMessage(verificationError, t, 'emailVerificationConfirmFailed'),
      });
    } finally {
      setVerificationLoading(false);
    }
  }

  async function checkEmailAvailability() {
    const valid = await trigger('email');
    if (!valid) {
      return;
    }
    setEmailCheckLoading(true);
    setError(undefined);
    setEmailAvailabilityMessage(undefined);
    setVerificationMessage(undefined);
    setValue('emailVerificationCode', '', { shouldDirty: true, shouldValidate: true });
    setVerifiedAvailableEmail(undefined);
    setVerifiedEmail(undefined);
    setVerifiedEmailVerificationCode(undefined);
    setVerificationCodeRequested(false);
    setVerificationResendSeconds(0);
    setBotChallengeToken(undefined);
    setBotChallengeResetSignal((signal) => signal + 1);

    try {
      const result = await authApi.checkEmailAvailability(getValues('email').trim());
      if (!result.available) {
        setFieldError('email', { type: 'server', message: t('emailInUse') });
        return;
      }
      setVerifiedAvailableEmail(result.email);
      setEmailAvailabilityMessage(t('emailAvailable'));
      clearErrors('email');
    } catch (emailCheckError) {
      setFieldError('email', {
        type: 'server',
        message: apiErrorMessage(emailCheckError, t, 'emailCheckFailed'),
      });
    } finally {
      setEmailCheckLoading(false);
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      removeProtectedQueries(queryClient);
      authSessionService.clearAuthSession({
        clearRefreshHint: true,
        markExplicitLogout: true,
      });
      window.localStorage.removeItem('margins.selectedSessionId');
      setAuthSession(undefined);
      navigate('/', { replace: true });
    }
  }

  if (authSession) {
    return (
      <AuthenticatedQueryProvider key={authSession.userId} session={authSession}>
        {authenticated({ logout, session: authSession })}
      </AuthenticatedQueryProvider>
    );
  }

  if (!authBootstrapped) {
    return (
      <main
        className="margins-page-gutter grid min-h-screen place-items-center text-sm text-stone-600"
        {...testAttr('auth-bootstrap')}
      >
        {t('editorLoading')}
      </main>
    );
  }

  if (location.pathname !== '/') {
    return <Navigate replace to="/" />;
  }

  return (
    <AuthShell promotion={isMainRoute}>
      {isMainRoute && (
        <section className="blueprint-login-intro grid gap-6">
          <div>
            <h1 className="text-balance font-display text-[clamp(1.75rem,8vw,3rem)] font-semibold leading-tight tracking-normal">
              {t('mainPromotionTitle')}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
              {t('mainPromotionSubtitle')}
            </p>
          </div>
          <ol className="grid gap-3 text-sm text-stone-700">
            <MainFeature
              detail={t('mainPromotionFeatureDiscoverDetail')}
              marker="01"
              title={t('mainPromotionFeatureDiscover')}
            />
            <MainFeature
              detail={t('mainPromotionFeaturePromptsDetail')}
              marker="02"
              title={t('mainPromotionFeaturePrompts')}
            />
            <MainFeature
              detail={t('mainPromotionFeatureRecordsDetail')}
              marker="03"
              title={t('mainPromotionFeatureRecords')}
            />
            <MainFeature
              detail={t('mainPromotionFeatureDebateDetail')}
              marker="04"
              title={t('mainPromotionFeatureDebate')}
            />
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setAuthMode('login')}
              type="button"
              {...testAttr('main-promotion-login')}
            >
              {t('mainPromotionCtaLogin')}
            </Button>
            <Button
              className="rounded border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800"
              onClick={() => setAuthMode('register')}
              type="button"
              {...testAttr('main-promotion-signup')}
            >
              {t('mainPromotionCtaSignup')}
            </Button>
          </div>
        </section>
      )}
      <Form {...form}>
        <form
          className="blueprint-auth-card grid gap-5 rounded border border-stone-300 bg-stone-50/95 p-4 shadow-[0_24px_80px_rgba(23,23,23,0.10)] sm:p-6"
          onSubmit={handleSubmit(submitLogin)}
          {...testAttr('login-form')}
        >
          <div>
            <div className="flex items-start justify-between gap-3">
              {isMainRoute ? (
                <p className="font-display text-4xl font-semibold tracking-normal sm:text-5xl">
                  Margins
                </p>
              ) : (
                <h1 className="font-display text-4xl font-semibold tracking-normal sm:text-5xl">
                  Margins
                </h1>
              )}
              <LanguageToggle locale={locale} setLocale={setLocale} label={t('language')} />
            </div>
            <p className="mt-3 text-sm leading-6 text-stone-600">{t('loginSubtitle')}</p>
          </div>
          <Tabs
            className="blueprint-auth-tabs"
            onValueChange={(mode) => {
              setAuthMode(mode as 'login' | 'register');
              setRegistrationIntentCreated(false);
              setError(undefined);
              clearErrors();
              setVerificationMessage(undefined);
              setEmailAvailabilityMessage(undefined);
            }}
            value={authMode}
            {...testAttr('auth-mode-tabs')}
          >
            <TabsList className="grid h-auto min-h-11 w-full grid-cols-2 rounded border border-border bg-background p-1">
              {(['login', 'register'] as const).map((mode) => (
                <TabsTrigger
                  className="min-h-9 rounded px-3 py-2 text-sm font-semibold data-[state=active]:bg-[var(--margins-control)] data-[state=active]:text-[var(--margins-paper)]"
                  disabled={registrationIntentLoading}
                  key={mode}
                  onClick={() => {
                    setAuthMode(mode);
                    setRegistrationIntentCreated(false);
                    setError(undefined);
                    clearErrors();
                    setVerificationMessage(undefined);
                    setEmailAvailabilityMessage(undefined);
                  }}
                  value={mode}
                  {...testAttr(`auth-mode-${mode}`)}
                >
                  {mode === 'login' ? t('login') : t('createAccount')}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {error && (
            <Alert
              className="border-red-300 bg-red-50 text-red-800"
              variant="destructive"
              {...testAttr('login-error')}
            >
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {authMode === 'login' && <LoginForm />}
          {authMode === 'register' && (
            <RegistrationForm
              botChallengeResetSignal={botChallengeResetSignal}
              botChallengeToken={botChallengeToken}
              emailAvailabilityConfirmed={emailAvailabilityConfirmed}
              emailAvailabilityMessage={emailAvailabilityMessage}
              emailCheckLoading={emailCheckLoading}
              emailVerificationConfirmed={emailVerificationConfirmed}
              onBotChallengeTokenChange={setBotChallengeToken}
              onCheckEmailAvailability={() => void checkEmailAvailability()}
              onConfirmEmailVerification={() => void confirmEmailVerification()}
              onContinueAfterConsent={() => void continueAfterConsent()}
              resetEmailVerification={() => {
                setValue('emailVerificationCode', '', {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                resetEmailVerificationState();
              }}
              resetOtpConfirmation={() => {
                resetOtpConfirmationState();
                if (verificationMessage === t('emailVerified')) {
                  setVerificationMessage(undefined);
                }
              }}
              onRequestEmailVerification={() => void requestEmailVerification()}
              registrationConsentsAccepted={registrationConsentsAccepted}
              registrationIntentCreated={registrationIntentCreated}
              registrationIntentLoading={registrationIntentLoading}
              verificationCodeRequested={verificationCodeRequested}
              verificationLoading={verificationLoading}
              verificationMessage={verificationMessage}
              verificationResendSeconds={verificationResendSeconds}
            />
          )}
          <Button
            className="rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:border-stone-700 hover:bg-stone-50 hover:text-stone-950 disabled:opacity-50"
            disabled={isSubmitting}
            onClick={() => {
              window.location.href = authApi.googleOAuthStartUrl();
            }}
            type="button"
            variant="outline"
            {...testAttr('google-login-submit')}
          >
            <GoogleIcon />
            {t('continueWithGoogle')}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}

function MainFeature({ detail, marker, title }: { detail: string; marker: string; title: string }) {
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3">
      <span className="grid h-9 w-9 place-items-center rounded border border-stone-300 bg-white text-xs font-semibold text-stone-500">
        {marker}
      </span>
      <span>
        <strong className="block font-semibold text-stone-900">{title}</strong>
        <span className="mt-1 block leading-6">{detail}</span>
      </span>
    </li>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M21.35 12.2c0-.7-.06-1.22-.2-1.76H12v3.31h5.37a4.7 4.7 0 0 1-1.99 3.05l-.02.11 2.89 2.19.2.02c1.83-1.66 2.9-4.1 2.9-6.92Z"
        fill="#4285F4"
      />
      <path
        d="M12 21.5c2.62 0 4.82-.85 6.43-2.38l-3.07-2.32c-.82.56-1.92.95-3.36.95a5.84 5.84 0 0 1-5.53-3.95l-.1.01-3.01 2.28-.04.1A9.72 9.72 0 0 0 12 21.5Z"
        fill="#34A853"
      />
      <path
        d="M6.47 13.8A5.8 5.8 0 0 1 6.15 12c0-.63.11-1.24.31-1.81v-.12L3.42 7.75l-.1.05A9.39 9.39 0 0 0 2.3 12c0 1.5.37 2.93 1.02 4.2l3.15-2.4Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.25c1.82 0 3.05.77 3.76 1.42l2.74-2.62C16.82 3.5 14.62 2.5 12 2.5A9.72 9.72 0 0 0 3.32 7.8l3.14 2.39A5.86 5.86 0 0 1 12 6.25Z"
        fill="#EA4335"
      />
    </svg>
  );
}
