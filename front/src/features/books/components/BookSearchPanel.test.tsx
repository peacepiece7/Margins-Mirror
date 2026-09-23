import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { booksApi } from '../api';
import type { CatalogCandidate, CatalogSearchResponse } from '@/types/api/catalog';
import { BookSearchPanel } from './BookSearchPanel';
import { FlashAlertProvider } from '@/components/ui/flash-alert';
import { ApiRequestError } from '@/lib/api-client';
import { AuthenticatedSessionGuardContext } from '@/lib/authenticated-session-guard';
import { writeAuthSession } from '@/lib/auth-session';
import { I18nProvider } from '@/lib/i18n';
import { useBookSelectionStore } from '../selection-store';

const candidate: CatalogCandidate = {
  author: 'Frank Herbert',
  candidateId: 'catalog:1',
  catalogBookId: 1,
  coverStatus: 'MISSING',
  format: 'PRINT',
  inLibrary: false,
  sources: [],
  title: 'Dune',
};

function response(overrides: Partial<CatalogSearchResponse> = {}): CatalogSearchResponse {
  return {
    snapshotId: 'snapshot-1',
    candidates: [candidate],
    nextCursor: null,
    resultState: 'RESULTS',
    freshness: 'FRESH',
    visibleCount: 1,
    truncated: false,
    collection: {
      id: 'collection-1',
      state: 'IDLE',
      lastOutcome: 'SUCCEEDED',
      generation: 1,
      resultVersion: 1,
      succeededSourceCount: 1,
      failedSourceCount: 0,
    },
    ...overrides,
  };
}

function apiError(code: string) {
  return {
    success: false,
    data: null,
    error: { code, fields: [], requestId: 'request-id' },
  };
}

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/book/discover']}>
        <I18nProvider>
          <FlashAlertProvider>
            <Routes>
              <Route path="/book/discover" element={<BookSearchPanel />} />
              <Route path="/book/library" element={<div>Library destination</div>} />
            </Routes>
          </FlashAlertProvider>
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderSessionPanel() {
  let active = true;
  const view = render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <AuthenticatedSessionGuardContext.Provider value={() => active}>
        <MemoryRouter initialEntries={['/book/discover']}>
          <I18nProvider>
            <FlashAlertProvider>
              <Routes>
                <Route path="/book/discover" element={<BookSearchPanel />} />
                <Route path="/book/library" element={<div>Library destination</div>} />
              </Routes>
            </FlashAlertProvider>
          </I18nProvider>
        </MemoryRouter>
      </AuthenticatedSessionGuardContext.Provider>
    </QueryClientProvider>,
  );
  return { ...view, rotateSession: () => (active = false) };
}

async function searchForCandidate(view: ReturnType<typeof renderPanel>) {
  fireEvent.change(view.getByTestId('book-search-input'), { target: { value: 'Dune' } });
  fireEvent.click(view.getByTestId('book-search-submit'));
  await waitFor(() => expect(view.getByTestId('book-candidate-save')).toBeVisible());
}

function expectEditorialCard(card: Element | null, borderClass: string) {
  expect(card).not.toBeNull();
  expect(card).toHaveClass('rounded', borderClass, 'ring-0');
  expect(card).not.toHaveClass('rounded-xl');
  expect(card).not.toHaveClass('ring-1');
}

