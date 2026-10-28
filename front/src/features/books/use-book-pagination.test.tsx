import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useInfiniteQuery } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBookPagination } from './use-book-pagination';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('book pagination observer', () => {
  it('deduplicates intersection requests, stops after failure, retries manually and disconnects', async () => {
    const observers: Array<{ notify: () => void; disconnect: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        disconnect = vi.fn();
        observe = vi.fn();
        constructor(callback: IntersectionObserverCallback) {
          observers.push({
            notify: () =>
              callback(
                [{ isIntersecting: true } as IntersectionObserverEntry],
                this as unknown as IntersectionObserver,
              ),
            disconnect: this.disconnect,
          });
        }
      },
    );
    let reject!: (error: Error) => void;
    const page = vi
      .fn<(cursor: number) => Promise<number>>()
      .mockResolvedValueOnce(1)
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValueOnce(2);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Results() {
      const query = useInfiniteQuery({
        queryKey: ['pagination'],
        queryFn: ({ pageParam }) => page(pageParam),
        initialPageParam: 1,
        getNextPageParam: (last) => (last === 1 ? 2 : undefined),
      });
      const sentinel = useBookPagination(query);
      return (
        <>
          <output>{query.data?.pages.join(',')}</output>
          {query.hasNextPage && (
            <div ref={sentinel}>
              <button onClick={() => void query.fetchNextPage()}>More</button>
            </div>
          )}
          {query.isFetchNextPageError && <p role="alert">Retry</p>}
        </>
      );
    }
    const view = render(
      <QueryClientProvider client={client}>
        <Results />
      </QueryClientProvider>,
    );
    await screen.findByText('1');
    const observer = observers.at(-1)!;
    act(() => {
      observer.notify();
      observer.notify();
    });
    await waitFor(() => expect(page).toHaveBeenCalledTimes(2));
    await act(async () => reject(new Error('page failed')));
    await screen.findByRole('alert');
    act(() => observer.notify());
    expect(page).toHaveBeenCalledTimes(2);
    expect(screen.getByText('1')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    await screen.findByText('1,2');
    expect(page).toHaveBeenCalledTimes(3);
    expect(page.mock.calls.map(([cursor]) => cursor)).toEqual([1, 2, 2]);
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
    view.unmount();
    expect(observers.every(({ disconnect }) => disconnect.mock.calls.length === 1)).toBe(true);
    client.clear();
  });

  it('keeps the manual load-more fallback without IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    function Manual() {
      const sentinel = useBookPagination({
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: false,
        isFetchNextPageError: false,
      });
      return (
        <div ref={sentinel}>
          <button>More</button>
        </div>
      );
    }
    render(<Manual />);
    expect(screen.getByRole('button', { name: 'More' })).toBeVisible();
  });
});
