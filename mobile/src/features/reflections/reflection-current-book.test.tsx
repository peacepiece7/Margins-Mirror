import { render } from '@testing-library/react-native';

import { ApiRequestError } from '@/shared/api/error';

import { ReflectionScreen } from './screens';

let mockAuthorityBookId = 2;
const mockNotFoundError = new ApiRequestError({ code: 'COMMON_NOT_FOUND', status: 404 });

jest.mock('@/shared/i18n/i18n-provider', () => ({
  useI18n: () => ({ locale: 'en' }),
}));
jest.mock('./queries', () => ({
  useCreateQuestionWindow: () => ({ isError: false, isPending: false, mutate: jest.fn() }),
  useGenerateQuestions: () => ({ isError: false, isPending: false, mutate: jest.fn() }),
  useReflectionRouteAuthority: (_sessionId: number, enabled: boolean) => ({
    data: enabled ? { bookId: mockAuthorityBookId, sessionId: 3 } : undefined,
    isError: false,
    isLoading: false,
  }),
  useReflectionTimeline: (_sessionId: number, enabled = true) => ({
    data: enabled ? {
      bookAuthor: 'Frank Herbert',
      bookId: 2,
      bookTitle: 'Dune',
      insights: [],
      messages: [],
      moderationEvents: [],
      questions: [],
      sessionId: 3,
      windows: [],
    } : undefined,
    isError: false,
    isLoading: false,
  }),
  useSaveAnswer: () => ({ isError: false, isPending: false, mutate: jest.fn() }),
  useSaveReflection: () => ({ isError: false, isPending: false, mutate: jest.fn() }),
  useSessionReflection: () => ({
    data: undefined,
    error: mockNotFoundError,
    isError: true,
    isLoading: false,
  }),
  useStartInterview: () => ({ isError: false, isPending: false, mutate: jest.fn() }),
}));

beforeEach(() => {
  mockAuthorityBookId = 2;
});

it('keeps app-composed current book identity visible above the reflection workflow', async () => {
  const screen = await render(
    <ReflectionScreen
      bookAuthor="Frank Herbert"
      bookId={2}
      bookTitle="Dune"
      onWorkflow={jest.fn()}
      sessionId={3}
    />,
  );

  expect(screen.getByTestId('reflection-current-book')).toHaveProp(
    'accessibilityLabel',
    'Current book: Dune, Frank Herbert',
  );
  expect(screen.getByText('Dune · Frank Herbert')).toBeTruthy();
});

it('rejects a lightweight session authority owned by a different route book before rendering editor actions', async () => {
  mockAuthorityBookId = 99;
  const screen = await render(
    <ReflectionScreen
      bookAuthor="Frank Herbert"
      bookId={2}
      bookTitle="Dune"
      onWorkflow={jest.fn()}
      sessionId={3}
    />,
  );

  expect(screen.getByText('This reflection workflow was not found for this book.')).toBeTruthy();
  expect(screen.queryByTestId('reflection-current-book')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Save reflection' })).toBeNull();
});
