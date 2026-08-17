import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { booksApi } from '../api';
import { BookSearchPanel } from './BookSearchPanel';
import { FlashAlertProvider } from '@/components/ui/flash-alert';
import { ApiRequestError } from '@/lib/api-client';
import { AuthenticatedSessionGuardContext } from '@/lib/authenticated-session-guard';
import { writeAuthSession } from '@/lib/auth-session';
import { I18nProvider } from '@/lib/i18n';
import { useBookSelectionStore } from '../selection-store';

const candidate = {
  author: 'Frank Herbert',
  candidateId: 'google:dune',
  title: 'Dune',
};

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
  beforeEach(() => {
    window.localStorage.setItem('margins.locale', 'ko');
    vi.spyOn(booksApi, 'searchCandidates').mockResolvedValue({
      candidates: [candidate],
      hasMore: false,
      limit: 5,
      page: 1,
      totalItems: 1,
    });
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

  it('loads and appends the next page when the result sentinel intersects', async () => {
    class ImmediateIntersectionObserver {
      constructor(private readonly callback: IntersectionObserverCallback) {}

      observe(target: Element) {
        this.callback(
          [{ isIntersecting: true, target } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }

      disconnect() {}

      unobserve() {}
    }
    vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver);
    vi.mocked(booksApi.searchCandidates)
      .mockReset()
      .mockResolvedValueOnce({
        candidates: [candidate],
        hasMore: true,
        limit: 5,
        page: 1,
        totalItems: 2,
      })
      .mockResolvedValueOnce({
        candidates: [
          { author: 'Ursula K. Le Guin', candidateId: 'google:earthsea', title: 'Earthsea' },
        ],
        hasMore: false,
        limit: 5,
        page: 2,
        totalItems: 2,
      });
    const view = renderPanel();

    await searchForCandidate(view);

    await waitFor(() => expect(view.getAllByTestId('book-candidate-card')).toHaveLength(2));
    expect(booksApi.searchCandidates).toHaveBeenNthCalledWith(2, 'Dune', 2, 5);
  });

  it('shows a project alert after adding a new book and moves to Library', async () => {
    vi.spyOn(booksApi, 'save').mockResolvedValue({
      author: candidate.author,
      bookId: 7,
      title: candidate.title,
    });
    const view = renderPanel();
    await searchForCandidate(view);

    fireEvent.click(view.getByTestId('book-candidate-save'));

    await waitFor(() =>
      expect(view.getByTestId('flash-alert')).toHaveTextContent('책이 추가되었습니다.'),
    );
    expect(view.getByText('Library destination')).toBeVisible();
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

    await waitFor(() =>
      expect(view.getByTestId('flash-alert')).toHaveTextContent('책이 추가되었습니다.'),
    );
    expect(view.getByText('Library destination')).toBeVisible();
  });

  it('shows a localized project alert when an existing book cannot be added again', async () => {
    vi.spyOn(booksApi, 'save').mockRejectedValue(new ApiRequestError('BOOK_ALREADY_EXISTS', 409));
    const view = renderPanel();
    await searchForCandidate(view);

    fireEvent.click(view.getByTestId('book-candidate-save'));

    await waitFor(() =>
      expect(view.getByTestId('flash-alert')).toHaveTextContent('이미 추가된 책입니다.'),
    );
    expect(view.queryByText('Library destination')).not.toBeInTheDocument();
  });

  it('ignores a book-save continuation after the authenticated session rotates', async () => {
    let resolveSave!: (book: { author: string; bookId: number; title: string }) => void;
    vi.spyOn(booksApi, 'save').mockReturnValue(
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
    const save = vi.spyOn(booksApi, 'save').mockResolvedValue({
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
    vi.mocked(booksApi.searchCandidates).mockResolvedValue({
      candidates: [],
      hasMore: false,
      limit: 5,
      page: 1,
      totalItems: 0,
    });
    const view = renderPanel();

    fireEvent.change(view.getByTestId('book-search-input'), { target: { value: 'Missing' } });
    fireEvent.click(view.getByTestId('book-search-submit'));

    await waitFor(() => expect(view.getAllByText('검색 결과가 없을 때 직접 등록')).toHaveLength(2));
  });

  it('clears the committed search and its cached candidates without changing the page', async () => {
    const view = renderPanel();
    await searchForCandidate(view);

    fireEvent.click(view.getByRole('button', { name: '지우기' }));

    await waitFor(() => expect(view.queryByTestId('book-candidate-save')).not.toBeInTheDocument());
    expect(view.getByTestId('book-search-input')).toHaveValue('');
    expect(view.getByTestId('book-search-page')).toBeVisible();
    expect(booksApi.searchCandidates).toHaveBeenCalledTimes(1);
  });

  it('retries a failed search without changing the committed query', async () => {
    vi.mocked(booksApi.searchCandidates)
      .mockRejectedValueOnce(new Error('search failed'))
      .mockResolvedValueOnce({
        candidates: [candidate],
        hasMore: false,
        limit: 5,
        page: 1,
        totalItems: 1,
      });
    const view = renderPanel();

    fireEvent.change(view.getByTestId('book-search-input'), { target: { value: 'Dune' } });
    fireEvent.click(view.getByTestId('book-search-submit'));
    expect(await view.findByText('요청을 처리하지 못했습니다. 다시 시도해 주세요.')).toBeVisible();
    fireEvent.click(view.getByRole('button', { name: '다시 시도' }));

    expect(await view.findByTestId('book-candidate-save')).toBeVisible();
    expect(view.getByTestId('book-search-input')).toHaveValue('Dune');
    expect(booksApi.searchCandidates).toHaveBeenCalledTimes(2);
  });
});
