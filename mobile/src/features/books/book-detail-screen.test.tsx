import { fireEvent, render, waitFor, within } from '@testing-library/react-native';

import { ApiRequestError } from '@/shared/api/error';
import { BookDetailScreen } from './book-detail-screen';
import {
  useBookKnowledgeQuery,
  useBookQuery,
  useDeleteBookMutation,
  useRegenerateBookKnowledgeMutation,
  useUpdateBookMutation,
  useUpdateBookShelfMutation,
} from './queries';

let mockLocale: 'en' | 'ko' = 'en';

jest.mock('@/shared/i18n/i18n-provider', () => ({
  useI18n: () => {
    const { messages } = jest.requireActual<typeof import('@/shared/i18n/messages')>('@/shared/i18n/messages');
    return { locale: mockLocale, t: (key: keyof typeof messages.en) => messages[mockLocale][key] };
  },
}));
jest.mock('expo-symbols', () => ({
  SymbolView: ({ fallback }: { fallback?: React.ReactNode }) => fallback ?? null,
}));
jest.mock('./queries', () => ({
  useBookKnowledgeQuery: jest.fn(),
  useBookQuery: jest.fn(),
  useDeleteBookMutation: jest.fn(),
  useRegenerateBookKnowledgeMutation: jest.fn(),
  useUpdateBookMutation: jest.fn(),
  useUpdateBookShelfMutation: jest.fn(),
}));

function mutation() {
  return {
    isError: false,
    isPending: false,
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    variables: undefined,
  };
}

const updateBook = mutation();
const updateShelf = mutation();
const refetchBook = jest.fn();
const refetchKnowledge = jest.fn();

beforeEach(() => {
  mockLocale = 'en';
  jest.mocked(useBookQuery).mockReturnValue({
    data: { author: 'Old author', bookId: 4, rating: 3.5, readingStatus: 'reading', title: 'Old title' },
    isError: false,
    isLoading: false,
    refetch: refetchBook,
  } as unknown as ReturnType<typeof useBookQuery>);
  jest.mocked(useBookKnowledgeQuery).mockReturnValue({
    data: undefined,
    error: null,
    isError: false,
    isLoading: false,
    refetch: refetchKnowledge,
  } as unknown as ReturnType<typeof useBookKnowledgeQuery>);
  jest.mocked(useDeleteBookMutation).mockReturnValue(mutation() as unknown as ReturnType<typeof useDeleteBookMutation>);
  jest.mocked(useRegenerateBookKnowledgeMutation).mockReturnValue(mutation() as unknown as ReturnType<typeof useRegenerateBookKnowledgeMutation>);
  jest.mocked(useUpdateBookMutation).mockReturnValue(updateBook as unknown as ReturnType<typeof useUpdateBookMutation>);
  jest.mocked(useUpdateBookShelfMutation).mockReturnValue(updateShelf as unknown as ReturnType<typeof useUpdateBookShelfMutation>);
  updateBook.mutate.mockClear();
  updateShelf.mutate.mockClear();
  refetchBook.mockClear();
  refetchKnowledge.mockClear();
});

// BDD: FRONT-031
it('BDD: FRONT-029/031 shows current-book metadata and direct reflection, question, and debate actions', async () => {
  const onOpenDebates = jest.fn();
  const onOpenQuestions = jest.fn();
  const onOpenReflection = jest.fn();
  jest.mocked(useBookQuery).mockReturnValue({
    data: {
      author: 'Frank Herbert',
      bookId: 4,
      coverImageUrl: 'https://example.test/dune.jpg',
      isbn: '9780441172719',
      language: 'en',
      publishedYear: 1965,
      publisher: 'Chilton Books',
      subtitle: 'A Novel',
      title: 'Dune',
    },
    isError: false,
    isLoading: false,
    refetch: refetchBook,
  } as unknown as ReturnType<typeof useBookQuery>);

  const view = await render(
    <BookDetailScreen
      bookId={4}
      onDeleted={jest.fn()}
      onOpenDebates={onOpenDebates}
      onOpenQuestions={onOpenQuestions}
      onOpenReading={jest.fn()}
      onOpenReflection={onOpenReflection}
    />,
  );

  expect(view.getByTestId('current-book-cover')).toBeTruthy();
  expect(view.getByText('A Novel')).toBeTruthy();
  const metadata = view.getByTestId('book-metadata');
  expect(within(metadata).getByText('Bibliographic')).toBeTruthy();
  expect(within(metadata).getByText('Published')).toBeTruthy();
  expect(within(metadata).getByText('1965')).toBeTruthy();
  expect(within(metadata).getByText('Publisher')).toBeTruthy();
  expect(within(metadata).getByText('Chilton Books')).toBeTruthy();
  expect(within(metadata).getByText('Language')).toBeTruthy();
  expect(within(metadata).getByText('en')).toBeTruthy();
  expect(within(metadata).getByText('ISBN')).toBeTruthy();
  expect(within(metadata).getByText('9780441172719')).toBeTruthy();
  await fireEvent.press(view.getByTestId('open-book-reflection'));
  await fireEvent.press(view.getByTestId('open-book-questions'));
  await fireEvent.press(view.getByTestId('open-book-debates'));
  expect(onOpenReflection).toHaveBeenCalledTimes(1);
  expect(onOpenQuestions).toHaveBeenCalledTimes(1);
  expect(onOpenDebates).toHaveBeenCalledTimes(1);
});

