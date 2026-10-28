import type { AiMessage, DebateTurn, Persona } from "./types";

export function normalizeDebatePersonaKey(key: string) {
  return key
    .trim()
    .toLocaleLowerCase("en")
    .replaceAll("_", "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveDebatePersonaIdsByKey(
  personas: Persona[],
  personaKeys: string[],
) {
  const byKey = new Map<string, number>();
  for (const persona of personas) {
    byKey.set(normalizeDebatePersonaKey(persona.name), persona.personaId);
    byKey.set(normalizeDebatePersonaKey(persona.displayName), persona.personaId);
  }

  return personaKeys
    .map((key) => byKey.get(normalizeDebatePersonaKey(key)))
    .filter((id): id is number => id !== undefined)
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .slice(0, 2);
}

export function initialDebatePersonaIds(
  activePersonaIds: number[],
  recommendedPersonaIds: number[],
) {
  const active = new Set(activePersonaIds);
  return recommendedPersonaIds.filter((id) => active.has(id)).slice(0, 2);
}

export function resolveNewDebatePersonaIds(
  selectedPersonaIds: number[],
  initialPersonaIds: number[],
  activePersonaIds: number[],
) {
  if (selectedPersonaIds.length === 0) return [];
  const active = new Set(activePersonaIds);
  const selected = selectedPersonaIds.filter((id) => active.has(id)).slice(0, 2);
  if (selected.length) return selected;

  const initial = initialPersonaIds.filter((id) => active.has(id)).slice(0, 2);
  return initial.length ? initial : activePersonaIds.slice(0, 1);
}

export function resolveDebatePersonaIds(
  persistedPersonaIds: number[] | undefined,
  recommendedPersonaIds: number[],
) {
  return persistedPersonaIds?.length
    ? persistedPersonaIds
    : recommendedPersonaIds.slice(0, 2);
}

export function resolveActiveDebatePersonaIds(
  persistedPersonaIds: number[] | undefined,
  recommendedPersonaIds: number[],
  activePersonaIds: number[],
) {
  const active = new Set(activePersonaIds);
  const persisted = (persistedPersonaIds ?? []).filter((id) => active.has(id));
  if (persistedPersonaIds?.length) return persisted;

  return recommendedPersonaIds.filter((id) => active.has(id)).slice(0, 2);
}

export function nextDebatePersonaId(
  personaIds: number[],
  messages: Pick<AiMessage, "personaId" | "role">[],
) {
  if (!personaIds.length) return undefined;
  const counts = new Map(personaIds.map((id) => [id, 0]));
  for (const message of messages) {
    if (message.role === "assistant" && message.personaId && counts.has(message.personaId)) {
      counts.set(message.personaId, (counts.get(message.personaId) ?? 0) + 1);
    }
  }
  return [...personaIds].sort((left, right) =>
    (counts.get(left) ?? 0) - (counts.get(right) ?? 0) || left - right,
  )[0];
}

export function shouldClearDebateDraft(turn: DebateTurn) {
  return !turn.moderation || turn.moderation.decision === "ALLOW";
}
