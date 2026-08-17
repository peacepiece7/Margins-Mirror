import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

    const username = screen.getByTestId('login-username-input');
    fireEvent.change(username, { target: { value: 'reader' } });
    expect(screen.getByTestId('username-probe')).toHaveTextContent('reader');

    fireEvent.blur(screen.getByTestId('login-password-input'));
    expect(await screen.findByTestId('login-password-error')).toHaveTextContent(
      'Password is required.',
    );
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

    fireEvent.click(screen.getByTestId('register-privacy-consent'));
    expect(screen.getByTestId('consent-probe')).toHaveTextContent('true');

    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    expect(await screen.findByTestId('register-username-error')).toHaveTextContent(
      'Username is required.',
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
