import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogSearchResponse } from '@/types/api/catalog';
import { booksApi } from './api';
import { useCatalogSearch } from './catalog-queries';

const pending: CatalogSearchResponse = {
  snapshotId: 'empty',
  appliedResultVersion: 1,
  candidates: [],
  nextCursor: null,
  resultState: 'COLLECTING',
  freshness: 'UNKNOWN',
  visibleCount: 0,
  truncated: false,
  collection: {
    id: 'collection',
    generation: 1,
    resultVersion: 1,
    coverVersion: 0,
    state: 'COLLECTING',
    lastOutcome: 'NONE',
    succeededSourceCount: 0,
    failedSourceCount: 0,
  },
};
const ready: CatalogSearchResponse = {
  ...pending,
  snapshotId: 'ready',
  appliedResultVersion: 2,
  resultState: 'RESULTS',
  visibleCount: 1,
  candidates: [
    {
      catalogBookId: 1,
      candidateId: 'catalog:1',
      title: '마션',
      author: '앤디 위어',
      format: 'PRINT',
      coverStatus: 'MISSING',
      inLibrary: false,
      sources: [],
    },
  ],
  collection: { ...pending.collection, state: 'IDLE', resultVersion: 2, lastOutcome: 'SUCCEEDED' },
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('cold catalog search', () => {
  it('does not reuse an in-flight cover snapshot after browser history changes the query', async () => {
    const client = new QueryClient();
    let finishCover!: (response: CatalogSearchResponse) => void;
    const awaiting = {
      ...ready,
      candidates: ready.candidates.map((book) => ({ ...book, coverStatus: 'PENDING' as const })),
    };
    const restored = {
      ...ready,
      snapshotId: 'earthsea',
      candidates: ready.candidates.map((book) => ({ ...book, title: 'Earthsea' })),
    };
    vi.spyOn(booksApi, 'catalogSearch').mockResolvedValueOnce(awaiting).mockResolvedValue(restored);
    vi.spyOn(booksApi, 'catalogCollection').mockResolvedValue({
      ...ready.collection,
      coverVersion: 1,
    });
    vi.spyOn(booksApi, 'catalogPage').mockImplementation(
      () => new Promise((resolve) => (finishCover = resolve)),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/book/discover?q=Earthsea', '/book/discover?q=Dune']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({ catalog: useCatalogSearch(), navigate: useNavigate() }),
      { wrapper },
    );
    await waitFor(() => expect(booksApi.catalogPage).toHaveBeenCalledOnce());
    act(() => result.current.navigate(-1));
    await waitFor(() => expect(result.current.catalog.request.query).toBe('Earthsea'));
    await waitFor(() => expect(booksApi.catalogSearch).toHaveBeenCalledTimes(2));
    expect(vi.mocked(booksApi.catalogSearch).mock.calls[1][0]).toMatchObject({
      query: 'Earthsea',
      intent: 'REBUILD',
    });
    expect(booksApi.catalogPage).toHaveBeenCalledOnce();
    expect(vi.mocked(booksApi.catalogPage).mock.calls[0][2]?.aborted).toBe(true);
    await act(async () => finishCover(awaiting));
    await waitFor(() => expect(result.current.catalog.first?.snapshotId).toBe('earthsea'));
    expect(result.current.catalog.candidates.map((book) => book.title)).toEqual(['Earthsea']);
    client.clear();
  });

  it('does not carry an extension error into a different history entry', async () => {
    const client = new QueryClient();
    vi.spyOn(booksApi, 'catalogSearch').mockImplementation(async (request) => {
      if (request.intent === 'EXTEND') throw new Error('old extension failure');
      return ready;
    });
    vi.spyOn(booksApi, 'catalogCollection').mockResolvedValue(ready.collection);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/book/discover?q=Earthsea', '/book/discover?q=Dune']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({ catalog: useCatalogSearch(), navigate: useNavigate() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.catalog.candidates).toHaveLength(1));
    act(() => result.current.catalog.extend());
    await waitFor(() => expect(result.current.catalog.extendError).toBeInstanceOf(Error));
    act(() => result.current.navigate(-1));
    await waitFor(() => expect(result.current.catalog.request.query).toBe('Earthsea'));
    await waitFor(() => expect(result.current.catalog.extendError).toBeNull());
    client.clear();
  });

  it('rejects an invalid restored query even when a filter would normalize it below the limit', async () => {
    const client = new QueryClient();
    vi.spyOn(booksApi, 'catalogSearch').mockResolvedValue(ready);
    const query = `${' '.repeat(200)}x`;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/book/discover?q=${encodeURIComponent(query)}`]}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useCatalogSearch(), { wrapper });
    expect(booksApi.catalogSearch).not.toHaveBeenCalled();
    act(() => result.current.filter({ ...result.current.request, field: 'TITLE' }));
    await act(async () => {});
    expect(booksApi.catalogSearch).not.toHaveBeenCalled();
    expect(result.current.request.query).toBe(query);
    client.clear();
  });

  it('refreshes a shared pending cover without changing the snapshot or requiring a query version bump', async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    const awaiting = {
      ...ready,
      candidates: ready.candidates.map((book) => ({ ...book, coverStatus: 'PENDING' as const })),
    };
    vi.spyOn(booksApi, 'catalogSearch').mockResolvedValue(awaiting);
    vi.spyOn(booksApi, 'catalogCollection').mockResolvedValue(ready.collection);
    vi.spyOn(booksApi, 'catalogPage').mockResolvedValue({
      ...ready,
      candidates: ready.candidates.map((book) => ({
        ...book,
        coverStatus: 'READY' as const,
        thumbnail: '/api/catalog/covers/1/hash',
      })),
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/book/discover']}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useCatalogSearch(), { wrapper });
    act(() =>
      result.current.submit({ query: '앤디 위어', field: 'ALL', language: 'ALL', format: 'ALL' }),
    );
    for (let i = 0; i < 15; i++)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    expect(result.current.candidates[0].coverStatus).toBe('READY');
    expect(result.current.first?.snapshotId).toBe('ready');
    expect(booksApi.catalogSearch).toHaveBeenCalledOnce();
    client.clear();
  });
  it('keeps loaded pages during explicit extension and never auto-submits it', async () => {
    const client = new QueryClient();
    const collected = { ...ready, collection: { ...ready.collection, canExtend: true } };
    const collecting = {
      ...collected,
      collection: { ...collected.collection, state: 'COLLECTING' as const },
    };
    vi.spyOn(booksApi, 'catalogSearch')
      .mockResolvedValueOnce(collected)
      .mockResolvedValueOnce(collecting);
    vi.spyOn(booksApi, 'catalogCollection').mockResolvedValue(collected.collection);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/book/discover']}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useCatalogSearch(), { wrapper });
    act(() =>
      result.current.submit({ query: '앤디 위어', field: 'ALL', language: 'ALL', format: 'ALL' }),
    );
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(booksApi.catalogSearch).toHaveBeenCalledTimes(1);
    act(() => result.current.extend());
    await waitFor(() => expect(result.current.collection?.state).toBe('COLLECTING'));
    expect(result.current.first?.snapshotId).toBe('ready');
    expect(result.current.candidates).toHaveLength(1);
    expect(vi.mocked(booksApi.catalogSearch).mock.calls[1][0].intent).toBe('EXTEND');
    client.clear();
  });
  it.each([25_000, 60_000])(
    'automatically applies a first result after %ims, retrying a failed rebuild',
    async (delay) => {
      vi.useFakeTimers();
      const started = Date.now();
      const client = new QueryClient();
      vi.spyOn(booksApi, 'catalogSearch')
        .mockResolvedValueOnce(pending)
        .mockRejectedValueOnce(new Error('temporary failure'))
        .mockResolvedValue(ready);
      vi.spyOn(booksApi, 'catalogCollection').mockImplementation(async () =>
        Date.now() - started >= delay ? ready.collection : pending.collection,
      );
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={['/book/discover']}>{children}</MemoryRouter>
        </QueryClientProvider>
      );
      const { result } = renderHook(() => useCatalogSearch(), { wrapper });
      act(() =>
        result.current.submit({ query: '엔디 위어', field: 'ALL', language: 'ALL', format: 'ALL' }),
      );
      for (let elapsed = 0; elapsed < delay + 25_000; elapsed += 1000) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
      }
      expect(result.current.candidates.map((book) => book.title)).toEqual(['마션']);
      expect(
        vi.mocked(booksApi.catalogSearch).mock.calls.map(([request]) => request.intent),
      ).toEqual(['SUBMIT', 'REBUILD', 'REBUILD']);
      client.clear();
    },
  );
});
