import { normalizeGuideProjection } from "./api";

describe("guide projection boundary", () => {
  it("denies facilitator-only participant fields by default", () => {
    const raw = {
      bookAuthor: "Author",
      bookTitle: "Book",
      current: true,
      goal: "Goal",
      guideId: 4,
      guideVersion: 2,
      issues: ["One", "Two"],
      items: [
        {
          expectedMinutes: 5,
          followUps: ["Private follow-up"],
          intent: "Private intent",
          order: 1,
          priority: "REQUIRED",
          privateSource: true,
          question: "Public question",
          sensitivity: "HIGH",
          skippable: true,
          sourceExcerpt: "Private excerpt",
          sourceLabel: "Private context",
          sourceType: "ANSWER",
          stage: "WARM_UP",
        },
      ],
      projection: "FACILITATOR",
      targetMinutes: 20,
    };

    const normalized = normalizeGuideProjection(raw as never, "PARTICIPANT");
    expect(normalized).toEqual({
      bookAuthor: "Author",
      bookTitle: "Book",
      current: true,
      goal: "Goal",
      guideId: 4,
      guideVersion: 2,
      issues: ["One", "Two"],
      items: [
        {
          order: 1,
          priority: "REQUIRED",
          question: "Public question",
          stage: "WARM_UP",
        },
      ],
      projection: "PARTICIPANT",
    });
    expect(JSON.stringify(normalized)).not.toMatch(
      /intent|source|sensitivity|skippable|expectedMinutes|followUps|privateSource/,
    );
  });
});
