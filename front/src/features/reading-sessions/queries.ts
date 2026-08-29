import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sessionKeys } from '@/lib/query-keys';

import { readingSessionsApi, type SessionHighlightInput } from './api';

export const sessionQueryOptions = {
  latest: () =>
    queryOptions({ queryKey: sessionKeys.latest(), queryFn: readingSessionsApi.latestTimeline }),
  timeline: (sessionId: number) =>
    queryOptions({
      queryKey: sessionKeys.timeline(sessionId),
      queryFn: () => readingSessionsApi.timeline(sessionId),
      enabled: Number.isSafeInteger(sessionId) && sessionId > 0,
    }),
};

export function useLatestSessionTimelineQuery() {
  return useQuery(sessionQueryOptions.latest());
}

export function useSessionTimelineQuery(sessionId?: number) {
  return useQuery({ ...sessionQueryOptions.timeline(sessionId ?? 0), enabled: Boolean(sessionId) });
}

function useInvalidateSession() {
  const queryClient = useQueryClient();
  return async (sessionId?: number) => {
    await queryClient.invalidateQueries({ queryKey: sessionKeys.latest() });
    if (sessionId)
      await queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) });
  };
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
