import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import type { AuthFormValues } from './auth-form';
import { LoginForm } from './LoginForm';
import { RegistrationForm } from './RegistrationForm';

const defaultValues: AuthFormValues = {
  username: '',
  displayName: '',
  email: '',
  emailVerificationCode: '',
  preferredLocale: 'en',
  password: '',
  confirmPassword: '',
  privacyPolicyAccepted: false,
  aiTransferAccepted: false,
  ageOver14Confirmed: false,
};

function UsernameProbe() {
  const username = useWatch<AuthFormValues, 'username'>({ name: 'username' });
  return <output data-testid="username-probe">{username}</output>;
}

function ConsentProbe() {
  const accepted = useWatch<AuthFormValues, 'privacyPolicyAccepted'>({
    name: 'privacyPolicyAccepted',
  });
  return <output data-testid="consent-probe">{String(accepted)}</output>;
}

function ValidationTrigger() {
  const { trigger } = useFormContext<AuthFormValues>();
  return (
    <button onClick={() => void trigger()} type="button">
      Validate
    </button>
  );
}

function LoginHarness() {
  const form = useForm<AuthFormValues>({ defaultValues, mode: 'onBlur' });
  return (
    <I18nProvider>
      <FormProvider {...form}>
        <form>
          <LoginForm />
          <UsernameProbe />
        </form>
      </FormProvider>
    </I18nProvider>
  );
}

function RegistrationHarness() {
  const form = useForm<AuthFormValues>({ defaultValues });
  const noop = vi.fn();
  return (
    <I18nProvider>
      <FormProvider {...form}>
        <form>
          <RegistrationForm
            botChallengeResetSignal={0}
            emailAvailabilityConfirmed={false}
            emailCheckLoading={false}
            emailVerificationConfirmed
            onBotChallengeTokenChange={noop}
            onCheckEmailAvailability={noop}
            onConfirmEmailVerification={noop}
            onContinueAfterConsent={noop}
            onRequestEmailVerification={noop}
            registrationConsentsAccepted={false}
            registrationIntentCreated={false}
            registrationIntentLoading={false}
            verificationCodeRequested={false}
            verificationLoading={false}
            verificationResendSeconds={0}
            resetEmailVerification={noop}
            resetOtpConfirmation={noop}
          />
          <ConsentProbe />
          <ValidationTrigger />
        </form>
      </FormProvider>
    </I18nProvider>
  );
}

function MissingDefaultsHarness() {
  const form = useForm<AuthFormValues>();
  const noop = vi.fn();

  return (
    <I18nProvider>
      <FormProvider {...form}>
        <form>
          <LoginForm />
          <RegistrationForm
            botChallengeResetSignal={0}
            emailAvailabilityConfirmed={false}
            emailCheckLoading={false}
            emailVerificationConfirmed={false}
            onBotChallengeTokenChange={noop}
            onCheckEmailAvailability={noop}
            onConfirmEmailVerification={noop}
            onContinueAfterConsent={noop}
            onRequestEmailVerification={noop}
            registrationConsentsAccepted={false}
            registrationIntentCreated
            registrationIntentLoading={false}
            resetEmailVerification={noop}
            resetOtpConfirmation={noop}
            verificationCodeRequested={false}
            verificationLoading={false}
            verificationResendSeconds={0}
          />
        </form>
      </FormProvider>
    </I18nProvider>
  );
}

describe('authentication form boundaries', () => {
  afterEach(cleanup);

  it('renders safely with initially absent RHF values and keeps submits disabled', () => {
    expect(() => render(<MissingDefaultsHarness />)).not.toThrow();

    expect(screen.getByTestId('login-submit')).toBeDisabled();
    expect(screen.getByTestId('register-submit')).toBeDisabled();
  });

  it('uses the parent RHF context for login values and field validation', async () => {
    render(<LoginHarness />);

    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(screen.getByTestId('login-fields-grid')).toHaveClass('gap-1');
    expect(document.querySelector('label[for="login-username"]')).toHaveTextContent('Username');
    expect(document.querySelector('label[for="login-password"]')).toHaveTextContent('Password');
    expect(screen.getByTestId('login-password-error')).toHaveClass('min-h-5');
    expect(screen.getByTestId('login-password-error')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('login-password-error')).toBeEmptyDOMElement();

    const username = screen.getByTestId('login-username-input');
    fireEvent.change(username, { target: { value: 'reader' } });
    expect(screen.getByTestId('username-probe')).toHaveTextContent('reader');

    fireEvent.blur(screen.getByTestId('login-password-input'));
    await waitFor(() =>
      expect(screen.getByTestId('login-password-error')).toHaveTextContent('Password is required.'),
    );
    expect(screen.getByTestId('login-password-error')).not.toHaveAttribute('aria-hidden');
    expect(screen.getByTestId('login-password-error')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('login-password-input')).toHaveAttribute(
      'aria-describedby',
      'login-password-error',
    );
    expect(screen.getByTestId('login-password-input')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('login-submit')).toBeDisabled();
  });

  it('keeps registration selectors, validation, and consent in the same RHF context', async () => {
    render(<RegistrationHarness />);

    expect(screen.getByTestId('register-username-input')).toBeVisible();
    expect(screen.getByTestId('register-display-name-input')).toBeVisible();
    expect(screen.getByTestId('register-email-input')).toBeDisabled();
    expect(screen.getByTestId('register-email-code-input')).toBeDisabled();
    expect(screen.getByTestId('register-password-confirm-input')).toBeVisible();
    expect(screen.getByTestId('register-fields-grid')).toHaveClass('gap-x-5', 'gap-y-1');
    for (const errorTestId of [
      'register-username-error',
      'register-locale-error',
      'register-display-name-error',
      'register-email-error',
      'register-email-code-error',
      'login-password-error',
      'register-password-confirm-error',
    ]) {
      expect(screen.getByTestId(errorTestId)).toHaveClass('min-h-5');
      expect(screen.getByTestId(errorTestId)).toHaveAttribute('aria-hidden', 'true');
    }

    fireEvent.click(screen.getByTestId('register-privacy-consent'));
    expect(screen.getByTestId('consent-probe')).toHaveTextContent('true');

    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await waitFor(() =>
      expect(screen.getByTestId('register-username-error')).toHaveTextContent(
        'Username is required.',
      ),
    );
    expect(screen.getByTestId('register-display-name-error')).toHaveTextContent(
      'Display name is required.',
    );
    expect(screen.getByTestId('register-password-confirm-error')).toHaveTextContent(
      'Confirm your password.',
    );
    expect(screen.getByTestId('register-username-input')).toHaveAttribute(
      'aria-describedby',
      'register-username-error',
    );
    expect(screen.getByTestId('register-username-input')).toHaveAttribute('aria-invalid', 'true');
  });
});
