import { fireEvent, render } from '@testing-library/react-native';

import { ApiRequestError } from '@/shared/api/error';
import { FlashAlertProvider } from '@/shared/ui/flash-alert';

import { DiscoverScreen } from './discover-screen';

// BDD: FRONT-046
import {
  useBooksQuery,
  useBookSearchQuery,
  useSaveBookMutation,
  useSaveManualBookMutation,
} from './queries';

let mockLocale: 'en' | 'ko' = 'en';

jest.mock('@/shared/i18n/i18n-provider', () => ({
  useI18n: () => {
    const { messages } = jest.requireActual<typeof import('@/shared/i18n/messages')>('@/shared/i18n/messages');
    return { locale: mockLocale, t: (key: keyof typeof messages.en) => messages[mockLocale][key] };
  },
}));
jest.mock('./queries', () => ({
  useBooksQuery: jest.fn(),
  useBookSearchQuery: jest.fn(),
  useSaveBookMutation: jest.fn(),
  useSaveManualBookMutation: jest.fn(),
}));

const mockBooks = jest.mocked(useBooksQuery);
const mockSearch = jest.mocked(useBookSearchQuery);
const mockSave = jest.mocked(useSaveBookMutation);
const mockSaveManual = jest.mocked(useSaveManualBookMutation);
const fetchNextPage = jest.fn();
const booksRefetch = jest.fn();
const searchRefetch = jest.fn();

function mutation() {
  return { error: null, isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };
}

beforeEach(() => {
  mockLocale = 'en';
  booksRefetch.mockReset();
  searchRefetch.mockReset();
  mockBooks.mockReturnValue({
    data: { books: [] },
    isError: false,
    isLoading: false,
    refetch: booksRefetch,
  } as unknown as ReturnType<typeof useBooksQuery>);
  mockSearch.mockClear();
  fetchNextPage.mockReset();
  mockSearch.mockReturnValue({
    data: { pages: [{ candidates: [{ author: 'Frank Herbert', candidateId: 'google:dune', title: 'Dune' }] }] },
    fetchNextPage,
    hasNextPage: true,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    refetch: searchRefetch,
  } as unknown as ReturnType<typeof useBookSearchQuery>);
  mockSave.mockReturnValue(mutation() as unknown as ReturnType<typeof useSaveBookMutation>);
  mockSaveManual.mockReturnValue(mutation() as unknown as ReturnType<typeof useSaveManualBookMutation>);
});

it('keeps the search controls above the result list and commits the query from the icon action', async () => {
  const view = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);

  expect(view.getByText('Find your next book')).toBeTruthy();
  expect(view.getByText('Search trusted catalog providers or add a book manually.')).toBeTruthy();
  expect(view.getByTestId('discover-fixed-search')).toBeTruthy();
  expect(view.getByTestId('book-candidate-list')).toBeTruthy();
  await fireEvent.changeText(view.getByTestId('discover-search-input'), '  Dune  ');
  await fireEvent.press(view.getByTestId('discover-search-submit'));

  expect(mockSearch).toHaveBeenLastCalledWith('Dune');
});

it('BDD: FRONT-023 shows candidate identifiers and every optional catalog metadata field', async () => {
  mockSearch.mockReturnValue({
    data: {
      pages: [{
        candidates: [{
          author: 'Frank Herbert',
          candidateId: 'google:dune',
          isbn13: '9780441172719',
          language: 'en',
          pageCount: 412,
          publishedDate: '1965-08-01',
          publisher: 'Chilton Books',
          subtitle: 'A Novel',
          thumbnail: 'https://example.test/dune.jpg',
          title: 'Dune',
        }],
      }],
    },
    fetchNextPage,
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    refetch: searchRefetch,
  } as unknown as ReturnType<typeof useBookSearchQuery>);

  const view = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);

  expect(view.getByTestId('candidate-cover')).toBeTruthy();
  expect(view.getByText('A Novel')).toBeTruthy();
  expect(view.getByText('Catalog ID: google:dune')).toBeTruthy();
  expect(view.getByText('ISBN: 9780441172719')).toBeTruthy();
  expect(view.getByText('1965-08-01')).toBeTruthy();
  expect(view.getByText('Publisher: Chilton Books')).toBeTruthy();
  expect(view.getByText('Language: en')).toBeTruthy();
  expect(view.getByText('Pages: 412')).toBeTruthy();
});