it('keeps Debate selectable before a reading session exists because the Debate route creates it', async () => {
  const onOpenDebates = jest.fn();
  const view = await render(
    <BookDetailScreen
      bookId={4}
      debateAvailable
      onDeleted={jest.fn()}
      onOpenDebates={onOpenDebates}
      onOpenQuestions={jest.fn()}
      onOpenReading={jest.fn()}
      onOpenReflection={jest.fn()}
      workflowAvailable={false}
    />,
  );

  expect(view.getByTestId('open-book-reflection').props.accessibilityState.disabled).toBe(true);
  expect(view.getByTestId('open-book-questions').props.accessibilityState.disabled).toBe(true);
  expect(view.getByTestId('open-book-debates').props.accessibilityState.disabled).toBe(false);
  expect(view.getByText('A reading session is not available for this book yet.')).toBeTruthy();
  await fireEvent.press(view.getByTestId('open-book-debates'));
  expect(onOpenDebates).toHaveBeenCalledTimes(1);
});

it('keeps Book Detail visible and offers reading-workflow retry after a session locator failure', async () => {
  const onRetryWorkflow = jest.fn();
  const view = await render(
    <BookDetailScreen
      bookId={4}
      onDeleted={jest.fn()}
      onOpenQuestions={jest.fn()}
      onOpenReading={jest.fn()}
      onOpenReflection={jest.fn()}
      onRetryWorkflow={onRetryWorkflow}
      workflowAvailable={false}
      workflowError
    />,
  );

  expect(view.getByTestId('book-detail-screen')).toBeTruthy();
  expect(view.getByText('Old title')).toBeTruthy();
  expect(view.getByText('Something went wrong. Please try again.')).toBeTruthy();
  expect(view.queryByText('A reading session is not available for this book yet.')).toBeNull();
  expect(view.getByTestId('open-book-reflection').props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(view.getByTestId('book-workflow-retry'));
  expect(onRetryWorkflow).toHaveBeenCalledTimes(1);
});

it('BDD: FRONT-164 clips a 3.5 rating to one exact half-width final fill', async () => {
  const view = await render(
    <BookDetailScreen bookId={4} onDeleted={jest.fn()} onOpenReading={jest.fn()} />,
  );
  const halfStar = view.getByTestId('rating-star-half', { includeHiddenElements: true });
  const clippedFill = view.getByTestId('rating-star-half-fill', { includeHiddenElements: true });
  expect(halfStar).toBeTruthy();
  expect(view.getAllByTestId('rating-star-full', { includeHiddenElements: true })).toHaveLength(3);
  expect(view.getAllByTestId('rating-star-empty', { includeHiddenElements: true })).toHaveLength(1);
  expect(clippedFill.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: 11 })]));
});

it('edits title and author using the existing book patch contract', async () => {
  const view = await render(<BookDetailScreen bookId={4} onDeleted={jest.fn()} onOpenReading={jest.fn()} />);
  await fireEvent.changeText(view.getByLabelText('Book title'), 'New title');
  await fireEvent.changeText(view.getByLabelText('Author'), 'New author');
  await fireEvent.press(view.getByText('Save changes'));
  expect(updateBook.mutate).toHaveBeenCalledWith({ author: 'New author', bookId: 4, title: 'New title' });
});

it('sets half-step ratings by pressing a star and clears with the icon control', async () => {
  const view = await render(<BookDetailScreen bookId={4} onDeleted={jest.fn()} onOpenReading={jest.fn()} />);
  expect(view.queryByText('4.5')).toBeNull();
  await fireEvent.press(
    view.getByTestId('rating-star-5', { includeHiddenElements: true }),
    { nativeEvent: { locationX: 0 } },
  );
  await fireEvent.press(view.getByLabelText('Clear rating'));
  expect(updateShelf.mutate).toHaveBeenNthCalledWith(1, { bookId: 4, shelf: { rating: 4.5 } });
  expect(updateShelf.mutate).toHaveBeenNthCalledWith(2, { bookId: 4, shelf: { clearRating: true } });
});

