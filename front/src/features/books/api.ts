import { deleteJson, getJson, patchJson, postJson } from '@/lib/api-client';
import type {
  BookCandidate,
  BookCandidateSearchResponse,
  BookKnowledge,
  BookListResponse,
  LibraryThreadResponse,
  SaveBookResponse,
} from '@/types/api/book';
import type { BookReadingSessionResponse } from '@/types/api/session';
import type {
  CatalogSearchRequest,
  CatalogSearchResponse,
  CatalogCollection,
  CatalogCapabilities,
  CatalogOperations,
} from '@/types/api/catalog';

import type { BookShelfQuery } from './types';

export const booksApi = {
  catalogSearch(
    request: CatalogSearchRequest,
    signal?: AbortSignal,
  ): Promise<CatalogSearchResponse> {
    return postJson('/api/catalog/search', request, signal);
  },
  catalogPage(
    id: string,
    cursor: string | null,
    signal?: AbortSignal,
  ): Promise<CatalogSearchResponse> {
    return getJson(
      `/api/catalog/search-snapshots/${encodeURIComponent(id)}?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      signal,
    );
  },
  catalogCollection(id: string, signal?: AbortSignal): Promise<CatalogCollection> {
    return getJson(`/api/catalog/collections/${encodeURIComponent(id)}`, signal);
  },
  saveCatalog(catalogBookId: number): Promise<SaveBookResponse> {
    return postJson('/api/books/from-catalog', { catalogBookId });
  },
  catalogCapabilities(signal?: AbortSignal): Promise<CatalogCapabilities> {
    return getJson('/api/catalog/capabilities', signal);
  },
  catalogOperations(signal?: AbortSignal): Promise<CatalogOperations> {
    return getJson('/api/catalog/operations', signal);
  },
  catalogSource(id: number, action: 'PAUSE' | 'RESUME'): Promise<CatalogCapabilities> {
    return postJson(`/api/catalog/operations/sources/${id}`, { action });
  },
  catalogWithdraw(id: number): Promise<CatalogCapabilities> {
    return postJson(`/api/catalog/operations/covers/${id}/withdraw`, {});
  },
  readingSession(bookId: number): Promise<BookReadingSessionResponse | null> {
    return getJson(`/api/books/${bookId}/reading-session`);
  },
  searchCandidates(query: string, page = 1, limit = 5): Promise<BookCandidateSearchResponse> {
    return postJson('/api/books/search-candidates', { query, page, limit });
  },

  async books(query: BookShelfQuery = {}, cursor?: string): Promise<BookListResponse> {
    const params = new URLSearchParams();
    if (query.status && query.status !== 'all') params.set('status', query.status);
    if (query.stage) params.set('stage', query.stage);
    if (query.sort && query.sort !== 'recent') params.set('sort', query.sort);
    if (cursor) params.set('cursor', cursor);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await getJson<LibraryThreadResponse>(`/api/library/threads${suffix}`);

    return {
      books: response.threads.map(({ book, loop, recentRevisions, version }) => ({
        ...book,
        loop,
        recentRevisions,
        threadVersion: version,
      })),
      nextCursor: response.nextCursor?.trim() || undefined,
      summary: response.summary,
    };
  },

  savedBooks(): Promise<BookListResponse> {
    return getJson('/api/books');
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
