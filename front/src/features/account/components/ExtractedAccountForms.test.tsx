import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/lib/i18n';

import { accountApi } from '../api';
import { PasswordChangeForm } from './PasswordChangeForm';
import { ProfileForm } from './ProfileForm';
import { RecoveryForm } from './RecoveryForm';
import { ResignationForm } from './ResignationForm';

vi.mock('../api', () => ({
  accountApi: {
    changePassword: vi.fn(),
    recover: vi.fn(),
    requestRecovery: vi.fn(),
    requestResignationChallenge: vi.fn(),
    resign: vi.fn(),
    updateProfile: vi.fn(),
    verifyRecovery: vi.fn(),
    verifyResignation: vi.fn(),
  },
}));

function renderForm(element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>{element}</I18nProvider>
    </QueryClientProvider>,
  );
}

describe('extracted account forms', () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.setItem('margins.locale', 'en');
    vi.clearAllMocks();
  });

  it('resets a trimmed profile mutation result as the clean authoritative value', async () => {
    vi.mocked(accountApi.updateProfile).mockResolvedValue({
      account: {
        userId: 1,
        username: 'reader',
        displayName: 'Reader',
        email: 'reader@example.com',
        authProvider: 'local',
        accountStatus: 'ACTIVE',
        preferredLocale: 'en',
      },
    });
    renderForm(
      <ProfileForm
        account={{
          userId: 1,
          username: 'reader',
          displayName: 'Reader',
          email: 'reader@example.com',
          authProvider: 'local',
          accountStatus: 'ACTIVE',
          preferredLocale: 'en',
        }}
        onSaved={vi.fn()}
      />,
    );

    const displayName = screen.getByLabelText('Display name');
    const save = screen.getByTestId('account-profile-save');
    expect(save).toBeDisabled();
    fireEvent.change(displayName, { target: { value: ' Reader ' } });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() =>
      expect(accountApi.updateProfile).toHaveBeenCalledWith({
        displayName: 'Reader',
        preferredLocale: 'en',
      }),
    );
    expect(displayName).toHaveValue('Reader');
    expect(save).toBeDisabled();
  });

  it('blocks an invalid password mutation and associates visible field errors', async () => {
    renderForm(<PasswordChangeForm />);
    const currentPassword = screen.getByLabelText('Current password');

    fireEvent.submit(currentPassword.closest('form')!);

    expect(await screen.findAllByText('Password is required.')).toHaveLength(2);
    expect(currentPassword).toHaveAttribute('aria-invalid', 'true');
    expect(currentPassword).toHaveAttribute('aria-describedby', 'account-current-password-error');
    expect(accountApi.changePassword).not.toHaveBeenCalled();
  });

  it('announces a rejected password mutation through the form alert', async () => {
    vi.mocked(accountApi.changePassword).mockRejectedValue(new Error('server failure'));
    renderForm(<PasswordChangeForm />);
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'current-password' },
    });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'new-password-123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'new-password-123' },
    });

    fireEvent.submit(screen.getByLabelText('Current password').closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Password could not be changed.');
  });

  it('announces a rejected profile mutation through the form alert', async () => {
    vi.mocked(accountApi.updateProfile).mockRejectedValue(new Error('server failure'));
    renderForm(
      <ProfileForm
        account={{
          userId: 1,
          username: 'reader',
          displayName: 'Reader',
          email: 'reader@example.com',
          authProvider: 'local',
          accountStatus: 'ACTIVE',
          preferredLocale: 'en',
        }}
        onSaved={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Updated' } });

    fireEvent.submit(screen.getByLabelText('Display name').closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Account information could not be saved.',
    );
  });

  it('blocks an invalid recovery request and associates its email error', async () => {
    renderForm(<RecoveryForm />);
    const email = screen.getByLabelText('Registered email');

    fireEvent.submit(email.closest('form')!);

    expect(await screen.findByText('Email is required.')).toHaveAttribute(
      'id',
      'recovery-email-error',
    );
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAttribute('aria-describedby', 'recovery-email-error');
    expect(accountApi.requestRecovery).not.toHaveBeenCalled();
  });

  it('blocks resignation verification until the required code is present', async () => {
    vi.mocked(accountApi.requestResignationChallenge).mockResolvedValue({
      challengeId: 'challenge-1',
      expiresInSeconds: 300,
    });
    renderForm(<ResignationForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    const code = await screen.findByLabelText('6-digit code');

    fireEvent.submit(code.closest('form')!);

    expect(await screen.findByText('Verification code is required.')).toHaveAttribute(
      'id',
      'account-resign-code-error',
    );
    expect(code).toHaveAttribute('aria-invalid', 'true');
    expect(accountApi.verifyResignation).not.toHaveBeenCalled();
    expect(accountApi.resign).not.toHaveBeenCalled();
  });
});
