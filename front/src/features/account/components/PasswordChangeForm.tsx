import { useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clearAuthSession } from '@/lib/auth-session';
import { useAuthenticatedSessionGuard } from '@/lib/authenticated-session-guard';
import { useI18n } from '@/lib/i18n';

import { useChangePasswordMutation } from '../queries';
import { AccountFormField } from './AccountFormField';

type PasswordValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function PasswordChangeForm() {
  const { t } = useI18n();
  const mutation = useChangePasswordMutation();
  const isCurrentSession = useAuthenticatedSessionGuard();
  const form = useForm<PasswordValues>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const submit = form.handleSubmit(async (values) => {
    form.clearErrors('root');
    try {
      await mutation.mutateAsync(values);
      if (!isCurrentSession()) return;
      clearAuthSession({ clearRefreshHint: true });
      window.location.assign('/');
    } catch {
      if (!isCurrentSession()) return;
      form.setError('root.server', { message: t('accountErrorPassword') });
    }
  });

  return (
    <form className="grid gap-4" onSubmit={submit}>
      {form.formState.errors.root?.server?.message && (
        <Alert variant="destructive">
          <AlertDescription>{form.formState.errors.root.server.message}</AlertDescription>
        </Alert>
      )}
      <AccountFormField
        error={form.formState.errors.currentPassword?.message}
        htmlFor="account-current-password"
        label={t('accountCurrentPassword')}
      >
        <Input
          autoComplete="current-password"
          aria-describedby={
            form.formState.errors.currentPassword ? 'account-current-password-error' : undefined
          }
          aria-invalid={Boolean(form.formState.errors.currentPassword)}
          id="account-current-password"
          required
          type="password"
          {...form.register('currentPassword', { required: t('passwordRequired') })}
        />
      </AccountFormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <AccountFormField
          error={form.formState.errors.newPassword?.message}
          htmlFor="account-new-password"
          label={t('accountNewPassword')}
        >
          <Input
            autoComplete="new-password"
            aria-describedby={
              form.formState.errors.newPassword ? 'account-new-password-error' : undefined
            }
            aria-invalid={Boolean(form.formState.errors.newPassword)}
            id="account-new-password"
            minLength={10}
            required
            type="password"
            {...form.register('newPassword', {
              required: t('passwordRequired'),
              minLength: { value: 10, message: t('passwordMinLength') },
            })}
          />
        </AccountFormField>
        <AccountFormField
          error={form.formState.errors.confirmPassword?.message}
          htmlFor="account-confirm-password"
          label={t('accountNewPasswordConfirm')}
        >
          <Input
            autoComplete="new-password"
            aria-describedby={
              form.formState.errors.confirmPassword ? 'account-confirm-password-error' : undefined
            }
            aria-invalid={Boolean(form.formState.errors.confirmPassword)}
            id="account-confirm-password"
            required
            type="password"
            {...form.register('confirmPassword', {
              required: t('passwordConfirmRequired'),
              validate: (value) => value === form.getValues('newPassword') || t('passwordMismatch'),
            })}
          />
        </AccountFormField>
      </div>
      <div className="flex justify-end border-t border-stone-200 pt-4">
        <Button loading={form.formState.isSubmitting} type="submit" variant="outline">
          {t('accountPasswordAction')}
        </Button>
      </div>
    </form>
  );
}
