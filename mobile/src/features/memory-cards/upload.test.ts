import {
  MAX_MEMORY_CARD_UPLOAD_SIZE,
  MemoryCardUploadError,
  memoryCardsJson,
  parseMemoryCardUpload,
} from "./upload";

// BDD: FRONT-151, FRONT-156 - validation identifies the failing JSON path and
// accepts only the documented { cards: [...] } payload contract.
it("reports path-specific validation and rejects the legacy root-array shape", () => {
  expect(() =>
    parseMemoryCardUpload(
      JSON.stringify({ cards: [{ frontText: "word", backText: 4 }] }),
    ),
  ).toThrow(expect.objectContaining({ path: "cards[0].backText" }));
  expect(() =>
    parseMemoryCardUpload(
      JSON.stringify([{ frontText: "word", backText: "뜻" }]),
    ),
  ).toThrow(MemoryCardUploadError);
});

// BDD: FRONT-152, FRONT-155 - generated payloads expose only editable fields
// and remain valid at the server's 500-card request boundary.
it("generates a capped server-safe cards payload", () => {
  const cards = Array.from({ length: MAX_MEMORY_CARD_UPLOAD_SIZE + 3 }, (_, index) => ({
    cardId: index + 1,
    groupId: 2,
    frontText: `word-${index + 1}`,
    backText: `meaning-${index + 1}`,
    memorized: true,
    position: index,
    updatedAt: "2026-08-24T00:00:00Z",
  }));

  const json = memoryCardsJson(cards);
  const raw = JSON.parse(json) as { cards: Record<string, unknown>[] };
  expect(raw.cards).toHaveLength(MAX_MEMORY_CARD_UPLOAD_SIZE);
  expect(raw.cards[0]).toEqual({
    frontText: "word-1",
    backText: "meaning-1",
    exampleText: "",
    memo: "",
  });
  expect(raw.cards[0]).not.toHaveProperty("cardId");
  expect(parseMemoryCardUpload(json)).toHaveLength(MAX_MEMORY_CARD_UPLOAD_SIZE);
});
