import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sessionKeys } from '@/lib/query-keys';

import { readingSessionsApi, type SessionHighlightInput } from './api';

export const sessionQueryOptions = {
  list: () => queryOptions({ queryKey: sessionKeys.list(), queryFn: readingSessionsApi.list }),
  latest: () =>
    queryOptions({ queryKey: sessionKeys.latest(), queryFn: readingSessionsApi.latestTimeline }),
  timeline: (sessionId: number) =>
    queryOptions({
      queryKey: sessionKeys.timeline(sessionId),
      queryFn: () => readingSessionsApi.timeline(sessionId),
      enabled: Number.isSafeInteger(sessionId) && sessionId > 0,
    }),
  stats: () => queryOptions({ queryKey: sessionKeys.stats(), queryFn: readingSessionsApi.stats }),
};

export function useSessionsQuery() {
  return useQuery(sessionQueryOptions.list());
}

export function useLatestSessionTimelineQuery() {
  return useQuery(sessionQueryOptions.latest());
}

export function useSessionTimelineQuery(sessionId?: number) {
  return useQuery({ ...sessionQueryOptions.timeline(sessionId ?? 0), enabled: Boolean(sessionId) });
}

export function useSessionForBookQuery(bookId: number, selectedSessionId?: number) {
  const sessions = useSessionsQuery();
  const matching = sessions.data?.sessions.filter((session) => session.bookId === bookId) ?? [];
  const sessionId =
    matching.find((session) => session.sessionId === selectedSessionId)?.sessionId ??
    matching[0]?.sessionId;
  const timeline = useSessionTimelineQuery(sessionId);
  return { sessions, sessionId, timeline };
}

function useInvalidateSession() {
  const queryClient = useQueryClient();
  return async (sessionId?: number) => {
    await queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
    await queryClient.invalidateQueries({ queryKey: sessionKeys.latest() });
    if (sessionId)
      await queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) });
  };
}

export function useCreateSessionMutation() {
  const invalidate = useInvalidateSession();
  return useMutation({
    mutationFn: ({ bookId, title }: { bookId: number; title: string }) =>
      readingSessionsApi.create(bookId, title),
    onSuccess: (session) => invalidate(session.sessionId),
  });
}

export function useCreateHighlightMutation() {
  const invalidate = useInvalidateSession();
  return useMutation({
    mutationFn: ({
      sessionId,
      highlight,
    }: {
      sessionId: number;
      highlight: SessionHighlightInput;
    }) => readingSessionsApi.createHighlight(sessionId, highlight),
    onSuccess: (timeline) => invalidate(timeline.sessionId),
  });
}

export function useArchiveSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) => readingSessionsApi.archive(sessionId).then(() => sessionId),
    onSuccess: async (sessionId) => {
      queryClient.removeQueries({ queryKey: sessionKeys.timeline(sessionId) });
      await queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: sessionKeys.latest() });
    },
  });
}
