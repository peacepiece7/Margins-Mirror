import {
  queryOptions,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { sessionKeys } from '@/lib/query-keys';
import {
  invalidateReadingSessionTimeline,
  writeReadingSessionTimeline,
} from '@/lib/reading-session-cache';

import { readingSessionsApi, type SessionHighlightInput } from './api';

type TimelineMutationState = { overlapped: boolean; pending: number };
const timelineMutationStates = new WeakMap<QueryClient, Map<number, TimelineMutationState>>();

function beginTimelineMutation(queryClient: QueryClient, sessionId: number) {
  let bySession = timelineMutationStates.get(queryClient);
  if (!bySession) {
    bySession = new Map();
    timelineMutationStates.set(queryClient, bySession);
  }
  const state = bySession.get(sessionId) ?? { overlapped: false, pending: 0 };
  state.pending += 1;
  if (state.pending > 1) {
    state.overlapped = true;
  }
  bySession.set(sessionId, state);
  return state;
}

function finishTimelineMutation(
  queryClient: QueryClient,
  sessionId: number,
  state: TimelineMutationState | undefined,
) {
  if (!state) return false;
  state.pending -= 1;
  if (state.pending > 0) return false;
  timelineMutationStates.get(queryClient)?.delete(sessionId);
  return state.overlapped;
}

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

export function useCreateHighlightMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      highlight,
    }: {
      sessionId: number;
      highlight: SessionHighlightInput;
    }) => readingSessionsApi.createHighlight(sessionId, highlight),
    onMutate: ({ sessionId }) => beginTimelineMutation(queryClient, sessionId),
    onSuccess: (timeline, _input, state) =>
      state?.overlapped ? undefined : writeReadingSessionTimeline(queryClient, timeline),
    onSettled: async (_timeline, _error, { sessionId }, state) => {
      if (finishTimelineMutation(queryClient, sessionId, state)) {
        await invalidateReadingSessionTimeline(queryClient, sessionId);
      }
    },
  });
}
