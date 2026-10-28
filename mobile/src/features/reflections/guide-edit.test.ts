import {
  createGuideEditDraft,
  guideEditError,
  moveGuideEditItem,
  toEditGuideInput,
} from "./guide-edit";
import type { DiscussionGuide } from "./types";

const guide = {
  goal: "Original goal",
  guideVersion: 4,
  issues: ["Issue one", "Issue two"],
  items: [
    {
      expectedMinutes: 20,
      followUps: ["Why?"],
      intent: "Open",
      itemId: 8,
      order: 1,
      priority: "REQUIRED",
      question: "What changed?",
      questionId: 9,
      sensitivity: "LOW",
      skippable: false,
      sourceType: "REFLECTION",
      stage: "WARM_UP",
    },
  ],
  targetMinutes: 20,
} as DiscussionGuide;

describe("guide edit inputs", () => {
  it("pins the source version and produces an immutable edit payload", () => {
    const draft = createGuideEditDraft(guide);
    draft.goal = "  Revised goal  ";
    draft.items[0]!.question = "  Revised question  ";

    expect(guide.goal).toBe("Original goal");
    expect(guide.items[0]!.question).toBe("What changed?");
    expect(guideEditError(draft, 20)).toBeNull();
    expect(toEditGuideInput(draft, guide.guideVersion)).toEqual({
      expectedVersion: 4,
      goal: "Revised goal",
      issues: ["Issue one", "Issue two"],
      items: [
        {
          expectedMinutes: 20,
          followUps: ["Why?"],
          intent: "Open",
          itemId: 8,
          question: "Revised question",
        },
      ],
    });
  });

  it("moves optional items without changing required stage order", () => {
    const draft = createGuideEditDraft({
      ...guide,
      items: [
        guide.items[0]!,
        { ...guide.items[0]!, itemId: 10, priority: "OPTIONAL" },
      ],
    });
    expect(moveGuideEditItem(draft, 1, -1).items.map((entry) => entry.itemId)).toEqual([
      10,
      8,
    ]);
  });
});
