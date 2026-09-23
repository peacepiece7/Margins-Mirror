import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ResolvedDebatesRoute } from '@/app/(protected)/books/[bookId]/debates';
import { useBookQuery } from '@/features/books/queries';
import { useCreateDebateWindow } from '@/features/debates/queries';
import {
  useBookReadingSession,
  useEnsureReadingSessionForBook,
} from '@/features/reading-sessions/queries';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockEnsure = jest.fn();
const mockCreateRoom = jest.fn();
const mockSessionRefetch = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: () => false,
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('@/shared/i18n/i18n-provider', () => ({ useI18n: () => ({ locale: 'ko' }) }));
jest.mock('@/features/debates/screens', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    DebateRoomsScreen: (props: {
      createRoomError: boolean;
      onBack(): void;
      onCreateRoom(input: { personaIds: number[]; topic: string }): void;
      sessionId?: number;
    }) => React.createElement(View, null,
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          onPress: () => props.onCreateRoom({ personaIds: [4], topic: '권력과 예언' }),
          testID: 'debate-rooms',
        },
        React.createElement(Text, null, `${props.sessionId ?? 'none'}:${props.createRoomError}`),
      ),
      React.createElement(Pressable, { onPress: props.onBack, testID: 'debate-back' }),
    ),
  };
});
jest.mock('@/features/books/queries', () => ({ useBookQuery: jest.fn() }));
jest.mock('@/features/debates/queries', () => ({ useCreateDebateWindow: jest.fn() }));
jest.mock('@/features/reading-sessions/queries', () => ({
  useBookReadingSession: jest.fn(),
  useEnsureReadingSessionForBook: jest.fn(),
}));

const bookQuery = {
  data: { author: 'Frank Herbert', bookId: 4, title: 'Dune' } as { author: string; bookId: number; title: string } | undefined,
  isError: false,
  isLoading: false,
  refetch: jest.fn(),
};
const sessionQuery = {
  data: { sessionId: 9, title: 'Dune reflection' } as { sessionId: number; title: string } | null,
  isError: false,
  isLoading: false,
  refetch: mockSessionRefetch,
};
const ensureMutation = {
  data: undefined as { sessionId: number; title: string } | undefined,
  isError: false,
  isPending: false,
  mutateAsync: mockEnsure,
  variables: undefined as number | undefined,
};
const createMutation = {
  isError: false,
  isPending: false,
  mutateAsync: mockCreateRoom,
};

beforeEach(() => {
  jest.clearAllMocks();
  bookQuery.data = { author: 'Frank Herbert', bookId: 4, title: 'Dune' };
  bookQuery.isError = false;
  sessionQuery.data = { sessionId: 9, title: 'Dune reflection' };
  sessionQuery.isError = false;
  ensureMutation.data = undefined;
  ensureMutation.isError = false;
  ensureMutation.variables = undefined;
  createMutation.isError = false;
  mockEnsure.mockResolvedValue({ sessionId: 12, title: 'Book 4 reflection' });
  mockCreateRoom.mockResolvedValue({ sessionId: 9, windowId: 21 });
  jest.mocked(useBookQuery).mockReturnValue(bookQuery as unknown as ReturnType<typeof useBookQuery>);
  jest.mocked(useBookReadingSession).mockReturnValue(sessionQuery as unknown as ReturnType<typeof useBookReadingSession>);
  jest.mocked(useEnsureReadingSessionForBook).mockReturnValue(ensureMutation as unknown as ReturnType<typeof useEnsureReadingSessionForBook>);
  jest.mocked(useCreateDebateWindow).mockReturnValue(createMutation as unknown as ReturnType<typeof useCreateDebateWindow>);
});

const routeProps = {
  bookId: 4,
  recommendedPersonaKeys: [],
};

// BDD: SESSION-006, DEBATE-021, MOBILE-019
// BDD: FRONT-039
// BDD: FRONT-046
it('does not mutate anything merely by opening Debate', async () => {
  const view = await render(<ResolvedDebatesRoute {...routeProps} />);

  expect(view.getByTestId('debate-rooms')).toHaveTextContent('9:false');
  expect(mockEnsure).not.toHaveBeenCalled();
  expect(mockCreateRoom).not.toHaveBeenCalled();
});

