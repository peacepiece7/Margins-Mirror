import { Controller, useForm, useWatch } from 'react-hook-form';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiRequestError } from '@/shared/api/error';
import { useI18n } from '@/shared/i18n/i18n-provider';
import { supportsBundledConsentPolicy } from '@/shared/consent-policy';
import { AppText, Button, LoadingState, Notice, Screen, Surface, TextField } from '@/shared/ui';
import { spacing } from '@/shared/theme/tokens';

import { authApi } from './api';
import { authCopy } from './copy';
import { ConsentToggle } from './consent-toggle';
import { authErrorMessage } from './error-message';
import { useAuthSession } from './session-provider';
import type { PrivacyRequirements } from './types';

type FormValues = {
  ageOver14Confirmed: boolean;
  aiTransferAccepted: boolean;
  code: string;
  confirmPassword: string;
  displayName: string;
  email: string;
  password: string;
  privacyPolicyAccepted: boolean;
  username: string;
};

type Stage = 'identity' | 'verification' | 'consent' | 'ready';

export function RegistrationScreen({
  onBack,
  onOpenPrivacy,
  onOpenTerms,
}: {
  onBack(): void;
  onOpenPrivacy(): void;
  onOpenTerms(): void;
}) {
  const { locale, t } = useI18n();
  const { googleRegistrationPending, register, registerWithGoogle } = useAuthSession();
  const c = (key: Parameters<typeof authCopy>[1], values?: Record<string, string | number>) =>
    authCopy(locale, key, values);
  const [requirements, setRequirements] = useState<PrivacyRequirements>();
  const [requirementsAttempt, setRequirementsAttempt] = useState(0);
  const [requirementsFailed, setRequirementsFailed] = useState(false);
  const [stage, setStage] = useState<Stage>(googleRegistrationPending ? 'consent' : 'identity');
  const [intentToken, setIntentToken] = useState<string>();
  const [devCode, setDevCode] = useState<string>();
  const [codeRequested, setCodeRequested] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [confirmingCode, setConfirmingCode] = useState(false);
  const [failedCodeAttempts, setFailedCodeAttempts] = useState(0);
  const [resendAfterSeconds, setResendAfterSeconds] = useState(0);
  const confirmationInFlight = useRef(false);
  const [status, setStatus] = useState<string>();
  const {
    control,
    clearErrors,
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    setError,
    setValue,
  } = useForm<FormValues>({
    defaultValues: {
      ageOver14Confirmed: false,
      aiTransferAccepted: false,
      code: '',
      confirmPassword: '',
      displayName: '',
      email: '',
      password: '',
      privacyPolicyAccepted: false,
      username: '',
    },
  });

  useEffect(() => {
    void authApi.getPrivacyRequirements()
      .then((result) => {
        setRequirements(result);
        setRequirementsFailed(false);
        clearErrors('root');
      })
      .catch((error) => {
        setRequirementsFailed(true);
        setError('root', { message: authErrorMessage(error, locale, t) });
      });
  }, [clearErrors, locale, requirementsAttempt, setError, t]);

  useEffect(() => {
    if (resendAfterSeconds <= 0) return;
    const timer = setTimeout(() => {
      setResendAfterSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendAfterSeconds]);

  const [availableEmail, setAvailableEmail] = useState<string>();
  const handleEmailChange = (value: string) => {
    if (
      stage === 'verification' &&
      availableEmail &&
      value.trim().toLowerCase() !== availableEmail
    ) {
      setAvailableEmail(undefined);
      setDevCode(undefined);
      setCodeRequested(false);
      setFailedCodeAttempts(0);
      setResendAfterSeconds(0);
      setStatus(undefined);
      setValue('code', '');
      clearErrors();
      setStage('identity');
    }
  };

  const consentValues = useWatch({
    control,
    name: ['ageOver14Confirmed', 'aiTransferAccepted', 'privacyPolicyAccepted'],
  });
  const consentAccepted = consentValues.every(Boolean);
  const verificationComplete = stage === 'consent' || stage === 'ready';

  const checkAvailability = async () => {
    const email = getValues('email').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('email', { message: c('email') });
      return;
    }
    try {
      const result = await authApi.checkEmailAvailability(email);
      if (!result.available) {
        setError('email', { message: c('emailUnavailable') });
        return;
      }
      clearErrors();
      setAvailableEmail(email.toLowerCase());
      setStatus(c('available'));
      setStage('verification');
    } catch (error) {
      setError('root', { message: authErrorMessage(error, locale, t) });
    }
  };

  const requestCode = async () => {
    if (requestingCode || resendAfterSeconds > 0) return;
    setRequestingCode(true);
    clearErrors('code');
    clearErrors('root');
    try {
      const result = await authApi.requestEmailVerification(
        availableEmail ?? getValues('email').trim(),
      );
      setDevCode(__DEV__ ? result.devVerificationCode : undefined);
      setCodeRequested(true);
      setValue('code', '');
      setFailedCodeAttempts(0);
      setResendAfterSeconds(result.resendAfterSeconds);
      setStatus(c('codeSent'));
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        (error.code === 'AUTH_EMAIL_VERIFICATION_RATE_LIMITED' ||
          error.code === 'COMMON_RATE_LIMITED')
      ) {
        setResendAfterSeconds(error.retryAfterSeconds ?? 60);
        setError('email', {
          message: c('emailRateLimited', {
            seconds: error.retryAfterSeconds ?? 60,
          }),
        });
      } else {
        setError('root', { message: authErrorMessage(error, locale, t) });
      }
    } finally {
      setRequestingCode(false);
    }
  };

  const confirmCode = async () => {
    if (confirmationInFlight.current || failedCodeAttempts >= 5) return;
    const code = getValues('code');
    if (!/^\d{6}$/.test(code)) {
      setError('code', { message: c('invalidCode') });
      return;
    }
    confirmationInFlight.current = true;
    setConfirmingCode(true);
    clearErrors('code');
    clearErrors('root');
    try {
      await authApi.confirmEmailVerification(
        availableEmail ?? getValues('email').trim(),
        code,
      );
      setStatus(c('verificationConfirmed'));
      setFailedCodeAttempts(0);
      setStage('consent');
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === 'AUTH_EMAIL_VERIFICATION_INVALID'
      ) {
        const nextAttempts = failedCodeAttempts + 1;
        setFailedCodeAttempts(nextAttempts);
        setError('code', {
          message: c(nextAttempts >= 5 ? 'codeLocked' : 'invalidOrExpiredCode'),
        });
      } else {
        setError('root', { message: authErrorMessage(error, locale, t) });
      }
    } finally {
      confirmationInFlight.current = false;
      setConfirmingCode(false);
    }
  };

  const continueConsent = handleSubmit(async (values) => {
    if (!requirements) return;
    const consent = {
      ageOver14Confirmed: values.ageOver14Confirmed,
      aiTransferAccepted: values.aiTransferAccepted,
      aiTransferVersion: requirements.aiTransferVersion,
      preferredLocale: locale,
      privacyPolicyAccepted: values.privacyPolicyAccepted,
      privacyPolicyVersion: requirements.privacyPolicyVersion,
    };
    try {
      if (googleRegistrationPending) {
        await registerWithGoogle(consent);
        return;
      }
      const intent = await authApi.createRegistrationIntent(consent);
      setIntentToken(intent.registrationIntentToken);
      setStage('ready');
    } catch (error) {
      setError('root', { message: authErrorMessage(error, locale, t) });
    }
  });

  const createAccount = handleSubmit(async (values) => {
    if (!intentToken) return;
    if (values.password !== values.confirmPassword) {
      setError('confirmPassword', { message: c('passwordMismatch') });
      return;
    }
    try {
      await register({
        confirmPassword: values.confirmPassword,
        displayName: values.displayName,
        email: values.email,
        emailVerificationCode: values.code,
        password: values.password,
        preferredLocale: locale,
        registrationIntentToken: intentToken,
        username: values.username,
      });
    } catch (error) {
      setError('root', { message: authErrorMessage(error, locale, t) });
    }
  });

  if (!requirements) {
    if (!requirementsFailed) return <LoadingState label={c('loadingRequirements')} />;
    return (
      <Screen>
        <Notice title={errors.root?.message ?? t('genericError')} tone="error" />
        <Button onPress={() => {
          setRequirementsFailed(false);
          setRequirementsAttempt((attempt) => attempt + 1);
        }}>{t('retry')}</Button>
        <Button onPress={onBack} variant="ghost">{c('backToLogin')}</Button>
      </Screen>
    );
  }

  if (!supportsBundledConsentPolicy(requirements)) {
    return (
      <Screen testID="registration-policy-update-required">
        <Notice title={c('policyUpdateRequired')} tone="error" />
        <Button onPress={onBack} variant="ghost">{c('backToLogin')}</Button>
      </Screen>
    );
  }

  return (
    <Screen testID="registration-screen">
      <AppText variant="display">{c('registerTitle')}</AppText>
      {googleRegistrationPending ? <Notice title={c('googleConsent')} /> : null}
      {errors.root?.message ? <Notice title={errors.root.message} tone="error" /> : null}
      {status ? <Notice title={status} tone="success">{__DEV__ && devCode ? `DEV: ${devCode}` : undefined}</Notice> : null}

      {!googleRegistrationPending ? (
        <Surface>
          <Field control={control} error={errors.username?.message} label={c('username')} name="username" required={c('required')} />
          <Field control={control} error={errors.displayName?.message} label={c('displayName')} name="displayName" required={c('required')} />
          <Field control={control} editable={stage !== 'consent' && stage !== 'ready'} error={errors.email?.message} keyboardType="email-address" label={c('email')} name="email" onValueChange={handleEmailChange} required={c('required')} />
          <Field control={control} error={errors.password?.message} label={c('password')} name="password" required={c('required')} secureTextEntry />
          <Field control={control} error={errors.confirmPassword?.message} label={c('passwordConfirm')} name="confirmPassword" required={c('required')} secureTextEntry />
          {stage === 'identity' ? <Button onPress={() => void checkAvailability()}>{c('availability')}</Button> : null}
          {stage !== 'identity' ? (
            <>
              {stage === 'verification' && !__DEV__ ? <Notice title={c('productionChallenge')} /> : null}
              <Button
                disabled={verificationComplete || requestingCode || resendAfterSeconds > 0}
                loading={requestingCode}
                onPress={() => void requestCode()}
                testID="registration-email-send"
              >
                {resendAfterSeconds > 0
                  ? c('resendIn', { seconds: resendAfterSeconds })
                  : c(codeRequested ? 'resendCode' : 'requestCode')}
              </Button>
              <Field control={control} editable={!verificationComplete} error={errors.code?.message} keyboardType="number-pad" label={c('code')} name="code" required={c('required')} />
              <Button
                disabled={verificationComplete || confirmingCode || failedCodeAttempts >= 5}
                loading={confirmingCode}
                onPress={() => void confirmCode()}
                testID="registration-email-confirm"
              >{c('confirmCode')}</Button>
            </>
          ) : null}
        </Surface>
      ) : null}

      {(stage === 'consent' || stage === 'ready') ? (
        <Surface>
          <AppText variant="title">{c('consentsTitle')}</AppText>
          <Consent control={control} disabled={stage === 'ready'} label={c('acceptPrivacy')} name="privacyPolicyAccepted" />
          <Consent control={control} disabled={stage === 'ready'} label={c('acceptAi')} name="aiTransferAccepted" />
          <Consent control={control} disabled={stage === 'ready'} label={c('acceptAge', { age: requirements.minimumAge })} name="ageOver14Confirmed" />
          <View style={styles.documentLinks}>
            <Button onPress={onOpenPrivacy} variant="ghost">{t('privacy')}</Button>
            <Button onPress={onOpenTerms} variant="ghost">{t('terms')}</Button>
          </View>
          {stage === 'consent' ? <Button disabled={!consentAccepted} loading={isSubmitting} onPress={() => void continueConsent()} variant="primary">{c('consentContinue')}</Button> : null}
          {stage === 'ready' ? <Button loading={isSubmitting} onPress={() => void createAccount()} variant="primary">{c('createAccount')}</Button> : null}
        </Surface>
      ) : null}
      <View style={styles.footer}><Button onPress={onBack} variant="ghost">{c('backToLogin')}</Button></View>
    </Screen>
  );
}

