import type {
  MobileReflectionThread,
  MobileReflectionThreadTarget,
} from './types';

export type MobileReflectionThreadStage = MobileReflectionThreadTarget['kind'];

function validId(value: number | null | undefined): value is number {
  return Number.isSafeInteger(value) && (value ?? 0) > 0;
}

/**
 * Resolves the one authoritative next action for a reading thread. Invalid or
 * partial aggregate data falls back to the latest lower stage that can be opened.
 */
export function resolveMobileReflectionThreadTarget(
  thread: MobileReflectionThread,
): MobileReflectionThreadTarget {
  if (validId(thread.runId) && thread.runStatus === 'COMPLETED') {
    if (!thread.refinementOutcome) {
      return { bookId: thread.bookId, kind: 'refine', runId: thread.runId };
    }
    if (validId(thread.reflectionId) && validId(thread.sessionId)) {
      return { bookId: thread.bookId, kind: 'reflection', sessionId: thread.sessionId };
    }
    return {
      bookId: thread.bookId,
      kind: 'record',
      ...(validId(thread.sessionId) ? { sessionId: thread.sessionId } : {}),
    };
  }
  if (
    validId(thread.runId)
    && (thread.runStatus === 'ACTIVE' || thread.runStatus === 'READY')
  ) {
    return { bookId: thread.bookId, kind: 'discuss', runId: thread.runId };
  }
  if (validId(thread.guideId)) {
    return { bookId: thread.bookId, guideId: thread.guideId, kind: 'guide' };
  }
  if (validId(thread.interviewId) && validId(thread.sessionId)) {
    return {
      bookId: thread.bookId,
      interviewId: thread.interviewId,
      kind: 'interview',
      sessionId: thread.sessionId,
    };
  }
  if (validId(thread.reflectionId) && validId(thread.sessionId)) {
    return { bookId: thread.bookId, kind: 'reflection', sessionId: thread.sessionId };
  }
  return {
    bookId: thread.bookId,
    kind: 'record',
    ...(validId(thread.sessionId) ? { sessionId: thread.sessionId } : {}),
  };
}