it('omits a provider page count when the API explicitly returns null', async () => {
  mockSearch.mockReturnValue({
    data: {
      pages: [{
        candidates: [{
          author: 'Frank Herbert',
          candidateId: 'google:dune',
          pageCount: null,
          title: 'Dune',
        }],
      }],
    },
    fetchNextPage,
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    refetch: searchRefetch,
  } as unknown as ReturnType<typeof useBookSearchQuery>);

  const view = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);

  expect(view.queryByTestId('candidate-page-count')).toBeNull();
  expect(view.queryByText('Pages: null')).toBeNull();
});

it('localizes the candidate cover accessibility label', async () => {
  mockLocale = 'ko';
  mockSearch.mockReturnValue({
    data: {
      pages: [{
        candidates: [{
          author: '프랭크 허버트',
          candidateId: 'google:dune',
          thumbnail: 'https://example.test/dune.jpg',
          title: '듄',
        }],
      }],
    },
    fetchNextPage,
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    refetch: searchRefetch,
  } as unknown as ReturnType<typeof useBookSearchQuery>);

  const view = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);

  expect(view.getByLabelText('듄 표지')).toBeTruthy();
  expect(view.queryByLabelText('듄 cover')).toBeNull();
});

it('loads the next page from the list sentinel without a pagination button', async () => {
  const view = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);
  expect(view.queryByText('Load more')).toBeNull();
  fireEvent(view.getByTestId('book-candidate-list'), 'endReached');
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});

it('localizes the candidate provider from its stable identifier', async () => {
  const view = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);
  expect(view.getByText('Google Books')).toBeTruthy();
});

it('shows the result count and unique providers above the candidate cards', async () => {
  mockSearch.mockReturnValue({
    data: {
      pages: [{
        candidates: [
          { author: 'Frank Herbert', candidateId: 'google:dune', title: 'Dune' },
          { author: 'Frank Herbert', candidateId: 'google:messiah', title: 'Dune Messiah' },
          { author: 'Simone de Beauvoir', candidateId: 'openlibrary:OL123W', title: 'A Very Easy Death' },
        ],
        totalItems: 12,
      }],
    },
    fetchNextPage,
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    refetch: searchRefetch,
  } as unknown as ReturnType<typeof useBookSearchQuery>);

  const view = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);

  expect(view.getByTestId('discover-result-summary')).toHaveTextContent(
    '12 candidates · Google Books · Open Library',
  );
});

it('shows visible search progress while catalog providers are queried', async () => {
  mockSearch.mockReturnValue({
    data: undefined,
    fetchNextPage,
    hasNextPage: false,
    isError: false,
    isFetching: true,
    isFetchingNextPage: false,
    refetch: searchRefetch,
  } as unknown as ReturnType<typeof useBookSearchQuery>);

  const loadingView = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);
  await fireEvent.changeText(loadingView.getByTestId('discover-search-input'), 'Dune');
  await fireEvent.press(loadingView.getByTestId('discover-search-submit'));
  expect(loadingView.getByTestId('discover-search-loading')).toHaveTextContent(
    'Searching catalog providers…',
  );
});

it('offers an actionable retry after a catalog provider failure', async () => {
  mockSearch.mockReturnValue({
    data: undefined,
    fetchNextPage,
    hasNextPage: false,
    isError: true,
    isFetching: false,
    isFetchingNextPage: false,
    refetch: searchRefetch,
  } as unknown as ReturnType<typeof useBookSearchQuery>);
  const errorView = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);
  await fireEvent.changeText(errorView.getByTestId('discover-search-input'), 'Dune');
  await fireEvent.press(errorView.getByTestId('discover-search-submit'));
  expect(errorView.queryByText('No matching books were found.')).toBeNull();
  await fireEvent.press(errorView.getByRole('button', { name: 'Try again' }));
  expect(searchRefetch).toHaveBeenCalledTimes(1);
});

