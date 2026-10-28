import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useBooksApi } from './api';
import type {
  BookCandidate,
  BookCandidateSearchResponse,
  BookShelfQuery,
  ReadingStatus,
} from './types';

export const bookKeys = {
  all: ['books'] as const,
  detail: (bookId: number) => ['books', 'detail', bookId] as const,
  knowledge: (bookId: number) => ['books', 'knowledge', bookId] as const,
  list: (query: BookShelfQuery = {}) => ['books', 'list', query] as const,
  lists: ['books', 'list'] as const,
  search: (query: string, limit: number) => ['books', 'search', query, limit] as const,
};

export function useBooksQuery(query: BookShelfQuery = {}) {
  const api = useBooksApi();
  return useQuery({ queryFn: () => api.books(query), queryKey: bookKeys.list(query) });
}

export function useBookQuery(bookId: number) {
  const result = useBooksQuery();
  return { ...result, data: result.data?.books.find((book) => book.bookId === bookId) };
}

export function useBookKnowledgeQuery(bookId: number) {
  const api = useBooksApi();
  return useQuery({
    enabled: Number.isSafeInteger(bookId) && bookId > 0,
    queryFn: () => api.knowledge(bookId),
    queryKey: bookKeys.knowledge(bookId),
    refetchInterval: (query) => (query.state.data?.refreshPending ? 2_000 : false),
    retry: false,
  });
}

export function useBookSearchQuery(query: string, limit = 10) {
  const api = useBooksApi();
  return useInfiniteQuery<
    BookCandidateSearchResponse,
    Error,
    InfiniteData<BookCandidateSearchResponse>,
    ReturnType<typeof bookKeys.search>,
    number
  >({
    enabled: Boolean(query.trim()),
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? (lastPage.page ?? pages.length) + 1 : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.searchCandidates(query, pageParam, limit),
    queryKey: bookKeys.search(query, limit),
  });
}

function useInvalidateBooks() {
  const queryClient = useQueryClient();
  return async (bookId?: number) => {
    await queryClient.invalidateQueries({ queryKey: bookKeys.lists });
    if (bookId) await queryClient.invalidateQueries({ queryKey: bookKeys.detail(bookId) });
  };
}

export function useSaveBookMutation() {
  const api = useBooksApi();
  const invalidate = useInvalidateBooks();
  return useMutation({
    mutationFn: ({
      candidate,
      readingStatus,
    }: {
      candidate: BookCandidate;
      readingStatus: ReadingStatus;
    }) => api.save(candidate, readingStatus),
    onSuccess: (book) => invalidate(book.bookId),
  });
}

export function useSaveManualBookMutation() {
  const api = useBooksApi();
  const invalidate = useInvalidateBooks();
  return useMutation({
    mutationFn: ({ author, isbn, title }: { author: string; isbn?: string; title: string }) =>
      api.saveManual(title, author, isbn),
    onSuccess: (book) => invalidate(book.bookId),
  });
}

export function useUpdateBookShelfMutation() {
  const api = useBooksApi();
  const invalidate = useInvalidateBooks();
  return useMutation({
    mutationFn: ({
      bookId,
      shelf,
    }: {
      bookId: number;
      shelf: { clearRating?: boolean; rating?: number; readingStatus?: string };
    }) => api.updateShelf(bookId, shelf),
    onSuccess: (book) => invalidate(book.bookId),
  });
}

export function useUpdateBookMutation() {
  const api = useBooksApi();
  const invalidate = useInvalidateBooks();
  return useMutation({
    mutationFn: ({ author, bookId, title }: { author: string; bookId: number; title: string }) =>
      api.update(bookId, title, author),
    onSuccess: (book) => invalidate(book.bookId),
  });
}

export function useRegenerateBookKnowledgeMutation(bookId: number) {
  const api = useBooksApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.regenerateKnowledge(bookId),
    onSuccess: (knowledge) => queryClient.setQueryData(bookKeys.knowledge(bookId), knowledge),
  });
}

export function useDeleteBookMutation() {
  const api = useBooksApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookId: number) => api.delete(bookId).then(() => bookId),
    onSuccess: async (bookId) => {
      queryClient.removeQueries({ queryKey: bookKeys.detail(bookId) });
      queryClient.removeQueries({ queryKey: bookKeys.knowledge(bookId) });
      await queryClient.invalidateQueries({ queryKey: bookKeys.lists });
    },
  });
}