function Field({ control, error, label, name, required, ...props }: {
  control: ReturnType<typeof useForm<FormValues>>['control']; error?: string; label: string;
  name: 'code' | 'confirmPassword' | 'displayName' | 'email' | 'password' | 'username';
  required: string;
  editable?: boolean; keyboardType?: 'email-address' | 'number-pad'; onValueChange?(value: string): void; secureTextEntry?: boolean;
}) {
  const { onValueChange, ...fieldProps } = props;
  return <Controller control={control} name={name} rules={{ required }} render={({ field: { onBlur, onChange, value } }) => (
    <TextField autoCapitalize="none" error={error} label={label} onBlur={onBlur} onChangeText={(next) => {
      onChange(next);
      onValueChange?.(next);
    }} value={value} {...fieldProps} />
  )} />;
}

function Consent({ control, disabled, label, name }: {
  control: ReturnType<typeof useForm<FormValues>>['control']; disabled: boolean; label: string;
  name: 'ageOver14Confirmed' | 'aiTransferAccepted' | 'privacyPolicyAccepted';
}) {
  return <Controller control={control} name={name} rules={{ validate: (value) => value }} render={({ field: { onChange, value } }) => (
    <ConsentToggle checked={value} disabled={disabled} label={label} onChange={onChange} />
  )} />;
}

const styles = StyleSheet.create({
  documentLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
  footer: { alignItems: 'center', gap: spacing.x2 },
});