// BDD: BOOK-019
it('marks a catalog candidate already in the shelf and opens the saved book', async () => {
  const onOpenBook = jest.fn();
  mockBooks.mockReturnValue({
    data: {
      books: [{
        author: 'Frank Herbert',
        bookId: 19,
        readingStatus: 'reading',
        sourceRef: 'google:dune',
        title: 'Dune',
      }],
    },
    isError: false,
    isLoading: false,
    refetch: booksRefetch,
  } as unknown as ReturnType<typeof useBooksQuery>);

  const view = await render(<DiscoverScreen onOpenBook={onOpenBook} onSaved={jest.fn()} />);

  expect(view.getByTestId('candidate-saved-state')).toHaveTextContent(
    'Already in your library · Reading',
  );
  await fireEvent.press(view.getByRole('button', { name: 'Open in library' }));
  expect(onOpenBook).toHaveBeenCalledWith(19);

  await fireEvent.press(view.getByTestId('discover-hide-saved'));
  expect(view.queryByTestId('book-candidate-google:dune')).toBeNull();
  expect(view.getByText('Every matching candidate is already in your library.')).toBeTruthy();
});

it('matches an existing edition by normalized ISBN when provider identifiers differ', async () => {
  mockBooks.mockReturnValue({
    data: {
      books: [{
        author: 'Frank Herbert',
        bookId: 20,
        isbn: '978-0-441-17271-9',
        readingStatus: 'read',
        sourceRef: 'openlibrary:OL123W',
        title: 'Dune',
      }],
    },
    isError: false,
    isLoading: false,
    refetch: booksRefetch,
  } as unknown as ReturnType<typeof useBooksQuery>);
  mockSearch.mockReturnValue({
    data: { pages: [{ candidates: [{
      author: 'Frank Herbert',
      candidateId: 'google:dune',
      isbn13: '9780441172719',
      title: 'Dune',
    }] }] },
    fetchNextPage,
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    refetch: searchRefetch,
  } as unknown as ReturnType<typeof useBookSearchQuery>);

  const view = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);

  expect(view.getByTestId('candidate-saved-state')).toHaveTextContent(
    'Already in your library · Read',
  );
});

it('checks every candidate ISBN before treating an edition as new', async () => {
  mockBooks.mockReturnValue({
    data: {
      books: [{
        author: 'Frank Herbert',
        bookId: 21,
        isbn: '0441172717',
        readingStatus: 'reading',
        sourceRef: 'openlibrary:OL123W',
        title: 'Dune',
      }],
    },
    isError: false,
    isLoading: false,
    refetch: booksRefetch,
  } as unknown as ReturnType<typeof useBooksQuery>);
  mockSearch.mockReturnValue({
    data: { pages: [{ candidates: [{
      author: 'Frank Herbert',
      candidateId: 'google:dune',
      isbn13: '9780000000002',
      isbn10: '0-441-17271-7',
      title: 'Dune',
    }] }] },
    fetchNextPage,
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    refetch: searchRefetch,
  } as unknown as ReturnType<typeof useBookSearchQuery>);

  const view = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);

  expect(view.getByTestId('candidate-saved-state')).toHaveTextContent(
    'Already in your library · Reading',
  );
});

it('saves a new candidate with the selected initial shelf state in one mutation', async () => {
  const mutate = jest.fn();
  mockSave.mockReturnValue({
    ...mutation(),
    mutate,
  } as unknown as ReturnType<typeof useSaveBookMutation>);
  const view = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);

  await fireEvent.press(view.getByRole('radio', { name: 'Read' }));
  await fireEvent.press(view.getAllByRole('button', { name: 'Add to library' })[0]);

  expect(mutate).toHaveBeenCalledWith(
    {
      candidate: { author: 'Frank Herbert', candidateId: 'google:dune', title: 'Dune' },
      readingStatus: 'read',
    },
    expect.objectContaining({ onError: expect.any(Function), onSuccess: expect.any(Function) }),
  );
});

