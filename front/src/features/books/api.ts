import { deleteJson, getJson, patchJson, postJson } from '@/lib/api-client';
import type {
  BookCandidate,
  BookCandidateSearchResponse,
  BookKnowledge,
  BookListResponse,
  SaveBookResponse,
} from '@/types/api/book';
import type { ReadingSessionListResponse } from '@/types/api/session';

import type { BookShelfQuery } from './types';

export const booksApi = {
  sessions(): Promise<ReadingSessionListResponse> {
    return getJson('/api/reading-sessions');
  },
  searchCandidates(query: string, page = 1, limit = 5): Promise<BookCandidateSearchResponse> {
    return postJson('/api/books/search-candidates', { query, page, limit });
  },

  books(query: BookShelfQuery = {}): Promise<BookListResponse> {
    const params = new URLSearchParams();
    if (query.status && query.status !== 'all') params.set('status', query.status);
    if (query.sort && query.sort !== 'recent') params.set('sort', query.sort);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return getJson(`/api/books${suffix}`);
  },

  save(candidate: BookCandidate): Promise<SaveBookResponse> {
    return postJson('/api/books', {
      candidateId: candidate.candidateId,
      isbn: candidate.isbn,
      isbn10: candidate.isbn10,
      isbn13: candidate.isbn13,
      title: candidate.title,
      subtitle: candidate.subtitle,
      author: candidate.author,
      authors: candidate.authors,
      publisher: candidate.publisher,
      publishedDate: candidate.publishedDate,
      publishedYear: candidate.publishedYear,
      description: candidate.description,
      thumbnail: candidate.thumbnail,
      language: candidate.language,
      pageCount: candidate.pageCount,
    });
  },

  saveManual(title: string, author: string): Promise<SaveBookResponse> {
    return postJson('/api/books', {
      candidateId: `manual-${Date.now()}`,
      title,
      author,
    });
  },

  knowledge(bookId: number): Promise<BookKnowledge> {
    return getJson(`/api/books/${bookId}/knowledge`);
  },

  regenerateKnowledge(bookId: number): Promise<BookKnowledge> {
    return postJson(`/api/books/${bookId}/knowledge/regenerate`, {});
  },

  update(bookId: number, title: string, author: string): Promise<SaveBookResponse> {
    return patchJson(`/api/books/${bookId}`, { title, author });
  },

  updateShelf(
    bookId: number,
    shelf: { readingStatus?: string; rating?: number; clearRating?: boolean },
  ): Promise<SaveBookResponse> {
    return patchJson(`/api/books/${bookId}/shelf`, shelf);
  },

  delete(bookId: number): Promise<void> {
    return deleteJson(`/api/books/${bookId}`);
  },
};
