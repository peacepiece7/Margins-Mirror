import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { isTurnstileConfigured, TurnstileWidget } from '@/components/ui/turnstile-widget';
import { apiErrorMessage } from '@/lib/api-error-i18n';
import { readAuthSession } from '@/lib/auth-session';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { contactCategories, type ContactCategory } from '@/types/api/contact';
import { testAttr } from '@/utils/testAttrs';

import { contactApi } from '../api';
import type { ContactFormValues } from '../types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function hasDisallowedControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;
  });
}
const categoryLabels: Record<ContactCategory, TranslationKey> = {
  SERVICE_USAGE: 'contactCategoryServiceUsage',
  ACCOUNT_LOGIN: 'contactCategoryAccountLogin',
  PRIVACY: 'contactCategoryPrivacy',
  BUG_REPORT: 'contactCategoryBugReport',
  FEATURE_REQUEST: 'contactCategoryFeatureRequest',
  OTHER: 'contactCategoryOther',
};

export function ContactPage() {
  const { locale, setLocale, t } = useI18n();
  const [botChallengeToken, setBotChallengeToken] = useState<string>();
  const [botChallengeResetSignal, setBotChallengeResetSignal] = useState(0);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string }>();
  const {
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
  } = useForm<ContactFormValues>({
    defaultValues: { email: '', category: '', subject: '', message: '' },
  });

  useEffect(() => {
    if (!readAuthSession()) return;
    let active = true;
    void contactApi
      .accountEmail()
      .then(({ email }) => {
        if (active && !getValues('email')) setValue('email', email);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [getValues, setValue]);

  async function submit(values: ContactFormValues) {
    setFeedback(undefined);
    if (isTurnstileConfigured() && !botChallengeToken) {
      setFeedback({ kind: 'error', message: t('contactBotChallengeRequired') });
      return;
    }

    try {
      const result = await contactApi.submit({
        email: values.email.trim().toLowerCase(),
        category: values.category as ContactCategory,
        subject: values.subject.trim(),
        message: values.message.trim(),
        botChallengeToken: botChallengeToken ?? '',
      });
      reset({
        email: values.email,
        category: values.category,
        subject: '',
        message: '',
      });
      setFeedback({ kind: 'success', message: `${t('contactSuccess')} #${result.inquiryId}` });
    } catch (error) {
      setFeedback({ kind: 'error', message: apiErrorMessage(error, t, 'contactSubmitFailed') });
    } finally {
      if (isTurnstileConfigured()) {
        setBotChallengeToken(undefined);
        setBotChallengeResetSignal((signal) => signal + 1);
      }
    }
  }

  const nextLocale = locale === 'en' ? 'ko' : 'en';

  return (
    <main
      className="margins-page-gutter mx-auto min-h-screen max-w-2xl py-10 text-stone-800"
      {...testAttr('contact-page')}
    >
      <header className="border-b border-stone-300 pb-6">
        <div className="flex items-center justify-between gap-4">
          <Link className="text-sm underline" to="/">
            {t('contactBackHome')}
          </Link>
          <Button onClick={() => setLocale(nextLocale)} type="button" variant="outline">
            {nextLocale.toUpperCase()}
          </Button>
        </div>
        <h1 className="mt-4 font-display text-4xl font-semibold">{t('contactTitle')}</h1>
        <p className="mt-3 leading-7 text-stone-600">{t('contactDescription')}</p>
      </header>

      <form className="grid gap-5 py-8" noValidate onSubmit={handleSubmit(submit)}>
        <ContactField
          error={errors.email?.message}
          htmlFor="contact-email"
          label={t('contactEmail')}
        >
          <Input
            aria-describedby={errors.email ? 'contact-email-error' : undefined}
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            id="contact-email"
            maxLength={254}
            type="email"
            {...register('email', {
              required: t('contactEmailRequired'),
              maxLength: { value: 254, message: t('contactEmailInvalid') },
              pattern: { value: emailPattern, message: t('contactEmailInvalid') },
              validate: (value) =>
                (!hasDisallowedControlCharacters(value) && Boolean(value.trim())) ||
                t('contactInvalidCharacters'),
            })}
            {...testAttr('contact-email-input')}
          />
        </ContactField>

        <ContactField
          error={errors.category?.message}
          htmlFor="contact-category"
          label={t('contactCategory')}
        >
          <NativeSelect
            aria-describedby={errors.category ? 'contact-category-error' : undefined}
            aria-invalid={Boolean(errors.category)}
            id="contact-category"
            {...register('category', { required: t('contactCategoryRequired') })}
            {...testAttr('contact-category-select')}
          >
            <option value="">{t('contactCategoryPlaceholder')}</option>
            {contactCategories.map((category) => (
              <option key={category} value={category}>
                {t(categoryLabels[category])}
              </option>
            ))}
          </NativeSelect>
        </ContactField>

        <ContactField
          error={errors.subject?.message}
          htmlFor="contact-subject"
          label={t('contactSubject')}
        >
          <Input
            aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
            aria-invalid={Boolean(errors.subject)}
            id="contact-subject"
            maxLength={160}
            {...register('subject', {
              required: t('contactSubjectRequired'),
              maxLength: { value: 160, message: t('contactSubjectTooLong') },
              validate: {
                notBlank: (value) => Boolean(value.trim()) || t('contactSubjectRequired'),
                supportedCharacters: (value) =>
                  !hasDisallowedControlCharacters(value) || t('contactInvalidCharacters'),
              },
            })}
            {...testAttr('contact-subject-input')}
          />
        </ContactField>

        <ContactField
          error={errors.message?.message}
          htmlFor="contact-message"
          label={t('contactMessage')}
        >
          <Textarea
            aria-describedby={
              errors.message
                ? 'contact-message-error contact-sensitive-warning'
                : 'contact-sensitive-warning'
            }
            aria-invalid={Boolean(errors.message)}
            className="min-h-48"
            id="contact-message"
            maxLength={5000}
            {...register('message', {
              required: t('contactMessageRequired'),
              maxLength: { value: 5000, message: t('contactMessageTooLong') },
              validate: {
                notBlank: (value) => Boolean(value.trim()) || t('contactMessageRequired'),
                supportedCharacters: (value) =>
                  !hasDisallowedControlCharacters(value) || t('contactInvalidCharacters'),
              },
            })}
            {...testAttr('contact-message-input')}
          />
          <p className="text-xs leading-5 text-stone-600" id="contact-sensitive-warning">
            {t('contactSensitiveWarning')}
          </p>
        </ContactField>

        <TurnstileWidget
          action="contact_inquiry"
          locale={locale}
          onTokenChange={setBotChallengeToken}
          promptKey="contactBotChallengePrompt"
          resetSignal={botChallengeResetSignal}
          testId="contact-bot-challenge"
        />

        {feedback && (
          <Alert
            aria-live="polite"
            variant={feedback.kind === 'error' ? 'destructive' : 'success'}
            {...testAttr(`contact-${feedback.kind}`)}
          >
            <AlertDescription>{feedback.message}</AlertDescription>
          </Alert>
        )}

        <p className="text-xs leading-5 text-stone-600">
          {t('contactPrivacyNotice')}{' '}
          <Link className="underline" to="/privacy">
            {t('privacyPolicyTitle')}
          </Link>
        </p>
        <Button disabled={isSubmitting} type="submit" {...testAttr('contact-submit')}>
          {isSubmitting ? t('contactSubmitting') : t('contactSubmit')}
        </Button>
      </form>
    </main>
  );
}

function ContactField({
  children,
  error,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <p className="text-xs leading-5 text-red-700" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
