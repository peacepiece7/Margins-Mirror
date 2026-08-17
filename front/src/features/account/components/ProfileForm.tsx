import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import type { Account } from '@/types/api/account';
import { testAttr } from '@/utils/testAttrs';

import { useUpdateProfileMutation } from '../queries';
import { AccountFormField } from './AccountFormField';

const AUTH_PROVIDER_LABELS: Record<string, TranslationKey> = {
  google: 'accountAuthProviderGoogle',
  local: 'accountAuthProviderLocal',
  'local+google': 'accountAuthProviderLocalGoogle',
  resigned: 'accountAuthProviderResigned',
};

export function ProfileForm({ account, onSaved }: { account: Account; onSaved: () => void }) {
  const { t } = useI18n();
  const mutation = useUpdateProfileMutation();
  const isCurrentSession = useAuthenticatedSessionGuard();
  const form = useForm<{ displayName: string }>({
    defaultValues: { displayName: account.displayName },
  });

  useEffect(() => {
    form.reset({ displayName: account.displayName });
  }, [account.displayName, form]);

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors('root');
    try {
      const result = await mutation.mutateAsync({ displayName: values.displayName.trim() });
      if (!isCurrentSession()) return;
      form.reset({ displayName: result.account.displayName });
      onSaved();
    } catch {
      if (!isCurrentSession()) return;
      form.setError('root.server', { message: t('accountErrorProfile') });
    }
  });

  return (
    <form className="grid gap-4" onSubmit={submit}>
      {form.formState.errors.root?.server?.message && (
        <Alert variant="destructive">
          <AlertDescription>{form.formState.errors.root.server.message}</AlertDescription>
        </Alert>
      )}
      <AccountFormField htmlFor="account-username" label={t('username')}>
        <Input
          autoComplete="username"
          className="bg-stone-100 text-stone-600"
          id="account-username"
          readOnly
          value={account.username}
        />
      </AccountFormField>
      <AccountFormField
        error={form.formState.errors.displayName?.message}
        htmlFor="account-display-name"
        label={t('displayName')}
      >
        <Input
          autoComplete="name"
          id="account-display-name"
          aria-describedby={
            form.formState.errors.displayName ? 'account-display-name-error' : undefined
          }
          aria-invalid={Boolean(form.formState.errors.displayName)}
          {...form.register('displayName', { required: t('displayNameRequired') })}
        />
      </AccountFormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <AccountFormField htmlFor="account-email" label={t('email')}>
          <Input
            className="bg-stone-100 text-stone-600"
            id="account-email"
            readOnly
            value={account.email}
          />
        </AccountFormField>
        <AccountFormField htmlFor="account-auth-provider" label={t('accountAuthProvider')}>
          <Input
            className="bg-stone-100 text-stone-600"
            id="account-auth-provider"
            readOnly
            value={t(
              AUTH_PROVIDER_LABELS[account.authProvider.toLowerCase()] ??
                'accountAuthProviderUnknown',
            )}
          />
        </AccountFormField>
      </div>
      <p className="-mt-2 text-xs leading-5 text-stone-500">{t('accountEmailReadOnly')}</p>
      <div className="flex justify-end border-t border-stone-200 pt-4">
        <Button
          disabled={!form.formState.isDirty}
          loading={form.formState.isSubmitting}
          type="submit"
          {...testAttr('account-profile-save')}
        >
          {t('accountSave')}
        </Button>
      </div>
    </form>
  );
}
