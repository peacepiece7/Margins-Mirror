import { describe, expect, it } from 'vitest';
import type { SaveBookResponse } from '@/types/api/book';
import type { CreateReadingSessionResponse } from '@/types/api/session';
import { resolveSelectedPortalBook, sessionMatchesSelectedBook } from './selection';

const firstBook: SaveBookResponse = {
  bookId: 1,
  title: 'First Book',
  author: 'First Author',
};

const secondBook: SaveBookResponse = {
  bookId: 2,
  title: 'Second Book',
  author: 'Second Author',
};

describe('resolveSelectedPortalBook', () => {
  it('uses the hydrated selected book before a local page selection exists', () => {
    expect(resolveSelectedPortalBook([], undefined, firstBook)).toBe(firstBook);
  });

  it('does not fall back to a stale global selected book after the user selected another id', () => {
    expect(resolveSelectedPortalBook([secondBook], 2, firstBook)).toBe(secondBook);
  });

  it('keeps the hydrated selected book when a shelf filter hides it from the saved list', () => {
    expect(resolveSelectedPortalBook([], 1, firstBook)).toBe(firstBook);
  });

  it('returns no selected book when the local selected id is missing from both lists', () => {
    expect(resolveSelectedPortalBook([], 2, firstBook)).toBeUndefined();
  });
});

describe('sessionMatchesSelectedBook', () => {
  it('accepts session data only for the selected book', () => {
    const session: CreateReadingSessionResponse = {
      sessionId: 10,
      bookId: secondBook.bookId,
      title: 'Second Book reflection',
    };

    expect(sessionMatchesSelectedBook(secondBook, session)).toBe(true);
    expect(sessionMatchesSelectedBook(firstBook, session)).toBe(false);
  });
});
