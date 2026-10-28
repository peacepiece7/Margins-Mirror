import { fireEvent, render } from '@testing-library/react-native';

import { WelcomeScreen } from './welcome-screen';

jest.mock('@/shared/i18n/i18n-provider', () => {
  const { messages } = jest.requireActual('@/shared/i18n/messages');
  return { useI18n: () => ({ t: (key: keyof typeof messages.en) => messages.en[key] }) };
});

it('introduces the four-step reading flow semantically and Memory Card separately', async () => {
  const screen = await render(
    <WelcomeScreen
      onLogin={jest.fn()}
      onOpenPrivacy={jest.fn()}
      onOpenTerms={jest.fn()}
      onSignUp={jest.fn()}
    />,
  );

  const steps = screen.getByTestId('product-introduction-steps');
  expect(screen.getAllByRole('header')).toHaveLength(1);
  expect(steps.props.accessibilityRole).toBe('list');
  expect(steps.children).toHaveLength(4);
  expect(screen.getByLabelText('1. Discover books and build your personal library.')).toBeTruthy();
  expect(screen.getByLabelText('4. Debate ideas through multiple reading perspectives.')).toBeTruthy();
  expect(screen.getByText('Discover books and build your personal library.')).toBeTruthy();
  expect(screen.getByText('Read more deeply with AI-guided questions.')).toBeTruthy();
  expect(screen.getByText('Save reflections and shape them into reviews.')).toBeTruthy();
  expect(screen.getByText('Debate ideas through multiple reading perspectives.')).toBeTruthy();
  expect(screen.getByTestId('memory-card-introduction')).toBeTruthy();
  expect(screen.getByText('Memory Card is a separate vocabulary tool for words you want to revisit.')).toBeTruthy();
});

// BDD: TERM-021
it('offers localized public entry actions before authentication', async () => {
  const onLogin = jest.fn();
  const onOpenPrivacy = jest.fn();
  const onOpenTerms = jest.fn();
  const onSignUp = jest.fn();
  const screen = await render(
    <WelcomeScreen
      onLogin={onLogin}
      onOpenPrivacy={onOpenPrivacy}
      onOpenTerms={onOpenTerms}
      onSignUp={onSignUp}
    />,
  );

  expect(screen.getByTestId('welcome-screen')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Create your reading room' }));
  await fireEvent.press(screen.getByRole('button', { name: 'I already have an account' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Privacy' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Service Terms' }));

  expect(onSignUp).toHaveBeenCalledTimes(1);
  expect(onLogin).toHaveBeenCalledTimes(1);
  expect(onOpenPrivacy).toHaveBeenCalledTimes(1);
  expect(onOpenTerms).toHaveBeenCalledTimes(1);
});

it('fits the complete promotion title into at most two dynamically scaled lines', async () => {
  const screen = await render(
    <WelcomeScreen
      onLogin={jest.fn()}
      onOpenPrivacy={jest.fn()}
      onOpenTerms={jest.fn()}
      onSignUp={jest.fn()}
    />,
  );

  const title = screen.getByRole('header', {
    name: 'A reading room for ideas that stay with you.',
  });
  expect(title.props).toMatchObject({
    adjustsFontSizeToFit: true,
    allowFontScaling: true,
    minimumFontScale: 0.5,
    numberOfLines: 2,
  });
});
