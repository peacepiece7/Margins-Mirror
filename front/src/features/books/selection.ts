import type { SaveBookResponse } from '@/types/api/book';
import type { CreateReadingSessionResponse } from '@/types/api/session';

export function resolveSelectedPortalBook(
  savedBooks: SaveBookResponse[],
  selectedBookId: number | undefined,
  fallbackSelectedBook?: SaveBookResponse,
) {
  if (selectedBookId === undefined) {
    return fallbackSelectedBook;
  }

  const matched = savedBooks.find((book) => book.bookId === selectedBookId);
  if (matched) {
    return matched;
  }

  if (fallbackSelectedBook?.bookId === selectedBookId) {
    return fallbackSelectedBook;
  }

  return undefined;
}

export function sessionMatchesSelectedBook(
  selectedBook: SaveBookResponse | undefined,
  session: CreateReadingSessionResponse | undefined,
) {
  return Boolean(selectedBook && session && session.bookId === selectedBook.bookId);
}
