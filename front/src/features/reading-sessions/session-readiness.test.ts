import { describe, expect, it } from 'vitest';
import type { ReadingSessionProjectionState as ReadingSessionsState } from './projection-types';
import { buildSessionReadiness } from './session-readiness';

function state(overrides: Partial<ReadingSessionsState> = {}): ReadingSessionsState {
  return {
    sessionSummaries: [],
    memorySearchResults: [],
    windows: [],
    highlights: [],
    tags: [],
    nextActions: [],
    hydrated: true,
    ...overrides,
  };
}

describe('buildSessionReadiness', () => {
  it('treats a new session with no activity as not ready', () => {
    const summary = buildSessionReadiness(
      state({
        session: {
          sessionId: 1,
          bookId: 1,
          title: 'New session',
        },

        stats: {
          windowCount: 2,
          questionCount: 0,
          answeredQuestionCount: 0,
          messageCount: 0,
          personaResponseCount: 0,
          personaCount: 0,
        },
      }),
    );

    expect(summary.completedCount).toBe(0);
    expect(summary.totalCount).toBe(4);
  });

  it('marks each review area ready from persisted timeline state', () => {
    const summary = buildSessionReadiness(
      state({
        session: {
          sessionId: 1,
          bookId: 1,
          title: 'Completed session',
        },

        highlights: [
          {
            highlightId: 1,
            sessionId: 1,
            bookId: 1,
            quoteText: 'A saved quote.',
            highlightOrder: 1,
          },
        ],
        stats: {
          windowCount: 2,
          questionCount: 3,
          answeredQuestionCount: 1,
          messageCount: 4,
          personaResponseCount: 1,
          personaCount: 1,
        },
      }),
    );

    expect(summary.completedCount).toBe(4);
    expect(summary.percent).toBe(100);
    expect(summary.items.map((item) => [item.id, item.complete])).toEqual([
      ['questions', true],
      ['answers', true],
      ['quotes', true],
      ['personas', true],
    ]);
  });
});