describe('BookSearchPanel save feedback', () => {
  it('changing filters rebuilds only the committed keyword without collecting', async () => {
    const view = renderPanel();
    await searchForCandidate(view);
    fireEvent.change(view.getByTestId('book-search-input'), {
      target: { value: 'Unsubmitted draft' },
    });
    const fieldControl = view.container.querySelector<HTMLSelectElement>('select[name="field"]');
    expect(fieldControl).not.toBeNull();
    fireEvent.change(fieldControl!, { target: { value: 'AUTHOR' } });
    await waitFor(() => expect(booksApi.catalogSearch).toHaveBeenCalledTimes(2));
    expect(vi.mocked(booksApi.catalogSearch).mock.calls[1][0]).toMatchObject({
      query: 'Dune',
      field: 'AUTHOR',
      intent: 'REBUILD',
    });
  });

  it('automatically displays the first collected result without another SUBMIT', async () => {
    const pending = response({ candidates: [], resultState: 'COLLECTING', freshness: 'UNKNOWN' });
    pending.collection = {
      ...pending.collection,
      state: 'COLLECTING',
      resultVersion: 1,
      lastOutcome: 'NONE',
    };
    vi.mocked(booksApi.catalogSearch).mockResolvedValueOnce(pending).mockResolvedValue(response());
    vi.spyOn(booksApi, 'catalogCollection').mockResolvedValue({
      ...pending.collection,
      state: 'IDLE',
      resultVersion: 2,
      lastOutcome: 'SUCCEEDED',
    });
    const view = renderPanel();
    await searchForCandidate(view);
    expect(booksApi.catalogSearch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(booksApi.catalogSearch).mock.calls[1][0].intent).toBe('REBUILD');
  });

  it('automatically displays a cover completed after idle metadata collection', async () => {
    const pending = response({
      candidates: [{ ...candidate, coverStatus: 'PENDING' }],
    });
    vi.mocked(booksApi.catalogSearch).mockResolvedValueOnce(pending);
    vi.spyOn(booksApi, 'catalogPage').mockResolvedValue(
      response({
        candidates: [
          {
            ...candidate,
            coverStatus: 'READY',
            thumbnail: '/api/catalog/covers/1/hash',
          },
        ],
        collection: { ...pending.collection, coverVersion: 1 },
      }),
    );
    vi.spyOn(booksApi, 'catalogCollection').mockResolvedValue({
      ...pending.collection,
      coverVersion: 1,
    });

    const view = renderPanel();
    await searchForCandidate(view);

    await waitFor(() => expect(booksApi.catalogPage).toHaveBeenCalledTimes(1));
    expect(booksApi.catalogSearch).toHaveBeenCalledTimes(1);
    expect(await view.findByTestId('book-candidate-cover')).toHaveAttribute(
      'src',
      '/api/catalog/covers/1/hash',
    );
    expect(view.queryByRole('button', { name: '새 결과 보기' })).not.toBeInTheDocument();
  });

  it('refreshes a pending cover on a loaded later page without dropping loaded results', async () => {
    let finishCover!: (value: CatalogSearchResponse['collection']) => void;
    const firstPage = response({ nextCursor: 'page-2', visibleCount: 2 });
    const secondCandidate = {
      ...candidate,
      candidateId: 'catalog:2',
      catalogBookId: 2,
      title: 'Earthsea',
      coverStatus: 'PENDING' as const,
    };
    const rebuiltFirstPage = response({
      snapshotId: 'snapshot-1',
      nextCursor: 'page-2',
      visibleCount: 2,
      collection: { ...firstPage.collection, coverVersion: 1 },
    });
    vi.mocked(booksApi.catalogSearch)
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValue(rebuiltFirstPage);
    vi.spyOn(booksApi, 'catalogPage')
      .mockResolvedValueOnce(
        response({
          candidates: [secondCandidate],
          nextCursor: null,
          visibleCount: 2,
        }),
      )
      .mockResolvedValueOnce(rebuiltFirstPage)
      .mockResolvedValueOnce(
        response({
          snapshotId: 'snapshot-1',
          candidates: [
            {
              ...secondCandidate,
              coverStatus: 'READY',
              thumbnail: '/api/catalog/covers/2/hash',
            },
          ],
          nextCursor: null,
          visibleCount: 2,
          collection: { ...firstPage.collection, coverVersion: 1 },
        }),
      );
    vi.spyOn(booksApi, 'catalogCollection').mockImplementation(
      () => new Promise((resolve) => (finishCover = resolve)),
    );

    const view = renderPanel();
    await searchForCandidate(view);
    fireEvent.click(view.getByTestId('book-candidate-load-more'));
    await waitFor(() => expect(view.getAllByTestId('book-candidate-card')).toHaveLength(2));
    await waitFor(() => expect(booksApi.catalogCollection).toHaveBeenCalledTimes(1));

    finishCover({ ...firstPage.collection, coverVersion: 1 });

    await waitFor(() => expect(booksApi.catalogPage).toHaveBeenCalledTimes(3));
    expect(booksApi.catalogSearch).toHaveBeenCalledTimes(1);
    expect(view.getAllByTestId('book-candidate-card')).toHaveLength(2);
    expect(view.getByTestId('book-candidate-cover')).toHaveAttribute(
      'src',
      '/api/catalog/covers/2/hash',
    );
  });

  it('keeps nonempty results until the reader explicitly applies an update', async () => {
    const first = response();
    first.collection = { ...first.collection, state: 'COLLECTING' };
    vi.mocked(booksApi.catalogSearch)
      .mockResolvedValueOnce(first)
      .mockResolvedValue(
        response({
          candidates: [{ ...candidate, catalogBookId: 2, title: 'New edition' }],
        }),
      );
    vi.spyOn(booksApi, 'catalogCollection').mockResolvedValue({
      ...first.collection,
      state: 'IDLE',
      resultVersion: 2,
    });
    const view = renderPanel();
    await searchForCandidate(view);
    const apply = await view.findByRole('button', { name: '새 결과 보기' });
    expect(view.getByTestId('book-candidate-title')).toHaveTextContent('Dune');
    expect(booksApi.catalogSearch).toHaveBeenCalledTimes(1);
    fireEvent.click(apply);
    expect(await view.findByText('New edition')).toBeVisible();
  });

  it('clearing the query aborts an in-flight request', async () => {
    vi.mocked(booksApi.catalogSearch).mockImplementation(() => new Promise(() => {}));
    const view = renderPanel();
    fireEvent.change(view.getByTestId('book-search-input'), { target: { value: 'Dune' } });
    fireEvent.click(view.getByTestId('book-search-submit'));
    await waitFor(() => expect(booksApi.catalogSearch).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(booksApi.catalogSearch).mock.calls[0][1]!;
    fireEvent.click(view.getByRole('button', { name: '지우기' }));
    await waitFor(() => expect(signal.aborted).toBe(true));
    await waitFor(() => expect(view.getByTestId('book-search-input')).toHaveValue(''));
  });

  it('replaces an unavailable DB image with a stable placeholder', async () => {
    vi.mocked(booksApi.catalogSearch).mockResolvedValue(
      response({
        candidates: [
          { ...candidate, thumbnail: '/api/catalog/covers/1/hash', coverStatus: 'READY' },
        ],
      }),
    );
    const view = renderPanel();
    await searchForCandidate(view);
    const cover = view.getByTestId('book-candidate-cover');
    expect(cover).toHaveClass('object-contain');
    fireEvent.error(cover);
    expect(view.queryByTestId('book-candidate-cover')).not.toBeInTheDocument();
    expect(view.getByTitle('표지 없음')).toBeVisible();
    expect(view.getByTestId('book-candidate-save')).toBeEnabled();
  });

  it('validates the 200-character search boundary without a network request', async () => {
    const view = renderPanel();
    expect(view.getByTestId('book-search-validation-slot')).toHaveClass('min-h-10', 'sm:min-h-5');
    fireEvent.change(view.getByTestId('book-search-input'), { target: { value: 'x'.repeat(201) } });
    fireEvent.click(view.getByTestId('book-search-submit'));
    expect(await view.findByRole('alert')).toHaveTextContent('1~200자');
    expect(booksApi.catalogSearch).not.toHaveBeenCalled();
  });

  it('uses the shared Radix select triggers for every catalog filter', () => {
    const view = renderPanel();
    const filters = [
      view.getByTestId('book-search-field-select'),
      view.getByTestId('book-search-language-select'),
      view.getByTestId('book-search-format-select'),
    ];

    for (const filter of filters) {
      expect(filter).toHaveAttribute('data-slot', 'select-trigger');
      expect(filter).toHaveClass('min-h-11', 'w-full');
    }
    expect(view.container.querySelector('[data-slot="native-select"]')).not.toBeInTheDocument();
  });
  beforeEach(() => {
    window.localStorage.setItem('margins.locale', 'ko');
    vi.spyOn(booksApi, 'catalogSearch').mockResolvedValue(response());
    vi.spyOn(booksApi, 'catalogCapabilities').mockResolvedValue({ operator: false });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    useBookSelectionStore.setState({ selectedBookId: undefined });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('keeps search, candidate, and manual book cards on the editorial surface', async () => {
    const view = renderPanel();
    await searchForCandidate(view);

    expectEditorialCard(
      view.getByTestId('book-search-page').querySelector('[data-slot="card"]'),
      'border-stone-300',
    );
    expectEditorialCard(view.getByTestId('book-candidate-card'), 'border-stone-300');
    expectEditorialCard(
      view.getByTestId('manual-book-form').closest('[data-slot="card"]'),
      'border-stone-300',
    );
  });

  it('loads the signed snapshot page without another provider search', async () => {
    vi.mocked(booksApi.catalogSearch).mockResolvedValue(
      response({ nextCursor: 'signed-cursor', visibleCount: 2 }),
    );
    vi.spyOn(booksApi, 'catalogPage').mockResolvedValue(
      response({
        candidates: [
          { ...candidate, catalogBookId: 2, candidateId: 'catalog:2', title: 'Earthsea' },
        ],
        nextCursor: null,
        visibleCount: 2,
      }),
    );
    const view = renderPanel();
    await searchForCandidate(view);
    fireEvent.click(view.getByTestId('book-candidate-load-more'));
    await waitFor(() => expect(view.getAllByTestId('book-candidate-card')).toHaveLength(2));
    expect(booksApi.catalogSearch).toHaveBeenCalledTimes(1);
    expect(booksApi.catalogPage).toHaveBeenCalledWith(
      'snapshot-1',
      'signed-cursor',
      expect.any(AbortSignal),
    );
  });

  it('preserves saved-book feedback and Library navigation', async () => {
    vi.spyOn(booksApi, 'saveCatalog').mockResolvedValue({
      author: candidate.author,
      bookId: 7,
      title: candidate.title,
    });
    const view = renderPanel();
    await searchForCandidate(view);

    fireEvent.click(view.getByTestId('book-candidate-save'));

    expect(await view.findByText('Library destination')).toBeVisible();
    expect(view.getByTestId('flash-alert')).toHaveTextContent('책이 추가되었습니다.');
  });

  it('keeps a same-user save continuation visible across access-token refresh', async () => {
    writeAuthSession({
      userId: 1,
      username: 'reader',
      displayName: 'Reader',
      authMode: 'local-jwt',
      accessToken: 'expired-a',
      accessTokenExpiresInSeconds: 900,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        if (input === '/api/auth/refresh') {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                userId: 1,
                username: 'reader',
                displayName: 'Reader',
                authMode: 'local-jwt',
                accessToken: 'fresh-a',
                accessTokenExpiresInSeconds: 900,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        const headers = init?.headers as Record<string, string>;
        if (headers.Authorization === 'Bearer expired-a') {
          return new Response(JSON.stringify(apiError('COMMON_UNAUTHORIZED')), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            success: true,
            data: { author: candidate.author, bookId: 7, title: candidate.title },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );
    const view = renderSessionPanel();
    await searchForCandidate(view);

    fireEvent.click(view.getByTestId('book-candidate-save'));

    expect(await view.findByText('Library destination')).toBeVisible();
    expect(view.getByTestId('flash-alert')).toHaveTextContent('책이 추가되었습니다.');
  });

  it('shows a localized project alert when an existing book cannot be added again', async () => {
    vi.spyOn(booksApi, 'saveCatalog').mockRejectedValue(
      new ApiRequestError('BOOK_ALREADY_EXISTS', 409),
    );
    const view = renderPanel();
    await searchForCandidate(view);

    fireEvent.click(view.getByTestId('book-candidate-save'));

    expect(await view.findByText('내 서재에 있음')).toBeVisible();
    expect(view.queryByText('Library destination')).not.toBeInTheDocument();
  });

  it('ignores a book-save continuation after the authenticated session rotates', async () => {
    let resolveSave!: (book: { author: string; bookId: number; title: string }) => void;
    vi.spyOn(booksApi, 'saveCatalog').mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const view = renderSessionPanel();
    await searchForCandidate(view);

    fireEvent.click(view.getByTestId('book-candidate-save'));
    view.rotateSession();
    resolveSave({ author: candidate.author, bookId: 7, title: candidate.title });

    await waitFor(() => expect(view.queryByTestId('flash-alert')).not.toBeInTheDocument());
    expect(useBookSelectionStore.getState().selectedBookId).toBeUndefined();
    expect(view.queryByText('Library destination')).not.toBeInTheDocument();
  });

  it('blocks an invalid manual add and associates both required errors', async () => {
    const save = vi.spyOn(booksApi, 'saveCatalog').mockResolvedValue({
      author: 'Reader',
      bookId: 8,
      title: 'Manual',
    });
    const view = renderPanel();
    const title = view.getByTestId('manual-book-title-input');

    fireEvent.submit(title.closest('form')!);

    expect(await view.findAllByText('필수 입력 항목입니다.')).toHaveLength(2);
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAttribute('aria-describedby', 'manual-book-title-error');
    expect(view.getByTestId('manual-book-author-input')).toHaveAttribute(
      'aria-describedby',
      'manual-book-author-error',
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('shows an empty result state after a completed search', async () => {
    vi.mocked(booksApi.catalogSearch).mockResolvedValue(
      response({ candidates: [], resultState: 'EMPTY', visibleCount: 0 }),
    );
    const view = renderPanel();

    fireEvent.change(view.getByTestId('book-search-input'), { target: { value: 'Missing' } });
    fireEvent.click(view.getByTestId('book-search-submit'));

    expect(
      await view.findByText('일치하는 판본이 없습니다. 다른 검색어나 필터로 확인해 주세요.'),
    ).toBeVisible();
  });

  it('clears the committed search and its cached candidates without changing the page', async () => {
    const view = renderPanel();
    await searchForCandidate(view);

    fireEvent.click(view.getByRole('button', { name: '지우기' }));

    await waitFor(() => expect(view.queryByTestId('book-candidate-save')).not.toBeInTheDocument());
    expect(view.getByTestId('book-search-input')).toHaveValue('');
    expect(view.getByTestId('book-search-page')).toBeVisible();
    expect(booksApi.catalogSearch).toHaveBeenCalledTimes(1);
  });

  it('retries a failed search without changing the committed query', async () => {
    vi.mocked(booksApi.catalogSearch)
      .mockRejectedValueOnce(new Error('search failed'))
      .mockResolvedValueOnce(response());
    const view = renderPanel();

    fireEvent.change(view.getByTestId('book-search-input'), { target: { value: 'Dune' } });
    fireEvent.click(view.getByTestId('book-search-submit'));
    expect(await view.findByText('요청을 처리하지 못했습니다. 다시 시도해 주세요.')).toBeVisible();
    fireEvent.click(view.getByRole('button', { name: '수집 결과 확인' }));

    expect(await view.findByTestId('book-candidate-save')).toBeVisible();
    expect(view.getByTestId('book-search-input')).toHaveValue('Dune');
    expect(booksApi.catalogSearch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(booksApi.catalogSearch).mock.calls[1][0].intent).toBe('REBUILD');
  });
});
