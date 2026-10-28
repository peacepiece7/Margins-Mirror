import { fireEvent, render, within } from '@testing-library/react-native';

import { LibraryScreen } from './library-screen';
import { useBooksQuery } from './queries';

jest.mock('@/shared/i18n/i18n-provider', () => ({
  useI18n: () => {
    const { messages } = jest.requireActual<typeof import('@/shared/i18n/messages')>('@/shared/i18n/messages');
    return { locale: 'ko', t: (key: keyof typeof messages.ko) => messages.ko[key] };
  },
}));
jest.mock('./queries', () => ({ useBooksQuery: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

it('BDD: BOOK-007 then-8 keeps localized saved feedback after navigation until explicit dismissal', async () => {
  const onDismissSaved = jest.fn();
  jest.mocked(useBooksQuery).mockReturnValue({
    data: { books: [{ author: '작가', bookId: 1, readingStatus: 'want_to_read', title: '책' }] },
    isError: false,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBooksQuery>);
  const view = await render(
    <LibraryScreen onDismissSaved={onDismissSaved} onOpenBook={jest.fn()} saved />,
  );
  const savedAlertText = view.getByText('책을 서재에 담았습니다.');
  expect(savedAlertText.parent?.props.accessibilityRole).toBe('alert');
  expect(view.getAllByText('읽고 싶은 책')).toHaveLength(1);
  await fireEvent.press(view.getByTestId('dismiss-saved-book-feedback'));
  expect(onDismissSaved).toHaveBeenCalledTimes(1);
  expect(view.queryByTestId('saved-book-feedback')).toBeNull();
});

it('shows the complete shelf and the workflow-specific book-selection prompt', async () => {
  const onOpenBook = jest.fn();
  jest.mocked(useBooksQuery).mockReturnValue({
    data: {
      books: [
        { author: '프랭크 허버트', bookId: 1, title: '듄' },
        { author: '한강', bookId: 2, title: '소년이 온다' },
      ],
    },
    isError: false,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBooksQuery>);
  const view = await render(
    <LibraryScreen onOpenBook={onOpenBook} selectionPrompt="성찰할 책을 선택하세요." />,
  );

  expect(view.getByTestId('library-selection-prompt')).toBeTruthy();
  expect(view.getByText('성찰할 책을 선택하세요.')).toBeTruthy();
  expect(view.getByText('소년이 온다')).toBeTruthy();
  expect(view.getByText('듄')).toBeTruthy();
  expect(view.queryByTestId('library-book-filter')).toBeNull();

  await fireEvent.press(view.getByRole('button', { name: '듄, 저자 프랭크 허버트' }));
  expect(onOpenBook).toHaveBeenCalledWith(expect.objectContaining({ bookId: 1 }));
});

it('keeps selected current-book metadata while omitting shelf-status controls', async () => {
  const onOpenBook = jest.fn();
  jest.mocked(useBooksQuery).mockReturnValue({
    data: {
      books: [{
        author: '프랭크 허버트',
        bookId: 1,
        coverImageUrl: 'https://example.test/dune.jpg',
        readingStatus: 'reading',
        subtitle: '사구 연대기',
        title: '듄',
      }],
    },
    isError: false,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBooksQuery>);
  const view = await render(
    <LibraryScreen onOpenBook={onOpenBook} />,
  );

  expect(view.getByTestId('current-book-summary')).toBeTruthy();
  await fireEvent.press(view.getByTestId('current-book-summary'));
  expect(onOpenBook).toHaveBeenCalledWith(expect.objectContaining({ bookId: 1 }));
  expect(view.getByTestId('current-book-summary')).toBeTruthy();
  expect(view.getByTestId('current-book-cover')).toBeTruthy();
  expect(view.getByText('사구 연대기')).toBeTruthy();
  expect(view.queryByRole('button', { name: '전체' })).toBeNull();
  expect(view.queryByRole('button', { name: '읽고 싶은 책' })).toBeNull();
  expect(view.queryByRole('button', { name: '읽는 중' })).toBeNull();
  expect(useBooksQuery).toHaveBeenCalledWith();
});

// BDD: FRONT-130 then-2; native keeps the accepted review experience while
// entering it from Library instead of adopting the browser-only GNB placement.
it('provides a visible Public Reviews entry from the Library without adding a GNB destination', async () => {
  const onOpenReviews = jest.fn();
  jest.mocked(useBooksQuery).mockReturnValue({
    data: { books: [{ author: '한강', bookId: 2, title: '소년이 온다' }] },
    isError: false,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBooksQuery>);

  const view = await render(
    <LibraryScreen
      onOpenBook={jest.fn()}
      onOpenReviews={onOpenReviews}
    />,
  );

  expect(view.getByText('독자가 공개하기로 선택한 성찰 기록을 읽어보세요.')).toBeTruthy();
  await fireEvent.press(view.getByTestId('open-public-reviews'));
  expect(onOpenReviews).toHaveBeenCalledTimes(1);
});

// BDD: PROJ-006 then-2; mobile Library keeps the hero tied to active reading state.
it('keeps the current-book summary on the reading book after another shelf book is opened', async () => {
  jest.mocked(useBooksQuery).mockReturnValue({
    data: {
      books: [
        {
          author: 'Frank Herbert',
          bookId: 4,
          readingStatus: 'want_to_read',
          title: 'Dune',
        },
        {
          author: 'Han Kang',
          bookId: 5,
          coverImageUrl: 'https://example.test/current.jpg',
          readingStatus: 'reading',
          subtitle: 'A Novel',
          title: 'The Current Book',
        },
      ],
    },
    isError: false,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBooksQuery>);

  const onOpenBook = jest.fn();
  const view = await render(<LibraryScreen onOpenBook={onOpenBook} />);

  const summary = within(view.getByTestId('current-book-summary'));
  expect(summary.getByText('The Current Book')).toBeTruthy();
  expect(summary.queryByText('Dune')).toBeNull();
  await fireEvent.press(view.getAllByTestId('library-book-card')[0]);
  expect(onOpenBook).toHaveBeenCalledWith(expect.objectContaining({ bookId: 4 }));
  expect(summary.getByText('The Current Book')).toBeTruthy();
});
