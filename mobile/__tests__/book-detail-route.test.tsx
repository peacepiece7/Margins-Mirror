import { fireEvent, render } from '@testing-library/react-native';

import { ResolvedBookDetailRoute } from '@/app/(protected)/books/[bookId]';
import { useBookReadingSession } from '@/features/reading-sessions/queries';

const mockRefetch = jest.fn();
const mockBookDetailScreen = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('@/shared/i18n/i18n-provider', () => ({
  useI18n: () => {
    const { messages } = jest.requireActual<typeof import('@/shared/i18n/messages')>('@/shared/i18n/messages');
    return { t: (key: keyof typeof messages.en) => messages.en[key] };
  },
}));
jest.mock('@/features/books/book-detail-screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    BookDetailScreen: (props: {
      onRetryWorkflow?(): void;
      workflowAvailable?: boolean;
      workflowError?: boolean;
    }) => {
      mockBookDetailScreen(props);
      return React.createElement(
        View,
        null,
        React.createElement(Text, null, props.workflowError ? 'workflow-error' : 'workflow-ready'),
        React.createElement(
          Pressable,
          { accessibilityRole: 'button', onPress: props.onRetryWorkflow },
          React.createElement(Text, null, 'retry-workflow'),
        ),
      );
    },
  };
});
jest.mock('@/features/reading-sessions/queries', () => ({
  useBookReadingSession: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBookReadingSession).mockReturnValue({
    data: undefined,
    isError: true,
    isLoading: false,
    refetch: mockRefetch,
  } as unknown as ReturnType<typeof useBookReadingSession>);
});

it('keeps normal Book Detail mounted with a retryable session-locator error', async () => {
  const view = await render(<ResolvedBookDetailRoute bookId={4} />);

  expect(view.getByText('workflow-error')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'retry-workflow' }));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

it('treats a successful empty locator as no session rather than a workflow error', async () => {
  jest.mocked(useBookReadingSession).mockReturnValue({
    data: null,
    isError: false,
    isLoading: false,
    refetch: mockRefetch,
  } as unknown as ReturnType<typeof useBookReadingSession>);

  const view = await render(<ResolvedBookDetailRoute bookId={4} />);

  expect(view.getByText('workflow-ready')).toBeTruthy();
  expect(mockBookDetailScreen).toHaveBeenCalledWith(expect.objectContaining({
    workflowAvailable: false,
    workflowError: false,
  }));
});

it('renders a retry action instead of session-unavailable for reflection intent network failure', async () => {
  const view = await render(<ResolvedBookDetailRoute bookId={4} intent="reflection" />);

  expect(view.getByText('Something went wrong. Please try again.')).toBeTruthy();
  expect(view.queryByText('A reading session is not available for this book yet.')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  expect(mockBookDetailScreen).not.toHaveBeenCalled();
});

it('renders session-unavailable only after a successful empty reflection-intent locator', async () => {
  jest.mocked(useBookReadingSession).mockReturnValue({
    data: null,
    isError: false,
    isLoading: false,
    refetch: mockRefetch,
  } as unknown as ReturnType<typeof useBookReadingSession>);

  const view = await render(<ResolvedBookDetailRoute bookId={4} intent="reflection" />);

  expect(view.getByText('A reading session is not available for this book yet.')).toBeTruthy();
  expect(view.queryByText('Something went wrong. Please try again.')).toBeNull();
});
