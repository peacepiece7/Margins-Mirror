import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n, type TranslationKey } from '@/lib/i18n';

import {
  useRecoverMutation,
  useRequestRecoveryMutation,
  useVerifyRecoveryMutation,
} from '../queries';

type RecoveryStep = 'email' | 'code' | 'action' | 'complete';
type RecoveryValues = { email: string; code: string };

export function RecoveryForm() {
  const { t } = useI18n();
  const [step, setStep] = useState<RecoveryStep>('email');
  const [messageKey, setMessageKey] = useState<TranslationKey>();
  const request = useRequestRecoveryMutation();
  const verify = useVerifyRecoveryMutation();
  const recover = useRecoverMutation();
  const form = useForm<RecoveryValues>({ defaultValues: { email: '', code: '' } });
  const email = useWatch({ control: form.control, name: 'email', defaultValue: '' });
  const code = useWatch({ control: form.control, name: 'code', defaultValue: '' });

  async function requestCode() {
    form.clearErrors('root');
    try {
      await request.mutateAsync(form.getValues('email').trim());
      setStep('code');
      setMessageKey('recoveryRequestReceived');
    } catch {
      form.setError('root.server', { message: t('recoveryError') });
    }
  }

  async function verifyCode() {
    if (!request.data) return;
    form.clearErrors('root');
    try {
      await verify.mutateAsync({
        challengeId: request.data.challengeId,
        code: form.getValues('code'),
      });
      setStep('action');
      setMessageKey('recoveryCodeAccepted');
    } catch {
      form.setError('root.server', { message: t('recoveryError') });
    }
  }

  async function finish(action: 'RESTORE' | 'ERASE_ALL_ACTIVITY') {
    if (!verify.data) return;
    form.clearErrors('root');
    try {
      await recover.mutateAsync({
        email: form.getValues('email').trim(),
        actionToken: verify.data.actionToken,
        action,
      });
      setStep('complete');
      setMessageKey(action === 'RESTORE' ? 'recoveryRestoreComplete' : 'recoveryEraseScheduled');
    } catch {
      form.setError('root.server', { message: t('recoveryError') });
    }
  }

  async function submitStep() {
    if (step === 'email') await requestCode();
    if (step === 'code') await verifyCode();
  }

  return (
    <>
      <ol className="grid grid-cols-3 border-y border-stone-200 py-3 text-center text-xs font-medium text-stone-500">
        <RecoveryStepMarker active={step === 'email'} label="01 / EMAIL" />
        <RecoveryStepMarker active={step === 'code'} label="02 / CODE" />
        <RecoveryStepMarker active={step === 'action' || step === 'complete'} label="03 / ACTION" />
      </ol>
      {form.formState.errors.root?.server?.message && (
        <Alert variant="destructive">
          <AlertDescription>{form.formState.errors.root.server.message}</AlertDescription>
        </Alert>
      )}
      {messageKey && (
        <Alert variant="success">
          <AlertDescription>
            {t(messageKey)}
            {request.data?.devVerificationCode
              ? ` ${t('accountDevCode')} ${request.data.devVerificationCode}`
              : ''}
          </AlertDescription>
        </Alert>
      )}
      <form className="grid gap-4" onSubmit={form.handleSubmit(submitStep)}>
        <div className="grid gap-1.5">
          <Label htmlFor="recovery-email">{t('recoveryEmail')}</Label>
          <Input
            autoComplete="email"
            aria-describedby={form.formState.errors.email ? 'recovery-email-error' : undefined}
            aria-invalid={Boolean(form.formState.errors.email)}
            disabled={step !== 'email'}
            id="recovery-email"
            required
            type="email"
            {...form.register('email', { required: t('emailRequired') })}
          />
          {form.formState.errors.email?.message && (
            <p className="text-xs leading-5 text-red-700" id="recovery-email-error">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>
        {step === 'email' && (
          <Button
            disabled={request.isPending || form.formState.isSubmitting || !email.trim()}
            loading={request.isPending || form.formState.isSubmitting}
            type="submit"
          >
            {t('recoveryRequestCode')}
          </Button>
        )}
        {step === 'code' && (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="recovery-code">{t('recoveryCodeLabel')}</Label>
              <Input
                autoComplete="one-time-code"
                aria-describedby={form.formState.errors.code ? 'recovery-code-error' : undefined}
                aria-invalid={Boolean(form.formState.errors.code)}
                id="recovery-code"
                inputMode="numeric"
                maxLength={6}
                required
                {...form.register('code', {
                  required: t('verificationCodeRequired'),
                  pattern: { value: /^\d{6}$/, message: t('verificationCodeInvalid') },
                })}
              />
              {form.formState.errors.code?.message && (
                <p className="text-xs leading-5 text-red-700" id="recovery-code-error">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>
            <Button
              disabled={verify.isPending || form.formState.isSubmitting || code.length !== 6}
              loading={verify.isPending || form.formState.isSubmitting}
              type="submit"
            >
              {t('recoveryVerifyCode')}
            </Button>
          </>
        )}
        {step === 'action' && (
          <div className="grid gap-2">
            <Button
              loading={recover.isPending}
              onClick={() => void finish('RESTORE')}
              type="button"
            >
              {t('recoveryActionRestore')}
            </Button>
            <Button
              disabled={recover.isPending}
              onClick={() => void finish('ERASE_ALL_ACTIVITY')}
              type="button"
              variant="outline"
            >
              {t('recoveryActionErase')}
            </Button>
          </div>
        )}
      </form>
    </>
  );
}

function RecoveryStepMarker({ active, label }: { active: boolean; label: string }) {
  return (
    <li aria-current={active ? 'step' : undefined} className={active ? 'text-primary' : undefined}>
      {label}
    </li>
  );
}
