import type { Persona } from '@/types/api/persona';
import type { SessionDisplayMessage } from './panel-types';

export function selectAvailablePersonaId(personas: Persona[], currentPersonaId?: number) {
  if (currentPersonaId && personas.some((persona) => persona.personaId === currentPersonaId)) {
    return currentPersonaId;
  }

  return personas[0]?.personaId;
}

export function selectNextDebatePersona(personas: Persona[], messages: SessionDisplayMessage[]) {
  if (!personas.length) {
    return undefined;
  }

  const personaIds = new Set(personas.map((persona) => persona.personaId));
  const responseCounts = new Map<number, number>();

  messages.forEach((message) => {
    if (message.role === 'assistant' && message.personaId && personaIds.has(message.personaId)) {
      responseCounts.set(message.personaId, (responseCounts.get(message.personaId) || 0) + 1);
    }
  });

  return [...personas].sort((left, right) => {
    const replyDifference =
      (responseCounts.get(left.personaId) || 0) - (responseCounts.get(right.personaId) || 0);
    return replyDifference || left.personaId - right.personaId;
  })[0];
}

export function matchRecommendedPersonaIds(personas: Persona[], keys: string[], limit = 2) {
  const personaByName = new Map(
    personas.map((persona) => [persona.name.toLowerCase(), persona.personaId]),
  );
  return keys
    .map((key) => personaByName.get(key.replaceAll('_', '-').toLowerCase()))
    .filter((personaId): personaId is number => personaId !== undefined)
    .filter((personaId, index, ids) => ids.indexOf(personaId) === index)
    .slice(0, limit);
}

/** Persisted room state wins; only legacy rooms use the recommendation top-two fallback. */
export function resolveDebatePersonaIds(
  persistedPersonaIds: number[] | undefined,
  recommendedPersonaIds: number[],
) {
  return persistedPersonaIds?.length ? persistedPersonaIds : recommendedPersonaIds.slice(0, 2);
}
