import { readingSessionTranscript } from "./transcript";
import type { ReadingSessionTimeline } from "./types";

// BDD: FRONT-075
it("groups persisted questions and messages by reflection window", () => {
  const transcript = readingSessionTranscript({
    bookAuthor: "Frank Herbert",
    bookId: 4,
    bookTitle: "Dune",
    highlights: [{ highlightId: 3, note: "Remember this", quoteText: "Fear is the mind-killer" }],
    insights: [{ content: "Power shapes ecology", insightId: 5 }],
    messages: [{ content: "My answer", createdAt: "2026-01-01", messageId: 7, messageOrder: 1, questionId: 8, role: "user", sessionId: 9, streamingStatus: "done", windowId: 6 }],
    questions: [{ questionId: 8, questionText: "What changed?", questionType: "generated", sessionId: 9, status: "answered", windowId: 6 }],
    sessionId: 9,
    stats: { answeredQuestionCount: 1, messageCount: 1, personaCount: 0, personaResponseCount: 0, questionCount: 1, windowCount: 1 },
    tags: [],
    title: "Dune reflection",
    windows: [{ personaIds: [], position: 0, sessionId: 9, status: "active", title: "Identity", windowId: 6, windowType: "question" }],
  } satisfies ReadingSessionTimeline);

  expect(transcript).toContain("# Dune reflection");
  expect(transcript).toContain("## Identity");
  expect(transcript).toContain("- What changed? (answered)");
  expect(transcript).toContain("**user:** My answer");
  expect(transcript).toContain("## Saved Notes");
});