it('blocks candidate and manual saves until the current library is known', async () => {
  const mutate = jest.fn();
  const mutateAsync = jest.fn();
  mockBooks.mockReturnValue({
    data: undefined,
    isError: false,
    isLoading: true,
    refetch: booksRefetch,
  } as unknown as ReturnType<typeof useBooksQuery>);
  mockSave.mockReturnValue({
    ...mutation(),
    mutate,
  } as unknown as ReturnType<typeof useSaveBookMutation>);
  mockSaveManual.mockReturnValue({
    ...mutation(),
    mutateAsync,
  } as unknown as ReturnType<typeof useSaveManualBookMutation>);

  const view = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);

  await fireEvent.changeText(view.getByTestId('discover-search-input'), 'Dune');
  await fireEvent.press(view.getByTestId('discover-search-submit'));

  expect(view.getByText('Checking your library before saving…')).toBeTruthy();
  expect(view.queryByText('No matching books were found.')).toBeNull();
  expect(view.queryByTestId('book-candidate-google:dune')).toBeNull();
  expect(view.getByRole('button', { name: 'Add to library' })).toBeDisabled();
  await fireEvent.press(view.getByRole('button', { name: 'Add to library' }));
  expect(mutate).not.toHaveBeenCalled();
  expect(mutateAsync).not.toHaveBeenCalled();
});

it('disables every save action while any candidate save is pending', async () => {
  mockSearch.mockReturnValue({
    data: { pages: [{ candidates: [
      { author: 'Frank Herbert', candidateId: 'google:dune', title: 'Dune' },
      { author: 'Frank Herbert', candidateId: 'google:messiah', title: 'Dune Messiah' },
    ] }] },
    fetchNextPage,
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    refetch: searchRefetch,
  } as unknown as ReturnType<typeof useBookSearchQuery>);
  mockSave.mockReturnValue({
    ...mutation(),
    isPending: true,
    variables: {
      candidate: { author: 'Frank Herbert', candidateId: 'google:dune', title: 'Dune' },
      readingStatus: 'want_to_read',
    },
  } as unknown as ReturnType<typeof useSaveBookMutation>);

  const view = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);

  for (const button of view.getAllByRole('button', { name: 'Add to library' })) {
    expect(button).toBeDisabled();
  }
  for (const radio of view.getAllByRole('radio')) {
    expect(radio).toBeDisabled();
  }
});

it('keeps saves disabled when the current library cannot be loaded', async () => {
  mockBooks.mockReturnValue({
    data: undefined,
    isError: true,
    isLoading: false,
    refetch: booksRefetch,
  } as unknown as ReturnType<typeof useBooksQuery>);

  const view = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);

  expect(view.getByText(
    'Your library could not be checked. Saving is disabled until it reloads.',
  )).toBeTruthy();
  expect(view.queryByTestId('book-candidate-google:dune')).toBeNull();
  expect(view.getByRole('button', { name: 'Add to library' })).toBeDisabled();
  await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
  expect(booksRefetch).toHaveBeenCalledTimes(1);
});

it('fails closed when a stale shelf snapshot is present alongside a refresh error', async () => {
  mockBooks.mockReturnValue({
    data: { books: [] },
    isError: true,
    isLoading: false,
    refetch: booksRefetch,
  } as unknown as ReturnType<typeof useBooksQuery>);

  const view = await render(<DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />);

  expect(view.queryByTestId('book-candidate-google:dune')).toBeNull();
  expect(view.getByRole('button', { name: 'Add to library' })).toBeDisabled();
});

// BDD: DS-013 then-1/then-2/then-4
it('reports a localized save failure through the shared dismissible project alert', async () => {
  const saveCandidate = jest.fn((
    _candidate: unknown,
    options: { onError(error: Error): void },
  ) => options.onError(new ApiRequestError({ code: 'BOOK_ALREADY_EXISTS', status: 409 })));
  mockSave.mockReturnValue({
    ...mutation(),
    mutate: saveCandidate,
  } as unknown as ReturnType<typeof useSaveBookMutation>);

  const view = await render(
    <FlashAlertProvider>
      <DiscoverScreen onOpenBook={jest.fn()} onSaved={jest.fn()} />
    </FlashAlertProvider>,
  );
  const addActions = view.getAllByRole('button', { name: 'Add to library' });
  await fireEvent.press(addActions[0]);
  expect(view.getByText('That ISBN is already in your library.').parent?.props.accessibilityRole).toBe('alert');
  await fireEvent.press(view.getByLabelText('Dismiss notification'));
  expect(view.queryByTestId('flash-alert')).toBeNull();
});
