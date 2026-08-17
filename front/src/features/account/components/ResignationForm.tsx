import { useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { clearAuthSession } from '@/lib/auth-session';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import { useRequestResignationChallengeMutation, useResignMutation } from '../queries';
import { AccountFormField } from './AccountFormField';

type ResignationValues = {
  code: string;
  reason: string;
};

export function ResignationForm() {
  const { t } = useI18n();
  const challenge = useRequestResignationChallengeMutation();
  const resignation = useResignMutation();
  const isCurrentSession = useAuthenticatedSessionGuard();
  const form = useForm<ResignationValues>({
    defaultValues: { code: '', reason: 'NOT_USING' },
  });

  async function requestCode() {
    form.clearErrors('root');
    try {
      await challenge.mutateAsync();
      if (!isCurrentSession()) return;
    } catch {
      if (!isCurrentSession()) return;
      form.setError('root.server', { message: t('accountErrorSendCode') });
    }
  }

  const submit = form.handleSubmit(async (values) => {
    if (!challenge.data) return;
    form.clearErrors('root');
    try {
      await resignation.mutateAsync({
        challengeId: challenge.data.challengeId,
        code: values.code,
        reason: values.reason,
      });
      if (!isCurrentSession()) return;
      clearAuthSession({ clearRefreshHint: true });
      window.location.assign('/');
    } catch {
      if (!isCurrentSession()) return;
      form.setError('root.server', { message: t('accountErrorResignation') });
    }
  });

  return (
    <form className="mt-5 grid gap-4 border-t border-red-200 pt-4" onSubmit={submit}>
      {form.formState.errors.root?.server?.message && (
        <Alert variant="destructive">
          <AlertDescription>{form.formState.errors.root.server.message}</AlertDescription>
        </Alert>
      )}
      {challenge.data && (
        <p className="text-sm text-stone-700">
          {t('accountResignCodeSent')}
          {challenge.data.devVerificationCode
            ? ` ${t('accountDevCode')} ${challenge.data.devVerificationCode}`
            : ''}
        </p>
      )}
      <AccountFormField htmlFor="account-resign-reason" label={t('accountReason')}>
        <NativeSelect id="account-resign-reason" {...form.register('reason')}>
          <option value="NOT_USING">{t('accountReasonNotUsing')}</option>
          <option value="MISSING_FEATURES">{t('accountReasonFeatures')}</option>
          <option value="TOO_MANY_ERRORS">{t('accountReasonErrors')}</option>
          <option value="PRIVACY_CONCERNS">{t('accountReasonPrivacy')}</option>
          <option value="OTHER">{t('accountReasonOther')}</option>
        </NativeSelect>
      </AccountFormField>
      {!challenge.data ? (
        <Button
          loading={challenge.isPending}
          onClick={() => void requestCode()}
          type="button"
          variant="outline"
        >
          {t('sendVerificationCode')}
        </Button>
      ) : (
        <>
          <AccountFormField
            error={form.formState.errors.code?.message}
            htmlFor="account-resign-code"
            label={t('accountCodeLabel')}
          >
            <Input
              autoComplete="one-time-code"
              aria-describedby={
                form.formState.errors.code ? 'account-resign-code-error' : undefined
              }
              aria-invalid={Boolean(form.formState.errors.code)}
              id="account-resign-code"
              inputMode="numeric"
              maxLength={6}
              required
              {...form.register('code', {
                required: t('verificationCodeRequired'),
                pattern: { value: /^\d{6}$/, message: t('verificationCodeInvalid') },
              })}
            />
          </AccountFormField>
          <Button
            loading={form.formState.isSubmitting}
            type="submit"
            variant="destructive"
            {...testAttr('account-resign-submit')}
          >
            {t('accountResignAction')}
          </Button>
        </>
      )}
    </form>
  );
}
