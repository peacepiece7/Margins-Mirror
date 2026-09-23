import type { ReflectionTimeline } from "./types";

export function ownsReflectionRoute(
  timeline:
    | (Pick<ReflectionTimeline, "bookId"> &
        Partial<Pick<ReflectionTimeline, "sessionId">>)
    | undefined,
  bookId: number,
  sessionId?: number,
) {
  return (
    timeline?.bookId === bookId &&
    (sessionId === undefined || timeline.sessionId === sessionId)
  );
}

export function ownsInterviewRoute(
  timeline: Pick<ReflectionTimeline, "bookId" | "insights"> | undefined,
  bookId: number,
  reflectionId: number | undefined,
  sessionId?: number,
) {
  return Boolean(
    reflectionId &&
      ownsReflectionRoute(timeline, bookId, sessionId) &&
      timeline?.insights.some((insight) => insight.insightId === reflectionId),
  );
}
