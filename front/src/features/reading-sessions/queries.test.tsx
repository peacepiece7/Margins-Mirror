// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionKeys } from '@/lib/query-keys';

import { readingSessionsApi } from './api';
import { useCreateHighlightMutation } from './queries';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function timeline(label: string) {
  return { highlights: [{ highlightId: label }], sessionId: 3 } as never;
}

vi.mock('./api', () => ({
  readingSessionsApi: {
    createHighlight: vi.fn(),
    latestTimeline: vi.fn(),
    timeline: vi.fn(),
  },
}));

describe('reading-session mutations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes the returned authoritative timeline without immediately refetching it', async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const timeline = { highlights: [{ highlightId: 9 }], sessionId: 3 } as never;
    vi.mocked(readingSessionsApi.createHighlight).mockResolvedValue(timeline);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useCreateHighlightMutation(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ sessionId: 3, highlight: { quoteText: 'Bounded work' } }),
    );

    expect(queryClient.getQueryData(sessionKeys.timeline(3))).toBe(timeline);
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: sessionKeys.timeline(3) });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: sessionKeys.latest() });
  });

  it('does not let an older in-flight timeline read overwrite a successful mutation', async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const staleResponse = deferred<{ highlights: never[]; sessionId: number }>();
    const staleRead = queryClient
      .fetchQuery({
        queryFn: () => staleResponse.promise,
        queryKey: sessionKeys.timeline(3),
      })
      .catch(() => undefined);
    const timeline = { highlights: [{ highlightId: 9 }], sessionId: 3 } as never;
    vi.mocked(readingSessionsApi.createHighlight).mockResolvedValue(timeline);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useCreateHighlightMutation(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ sessionId: 3, highlight: { quoteText: 'Bounded work' } }),
    );
    staleResponse.resolve({ highlights: [], sessionId: 3 });
    await staleRead;

    expect(queryClient.getQueryData(sessionKeys.timeline(3))).toBe(timeline);
  });

  it('reconciles overlapping full-timeline mutations instead of trusting response order', async () => {
    const first = deferred<never>();
    const second = deferred<never>();
    vi.mocked(readingSessionsApi.createHighlight)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useCreateHighlightMutation(), { wrapper });

    act(() => {
      result.current.mutate({ sessionId: 3, highlight: { quoteText: 'First' } });
      result.current.mutate({ sessionId: 3, highlight: { quoteText: 'Second' } });
    });
    second.resolve(timeline('newer'));
    first.resolve(timeline('older'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: sessionKeys.timeline(3) });
  });
});
