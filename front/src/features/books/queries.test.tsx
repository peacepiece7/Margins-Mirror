import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { bookKeys } from '@/lib/query-keys';
import { booksApi } from './api';
import {
  useBookSearchInfiniteQuery,
  useRegenerateBookKnowledgeMutation,
  useUpdateBookMutation,
} from './queries';

describe('book query mutations', () => {
  it('invalidates the related book and lists without touching another detail', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(bookKeys.list(), { books: [] });
    client.setQueryData(bookKeys.detail(7), { bookId: 7 });
    client.setQueryData(bookKeys.detail(8), { bookId: 8 });
    vi.spyOn(booksApi, 'update').mockResolvedValue({
      bookId: 7,
      title: 'Updated',
      author: 'Reader',
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateBookMutation(), { wrapper });

    await act(() => result.current.mutateAsync({ bookId: 7, title: 'Updated', author: 'Reader' }));

    expect(client.getQueryState(bookKeys.list())?.isInvalidated).toBe(true);
    expect(client.getQueryState(bookKeys.detail(7))?.isInvalidated).toBe(true);
    expect(client.getQueryState(bookKeys.detail(8))?.isInvalidated).toBe(false);
  });
});

describe('Book Knowledge mutation', () => {
  it('replaces the exact knowledge cache after explicit regeneration', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const knowledge = {
      discussionPoints: [],
      fallbackUsed: false,
      famousQuotes: [],
      keywords: [],
      knowledgeId: 7,
      recommendedPersonas: [],
      refreshPending: false,
      stale: false,
      status: 'ready',
      themes: [],
      title: 'Updated knowledge',
      version: 'book-knowledge-v1',
    };
    vi.spyOn(booksApi, 'regenerateKnowledge').mockResolvedValue(knowledge);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRegenerateBookKnowledgeMutation(7), {
      wrapper,
    });

    await act(() => result.current.mutateAsync());

    expect(client.getQueryData(bookKeys.knowledge(7))).toEqual(knowledge);
  });
});

describe('book candidate infinite query', () => {
  it('appends the next search page to the existing candidates', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(booksApi, 'searchCandidates')
      .mockResolvedValueOnce({
        candidates: [{ author: 'Author 1', candidateId: 'candidate-1', title: 'Book 1' }],
        hasMore: true,
        limit: 5,
        page: 1,
      })
      .mockResolvedValueOnce({
        candidates: [{ author: 'Author 2', candidateId: 'candidate-2', title: 'Book 2' }],
        hasMore: false,
        limit: 5,
        page: 2,
      });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useBookSearchInfiniteQuery('book', 5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    let fetchedPages = 0;
    await act(async () => {
      const fetched = await result.current.fetchNextPage();
      fetchedPages = fetched.data?.pages.flatMap((page) => page.candidates).length ?? 0;
    });

    expect(booksApi.searchCandidates).toHaveBeenNthCalledWith(1, 'book', 1, 5);
    expect(booksApi.searchCandidates).toHaveBeenNthCalledWith(2, 'book', 2, 5);
    expect(fetchedPages).toBe(2);
  });
});
