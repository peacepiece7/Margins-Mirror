import { describe, expect, it } from 'vitest';
import { buildSessionBrief, type SessionBriefState } from './session-brief';

function state(overrides: Partial<SessionBriefState> = {}): SessionBriefState {
  return {
    sessionSummaries: [],
    memorySearchResults: [],
    windows: [],
    highlights: [],
    tags: [],
    questions: [],
    nextActions: [],
    hydrated: true,
    ...overrides,
  };
}

describe('buildSessionBrief', () => {
  it('summarizes an empty active session without requiring optional timeline fields', () => {
    const summary = buildSessionBrief(
      state({
        session: {
          sessionId: 1,
          bookId: 1,
          title: 'First pass',
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

    expect(summary.headline).toBe('Reading session brief');
    expect(summary.items.map((item) => [item.id, item.value])).toEqual([
      ['focus', 'First pass'],

      ['evidence', '0 quotes'],
      ['discussion', '0 answers - 0 persona replies'],
    ]);
  });

  it('prioritizes selected prompt, evidence, and next action from persisted state', () => {
    const summary = buildSessionBrief(
      state({
        session: {
          sessionId: 1,
          bookId: 1,
          title: 'Dune opening ritual notes',
        },
        window: {
          windowId: 10,
          sessionId: 1,
          windowType: 'question',
          title: 'Reflection Window',
          status: 'open',
          personaIds: [],
        },
        selectedQuestionId: 99,
        questions: [
          {
            questionId: 99,
            sessionId: 1,
            windowId: 10,
            questionText: 'What detail from Dune matters most?',
            questionType: 'reflection',
            status: 'active',
          },
        ],

        highlights: [
          {
            highlightId: 1,
            sessionId: 1,
            bookId: 1,
            pageNumber: 48,
            locationLabel: 'Opening ritual',
            quoteText: 'A beginning is the time for taking the most delicate care.',
            highlightOrder: 1,
          },
        ],
        nextActions: [
          {
            actionId: 'debate',
            label: 'Ask personas to challenge the reading',
            detail: 'Bring the interpretation into debate.',
          },
        ],
        stats: {
          windowCount: 2,
          questionCount: 3,
          answeredQuestionCount: 1,
          messageCount: 4,
          personaResponseCount: 2,
          personaCount: 2,
        },
      }),
    );

    expect(summary.items.find((item) => item.id === 'focus')).toMatchObject({
      value: 'What detail from Dune matters most?',
      detail: 'Reflection Window',
    });

    expect(summary.items.find((item) => item.id === 'evidence')).toMatchObject({
      value: '1 quote',
      detail: 'Opening ritual',
    });
    expect(summary.items.find((item) => item.id === 'discussion')).toMatchObject({
      value: '1 answer - 2 persona replies',
      detail: 'Ask personas to challenge the reading',
    });
  });
});