it('uses icon-only reading states while keeping localized radio semantics', async () => {
  const view = await render(<BookDetailScreen bookId={4} onDeleted={jest.fn()} onOpenReading={jest.fn()} />);

  expect(view.queryByText('Want to read')).toBeNull();
  expect(view.queryByText('Reading')).toBeNull();
  expect(view.queryByText('Read')).toBeNull();
  expect(view.queryByText('Did not finish')).toBeNull();
  expect(view.getByRole('radio', { name: 'Reading' }).props.accessibilityState.checked).toBe(true);

  await fireEvent.press(view.getByRole('radio', { name: 'Read' }));
  expect(updateShelf.mutate).toHaveBeenCalledWith({ bookId: 4, shelf: { readingStatus: 'read' } });
});

it('keeps a retryable load failure distinct from an absent library book', async () => {
  jest.mocked(useBookQuery).mockReturnValue({
    data: undefined,
    isError: true,
    isLoading: false,
    refetch: refetchBook,
  } as unknown as ReturnType<typeof useBookQuery>);

  const view = await render(
    <BookDetailScreen bookId={4} onDeleted={jest.fn()} onOpenReading={jest.fn()} />,
  );

  expect(view.getByText('Something went wrong. Please try again.')).toBeTruthy();
  expect(view.queryByText('This book is not available in your library.')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
  expect(refetchBook).toHaveBeenCalledTimes(1);
});

it('keeps a retryable Book Knowledge failure distinct from authoritative absence', async () => {
  jest.mocked(useBookKnowledgeQuery).mockReturnValue({
    data: undefined,
    error: new ApiRequestError({ code: 'COMMON_INTERNAL_ERROR', status: 503 }),
    isError: true,
    isLoading: false,
    refetch: refetchKnowledge,
  } as unknown as ReturnType<typeof useBookKnowledgeQuery>);

  const view = await render(
    <BookDetailScreen bookId={4} onDeleted={jest.fn()} onOpenReading={jest.fn()} />,
  );

  expect(view.getByText('Something went wrong. Please try again.')).toBeTruthy();
  expect(view.queryByText('Book knowledge is not ready yet.')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
  expect(refetchKnowledge).toHaveBeenCalledTimes(1);
});

it('offers generation only when Book Knowledge is authoritatively absent', async () => {
  jest.mocked(useBookKnowledgeQuery).mockReturnValue({
    data: undefined,
    error: new ApiRequestError({ code: 'COMMON_NOT_FOUND', status: 404 }),
    isError: true,
    isLoading: false,
    refetch: refetchKnowledge,
  } as unknown as ReturnType<typeof useBookKnowledgeQuery>);

  const view = await render(
    <BookDetailScreen bookId={4} onDeleted={jest.fn()} onOpenReading={jest.fn()} />,
  );

  expect(view.getByText('Book knowledge is not ready yet.')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Generate book knowledge' })).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Try again' })).toBeNull();
});

