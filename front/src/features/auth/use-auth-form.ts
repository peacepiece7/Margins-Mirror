import { useCallback } from 'react';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiRequestError } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { useI18n } from '@/lib/i18n';
import { authApi } from './api';
import * as authSessionService from './session';
import type { AuthFormValues } from './components/auth-form';
import { useAuthSession } from './use-auth-session';
import { useRegistration } from './use-registration';

export function useAuthForm() {
  const { locale, setLocale, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const authMode =
    new URLSearchParams(location.search).get('mode') === 'register' ? 'register' : 'login';
  const form = useForm<AuthFormValues>({
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldUnregister: true,
    defaultValues: {
      username: '',
      displayName: '',
      email: '',
      emailVerificationCode: '',
      preferredLocale: locale,
      password: '',
      confirmPassword: '',
      privacyPolicyAccepted: false,
      aiTransferAccepted: false,
      ageOver14Confirmed: false,
    },
  });

  const { setError: setFieldError, clearErrors } = form;
  const error = form.formState.errors.root?.server?.message;
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

  const session = useAuthSession(setError);
  const { setAuthSession } = session;
  const registration = useRegistration(
    form,
    location.pathname === '/login' ? authMode : 'inactive',
  );
  const { emailVerificationConfirmed, registrationIntentCreated } = registration;
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
              preferredLocale: values.preferredLocale,
            });
      authSessionService.writeAuthSession(result);
      if (result.preferredLocale) setLocale(result.preferredLocale);
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

  function changeMode(mode: string) {
    if (mode === authMode) return;
    if (mode !== 'login' && mode !== 'register') return;
    registration.resetEmailVerification();
    clearErrors();
    navigate(mode === 'register' ? '/login?mode=register' : '/login');
  }
  return {
    ...session,
    location,
    formView: { form, authMode, changeMode, registration, submitLogin, error },
  };
}
