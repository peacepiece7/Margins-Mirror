import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { publicReviewKeys, sessionKeys } from '@/lib/query-keys';

import { reflectionsApi, type SessionInsightInput } from './api';

export const reflectionSessionQueryOptions = {
  sessions: () => queryOptions({ queryKey: sessionKeys.list(), queryFn: reflectionsApi.sessions }),
  timeline: (sessionId: number) =>
    queryOptions({
      queryKey: sessionKeys.timeline(sessionId),
      queryFn: () => reflectionsApi.timeline(sessionId),
      enabled: sessionId > 0,
    }),
};

export function useReflectionTimelineForBook(bookId: number) {
  const sessions = useQuery(reflectionSessionQueryOptions.sessions());
  const sessionId = sessions.data?.sessions.find((session) => session.bookId === bookId)?.sessionId;
  const timeline = useQuery({
    ...reflectionSessionQueryOptions.timeline(sessionId ?? 0),
    enabled: Boolean(sessionId),
  });
  return { sessionId, sessions, timeline };
}

export function useReflectionSessionForBook(bookId: number) {
  const sessions = useQuery(reflectionSessionQueryOptions.sessions());
  const sessionId = sessions.data?.sessions.find((session) => session.bookId === bookId)?.sessionId;
  return { sessionId, sessions };
}

export function useGenerateQuestionsForBookMutation(bookId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (existingSessionId?: number) => {
      let sessionId = existingSessionId;
      let windowId: number | undefined;
      if (!sessionId) {
        sessionId = (await reflectionsApi.sessions()).sessions.find(
          (session) => session.bookId === bookId,
        )?.sessionId;
        if (!sessionId) throw new Error('Reading session is not available yet');
        const window = await reflectionsApi.createQuestionWindow(sessionId);
        windowId = window.windowId;
      } else {
        const timeline = await reflectionsApi.timeline(sessionId);
        windowId =
          timeline?.windows.find((window) => window.windowType === 'question')?.windowId ??
          timeline?.windows[0]?.windowId;
        if (!windowId) {
          windowId = (await reflectionsApi.createQuestionWindow(sessionId)).windowId;
        }
      }
      await reflectionsApi.generateQuestions(windowId, 3);
      return sessionId;
    },
    onSuccess: async (sessionId) => {
      await queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) });
    },
  });
}

export function useDeleteQuestionMutation(sessionId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reflectionsApi.deleteQuestion,
    onSuccess: () => {
      if (sessionId) {
        return queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) });
      }
    },
  });
}

async function ensureReflectionSession(bookId: number, existingSessionId?: number) {
  if (existingSessionId) return existingSessionId;
  const sessionId = (await reflectionsApi.sessions()).sessions.find(
    (session) => session.bookId === bookId,
  )?.sessionId;
  if (!sessionId) throw new Error('Reading session is not available yet');
  return sessionId;
}

export function useEnsureReflectionSessionMutation(bookId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (existingSessionId?: number) => ensureReflectionSession(bookId, existingSessionId),
    onSuccess: async (sessionId) => {
      await queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) });
    },
  });
}

export function useSaveReflectionMutation(
  bookId: number,
  existingSessionId?: number,
  insightId?: number,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (insight: SessionInsightInput) => {
      const sessionId = await ensureReflectionSession(bookId, existingSessionId);
      if (insightId) {
        await reflectionsApi.updateInsight(sessionId, insightId, insight);
      } else {
        await reflectionsApi.createInsight(sessionId, insight);
      }
      return sessionId;
    },
    onSuccess: async (sessionId, insight) => {
      await queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) });
      if (insight.visibility === 'PUBLIC') {
        await queryClient.invalidateQueries({ queryKey: publicReviewKeys.lists() });
      }
    },
  });
}

export function useEnsureQuestionDebateMutation(sessionId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: number) => {
      const window = await reflectionsApi.ensureDebateWindow(questionId);
      return window;
    },
    onSuccess: () => {
      if (sessionId) {
        return queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) });
      }
    },
  });
}

function useInvalidateTimeline() {
  const queryClient = useQueryClient();
  return async (sessionId: number, publicReview = false) => {
    await queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) });
    await queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
    if (publicReview) {
      await queryClient.invalidateQueries({ queryKey: publicReviewKeys.lists() });
    }
  };
}

export function useGenerateQuestionsMutation(sessionId: number) {
  const invalidate = useInvalidateTimeline();
  return useMutation({
    mutationFn: ({
      windowId,
      count = 3,
      focus,
    }: {
      windowId: number;
      count?: number;
      focus?: string;
    }) => reflectionsApi.generateQuestions(windowId, count, focus),
    onSuccess: () => invalidate(sessionId),
  });
}

export function useSaveAnswerMutation(sessionId: number) {
  const invalidate = useInvalidateTimeline();
  return useMutation({
    mutationFn: ({ questionId, content }: { questionId: number; content: string }) =>
      reflectionsApi.saveAnswer(questionId, content),
    onSuccess: () => invalidate(sessionId),
  });
}

export function useCreateInsightMutation(sessionId: number) {
  const invalidate = useInvalidateTimeline();
  return useMutation({
    mutationFn: (insight: SessionInsightInput) => reflectionsApi.createInsight(sessionId, insight),
    onSuccess: (_, input) => invalidate(sessionId, input.visibility === 'PUBLIC'),
  });
}

export function useUpdateInsightMutation(sessionId: number) {
  const invalidate = useInvalidateTimeline();
  return useMutation({
    mutationFn: ({ insightId, insight }: { insightId: number; insight: SessionInsightInput }) =>
      reflectionsApi.updateInsight(sessionId, insightId, insight),
    onSuccess: (_, input) => invalidate(sessionId, input.insight.visibility === 'PUBLIC'),
  });
}

export function useDeleteInsightMutation(sessionId: number) {
  const invalidate = useInvalidateTimeline();
  return useMutation({
    mutationFn: (insightId: number) => reflectionsApi.deleteInsight(sessionId, insightId),
    onSuccess: () => invalidate(sessionId, true),
  });
}
