import { useFormContext, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { isTurnstileConfigured, TurnstileWidget } from '@/components/ui/turnstile-widget';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';

import { AuthFormField } from './AuthFormField';
import { emailPattern, type AuthFormValues } from './auth-form';
import { ConsentCheckbox } from './ConsentCheckbox';

type RegistrationFormProps = {
  botChallengeResetSignal: number;
  botChallengeToken?: string;
  emailAvailabilityConfirmed: boolean;
  emailAvailabilityMessage?: string;
  emailCheckLoading: boolean;
  emailVerificationConfirmed: boolean;
  onBotChallengeTokenChange: (token?: string) => void;
  onCheckEmailAvailability: () => void;
  onConfirmEmailVerification: () => void;
  onContinueAfterConsent: () => void;
  onRequestEmailVerification: () => void;
  registrationConsentsAccepted: boolean;
  registrationIntentCreated: boolean;
  registrationIntentLoading: boolean;
  verificationCodeRequested: boolean;
  verificationLoading: boolean;
  verificationMessage?: string;
  verificationResendSeconds: number;
  resetEmailVerification: () => void;
  resetOtpConfirmation: () => void;
};

export function RegistrationForm({
  botChallengeResetSignal,
  botChallengeToken,
  emailAvailabilityConfirmed,
  emailAvailabilityMessage,
  emailCheckLoading,
  emailVerificationConfirmed,
  onBotChallengeTokenChange,
  onCheckEmailAvailability,
  onConfirmEmailVerification,
  onContinueAfterConsent,
  onRequestEmailVerification,
  registrationConsentsAccepted,
  registrationIntentCreated,
  registrationIntentLoading,
  verificationCodeRequested,
  verificationLoading,
  verificationMessage,
  verificationResendSeconds,
  resetEmailVerification,
  resetOtpConfirmation,
}: RegistrationFormProps) {
  const { locale, t } = useI18n();
  const {
    formState: { errors, isSubmitting },
    getValues,
    register,
    trigger,
  } = useFormContext<AuthFormValues>();
  const username = useWatch<AuthFormValues, 'username'>({
    name: 'username',
    defaultValue: '',
  });
  const displayName = useWatch<AuthFormValues, 'displayName'>({
    name: 'displayName',
    defaultValue: '',
  });
  const email = useWatch<AuthFormValues, 'email'>({
    name: 'email',
    defaultValue: '',
  });
  const emailVerificationCode = useWatch<AuthFormValues, 'emailVerificationCode'>({
    name: 'emailVerificationCode',
    defaultValue: '',
  });
  const password = useWatch<AuthFormValues, 'password'>({
    name: 'password',
    defaultValue: '',
  });
  const confirmPassword = useWatch<AuthFormValues, 'confirmPassword'>({
    name: 'confirmPassword',
    defaultValue: '',
  });

  return (
    <div className="grid gap-x-5 gap-y-1 md:grid-cols-2" {...testAttr('register-fields-grid')}>
      <AuthFormField name="username" errorTestId="register-username-error">
        <label className="mb-1 block text-sm font-medium" htmlFor="register-username">
          {t('username')}
        </label>
        <Input
          aria-describedby={errors.username ? 'register-username-error' : undefined}
          aria-invalid={Boolean(errors.username)}
          className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-stone-700 md:text-sm"
          id="register-username"
          placeholder={t('username')}
          aria-label={t('username')}
          {...register('username', {
            required: t('usernameRequired'),
            validate: (value) => value.trim().length >= 4 || t('usernameMinLength'),
          })}
          {...testAttr('register-username-input')}
        />
      </AuthFormField>
      <AuthFormField name="preferredLocale" errorTestId="register-locale-error">
        <label className="grid gap-1 text-sm font-medium" htmlFor="register-locale">
          {t('language')}
          <NativeSelect
            id="register-locale"
            className="h-11 rounded border border-stone-300 bg-white px-3 text-base md:h-8 md:text-sm"
            {...register('preferredLocale')}
            {...testAttr('register-locale-select')}
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </NativeSelect>
        </label>
      </AuthFormField>
      <AuthFormField name="displayName" errorTestId="register-display-name-error">
        <label className="mb-1 block text-sm font-medium" htmlFor="register-display-name">
          {t('displayName')}
        </label>
        <Input
          aria-describedby={errors.displayName ? 'register-display-name-error' : undefined}
          aria-invalid={Boolean(errors.displayName)}
          className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-stone-700 md:text-sm"
          id="register-display-name"
          placeholder={t('displayName')}
          aria-label={t('displayName')}
          {...register('displayName', {
            required: t('displayNameRequired'),
          })}
          {...testAttr('register-display-name-input')}
        />
      </AuthFormField>
      <div {...testAttr('register-email-field')}>
        <label className="mb-1 block text-sm font-medium" htmlFor="register-email">
          {t('email')}
        </label>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            aria-describedby={errors.email ? 'register-email-error' : undefined}
            aria-invalid={Boolean(errors.email)}
            className="min-w-0 rounded border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-stone-700 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500 md:text-sm"
            disabled={emailVerificationConfirmed}
            id="register-email"
            placeholder={t('email')}
            aria-label={t('email')}
            type="email"
            {...register('email', {
              required: t('emailRequired'),
              pattern: {
                value: emailPattern,
                message: t('emailInvalid'),
              },
              onChange: resetEmailVerification,
            })}
            {...testAttr('register-email-input')}
          />
          <Button
            className="h-11 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:border-stone-700 disabled:opacity-50 md:h-8"
            disabled={emailCheckLoading || emailVerificationConfirmed || !email.trim()}
            onClick={onCheckEmailAvailability}
            type="button"
            {...testAttr('register-email-check-submit')}
          >
            {t('checkDuplicate')}
          </Button>
        </div>
        <AuthFormField name="email" errorTestId="register-email-error" />
        {emailAvailabilityMessage && (
          <div
            className="mt-1 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            {...testAttr('register-email-check-message')}
          >
            {emailAvailabilityMessage}
          </div>
        )}
      </div>
      <div className="md:col-span-2" {...testAttr('register-email-code-field')}>
        {emailAvailabilityConfirmed && !emailVerificationConfirmed && (
          <TurnstileWidget
            locale={locale}
            onTokenChange={onBotChallengeTokenChange}
            resetSignal={botChallengeResetSignal}
          />
        )}
        <label className="mb-1 block text-sm font-medium" htmlFor="register-email-code">
          {t('emailVerificationCode')}
        </label>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <Input
            aria-describedby={
              errors.emailVerificationCode ? 'register-email-code-error' : undefined
            }
            aria-invalid={Boolean(errors.emailVerificationCode)}
            className="min-w-0 rounded border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-stone-700 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500 md:text-sm"
            disabled={emailVerificationConfirmed}
            id="register-email-code"
            inputMode="numeric"
            maxLength={6}
            placeholder={t('emailVerificationCode')}
            aria-label={t('emailVerificationCode')}
            {...register('emailVerificationCode', {
              required: t('verificationCodeRequired'),
              pattern: {
                value: /^\d{6}$/,
                message: t('verificationCodeInvalid'),
              },
              onChange: resetOtpConfirmation,
            })}
            {...testAttr('register-email-code-input')}
          />
          {verificationCodeRequested && verificationResendSeconds > 0 ? (
            <div
              className="flex h-11 items-center rounded border border-stone-300 bg-stone-100 px-3 py-2 text-sm font-medium text-stone-600 md:h-8"
              aria-live="polite"
              {...testAttr('register-email-code-resend-timer')}
            >
              {t('emailVerificationResendTimer')} {verificationResendSeconds}s
            </div>
          ) : (
            <Button
              className="h-11 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:border-stone-700 disabled:opacity-50 md:h-8"
              disabled={
                verificationLoading ||
                emailVerificationConfirmed ||
                !emailAvailabilityConfirmed ||
                (isTurnstileConfigured() && !botChallengeToken)
              }
              onClick={onRequestEmailVerification}
              type="button"
              {...testAttr('register-email-code-submit')}
            >
              {verificationCodeRequested ? t('resendVerificationCode') : t('sendVerificationCode')}
            </Button>
          )}
          <Button
            className="h-11 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:border-stone-700 disabled:opacity-50 md:h-8"
            disabled={
              verificationLoading ||
              emailVerificationConfirmed ||
              !emailAvailabilityConfirmed ||
              emailVerificationCode.trim().length !== 6
            }
            onClick={onConfirmEmailVerification}
            type="button"
            {...testAttr('register-email-code-confirm-submit')}
          >
            {t('verifyVerificationCode')}
          </Button>
        </div>
        <AuthFormField name="emailVerificationCode" errorTestId="register-email-code-error" />
        {verificationMessage && (
          <div
            className="mt-1 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            {...testAttr('register-email-code-message')}
          >
            {verificationMessage}
          </div>
        )}
      </div>
      {emailVerificationConfirmed && (
        <fieldset className="grid gap-3 rounded border border-stone-300 bg-white p-4 md:col-span-2">
          <legend className="px-1 text-sm font-semibold">{t('consentTitle')}</legend>
          <ConsentCheckbox
            disabled={registrationIntentLoading || registrationIntentCreated}
            label={`${t('consentPrivacyPrefix')} ${t('privacyPolicyTitle')}${t('consentPrivacySuffix')}`}
            name="privacyPolicyAccepted"
            testId="register-privacy-consent"
          />
          <ConsentCheckbox
            disabled={registrationIntentLoading || registrationIntentCreated}
            label={t('consentAiTransfer')}
            name="aiTransferAccepted"
            testId="register-ai-transfer-consent"
          />
          <ConsentCheckbox
            disabled={registrationIntentLoading || registrationIntentCreated}
            label={t('consentAge')}
            name="ageOver14Confirmed"
            testId="register-age-consent"
          />
          <p className="text-xs leading-5 text-stone-600">
            <a className="underline" href="/privacy">
              {t('privacyPolicyTitle')}
            </a>
            {' · '}
            <a className="underline" href="/privacy/history">
              {t('privacyHistoryTitle')}
            </a>
          </p>
          {registrationIntentCreated && (
            <p
              className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              {...testAttr('register-consent-confirmed')}
            >
              {t('consentConfirmed')}
            </p>
          )}
        </fieldset>
      )}
      <AuthFormField name="password" errorTestId="login-password-error">
        <label className="mb-1 block text-sm font-medium" htmlFor="register-password">
          {t('password')}
        </label>
        <Input
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          aria-invalid={Boolean(errors.password)}
          className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-stone-700 md:text-sm"
          id="register-password"
          placeholder={t('password')}
          aria-label={t('password')}
          type="password"
          {...register('password', {
            required: t('passwordRequired'),
            validate: (value) => value.trim().length >= 8 || t('passwordMinLength'),
            onChange: () => {
              if (getValues('confirmPassword')) {
                void trigger('confirmPassword');
              }
            },
          })}
          {...testAttr('login-password-input')}
        />
      </AuthFormField>
      <AuthFormField name="confirmPassword" errorTestId="register-password-confirm-error">
        <label className="mb-1 block text-sm font-medium" htmlFor="register-password-confirm">
          {t('passwordConfirm')}
        </label>
        <Input
          aria-describedby={errors.confirmPassword ? 'register-password-confirm-error' : undefined}
          aria-invalid={Boolean(errors.confirmPassword)}
          className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-stone-700 md:text-sm"
          id="register-password-confirm"
          placeholder={t('passwordConfirm')}
          aria-label={t('passwordConfirm')}
          type="password"
          {...register('confirmPassword', {
            required: t('passwordConfirmRequired'),
            validate: (value) => value === getValues('password') || t('passwordMismatch'),
          })}
          {...testAttr('register-password-confirm-input')}
        />
      </AuthFormField>
      {emailVerificationConfirmed && !registrationIntentCreated && (
        <Button
          className="rounded bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 md:col-span-2"
          disabled={registrationIntentLoading || !registrationConsentsAccepted}
          onClick={onContinueAfterConsent}
          type="button"
          {...testAttr('register-consent-continue')}
        >
          {t('consentContinue')}
        </Button>
      )}
      {registrationIntentCreated && (
        <Button
          className="rounded bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 md:col-span-2"
          disabled={
            isSubmitting ||
            !username.trim() ||
            username.trim().length < 4 ||
            !displayName.trim() ||
            !email.trim() ||
            !emailAvailabilityConfirmed ||
            !registrationConsentsAccepted ||
            password.trim().length < 8 ||
            !confirmPassword.trim() ||
            password.trim() !== confirmPassword.trim()
          }
          type="submit"
          {...testAttr('register-submit')}
        >
          {t('createAccount')}
        </Button>
      )}
    </div>
  );
}
