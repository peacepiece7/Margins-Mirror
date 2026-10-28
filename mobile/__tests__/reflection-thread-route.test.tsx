import { act, render } from '@testing-library/react-native';

import ReflectionThreadRoute from '@/app/(protected)/(tabs)/reflection';

const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockMutate = jest.fn();
const mockScreen = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    navigate: (...args: unknown[]) => mockNavigate(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
}));
jest.mock('@/features/reading-sessions/queries', () => ({
  useEnsureReadingSessionForBook: () => ({
    isError: false,
    isPending: false,
    mutate: (...args: unknown[]) => mockMutate(...args),
    variables: undefined,
  }),
}));
jest.mock('@/features/reflections/thread-screen', () => ({
  ReflectionThreadScreen: (props: unknown) => {
    mockScreen(props);
    return null;
  },
}));

beforeEach(() => jest.clearAllMocks());

// BDD: SESSION-006
// BDD: MOBILE-017
it.each([
  [{ bookId: 7, kind: 'reflection', sessionId: 10 }, '/books/7/reflection?sessionId=10'],
  [{ bookId: 7, interviewId: 30, kind: 'interview', sessionId: 10 }, '/books/7/reflection/interview?sessionId=10&interviewId=30'],
  [{ bookId: 7, guideId: 40, kind: 'guide' }, '/books/7/reflection/guide/40'],
  [{ bookId: 7, kind: 'discuss', runId: 50 }, '/books/7/reflection/discuss/50'],
  [{ bookId: 7, kind: 'refine', runId: 50 }, '/books/7/reflection/refine/50'],
])('opens the exact persisted workflow target %#', async (target, destination) => {
  await render(<ReflectionThreadRoute />);
  const props = mockScreen.mock.calls[0][0] as {
    onOpenThread(thread: { bookId: number; bookTitle: string }, value: unknown): void;
  };
  await act(async () => props.onOpenThread({ bookId: 7, bookTitle: 'Book' }, target));
  expect(mockPush).toHaveBeenCalledWith(destination);
});

it('ensures a session without creating a window before opening the reflection editor', async () => {
  mockMutate.mockImplementation((_variables, options) => {
    options.onSuccess({ sessionId: 99, title: 'Book 7 reflection' });
  });
  await render(<ReflectionThreadRoute />);
  const props = mockScreen.mock.calls[0][0] as {
    onOpenThread(thread: { bookId: number; bookTitle: string }, value: unknown): void;
  };
  await act(async () => props.onOpenThread(
    { bookId: 7, bookTitle: 'Book' },
    { bookId: 7, kind: 'record' },
  ));
  expect(mockMutate).toHaveBeenCalledWith(
    7,
    expect.objectContaining({ onSuccess: expect.any(Function) }),
  );
  expect(mockPush).toHaveBeenCalledWith('/books/7/reflection?sessionId=99');
});
