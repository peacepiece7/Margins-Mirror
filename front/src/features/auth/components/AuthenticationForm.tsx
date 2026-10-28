import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/lib/i18n';
import { testAttr } from '@/utils/testAttrs';
import { authApi } from '../api';
import type { AuthFormView } from '../types';
import { AuthShell } from './AuthShell';
import { LoginForm } from './LoginForm';
import { RegistrationForm } from './RegistrationForm';

export function AuthenticationForm({
  form,
  authMode,
  changeMode,
  registration,
  submitLogin,
  error,
}: AuthFormView) {
  const { locale, setLocale, t } = useI18n();
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;
  return (
    <AuthShell wide={authMode === 'register'}>
      <Form {...form}>
        <form
          className="blueprint-auth-card grid gap-5 rounded border border-stone-300 bg-stone-50/95 p-4 shadow-[0_24px_80px_rgba(23,23,23,0.10)] sm:p-6"
          onSubmit={handleSubmit(submitLogin)}
          {...testAttr('login-form')}
        >
          <div className="auth-form-heading">
            <div className="flex items-start justify-between gap-3">
              <Link
                className="auth-form-wordmark font-display"
                to="/"
                {...testAttr('auth-home-link')}
              >
                Margins
              </Link>
              <LanguageToggle locale={locale} setLocale={setLocale} label={t('language')} />
            </div>
            <p className="auth-form-eyebrow">
              {authMode === 'login' ? t('authLoginEyebrow') : t('authRegisterEyebrow')}
            </p>
            <h1 className="font-display text-4xl font-medium tracking-normal sm:text-5xl">
              {authMode === 'login' ? t('authLoginHeadline') : t('authRegisterHeadline')}
            </h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              {authMode === 'login' ? t('loginSubtitle') : t('registerSubtitle')}
            </p>
          </div>
          <Tabs
            className="blueprint-auth-tabs"
            onValueChange={changeMode}
            value={authMode}
            {...testAttr('auth-mode-tabs')}
          >
            <TabsList className="grid h-auto min-h-11 w-full grid-cols-2 rounded border border-border bg-background p-1">
              {(['login', 'register'] as const).map((mode) => (
                <TabsTrigger
                  className="min-h-9 rounded px-3 py-2 text-sm font-semibold data-[state=active]:bg-[var(--margins-control)] data-[state=active]:text-[var(--margins-paper)] data-[state=active]:hover:bg-[var(--margins-control-hover)] data-[state=active]:hover:text-[var(--margins-paper)] data-[state=active]:focus-visible:text-[var(--margins-paper)]"
                  disabled={registration.registrationIntentLoading || isSubmitting}
                  key={mode}
                  onClick={() => changeMode(mode)}
                  value={mode}
                  {...testAttr(`auth-mode-${mode}`)}
                >
                  {mode === 'login' ? t('login') : t('createAccount')}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {error && (
            <Alert variant="destructive" {...testAttr('login-error')}>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {authMode === 'login' && <LoginForm />}
          {authMode === 'register' && <RegistrationForm {...registration} />}
          <Button
            disabled={isSubmitting}
            onClick={() => {
              window.location.href = authApi.googleOAuthStartUrl();
            }}
            type="button"
            variant="outline"
            {...testAttr('google-login-submit')}
          >
            <GoogleIcon />
            {t('continueWithGoogle')}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M21.35 12.2c0-.7-.06-1.22-.2-1.76H12v3.31h5.37a4.7 4.7 0 0 1-1.99 3.05l-.02.11 2.89 2.19.2.02c1.83-1.66 2.9-4.1 2.9-6.92Z"
        fill="#4285F4"
      />
      <path
        d="M12 21.5c2.62 0 4.82-.85 6.43-2.38l-3.07-2.32c-.82.56-1.92.95-3.36.95a5.84 5.84 0 0 1-5.53-3.95l-.1.01-3.01 2.28-.04.1A9.72 9.72 0 0 0 12 21.5Z"
        fill="#34A853"
      />
      <path
        d="M6.47 13.8A5.8 5.8 0 0 1 6.15 12c0-.63.11-1.24.31-1.81v-.12L3.42 7.75l-.1.05A9.39 9.39 0 0 0 2.3 12c0 1.5.37 2.93 1.02 4.2l3.15-2.4Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.25c1.82 0 3.05.77 3.76 1.42l2.74-2.62C16.82 3.5 14.62 2.5 12 2.5A9.72 9.72 0 0 0 3.32 7.8l3.14 2.39A5.86 5.86 0 0 1 12 6.25Z"
        fill="#EA4335"
      />
    </svg>
  );
}
