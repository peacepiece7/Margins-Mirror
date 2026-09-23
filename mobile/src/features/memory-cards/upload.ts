import type { MemoryCard, MemoryCardInput } from "./types";

export const MAX_MEMORY_CARD_UPLOAD_SIZE = 500;

const sampleCards: MemoryCardInput[] = [
  {
    frontText: "wand",
    backText: "지팡이",
    exampleText: "He raised his wand.",
    memo: "Common fantasy vocabulary.",
  },
  {
    frontText: "cloak",
    backText: "망토",
    exampleText: "She wore a long black cloak.",
    memo: "",
  },
];

export class MemoryCardUploadError extends Error {
  constructor(
    readonly path: string,
    readonly rule: "array" | "length" | "object" | "required" | "string" | "max",
    readonly limit?: number,
  ) {
    super(`${path}:${rule}${limit ? `:${limit}` : ""}`);
  }
}

export function memoryCardTemplateJson() {
  return stringifyCards(sampleCards);
}

export function memoryCardsJson(cards: MemoryCard[]) {
  return stringifyCards(
    cards.slice(0, MAX_MEMORY_CARD_UPLOAD_SIZE).map((card) => ({
      frontText: card.frontText,
      backText: card.backText,
      exampleText: card.exampleText ?? "",
      memo: card.memo ?? "",
    })),
  );
}

export function duplicateMemoryCardFronts(
  upload: MemoryCardInput[],
  existing: Pick<MemoryCard, "frontText">[],
) {
  const seen = new Set(existing.map((card) => frontKey(card.frontText)));
  const duplicates = new Set<string>();
  for (const card of upload) {
    const key = frontKey(card.frontText);
    if (seen.has(key)) duplicates.add(card.frontText);
    seen.add(key);
  }
  return [...duplicates];
}

function frontKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

function stringifyCards(cards: MemoryCardInput[]) {
  return JSON.stringify({ cards }, null, 2);
}

export function parseMemoryCardUpload(value: string): MemoryCardInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new MemoryCardUploadError("JSON", "object");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new MemoryCardUploadError("JSON", "object");
  }
  const cards = (parsed as { cards?: unknown }).cards;
  if (!Array.isArray(cards)) {
    throw new MemoryCardUploadError("cards", "array");
  }
  if (cards.length === 0 || cards.length > MAX_MEMORY_CARD_UPLOAD_SIZE) {
    throw new MemoryCardUploadError(
      "cards",
      "length",
      MAX_MEMORY_CARD_UPLOAD_SIZE,
    );
  }

  return cards.map((card, index) => parseCard(card, index));
}

function parseCard(card: unknown, index: number): MemoryCardInput {
  const path = `cards[${index}]`;
  if (!card || typeof card !== "object" || Array.isArray(card)) {
    throw new MemoryCardUploadError(path, "object");
  }
  const candidate = card as Record<string, unknown>;
  return {
    frontText: requiredText(candidate.frontText, `${path}.frontText`, 200),
    backText: requiredText(candidate.backText, `${path}.backText`, 500),
    exampleText: optionalText(candidate.exampleText, `${path}.exampleText`, 1000),
    memo: optionalText(candidate.memo, `${path}.memo`, 1000),
  };
}

function requiredText(value: unknown, path: string, limit: number) {
  if (value === undefined || value === null || value === "") {
    throw new MemoryCardUploadError(path, "required");
  }
  if (typeof value !== "string") {
    throw new MemoryCardUploadError(path, "string");
  }
  const trimmed = value.trim();
  if (!trimmed) throw new MemoryCardUploadError(path, "required");
  if (trimmed.length > limit) {
    throw new MemoryCardUploadError(path, "max", limit);
  }
  return trimmed;
}

function optionalText(value: unknown, path: string, limit: number) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new MemoryCardUploadError(path, "string");
  }
  const trimmed = value.trim();
  if (trimmed.length > limit) {
    throw new MemoryCardUploadError(path, "max", limit);
  }
  return trimmed || undefined;
}
