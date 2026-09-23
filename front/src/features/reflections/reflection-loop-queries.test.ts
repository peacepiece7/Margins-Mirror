// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { reflectionLoopKeys, sessionKeys } from '@/lib/query-keys';
import type { ReadingSessionTimelineResponse } from '@/types/api/session';

import { reflectionsApi } from './api';
import {
  useCompleteDiscussionRunMutation,
  useCreateDiscussionRunMutation,
  mergeGuidedDiscussionMessages,
  useGuidedDiscussionTurnMutation,
  useSavePrimaryReflectionMutation,
} from './reflection-loop-queries';

vi.mock('./api', () => ({
  reflectionsApi: {
    completeRun: vi.fn(),
    createReflection: vi.fn(),
    createRun: vi.fn(),
    ensureReadingSession: vi.fn(),
    turn: vi.fn(),
  },
}));

describe('reflection loop queries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ensures a missing reading session once when the reader saves a Reflection', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(reflectionsApi.ensureReadingSession).mockResolvedValue({
      sessionId: 3,
      title: 'Dune reflection',
    });
    vi.mocked(reflectionsApi.createReflection).mockResolvedValue({
      currentRevision: {
        content: '처음 남기는 생각',
        revisionId: 21,
        revisionSource: 'INITIAL',
        version: 1,
      },
      reflectionId: 11,
      revisions: [],
      sessionId: 3,
      visibility: 'PRIVATE',
    });

    function wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    }
    const { result } = renderHook(() => useSavePrimaryReflectionMutation(7, undefined, undefined), {
      wrapper,
    });

    await act(() =>
      result.current.mutateAsync({ content: '처음 남기는 생각', visibility: 'PRIVATE' }),
    );

    expect(reflectionsApi.ensureReadingSession).toHaveBeenCalledOnce();
    expect(reflectionsApi.ensureReadingSession).toHaveBeenCalledWith(7);
    expect(reflectionsApi.createReflection).toHaveBeenCalledWith(3, {
      content: '처음 남기는 생각',
      visibility: 'PRIVATE',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: sessionKeys.book(7) });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: sessionKeys.timeline(3) });
  });

  it('does not retry a failed reading-session ensure inside one save action', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    vi.mocked(reflectionsApi.ensureReadingSession).mockRejectedValueOnce(
      new Error('service unavailable'),
    );

    function wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    }
    const { result } = renderHook(() => useSavePrimaryReflectionMutation(7, undefined, undefined), {
      wrapper,
    });

    await expect(
      act(() => result.current.mutateAsync({ content: '처음 남기는 생각', visibility: 'PRIVATE' })),
    ).rejects.toThrow('service unavailable');

    expect(reflectionsApi.ensureReadingSession).toHaveBeenCalledOnce();
    expect(reflectionsApi.createReflection).not.toHaveBeenCalled();
  });

  it('appends new turn messages without duplicating persisted history', () => {
    const timeline = {
      sessionId: 3,
      messages: [
        {
          messageId: 10,
          sessionId: 3,
          windowId: 13,
          role: 'user',
          content: '이전 답변',
          messageOrder: 1,
          streamingStatus: 'completed',
          createdAt: '2026-08-14T00:00:00Z',
        },
      ],
    } as ReadingSessionTimelineResponse;

    const updated = mergeGuidedDiscussionMessages(timeline, [
      {
        messageId: 10,
        windowId: 13,
        role: 'user',
        content: '이전 답변',
        streamingReady: false,
        aiModel: 'reader',
      },
      {
        messageId: 11,
        windowId: 13,
        role: 'assistant',
        content: 'Director 응답',
        streamingReady: false,
        aiModel: 'director',
      },
    ]);

    expect(updated.messages.map((message) => message.messageId)).toEqual([10, 11]);
    expect(updated.messages.at(-1)).toMatchObject({
      sessionId: 3,
      windowId: 13,
      role: 'assistant',
      content: 'Director 응답',
    });
  });

  it('merges the response and refetches only the active timeline cache', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const timeline = {
      sessionId: 3,
      messages: [],
    } as unknown as ReadingSessionTimelineResponse;
    queryClient.setQueryData(sessionKeys.timeline(3), timeline);
    vi.mocked(reflectionsApi.turn).mockResolvedValue({
      runId: 9,
      runStatus: 'ACTIVE',
      messages: [
        {
          messageId: 11,
          windowId: 13,
          role: 'assistant',
          content: 'Director 응답',
          streamingReady: false,
          aiModel: 'director',
        },
      ],
    });

    function wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    }
    const { result } = renderHook(() => useGuidedDiscussionTurnMutation(9, 3), { wrapper });

    await act(() => result.current.mutateAsync({ content: '새 답변', navigation: 'RESPOND' }));

    expect(
      queryClient.getQueryData<ReadingSessionTimelineResponse>(sessionKeys.timeline(3))?.messages,
    ).toHaveLength(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: reflectionLoopKeys.run(9) });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: sessionKeys.timeline(3) });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reflectionLoopKeys.sessionReflection(3),
    });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: sessionKeys.all });
  });

  it('invalidates the session Reflection after creating a discussion run', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(reflectionsApi.createRun).mockResolvedValue({
      runId: 9,
      guideId: 20,
      windowId: 13,
      sessionId: 3,
      status: 'ACTIVE',
    });

    function wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    }
    const { result } = renderHook(() => useCreateDiscussionRunMutation(20), { wrapper });

    await act(() => result.current.mutateAsync());

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reflectionLoopKeys.sessionReflection(3),
    });
  });

  it('invalidates the session Reflection after completing a discussion run', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    queryClient.setQueryData(reflectionLoopKeys.run(9), {
      runId: 9,
      sessionId: 3,
      status: 'ACTIVE',
    });
    vi.mocked(reflectionsApi.completeRun).mockResolvedValue({
      runId: 9,
      reflectionId: 11,
      initialContent: '초안',
      currentContent: '초안',
      perspectiveSummary: '요약',
      suggestionStatus: 'READY',
    });

    function wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    }
    const { result } = renderHook(() => useCompleteDiscussionRunMutation(9), { wrapper });

    await act(() => result.current.mutateAsync());

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reflectionLoopKeys.sessionReflection(3),
    });
  });

  it('keeps merged turn messages when an older timeline request finishes later', async () => {
    const queryClient = new QueryClient();
    const originalTimeline = {
      sessionId: 3,
      messages: [
        {
          messageId: 10,
          sessionId: 3,
          windowId: 13,
          role: 'user',
          content: '이전 답변',
          messageOrder: 1,
          streamingStatus: 'completed',
          createdAt: '2026-08-14T00:00:00Z',
        },
      ],
    } as ReadingSessionTimelineResponse;
    let resolveTimeline!: (timeline: ReadingSessionTimelineResponse) => void;
    const staleTimelineRequest = new Promise<ReadingSessionTimelineResponse>((resolve) => {
      resolveTimeline = resolve;
    });
    queryClient.setQueryData(sessionKeys.timeline(3), originalTimeline);
    const inFlightRequest = queryClient.fetchQuery({
      queryKey: sessionKeys.timeline(3),
      queryFn: () => staleTimelineRequest,
      staleTime: 0,
    });
    vi.mocked(reflectionsApi.turn).mockResolvedValue({
      runId: 9,
      runStatus: 'ACTIVE',
      messages: [
        {
          messageId: 11,
          windowId: 13,
          role: 'assistant',
          content: 'Director 응답',
          streamingReady: false,
          aiModel: 'director',
        },
      ],
    });

    function wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    }
    const { result } = renderHook(() => useGuidedDiscussionTurnMutation(9, 3), { wrapper });

    await act(() => result.current.mutateAsync({ content: '새 답변', navigation: 'RESPOND' }));
    expect(
      queryClient
        .getQueryData<ReadingSessionTimelineResponse>(sessionKeys.timeline(3))
        ?.messages.map((message) => message.messageId),
    ).toEqual([10, 11]);

    resolveTimeline(originalTimeline);
    await inFlightRequest;

    expect(
      queryClient
        .getQueryData<ReadingSessionTimelineResponse>(sessionKeys.timeline(3))
        ?.messages.map((message) => message.messageId),
    ).toEqual([10, 11]);
  });
});
