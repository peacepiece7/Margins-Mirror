import { resolveMobileReflectionThreadTarget } from './thread-state';
import type { MobileReflectionThread } from './types';

function thread(
  overrides: Partial<MobileReflectionThread> = {},
): MobileReflectionThread {
  return {
    bookId: 7,
    bookTitle: 'A Book',
    lastActivityAt: '2026-08-31T09:00:00',
    revisionCount: 0,
    ...overrides,
  };
}

// BDD: MOBILE-017
// BDD: RLOOP-058
// BDD: RLOOP-014
it.each([
  [thread(), { bookId: 7, kind: 'record' }],
  [thread({ sessionId: 10 }), { bookId: 7, kind: 'record', sessionId: 10 }],
  [thread({ reflectionId: 20, sessionId: 10 }), { bookId: 7, kind: 'reflection', sessionId: 10 }],
  [thread({ interviewId: 30, reflectionId: 20, sessionId: 10 }), {
    bookId: 7, interviewId: 30, kind: 'interview', sessionId: 10,
  }],
  [thread({ guideId: 40, interviewId: 30, sessionId: 10 }), {
    bookId: 7, guideId: 40, kind: 'guide',
  }],
  [thread({ guideId: 40, runId: 50, runStatus: 'READY' }), {
    bookId: 7, kind: 'discuss', runId: 50,
  }],
  [thread({ guideId: 40, runId: 50, runStatus: 'ACTIVE' }), {
    bookId: 7, kind: 'discuss', runId: 50,
  }],
  [thread({ guideId: 40, runId: 50, runStatus: 'COMPLETED' }), {
    bookId: 7, kind: 'refine', runId: 50,
  }],
  [thread({
    guideId: 40,
    reflectionId: 20,
    refinementOutcome: 'KEPT',
    runId: 50,
    runStatus: 'COMPLETED',
    sessionId: 10,
  }), {
    bookId: 7, kind: 'reflection', sessionId: 10,
  }],
])('resolves the current workflow stage without skipping prerequisites', (input, expected) => {
  expect(resolveMobileReflectionThreadTarget(input)).toEqual(expected);
});

it('falls back from abandoned or incomplete run data instead of opening an invalid route', () => {
  expect(resolveMobileReflectionThreadTarget(thread({
    guideId: 40,
    interviewId: 30,
    runId: 50,
    runStatus: 'ABANDONED',
    sessionId: 10,
  }))).toEqual({ bookId: 7, guideId: 40, kind: 'guide' });
  expect(resolveMobileReflectionThreadTarget(thread({
    interviewId: 30,
    reflectionId: 20,
  }))).toEqual({ bookId: 7, kind: 'record' });
});

it('fails closed after terminal refinement instead of reopening an older guide or interview', () => {
  expect(resolveMobileReflectionThreadTarget(thread({
    guideId: 40,
    interviewId: 30,
    refinementOutcome: 'KEPT',
    runId: 50,
    runStatus: 'COMPLETED',
    sessionId: 10,
  }))).toEqual({ bookId: 7, kind: 'record', sessionId: 10 });
  expect(resolveMobileReflectionThreadTarget(thread({
    guideId: 40,
    interviewId: 30,
    refinementOutcome: 'CHANGED',
    runId: 50,
    runStatus: 'COMPLETED',
  }))).toEqual({ bookId: 7, kind: 'record' });
});
