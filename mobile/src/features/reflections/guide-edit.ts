import type { DiscussionGuide, EditGuideInput } from "./types";

export type GuideEditDraft = {
  goal: string;
  issues: string[];
  items: DiscussionGuide["items"];
};

export function createGuideEditDraft(guide: DiscussionGuide): GuideEditDraft {
  return {
    goal: guide.goal,
    issues: [...guide.issues],
    items: guide.items.map((item) => ({
      ...item,
      followUps: [...item.followUps],
    })),
  };
}

export function guideEditError(
  draft: GuideEditDraft,
  targetMinutes: number,
): "blank" | "issues" | "minutes" | null {
  if (
    !draft.goal.trim() ||
    draft.items.some(
      (item) =>
        !item.question.trim() ||
        !item.intent.trim() ||
        item.followUps.some((followUp) => !followUp.trim()),
    )
  ) {
    return "blank";
  }
  const issues = draft.issues.map((issue) => issue.trim()).filter(Boolean);
  if (issues.length < 2 || issues.length > 4) return "issues";
  if (
    draft.items.some(
      (item) => item.expectedMinutes < 1 || item.expectedMinutes > 20,
    ) ||
    draft.items.reduce((sum, item) => sum + item.expectedMinutes, 0) !==
      targetMinutes
  ) {
    return "minutes";
  }
  return null;
}

export function toEditGuideInput(
  draft: GuideEditDraft,
  expectedVersion: number,
): EditGuideInput {
  return {
    expectedVersion,
    goal: draft.goal.trim(),
    issues: draft.issues.map((issue) => issue.trim()).filter(Boolean),
    items: draft.items.map((item) => ({
      expectedMinutes: item.expectedMinutes,
      followUps: item.followUps.map((followUp) => followUp.trim()),
      intent: item.intent.trim(),
      itemId: item.itemId,
      question: item.question.trim(),
    })),
  };
}

const requiredStages = [
  "WARM_UP",
  "INTERPRETATION",
  "EXPERIENCE",
  "SOCIAL_VALUE",
  "CLOSING",
];

export function moveGuideEditItem(
  draft: GuideEditDraft,
  index: number,
  offset: -1 | 1,
): GuideEditDraft {
  const target = index + offset;
  if (target < 0 || target >= draft.items.length) return draft;
  const items = [...draft.items];
  [items[index], items[target]] = [items[target]!, items[index]!];
  const requiredOrder = items
    .filter((item) => item.priority === "REQUIRED")
    .map((item) => item.stage);
  if (
    requiredOrder.some(
      (stage, requiredIndex) => stage !== requiredStages[requiredIndex],
    )
  ) {
    return draft;
  }
  return { ...draft, items };
}