it('keeps cached Book Knowledge visible while exposing its failed refresh', async () => {
  jest.mocked(useBookKnowledgeQuery).mockReturnValue({
    data: {
      discussionPoints: [],
      famousQuotes: [],
      keywords: [],
      knowledgeId: 9,
      recommendedPersonas: [],
      status: 'ready',
      themes: [],
      title: 'Old title',
      version: 'book-knowledge-v2',
    },
    error: new ApiRequestError({ code: 'COMMON_INTERNAL_ERROR', status: 503 }),
    isError: true,
    isLoading: false,
    refetch: refetchKnowledge,
  } as unknown as ReturnType<typeof useBookKnowledgeQuery>);

  const view = await render(
    <BookDetailScreen bookId={4} onDeleted={jest.fn()} onOpenReading={jest.fn()} />,
  );

  expect(view.getByText('Knowledge version: book-knowledge-v2')).toBeTruthy();
  expect(view.getByText('Something went wrong. Please try again.')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
  expect(refetchKnowledge).toHaveBeenCalledTimes(1);
});

it('treats a null API rating as unrated and localizes the Korean cover label', async () => {
  mockLocale = 'ko';
  jest.mocked(useBookQuery).mockReturnValue({
    data: {
      author: '프랭크 허버트',
      bookId: 4,
      coverImageUrl: 'https://example.test/dune.jpg',
      rating: null,
      title: '듄',
    },
    isError: false,
    isLoading: false,
    refetch: refetchBook,
  } as unknown as ReturnType<typeof useBookQuery>);

  const view = await render(
    <BookDetailScreen bookId={4} onDeleted={jest.fn()} onOpenReading={jest.fn()} />,
  );

  expect(view.getByLabelText('듄 표지')).toBeTruthy();
  expect(view.queryByLabelText('듄 cover')).toBeNull();
  expect(view.getByTestId('rating-clear')).toHaveProp('accessibilityState', {
    disabled: true,
  });
});

it('BDD: BOOK-009 then-3 distinguishes stale cache from fallback knowledge and shows its version', async () => {
  jest.mocked(useBookKnowledgeQuery).mockReturnValue({
    data: {
      discussionPoints: [],
      fallbackUsed: true,
      famousQuotes: [],
      keywords: [],
      knowledgeId: 9,
      recommendedPersonas: [],
      refreshPending: true,
      stale: true,
      status: 'ready',
      themes: [],
      title: 'Old title',
      version: 'book-knowledge-v1',
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useBookKnowledgeQuery>);

  const view = await render(
    <BookDetailScreen bookId={4} onDeleted={jest.fn()} onOpenReading={jest.fn()} />,
  );

  expect(view.getByText('Knowledge version: book-knowledge-v1')).toBeTruthy();
  expect(view.getByText('Cached knowledge is out of date.')).toBeTruthy();
  expect(view.getByText('Temporary fallback knowledge is in use.')).toBeTruthy();
  expect(view.getByText('A newer knowledge version is being prepared.')).toBeTruthy();
});

// BDD: DS-004 then-1/then-2
it('keeps failed book deletion confirmation retryable and prevents duplicate pending deletion', async () => {
  let rejectDelete!: (error: Error) => void;
  const pendingDelete = new Promise<never>((_, reject) => {
    rejectDelete = reject;
  });
  const deleteMutation = {
    ...mutation(),
    isError: true,
    mutateAsync: jest.fn(() => pendingDelete),
  };
  jest.mocked(useDeleteBookMutation).mockReturnValue(
    deleteMutation as unknown as ReturnType<typeof useDeleteBookMutation>,
  );
  const onDeleted = jest.fn();
  const view = await render(
    <BookDetailScreen bookId={4} onDeleted={onDeleted} onOpenReading={jest.fn()} />,
  );

  await fireEvent.press(view.getByRole('button', { name: 'Remove book' }));
  const confirmation = view.getByTestId('confirm-action-dialog');
  expect(confirmation).toBeTruthy();
  expect(within(confirmation).getByText('Something went wrong. Please try again.')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Remove' }));
  await fireEvent.press(view.getByRole('button', { name: 'Remove' }));
  expect(deleteMutation.mutateAsync).toHaveBeenCalledTimes(1);
  rejectDelete(new Error('network'));
  await waitFor(() => {
    expect(view.getByTestId('confirm-action-dialog')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Remove' }).props.accessibilityState.disabled).toBe(false);
  });
  await fireEvent.press(view.getByRole('button', { name: 'Cancel' }));
  expect(view.queryByTestId('confirm-action-dialog')).toBeNull();
  expect(onDeleted).not.toHaveBeenCalled();
});

// BDD: FRONT-166 then-1/then-2
// BDD: FRONT-167 then-1/then-2
it('selects a Book Knowledge topic and carries normalized recommended persona keys', async () => {
  const onOpenDebates = jest.fn();
  jest.mocked(useBookKnowledgeQuery).mockReturnValue({
    data: {
      discussionPoints: [{
        id: 'fear',
        question: 'What makes fear useful?',
        recommendedPersonaKeys: ['LITERARY_CRITIC', 'historical-context'],
      }],
      famousQuotes: [],
      keywords: [],
      knowledgeId: 9,
      recommendedPersonas: [{ discussionPointId: 'fear', personaKeys: ['category-default'] }],
      status: 'ready',
      themes: [],
      title: 'Dune',
      version: 'book-knowledge-v2',
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useBookKnowledgeQuery>);

  const view = await render(
    <BookDetailScreen
      bookId={4}
      onDeleted={jest.fn()}
      onOpenDebates={onOpenDebates}
      onOpenReading={jest.fn()}
    />,
  );

  await fireEvent.press(view.getByTestId('book-knowledge-topic-fear'));
  expect(view.getByText('literary-critic, historical-context')).toBeTruthy();
  await fireEvent.press(view.getByTestId('open-book-debates'));
  expect(onOpenDebates).toHaveBeenCalledWith({
    personaKeys: ['literary-critic', 'historical-context'],
    topic: 'What makes fear useful?',
  });
});
