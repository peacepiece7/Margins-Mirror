import type { QueryClient } from '@tanstack/react-query';

import type { ReadingSessionTimelineResponse } from '@/types/api/session';

import { sessionKeys } from './query-keys';

export async function invalidateReadingSessionTimeline(
  queryClient: QueryClient,
  sessionId: number,
) {
  const latest = queryClient.getQueryData<ReadingSessionTimelineResponse | null>(
    sessionKeys.latest(),
  );
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: sessionKeys.timeline(sessionId) }),
    ...(latest?.sessionId === sessionId
      ? [queryClient.invalidateQueries({ queryKey: sessionKeys.latest() })]
      : []),
  ]);
}

export async function writeReadingSessionTimeline(
  queryClient: QueryClient,
  timeline: ReadingSessionTimelineResponse,
) {
  const latest = queryClient.getQueryData<ReadingSessionTimelineResponse | null>(
    sessionKeys.latest(),
  );
  await Promise.all([
    queryClient.cancelQueries({ exact: true, queryKey: sessionKeys.timeline(timeline.sessionId) }),
    ...(latest?.sessionId === timeline.sessionId
      ? [queryClient.cancelQueries({ exact: true, queryKey: sessionKeys.latest() })]
      : []),
  ]);
  queryClient.setQueryData(sessionKeys.timeline(timeline.sessionId), timeline);
  queryClient.setQueryData<ReadingSessionTimelineResponse | null>(
    sessionKeys.latest(),
    (current) => (current?.sessionId === timeline.sessionId ? timeline : current),
  );
}
