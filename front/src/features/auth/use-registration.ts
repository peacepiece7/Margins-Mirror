import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';

import { ApiRequestError } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { useI18n } from '@/lib/i18n';

import { authApi } from './api';
import type { AuthFormValues } from './components/auth-form';

type VerificationAction = 'check' | 'send' | 'confirm';
type VerificationState = {
  availableEmail?: string;
  verified?: { email: string; code: string };
  availabilityMessage?: string;
  verificationMessage?: string;
  codeRequested: boolean;
  resendSeconds: number;
  challengeToken?: string;
  challengeResetSignal: number;
  intentCreated: boolean;
  pending?: VerificationAction | 'consent';
};
const initialVerification: VerificationState = {
  codeRequested: false,
  resendSeconds: 0,
  challengeResetSignal: 0,
  intentCreated: false,
};
const privacyVersion = '2026-07-27';
const verificationFailureKey = {
  check: 'emailCheckFailed',
  send: 'emailVerificationFailed',
  confirm: 'emailVerificationConfirmFailed',
} as const;

export function useRegistration(form: UseFormReturn<AuthFormValues>, mode: string) {
  const { t } = useI18n();
  const { getValues, setValue, setError, clearErrors, trigger } = form;
  const [state, setState] = useState(initialVerification);
  const onBotChallengeTokenChange = useCallback((token: string | undefined) => {
    setState((current) => ({ ...current, challengeToken: token }));
  }, []);
  // A reset invalidates the old request without letting its finally clear a newer request.
  const activeRequest = useRef<number | undefined>(undefined);
  const nextRequest = useRef(0);
  const previousMode = useRef(mode);
  const [email, code, privacy, aiTransfer, age] = useWatch({
    control: form.control,
    name: [
      'email',
      'emailVerificationCode',
      'privacyPolicyAccepted',
      'aiTransferAccepted',
      'ageOver14Confirmed',
    ],
  });
  const normalizedEmail = (email ?? '').trim().toLowerCase();
  const emailAvailabilityConfirmed = Boolean(
    normalizedEmail && state.availableEmail === normalizedEmail,
  );
  const emailVerificationConfirmed = Boolean(
    normalizedEmail &&
    state.verified?.email === normalizedEmail &&
    state.verified.code === (code ?? '').trim(),
  );
  const registrationConsentsAccepted = Boolean(
    emailVerificationConfirmed && privacy && aiTransfer && age,
  );

  useLayoutEffect(() => {
    if (previousMode.current !== mode) {
      previousMode.current = mode;
      setState(initialVerification);
    }
    return () => {
      activeRequest.current = undefined;
    };
  }, [mode]);
  const hasCooldown = state.resendSeconds > 0;
  useEffect(() => {
    if (!hasCooldown) return;
    const timer = window.setInterval(
      () =>
        setState((current) => ({
          ...current,
          resendSeconds: Math.max(current.resendSeconds - 1, 0),
        })),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [hasCooldown]);

  function updateVerification(changes: Partial<VerificationState>) {
    setState((current) => ({ ...current, ...changes }));
  }

  function resetEmailVerification() {
    activeRequest.current = undefined;
    setState((current) => ({
      ...initialVerification,
      challengeResetSignal: current.challengeResetSignal + 1,
    }));
    setValue('emailVerificationCode', '', { shouldDirty: true, shouldValidate: true });
    clearErrors(['email', 'emailVerificationCode']);
  }

  function resetOtpConfirmation() {
    activeRequest.current = undefined;
    setState((current) => ({
      ...current,
      verified: undefined,
      intentCreated: false,
      pending: undefined,
      verificationMessage: current.verified ? undefined : current.verificationMessage,
    }));
    clearErrors('emailVerificationCode');
  }

  async function verify(action: VerificationAction) {
    if (activeRequest.current !== undefined || mode !== 'register') return;
    if (action === 'send' && (emailVerificationConfirmed || hasCooldown)) return;
    const request = ++nextRequest.current;
    activeRequest.current = request;
    const submittedEmail = getValues('email').trim();
    const submittedCode = (getValues('emailVerificationCode') ?? '').trim();
    const isCurrent = () =>
      activeRequest.current === request &&
      previousMode.current === mode &&
      getValues('email')?.trim() === submittedEmail &&
      (action !== 'confirm' || getValues('emailVerificationCode')?.trim() === submittedCode);
    const field = action === 'confirm' ? 'emailVerificationCode' : 'email';
    updateVerification({ pending: action });
    try {
      const valid = await trigger(
        action === 'confirm' ? ['email', 'emailVerificationCode'] : 'email',
      );
      if (!isCurrent() || !valid) return;
      clearErrors('root.server');
      if (action !== 'check' && !emailAvailabilityConfirmed) {
        setError('email', { type: 'manual', message: t('emailCheckRequired') });
        return;
      }
      if (action === 'check') {
        setValue('emailVerificationCode', '', { shouldDirty: true, shouldValidate: true });
        setState((current) => ({
          ...initialVerification,
          pending: action,
          challengeResetSignal: current.challengeResetSignal + 1,
        }));
        const result = await authApi.checkEmailAvailability(submittedEmail);
        if (!isCurrent()) return;
        if (!result.available) {
          setError('email', { type: 'server', message: t('emailInUse') });
          return;
        }
        updateVerification({
          availableEmail: result.email.trim().toLowerCase(),
          availabilityMessage: t('emailAvailable'),
        });
        clearErrors('email');
      } else if (action === 'send') {
        setState((current) => ({
          ...current,
          verified: undefined,
          verificationMessage: undefined,
          intentCreated: false,
          challengeToken: undefined,
          challengeResetSignal: current.challengeResetSignal + 1,
        }));
        const result = await authApi.requestEmailVerification(
          submittedEmail,
          state.challengeToken ?? '',
        );
        if (!isCurrent()) return;
        if (result.devVerificationCode)
          setValue('emailVerificationCode', result.devVerificationCode, {
            shouldDirty: true,
            shouldValidate: true,
          });
        updateVerification({
          codeRequested: true,
          resendSeconds: result.resendAfterSeconds,
          verificationMessage: t('emailVerificationSent'),
        });
      } else {
        updateVerification({
          verified: undefined,
          verificationMessage: undefined,
          intentCreated: false,
        });
        const result = await authApi.confirmEmailVerification(submittedEmail, submittedCode);
        if (!isCurrent()) return;
        if (!result.verified || result.email.trim().toLowerCase() !== submittedEmail.toLowerCase())
          throw new Error('Verification failed');
        updateVerification({
          verified: { email: result.email.trim().toLowerCase(), code: submittedCode },
          verificationMessage: t('emailVerified'),
        });
        clearErrors('emailVerificationCode');
      }
    } catch (error) {
      if (!isCurrent()) return;
      if (
        action === 'send' &&
        error instanceof ApiRequestError &&
        error.code === 'AUTH_EMAIL_VERIFICATION_RATE_LIMITED'
      ) {
        updateVerification({
          codeRequested: true,
          resendSeconds: error.retryAfterSeconds ?? 60,
        });
      }
      setError(field, {
        type: 'server',
        message: apiErrorMessage(error, t, verificationFailureKey[action]),
      });
    } finally {
      if (activeRequest.current === request) {
        activeRequest.current = undefined;
        updateVerification({ pending: undefined });
      }
    }
  }

  async function continueAfterConsent() {
    if (!registrationConsentsAccepted || state.intentCreated || activeRequest.current !== undefined)
      return;
    const request = ++nextRequest.current;
    activeRequest.current = request;
    updateVerification({ pending: 'consent' });
    clearErrors('root.server');
    try {
      await authApi.createRegistrationIntent({
        privacyPolicyAccepted: getValues('privacyPolicyAccepted'),
        aiTransferAccepted: getValues('aiTransferAccepted'),
        ageOver14Confirmed: getValues('ageOver14Confirmed'),
        privacyPolicyVersion: privacyVersion,
        aiTransferVersion: privacyVersion,
      });
      if (activeRequest.current === request && previousMode.current === mode)
        updateVerification({ intentCreated: true });
    } catch (error) {
      if (activeRequest.current === request && previousMode.current === mode)
        setError('root.server', {
          type: 'server',
          message: apiErrorMessage(error, t, 'consentSaveFailed'),
        });
    } finally {
      if (activeRequest.current === request) {
        activeRequest.current = undefined;
        updateVerification({ pending: undefined });
      }
    }
  }

  return {
    emailAvailabilityConfirmed,
    emailVerificationConfirmed,
    registrationConsentsAccepted,
    emailAvailabilityMessage: state.availabilityMessage,
    verificationMessage: state.verificationMessage,
    emailCheckLoading: state.pending === 'check',
    verificationLoading: state.pending === 'send' || state.pending === 'confirm',
    verificationCodeRequested: state.codeRequested,
    verificationResendSeconds: state.resendSeconds,
    botChallengeToken: state.challengeToken,
    botChallengeResetSignal: state.challengeResetSignal,
    registrationIntentCreated: state.intentCreated,
    registrationIntentLoading: state.pending === 'consent',
    resetEmailVerification,
    resetOtpConfirmation,
    onBotChallengeTokenChange,
    onCheckEmailAvailability: () => void verify('check'),
    onRequestEmailVerification: () => void verify('send'),
    onConfirmEmailVerification: () => void verify('confirm'),
    onContinueAfterConsent: () => void continueAfterConsent(),
  };
}
