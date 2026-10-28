// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionKeys } from '@/lib/query-keys';

import { debatesApi } from './api';
import { useCreateDebateRoomMutation } from './queries';

vi.mock('./api', () => ({
  debatesApi: {
    createWindow: vi.fn(),
    ensureReadingSession: vi.fn(),
  },
}));

describe('useCreateDebateRoomMutation', () => {
  beforeEach(() => vi.clearAllMocks());

  function wrapper(queryClient: QueryClient) {
    return function QueryWrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    };
  }

  it('ensures a missing reading session once before creating a room', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(debatesApi.ensureReadingSession).mockResolvedValue({
      sessionId: 3,
      title: 'Dune debate',
    });
    vi.mocked(debatesApi.createWindow).mockResolvedValue({
      personaIds: [8, 7],
      sessionId: 3,
      status: 'ACTIVE',
      title: 'Debate: Power',
      windowId: 11,
      windowType: 'debate',
    });
    const { result } = renderHook(() => useCreateDebateRoomMutation(7), {
      wrapper: wrapper(queryClient),
    });

    await act(() =>
      result.current.mutateAsync({
        personaIds: [8, 7],
        topic: 'Power',
      }),
    );

    expect(debatesApi.ensureReadingSession).toHaveBeenCalledOnce();
    expect(debatesApi.ensureReadingSession).toHaveBeenCalledWith(7);
    expect(debatesApi.createWindow).toHaveBeenCalledWith(3, 'debate', 'Debate: Power', [8, 7]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: sessionKeys.book(7) });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: sessionKeys.timeline(3) });
  });

  it('reuses an existing reading session without calling ensure', async () => {
    const queryClient = new QueryClient();
    vi.mocked(debatesApi.createWindow).mockResolvedValue({
      personaIds: [8],
      sessionId: 4,
      status: 'ACTIVE',
      title: 'Debate: Power',
      windowId: 11,
      windowType: 'debate',
    });
    const { result } = renderHook(() => useCreateDebateRoomMutation(7), {
      wrapper: wrapper(queryClient),
    });

    await act(() =>
      result.current.mutateAsync({
        personaIds: [8],
        sessionId: 4,
        topic: 'Power',
      }),
    );

    expect(debatesApi.ensureReadingSession).not.toHaveBeenCalled();
    expect(debatesApi.createWindow).toHaveBeenCalledWith(4, 'debate', 'Debate: Power', [8]);
  });
});
