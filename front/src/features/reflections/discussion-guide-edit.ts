import type {
  DiscussionGuideResponse,
  DiscussionQuestion,
  EditDiscussionGuideInput,
} from '@/types/api/reflection-loop';

const requiredStageOrder = ['WARM_UP', 'INTERPRETATION', 'EXPERIENCE', 'SOCIAL_VALUE', 'CLOSING'];

export interface GuideEditDraft {
  goal: string;
  issues: string[];
  items: DiscussionQuestion[];
}

export function createGuideEditDraft(guide: DiscussionGuideResponse): GuideEditDraft {
  return {
    goal: guide.goal,
    issues: [...guide.issues],
    items: guide.items.map((item) => ({
      ...item,
      followUps: [...item.followUps],
    })),
  };
}

export function guideEditMinutes(draft: GuideEditDraft): number {
  return draft.items.reduce((total, item) => total + item.expectedMinutes, 0);
}

export function guideEditValidationMessage(
  draft: GuideEditDraft,
  targetMinutes: number,
): string | null {
  if (
    !draft.goal.trim() ||
    draft.issues.some((issue) => !issue.trim()) ||
    draft.items.some(
      (item) =>
        !item.question.trim() ||
        !item.intent.trim() ||
        item.followUps.some((followUp) => !followUp.trim()),
    )
  ) {
    return '비어 있는 목표, 논점, 질문, 진행 의도 또는 후속 질문을 채워 주세요.';
  }
  if (draft.items.some((item) => item.expectedMinutes < 1 || item.expectedMinutes > 20)) {
    return '질문별 예상 시간은 1분에서 20분 사이로 입력해 주세요.';
  }
  if (guideEditMinutes(draft) !== targetMinutes) {
    return `질문 시간 합계를 목표 ${targetMinutes}분에 맞춰 주세요.`;
  }
  return null;
}

export function moveGuideEditItems(
  items: DiscussionQuestion[],
  index: number,
  offset: -1 | 1,
): DiscussionQuestion[] | null {
  const target = index + offset;
  if (target < 0 || target >= items.length) return null;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return hasRequiredStageOrder(next) ? next : null;
}

export function toEditDiscussionGuideInput(
  draft: GuideEditDraft,
  expectedVersion: number,
): EditDiscussionGuideInput {
  return {
    expectedVersion,
    goal: draft.goal.trim(),
    issues: draft.issues.map((issue) => issue.trim()),
    items: draft.items.map((item) => ({
      itemId: item.itemId,
      question: item.question.trim(),
      intent: item.intent.trim(),
      expectedMinutes: item.expectedMinutes,
      followUps: item.followUps.map((followUp) => followUp.trim()),
    })),
  };
}

function hasRequiredStageOrder(items: DiscussionQuestion[]): boolean {
  return (
    items
      .filter((item) => item.priority === 'REQUIRED')
      .map((item) => item.stage)
      .join('|') === requiredStageOrder.join('|')
  );
}
