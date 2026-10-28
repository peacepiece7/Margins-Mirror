import { Controller, useForm, useWatch } from 'react-hook-form';
import { useRef, useState } from 'react';

import { ApiRequestError } from '@/shared/api/error';
import { useI18n } from '@/shared/i18n/i18n-provider';
import { AppText, Button, Notice, Screen, Surface, TextField } from '@/shared/ui';

import { authCopy } from './copy';
import { authErrorMessage } from './error-message';

type RecoveryAction = 'ERASE_ALL_ACTIVITY' | 'RESTORE';
type RecoveryValues = { action?: RecoveryAction; code: string; email: string };
type Step = 'email' | 'code' | 'action' | 'complete';
type RecoveryMutation<TData, TVariables> = {
  data?: TData;
  isPending: boolean;
  mutateAsync(variables: TVariables): Promise<TData>;
  reset(): void;
};

export type RecoveryMutations = {
  challenge: RecoveryMutation<{
    challengeId: string;
    devVerificationCode?: string;
  }, string>;
  recover: RecoveryMutation<void, {
    action: RecoveryAction;
    actionToken: string;
    email: string;
  }>;
  verify: RecoveryMutation<{ actionToken: string }, {
    challengeId: string;
    code: string;
  }>;
};

export function RecoveryScreen({
  mutations,
  onBack,
}: {
  mutations: RecoveryMutations;
  onBack(): void;
}) {
  const { locale, t } = useI18n();
  const c = (key: Parameters<typeof authCopy>[1]) => authCopy(locale, key);
  const [step, setStep] = useState<Step>('email');
  const [eraseConfirmationVisible, setEraseConfirmationVisible] = useState(false);
  const actionInFlight = useRef(false);
  const {
    control,
    clearErrors,
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    setError,
    setValue,
    trigger,
  } = useForm<RecoveryValues>({
    defaultValues: { action: undefined, code: '', email: '' },
  });
  const selectedAction = useWatch({ control, name: 'action' });
  const actionPending = isSubmitting || mutations.recover.isPending;

  const requestChallenge = async (email: string) => {
    try {
      await mutations.challenge.mutateAsync(email);
      mutations.verify.reset();
      mutations.recover.reset();
      clearErrors();
      setEraseConfirmationVisible(false);
      setValue('action', undefined, { shouldDirty: false });
      setValue('code', '', { shouldDirty: false });
      setStep('code');
    } catch (error) {
      setError('root', { message: authErrorMessage(error, locale, t) });
    }
  };
  const request = handleSubmit(({ email }) => requestChallenge(email));
  const resend = async () => {
    if (!(await trigger('email'))) return;
    await requestChallenge(getValues('email'));
  };

  const verify = handleSubmit(async ({ code }) => {
    if (mutations.challenge.isPending) return;
    const challengeId = mutations.challenge.data?.challengeId;
    if (!challengeId) return;
    try {
      await mutations.verify.mutateAsync({ challengeId, code });
      setStep('action');
    } catch (error) {
      setError('root', { message: authErrorMessage(error, locale, t) });
    }
  });

  const complete = async ({ action, email }: RecoveryValues) => {
    const actionToken = mutations.verify.data?.actionToken;
    if (!action) return;
    if (!actionToken || actionInFlight.current) return;
    actionInFlight.current = true;
    try {
      await mutations.recover.mutateAsync({ action, actionToken, email });
      setStep('complete');
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === 'ACCOUNT_CHALLENGE_INVALID'
      ) {
        mutations.verify.reset();
        mutations.recover.reset();
        setEraseConfirmationVisible(false);
        setValue('action', undefined, { shouldDirty: false });
        setValue('code', '', { shouldDirty: false });
        setStep('email');
      }
      setError('root', { message: authErrorMessage(error, locale, t) });
    } finally {
      actionInFlight.current = false;
    }
  };
  const submitAction = (action: RecoveryAction) => {
    if (actionInFlight.current || mutations.recover.isPending) return;
    setValue('action', action, { shouldDirty: true });
    void handleSubmit(complete)();
  };

  return (
    <Screen testID="recovery-screen">
      <AppText variant="display">{c('recoveryTitle')}</AppText>
      {errors.root?.message ? <Notice title={errors.root.message} tone="error" /> : null}
      {step === 'complete' ? (
        <Notice
          title={c(
            selectedAction === 'ERASE_ALL_ACTIVITY'
              ? 'recoveryEraseScheduled'
              : 'recoveryRestored',
          )}
          tone="success"
        />
      ) : (
        <Surface>
          <Controller control={control} name="email" rules={{ required: c('required') }} render={({ field: { onBlur, onChange, value } }) => (
            <TextField autoCapitalize="none" editable={step === 'email'} error={errors.email?.message} keyboardType="email-address" label={c('email')} onBlur={onBlur} onChangeText={onChange} value={value} />
          )} />
          {step === 'email' ? <Button loading={isSubmitting || mutations.challenge.isPending} onPress={() => void request()} variant="primary">{c('recover')}</Button> : null}
          {step === 'code' ? (
            <>
              <Notice title={c('recoveryNeutral')}>{__DEV__ && mutations.challenge.data?.devVerificationCode ? `DEV: ${mutations.challenge.data.devVerificationCode}` : undefined}</Notice>
              <Controller control={control} name="code" rules={{ pattern: /^\d{6}$/ }} render={({ field: { onBlur, onChange, value } }) => (
                <TextField error={errors.code ? c('invalidCode') : undefined} keyboardType="number-pad" label={c('code')} onBlur={onBlur} onChangeText={onChange} value={value} />
              )} />
              <Button
                disabled={isSubmitting || mutations.challenge.isPending}
                loading={isSubmitting || mutations.verify.isPending}
                onPress={() => void verify()}
              >
                {c('confirmCode')}
              </Button>
              <Button
                disabled={isSubmitting || mutations.challenge.isPending}
                loading={mutations.challenge.isPending}
                onPress={() => void resend()}
                variant="outline"
              >
                {c('resendCode')}
              </Button>
            </>
          ) : null}
          {step === 'action' ? (
            <>
              <AppText variant="title">{c('accountAction')}</AppText>
              <Notice title={c('eraseWarning')} />
              <Button disabled={actionPending} loading={actionPending && selectedAction === 'RESTORE'} onPress={() => submitAction('RESTORE')} testID="account-recovery-restore" variant="primary">{c('restore')}</Button>
              {!eraseConfirmationVisible ? (
                <Button disabled={actionPending} onPress={() => setEraseConfirmationVisible(true)} testID="account-recovery-erase" variant="destructive">{c('erase')}</Button>
              ) : (
                <Button disabled={actionPending} loading={actionPending && selectedAction === 'ERASE_ALL_ACTIVITY'} onPress={() => submitAction('ERASE_ALL_ACTIVITY')} testID="account-recovery-erase-confirm" variant="destructive">{c('confirmErase')}</Button>
              )}
            </>
          ) : null}
        </Surface>
      )}
      <Button onPress={onBack} variant="ghost">{c('backToLogin')}</Button>
    </Screen>
  );
}
