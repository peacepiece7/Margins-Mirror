import { useFormContext, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import { AuthFormField } from './AuthFormField';
import type { AuthFormValues } from './auth-form';

export function LoginForm() {
  const { t } = useI18n();
  const {
    formState: { errors, isSubmitting },
    register,
  } = useFormContext<AuthFormValues>();
  const username = useWatch<AuthFormValues, 'username'>({
    name: 'username',
    defaultValue: '',
  });
  const password = useWatch<AuthFormValues, 'password'>({
    name: 'password',
    defaultValue: '',
  });

  return (
    <>
      <div className="grid gap-1" {...testAttr('login-fields-grid')}>
        <AuthFormField name="username" errorTestId="login-username-error">
          <label className="mb-1 block text-sm font-medium" htmlFor="login-username">
            {t('username')}
          </label>
          <Input
            aria-describedby={errors.username ? 'login-username-error' : undefined}
            aria-invalid={Boolean(errors.username)}
            className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-stone-700 md:text-sm"
            id="login-username"
            placeholder={t('username')}
            aria-label={t('username')}
            {...register('username', {
              required: t('usernameRequired'),
            })}
            {...testAttr('login-username-input')}
          />
        </AuthFormField>
        <AuthFormField name="password" errorTestId="login-password-error">
          <label className="mb-1 block text-sm font-medium" htmlFor="login-password">
            {t('password')}
          </label>
          <Input
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            aria-invalid={Boolean(errors.password)}
            className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-stone-700 md:text-sm"
            id="login-password"
            placeholder={t('password')}
            aria-label={t('password')}
            type="password"
            {...register('password', {
              required: t('passwordRequired'),
            })}
            {...testAttr('login-password-input')}
          />
        </AuthFormField>
      </div>
      <Button
        className="rounded bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={isSubmitting || !username.trim() || !password.trim()}
        type="submit"
        {...testAttr('login-submit')}
      >
        {t('login')}
      </Button>
      <a className="text-center text-xs text-stone-600 underline" href="/privacy">
        {t('privacyPolicyTitle')}
      </a>
      <a className="text-center text-xs text-stone-600 underline" href="/contact">
        {t('contactLink')}
      </a>
    </>
  );
}
