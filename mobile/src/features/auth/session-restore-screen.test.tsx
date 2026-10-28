import { act, fireEvent, render } from '@testing-library/react-native';

import { SessionRestoreScreen } from './session-restore-screen';

const mockLogout = jest.fn();
const mockRetryRestore = jest.fn();

jest.mock('@/shared/i18n/i18n-provider', () => {
  const { messages } = jest.requireActual('@/shared/i18n/messages');
  return { useI18n: () => ({ t: (key: keyof typeof messages.en) => messages.en[key] }) };
});

jest.mock('./session-provider', () => ({
  useAuthSession: () => ({
    logout: mockLogout,
    retryRestore: mockRetryRestore,
  }),
}));

beforeEach(() => {
  mockLogout.mockReset().mockResolvedValue(undefined);
  mockRetryRestore.mockReset().mockResolvedValue(undefined);
});

it('lets the user retry without removing the saved credential', async () => {
  const screen = await render(<SessionRestoreScreen />);

  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Retry session restore' }));
  });

  expect(mockRetryRestore).toHaveBeenCalledTimes(1);
  expect(mockLogout).not.toHaveBeenCalled();
});

it('lets the user clear the saved credential and return to login', async () => {
  const screen = await render(<SessionRestoreScreen />);

  await act(async () => {
    fireEvent.press(
      screen.getByRole('button', { name: 'Clear saved sign-in and continue' }),
    );
  });

  expect(mockLogout).toHaveBeenCalledTimes(1);
  expect(mockRetryRestore).not.toHaveBeenCalled();
});
