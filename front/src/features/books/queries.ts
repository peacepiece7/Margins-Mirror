import {
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { bookKeys, sessionKeys } from '@/lib/query-keys';
import type { BookCandidate } from '@/types/api/book';

import { booksApi } from './api';
import type { BookShelfQuery } from './types';

export const bookQueryOptions = {
  list: (query: BookShelfQuery = {}) =>
    queryOptions({
      queryKey: bookKeys.list(query),
      queryFn: () => booksApi.books(query),
    }),
  knowledge: (bookId: number) =>
    queryOptions({
      queryKey: bookKeys.knowledge(bookId),
      queryFn: () => booksApi.knowledge(bookId),
      enabled: Number.isSafeInteger(bookId) && bookId > 0,
      refetchInterval: (query) => (query.state.data?.refreshPending ? 2_000 : false),
    }),
  sessions: () =>
    queryOptions({
      queryKey: sessionKeys.list(),
      queryFn: booksApi.sessions,
    }),
};

export function useBooksQuery(query: BookShelfQuery = {}) {
  return useQuery(bookQueryOptions.list(query));
}

export function useBookSearchInfiniteQuery(query: string, limit = 5, enabled = true) {
  return useInfiniteQuery({
    queryKey: bookKeys.search(query, limit),
    queryFn: ({ pageParam }) => booksApi.searchCandidates(query, pageParam, limit),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? (lastPage.page ?? pages.length) + 1 : undefined,
    enabled: enabled && Boolean(query.trim()),
  });
}

export function useBookSearchCommand() {
  const queryClient = useQueryClient();
  const command = useQuery({
    queryKey: bookKeys.searchCommand(),
    queryFn: async () => '',
    initialData: '',
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return {
    query: command.data,
    commit(query: string) {
      queryClient.setQueryData(bookKeys.searchCommand(), query.trim());
    },
    clear() {
      queryClient.setQueryData(bookKeys.searchCommand(), '');
      queryClient.removeQueries({
        queryKey: bookKeys.searches(),
        predicate: (query) => query.queryKey[query.queryKey.length - 1] !== 'command',
      });
    },
  };
}

export function useBookQuery(bookId: number) {
  const books = useBooksQuery();
  return {
    ...books,
    data: books.data?.books.find((book) => book.bookId === bookId),
  };
}

export function useBookKnowledgeQuery(bookId: number) {
  return useQuery(bookQueryOptions.knowledge(bookId));
}

export function useRegenerateBookKnowledgeMutation(bookId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => booksApi.regenerateKnowledge(bookId),
    onSuccess: (knowledge) => queryClient.setQueryData(bookKeys.knowledge(bookId), knowledge),
  });
}

export function useBookSessionQuery(bookId: number) {
  const sessions = useQuery(bookQueryOptions.sessions());
  return {
    ...sessions,
    data: sessions.data?.sessions.find((session) => session.bookId === bookId),
  };
}

function useInvalidateBooks() {
  const queryClient = useQueryClient();
  return async (bookId?: number) => {
    await queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
    if (bookId) await queryClient.invalidateQueries({ queryKey: bookKeys.detail(bookId) });
  };
}

export function useSaveBookMutation() {
  const invalidate = useInvalidateBooks();
  return useMutation({
    mutationFn: (candidate: BookCandidate) => booksApi.save(candidate),
    onSuccess: (book) => invalidate(book.bookId),
  });
}

export function useSaveManualBookMutation() {
  const invalidate = useInvalidateBooks();
  return useMutation({
    mutationFn: ({ title, author }: { title: string; author: string }) =>
      booksApi.saveManual(title, author),
    onSuccess: (book) => invalidate(book.bookId),
  });
}

export function useUpdateBookMutation() {
  const invalidate = useInvalidateBooks();
  return useMutation({
    mutationFn: ({ bookId, title, author }: { bookId: number; title: string; author: string }) =>
      booksApi.update(bookId, title, author),
    onSuccess: (book) => invalidate(book.bookId),
  });
}

export function useUpdateBookShelfMutation() {
  const invalidate = useInvalidateBooks();
  return useMutation({
    mutationFn: ({
      bookId,
      shelf,
    }: {
      bookId: number;
      shelf: { readingStatus?: string; rating?: number; clearRating?: boolean };
    }) => booksApi.updateShelf(bookId, shelf),
    onSuccess: (book) => invalidate(book.bookId),
  });
}

export function useDeleteBookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookId: number) => booksApi.delete(bookId).then(() => bookId),
    onSuccess: async (bookId) => {
      queryClient.removeQueries({ queryKey: bookKeys.detail(bookId) });
      await queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
    },
  });
}
