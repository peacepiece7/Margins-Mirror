import { describe, expect, it } from 'vitest';
import type { Persona } from '@/types/api/persona';
import type { SessionDisplayMessage } from './panel-types';
import {
  matchRecommendedPersonaIds,
  resolveDebatePersonaIds,
  selectAvailablePersonaId,
  selectNextDebatePersona,
} from './persona-selection';

const personas: Persona[] = [
  {
    personaId: 10,
    name: 'skeptic',
    displayName: 'Skeptic',
  },
  {
    personaId: 20,
    name: 'historian',
    displayName: 'Historian',
  },
];

describe('selectAvailablePersonaId', () => {
  it('keeps the current persona when it is still available', () => {
    expect(selectAvailablePersonaId(personas, 20)).toBe(20);
  });

  it('falls back to the first available persona when the current persona disappeared', () => {
    expect(selectAvailablePersonaId(personas, 99)).toBe(10);
  });

  it('returns undefined when no personas are available', () => {
    expect(selectAvailablePersonaId([], 99)).toBeUndefined();
  });
});

describe('selectNextDebatePersona', () => {
  const messages: SessionDisplayMessage[] = [
    {
      id: '1',
      sessionId: 1,
      windowId: 1,
      role: 'assistant',
      content: 'First skeptic reply',
      personaId: 10,
    },
    {
      id: '2',
      sessionId: 1,
      windowId: 1,
      role: 'assistant',
      content: 'Second skeptic reply',
      personaId: 10,
    },
    {
      id: '3',
      sessionId: 1,
      windowId: 1,
      role: 'user',
      content: 'Reader prompt',
    },
  ];

  it('selects the persona with the fewest visible assistant replies', () => {
    expect(selectNextDebatePersona(personas, messages)?.personaId).toBe(20);
  });

  it('uses persona id as a stable tie breaker', () => {
    expect(selectNextDebatePersona(personas, [])?.personaId).toBe(10);
  });

  it('returns undefined when there are no selected personas', () => {
    expect(selectNextDebatePersona([], messages)).toBeUndefined();
  });
});

describe('matchRecommendedPersonaIds', () => {
  it('matches legacy underscore keys and limits recommendations to two', () => {
    const available = [
      ...personas,
      { personaId: 30, name: 'university-professor', displayName: 'Professor' },
    ];

    expect(
      matchRecommendedPersonaIds(available, ['university_professor', 'historian', 'skeptic']),
    ).toEqual([30, 20]);
  });
});

describe('resolveDebatePersonaIds', () => {
  it('keeps persisted selections even when they are not recommended', () => {
    expect(resolveDebatePersonaIds([99, 98], [10, 20])).toEqual([99, 98]);
  });

  it.each([
    [[], []],
    [[], [10]],
    [[], [10, 20, 30]],
  ])('uses only the recommendation top two for a legacy room', (persisted, recommended) => {
    expect(resolveDebatePersonaIds(persisted, recommended)).toEqual(recommended.slice(0, 2));
  });
});
