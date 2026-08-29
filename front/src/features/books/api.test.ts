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
  beforeEach(() => vi.clearAllMocks());

  it('loads the lightweight reading-session locator for one book', async () => {
    vi.mocked(getJson).mockResolvedValue({ sessionId: 11, title: 'Dune reflection' });

    await booksApi.readingSession(7);

    expect(getJson).toHaveBeenCalledWith('/api/books/7/reading-session');
  });

  it('serializes non-default shelf filters', async () => {
    vi.mocked(getJson).mockResolvedValue({ books: [] });

    await booksApi.books({ status: 'reading', sort: 'rating_desc' });

    expect(getJson).toHaveBeenCalledWith('/api/books?status=reading&sort=rating_desc');
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
