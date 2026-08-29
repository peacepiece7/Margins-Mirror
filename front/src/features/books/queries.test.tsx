import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bookKeys } from '@/lib/query-keys';
import { booksApi } from './api';
import {
  useBookKnowledgeQuery,
  useBookSearchInfiniteQuery,
  useRegenerateBookKnowledgeMutation,
  useUpdateBookMutation,
} from './queries';

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

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
      generationLocale: 'en' as const,
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

    expect(client.getQueryData(bookKeys.knowledge(7, 'en'))).toEqual(knowledge);
    expect(client.getQueryData(bookKeys.knowledge(7, 'ko'))).toBeUndefined();
  });

  it('keeps an in-flight response under its captured persisted locale key', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    sessionStorage.setItem('margins.auth', JSON.stringify({ preferredLocale: 'en' }));
    let resolveEnglish!: (value: Awaited<ReturnType<typeof booksApi.knowledge>>) => void;
    const english = new Promise<Awaited<ReturnType<typeof booksApi.knowledge>>>((resolve) => {
      resolveEnglish = resolve;
    });
    vi.spyOn(booksApi, 'knowledge').mockReturnValueOnce(english).mockResolvedValueOnce({
      discussionPoints: [],
      famousQuotes: [],
      generationLocale: 'ko',
      keywords: [],
      knowledgeId: 8,
      recommendedPersonas: [],
      status: 'ready',
      themes: [],
      title: '한국어 지식',
      version: 'book-knowledge-v1',
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { rerender } = renderHook(() => useBookKnowledgeQuery(7), { wrapper });
    await waitFor(() => expect(booksApi.knowledge).toHaveBeenCalledTimes(1));

    sessionStorage.setItem('margins.auth', JSON.stringify({ preferredLocale: 'ko' }));
    rerender();
    await waitFor(() => expect(booksApi.knowledge).toHaveBeenCalledTimes(2));
    resolveEnglish({
      discussionPoints: [],
      famousQuotes: [],
      generationLocale: 'en',
      keywords: [],
      knowledgeId: 7,
      recommendedPersonas: [],
      status: 'ready',
      themes: [],
      title: 'English knowledge',
      version: 'book-knowledge-v1',
    });

    await waitFor(() => {
      expect(client.getQueryData(bookKeys.knowledge(7, 'en'))).toMatchObject({ knowledgeId: 7 });
      expect(client.getQueryData(bookKeys.knowledge(7, 'ko'))).toMatchObject({ knowledgeId: 8 });
    });
  });

  it('keeps an in-flight regeneration under its captured persisted locale key', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    sessionStorage.setItem('margins.auth', JSON.stringify({ preferredLocale: 'en' }));
    let resolveRegeneration!: (
      value: Awaited<ReturnType<typeof booksApi.regenerateKnowledge>>,
    ) => void;
    vi.spyOn(booksApi, 'regenerateKnowledge').mockReturnValue(
      new Promise((resolve) => {
        resolveRegeneration = resolve;
      }),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRegenerateBookKnowledgeMutation(7), { wrapper });

    const pending = result.current.mutateAsync();
    sessionStorage.setItem('margins.auth', JSON.stringify({ preferredLocale: 'ko' }));
    resolveRegeneration({
      discussionPoints: [],
      famousQuotes: [],
      generationLocale: 'en',
      keywords: [],
      knowledgeId: 9,
      recommendedPersonas: [],
      status: 'ready',
      themes: [],
      title: 'Regenerated English knowledge',
      version: 'book-knowledge-v1',
    });
    await act(() => pending);

    expect(client.getQueryData(bookKeys.knowledge(7, 'en'))).toMatchObject({ knowledgeId: 9 });
    expect(client.getQueryData(bookKeys.knowledge(7, 'ko'))).toBeUndefined();
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
