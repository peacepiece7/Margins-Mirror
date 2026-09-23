import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { publicReviewKeys, sessionKeys } from '@/lib/query-keys';
import { writeReadingSessionTimeline } from '@/lib/reading-session-cache';

import { reflectionsApi, type SessionInsightInput } from './api';

export const reflectionSessionQueryOptions = {
  book: (bookId: number) =>
    queryOptions({
      queryKey: sessionKeys.book(bookId),
      queryFn: () => reflectionsApi.readingSession(bookId),
      enabled: Number.isSafeInteger(bookId) && bookId > 0,
    }),
  timeline: (sessionId: number) =>
    queryOptions({
      queryKey: sessionKeys.timeline(sessionId),
      queryFn: () => reflectionsApi.timeline(sessionId),
      enabled: sessionId > 0,
    }),
};

export function useReflectionTimelineForBook(bookId: number) {
  const session = useQuery(reflectionSessionQueryOptions.book(bookId));
  const sessionId = session.data?.sessionId;
  const timeline = useQuery({
    ...reflectionSessionQueryOptions.timeline(sessionId ?? 0),
    enabled: Boolean(sessionId),
  });
  return { sessionId, sessions: session, timeline };
}

export function useReflectionSessionForBook(bookId: number) {
  const session = useQuery(reflectionSessionQueryOptions.book(bookId));
  return { sessionId: session.data?.sessionId, sessions: session };
}

export function useGenerateQuestionsForBookMutation(bookId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (existingSessionId?: number) => {
      let sessionId = existingSessionId;
      let windowId: number | undefined;
      if (!sessionId) {
        sessionId = await ensureReflectionSession(bookId);
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
    onSuccess: async (sessionId, existingSessionId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) }),
        ...(!existingSessionId
          ? [queryClient.invalidateQueries({ queryKey: sessionKeys.book(bookId) })]
          : []),
      ]);
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
  return (await reflectionsApi.ensureReadingSession(bookId)).sessionId;
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
      const timeline = insightId
        ? await reflectionsApi.updateInsight(sessionId, insightId, insight)
        : await reflectionsApi.createInsight(sessionId, insight);
      return { sessionId, timeline };
    },
    onSuccess: async ({ sessionId, timeline }, insight) => {
      await writeReadingSessionTimeline(queryClient, timeline);
      await Promise.all([
        ...(!existingSessionId
          ? [queryClient.invalidateQueries({ queryKey: sessionKeys.book(bookId) })]
          : []),
        ...(insight.visibility === 'PUBLIC'
          ? [queryClient.invalidateQueries({ queryKey: publicReviewKeys.lists() })]
          : []),
      ]);
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, content }: { questionId: number; content: string }) =>
      reflectionsApi.saveAnswer(questionId, content),
    onSuccess: async (timeline) => {
      if (timeline.sessionId === sessionId) {
        await writeReadingSessionTimeline(queryClient, timeline);
      } else {
        await queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) });
      }
    },
  });
}

export function useCreateInsightMutation(sessionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (insight: SessionInsightInput) => reflectionsApi.createInsight(sessionId, insight),
    onSuccess: async (timeline, input) => {
      await writeReadingSessionTimeline(queryClient, timeline);
      if (input.visibility === 'PUBLIC') {
        await queryClient.invalidateQueries({ queryKey: publicReviewKeys.lists() });
      }
    },
  });
}

export function useUpdateInsightMutation(sessionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ insightId, insight }: { insightId: number; insight: SessionInsightInput }) =>
      reflectionsApi.updateInsight(sessionId, insightId, insight),
    onSuccess: async (timeline, input) => {
      await writeReadingSessionTimeline(queryClient, timeline);
      if (input.insight.visibility === 'PUBLIC') {
        await queryClient.invalidateQueries({ queryKey: publicReviewKeys.lists() });
      }
    },
  });
}

export function useDeleteInsightMutation(sessionId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (insightId: number) => reflectionsApi.deleteInsight(sessionId, insightId),
    onSuccess: async (timeline) => {
      await writeReadingSessionTimeline(queryClient, timeline);
      await queryClient.invalidateQueries({ queryKey: publicReviewKeys.lists() });
    },
  });
}
