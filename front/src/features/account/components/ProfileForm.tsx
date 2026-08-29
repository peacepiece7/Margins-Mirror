import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import { updateAuthSessionPreferredLocale } from '@/lib/auth-session';
import { useI18n, type Locale, type TranslationKey } from '@/lib/i18n';
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
  const { t, setLocale } = useI18n();
  const mutation = useUpdateProfileMutation();
  const isCurrentSession = useAuthenticatedSessionGuard();
  const form = useForm<{ displayName: string; preferredLocale: Locale }>({
    defaultValues: { displayName: account.displayName, preferredLocale: account.preferredLocale },
  });

  useEffect(() => {
    form.reset({ displayName: account.displayName, preferredLocale: account.preferredLocale });
  }, [account.displayName, account.preferredLocale, form]);

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors('root');
    try {
      const result = await mutation.mutateAsync({
        displayName: values.displayName.trim(),
        preferredLocale: values.preferredLocale,
      });
      if (!isCurrentSession()) return;
      form.reset({
        displayName: result.account.displayName,
        preferredLocale: result.account.preferredLocale,
      });
      updateAuthSessionPreferredLocale(result.account.preferredLocale);
      setLocale(result.account.preferredLocale);
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
      <div className="grid gap-4 sm:grid-cols-2">
        <AccountFormField htmlFor="account-locale" label={t('language')}>
          <NativeSelect
            id="account-locale"
            className="h-11 rounded border border-stone-300 bg-white px-3 text-sm"
            {...form.register('preferredLocale')}
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </NativeSelect>
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
