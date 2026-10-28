import { normalizeDebatePersonaKey } from "./persona-selection";

type SearchValue = string | string[] | undefined;

export type DebateRouteParams = {
  personaKeys?: SearchValue;
  topic?: SearchValue;
};

function values(value: SearchValue) {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export function parseDebateRecommendationParams(params: DebateRouteParams) {
  const topic = values(params.topic)[0]?.trim().slice(0, 240) || undefined;
  const personaKeys = values(params.personaKeys)
    .flatMap((value) => value.split(","))
    .map(normalizeDebatePersonaKey)
    .filter(Boolean)
    .filter((key, index, keys) => keys.indexOf(key) === index)
    .slice(0, 2);

  return {
    recommendedPersonaKeys: personaKeys,
    recommendedTopic: topic,
  };
}
