import { useMemo } from 'react';

import type { ApiClient } from '@/shared/api/client';
import { useApiClient } from '@/shared/api/api-client-provider';

import type {
  BookCandidate,
  BookCandidateSearchResponse,
  BookKnowledge,
  BookListResponse,
  BookShelfQuery,
  ReadingStatus,
  SavedBook,
} from './types';

export function createBooksApi(client: ApiClient) {
  return {
    books(query: BookShelfQuery = {}) {
      const params = new URLSearchParams();
      if (query.status && query.status !== 'all') params.set('status', query.status);
      if (query.sort && query.sort !== 'recent') params.set('sort', query.sort);
      return client.get<BookListResponse>(`/api/books${params.size ? `?${params}` : ''}`);
    },
    delete(bookId: number) {
      return client.delete<void>(`/api/books/${bookId}`);
    },
    knowledge(bookId: number) {
      return client.get<BookKnowledge>(`/api/books/${bookId}/knowledge`);
    },
    regenerateKnowledge(bookId: number) {
      return client.post<BookKnowledge>(`/api/books/${bookId}/knowledge/regenerate`, {});
    },
    save(candidate: BookCandidate, readingStatus: ReadingStatus = 'want_to_read') {
      return client.post<SavedBook>('/api/books', {
        author: candidate.author,
        authors: candidate.authors,
        candidateId: candidate.candidateId,
        description: candidate.description,
        isbn: candidate.isbn,
        isbn10: candidate.isbn10,
        isbn13: candidate.isbn13,
        language: candidate.language,
        pageCount: candidate.pageCount,
        publishedDate: candidate.publishedDate,
        publishedYear: candidate.publishedYear,
        publisher: candidate.publisher,
        readingStatus,
        subtitle: candidate.subtitle,
        thumbnail: candidate.thumbnail,
        title: candidate.title,
      });
    },
    saveManual(title: string, author: string, isbn?: string) {
      return client.post<SavedBook>('/api/books', {
        author,
        candidateId: `manual-${Date.now()}`,
        isbn: isbn || undefined,
        title,
      });
    },
    searchCandidates(query: string, page = 1, limit = 10) {
      return client.post<BookCandidateSearchResponse>('/api/books/search-candidates', {
        limit,
        page,
        query,
      });
    },
    update(bookId: number, title: string, author: string) {
      return client.patch<SavedBook>(`/api/books/${bookId}`, { author, title });
    },
    updateShelf(
      bookId: number,
      shelf: { clearRating?: boolean; rating?: number; readingStatus?: string },
    ) {
      return client.patch<SavedBook>(`/api/books/${bookId}/shelf`, shelf);
    },
  };
}

export function useBooksApi() {
  const client = useApiClient();
  return useMemo(() => createBooksApi(client), [client]);
}
