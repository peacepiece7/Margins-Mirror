import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteJson, getJson, patchJson, postJson } from '@/lib/api-client';

import { booksApi } from './api';

vi.mock('@/lib/api-client', () => ({
  deleteJson: vi.fn(),
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

describe('booksApi', () => {
  it('keeps private background reads and explicit revision writes separate from AI refresh', async () => {
    vi.mocked(getJson).mockResolvedValue({ summary: null, revision: 0, updatedAt: null });
    await booksApi.background(7);
    expect(getJson).toHaveBeenCalledWith('/api/books/7/knowledge/summary');
    await booksApi.updateBackground(7, { summary: 'Reader text', expectedRevision: 2 });
    expect(patchJson).toHaveBeenCalledWith('/api/books/7/knowledge/summary', {
      summary: 'Reader text',
      expectedRevision: 2,
    });
  });
  beforeEach(() => vi.clearAllMocks());

  it('loads the lightweight reading-session locator for one book', async () => {
    vi.mocked(getJson).mockResolvedValue({ sessionId: 11, title: 'Dune reflection' });

    await booksApi.readingSession(7);

    expect(getJson).toHaveBeenCalledWith('/api/books/7/reading-session');
  });

  it('serializes non-default shelf filters', async () => {
    vi.mocked(getJson).mockResolvedValue({ threads: [] });

    await booksApi.books({ stage: 'DISCUSS', status: 'reading', sort: 'rating_desc' }, '50');

    expect(getJson).toHaveBeenCalledWith(
      '/api/library/threads?status=reading&stage=DISCUSS&sort=rating_desc&cursor=50',
    );
  });

  it('projects authoritative thread metadata onto the existing saved-book shape', async () => {
    vi.mocked(getJson).mockResolvedValue({
      threads: [
        {
          book: { bookId: 7, title: 'Dune', author: 'Frank Herbert' },
          loop: {
            stage: 'INTERVIEW',
            answeredCount: 2,
            targetCount: 5,
            continueLocator: {
              kind: 'INTERVIEW',
              href: '/book/7/reflection/interview',
            },
          },
          recentRevisions: [
            {
              revisionId: 11,
              version: 2,
              revisionSource: 'USER_EDIT',
              createdAt: '2026-09-01T12:00:00',
            },
          ],
          version: 'row-v2',
        },
      ],
    });

    const response = await booksApi.books();

    expect(response.books[0]).toMatchObject({
      bookId: 7,
      loop: {
        stage: 'INTERVIEW',
        continueLocator: { href: '/book/7/reflection/interview' },
      },
      threadVersion: 'row-v2',
    });
  });

  it('returns one bounded page and leaves the next cursor to the query layer', async () => {
    vi.mocked(getJson).mockResolvedValueOnce({
      nextCursor: '50',
      threads: [
        {
          book: { bookId: 1, title: 'First page', author: 'Reader' },
          loop: {
            stage: 'REFLECT',
            answeredCount: 0,
            targetCount: 5,
            continueLocator: { kind: 'REFLECT', href: '/book/1/reflection' },
          },
          recentRevisions: [],
          version: 'row-1',
        },
      ],
    });

    const response = await booksApi.books({ status: 'reading' });

    expect(getJson).toHaveBeenCalledOnce();
    expect(getJson).toHaveBeenCalledWith('/api/library/threads?status=reading');
    expect(response.books.map((book) => book.bookId)).toEqual([1]);
    expect(response.nextCursor).toBe('50');
  });

  it('loads the complete saved-book collection for direct detail lookup', async () => {
    vi.mocked(getJson).mockResolvedValue({ books: [] });

    await booksApi.savedBooks();

    expect(getJson).toHaveBeenCalledWith('/api/books');
  });

  it('maps a search candidate to the save DTO', async () => {
    vi.mocked(postJson).mockResolvedValue({ bookId: 1, title: 'Dune', author: 'Frank Herbert' });

    await booksApi.save({
      candidateId: 'google:1',
      title: 'Dune',
      author: 'Frank Herbert',
      reason: 'not persisted',
    });

    expect(postJson).toHaveBeenCalledWith('/api/books', {
      candidateId: 'google:1',
      isbn: undefined,
      isbn10: undefined,
      isbn13: undefined,
      title: 'Dune',
      subtitle: undefined,
      author: 'Frank Herbert',
      authors: undefined,
      publisher: undefined,
      publishedDate: undefined,
      publishedYear: undefined,
      description: undefined,
      thumbnail: undefined,
      language: undefined,
      pageCount: undefined,
    });
  });

  it('updates shelf metadata through the dedicated endpoint', async () => {
    vi.mocked(patchJson).mockResolvedValue({ bookId: 1, title: 'Dune', author: 'Frank Herbert' });

    await booksApi.updateShelf(1, { rating: 4.5 });

    expect(patchJson).toHaveBeenCalledWith('/api/books/1/shelf', { rating: 4.5 });
  });

  it('regenerates Book Knowledge only through the explicit mutation endpoint', async () => {
    vi.mocked(postJson).mockResolvedValue({
      discussionPoints: [],
      famousQuotes: [],
      generationLocale: 'en',
      keywords: [],
      knowledgeId: 1,
      recommendedPersonas: [],
      status: 'ready',
      themes: [],
      title: 'Dune',
      version: 'book-knowledge-v1',
    });

    await booksApi.regenerateKnowledge(1);

    expect(postJson).toHaveBeenCalledWith('/api/books/1/knowledge/regenerate', {});
  });

  it('deletes a saved book through its endpoint', async () => {
    vi.mocked(deleteJson).mockResolvedValue(undefined);

    await booksApi.delete(1);

    expect(deleteJson).toHaveBeenCalledWith('/api/books/1');
  });
});