it('falls back to the selected book when Debate was opened as a direct link', async () => {
  const view = await render(<ResolvedDebatesRoute {...routeProps} />);

  await fireEvent.press(view.getByTestId('debate-back'));

  expect(mockReplace).toHaveBeenCalledWith('/books/4');
});

// BDD: DEBATE-021, MOBILE-019
it('creates a Debate window once and opens the exact response window', async () => {
  const view = await render(<ResolvedDebatesRoute {...routeProps} />);

  await fireEvent.press(view.getByTestId('debate-rooms'));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/books/4/debates/21'));

  expect(mockEnsure).not.toHaveBeenCalled();
  expect(mockCreateRoom).toHaveBeenCalledWith({
    personaIds: [4],
    sessionId: 9,
    title: 'Debate: 권력과 예언',
  });
});

// BDD: SESSION-006
// BDD: FRONT-039
it('ensures only a session after explicit creation, then creates the Debate window', async () => {
  sessionQuery.data = null;
  mockCreateRoom.mockResolvedValue({ sessionId: 12, windowId: 22 });
  const view = await render(<ResolvedDebatesRoute {...routeProps} />);

  expect(view.getByTestId('debate-rooms')).toHaveTextContent('none:false');
  expect(mockEnsure).not.toHaveBeenCalled();
  await fireEvent.press(view.getByTestId('debate-rooms'));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/books/4/debates/22'));

  expect(mockEnsure).toHaveBeenCalledWith(4);
  expect(mockCreateRoom).toHaveBeenCalledWith({
    personaIds: [4],
    sessionId: 12,
    title: 'Debate: 권력과 예언',
  });
  expect(mockEnsure.mock.invocationCallOrder[0]).toBeLessThan(
    mockCreateRoom.mock.invocationCallOrder[0],
  );
});

it('does not create or navigate when the session ensure fails', async () => {
  sessionQuery.data = null;
  mockEnsure.mockRejectedValue(new Error('session unavailable'));
  const view = await render(<ResolvedDebatesRoute {...routeProps} />);

  await fireEvent.press(view.getByTestId('debate-rooms'));
  await waitFor(() => expect(mockEnsure).toHaveBeenCalledWith(4));

  expect(mockCreateRoom).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

it('reuses the ensured session when Debate window creation is retried', async () => {
  sessionQuery.data = null;
  mockCreateRoom.mockRejectedValueOnce(new Error('window unavailable'));
  const view = await render(<ResolvedDebatesRoute {...routeProps} />);

  await fireEvent.press(view.getByTestId('debate-rooms'));
  await waitFor(() => expect(mockCreateRoom).toHaveBeenCalledTimes(1));

  ensureMutation.data = { sessionId: 12, title: 'Book 4 reflection' };
  ensureMutation.variables = 4;
  mockCreateRoom.mockResolvedValueOnce({ sessionId: 12, windowId: 23 });
  await view.rerender(<ResolvedDebatesRoute {...routeProps} />);
  await fireEvent.press(view.getByTestId('debate-rooms'));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/books/4/debates/23'));

  expect(mockEnsure).toHaveBeenCalledTimes(1);
  expect(mockCreateRoom).toHaveBeenCalledTimes(2);
});

it('ignores an ensured session cached for a different book', async () => {
  sessionQuery.data = null;
  ensureMutation.data = { sessionId: 88, title: 'Another book' };
  ensureMutation.variables = 99;
  mockCreateRoom.mockResolvedValue({ sessionId: 12, windowId: 24 });
  const view = await render(<ResolvedDebatesRoute {...routeProps} />);

  expect(view.getByTestId('debate-rooms')).toHaveTextContent('none:false');
  await fireEvent.press(view.getByTestId('debate-rooms'));
  await waitFor(() => expect(mockEnsure).toHaveBeenCalledWith(4));
  expect(mockCreateRoom).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 12 }));
});

it('shows a retryable load error when the selected book collection fails', async () => {
  bookQuery.data = undefined;
  bookQuery.isError = true;
  const view = await render(<ResolvedDebatesRoute {...routeProps} />);

  expect(view.getByText('토론방을 불러오지 못했습니다.')).toBeTruthy();
  expect(view.queryByText('토론방을 찾을 수 없습니다.')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: '다시 시도' }));
  expect(bookQuery.refetch).toHaveBeenCalledTimes(1);
});
