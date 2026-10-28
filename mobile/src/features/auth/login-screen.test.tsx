import { render } from '@testing-library/react-native';

import { LoginScreen } from './login-screen';

const mockLogin = jest.fn();
const mockLoginWithGoogle = jest.fn();

jest.mock('./session-provider', () => ({
  useAuthSession: () => ({
    authAttemptActive: true,
    login: mockLogin,
    loginWithGoogle: mockLoginWithGoogle,
  }),
}));
jest.mock('@/shared/i18n/i18n-provider', () => {
  const { messages } = jest.requireActual('@/shared/i18n/messages');
  const t = (key: keyof typeof messages.en) => messages.en[key];
  return { useI18n: () => ({ locale: 'en', t }) };
});

// BDD: TERM-021
it('disables local and Google login actions while an auth attempt owns the session commit', async () => {
  const screen = await render(
    <LoginScreen
      onGoogleRegistration={jest.fn()}
      onOpenPrivacy={jest.fn()}
      onOpenTerms={jest.fn()}
      onRecovery={jest.fn()}
      onSignUp={jest.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'Log in' }).props.accessibilityState)
    .toMatchObject({ disabled: true });
  expect(
    screen.getByRole('button', { name: 'Continue with Google' }).props.accessibilityState,
  ).toMatchObject({ disabled: true });
  expect(screen.getByRole('button', { name: 'Service Terms' })).toBeTruthy();
});

// BDD: AUTH-002 then-4
it('shows a Google mark while keeping a useful accessible login name', async () => {
  const screen = await render(
    <LoginScreen
      onGoogleRegistration={jest.fn()}
      onOpenPrivacy={jest.fn()}
      onOpenTerms={jest.fn()}
      onRecovery={jest.fn()}
      onSignUp={jest.fn()}
    />,
  );

  expect(screen.getByText('G', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
});
