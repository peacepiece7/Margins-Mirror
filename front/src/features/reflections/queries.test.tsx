// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionKeys } from '@/lib/query-keys';

import { reflectionsApi } from './api';
import {
  useCreateInsightMutation,
  useDeleteInsightMutation,
  useGenerateQuestionsForBookMutation,
  useSaveAnswerMutation,
  useSaveReflectionMutation,
  useUpdateInsightMutation,
} from './queries';

vi.mock('./api', () => ({
  reflectionsApi: {
    createInsight: vi.fn(),
    createQuestionWindow: vi.fn(),
    ensureReadingSession: vi.fn(),
    generateQuestions: vi.fn(),
    saveAnswer: vi.fn(),
    updateInsight: vi.fn(),
    deleteInsight: vi.fn(),
  },
}));

describe('reflection mutations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ensures a missing reading session once before generating questions', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(reflectionsApi.ensureReadingSession).mockResolvedValue({
      sessionId: 3,
      title: 'Dune reflection',
    });
    vi.mocked(reflectionsApi.createQuestionWindow).mockResolvedValue({
      personaIds: [],
      sessionId: 3,
      status: 'ACTIVE',
      title: 'Reflection Window',
      windowId: 11,
      windowType: 'question',
    });
    vi.mocked(reflectionsApi.generateQuestions).mockResolvedValue({ questions: [] });

    function wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    }
    const { result } = renderHook(() => useGenerateQuestionsForBookMutation(7), { wrapper });

    await act(() => result.current.mutateAsync(undefined));

    expect(reflectionsApi.ensureReadingSession).toHaveBeenCalledOnce();
    expect(reflectionsApi.ensureReadingSession).toHaveBeenCalledWith(7);
    expect(reflectionsApi.createQuestionWindow).toHaveBeenCalledWith(3);
    expect(reflectionsApi.generateQuestions).toHaveBeenCalledWith(11, 3);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: sessionKeys.book(7) });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: sessionKeys.timeline(3) });
  });

  it('ensures a missing reading session once on explicit review save', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(reflectionsApi.ensureReadingSession).mockResolvedValue({
      sessionId: 3,
      title: 'Dune reflection',
    });
    const timeline = { messages: [], sessionId: 3 } as never;
    vi.mocked(reflectionsApi.createInsight).mockResolvedValue(timeline);

    function wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    }
    const { result } = renderHook(() => useSaveReflectionMutation(7), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        content: 'Review content',
        insightType: 'reflection',
        visibility: 'PRIVATE',
      }),
    );

    expect(reflectionsApi.ensureReadingSession).toHaveBeenCalledOnce();
    expect(reflectionsApi.ensureReadingSession).toHaveBeenCalledWith(7);
    expect(reflectionsApi.createInsight).toHaveBeenCalledWith(3, {
      content: 'Review content',
      insightType: 'reflection',
      visibility: 'PRIVATE',
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: sessionKeys.book(7) });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: sessionKeys.timeline(3) });
    expect(queryClient.getQueryData(sessionKeys.timeline(3))).toBe(timeline);
  });

  it('writes answer and insight mutation timelines without invalidating the same resource', async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const answerTimeline = { messages: [], sessionId: 3 } as never;
    const createTimeline = { insights: [{ insightId: 11 }], sessionId: 3 } as never;
    const updateTimeline = {
      insights: [{ insightId: 11 }, { insightId: 12 }],
      sessionId: 3,
    } as never;
    const deleteTimeline = { insights: [], sessionId: 3 } as never;
    vi.mocked(reflectionsApi.saveAnswer).mockResolvedValue(answerTimeline);
    vi.mocked(reflectionsApi.createInsight).mockResolvedValue(createTimeline);
    vi.mocked(reflectionsApi.updateInsight).mockResolvedValue(updateTimeline);
    vi.mocked(reflectionsApi.deleteInsight).mockResolvedValue(deleteTimeline);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const answer = renderHook(() => useSaveAnswerMutation(3), { wrapper });
    const create = renderHook(() => useCreateInsightMutation(3), { wrapper });
    const update = renderHook(() => useUpdateInsightMutation(3), { wrapper });
    const remove = renderHook(() => useDeleteInsightMutation(3), { wrapper });

    await act(() => answer.result.current.mutateAsync({ questionId: 7, content: 'Answer' }));
    expect(queryClient.getQueryData(sessionKeys.timeline(3))).toBe(answerTimeline);

    await act(() =>
      create.result.current.mutateAsync({
        content: 'Reflection',
        insightType: 'reflection',
        visibility: 'PRIVATE',
      }),
    );
    expect(queryClient.getQueryData(sessionKeys.timeline(3))).toStrictEqual(createTimeline);

    await act(() =>
      update.result.current.mutateAsync({
        insightId: 11,
        insight: {
          content: 'Updated reflection',
          insightType: 'reflection',
          visibility: 'PRIVATE',
        },
      }),
    );
    expect(queryClient.getQueryData(sessionKeys.timeline(3))).toStrictEqual(updateTimeline);

    await act(() => remove.result.current.mutateAsync(11));
    expect(queryClient.getQueryData(sessionKeys.timeline(3))).toStrictEqual(deleteTimeline);
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: sessionKeys.timeline(3) });
  });
});
