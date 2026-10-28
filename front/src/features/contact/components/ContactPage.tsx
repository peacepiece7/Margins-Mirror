import { Link } from 'react-router-dom';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { TurnstileWidget } from '@/components/ui/turnstile-widget';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { contactCategories, type ContactCategory } from '@/types/api/contact';
import { testAttr } from '@/utils/testAttrs';

import type { ContactFieldProps, ContactTextFieldProps } from '../types';
import { useContactForm } from '../use-contact-form';

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
const textFields = {
  email: {
    label: 'contactEmail',
    required: 'contactEmailRequired',
    tooLong: 'contactEmailInvalid',
    limit: 254,
  },
  subject: {
    label: 'contactSubject',
    required: 'contactSubjectRequired',
    tooLong: 'contactSubjectTooLong',
    limit: 160,
  },
  message: {
    label: 'contactMessage',
    required: 'contactMessageRequired',
    tooLong: 'contactMessageTooLong',
    limit: 5000,
  },
} as const;

export function ContactPage() {
  const { locale, setLocale, t } = useI18n();
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
      <ContactForm />
    </main>
  );
}

function ContactForm() {
  const { locale, t } = useI18n();
  const { form, feedback, submit, onEmailChange, challenge } = useContactForm();
  const { errors, isSubmitting } = form.formState;

  return (
    <form className="grid gap-5 py-8" noValidate onSubmit={form.handleSubmit(submit)}>
      <ContactTextField form={form} name="email" onChange={onEmailChange} />
      <ContactField
        error={errors.category?.message}
        htmlFor="contact-category"
        label={t('contactCategory')}
      >
        <NativeSelect
          aria-describedby={errors.category ? 'contact-category-error' : undefined}
          aria-invalid={Boolean(errors.category)}
          className="h-11 md:h-8"
          id="contact-category"
          {...form.register('category', { required: t('contactCategoryRequired') })}
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
      <ContactTextField form={form} name="subject" />
      <ContactTextField form={form} name="message" />

      <TurnstileWidget
        action="contact_inquiry"
        locale={locale}
        promptKey="contactBotChallengePrompt"
        testId="contact-bot-challenge"
        {...challenge}
      />
      {feedback && (
        <Alert
          aria-live="polite"
          variant={feedback.kind === 'error' ? 'destructive' : 'success'}
          {...testAttr(`contact-${feedback.kind}`)}
        >
          <AlertDescription>
            {feedback.kind === 'success'
              ? `${t('contactSuccess')} #${feedback.inquiryId}`
              : t(feedback.messageKey)}
          </AlertDescription>
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
  );
}

function ContactTextField({ form, name, onChange }: ContactTextFieldProps) {
  const { t } = useI18n();
  const field = textFields[name];
  const error = form.formState.errors[name];
  const id = `contact-${name}`;
  const Control = name === 'message' ? Textarea : Input;
  const description =
    [error && `${id}-error`, name === 'message' && 'contact-sensitive-warning']
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <ContactField error={error?.message} htmlFor={id} label={t(field.label)}>
      <Control
        aria-describedby={description}
        aria-invalid={Boolean(error)}
        autoComplete={name === 'email' ? 'email' : undefined}
        className={name === 'message' ? 'min-h-48' : undefined}
        id={id}
        maxLength={field.limit}
        type={name === 'email' ? 'email' : undefined}
        {...form.register(name, {
          onChange,
          required: t(field.required),
          maxLength: { value: field.limit, message: t(field.tooLong) },
          pattern:
            name === 'email'
              ? { value: emailPattern, message: t('contactEmailInvalid') }
              : undefined,
          validate: {
            notBlank: (value) => Boolean(value.trim()) || t(field.required),
            supportedCharacters: (value) =>
              !hasDisallowedControlCharacters(value) || t('contactInvalidCharacters'),
          },
        })}
        {...testAttr(`${id}-input`)}
      />
      {name === 'message' && (
        <p className="text-xs leading-5 text-stone-600" id="contact-sensitive-warning">
          {t('contactSensitiveWarning')}
        </p>
      )}
    </ContactField>
  );
}

function ContactField({ children, error, htmlFor, label }: ContactFieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <p className="text-xs leading-5 text-destructive" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
