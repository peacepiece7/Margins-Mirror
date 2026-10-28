import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AiProcessingNotice } from './ai-processing-notice';
import {
  dismissAiNoticeForSevenDays,
  isAiNoticeDismissed,
  resetAiNoticeDismissal,
} from './dismissible-notice';

jest.mock('@/shared/i18n/i18n-provider', () => ({
  useI18n: () => {
    const { messages } = jest.requireActual<typeof import('@/shared/i18n/messages')>('@/shared/i18n/messages');
    return { t: (key: keyof typeof messages.en) => messages.en[key] };
  },
}));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

// BDD: DS-014 when-1/then-1/then-3
it('closes only the current notice while preserving privacy and accessible close actions', async () => {
  const onOpenPrivacy = jest.fn();
  const view = await render(<AiProcessingNotice onOpenPrivacy={onOpenPrivacy} />);
  await waitFor(() => expect(view.getByTestId('ai-processing-notice')).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: 'Privacy' }));
  expect(onOpenPrivacy).toHaveBeenCalledTimes(1);
  await fireEvent.press(view.getByLabelText('Close AI processing notice'));
  expect(view.queryByTestId('ai-processing-notice')).toBeNull();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

// BDD: DS-014 when-2/then-2/then-3
it('persists an anonymous seven-day dismissal only after the reader selects it', async () => {
  const now = 10_000;
  await dismissAiNoticeForSevenDays(now);
  expect(await isAiNoticeDismissed(now + 1)).toBe(true);
  expect(await isAiNoticeDismissed(now + 7 * 24 * 60 * 60 * 1_000 + 1)).toBe(false);
  await resetAiNoticeDismissal();
  expect(await isAiNoticeDismissed(now)).toBe(false);
});

it('writes the seven-day preference from the notice checkbox before closing', async () => {
  const view = await render(<AiProcessingNotice onOpenPrivacy={jest.fn()} />);
  await waitFor(() => expect(view.getByTestId('ai-processing-notice')).toBeTruthy());
  await fireEvent.press(view.getByRole('checkbox', { name: 'Do not show again for seven days' }));
  await fireEvent.press(view.getByLabelText('Close AI processing notice'));
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1));
});

it('still dismisses the current notice when preference storage is unavailable', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('storage unavailable'));
  const view = await render(<AiProcessingNotice onOpenPrivacy={jest.fn()} />);
  await waitFor(() => expect(view.getByTestId('ai-processing-notice')).toBeTruthy());
  await fireEvent.press(view.getByRole('checkbox', { name: 'Do not show again for seven days' }));
  await fireEvent.press(view.getByLabelText('Close AI processing notice'));
  await waitFor(() => expect(view.queryByTestId('ai-processing-notice')).toBeNull());
});
